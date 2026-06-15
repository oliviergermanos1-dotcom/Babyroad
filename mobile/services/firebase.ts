import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase web config for project "BabyPhone" (babyphone-3489d).
// Note: the apiKey is NOT a secret — it is meant to be shipped in the client.
// Security comes from Realtime Database rules + Auth, not from hiding this value.
const firebaseConfig = {
  apiKey: 'AIzaSyCFpMK8dyMHwYKqR-GmICIJiGelBhDSgC8',
  authDomain: 'babyphone-3489d.firebaseapp.com',
  projectId: 'babyphone-3489d',
  storageBucket: 'babyphone-3489d.firebasestorage.app',
  messagingSenderId: '1006085209778',
  appId: '1:1006085209778:web:9e07999d1878e8ca3f53ab',
  // Realtime Database URL — shown at the top of the Realtime Database page.
  // Confirm this matches the region you created (europe-west1 here).
  databaseURL:
    'https://babyphone-3489d-default-rtdb.europe-west1.firebasedatabase.app',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
