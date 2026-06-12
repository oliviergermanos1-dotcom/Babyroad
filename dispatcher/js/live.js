// ── Vidéo en direct (bodycam chauffeur) — côté dispatcher ───
// Ouvre un canal Realtime vers le téléphone du chauffeur, demande le
// flux ('want-stream'), négocie le WebRTC et affiche la vidéo en overlay.
import { supabase, fleet } from './realtime.js';
import { toast } from './alerts.js';
import { CONFIG } from './config.js';
import { buildIce } from './ice.js';

// STUN + TURN dédié (CONFIG) si renseigné, sinon relais public OpenRelay.
const ICE = buildIce(CONFIG);

let channel = null;
let pc = null;
let overlay = null;
let watchdog = null;
let localMic = null;

// mode 'video' = caméra + son bidirectionnel · 'audio' = interphone seul
export function openLive(userId, mode = 'video') {
  const name = fleet.get(userId)?.user.full_name || 'Chauffeur';
  const isIntercom = mode === 'audio';
  closeLive(); // un seul flux à la fois

  overlay = document.createElement('div');
  overlay.className = 'live-overlay';
  overlay.innerHTML = `
    <div class="live-box ${isIntercom ? 'intercom' : ''}">
      <div class="live-head">
        <span><span class="live-dot"></span> ${isIntercom ? '🎙 INTERPHONE' : 'LIVE'} — ${name}</span>
        <span>
          <button id="live-mute" title="Couper / réactiver votre micro">🎤 Micro ON</button>
          <button id="live-close">✕ Fermer</button>
        </span>
      </div>
      <video id="live-video" autoplay playsinline ${isIntercom ? 'style="display:none"' : ''}></video>
      ${isIntercom ? '<div class="intercom-visual">🎙<br><small>Conversation en cours — parlez normalement</small></div>' : ''}
      <div id="live-status" class="live-status">📡 Demande envoyée — connexion au téléphone…</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#live-close').addEventListener('click', closeLive);

  // bouton mute du micro dispatcher
  overlay.querySelector('#live-mute').addEventListener('click', (e) => {
    const track = localMic?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    e.target.textContent = track.enabled ? '🎤 Micro ON' : '🔇 Micro OFF';
  });

  const video = overlay.querySelector('#live-video');
  const status = overlay.querySelector('#live-status');

  pc = new RTCPeerConnection(ICE);
  pc.ontrack = (e) => {
    video.srcObject = e.streams[0];
    video.style.display = isIntercom ? 'none' : 'block';
    // en interphone, la <video> cachée sert de sortie audio
    if (isIntercom) video.play().catch(() => {});
    status.textContent = isIntercom
      ? '🎙 En ligne — vous entendez le chauffeur, il vous entend'
      : '🔴 En direct — caméra torse du chauffeur (son bidirectionnel)';
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
          // micro dispatcher → le chauffeur t'entend (interphone bidirectionnel)
          if (!localMic) {
            try {
              localMic = await navigator.mediaDevices.getUserMedia({ audio: true });
              localMic.getTracks().forEach((t) => pc.addTrack(t, localMic));
            } catch { status.textContent += ' (micro PC refusé — écoute seule)'; }
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'answer', sdp: pc.localDescription });
          status.textContent = '🔄 Connexion en cours…';
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
        send({ type: 'want-stream', video: !isIntercom });
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
  localMic?.getTracks().forEach((t) => t.stop());
  localMic = null;
  pc?.close();
  pc = null;
  overlay?.remove();
  overlay = null;
}
