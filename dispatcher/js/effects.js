// ── Effets 3D : ciel, lumière, relief, animations, caméra ───
import { map } from './map.js';

// Ciel + atmosphère + lumière chaude sur les extrusions
export function applyAtmosphere(mode) {
  try {
    map.setSky({
      'sky-color': mode === 'dark' ? '#0B1526' : '#7FB8E6',
      'horizon-color': mode === 'dark' ? '#1B3A5C' : '#FFE8C8',
      'fog-color': mode === 'dark' ? '#0D1B2A' : '#EAF2F8',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.85,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.5, 14, 0.15],
    });
  } catch (e) { console.warn('Sky non supporté :', e.message); }
  try {
    map.setLight({
      anchor: 'viewport',
      color: '#FFE9C9',
      intensity: mode === 'dark' ? 0.35 : 0.5,
      position: [1.3, 210, 30], // soleil bas sud-ouest → façades contrastées
    });
  } catch (e) { /* light non critique */ }
}

// ── Relief 3D (DEM Terrarium AWS, gratuit) ──────────────────
let terrainOn = false;

export function setTerrainEnabled(on) {
  terrainOn = on;
  try {
    if (on) {
      if (!map.getSource('terrain-dem')) {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 13,
          attribution: 'Terrain © Mapzen/AWS',
        });
      }
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
    } else {
      map.setTerrain(null);
    }
  } catch (e) { console.warn('Relief indisponible :', e.message); }
}
export function isTerrainEnabled() { return terrainOn; }

// ── Fourmis lumineuses sur les bordures de geofences ────────
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
];
let dashStep = 0;

export function startGeofencePulse() {
  setInterval(() => {
    if (!map.getLayer('geofences-border')) return;
    dashStep = (dashStep + 1) % DASH_SEQ.length;
    map.setPaintProperty('geofences-border', 'line-dasharray', DASH_SEQ[dashStep]);
  }, 110);
}

// ── Tour 3D cinématique : survol du Plateau puis orbite ─────
let touring = false;
let tourFrame = null;

export function toggleCinematicTour(btn) {
  if (touring) { stopTour(btn); return; }
  touring = true;
  btn.textContent = '⏹ Stop';
  map.flyTo({
    center: [-4.0195, 5.3245], // Plateau — La Pyramide / Tour D
    zoom: 15.6,
    pitch: 62,
    bearing: 20,
    duration: 3500,
    essential: true,
  });
  const orbit = () => {
    if (!touring) return;
    map.setBearing((map.getBearing() + 0.14) % 360);
    tourFrame = requestAnimationFrame(orbit);
  };
  setTimeout(() => { if (touring) tourFrame = requestAnimationFrame(orbit); }, 3600);
  map.once('mousedown', () => stopTour(btn));
  map.once('touchstart', () => stopTour(btn));
}

function stopTour(btn) {
  touring = false;
  if (tourFrame) cancelAnimationFrame(tourFrame);
  btn.textContent = '🎬 Tour 3D';
}
