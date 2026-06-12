// ── UI conducteur APK — orchestration ───────────────────────
import { startTracking, stopTracking, isTracking } from './background.js';
import { loadDrivers, getStats } from './tracker.js';

const ui = {
  select: document.getElementById('driver-select'),
  vehicle: document.getElementById('vehicle-line'),
  state: document.getElementById('state-label'),
  coords: document.getElementById('coords'),
  speed: document.getElementById('speed'),
  heading: document.getElementById('heading'),
  sync: document.getElementById('sync'),
  sent: document.getElementById('sent'),
  duration: document.getElementById('duration'),
  btn: document.getElementById('btn-toggle'),
};

let drivers = [];
let sessionStart = null;

async function init() {
  try {
    drivers = await loadDrivers();
  } catch (e) {
    ui.select.innerHTML = `<option>Erreur : ${e.message}</option>`;
    return;
  }
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
  ui.btn.addEventListener('click', toggle);

  document.addEventListener('babyroad:sync', (e) => {
    document.body.classList.toggle('signal-lost', !!e.detail.error);
  });

  setInterval(tick, 1000);
}

function updateVehicleLine() {
  const d = drivers.find((x) => x.id === ui.select.value);
  ui.vehicle.textContent = d ? `Véhicule : ${d.vehicle_id || '—'} (${d.vehicle_type || '—'})` : '';
}

async function toggle() {
  if (isTracking()) {
    await stopTracking();
    sessionStart = null;
    document.body.classList.remove('tracking', 'signal-lost');
    ui.state.textContent = 'TRACKING ARRÊTÉ';
    ui.btn.textContent = '▶ DÉMARRER LE TRACKING';
    ui.btn.className = 'big-btn start';
    ui.select.disabled = false;
  } else {
    await startTracking(ui.select.value);
    sessionStart = Date.now();
    document.body.classList.add('tracking');
    ui.state.textContent = 'TRACKING ACTIF';
    ui.btn.textContent = '■ ARRÊTER LE TRACKING';
    ui.btn.className = 'big-btn stop';
    ui.select.disabled = true;
  }
}

function tick() {
  const s = getStats();
  if (s.lastPosition) {
    ui.coords.textContent = `${s.lastPosition.lat.toFixed(5)}°  ${s.lastPosition.lng.toFixed(5)}°`;
    ui.speed.textContent = Math.round(s.lastPosition.speed);
    ui.heading.textContent = Math.round(s.lastPosition.heading);
  }
  ui.sent.textContent = s.sent;
  if (s.lastSyncAt) {
    ui.sync.textContent = `sync ${Math.round((Date.now() - s.lastSyncAt) / 1000)}s`;
  }
  if (sessionStart) {
    const t = Math.floor((Date.now() - sessionStart) / 1000);
    ui.duration.textContent =
      `${String(Math.floor(t / 3600)).padStart(2, '0')}:` +
      `${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:` +
      `${String(t % 60).padStart(2, '0')}`;
  }
}

init();
