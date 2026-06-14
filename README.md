# 👶 BabyPhone

A simple family **audio/video baby monitor**. A parent device listens live to a
caregiver device (a phone left near the baby), with an optional camera view.

- **Backend** — Node.js + `ws` WebSocket relay, Firebase Admin for auth.
- **Mobile** — React Native (TypeScript), Firebase phone auth + Firestore.
- **Android native** — foreground service that captures the mic in the
  background (with a persistent, required notification).

```
backend/                Node.js WebSocket server
  server.js
  package.json
  .env.example
mobile/                  React Native app
  App.tsx
  screens/               AuthScreen, HomeScreen, StreamScreen
  services/              firebase, websocket, permissions, config
  components/            AudioPlayer, StreamViewer
  android/.../BackgroundMicService.kt
docs/SETUP.md            Full setup, deploy & privacy notes
```

## Quick start

```bash
# Backend
cd backend && cp .env.example .env && npm install && npm run dev

# Mobile (separate terminal)
cd mobile && npm install && npm run android
```

Full instructions, Firebase setup, the audio pipeline and the WebRTC upgrade
path are in **[docs/SETUP.md](docs/SETUP.md)**.

## Privacy

BabyPhone streams a live microphone/camera. Use it only with the **knowledge and
consent** of everyone being monitored (household / baby-monitor use). The Android
foreground-service notification is required and must stay visible.

## Status

Starter scaffold — auth, contact list, online presence, and audio/video stream
signaling are wired end to end. The native mic→WebSocket bridge and (optional)
WebRTC media path are stubbed with clear TODOs in `docs/SETUP.md`.
