// ── Panel latéral + popups + follow mode + mesure ───────────
import { map } from './map.js';
import { truckStatus } from './realtime.js';
import { outOfZoneIds } from './alerts.js';
import { latencyMs, latencyClass, accuracyClass, updatesPerMinute } from './benchmark.js';
import { haversineKm } from './realtime.js';

const STATUS_LABEL = {
  actif: ['ACTIF', 'badge-actif'],
  arrete: ['ARRÊTÉ', 'badge-arrete'],
  horszone: ['HORS ZONE', 'badge-horszone'],
  offline: ['SIGNAL PERDU', 'badge-offline'],
};

let followUserId = null;

// ── Cards chauffeurs ────────────────────────────────────────
let onDeleteDriver = null;
export function setDriverDeleteHandler(fn) { onDeleteDriver = fn; }

function initials(name) {
  return (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function renderFleetChips(fleet) {
  const counts = { actif: 0, arrete: 0, horszone: 0, offline: 0 };
  fleet.forEach((entry) => { counts[truckStatus(entry, outOfZoneIds)] += 1; });
  document.getElementById('fleet-chips').innerHTML = `
    <span class="fleet-chip actif"><span class="dot-chip"></span>${counts.actif} en route</span>
    <span class="fleet-chip arrete"><span class="dot-chip"></span>${counts.arrete} arrêtés</span>
    ${counts.horszone ? `<span class="fleet-chip horszone"><span class="dot-chip"></span>${counts.horszone} hors zone</span>` : ''}
    <span class="fleet-chip offline"><span class="dot-chip"></span>${counts.offline} hors ligne</span>`;
}

export function renderDriverCards(fleet) {
  const container = document.getElementById('driver-cards');
  document.getElementById('fleet-count').textContent = fleet.size;
  renderFleetChips(fleet);
  container.innerHTML = '';

  fleet.forEach((entry) => {
    const { user, position: p } = entry;
    const status = truckStatus(entry, outOfZoneIds);
    const [label, badgeCls] = STATUS_LABEL[status];
    const lat = latencyMs(entry);

    const card = document.createElement('div');
    card.className = `driver-card ${status}`;
    card.innerHTML = `
      <div class="driver-card-head">
        <div class="driver-id">
          <span class="driver-avatar" style="background:${user.marker_color || '#1B6B3A'}">${initials(user.full_name)}</span>
          <div>
            <div class="driver-name">${user.full_name}</div>
            <div class="driver-vehicle">${user.vehicle_id || ''} · ${user.vehicle_type || ''}</div>
          </div>
        </div>
        <span class="badge ${badgeCls}">${label}</span>
      </div>
      ${p ? `
      <div class="driver-stats">
        <span class="stat-label">Vitesse</span><span>${Math.round(p.speed || 0)} km/h ↗ ${Math.round(p.heading || 0)}°</span>
        <span class="stat-label">Batterie</span><span>${p.battery != null ? `🔋 ${p.battery}%` : '—'}</span>
        <span class="stat-label">Réseau</span><span>📶 ${p.network_type || '—'}</span>
        <span class="stat-label">Dern. sync</span><span>${syncAgo(entry)}</span>
      </div>
      <div class="driver-benchmark">
        <span class="${latencyClass(lat)}">⏱ ${lat != null ? Math.round(lat / 1000) + 's' : '—'}</span>
        <span class="${accuracyClass(p.accuracy)}">📍 ${p.accuracy != null ? Math.round(p.accuracy) + 'm' : '—'}</span>
        <span>↻ ${updatesPerMinute(entry)}/min</span>
        <span>Σ ${entry.counters.distanceKm.toFixed(1)} km</span>
      </div>` : '<p class="muted">Aucune position reçue</p>'}
      <button class="btn-del-driver" title="Retirer ce chauffeur de la flotte">🗑</button>
    `;
    card.addEventListener('click', () => {
      if (p) map.flyTo({ center: [p.lng, p.lat], zoom: 15 });
    });
    card.querySelector('.btn-del-driver').addEventListener('click', (e) => {
      e.stopPropagation();
      if (onDeleteDriver) onDeleteDriver(user);
    });
    container.appendChild(card);
  });
}

function syncAgo(entry) {
  if (!entry.receivedAt) return '—';
  const s = Math.round((Date.now() - entry.receivedAt) / 1000);
  return s < 60 ? `✓ ${s}s` : `${Math.round(s / 60)} min`;
}

// ── Popup fiche complète au clic marqueur ───────────────────
export function openTruckPopup(entry, onFollow) {
  const { user, position: p } = entry;
  if (!p) return;
  const popup = new maplibregl.Popup({ offset: 28 })
    .setLngLat([p.lng, p.lat])
    .setHTML(`
      <div class="popup-title">🚛 ${user.full_name} — ${user.vehicle_id || user.user_code}</div>
      <dl class="popup-grid">
        <dt>Position</dt><dd>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</dd>
        <dt>Vitesse</dt><dd>${Math.round(p.speed || 0)} km/h</dd>
        <dt>Cap</dt><dd>${Math.round(p.heading || 0)}°</dd>
        <dt>Précision</dt><dd>${p.accuracy != null ? Math.round(p.accuracy) + ' m' : '—'}</dd>
        <dt>Batterie</dt><dd>${p.battery != null ? p.battery + '%' : '—'}</dd>
        <dt>Réseau</dt><dd>${p.network_type || '—'}</dd>
        <dt>Horodatage</dt><dd>${new Date(p.recorded_at).toLocaleTimeString('fr-FR')}</dd>
      </dl>
      <div class="popup-actions">
        <button class="btn btn-primary" id="popup-center">🎯 Centrer</button>
        <button class="btn btn-secondary" id="popup-follow">📍 Suivre</button>
      </div>
    `)
    .addTo(map);

  popup.getElement().querySelector('#popup-center').addEventListener('click', () => {
    map.flyTo({ center: [p.lng, p.lat], zoom: 16 });
  });
  popup.getElement().querySelector('#popup-follow').addEventListener('click', () => {
    popup.remove();
    onFollow(entry);
  });
}

// ── Follow mode ─────────────────────────────────────────────
export function startFollow(entry) {
  followUserId = entry.user.id;
  document.getElementById('follow-name').textContent = entry.user.full_name;
  document.getElementById('follow-banner').classList.remove('hidden');
}
export function stopFollow() {
  followUserId = null;
  document.getElementById('follow-banner').classList.add('hidden');
}
export function followTick(fleet) {
  if (!followUserId) return;
  const entry = fleet.get(followUserId);
  if (entry?.position) {
    map.easeTo({ center: [entry.position.lng, entry.position.lat], duration: 800 });
  }
}

// ── Mesure de distance (click-click Haversine) ──────────────
let measuring = false;
let measureStart = null;

export function toggleMeasure() {
  measuring = !measuring;
  measureStart = null;
  map.getCanvas().style.cursor = measuring ? 'crosshair' : '';
  const el = document.getElementById('measure-result');
  if (measuring) {
    el.classList.remove('hidden');
    el.textContent = 'Cliquer le point de départ…';
  } else {
    el.classList.add('hidden');
  }
}

export function handleMeasureClick(e) {
  if (!measuring) return false;
  const el = document.getElementById('measure-result');
  if (!measureStart) {
    measureStart = e.lngLat;
    el.textContent = 'Cliquer le point d\'arrivée…';
  } else {
    const km = haversineKm(measureStart.lat, measureStart.lng, e.lngLat.lat, e.lngLat.lng);
    el.textContent = `📏 ${km.toFixed(2)} km`;
    measureStart = null;
  }
  return true;
}

// ── Alertes panel ───────────────────────────────────────────
export function renderAlertsList(alerts) {
  const el = document.getElementById('alerts-list');
  if (!alerts.length) { el.innerHTML = '<p class="muted">Aucune alerte</p>'; return; }
  el.innerHTML = alerts.map((a) => `
    <div class="alert-item ${a.critical ? 'critical' : ''}">
      <strong>${a.full_name}</strong> — ${a.message}
      <div class="alert-time">${a.at.toLocaleTimeString('fr-FR')} · ${a.alert_type}</div>
    </div>`).join('');
}

// ── Panel rétractable (☰) — replié par défaut sur mobile ────
export function setupPanelToggle() {
  const panel = document.getElementById('panel');
  const toggle = () => {
    panel.classList.toggle('collapsed');
    // la carte doit recalculer sa taille après le reflow
    setTimeout(() => map && map.resize(), 300);
  };
  document.getElementById('btn-panel').addEventListener('click', toggle);
  document.getElementById('btn-panel-close').addEventListener('click', toggle);
  if (window.innerWidth <= 768) panel.classList.add('collapsed');
}

// ── Horloge topbar ──────────────────────────────────────────
export function startClock() {
  const el = document.getElementById('clock');
  setInterval(() => {
    el.textContent = new Date().toLocaleTimeString('fr-FR');
  }, 1000);
}
