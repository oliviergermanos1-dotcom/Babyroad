// ── TomTom Traffic Flow — source trafic UNIQUE (contrainte #4)
import { map } from './map.js';
import { CONFIG } from './config.js';
import { toast } from './alerts.js';

let added = false;

export function setTrafficVisible(visible) {
  if (!CONFIG.TOMTOM_API_KEY) {
    if (visible) {
      toast('Couche trafic : clé TomTom requise (gratuite sur developer.tomtom.com) — à coller dans dispatcher/js/config.js', true);
    }
    return false;
  }
  if (!added) {
    map.addSource('tomtom-traffic', {
      type: 'raster',
      tiles: [
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${CONFIG.TOMTOM_API_KEY}`,
      ],
      tileSize: 256,
      // cache navigateur 5 min pour préserver le quota (2 500 req/jour)
      maxzoom: 18,
    });
    map.addLayer(
      { id: 'traffic-layer', type: 'raster', source: 'tomtom-traffic', paint: { 'raster-opacity': 0.8 } },
      firstTruckLayer()
    );
    added = true;
  }
  map.setLayoutProperty('traffic-layer', 'visibility', visible ? 'visible' : 'none');
  return true;
}

// Insère la couche sous les trajectoires/geofences si déjà présentes
function firstTruckLayer() {
  const ids = map.getStyle().layers.map((l) => l.id);
  return ids.find((id) => id.startsWith('traj-') || id.startsWith('geofences')) || undefined;
}
