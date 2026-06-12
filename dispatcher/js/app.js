// ============================================================
// BABYROAD — Dashboard dispatcher : point d'entrée
// ============================================================
import { CONFIG } from './config.js';
import { initMap, map, toggle3D } from './map.js';
import {
  fleet, loadInitialState, subscribeRealtime, onFleetUpdate,
} from './realtime.js';
import { upsertMarker, setMarkerClickHandler } from './markers.js';
import {
  pushPoint, ensureTrajectoryLayer, redrawTrajectory, setTrajectoriesVisible,
} from './trajectories.js';
import {
  loadGeofences, drawGeofences, setGeofencesVisible,
} from './geofences.js';
import {
  onPositionAlerts, startSignalWatch, setAlertRenderer, outOfZoneIds, toast,
} from './alerts.js';
import { setTrafficVisible } from './traffic.js';
import { loadWeatherPanel, setRainVisible } from './weather.js';
import { startPing } from './benchmark.js';
import {
  renderDriverCards, openTruckPopup, startFollow, stopFollow, followTick,
  toggleMeasure, handleMeasureClick, renderAlertsList, startClock,
} from './ui.js';
import { loadDayHistory, drawHistory, clearHistory, computeStats, exportCSV } from './history.js';

async function main() {
  if (!CONFIG.SUPABASE_ANON_KEY) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="background:#DC2626;color:#fff;padding:12px;text-align:center;font-family:sans-serif">' +
      '⚠ SUPABASE_ANON_KEY manquante — renseigner dispatcher/js/config.js</div>');
    return;
  }

  startClock();
  initMap();

  map.on('load', async () => {
    let users = [];
    try {
      users = await loadInitialState();
    } catch (e) {
      toast(`Erreur Supabase : ${e.message}`, true);
      return;
    }

    // Couches de base
    await loadGeofences();
    drawGeofences();
    users.forEach((u) => ensureTrajectoryLayer(u));

    // Marqueurs + traces initiales
    fleet.forEach((entry) => {
      if (entry.position) {
        pushPoint(entry.user.id, entry.position.lng, entry.position.lat);
        upsertMarker(entry, outOfZoneIds);
      }
    });

    // Realtime : chaque INSERT de position
    subscribeRealtime((entry) => {
      const p = entry.position;
      pushPoint(entry.user.id, p.lng, p.lat);
      redrawTrajectory(entry.user.id);
      upsertMarker(entry, outOfZoneIds);
      onPositionAlerts(entry);
      followTick(fleet);
    });

    // Re-rendu panel (throttlé à 1/s dans realtime.js)
    onFleetUpdate(() => renderDriverCards(fleet));
    renderDriverCards(fleet);
    // rafraîchit "dern. sync" + statuts même sans nouvelle position
    setInterval(() => {
      renderDriverCards(fleet);
      fleet.forEach((entry) => entry.position && upsertMarker(entry, outOfZoneIds));
    }, 10000);

    startSignalWatch();
    startPing();
    loadWeatherPanel();
    setAlertRenderer(renderAlertsList);

    setupControls(users);
  });
}

function setupControls(users) {
  // Clic marqueur → fiche popup
  setMarkerClickHandler((entry) => openTruckPopup(entry, startFollow));
  document.getElementById('btn-unfollow').addEventListener('click', stopFollow);

  // Toggles couches
  document.getElementById('toggle-traffic').addEventListener('change', (e) => {
    if (!setTrafficVisible(e.target.checked)) e.target.checked = false;
  });
  document.getElementById('toggle-weather').addEventListener('change', (e) => {
    setRainVisible(e.target.checked);
  });
  document.getElementById('toggle-buildings').addEventListener('change', (e) => {
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', e.target.checked ? 'visible' : 'none');
    }
  });
  document.getElementById('toggle-geofences').addEventListener('change', (e) => {
    setGeofencesVisible(e.target.checked);
  });
  document.getElementById('toggle-trajectories').addEventListener('change', (e) => {
    setTrajectoriesVisible(e.target.checked);
  });

  // 2D/3D + mesure
  const btn23d = document.getElementById('btn-23d');
  btn23d.addEventListener('click', () => toggle3D(btn23d));
  document.getElementById('btn-measure').addEventListener('click', toggleMeasure);
  map.on('click', (e) => handleMeasureClick(e));

  // Historique
  const driverSel = document.getElementById('history-driver');
  driverSel.innerHTML = users
    .map((u) => `<option value="${u.id}">${u.full_name} (${u.vehicle_id || u.user_code})</option>`)
    .join('');
  const dateInput = document.getElementById('history-date');
  dateInput.value = new Date().toISOString().slice(0, 10);

  let historyRows = [];
  document.getElementById('btn-history').addEventListener('click', async () => {
    const statsEl = document.getElementById('history-stats');
    try {
      historyRows = await loadDayHistory(driverSel.value, dateInput.value);
      if (!historyRows.length) {
        clearHistory();
        statsEl.textContent = 'Aucune position ce jour.';
        return;
      }
      drawHistory(historyRows);
      const s = computeStats(historyRows);
      statsEl.innerHTML =
        `📍 ${s.points} positions · 🛣 ${s.km} km<br>` +
        `🚗 conduite ${s.driveH} h · ⏸ arrêt ${s.stopH} h`;
    } catch (e) {
      statsEl.textContent = `Erreur : ${e.message}`;
    }
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const name = driverSel.options[driverSel.selectedIndex]?.text || 'camion';
    if (!exportCSV(historyRows, `babyroad_${name}_${dateInput.value}.csv`)) {
      toast('Charger d\'abord un historique à exporter');
    }
  });
}

main();
