// Injecte les permissions GPS arrière-plan dans le manifest généré par
// Capacitor (cap add android). Idempotent : ne duplique pas si déjà là.
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'android/app/src/main/AndroidManifest.xml';
let xml = readFileSync(PATH, 'utf8');

const PERMS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
];

const lines = PERMS
  .filter((p) => !xml.includes(`"${p}"`))
  .map((p) => `    <uses-permission android:name="${p}" />`)
  .join('\n');

if (lines) {
  // insère juste après la balise <manifest ...>
  xml = xml.replace(/(<manifest[^>]*>)/, `$1\n${lines}`);
  writeFileSync(PATH, xml);
  console.log('✓ Permissions GPS arrière-plan ajoutées au manifest');
} else {
  console.log('✓ Permissions déjà présentes');
}
