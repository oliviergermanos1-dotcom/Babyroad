// ── Couche Trafic ────────────────────────────────────────────
// 1. TomTom Traffic Flow (source unique, contrainte #4) — mais TomTom
//    ne publie PAS de trafic temps réel en Côte d'Ivoire : les tuiles
//    y sont vides. La couche reste branchée (gratuite) au cas où la
//    couverture arrive.
// 2. Trafic FLOTTE : les segments réellement parcourus par les camions,
//    colorés selon leur vitesse mesurée (vert fluide / orange dense /
//    rouge bouché). C'est le trafic vécu par TES véhicules.
import { map } from './map.js';
import { CONFIG } from './config.js';
import { toast } from './alerts.js';

let added = false;
let wantVisible = false;
let infoShown = false;

// après un setStyle(), les sources sont détruites → ré-armement
export function resetTraffic() { added = false; }

export function setTrafficVisible(visible) {
  wantVisible = visible;

  // — Trafic flotte (toujours disponible) —
  drawFleetTraffic();
  if (map.getLayer('fleet-traffic')) {
    map.setLayoutProperty('fleet-traffic', 'visibility', visible ? 'visible' : 'none');
  }

  // — Tuiles TomTom (si clé) —
  if (CONFIG.TOMTOM_API_KEY) {
    if (!added) {
      map.addSource('tomtom-traffic', {
        type: 'raster',
        tiles: [
          `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${CONFIG.TOMTOM_API_KEY}`,
        ],
        tileSize: 256,
        maxzoom: 18,
      });
      map.addLayer(
        { id: 'traffic-layer', type: 'raster', source: 'tomtom-traffic', paint: { 'raster-opacity': 0.8 } },
        firstTruckLayer()
      );
      added = true;
    }
    map.setLayoutProperty('traffic-layer', 'visibility', visible ? 'visible' : 'none');
  }

  if (visible && !infoShown) {
    infoShown = true;
    toast('ℹ Trafic : TomTom ne couvre pas la Côte d\'Ivoire en temps réel — les segments colorés affichés sont mesurés par TES camions (vert fluide / orange dense / rouge bouché)');
  }
  return true;
}

// ── Trafic mesuré par la flotte ─────────────────────────────
const MAX_SEGMENTS = 600;
let segments = [];
let dirty = false;
let flushStarted = false;

// appelé à chaque position reçue (prev → cur)
export function recordFleetSegment(prev, cur) {
  if (!prev || !cur) return;
  // ignore les segments aberrants (> ~1.5 km entre 2 points)
  if (Math.abs(prev.lat - cur.lat) > 0.015 || Math.abs(prev.lng - cur.lng) > 0.015) return;
  segments.push({
    type: 'Feature',
    properties: { s: cur.speed || 0 },
    geometry: { type: 'LineString', coordinates: [[prev.lng, prev.lat], [cur.lng, cur.lat]] },
  });
  if (segments.length > MAX_SEGMENTS) segments.shift();
  dirty = true;
}

function fc() { return { type: 'FeatureCollection', features: segments }; }

export function drawFleetTraffic() {
  if (!map.getSource('fleet-traffic')) {
    map.addSource('fleet-traffic', { type: 'geojson', data: fc() });
  }
  if (!map.getLayer('fleet-traffic')) {
    map.addLayer({
      id: 'fleet-traffic',
      type: 'line',
      source: 'fleet-traffic',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: wantVisible ? 'visible' : 'none' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9],
        'line-opacity': 0.85,
        'line-color': ['step', ['get', 's'], '#DC2626', 15, '#F59E0B', 40, '#22C55E'],
      },
    }, firstTruckLayer());
  }
  if (!flushStarted) {
    flushStarted = true;
    setInterval(() => {
      if (dirty && map.getSource('fleet-traffic')) {
        dirty = false;
        map.getSource('fleet-traffic').setData(fc());
      }
    }, 1000);
  }
}

// Insère la couche sous les trajectoires/geofences si déjà présentes
function firstTruckLayer() {
  const ids = map.getStyle().layers.map((l) => l.id);
  return ids.find((id) => id.startsWith('traj-') || id.startsWith('geofences')) || undefined;
}
