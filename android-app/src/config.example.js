// ── COPIER ce fichier en config.js et remplir les valeurs ───
// config.js est gitignoré (clés hors du repo — contrainte §6.2).
export const CONFIG = {
  SUPABASE_URL: 'https://fpntzgrocuiiqjixtbuo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnR6Z3JvY3VpaXFqaXh0YnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjYwMzUsImV4cCI6MjA5NDc0MjAzNX0.Pu3XlmjBRlp6XQ5dwiBIB_w_SdBUNMxZMJmqTUdEFo8',

  GPS_INTERVAL_MOVING_MS: 30000,
  GPS_INTERVAL_IDLE_MS: 120000,
  GPS_INTERVAL_LOWBAT_MS: 60000,
  GPS_ACCURACY_MAX_M: 50,
  IDLE_AFTER_MS: 120000,
  MOVING_SPEED_KMH: 5,
  DISTANCE_FILTER_M: 15, // envoi si déplacement > 15 m
};
