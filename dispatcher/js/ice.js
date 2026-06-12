// ── Configuration ICE partagée (STUN + TURN) ────────────────
// Si un TURN dédié est renseigné dans CONFIG, on l'utilise en priorité
// (fiable sur 4G ivoirienne). Sinon, fallback sur le relais public
// OpenRelay (gratuit mais parfois saturé).
export function buildIce(CONFIG) {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];

  if (CONFIG.TURN_URL && CONFIG.TURN_USERNAME) {
    servers.push({
      urls: CONFIG.TURN_URL,
      username: CONFIG.TURN_USERNAME,
      credential: CONFIG.TURN_CREDENTIAL,
    });
    // variantes utiles si l'URL de base est fournie sans port explicite
    if (/relay\.metered\.ca/.test(CONFIG.TURN_URL)) {
      servers.push(
        { urls: 'turn:standard.relay.metered.ca:80', username: CONFIG.TURN_USERNAME, credential: CONFIG.TURN_CREDENTIAL },
        { urls: 'turn:standard.relay.metered.ca:443?transport=tcp', username: CONFIG.TURN_USERNAME, credential: CONFIG.TURN_CREDENTIAL },
      );
    }
  } else {
    servers.push(
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    );
  }
  return { iceServers: servers };
}
