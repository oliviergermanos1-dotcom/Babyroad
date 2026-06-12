// ── Traces trajectoires temps réel (50 derniers points max) ─
import { map } from './map.js';
import { CONFIG } from './config.js';

const traces = new Map(); // user_id → [[lng,lat], ...]

export function pushPoint(userId, lng, lat) {
  let pts = traces.get(userId);
  if (!pts) { pts = []; traces.set(userId, pts); }
  pts.push([lng, lat]);
  if (pts.length > CONFIG.TRAJECTORY_POINTS_MAX) pts.shift();
}

export function ensureTrajectoryLayer(user) {
  const srcId = `traj-src-${user.id}`;
  if (!map.getSource(srcId)) {
    map.addSource(srcId, { type: 'geojson', data: emptyLine() });
  }
  if (map.getLayer(`traj-${user.id}`)) return;
  // halo lumineux sous la trace (effet néon)
  map.addLayer({
    id: `traj-glow-${user.id}`,
    type: 'line',
    source: srcId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': user.marker_color || '#1B6B3A',
      'line-width': 11,
      'line-blur': 6,
      'line-opacity': 0.35,
    },
  });
  map.addLayer({
    id: `traj-${user.id}`,
    type: 'line',
    source: srcId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': user.marker_color || '#1B6B3A',
      'line-width': 4,
      'line-opacity': 0.85,
    },
  });
}

export function redrawTrajectory(userId) {
  const src = map.getSource(`traj-src-${userId}`);
  const pts = traces.get(userId) || [];
  if (!src || pts.length < 2) return;
  src.setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: pts },
  });
}

export function setTrajectoriesVisible(visible) {
  traces.forEach((_, userId) => {
    [`traj-${userId}`, `traj-glow-${userId}`].forEach((layer) => {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
      }
    });
  });
}

function emptyLine() {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };
}
