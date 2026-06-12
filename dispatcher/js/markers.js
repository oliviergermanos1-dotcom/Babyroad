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

  m.marker.setLngLat([position.lng, position.lat]);
  m.el.className = `truck-marker ${status}`;
  m.iconEl.style.color = color;
  m.iconEl.style.transform = `rotate(${position.heading || 0}deg)`;
}

export function getMarker(userId) { return markers.get(userId); }
