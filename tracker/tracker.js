// ============================================================
// BABYROAD — PWA conducteur : GPS écran allumé + Wake Lock
// (le tracking écran éteint est assuré par l'APK — voir /android)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import { GPSKalmanFilter } from './kalman.js';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const kalman = new GPSKalmanFilter();

const ui = {
  select: document.getElementById('driver-select'),
  vehicle: document.getElementById('vehicle-line'),
  state: document.getElementById('state-label'),
  coords: document.getElementById('coords'),
  speed: document.getElementById('speed'),
  heading: document.getElementById('heading'),
  battery: document.getElementById('battery'),
  network: document.getElementById('network'),
  sync: document.getElementById('sync'),
  duration: document.getElementById('duration'),
  sent: document.getElementById('sent-count'),
  rejected: document.getElementById('rejected-count'),
  btn: document.getElementById('btn-toggle'),
};

let drivers = [];
let tracking = false;
let watchId = null;
let wakeLock = null;
let lastSent = 0;
let lastPosition = null;
let idleSince = null;
let sessionStart = null;
let lastSyncAt = null;
let sentCount = 0;
let rejectedCount = 0;
let batteryLevel = null;

// ── Init ────────────────────────────────────────────────────
async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (!CONFIG.SUPABASE_ANON_KEY) {
    ui.select.innerHTML = '<option>⚠ Configurer config.js</option>';
    return;
  }

  const { data, error } = await supabase
    .from('babyroad_users')
    .select('*')
    .eq('is_active', true)
    .order('user_code');
  if (error) {
    ui.select.innerHTML = `<option>Erreur : ${error.message}</option>`;
    return;
  }
  drivers = data;
  ui.select.innerHTML = drivers
    .map((d) => `<option value="${d.id}">${d.full_name} (${d.user_code})</option>`)
    .join('');

  const saved = localStorage.getItem('babyroad_driver_id');
  if (saved && drivers.some((d) => d.id === saved)) ui.select.value = saved;
  updateVehicleLine();

  ui.select.addEventListener('change', () => {
    localStorage.setItem('babyroad_driver_id', ui.select.value);
    updateVehicleLine();
  });

  ui.btn.disabled = false;
  ui.btn.addEventListener('click', () => (tracking ? stopTracking() : startTracking()));

  watchBattery();
  setInterval(tickDuration, 1000);
}

function updateVehicleLine() {
  const d = drivers.find((x) => x.id === ui.select.value);
  ui.vehicle.textContent = d ? `Véhicule : ${d.vehicle_id || '—'} (${d.vehicle_type || '—'})` : '';
}

// ── Start / Stop ────────────────────────────────────────────
async function startTracking() {
  tracking = true;
  sessionStart = Date.now();
  sentCount = 0; rejectedCount = 0;
  kalman.reset();
  ui.select.disabled = true;
  document.body.classList.remove('stopped');
  ui.state.textContent = 'TRACKING ACTIF';
  ui.btn.textContent = '■ ARRÊTER LE TRACKING';
  ui.btn.className = 'big-btn stop';

  await acquireWakeLock();

  watchId = navigator.geolocation.watchPosition(onPosition, onGPSError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 20000,
  });
}

function stopTracking() {
  tracking = false;
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  releaseWakeLock();
  ui.select.disabled = false;
  document.body.classList.add('stopped');
  document.body.classList.remove('signal-lost');
  ui.state.textContent = 'TRACKING ARRÊTÉ';
  ui.btn.textContent = '▶ DÉMARRER LE TRACKING';
  ui.btn.className = 'big-btn start';
}

// ── GPS ─────────────────────────────────────────────────────
function onPosition(pos) {
  const c = pos.coords;

  // Contrainte #8 : rejet précision > 50m
  if (c.accuracy > CONFIG.GPS_ACCURACY_MAX_M) {
    rejectedCount += 1;
    ui.rejected.textContent = rejectedCount;
    return;
  }

  const speedKmh = (c.speed || 0) * 3.6;
  const filtered = kalman.filter(c.latitude, c.longitude, c.accuracy, pos.timestamp);

  lastPosition = {
    lat: filtered.lat,
    lng: filtered.lng,
    speed: Math.round(speedKmh * 10) / 10,
    heading: c.heading || 0,
    accuracy: c.accuracy,
    altitude: c.altitude || 0,
  };

  // UI live
  ui.coords.textContent = `${filtered.lat.toFixed(5)}°  ${filtered.lng.toFixed(5)}°`;
  ui.speed.textContent = Math.round(speedKmh);
  ui.heading.textContent = Math.round(c.heading || 0);

  // suivi immobilité pour la fréquence adaptative
  if (speedKmh < CONFIG.MOVING_SPEED_KMH) {
    if (!idleSince) idleSince = Date.now();
  } else {
    idleSince = null;
  }

  maybeSend();
}

function onGPSError(err) {
  console.warn('GPS :', err.message);
  document.body.classList.add('signal-lost');
}

// ── Fréquence adaptative (§4.2) ─────────────────────────────
function currentIntervalMs() {
  if (batteryLevel != null && batteryLevel < 20) return CONFIG.GPS_INTERVAL_LOWBAT_MS;
  if (idleSince && Date.now() - idleSince > CONFIG.IDLE_AFTER_MS) return CONFIG.GPS_INTERVAL_IDLE_MS;
  if (networkType() === '2G') return CONFIG.GPS_INTERVAL_LOWBAT_MS;
  return CONFIG.GPS_INTERVAL_MOVING_MS;
}

async function maybeSend() {
  if (!tracking || !lastPosition) return;
  if (Date.now() - lastSent < currentIntervalMs()) return;
  lastSent = Date.now();

  const { error } = await supabase.from('babyroad_positions').insert({
    user_id: ui.select.value,
    ...lastPosition,
    battery: batteryLevel,
    network_type: networkType(),
  });

  if (error) {
    document.body.classList.add('signal-lost');
    ui.sync.textContent = `✗ erreur sync`;
  } else {
    document.body.classList.remove('signal-lost');
    lastSyncAt = Date.now();
    sentCount += 1;
    ui.sent.textContent = sentCount;
  }
}

// ── Wake Lock (écran allumé pendant tracking PWA) ───────────
async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      if (tracking) acquireWakeLock(); // ré-acquérir si relâché (onglet revisible)
    });
  } catch (e) {
    console.warn('Wake Lock indisponible :', e.message);
  }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (tracking && document.visibilityState === 'visible') acquireWakeLock();
});

// ── Batterie + réseau ───────────────────────────────────────
async function watchBattery() {
  try {
    const b = await navigator.getBattery();
    const update = () => {
      batteryLevel = Math.round(b.level * 100);
      ui.battery.textContent = batteryLevel;
    };
    update();
    b.addEventListener('levelchange', update);
  } catch { ui.battery.textContent = '—'; }
  setInterval(() => { ui.network.textContent = networkType(); }, 5000);
  ui.network.textContent = networkType();
}

function networkType() {
  const t = navigator.connection?.effectiveType || '';
  if (t === '4g') return '4G';
  if (t === '3g') return '3G';
  if (t === '2g' || t === 'slow-2g') return '2G';
  return navigator.onLine ? 'WiFi' : 'OFF';
}

// ── Horloges UI ─────────────────────────────────────────────
function tickDuration() {
  if (tracking && sessionStart) {
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    ui.duration.textContent =
      `${String(Math.floor(s / 3600)).padStart(2, '0')}:` +
      `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:` +
      `${String(s % 60).padStart(2, '0')}`;
  }
  if (lastSyncAt) {
    ui.sync.textContent = `✓ sync ${Math.round((Date.now() - lastSyncAt) / 1000)}s`;
  }
}

init();
