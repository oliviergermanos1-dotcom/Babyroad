// ── COPIER ce fichier en config.js et remplir les valeurs ───
// config.js est gitignoré (clés hors du repo — contrainte §6.2).
export const CONFIG = {
  SUPABASE_URL: 'https://siewomjmhnufravrpqem.supabase.co',
  SUPABASE_ANON_KEY: '', // ← clé anon (safe côté client, protégée par RLS)

  GPS_INTERVAL_MOVING_MS: 30000,
  GPS_INTERVAL_IDLE_MS: 120000,
  GPS_INTERVAL_LOWBAT_MS: 60000,
  GPS_ACCURACY_MAX_M: 50,
  IDLE_AFTER_MS: 120000,
  MOVING_SPEED_KMH: 5,
  DISTANCE_FILTER_M: 15, // envoi si déplacement > 15 m
};
