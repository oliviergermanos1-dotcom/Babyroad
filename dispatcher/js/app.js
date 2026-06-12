// ============================================================
// BABYROAD — Dashboard dispatcher : point d'entrée
// ============================================================
import { CONFIG } from './config.js';
import { initMap, map, toggle3D, switchBaseStyle, mapMode, setSatelliteVisible } from './map.js';
import { drawLandmarks, setLandmarksVisible } from './landmarks.js';
import { drawCameras, setCamerasVisible } from './cameras.js';
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
import { setTrafficVisible, resetTraffic, recordFleetSegment, drawFleetTraffic } from './traffic.js';
import { loadWeatherPanel, setRainVisible, resetRain } from './weather.js';
import { startPing } from './benchmark.js';
import {
  renderDriverCards, openTruckPopup, startFollow, stopFollow, followTick,
  toggleMeasure, handleMeasureClick, renderAlertsList, startClock,
  setupPanelToggle, setDriverDeleteHandler, setRequestPhotoHandler,
  setOpenLiveHandler,
} from './ui.js';
import { loadDayHistory, drawHistory, clearHistory, computeStats, exportCSV } from './history.js';
import { removeDriver, setupDriverModal } from './drivers.js';
import { loadRecentPOD, subscribePOD, requestPhoto } from './pod.js';
import { openLive } from './live.js';
import {
  applyAtmosphere, setTerrainEnabled, startGeofencePulse, toggleCinematicTour,
} from './effects.js';

const $ = (id) => document.getElementById(id);
const checked = (id) => $(id).checked;

function hideSplash() {
  const s = $('splash');
  s.classList.add('fade');
  setTimeout(() => s.remove(), 450);
}

async function main() {
  if (!CONFIG.SUPABASE_ANON_KEY) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div style="background:#DC2626;color:#fff;padding:12px;text-align:center;font-family:sans-serif;z-index:300;position:relative">' +
      '⚠ SUPABASE_ANON_KEY manquante — renseigner dispatcher/js/config.js</div>');
    $('splash').remove();
    return;
  }

  startClock();
  initMap();
  setupPanelToggle();

  map.on('load', async () => {
    let users = [];
    try {
      users = await loadInitialState();
    } catch (e) {
      hideSplash();
      toast(`Erreur Supabase : ${e.message}`, true);
      return;
    }

    // Couches de base
    await loadGeofences();
    drawAllOverlays(users);

    // Marqueurs + traces initiales
    fleet.forEach((entry) => {
      if (entry.position) {
        pushPoint(entry.user.id, entry.position.lng, entry.position.lat);
        upsertMarker(entry, outOfZoneIds);
      }
    });

    // Realtime : chaque INSERT de position
    subscribeRealtime((entry, prev) => {
      const p = entry.position;
      pushPoint(entry.user.id, p.lng, p.lat);
      redrawTrajectory(entry.user.id);
      upsertMarker(entry, outOfZoneIds);
      onPositionAlerts(entry);
      recordFleetSegment(prev, p);
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
    startGeofencePulse();
    loadRecentPOD();
    subscribePOD();

    setupControls(users);
    hideSplash();
  });
}

// Dessine toutes les couches custom + ré-applique l'état des toggles.
// Utilisé au chargement ET après un changement de fond (setStyle détruit tout).
function drawAllOverlays(users) {
  applyAtmosphere(mapMode());
  drawGeofences();
  drawLandmarks(mapMode());
  drawCameras();
  users.forEach((u) => ensureTrajectoryLayer(u));
  fleet.forEach((entry) => redrawTrajectory(entry.user.id));

  drawFleetTraffic();
  if (checked('toggle-terrain')) setTerrainEnabled(true);
  if (checked('toggle-satellite')) setSatelliteVisible(true);
  if (checked('toggle-traffic')) setTrafficVisible(true);
  if (checked('toggle-weather')) setRainVisible(true);
  if (!checked('toggle-geofences')) setGeofencesVisible(false);
  if (!checked('toggle-trajectories')) setTrajectoriesVisible(false);
  if (!checked('toggle-landmarks')) setLandmarksVisible(false);
  if (!checked('toggle-cameras')) setCamerasVisible(false);
  if (!checked('toggle-buildings') && map.getLayer('buildings-3d')) {
    map.setLayoutProperty('buildings-3d', 'visibility', 'none');
  }
}

function setupControls(users) {
  // Clic marqueur → fiche popup
  setMarkerClickHandler((entry) => openTruckPopup(entry, startFollow));
  $('btn-unfollow').addEventListener('click', stopFollow);

  // Panneau Couches (plié/déplié)
  $('btn-layers').addEventListener('click', () => {
    $('layers-control').classList.toggle('open');
  });
  // déplié par défaut sur desktop
  if (window.innerWidth > 768) $('layers-control').classList.add('open');

  // Légende (pliée par défaut)
  $('btn-legend').addEventListener('click', () => {
    $('legend').classList.toggle('open');
  });

  // Toggles couches
  $('toggle-traffic').addEventListener('change', (e) => {
    if (!setTrafficVisible(e.target.checked)) e.target.checked = false;
  });
  $('toggle-satellite').addEventListener('change', (e) => {
    setSatelliteVisible(e.target.checked);
  });
  $('toggle-weather').addEventListener('change', (e) => {
    setRainVisible(e.target.checked);
  });
  $('toggle-buildings').addEventListener('change', (e) => {
    if (map.getLayer('buildings-3d')) {
      map.setLayoutProperty('buildings-3d', 'visibility', e.target.checked ? 'visible' : 'none');
    }
  });
  $('toggle-geofences').addEventListener('change', (e) => {
    setGeofencesVisible(e.target.checked);
  });
  $('toggle-trajectories').addEventListener('change', (e) => {
    setTrajectoriesVisible(e.target.checked);
  });
  $('toggle-landmarks').addEventListener('change', (e) => {
    setLandmarksVisible(e.target.checked);
  });
  $('toggle-cameras').addEventListener('change', (e) => {
    setCamerasVisible(e.target.checked);
  });
  $('toggle-terrain').addEventListener('change', (e) => {
    setTerrainEnabled(e.target.checked);
    if (e.target.checked && map.getPitch() < 30) {
      map.easeTo({ pitch: 55, duration: 700 }); // le relief se voit en 3D
    }
  });

  // Tour 3D cinématique (orbite au-dessus du Plateau)
  $('btn-tour').addEventListener('click', () => toggleCinematicTour($('btn-tour')));

  // Trafic temps réel Google Maps (seule source couvrant Abidjan — externe)
  $('btn-gtraffic').addEventListener('click', () => {
    window.open('https://www.google.com/maps/@5.3360,-4.0160,13z/data=!5m1!1e1', '_blank');
  });

  // Demande de photo au chauffeur (popup camion → 📸 Photo)
  setRequestPhotoHandler((userId) => requestPhoto(userId));

  // Vidéo bodycam (🔴 Live) ou interphone audio (🎙 Parler)
  setOpenLiveHandler((userId, mode) => openLive(userId, mode));

  // Bascule fond sombre ↔ clair
  $('btn-style').addEventListener('click', () => {
    switchBaseStyle(() => {
      resetTraffic();
      resetRain();
      drawAllOverlays(users);
    });
  });

  // 2D/3D + mesure (carte démarre en pitch 45 → bouton propose 2D)
  const btn23d = $('btn-23d');
  btn23d.addEventListener('click', () => toggle3D(btn23d));
  $('btn-measure').addEventListener('click', toggleMeasure);
  map.on('click', (e) => handleMeasureClick(e));

  // Gestion chauffeurs
  setupDriverModal(() => setTimeout(() => window.location.reload(), 800));
  setDriverDeleteHandler(async (user) => {
    if (!window.confirm(`Retirer ${user.full_name} de la flotte ?\n(L'historique de ses trajets est conservé)`)) return;
    try {
      await removeDriver(user.id, user.full_name);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast(`Suppression impossible : ${e.message}`, true);
    }
  });

  // Historique
  const driverSel = $('history-driver');
  driverSel.innerHTML = users
    .map((u) => `<option value="${u.id}">${u.full_name} (${u.vehicle_id || u.user_code})</option>`)
    .join('');
  const dateInput = $('history-date');
  dateInput.value = new Date().toISOString().slice(0, 10);

  let historyRows = [];
  $('btn-history').addEventListener('click', async () => {
    const statsEl = $('history-stats');
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

  $('btn-export-csv').addEventListener('click', () => {
    const name = driverSel.options[driverSel.selectedIndex]?.text || 'camion';
    if (!exportCSV(historyRows, `babyroad_${name}_${dateInput.value}.csv`)) {
      toast('Charger d\'abord un historique à exporter');
    }
  });
}

main();
