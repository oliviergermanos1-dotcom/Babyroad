# 🟢 BABYROAD — Fleet Tracking System

Suivi GPS temps réel de 4 véhicules sur le Grand Abidjan (Côte d'Ivoire).
Dashboard dispatcher + app conducteur (PWA et APK Android écran éteint).
**Coût d'infrastructure : 0 FCFA/mois** (Supabase + Vercel + TomTom + Open-Meteo gratuits).

> Référence complète : `Babyroad_Dossier_Technique_v1.0.docx` (dossier technique).

## Architecture

```
Téléphones conducteurs (x4, Android)
  APK Capacitor — Foreground Service — GPS écran éteint
        │ HTTPS REST (30s adaptatif)
        ▼
Supabase (siewomjmhnufravrpqem) — tables babyroad_*
        │ WebSocket Realtime
        ▼
Dashboard dispatcher (Vercel) — MapLibre GL JS
```

## Structure du repo

| Dossier | Rôle | Déploiement |
|---|---|---|
| `supabase/babyroad_schema.sql` | Schéma BDD complet (tables, vue, RLS, Realtime, seeds) | SQL Editor Supabase |
| `dispatcher/` | Dashboard carte temps réel | Vercel → `/dispatcher/` |
| `tracker/` | PWA conducteur (écran allumé + Wake Lock) | Vercel → `/tracker/` |
| `android-app/` | Projet Capacitor → APK (écran éteint) | Build local (voir `android-app/BUILD-APK.md`) |

## Mise en route (Phase 1 → 5)

### 1. Supabase — ✅ DÉJÀ FAIT (12 juin 2026)
Le schéma `supabase/babyroad_schema.sql` est **appliqué** sur le projet
`fpntzgrocuiiqjixtbuo` (et non `siewomjmhnufravrpqem` comme prévu au dossier —
seul projet accessible au moment du setup ; le script reste ré-exécutable sur
n'importe quel projet si on veut migrer). 4 tables + vue + RLS + Realtime actifs,
4 conducteurs + 10 geofences insérés.

Personnaliser les noms des conducteurs ([SQL Editor](https://supabase.com/dashboard/project/fpntzgrocuiiqjixtbuo/sql)) :
   ```sql
   UPDATE babyroad_users SET full_name='Koné Mamadou', vehicle_id='CAM-AGL-001' WHERE user_code='DRIVER_01';
   ```

### 2. Clés API
1. **Supabase anon key** : ✅ déjà renseignée dans les 3 configs (safe côté client, RLS).
2. **TomTom** (trafic) : compte gratuit sur [developer.tomtom.com](https://developer.tomtom.com)
   (2 500 req/jour) → coller dans `dispatcher/js/config.js` (`TOMTOM_API_KEY`).
3. **MapTiler** (optionnel) : sans clé, la carte utilise le fallback OpenFreeMap (gratuit, sans quota).

> La clé **anon** est safe côté client (protégée par RLS). La clé **service** ne doit
> JAMAIS apparaître dans le code client (contrainte #5).

### 3. Déployer sur Vercel
Importer le repo dans [vercel.com/new](https://vercel.com/new) (projet statique, aucun build).
- Dashboard : `https://<projet>.vercel.app/dispatcher/`
- PWA conducteur : `https://<projet>.vercel.app/tracker/` (installer via "Ajouter à l'écran d'accueil")

### 4. Builder l'APK
Voir **`android-app/BUILD-APK.md`** (Android Studio requis).
⚠️ Conserver `babyroad.keystore` — obligatoire pour toute mise à jour (contrainte #7).

### 5. Test terrain
Trajet Plateau → Port → Zone Industrielle avec les 4 téléphones,
vérifier : latence < 35s, précision < 20m, alertes geofence, GPS écran éteint (APK).

## Fonctionnalités dispatcher

- Carte Grand Abidjan MapLibre (dark navy, zoom 10→19, 2D/3D, bâtiments extrudés)
- 4 marqueurs camions animés (rotation cap, halo pulsé, couleur par statut)
- Trajectoires temps réel (50 derniers points)
- Couches togglables : trafic TomTom (source unique), pluie radar, geofences, 3D
- Panel statut par conducteur : vitesse, cap, batterie, réseau, dernière sync
- Benchmark live : latence GPS→dispatcher, précision, fréquence/min, km cumulés, ping Supabase
- Alertes : immobile > 10 min, batterie < 20 %, signal perdu > 2 min, sortie/entrée geofence, vitesse > 90 km/h — toast + son + insert `babyroad_alerts`
- Météo Abidjan 72h (Open-Meteo)
- Historique par jour et par camion : trajectoire, km, conduite vs arrêt, export CSV
- Follow mode + mesure de distance + clic marqueur → fiche complète

## Stratégie GPS adaptative (conducteur)

| Situation | Intervalle d'envoi |
|---|---|
| En mouvement (> 5 km/h) | 30 s |
| Immobile depuis 2 min | 120 s |
| Batterie < 20 % ou réseau 2G | 60 s |

Positions avec précision > 50 m **rejetées** (contrainte #8). Filtre Kalman appliqué (lissage trajectoire).
~10 000 positions/jour/camion → ~120 MB/mois pour 4 camions : dans le quota Supabase Free.

## Contraintes non négociables (rappel dossier §10)

1. APK : `@capacitor-community/background-geolocation` OBLIGATOIRE (jamais `navigator.geolocation` seul).
2. La notification persistante Android est exigée par le Foreground Service.
3. Realtime via `postgres_changes` — pas de polling.
4. Trafic : TomTom UNIQUEMENT.
5. Clé service Supabase : jamais côté client.
6. Tables préfixées `babyroad_` (coexistence FripGestion).
7. Keystore APK à conserver à vie.
8. Rejet précision GPS > 50 m.
9. Max 50 points trajectoire en mémoire, UI throttlée à 1 maj/s.
10. Couleurs : vert `#1B6B3A`, orange `#F7941D`, fond `#0D1B2A`.

## Écarts assumés vs dossier technique

- **Couche pluie** : Open-Meteo ne fournit pas de tuiles raster → radar RainViewer
  (gratuit, sans clé). Le panel météo 72h reste Open-Meteo comme spécifié.
- **Fond de carte** : fallback OpenFreeMap automatique si `MAPTILER_KEY` vide
  (alternative 100 % gratuite documentée au §9.2 du dossier).
- **Vue satellite & snap-to-road OSRM** : non câblés en V1 (toggle prévu dans l'UI,
  à brancher si besoin réel).
