// ── Benchmark temps réel : latence, fréquence, ping ─────────
import { supabase } from './realtime.js';

// Latence GPS→dispatcher en ms pour une entrée flotte
export function latencyMs(entry) {
  if (!entry.position?.recorded_at || !entry.receivedAt) return null;
  return Math.max(0, entry.receivedAt - new Date(entry.position.recorded_at).getTime());
}

export function latencyClass(ms) {
  if (ms == null) return '';
  if (ms < 5000) return 'latency-good';
  if (ms < 35000) return 'latency-warn';
  return 'latency-bad';
}

export function accuracyClass(m) {
  if (m == null) return '';
  if (m <= 10) return 'latency-good';
  if (m <= 20) return 'latency-warn';
  return 'latency-bad';
}

// Fréquence réelle : positions reçues dans la dernière minute
export function updatesPerMinute(entry) {
  return entry.counters.perMinute.length;
}

export function uptime(entry) {
  const s = Math.floor((Date.now() - entry.counters.sessionStart) / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}:${String(s % 60).padStart(2, '0')}`;
}

// Ping Supabase périodique → badge topbar
export function startPing() {
  const el = document.getElementById('ping-status');
  async function ping() {
    const t0 = performance.now();
    const { error } = await supabase.from('babyroad_users').select('id').limit(1);
    const ms = Math.round(performance.now() - t0);
    el.textContent = error ? '⚠ offline' : `⚡ ${ms} ms`;
    el.style.background = error ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.15)';
  }
  ping();
  setInterval(ping, 30000);
}
