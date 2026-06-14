import { useEffect, useRef } from 'react';
import { startMicCapture, stopMicCapture, onAudioChunk } from './micBridge';
import { requestStreamingPermissions } from './permissions';
import type { WebSocketMessage } from './websocket';

interface Args {
  subscribe: (h: (m: WebSocketMessage) => void) => () => void;
  sendMessage: (m: WebSocketMessage) => void;
  onActiveChange?: (active: boolean) => void;
}

/**
 * Caregiver-side glue: when the parent starts listening, the server forwards a
 * START_AUDIO_STREAM frame to this device. We then:
 *   1. ask for mic permission,
 *   2. start the foreground capture service,
 *   3. forward each base64 PCM chunk back as AUDIO_CHUNK { streamId, audio }.
 * STOP_STREAM (or unmount) tears the capture down.
 */
export function useCaregiverStream({
  subscribe,
  sendMessage,
  onActiveChange,
}: Args) {
  const streamIdRef = useRef<string | null>(null);
  const chunkUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stop = async () => {
      if (!streamIdRef.current) return;
      streamIdRef.current = null;
      chunkUnsubRef.current?.();
      chunkUnsubRef.current = null;
      await stopMicCapture();
      onActiveChange?.(false);
    };

    const unsub = subscribe(async (msg) => {
      if (msg.type === 'START_AUDIO_STREAM') {
        const granted = await requestStreamingPermissions(false);
        if (!granted) {
          sendMessage({
            type: 'STREAM_ERROR',
            streamId: msg.streamId,
            message: 'Microphone permission denied',
          });
          return;
        }

        streamIdRef.current = msg.streamId;
        // Forward every captured chunk to the parent.
        chunkUnsubRef.current = onAudioChunk((audio) => {
          if (streamIdRef.current) {
            sendMessage({
              type: 'AUDIO_CHUNK',
              streamId: streamIdRef.current,
              audio,
            });
          }
        });

        await startMicCapture();
        onActiveChange?.(true);
      } else if (msg.type === 'STOP_STREAM') {
        await stop();
      }
    });

    return () => {
      unsub();
      stop();
    };
  }, [subscribe, sendMessage, onActiveChange]);
}
