// ── Caméras de surveillance & radars — Grand Abidjan ────────
// Réseau réel : ~173 radars + ~200 caméras (vidéo-verbalisation,
// centre de gestion de la mobilité à Treichville). Les positions
// exactes ne sont pas publiées : points placés aux carrefours des
// axes documentés (VGE, voie express Adjamé-Yopougon, autoroutes
// du Nord et de Bassam). ⚠ POSITIONS INDICATIVES — ajustables ici.
import { map } from './map.js';

const CAMERAS = [
  // ── Radars vitesse / feux (vidéo-verbalisation) ──
  { t: 'RADAR', name: 'Bd VGE — Carrefour Solibra',        lat: 5.3040, lng: -3.9985, axe: 'Boulevard VGE', limite: '70 km/h' },
  { t: 'RADAR', name: 'Bd VGE — Marcory',                  lat: 5.3000, lng: -3.9860, axe: 'Boulevard VGE', limite: '70 km/h' },
  { t: 'RADAR', name: 'Bd VGE — Zone 4 / Bietry',          lat: 5.2950, lng: -3.9750, axe: 'Boulevard VGE', limite: '70 km/h' },
  { t: 'RADAR', name: 'Bd VGE — rond-point Aéroport',      lat: 5.2590, lng: -3.9350, axe: 'Boulevard VGE', limite: '90 km/h' },
  { t: 'RADAR', name: 'Autoroute du Nord — sortie Abidjan', lat: 5.4123, lng: -4.0234, axe: 'Autoroute A1', limite: '110 km/h' },
  { t: 'RADAR', name: 'Voie express Adjamé–Yopougon',      lat: 5.3620, lng: -4.0480, axe: 'Voie express', limite: '90 km/h' },
  { t: 'RADAR', name: 'Autoroute de Bassam — Port-Bouët',  lat: 5.2500, lng: -3.9230, axe: 'Autoroute Bassam (côtière)', limite: '110 km/h' },
  { t: 'RADAR', name: 'Bd Mitterrand — Riviera 2',         lat: 5.3560, lng: -3.9620, axe: 'Bd Mitterrand', limite: '80 km/h' },
  { t: 'RADAR', name: 'Pont HKB — péage Marcory',          lat: 5.3120, lng: -3.9800, axe: 'Pont HKB', limite: '70 km/h' },
  { t: 'RADAR', name: 'Bd de Marseille — Zone 4',          lat: 5.2850, lng: -3.9850, axe: 'Bd de Marseille', limite: '60 km/h' },
  // ── Caméras de surveillance (carrefours stratégiques) ──
  { t: 'CAM', name: 'Carrefour de l\'Indénié',             lat: 5.3290, lng: -4.0125, axe: 'Plateau / Adjamé' },
  { t: 'CAM', name: 'Place de la République',              lat: 5.3215, lng: -4.0220, axe: 'Plateau' },
  { t: 'CAM', name: 'Carrefour Adjamé Liberté',            lat: 5.3640, lng: -4.0230, axe: 'Adjamé' },
  { t: 'CAM', name: 'Carrefour Siporex',                   lat: 5.3678, lng: -4.0789, axe: 'Yopougon' },
  { t: 'CAM', name: 'Rond-point du Port',                  lat: 5.2940, lng: -4.0080, axe: 'Treichville / Port' },
  { t: 'CAM', name: 'Marché d\'Adjamé',                    lat: 5.3558, lng: -4.0197, axe: 'Adjamé' },
  { t: 'CAM', name: 'Grand carrefour Koumassi',            lat: 5.2980, lng: -3.9610, axe: 'Koumassi' },
  { t: 'CAM', name: 'Carrefour Williamsville',             lat: 5.3760, lng: -4.0330, axe: 'Adjamé / Williamsville' },
  { t: 'CAM', name: 'Carrefour Palmeraie',                 lat: 5.3700, lng: -3.9560, axe: 'Cocody / Riviera' },
  { t: 'CENTRE', name: 'Centre de Gestion de la Mobilité', lat: 5.3060, lng: -4.0070, axe: 'Treichville — supervision des 200 caméras' },
];

const ICON = { RADAR: '📡', CAM: '📷', CENTRE: '🎛' };
const COLOR = { RADAR: '#DC2626', CAM: '#3B82F6', CENTRE: '#F7941D' };
const LABEL = { RADAR: 'Radar vitesse/feux', CAM: 'Caméra surveillance', CENTRE: 'Centre de supervision' };

function geojson() {
  return {
    type: 'FeatureCollection',
    features: CAMERAS.map((c) => ({
      type: 'Feature',
      properties: {
        icon: ICON[c.t], color: COLOR[c.t], type: LABEL[c.t],
        name: c.name, axe: c.axe, limite: c.limite || '',
      },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    })),
  };
}

let bound = false;

export function drawCameras() {
  if (!map.getSource('cameras')) {
    map.addSource('cameras', { type: 'geojson', data: geojson() });
  }
  if (map.getLayer('cameras-dot')) return;

  // petit badge blanc cerclé de la couleur du type, icône par-dessus
  // (même symbole que dans la légende)
  map.addLayer({
    id: 'cameras-dot',
    type: 'circle',
    source: 'cameras',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 9, 17, 11],
      'circle-color': '#FFFFFF',
      'circle-opacity': 0.95,
      'circle-stroke-width': 2,
      'circle-stroke-color': ['get', 'color'],
    },
  });
  map.addLayer({
    id: 'cameras-icon',
    type: 'symbol',
    source: 'cameras',
    layout: {
      'text-field': ['get', 'icon'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 11, 17, 14],
      'text-allow-overlap': true,
    },
  });

  if (!bound) {
    bound = true;
    map.on('click', 'cameras-dot', (e) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="popup-title" style="color:${p.color}">${p.icon} ${p.name}</div>
          <dl class="popup-grid">
            <dt>Type</dt><dd>${p.type}</dd>
            <dt>Axe</dt><dd>${p.axe}</dd>
            ${p.limite ? `<dt>Limite</dt><dd>${p.limite}</dd>` : ''}
          </dl>
          <p style="font-size:0.7rem;color:#6B7280;margin-top:6px;">⚠ Position indicative (réseau officiel non publié)</p>`)
        .addTo(map);
    });
    map.on('mouseenter', 'cameras-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'cameras-dot', () => { map.getCanvas().style.cursor = ''; });
  }
}

export function setCamerasVisible(visible) {
  ['cameras-dot', 'cameras-icon'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  });
}
