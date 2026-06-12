// ── Vidéo en direct (bodycam chauffeur) — côté dispatcher ───
// Ouvre un canal Realtime vers le téléphone du chauffeur, demande le
// flux ('want-stream'), négocie le WebRTC et affiche la vidéo en overlay.
import { supabase, fleet } from './realtime.js';
import { toast } from './alerts.js';

// STUN (Google) + TURN relais public OpenRelay/Metered : indispensable
// sur les réseaux mobiles ivoiriens (NAT symétrique) où le P2P direct
// échoue. Le TURN relaie le flux quand la connexion directe est bloquée.
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

let channel = null;
let pc = null;
let overlay = null;
let watchdog = null;

export function openLive(userId) {
  const name = fleet.get(userId)?.user.full_name || 'Chauffeur';
  closeLive(); // un seul flux à la fois

  overlay = document.createElement('div');
  overlay.className = 'live-overlay';
  overlay.innerHTML = `
    <div class="live-box">
      <div class="live-head">
        <span><span class="live-dot"></span> LIVE — ${name}</span>
        <button id="live-close">✕ Fermer</button>
      </div>
      <video id="live-video" autoplay playsinline></video>
      <div id="live-status" class="live-status">📡 Demande envoyée — la caméra du chauffeur démarre…</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#live-close').addEventListener('click', closeLive);

  const video = overlay.querySelector('#live-video');
  const status = overlay.querySelector('#live-status');

  pc = new RTCPeerConnection(ICE);
  pc.ontrack = (e) => {
    video.srcObject = e.streams[0];
    status.textContent = '🔴 En direct — caméra torse du chauffeur';
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ type: 'ice-dispatcher', candidate: e.candidate });
  };
  pc.onconnectionstatechange = () => {
    const st = pc?.connectionState;
    if (st === 'connecting') status.textContent = '🔄 Connexion via relais sécurisé…';
    else if (st === 'connected') status.textContent = '🔴 En direct — caméra torse du chauffeur';
    else if (st === 'failed') {
      // une seule relance auto avant d'abandonner
      if (!pc._retried) { pc._retried = true; status.textContent = '🔄 Reconnexion…'; send({ type: 'want-stream' }); }
      else status.textContent = '⚠ Connexion impossible sur ce réseau. Réessayer, ou passer en Wi-Fi côté chauffeur.';
    }
  };

  channel = supabase.channel(`babyroad-live-${userId}`);
  channel
    .on('broadcast', { event: 'signal' }, async ({ payload }) => {
      try {
        if (payload.type === 'offer' && pc) {
          await pc.setRemoteDescription(payload.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'answer', sdp: pc.localDescription });
          status.textContent = '🔄 Connexion vidéo en cours…';
        } else if (payload.type === 'ice-driver' && pc) {
          await pc.addIceCandidate(payload.candidate);
        } else if (payload.type === 'driver-stopped') {
          status.textContent = '■ Le chauffeur a coupé la caméra';
          setTimeout(closeLive, 1800);
        } else if (payload.type === 'driver-error') {
          status.textContent = `⚠ ${payload.message}`;
        }
      } catch (e) { console.warn('Live :', e.message); }
    })
    .subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        send({ type: 'want-stream' });
        // si l'app tracker n'est pas ouverte, personne ne répond
        watchdog = setTimeout(() => {
          if (pc && !video.srcObject && pc.connectionState !== 'connected') {
            status.textContent = '⚠ Pas de réponse — l\'app tracker doit être OUVERTE sur le téléphone du chauffeur';
          }
        }, 15000);
      }
    });
}

function send(payload) {
  channel?.send({ type: 'broadcast', event: 'signal', payload });
}

export function closeLive() {
  if (channel) {
    send({ type: 'stop-stream' });
    supabase.removeChannel(channel);
    channel = null;
  }
  clearTimeout(watchdog);
  pc?.close();
  pc = null;
  overlay?.remove();
  overlay = null;
}
