const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// ----------------------------------------------------------------------------
// Firebase Admin init
// ----------------------------------------------------------------------------
// Two ways to provide credentials:
//   1. A service-account JSON file at ./firebase-admin.json (gitignored)
//   2. Environment variables (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
//      FIREBASE_PRIVATE_KEY) — handy for Railway/Render where you can't commit
//      a file.
// ----------------------------------------------------------------------------
function buildCredential() {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Railway/Render escape the newlines — restore them.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }

  try {
    // eslint-disable-next-line global-require
    return admin.credential.cert(require('./firebase-admin.json'));
  } catch (e) {
    console.error(
      '[FATAL] No Firebase credentials found. Provide firebase-admin.json ' +
        'or FIREBASE_* env vars (see .env.example).'
    );
    throw e;
  }
}

admin.initializeApp({ credential: buildCredential() });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory state. For a single instance this is fine; for multi-instance you
// would move this to Redis pub/sub.
const connections = new Map(); // userId  -> { ws, role, deviceId }
const streams = new Map(); //     streamId -> { parentId, caregiverId, type }

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function send(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// Broadcast online/offline status to every connected client.
function broadcastStatus(userId, isOnline) {
  const statusMsg = {
    type: 'USER_STATUS',
    userId,
    isOnline,
    timestamp: Date.now(),
  };
  for (const [, conn] of connections) {
    send(conn.ws, statusMsg);
  }
}

// ----------------------------------------------------------------------------
// WebSocket handling
// ----------------------------------------------------------------------------
wss.on('connection', (ws) => {
  console.log('[WS] New connection');

  let userId = null;
  let role = null;
  let deviceId = null;

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      send(ws, { type: 'ERROR', message: 'Invalid JSON' });
      return;
    }

    // Every message except AUTH requires an authenticated socket.
    if (data.type !== 'AUTH' && !userId) {
      send(ws, { type: 'ERROR', message: 'Not authenticated' });
      return;
    }

    try {
      switch (data.type) {
        // ===================== AUTHENTICATION =====================
        case 'AUTH': {
          const decoded = await admin.auth().verifyIdToken(data.token);
          userId = decoded.uid;
          role = data.role === 'caregiver' ? 'caregiver' : 'parent';
          deviceId = data.deviceId || `${userId}_${Date.now()}`;

          connections.set(userId, { ws, role, deviceId });
          broadcastStatus(userId, true);

          send(ws, { type: 'AUTH_SUCCESS', userId, role, deviceId });
          console.log(`[AUTH] ${userId} (${role}) authenticated`);
          break;
        }

        // ============== PARENT: START AUDIO LISTENING ==============
        case 'START_AUDIO_STREAM': {
          const { caregiverId } = data;
          const caregiverConn = connections.get(caregiverId);

          if (!caregiverConn || caregiverConn.role !== 'caregiver') {
            send(ws, { type: 'ERROR', message: 'Caregiver not available' });
            break;
          }

          const streamId = `audio_${userId}_${caregiverId}_${Date.now()}`;
          streams.set(streamId, {
            parentId: userId,
            caregiverId,
            type: 'audio',
          });

          send(caregiverConn.ws, {
            type: 'START_AUDIO_STREAM',
            parentId: userId,
            streamId,
          });
          send(ws, { type: 'STREAM_STARTED', streamId });

          console.log(`[STREAM] Audio: ${userId} -> ${caregiverId} (${streamId})`);
          break;
        }

        // ============== CAREGIVER: AUDIO CHUNK ==============
        case 'AUDIO_CHUNK': {
          const stream = streams.get(data.streamId);
          if (stream) {
            const parentConn = connections.get(stream.parentId);
            send(parentConn && parentConn.ws, {
              type: 'AUDIO_CHUNK',
              streamId: data.streamId,
              audio: data.audio, // base64 PCM/Opus chunk
            });
          }
          break;
        }

        // ============== PARENT: START VIDEO ==============
        case 'START_VIDEO_STREAM': {
          const { caregiverId } = data;
          const caregiverConn = connections.get(caregiverId);

          if (!caregiverConn || caregiverConn.role !== 'caregiver') {
            send(ws, { type: 'ERROR', message: 'Caregiver not available' });
            break;
          }

          const streamId = `video_${userId}_${caregiverId}_${Date.now()}`;
          streams.set(streamId, {
            parentId: userId,
            caregiverId,
            type: 'video',
          });

          send(caregiverConn.ws, {
            type: 'START_VIDEO_STREAM',
            parentId: userId,
            streamId,
          });
          send(ws, { type: 'STREAM_STARTED', streamId });

          console.log(`[STREAM] Video: ${userId} -> ${caregiverId} (${streamId})`);
          break;
        }

        // ============== CAREGIVER: VIDEO FRAME ==============
        case 'VIDEO_FRAME': {
          const stream = streams.get(data.streamId);
          if (stream) {
            const parentConn = connections.get(stream.parentId);
            send(parentConn && parentConn.ws, {
              type: 'VIDEO_FRAME',
              streamId: data.streamId,
              frame: data.frame, // base64 JPEG frame
            });
          }
          break;
        }

        // ============== STOP STREAM ==============
        case 'STOP_STREAM': {
          const stream = streams.get(data.streamId);
          if (stream) {
            const caregiverConn = connections.get(stream.caregiverId);
            send(caregiverConn && caregiverConn.ws, {
              type: 'STOP_STREAM',
              streamId: data.streamId,
            });
            streams.delete(data.streamId);
            console.log(`[STREAM] Stopped ${data.streamId}`);
          }
          break;
        }

        // ============== GET CONTACTS ==============
        case 'GET_CONTACTS': {
          if (role !== 'parent') break;

          const db = admin.firestore();
          const userDoc = await db.collection('users').doc(userId).get();
          const contactIds = userDoc.data()?.contacts || [];

          const contacts = await Promise.all(
            contactIds.map(async (contactId) => {
              const doc = await db.collection('users').doc(contactId).get();
              return {
                id: contactId,
                name: doc.data()?.name || 'Unknown',
                phone: doc.data()?.phone || '',
                isOnline: connections.has(contactId),
              };
            })
          );

          send(ws, { type: 'CONTACTS', contacts });
          break;
        }

        default:
          send(ws, { type: 'ERROR', message: `Unknown type: ${data.type}` });
      }
    } catch (error) {
      console.error('[ERROR]', error);
      send(ws, { type: 'ERROR', message: error.message });
    }
  });

  ws.on('close', () => {
    if (userId) {
      connections.delete(userId);

      // Tear down any streams this user was part of.
      for (const [streamId, stream] of streams) {
        if (stream.parentId === userId || stream.caregiverId === userId) {
          const otherId =
            stream.parentId === userId ? stream.caregiverId : stream.parentId;
          const otherConn = connections.get(otherId);
          send(otherConn && otherConn.ws, { type: 'STOP_STREAM', streamId });
          streams.delete(streamId);
        }
      }

      broadcastStatus(userId, false);
      console.log(`[DISCONNECT] ${userId}`);
    }
  });
});

// ----------------------------------------------------------------------------
// HTTP
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: connections.size,
    streams: streams.size,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 BabyPhone server running on port ${PORT}`);
});

module.exports = { app, wss, server };
