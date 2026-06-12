// ── MapLibre GL JS — initialisation carte + layers de base ──
import { CONFIG } from './config.js';

export let map = null;

let mode = localStorage.getItem('babyroad_map_mode') || 'dark';
export function mapMode() { return mode; }

function styleUrl() {
  if (CONFIG.MAPTILER_KEY) {
    const style = mode === 'dark' ? 'streets-v2-dark' : 'streets-v2';
    return `https://api.maptiler.com/maps/${style}/style.json?key=${CONFIG.MAPTILER_KEY}`;
  }
  // Fallback 100% gratuit sans clé (alternative documentée §9.2)
  return mode === 'dark'
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/liberty';
}

export function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: styleUrl(),
    center: CONFIG.MAP_CENTER,
    zoom: CONFIG.MAP_ZOOM,
    pitch: CONFIG.MAP_PITCH,
    maxZoom: 19,
    minZoom: 10,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  map.on('load', () => {
    addBuildings3D();
  });

  return map;
}

// Bascule fond sombre ↔ clair. setStyle() efface toutes les couches
// custom : onRebuild doit les re-créer (geofences, traces, monuments…).
export function switchBaseStyle(onRebuild) {
  mode = mode === 'dark' ? 'light' : 'dark';
  localStorage.setItem('babyroad_map_mode', mode);
  map.setStyle(styleUrl());
  map.once('style.load', () => {
    addBuildings3D();
    if (onRebuild) onRebuild(mode);
  });
  return mode;
}

// Bâtiments 3D extrudés depuis la source vectorielle OpenMapTiles
// (couverture partielle Abidjan — Plateau/Cocody OK, cf. §3.1)
function addBuildings3D() {
  try {
    if (map.getLayer('buildings-3d')) return;
    const sourceId = Object.keys(map.getStyle().sources)
      .find((s) => /openmaptiles|maptiler/i.test(s));
    if (!sourceId) return;
    map.addLayer({
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: sourceId,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': mode === 'dark' ? '#1E3A5F' : '#CBD5E1',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.75,
      },
    });
  } catch (e) {
    console.warn('Bâtiments 3D indisponibles sur ce style :', e.message);
  }
}

export function toggleLayer(layerId, visible) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

export function toggle3D(btn) {
  const is3D = map.getPitch() > 0;
  map.easeTo({ pitch: is3D ? 0 : 60, duration: 600 });
  btn.textContent = is3D ? '3D' : '2D';
}
