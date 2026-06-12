// ── Météo : Open-Meteo 72h (panel) + couche radar pluie ─────
// Note : Open-Meteo ne fournit pas de tuiles raster — la couche pluie
// utilise RainViewer (gratuit, sans clé). Le panel 72h reste Open-Meteo.
import { map } from './map.js';
import { CONFIG } from './config.js';

export async function loadWeatherPanel() {
  const el = document.getElementById('weather-panel');
  try {
    const [lng, lat] = CONFIG.MAP_CENTER;
    const url = `${CONFIG.OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}` +
      `&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=3&timezone=Africa%2FAbidjan`;
    const res = await fetch(url);
    const data = await res.json();
    const d = data.daily;
    el.innerHTML = d.time.map((day, i) => `
      <div class="weather-day">
        <span>${new Date(day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
        <span>${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C</span>
        <span class="weather-rain">🌧 ${d.precipitation_sum[i]} mm (${d.precipitation_probability_max[i]}%)</span>
      </div>`).join('');
  } catch (e) {
    el.textContent = `Météo indisponible : ${e.message}`;
  }
}

let rainAdded = false;

export async function setRainVisible(visible) {
  if (!rainAdded && visible) {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const meta = await res.json();
      // Pas de radar météo en Côte d'Ivoire → satellite infrarouge (mondial).
      // Les nuages denses (blanc vif) = cellules de pluie probables.
      const sat = meta.satellite?.infrared?.at(-1);
      const radar = meta.radar?.past?.at(-1);
      const frame = sat || radar;
      if (!frame) return;
      const opts = sat ? '0/0_0' : '2/1_1';
      map.addSource('rain', {
        type: 'raster',
        tiles: [`https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/${opts}.png`],
        tileSize: 256,
        // au-delà, MapLibre agrandit les tuiles existantes
        // (évite les tuiles "Zoom Level Not Supported")
        maxzoom: 6,
      });
      map.addLayer({
        id: 'weather-layer',
        type: 'raster',
        source: 'rain',
        paint: { 'raster-opacity': 0.4 },
      });
      rainAdded = true;
    } catch (e) {
      console.warn('Couche pluie indisponible :', e.message);
      return;
    }
  }
  if (map.getLayer('weather-layer')) {
    map.setLayoutProperty('weather-layer', 'visibility', visible ? 'visible' : 'none');
  }
}
