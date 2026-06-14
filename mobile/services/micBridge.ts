import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// MicModule is the Kotlin native module (android/.../MicModule.kt).
const { MicModule } = NativeModules as {
  MicModule?: {
    startCapture: () => Promise<boolean>;
    stopCapture: () => Promise<boolean>;
  };
};

const emitter =
  MicModule && Platform.OS === 'android'
    ? new NativeEventEmitter(MicModule as any)
    : null;

export const micBridgeAvailable = !!MicModule && Platform.OS === 'android';

/** Start the foreground mic service (caregiver device). */
export async function startMicCapture(): Promise<boolean> {
  if (!MicModule) {
    console.warn('[micBridge] native MicModule unavailable on this platform');
    return false;
  }
  return MicModule.startCapture();
}

/** Stop the foreground mic service. */
export async function stopMicCapture(): Promise<boolean> {
  if (!MicModule) return false;
  return MicModule.stopCapture();
}

/**
 * Subscribe to base64 PCM chunks emitted by the native service.
 * Returns an unsubscribe function.
 */
export function onAudioChunk(cb: (base64: string) => void): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('AudioChunk', cb);
  return () => sub.remove();
}
