-- ============================================================
-- BABYROAD — Fleet Tracking System
-- Schéma Supabase complet — Phase 1
-- ✅ Appliqué le 2026-06-12 sur le projet fpntzgrocuiiqjixtbuo.
-- Toutes les tables sont préfixées babyroad_ (contrainte #6) —
-- le script reste exécutable tel quel sur tout autre projet Supabase.
-- Script IDEMPOTENT : ré-exécutable sans danger.
-- ============================================================

-- ── 1. Table conducteurs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS babyroad_users (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_code     text UNIQUE NOT NULL,     -- 'DRIVER_01' à 'DRIVER_04'
  full_name     text NOT NULL,
  phone         text,
  vehicle_id    text,
  vehicle_type  text,                     -- 'semi-remorque' | 'porteur' | 'citerne'
  marker_color  text DEFAULT '#1B6B3A',
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ── 2. Table positions (flux principal) ─────────────────────
CREATE TABLE IF NOT EXISTS babyroad_positions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES babyroad_users(id) ON DELETE CASCADE,
  lat           float8 NOT NULL,
  lng           float8 NOT NULL,
  speed         float8 DEFAULT 0,         -- km/h
  heading       float8 DEFAULT 0,         -- 0°–360°
  accuracy      float8,                   -- mètres
  altitude      float8,
  battery       int,                      -- % 0–100
  network_type  text,                     -- '4G' | '3G' | 'WiFi' | '2G'
  recorded_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_babyroad_pos_user_time
  ON babyroad_positions(user_id, recorded_at DESC);

-- ── 3. Vue dernière position par conducteur ─────────────────
CREATE OR REPLACE VIEW babyroad_last_positions AS
SELECT DISTINCT ON (fp.user_id)
  fp.*,
  fu.full_name,
  fu.vehicle_id,
  fu.vehicle_type,
  fu.marker_color,
  fu.user_code,
  EXTRACT(EPOCH FROM (now() - fp.recorded_at)) AS seconds_ago
FROM babyroad_positions fp
JOIN babyroad_users fu ON fu.id = fp.user_id
WHERE fu.is_active = true
ORDER BY fp.user_id, fp.recorded_at DESC;

-- ── 4. Table alertes ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS babyroad_alerts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES babyroad_users(id),
  alert_type    text NOT NULL,
  -- 'IMMOBILE' | 'LOW_BATTERY' | 'GEOFENCE_EXIT'
  -- 'GEOFENCE_ENTER' | 'SIGNAL_LOST' | 'HIGH_SPEED'
  message       text,
  lat           float8,
  lng           float8,
  is_resolved   boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz
);

-- ── 5. Table geofences ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS babyroad_geofences (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text NOT NULL,
  zone_type      text,    -- 'PORT' | 'DEPOT' | 'CORRIDOR' | 'RESTRICTED'
  center_lat     float8 NOT NULL,
  center_lng     float8 NOT NULL,
  radius_m       float8 NOT NULL,
  alert_on_exit  boolean DEFAULT true,
  alert_on_enter boolean DEFAULT false,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- ── 6. RLS ──────────────────────────────────────────────────
ALTER TABLE babyroad_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE babyroad_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE babyroad_alerts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE babyroad_geofences ENABLE ROW LEVEL SECURITY;

-- Chauffeur : INSERT positions (anon key, validation app par user_code)
DROP POLICY IF EXISTS "driver_insert_own_position" ON babyroad_positions;
CREATE POLICY "driver_insert_own_position"
ON babyroad_positions FOR INSERT
WITH CHECK (true);

-- Dispatcher : lecture totale
DROP POLICY IF EXISTS "dispatcher_select_all" ON babyroad_positions;
CREATE POLICY "dispatcher_select_all"
ON babyroad_positions FOR SELECT USING (true);

DROP POLICY IF EXISTS "dispatcher_select_users" ON babyroad_users;
CREATE POLICY "dispatcher_select_users"
ON babyroad_users FOR SELECT USING (true);

-- Alertes : lecture/écriture dispatcher
DROP POLICY IF EXISTS "dispatcher_manage_alerts" ON babyroad_alerts;
CREATE POLICY "dispatcher_manage_alerts"
ON babyroad_alerts FOR ALL USING (true) WITH CHECK (true);

-- Geofences : lecture publique (dessin carte)
DROP POLICY IF EXISTS "dispatcher_select_geofences" ON babyroad_geofences;
CREATE POLICY "dispatcher_select_geofences"
ON babyroad_geofences FOR SELECT USING (true);

-- ── 7. Realtime ─────────────────────────────────────────────
-- Ajoute babyroad_positions à la publication Realtime
-- (équivalent SQL du toggle "Enable Realtime" du Table Editor)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE babyroad_positions;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- déjà publié
END $$;

-- ── 8. Seed : 4 conducteurs (noms à personnaliser) ──────────
INSERT INTO babyroad_users (user_code, full_name, vehicle_id, vehicle_type, marker_color)
VALUES
  ('DRIVER_01', 'Chauffeur 1', 'CAM-001', 'porteur',       '#1B6B3A'),
  ('DRIVER_02', 'Chauffeur 2', 'CAM-002', 'porteur',       '#2E8B57'),
  ('DRIVER_03', 'Chauffeur 3', 'CAM-003', 'semi-remorque', '#F7941D'),
  ('DRIVER_04', 'Chauffeur 4', 'CAM-004', 'citerne',       '#FFB347')
ON CONFLICT (user_code) DO NOTHING;

-- ── 9. Seed : geofences Grand Abidjan ───────────────────────
INSERT INTO babyroad_geofences
  (name, zone_type, center_lat, center_lng, radius_m, alert_on_exit, alert_on_enter)
SELECT * FROM (VALUES
  ('Port Autonome Abidjan',   'PORT',       5.2920::float8, -4.0067::float8, 500::float8, true,  false),
  ('Zone Industrielle Vridi', 'DEPOT',      5.2634, -3.9698, 800, true,  false),
  ('Dépôt Treichville',       'DEPOT',      5.2995, -4.0102, 300, true,  true),
  ('Marché Adjamé',           'RESTRICTED', 5.3558, -4.0197, 400, false, true),
  ('Autoroute Nord Entrée',   'CORRIDOR',   5.4123, -4.0234, 200, false, true),
  ('Pont De Gaulle',          'CORRIDOR',   5.3312, -4.0178, 150, false, true),
  ('4ème Pont Yopougon',      'CORRIDOR',   5.3456, -4.0567, 200, false, true),
  ('Carrefour Siporex',       'RESTRICTED', 5.3678, -4.0789, 300, false, true),
  ('Rocade Y4 Ébimpé',        'CORRIDOR',   5.4234, -4.0123, 500, false, true),
  ('Zone Portuaire Vridi',    'PORT',       5.2456, -3.9234, 600, true,  false)
) AS seed(name, zone_type, center_lat, center_lng, radius_m, alert_on_exit, alert_on_enter)
WHERE NOT EXISTS (
  SELECT 1 FROM babyroad_geofences g WHERE g.name = seed.name
);

-- ============================================================
-- Vérification post-exécution :
--   SELECT count(*) FROM babyroad_users;      -- attendu : 4
--   SELECT count(*) FROM babyroad_geofences;  -- attendu : 10
--   SELECT * FROM babyroad_last_positions;    -- vide tant qu'aucune position
-- ============================================================
