// ── Configuration tracker conducteur ────────────────────────
// Clé anon uniquement (contrainte #5) — protégée par RLS.
export const CONFIG = {
  SUPABASE_URL: 'https://siewomjmhnufravrpqem.supabase.co',
  SUPABASE_ANON_KEY: '', // ← coller la clé anon ici

  // Stratégie GPS adaptative (§4.2)
  GPS_INTERVAL_MOVING_MS: 30000,    // 30s en mouvement
  GPS_INTERVAL_IDLE_MS: 120000,     // 120s immobile (>2 min à 0 km/h)
  GPS_INTERVAL_LOWBAT_MS: 60000,    // 60s si batterie < 20%
  GPS_ACCURACY_MAX_M: 50,           // rejette précision > 50m (contrainte #8)
  IDLE_AFTER_MS: 120000,            // immobile = 0 km/h pendant 2 min
  MOVING_SPEED_KMH: 5,
};
