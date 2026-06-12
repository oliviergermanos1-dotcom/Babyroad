// ── Supabase Realtime — WebSocket positions ─────────────────
// Contrainte #3 : channel.on('postgres_changes') — pas de polling.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// État central de la flotte : Map<user_id, { user, position, receivedAt, counters }>
export const fleet = new Map();

const listeners = [];
export function onFleetUpdate(fn) { listeners.push(fn); }

// Throttle UI : max 1 notification / seconde (contrainte #9)
let pending = false;
function notify() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    listeners.forEach((fn) => fn(fleet));
  }, CONFIG.UI_THROTTLE_MS);
}

export async function loadInitialState() {
  const { data: users, error: uErr } = await supabase
    .from('babyroad_users')
    .select('*')
    .eq('is_active', true)
    .order('user_code');
  if (uErr) throw new Error(`Chargement conducteurs : ${uErr.message}`);

  users.forEach((u) => {
    fleet.set(u.id, {
      user: u,
      position: null,
      receivedAt: null,
      counters: { received: 0, sessionStart: Date.now(), distanceKm: 0, perMinute: [] },
    });
  });

  const { data: lasts, error: pErr } = await supabase
    .from('babyroad_last_positions')
    .select('*');
  if (pErr) throw new Error(`Dernières positions : ${pErr.message}`);

  (lasts || []).forEach((p) => {
    const entry = fleet.get(p.user_id);
    if (entry) {
      entry.position = p;
      entry.receivedAt = Date.now() - (p.seconds_ago || 0) * 1000;
    }
  });

  notify();
  return users;
}

export function subscribeRealtime(onPosition) {
  const channel = supabase
    .channel('babyroad-positions')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'babyroad_positions' },
      (payload) => {
        const p = payload.new;
        const entry = fleet.get(p.user_id);
        if (!entry) return;
        const prev = entry.position;
        entry.position = { ...p, ...userFields(entry.user) };
        entry.receivedAt = Date.now();
        entry.counters.received += 1;
        entry.counters.perMinute.push(Date.now());
        // fenêtre glissante 60s pour la fréquence réelle
        entry.counters.perMinute = entry.counters.perMinute.filter(
          (t) => Date.now() - t < 60000
        );
        if (prev) {
          entry.counters.distanceKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
        }
        if (onPosition) onPosition(entry, prev);
        notify();
      }
    )
    .subscribe();
  return channel;
}

function userFields(u) {
  return {
    full_name: u.full_name,
    vehicle_id: u.vehicle_id,
    vehicle_type: u.vehicle_type,
    marker_color: u.marker_color,
    user_code: u.user_code,
  };
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Statut d'un camion d'après sa dernière position
export function truckStatus(entry, outOfZoneIds = new Set()) {
  if (!entry.position || !entry.receivedAt) return 'offline';
  const ageS = (Date.now() - entry.receivedAt) / 1000;
  if (ageS > CONFIG.SIGNAL_LOST_SECONDS) return 'offline';
  if (outOfZoneIds.has(entry.user.id)) return 'horszone';
  if ((entry.position.speed || 0) <= 2) return 'arrete';
  return 'actif';
}
