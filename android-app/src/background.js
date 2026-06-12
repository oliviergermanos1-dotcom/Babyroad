// ── GPS écran éteint Android — Foreground Service ───────────
// Contrainte #1 : OBLIGATOIREMENT @capacitor-community/background-geolocation.
// Contrainte #2 : la notification persistante est EXIGÉE par Android.
import { registerPlugin } from '@capacitor/core';
import { CONFIG } from './config.js';
import { sendPosition } from './tracker.js';
import { GPSKalmanFilter } from './kalman.js';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
const kalman = new GPSKalmanFilter();

let watcherId = null;

export async function startTracking(userId) {
  kalman.reset();
  watcherId = await BackgroundGeolocation.addWatcher(
    {
      // Notification EXIGÉE par Android pour tout service GPS arrière-plan
      // (la retirer = Android tue le tracking). Libellé réduit au minimum ;
      // le chauffeur peut la passer en silencieux : appui long → Silencieux.
      backgroundTitle: 'Babyroad',
      backgroundMessage: 'Service actif',
      requestPermissions: true,
      // stale:false → ignore les positions périmées (anti-dérive batterie)
      stale: false,
      // ÉCONOMIE BATTERIE : le GPS ne se réveille qu'au déplacement de
      // 15 m. Camion à l'arrêt = aucune mesure = quasi zéro conso.
      distanceFilter: CONFIG.DISTANCE_FILTER_M,
    },
    async (position, error) => {
      if (error) {
        if (error.code === 'NOT_AUTHORIZED') {
          // L'utilisateur doit accorder "Autoriser tout le temps"
          if (confirm('Babyroad a besoin de la localisation en arrière-plan.\nOuvrir les réglages ?')) {
            BackgroundGeolocation.openSettings();
          }
        }
        console.error('GPS Error:', error.message);
        return;
      }

      // Contrainte #8 : rejet précision > 50 m
      if (position.accuracy > CONFIG.GPS_ACCURACY_MAX_M) return;

      const f = kalman.filter(position.latitude, position.longitude,
        position.accuracy, position.time || Date.now());

      await sendPosition(userId, {
        lat: f.lat,
        lng: f.lng,
        speed: (position.speed || 0) * 3.6, // m/s → km/h
        heading: position.bearing || 0,
        accuracy: position.accuracy,
        altitude: position.altitude || 0,
      });
    }
  );
}

export async function stopTracking() {
  if (watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    watcherId = null;
  }
}

export function isTracking() {
  return watcherId != null;
}
