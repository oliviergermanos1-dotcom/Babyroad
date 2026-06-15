// WebSocket server URL.
//
// Default = the deployed Railway backend (works from any phone, anywhere).
// Override with EXPO_PUBLIC_WS_URL if you run the server locally, e.g.:
//   - Android emulator: ws://10.0.2.2:5000
//   - iOS simulator:    ws://localhost:5000
//   - real device + LAN server: ws://<your-machine-LAN-IP>:5000
//
// Note: must be the wss:// (TLS) scheme for the deployed server, NOT https://.
export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ||
  'wss://babyroad-production.up.railway.app';
