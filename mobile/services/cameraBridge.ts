import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// CameraModule is the Kotlin native module (android/.../CameraModule.kt).
const { CameraModule } = NativeModules as {
  CameraModule?: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
  };
};

const emitter =
  CameraModule && Platform.OS === 'android'
    ? new NativeEventEmitter(CameraModule as any)
    : null;

export const cameraBridgeAvailable =
  !!CameraModule && Platform.OS === 'android';

/** Start camera capture (caregiver device). */
export async function startCamera(): Promise<boolean> {
  if (!CameraModule) {
    console.warn('[cameraBridge] native CameraModule unavailable');
    return false;
  }
  return CameraModule.start();
}

/** Stop camera capture and release the device. */
export async function stopCamera(): Promise<boolean> {
  if (!CameraModule) return false;
  return CameraModule.stop();
}

/** Subscribe to base64 JPEG frames. Returns an unsubscribe function. */
export function onVideoFrame(cb: (base64: string) => void): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('VideoFrame', cb);
  return () => sub.remove();
}
