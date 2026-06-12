// ── Monuments & ouvrages emblématiques d'Abidjan en 3D ──────
// Modélisation stylisée (extrusions MapLibre) d'après l'apparence
// réelle des ouvrages : proportions, hauteurs et couleurs approchées.
// ⚠ Coordonnées approximatives — ajustables ci-dessous si besoin.
import { map } from './map.js';

const M_LAT = 111320; // mètres par degré de latitude

// Rectangle orienté : centre, longueur/largeur (m), cap (°)
function rect(lat, lng, lenM, widM, bearingDeg) {
  const b = (bearingDeg * Math.PI) / 180;
  const mLng = M_LAT * Math.cos((lat * Math.PI) / 180);
  const ux = Math.sin(b), uy = Math.cos(b);   // axe longueur
  const vx = Math.cos(b), vy = -Math.sin(b);  // axe largeur
  const L = lenM / 2, W = widM / 2;
  const pts = [
    [ L,  W], [ L, -W], [-L, -W], [-L,  W], [ L,  W],
  ].map(([l, w]) => [
    lng + (l * ux + w * vx) / mLng,
    lat + (l * uy + w * vy) / M_LAT,
  ]);
  return [pts];
}

// Pont entre deux points : rectangle le long du segment
function bridge(lat1, lng1, lat2, lng2, widM) {
  const cLat = (lat1 + lat2) / 2;
  const cLng = (lng1 + lng2) / 2;
  const mLng = M_LAT * Math.cos((cLat * Math.PI) / 180);
  const dx = (lng2 - lng1) * mLng;
  const dy = (lat2 - lat1) * M_LAT;
  const len = Math.hypot(dx, dy);
  const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  return rect(cLat, cLng, len, widM, bearing);
}

function circle(lat, lng, rM, innerRM = 0) {
  const mLng = M_LAT * Math.cos((lat * Math.PI) / 180);
  const ring = (r, rev) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = ((rev ? 48 - i : i) / 48) * 2 * Math.PI;
      pts.push([lng + (r * Math.cos(a)) / mLng, lat + (r * Math.sin(a)) / M_LAT]);
    }
    return pts;
  };
  const coords = [ring(rM, false)];
  if (innerRM > 0) coords.push(ring(innerRM, true)); // trou (anneau stade)
  return coords;
}

// ── Catalogue des monuments ─────────────────────────────────
// part : { poly, height, base?, color? }
const LANDMARKS = [
  {
    name: 'Pont Charles De Gaulle',
    desc: 'Pont historique (1967) reliant le Plateau à Treichville au-dessus de la lagune Ébrié.',
    icon: '🌉', color: '#9AA7B5', labelAt: [5.3130, -4.0185],
    parts: [{ poly: bridge(5.3185, -4.0202, 5.3075, -4.0168, 22), height: 10 }],
  },
  {
    name: 'Pont Félix Houphouët-Boigny',
    desc: 'Le plus ancien pont d\'Abidjan (1957), Plateau ↔ Treichville. Rail + route.',
    icon: '🌉', color: '#8E9BA9', labelAt: [5.3135, -4.0263],
    parts: [{ poly: bridge(5.3180, -4.0272, 5.3090, -4.0252, 18), height: 9 }],
  },
  {
    name: 'Pont Henri Konan Bédié',
    desc: '3ᵉ pont (2014), à péage — Riviera/Cocody ↔ Marcory. Axe majeur de la logistique Est.',
    icon: '🌉', color: '#F7941D', labelAt: [5.3010, -3.9775],
    parts: [{ poly: bridge(5.3095, -3.9745, 5.2930, -3.9800, 26), height: 12 }],
  },
  {
    name: '4ᵉ Pont (Yopougon–Plateau)',
    desc: 'Pont récent (2023) — désenclave Yopougon vers le Plateau et Adjamé.',
    icon: '🌉', color: '#E8B84B', labelAt: [5.3456, -4.0567],
    parts: [{ poly: bridge(5.3520, -4.0625, 5.3395, -4.0510, 24), height: 11 }],
  },
  {
    name: 'La Pyramide',
    desc: 'Immeuble brutaliste emblématique du Plateau (1973, arch. Rinaldo Olivieri).',
    icon: '🔺', color: '#C8B89A', labelAt: [5.3235, -4.0165],
    parts: [
      { poly: rect(5.3235, -4.0165, 48, 48, 15), height: 30 },
      { poly: rect(5.3235, -4.0165, 34, 34, 15), height: 52, base: 30 },
      { poly: rect(5.3235, -4.0165, 18, 18, 15), height: 68, base: 52 },
    ],
  },
  {
    name: 'Tour D — Cité Administrative',
    desc: 'La plus haute tour du Plateau (~110 m), siège de ministères.',
    icon: '🏢', color: '#7E8C9E', labelAt: [5.3300, -4.0205],
    parts: [{ poly: rect(5.3300, -4.0205, 34, 34, 0), height: 110 }],
  },
  {
    name: 'Cathédrale Saint-Paul',
    desc: 'Cathédrale moderne (1985) : pylône en forme de croix retenant la nef par des haubans.',
    icon: '⛪', color: '#E7E2D8', labelAt: [5.3330, -4.0225],
    parts: [
      { poly: rect(5.3330, -4.0225, 65, 28, 35), height: 22 },                 // nef
      { poly: rect(5.3327, -4.0231, 10, 10, 35), height: 70, color: '#D8D2C4' }, // pylône-croix
    ],
  },
  {
    name: 'Hôtel Ivoire (Sofitel)',
    desc: 'Tour hôtelière iconique de Cocody (1963-1970), vue panoramique sur la lagune.',
    icon: '🏨', color: '#B7AE9C', labelAt: [5.3320, -4.0020],
    parts: [{ poly: rect(5.3320, -4.0020, 52, 20, 80), height: 85 }],
  },
  {
    name: 'Tour Postel 2001',
    desc: 'Tour de La Poste (Plateau), silhouette caractéristique au bord de la lagune.',
    icon: '🏢', color: '#9FB4C7', labelAt: [5.3215, -4.0282],
    parts: [{ poly: rect(5.3215, -4.0282, 30, 30, 45), height: 90 }],
  },
  {
    name: 'Stade Olympique Alassane Ouattara — Ébimpé',
    desc: 'Stade de 60 000 places (CAN 2023), au bord de la rocade Y4.',
    icon: '🏟', color: '#D9D9D9', labelAt: [5.4234, -4.0123],
    parts: [{ poly: circle(5.4234, -4.0123, 130, 80), height: 38 }],
  },
];

// ── Rendu ───────────────────────────────────────────────────
function buildGeoJSON() {
  const polys = [];
  const labels = [];
  LANDMARKS.forEach((lm, i) => {
    lm.parts.forEach((p) => {
      polys.push({
        type: 'Feature',
        properties: {
          idx: i,
          name: lm.name,
          desc: lm.desc,
          icon: lm.icon,
          color: p.color || lm.color,
          height: p.height,
          base: p.base || 0,
        },
        geometry: { type: 'Polygon', coordinates: p.poly },
      });
    });
    labels.push({
      type: 'Feature',
      properties: { name: `${lm.icon} ${lm.name}` },
      geometry: { type: 'Point', coordinates: [lm.labelAt[1], lm.labelAt[0]] },
    });
  });
  return {
    polys: { type: 'FeatureCollection', features: polys },
    labels: { type: 'FeatureCollection', features: labels },
  };
}

let clickBound = false;

export function drawLandmarks(mode = 'dark') {
  const { polys, labels } = buildGeoJSON();

  if (!map.getSource('landmarks')) {
    map.addSource('landmarks', { type: 'geojson', data: polys });
    map.addSource('landmarks-labels', { type: 'geojson', data: labels });
  }

  if (!map.getLayer('landmarks-3d')) {
    map.addLayer({
      id: 'landmarks-3d',
      type: 'fill-extrusion',
      source: 'landmarks',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true,
      },
    });
    map.addLayer({
      id: 'landmarks-label',
      type: 'symbol',
      source: 'landmarks-labels',
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-font': ['Noto Sans Regular'],
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': mode === 'dark' ? '#FFD9A0' : '#7A4A00',
        'text-halo-color': mode === 'dark' ? '#0D1B2A' : '#FFFFFF',
        'text-halo-width': 1.4,
      },
    });
  }

  if (!clickBound) {
    clickBound = true;
    map.on('click', 'landmarks-3d', (e) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="popup-title">${p.icon} ${p.name}</div>
          <p style="font-size:0.82rem; line-height:1.45;">${p.desc}</p>`)
        .addTo(map);
    });
    map.on('mouseenter', 'landmarks-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'landmarks-3d', () => { map.getCanvas().style.cursor = ''; });
  }
}

export function setLandmarksVisible(visible) {
  ['landmarks-3d', 'landmarks-label'].forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  });
}
