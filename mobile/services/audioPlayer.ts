import { NativeModules, Platform } from 'react-native';

// AudioPlayerModule is the Kotlin native module (android/.../AudioPlayerModule.kt).
const { AudioPlayerModule } = NativeModules as {
  AudioPlayerModule?: {
    start: () => Promise<boolean>;
    playChunk: (base64: string) => void;
    stop: () => Promise<boolean>;
  };
};

export const audioPlayerAvailable =
  !!AudioPlayerModule && Platform.OS === 'android';

/** Open the AudioTrack and begin playback (parent device). */
export async function startPlayback(): Promise<boolean> {
  if (!AudioPlayerModule) {
    console.warn('[audioPlayer] native AudioPlayerModule unavailable');
    return false;
  }
  return AudioPlayerModule.start();
}

/** Feed one base64-encoded PCM-16 chunk to the player. */
export function playChunk(base64: string): void {
  AudioPlayerModule?.playChunk(base64);
}

/** Stop playback and release the AudioTrack. */
export async function stopPlayback(): Promise<boolean> {
  if (!AudioPlayerModule) return false;
  return AudioPlayerModule.stop();
}
