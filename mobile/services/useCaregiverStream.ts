import { useEffect, useRef } from 'react';
import { startMicCapture, stopMicCapture, onAudioChunk } from './micBridge';
import { startCamera, stopCamera, onVideoFrame } from './cameraBridge';
import {
  requestStreamingPermissions,
  requestCameraPermission,
} from './permissions';
import type { WebSocketMessage } from './websocket';

interface Args {
  subscribe: (h: (m: WebSocketMessage) => void) => () => void;
  sendMessage: (m: WebSocketMessage) => void;
  onActiveChange?: (active: boolean) => void;
}

/**
 * Caregiver-side glue. When the parent starts listening/watching, the server
 * forwards START_AUDIO_STREAM / START_VIDEO_STREAM to this device. We then:
 *   - ask for the relevant permission,
 *   - start native capture (mic foreground service / camera),
 *   - forward AUDIO_CHUNK / VIDEO_FRAME frames tagged with their streamId.
 * STOP_STREAM (matched by streamId) or unmount tears the matching capture down.
 * Audio and video are independent — either can run alone or both together.
 */
export function useCaregiverStream({
  subscribe,
  sendMessage,
  onActiveChange,
}: Args) {
  const audioIdRef = useRef<string | null>(null);
  const videoIdRef = useRef<string | null>(null);
  const audioUnsubRef = useRef<(() => void) | null>(null);
  const videoUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const notify = () =>
      onActiveChange?.(!!audioIdRef.current || !!videoIdRef.current);

    const stopAudio = async () => {
      if (!audioIdRef.current) return;
      audioIdRef.current = null;
      audioUnsubRef.current?.();
      audioUnsubRef.current = null;
      await stopMicCapture();
      notify();
    };

    const stopVideo = async () => {
      if (!videoIdRef.current) return;
      videoIdRef.current = null;
      videoUnsubRef.current?.();
      videoUnsubRef.current = null;
      await stopCamera();
      notify();
    };

    const unsub = subscribe(async (msg) => {
      switch (msg.type) {
        case 'START_AUDIO_STREAM': {
          const granted = await requestStreamingPermissions(false);
          if (!granted) {
            sendMessage({
              type: 'STREAM_ERROR',
              streamId: msg.streamId,
              message: 'Microphone permission denied',
            });
            return;
          }
          audioIdRef.current = msg.streamId;
          audioUnsubRef.current = onAudioChunk((audio) => {
            if (audioIdRef.current) {
              sendMessage({ type: 'AUDIO_CHUNK', streamId: audioIdRef.current, audio });
            }
          });
          await startMicCapture();
          notify();
          break;
        }

        case 'START_VIDEO_STREAM': {
          const granted = await requestCameraPermission();
          if (!granted) {
            sendMessage({
              type: 'STREAM_ERROR',
              streamId: msg.streamId,
              message: 'Camera permission denied',
            });
            return;
          }
          videoIdRef.current = msg.streamId;
          videoUnsubRef.current = onVideoFrame((frame) => {
            if (videoIdRef.current) {
              sendMessage({ type: 'VIDEO_FRAME', streamId: videoIdRef.current, frame });
            }
          });
          await startCamera();
          notify();
          break;
        }

        case 'STOP_STREAM': {
          if (msg.streamId === audioIdRef.current) await stopAudio();
          if (msg.streamId === videoIdRef.current) await stopVideo();
          break;
        }
      }
    });

    return () => {
      unsub();
      stopAudio();
      stopVideo();
    };
  }, [subscribe, sendMessage, onActiveChange]);
}
