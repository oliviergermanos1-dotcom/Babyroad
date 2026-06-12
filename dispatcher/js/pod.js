// ── Preuves de livraison (POD) côté dispatcher ──────────────
import { map } from './map.js';
import { supabase, fleet } from './realtime.js';
import { toast } from './alerts.js';

const MAX_LIST = 12;
let items = [];

function render() {
  const el = document.getElementById('pod-list');
  if (!items.length) {
    el.innerHTML = '<p class="muted">Aucune photo reçue</p>';
    return;
  }
  el.innerHTML = items.map((p) => `
    <a class="pod-item" href="${p.photo_url}" target="_blank" rel="noopener"
       data-lat="${p.lat ?? ''}" data-lng="${p.lng ?? ''}">
      <img src="${p.photo_url}" loading="lazy" alt="">
      <div class="pod-meta">
        <strong>${p.kind === 'VISAGE' ? '🤳 Visage' : '📄 Document'}</strong>
        <span>${p.driverName || ''}</span>
        <span class="mono">${new Date(p.created_at).toLocaleTimeString('fr-FR')}</span>
      </div>
    </a>`).join('');
  // clic droit/long → centre la carte sur le lieu de prise de vue
  el.querySelectorAll('.pod-item').forEach((a) => {
    a.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const { lat, lng } = a.dataset;
      if (lat && lng) map.flyTo({ center: [Number(lng), Number(lat)], zoom: 16 });
    });
  });
}

function driverName(userId) {
  return fleet.get(userId)?.user.full_name || 'Chauffeur';
}

export async function loadRecentPOD() {
  const { data, error } = await supabase
    .from('babyroad_pod')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_LIST);
  if (error) { console.warn('POD :', error.message); return; }
  items = (data || []).map((p) => ({ ...p, driverName: driverName(p.user_id) }));
  render();
}

export function subscribePOD() {
  supabase
    .channel('babyroad-pod')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'babyroad_pod' },
      (payload) => {
        const p = { ...payload.new, driverName: driverName(payload.new.user_id) };
        items.unshift(p);
        if (items.length > MAX_LIST) items.pop();
        render();
        toast(`📸 ${p.driverName} — ${p.kind === 'VISAGE' ? 'visage réceptionnaire' : 'document'} reçu`, false);
      })
    .subscribe();
}

// Demande une photo au chauffeur (bannière + vibration sur son téléphone)
export async function requestPhoto(userId) {
  const { error } = await supabase
    .from('babyroad_pod_requests')
    .insert({ user_id: userId });
  if (error) {
    toast(`Demande impossible : ${error.message}`, true);
  } else {
    toast(`📸 Demande de photo envoyée à ${driverName(userId)} — son téléphone vibre`);
  }
}
