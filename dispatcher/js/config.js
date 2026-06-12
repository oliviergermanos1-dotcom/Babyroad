// ============================================================
// BABYROAD — Configuration dispatcher
// La clé anon Supabase est safe côté client (protégée par RLS).
// NE JAMAIS mettre SUPABASE_SERVICE_KEY ici (contrainte #5).
// ============================================================

export const CONFIG = {
  // ── Supabase ──────────────────────────────────────────────
  SUPABASE_URL: 'https://fpntzgrocuiiqjixtbuo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbnR6Z3JvY3VpaXFqaXh0YnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjYwMzUsImV4cCI6MjA5NDc0MjAzNX0.Pu3XlmjBRlp6XQ5dwiBIB_w_SdBUNMxZMJmqTUdEFo8',

  // ── TomTom (source trafic UNIQUE — contrainte #4) ─────────
  TOMTOM_API_KEY: '', // ← developer.tomtom.com (2 500 req/jour gratuit)

  // ── Fond de carte ─────────────────────────────────────────
  // Si MAPTILER_KEY vide → fallback OpenFreeMap (100% gratuit, sans clé)
  MAPTILER_KEY: '',

  // ── Centre carte : Abidjan ────────────────────────────────
  MAP_CENTER: [-4.0083, 5.3600], // [lng, lat]
  MAP_ZOOM: 12,
  MAP_PITCH: 45,

  // ── Seuils alertes ────────────────────────────────────────
  IMMOBILE_ALERT_MINUTES: 10,
  LOW_BATTERY_THRESHOLD: 20,
  SIGNAL_LOST_SECONDS: 120,
  HIGH_SPEED_KMH: 90,

  // ── Performance (contrainte #9) ───────────────────────────
  TRAJECTORY_POINTS_MAX: 50,
  UI_THROTTLE_MS: 1000, // max 1 maj UI / seconde

  // ── Météo Open-Meteo (aucune clé requise) ─────────────────
  OPEN_METEO_URL: 'https://api.open-meteo.com/v1/forecast',
};
