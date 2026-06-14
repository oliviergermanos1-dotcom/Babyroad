import { Platform } from 'react-native';

// WebSocket server URL.
// - Android emulator reaches your host machine via 10.0.2.2
// - iOS simulator can use localhost
// - On a real device, use your machine's LAN IP or the deployed URL.
// Override with your deployed backend (e.g. wss://babyphone.up.railway.app).
const DEV_WS = Platform.OS === 'android' ? 'ws://10.0.2.2:5000' : 'ws://localhost:5000';

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL || DEV_WS;
