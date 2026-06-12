// ── Geofences : zones surveillées + détection entrée/sortie ─
import { map } from './map.js';
import { supabase, haversineKm } from './realtime.js';

export let geofences = [];
const insideState = new Map(); // `${userId}:${fenceId}` → boolean

export async function loadGeofences() {
  const { data, error } = await supabase
    .from('babyroad_geofences')
    .select('*')
    .eq('is_active', true);
  if (error) { console.warn('Geofences :', error.message); return []; }
  geofences = data || [];
  return geofences;
}

export function drawGeofences() {
  if (!geofences.length) return;
  const features = geofences.map((g) => ({
    type: 'Feature',
    properties: { name: g.name, zone_type: g.zone_type },
    geometry: { type: 'Polygon', coordinates: [circleCoords(g)] },
  }));
  const data = { type: 'FeatureCollection', features };

  if (map.getSource('geofences')) {
    map.getSource('geofences').setData(data);
    return;
  }
  map.addSource('geofences', { type: 'geojson', data });
  map.addLayer({
    id: 'geofences-fill',
    type: 'fill',
    source: 'geofences',
    paint: { 'fill-color': '#F7941D', 'fill-opacity': 0.08 },
  });
  map.addLayer({
    id: 'geofences-border',
    type: 'line',
    source: 'geofences',
    paint: {
      'line-color': '#F7941D',
      'line-width': 2,
      'line-opacity': 0.6,
      'line-dasharray': [2, 2],
    },
  });
  map.addLayer({
    id: 'geofences-label',
    type: 'symbol',
    source: 'geofences',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-font': ['Noto Sans Regular'],
    },
    paint: { 'text-color': '#FFB347', 'text-halo-color': '#0D1B2A', 'text-halo-width': 1.2 },
  });
}

// Polygone approximant le cercle (64 segments)
function circleCoords(g) {
  const coords = [];
  const latR = g.radius_m / 111320;
  const lngR = g.radius_m / (111320 * Math.cos((g.center_lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * 2 * Math.PI;
    coords.push([g.center_lng + lngR * Math.cos(theta), g.center_lat + latR * Math.sin(theta)]);
  }
  return coords;
}

export function isInside(g, lat, lng) {
  return haversineKm(g.center_lat, g.center_lng, lat, lng) * 1000 <= g.radius_m;
}

// Retourne les transitions [{ fence, type: 'ENTER'|'EXIT' }] pour une position
export function checkTransitions(userId, lat, lng) {
  const events = [];
  geofences.forEach((g) => {
    const key = `${userId}:${g.id}`;
    const was = insideState.get(key);
    const now = isInside(g, lat, lng);
    if (was === undefined) { insideState.set(key, now); return; }
    if (was !== now) {
      insideState.set(key, now);
      if (now && g.alert_on_enter) events.push({ fence: g, type: 'ENTER' });
      if (!now && g.alert_on_exit) events.push({ fence: g, type: 'EXIT' });
    }
  });
  return events;
}

export function setGeofencesVisible(visible) {
  ['geofences-fill', 'geofences-border', 'geofences-label'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  });
}
