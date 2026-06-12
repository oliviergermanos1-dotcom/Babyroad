// ── Moteur d'alertes : immobile, batterie, signal, zone, vitesse ──
import { CONFIG } from './config.js';
import { supabase, fleet } from './realtime.js';
import { checkTransitions } from './geofences.js';

export const outOfZoneIds = new Set(); // camions signalés hors zone (statut rouge)

const alertState = new Map(); // `${userId}:${type}` → timestamp dernier déclenchement
const COOLDOWN_MS = 10 * 60 * 1000; // anti-spam : 1 alerte du même type / 10 min
const immobileSince = new Map();

let renderList = null;
export function setAlertRenderer(fn) { renderList = fn; }
const recentAlerts = [];

async function raise(entry, type, message, critical = false) {
  const key = `${entry.user.id}:${type}`;
  const last = alertState.get(key) || 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  alertState.set(key, Date.now());

  const alert = {
    user_id: entry.user.id,
    alert_type: type,
    message,
    lat: entry.position?.lat ?? null,
    lng: entry.position?.lng ?? null,
  };

  recentAlerts.unshift({ ...alert, full_name: entry.user.full_name, critical, at: new Date() });
  if (recentAlerts.length > 30) recentAlerts.pop();
  if (renderList) renderList(recentAlerts);
  toast(`${entry.user.full_name} — ${message}`, critical);
  playSound();

  const { error } = await supabase.from('babyroad_alerts').insert(alert);
  if (error) console.warn('Insert alerte :', error.message);
}

// Appelé à chaque position reçue en temps réel
export function onPositionAlerts(entry) {
  const p = entry.position;
  if (!p) return;

  // HIGH_SPEED
  if ((p.speed || 0) > CONFIG.HIGH_SPEED_KMH) {
    raise(entry, 'HIGH_SPEED', `Vitesse excessive : ${Math.round(p.speed)} km/h`, true);
  }

  // LOW_BATTERY
  if (p.battery != null && p.battery < CONFIG.LOW_BATTERY_THRESHOLD) {
    raise(entry, 'LOW_BATTERY', `Batterie faible : ${p.battery}%`, true);
  }

  // IMMOBILE
  if ((p.speed || 0) <= 2) {
    if (!immobileSince.has(entry.user.id)) immobileSince.set(entry.user.id, Date.now());
    const mins = (Date.now() - immobileSince.get(entry.user.id)) / 60000;
    if (mins >= CONFIG.IMMOBILE_ALERT_MINUTES) {
      raise(entry, 'IMMOBILE', `Immobile depuis ${Math.round(mins)} min`);
    }
  } else {
    immobileSince.delete(entry.user.id);
  }

  // GEOFENCES
  checkTransitions(entry.user.id, p.lat, p.lng).forEach(({ fence, type }) => {
    if (type === 'EXIT') {
      outOfZoneIds.add(entry.user.id);
      raise(entry, 'GEOFENCE_EXIT', `Sortie de zone : ${fence.name}`, true);
    } else {
      outOfZoneIds.delete(entry.user.id);
      raise(entry, 'GEOFENCE_ENTER', `Entrée dans : ${fence.name}`);
    }
  });
}

// Vérification périodique perte de signal (pas d'événement → il faut un timer)
export function startSignalWatch() {
  setInterval(() => {
    fleet.forEach((entry) => {
      if (!entry.receivedAt) return;
      const ageS = (Date.now() - entry.receivedAt) / 1000;
      if (ageS > CONFIG.SIGNAL_LOST_SECONDS && ageS < CONFIG.SIGNAL_LOST_SECONDS + 60) {
        raise(entry, 'SIGNAL_LOST', `Aucune position depuis ${Math.round(ageS / 60)} min`, true);
      }
    });
  }, 30000);
}

// ── UI helpers ──────────────────────────────────────────────
export function toast(message, critical = false) {
  const el = document.createElement('div');
  el.className = `toast ${critical ? 'critical' : ''}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

let audioCtx = null;
function playSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch { /* audio bloqué avant interaction utilisateur */ }
}
