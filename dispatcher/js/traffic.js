// ── Couche « Mon trafic » — mesuré par la flotte ────────────
// Aucun fournisseur (TomTom, HERE, Waze…) ne publie de trafic temps réel
// exploitable en Côte d'Ivoire. On construit donc notre propre carte de
// congestion à partir des segments réellement parcourus par les camions,
// colorés selon leur vitesse mesurée. Pour l'état des bouchons en direct,
// le bouton « 🌐 Trafic réel » ouvre Google Maps (seule source couvrant
// Abidjan).
import { map } from './map.js';
import { toast } from './alerts.js';

let wantVisible = false;
let infoShown = false;

// après un setStyle(), la source est détruite → ré-armement
export function resetTraffic() { /* fleet-traffic reconstruite par drawFleetTraffic */ }

export function setTrafficVisible(visible) {
  wantVisible = visible;
  drawFleetTraffic();
  if (map.getLayer('fleet-traffic')) {
    map.setLayoutProperty('fleet-traffic', 'visibility', visible ? 'visible' : 'none');
  }
  if (visible && !infoShown) {
    infoShown = true;
    const n = segments.length;
    toast(n
      ? `🚦 Mon trafic : ${n} tronçons mesurés par la flotte (vert fluide / orange dense / rouge bouché)`
      : '🚦 Mon trafic se construit au fil des trajets de vos camions. Pour les bouchons en direct, utilisez « 🌐 Trafic réel ».');
  }
  return true;
}

// ── Trafic mesuré par la flotte ─────────────────────────────
const MAX_SEGMENTS = 800;
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
    }, firstOverlayLayer());
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
function firstOverlayLayer() {
  const ids = map.getStyle().layers.map((l) => l.id);
  return ids.find((id) => id.startsWith('traj-') || id.startsWith('geofences')) || undefined;
}
