// ── Configuration tracker conducteur ────────────────────────
// Clé anon uniquement (contrainte #5) — protégée par RLS.
export const CONFIG = {
  SUPABASE_URL: 'https://fpntzgrocuiiqjixtbuo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnR6Z3JvY3VpaXFqaXh0YnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjYwMzUsImV4cCI6MjA5NDc0MjAzNX0.Pu3XlmjBRlp6XQ5dwiBIB_w_SdBUNMxZMJmqTUdEFo8',

  // Stratégie GPS adaptative (§4.2)
  GPS_INTERVAL_MOVING_MS: 30000,    // 30s en mouvement
  GPS_INTERVAL_IDLE_MS: 120000,     // 120s immobile (>2 min à 0 km/h)
  GPS_INTERVAL_LOWBAT_MS: 60000,    // 60s si batterie < 20%
  GPS_ACCURACY_MAX_M: 50,           // rejette précision > 50m (contrainte #8)
  IDLE_AFTER_MS: 120000,            // immobile = 0 km/h pendant 2 min
  MOVING_SPEED_KMH: 5,

  // Vidéo bodycam : mode discret (téléphone d'entreprise, politique signée
  // par le chauffeur). true = pas de bandeau "EN DIRECT" ni vibration.
  // Repasser à false si l'app est installée sur un téléphone personnel.
  LIVE_DISCRET: true,
};
