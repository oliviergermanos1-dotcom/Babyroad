// ── Envoi positions Supabase + fréquence adaptative ─────────
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

let lastSent = 0;
let idleSince = null;
let batteryLevel = null;
let stats = { sent: 0, lastSyncAt: null, lastPosition: null };

export function getStats() { return stats; }

export async function loadDrivers() {
  const { data, error } = await supabase
    .from('babyroad_users')
    .select('*')
    .eq('is_active', true)
    .order('user_code');
  if (error) throw new Error(error.message);
  return data;
}

// Stratégie adaptative §4.2 :
// mouvement → 30s · immobile 2min → 120s · batterie <20% ou 2G → 60s
function currentIntervalMs() {
  if (batteryLevel != null && batteryLevel < 20) return CONFIG.GPS_INTERVAL_LOWBAT_MS;
  if (idleSince && Date.now() - idleSince > CONFIG.IDLE_AFTER_MS) return CONFIG.GPS_INTERVAL_IDLE_MS;
  if (networkType() === '2G') return CONFIG.GPS_INTERVAL_LOWBAT_MS;
  return CONFIG.GPS_INTERVAL_MOVING_MS;
}

export async function sendPosition(userId, pos) {
  stats.lastPosition = pos;

  if (pos.speed < CONFIG.MOVING_SPEED_KMH) {
    if (!idleSince) idleSince = Date.now();
  } else {
    idleSince = null;
  }

  if (Date.now() - lastSent < currentIntervalMs()) return;
  lastSent = Date.now();

  await refreshBattery();

  const { error } = await supabase.from('babyroad_positions').insert({
    user_id: userId,
    lat: pos.lat,
    lng: pos.lng,
    speed: Math.round(pos.speed * 10) / 10,
    heading: pos.heading,
    accuracy: pos.accuracy,
    altitude: pos.altitude,
    battery: batteryLevel,
    network_type: networkType(),
  });

  if (error) {
    console.warn('Sync Supabase :', error.message);
  } else {
    stats.sent += 1;
    stats.lastSyncAt = Date.now();
  }
  document.dispatchEvent(new CustomEvent('babyroad:sync', { detail: { error } }));
}

async function refreshBattery() {
  try {
    const b = await navigator.getBattery();
    batteryLevel = Math.round(b.level * 100);
  } catch { /* WebView sans Battery API */ }
}

function networkType() {
  const t = navigator.connection?.effectiveType || '';
  if (t === '4g') return '4G';
  if (t === '3g') return '3G';
  if (t === '2g' || t === 'slow-2g') return '2G';
  return navigator.onLine ? 'WiFi' : 'OFF';
}
