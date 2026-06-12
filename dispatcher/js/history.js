// ── Historique trajets : affichage + stats + export CSV ─────
import { map } from './map.js';
import { supabase, haversineKm } from './realtime.js';

let lastRows = [];

export async function loadDayHistory(userId, dateStr) {
  const start = `${dateStr}T00:00:00`;
  const end = `${dateStr}T23:59:59`;
  const { data, error } = await supabase
    .from('babyroad_positions')
    .select('*')
    .eq('user_id', userId)
    .gte('recorded_at', start)
    .lte('recorded_at', end)
    .order('recorded_at', { ascending: true });
  if (error) throw new Error(error.message);
  lastRows = data || [];
  return lastRows;
}

export function drawHistory(rows) {
  const coords = rows.map((r) => [r.lng, r.lat]);
  const data = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
  };
  if (map.getSource('history-src')) {
    map.getSource('history-src').setData(data);
  } else {
    map.addSource('history-src', { type: 'geojson', data });
    map.addLayer({
      id: 'history-line',
      type: 'line',
      source: 'history-src',
      paint: { 'line-color': '#FFB347', 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [1, 1] },
    });
  }
  if (coords.length > 1) {
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80 }
    );
  }
}

export function clearHistory() {
  if (map.getLayer('history-line')) map.removeLayer('history-line');
  if (map.getSource('history-src')) map.removeSource('history-src');
}

// km parcourus + temps conduite (vitesse > 5 km/h) vs arrêt
export function computeStats(rows) {
  let km = 0;
  let driveS = 0;
  let stopS = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    km += haversineKm(a.lat, a.lng, b.lat, b.lng);
    const dt = (new Date(b.recorded_at) - new Date(a.recorded_at)) / 1000;
    if (dt > 0 && dt < 600) {
      if ((b.speed || 0) > 5) driveS += dt; else stopS += dt;
    }
  }
  return {
    points: rows.length,
    km: km.toFixed(1),
    driveH: (driveS / 3600).toFixed(1),
    stopH: (stopS / 3600).toFixed(1),
  };
}

export function exportCSV(rows, filename = 'babyroad_trajets.csv') {
  if (!rows.length) rows = lastRows;
  if (!rows.length) return false;
  const head = 'recorded_at;lat;lng;speed_kmh;heading;accuracy_m;battery;network';
  const lines = rows.map((r) =>
    [r.recorded_at, r.lat, r.lng, r.speed ?? '', r.heading ?? '', r.accuracy ?? '', r.battery ?? '', r.network_type ?? ''].join(';')
  );
  const blob = new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
