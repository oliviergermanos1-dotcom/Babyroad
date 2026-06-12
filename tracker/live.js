// ── Vidéo en direct (bodycam torse) — côté chauffeur ────────
// Le dispatcher envoie 'want-stream' sur le canal Realtime du chauffeur :
// la caméra arrière démarre et le flux part en WebRTC (P2P, STUN Google).
// Transparence : bandeau rouge "EN DIRECT" + bouton Couper + vibration.
// 1ère utilisation : Android demande l'autorisation caméra (une fois).

import { CONFIG } from './config.js';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let supabase = null;
let channel = null;
let pc = null;
let stream = null;
let currentUserId = null;

const banner = document.getElementById('live-banner');
document.getElementById('btn-live-stop').addEventListener('click', () => {
  stopStream(true);
});

export function setupLive(sb, userId) {
  supabase = sb;
  if (channel) supabase.removeChannel(channel);
  stopStream(false);
  currentUserId = userId;
  if (!userId) return;

  channel = supabase.channel(`babyroad-live-${userId}`);
  channel
    .on('broadcast', { event: 'signal' }, async ({ payload }) => {
      try {
        if (payload.type === 'want-stream') await startStream();
        else if (payload.type === 'answer' && pc) await pc.setRemoteDescription(payload.sdp);
        else if (payload.type === 'ice-dispatcher' && pc) await pc.addIceCandidate(payload.candidate);
        else if (payload.type === 'stop-stream') stopStream(false);
      } catch (e) { console.warn('Live :', e.message); }
    })
    .subscribe();
}

function send(payload) {
  channel?.send({ type: 'broadcast', event: 'signal', payload });
}

async function startStream() {
  if (pc) stopStream(false); // redémarrage propre si déjà en cours
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
  } catch (e) {
    send({ type: 'driver-error', message: 'Caméra refusée ou indisponible : ' + e.message });
    return;
  }

  pc = new RTCPeerConnection(ICE);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ type: 'ice-driver', candidate: e.candidate });
  };
  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc?.connectionState)) stopStream(false);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send({ type: 'offer', sdp: pc.localDescription });

  // Mode discret : téléphone d'entreprise, politique signée par le chauffeur
  // → pas de bandeau ni de vibration. Mettre LIVE_DISCRET=false pour
  // réafficher le bandeau "EN DIRECT" (consentement explicite requis).
  if (!CONFIG.LIVE_DISCRET) {
    banner.style.display = 'flex';
    try { navigator.vibrate([400, 150, 400]); } catch { /* pas de vibreur */ }
  }
}

function stopStream(notify) {
  if (notify) send({ type: 'driver-stopped' });
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  pc?.close();
  pc = null;
  banner.style.display = 'none';
}
