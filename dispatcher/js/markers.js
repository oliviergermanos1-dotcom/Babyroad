// ── Marqueurs camions animés (rotation heading + halo) ──────
import { map } from './map.js';
import { truckStatus } from './realtime.js';

const markers = new Map(); // user_id → { marker, el, iconEl, labelEl }
let truckSvg = null;
let onClickMarker = null;

export function setMarkerClickHandler(fn) { onClickMarker = fn; }

async function loadTruckSvg() {
  if (truckSvg) return truckSvg;
  const res = await fetch('assets/icon-truck.svg');
  truckSvg = await res.text();
  return truckSvg;
}

export async function upsertMarker(entry, outOfZoneIds) {
  const { user, position } = entry;
  if (!position) return;
  const svg = await loadTruckSvg();
  const status = truckStatus(entry, outOfZoneIds);
  const color =
    status === 'horszone' ? '#DC2626'
    : status === 'arrete' ? '#F7941D'
    : user.marker_color || '#1B6B3A';

  let m = markers.get(user.id);
  if (!m) {
    const el = document.createElement('div');
    el.className = 'truck-marker';
    el.innerHTML = `
      <div class="halo"></div>
      <div class="truck-icon">${svg}</div>
      <div class="truck-label">${user.vehicle_id || user.user_code}</div>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onClickMarker) onClickMarker(entry);
    });
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      map.flyTo({ center: [entry.position.lng, entry.position.lat], zoom: 16 });
    });
    const marker = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
      .setLngLat([position.lng, position.lat])
      .addTo(map);
    m = { marker, el, iconEl: el.querySelector('.truck-icon') };
    markers.set(user.id, m);
  }

  animateTo(m, [position.lng, position.lat]);
  m.el.className = `truck-marker ${status}`;
  m.iconEl.style.color = color;
  m.iconEl.style.transform = `rotate(${position.heading || 0}deg)`;
}

// Glissement fluide vers la nouvelle position (au lieu d'un saut)
function animateTo(m, to, duration = 900) {
  const from = m.marker.getLngLat();
  if (Math.abs(from.lng - to[0]) < 1e-9 && Math.abs(from.lat - to[1]) < 1e-9) return;
  cancelAnimationFrame(m.anim);
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / duration);
    const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; // easeInOut
    m.marker.setLngLat([
      from.lng + (to[0] - from.lng) * e,
      from.lat + (to[1] - from.lat) * e,
    ]);
    if (k < 1) m.anim = requestAnimationFrame(step);
  };
  m.anim = requestAnimationFrame(step);
}

export function getMarker(userId) { return markers.get(userId); }
