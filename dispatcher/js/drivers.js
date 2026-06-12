// ── Gestion des chauffeurs : ajout / désactivation ──────────
import { supabase } from './realtime.js';
import { toast } from './alerts.js';

export async function addDriver({ full_name, phone, vehicle_id, vehicle_type, marker_color }) {
  if (!full_name?.trim()) throw new Error('Le nom est obligatoire');

  // prochain user_code (DRIVER_05, 06… résiste aux suppressions)
  const { data, error: selErr } = await supabase.from('babyroad_users').select('user_code');
  if (selErr) throw new Error(selErr.message);
  const max = (data || []).reduce((m, r) => {
    const n = parseInt((r.user_code || '').replace('DRIVER_', ''), 10) || 0;
    return Math.max(m, n);
  }, 0);
  const user_code = `DRIVER_${String(max + 1).padStart(2, '0')}`;

  const { error } = await supabase.from('babyroad_users').insert({
    user_code,
    full_name: full_name.trim(),
    phone: phone?.trim() || null,
    vehicle_id: vehicle_id?.trim() || null,
    vehicle_type: vehicle_type || 'porteur',
    marker_color: marker_color || '#1B6B3A',
  });
  if (error) throw new Error(error.message);
  return user_code;
}

// Désactivation (soft delete) : le chauffeur disparaît du dashboard
// et du tracker mais tout son historique de positions est conservé.
export async function removeDriver(id, name) {
  const { error } = await supabase
    .from('babyroad_users')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
  toast(`Chauffeur ${name} retiré de la flotte (historique conservé)`, false);
}

// ── Modal d'ajout ───────────────────────────────────────────
export function setupDriverModal(onChanged) {
  const modal = document.getElementById('driver-modal');
  const form = document.getElementById('driver-form');

  document.getElementById('btn-add-driver').addEventListener('click', () => {
    form.reset();
    modal.classList.remove('hidden');
  });
  document.getElementById('driver-modal-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const code = await addDriver({
        full_name: form.elements.full_name.value,
        phone: form.elements.phone.value,
        vehicle_id: form.elements.vehicle_id.value,
        vehicle_type: form.elements.vehicle_type.value,
        marker_color: form.elements.marker_color.value,
      });
      toast(`Chauffeur ajouté (${code}) — il apparaît dans l'app tracker`, false);
      modal.classList.add('hidden');
      if (onChanged) onChanged();
    } catch (err) {
      toast(`Ajout impossible : ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  });
}
