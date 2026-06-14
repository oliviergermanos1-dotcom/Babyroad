import { useEffect, useRef, useState, useCallback } from 'react';
import { auth } from './firebase';
import { WS_URL } from './config';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

type Handler = (msg: WebSocketMessage) => void;

/**
 * Thin WebSocket hook that:
 *  - connects once the user is authenticated,
 *  - sends an AUTH frame with the Firebase ID token,
 *  - auto-reconnects with backoff,
 *  - lets callers subscribe to incoming messages.
 */
export const useWebSocket = (role: 'parent' | 'caregiver' = 'parent') => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<Handler>>(new Set());
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const closedByUs = useRef(false);

  const connect = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      console.log('[WS] Connected');
      attemptsRef.current = 0;
      setIsConnected(true);
      const idToken = await user.getIdToken();
      ws.send(
        JSON.stringify({
          type: 'AUTH',
          token: idToken,
          role,
          deviceId: `device_${user.uid}`,
        })
      );
    };

    ws.onmessage = (event) => {
      let msg: WebSocketMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handlersRef.current.forEach((h) => h(msg));
    };

    ws.onerror = (e) => {
      console.warn('[WS] error', e);
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setIsConnected(false);
      if (!closedByUs.current) {
        const delay = Math.min(1000 * 2 ** attemptsRef.current, 16000);
        attemptsRef.current += 1;
        reconnectRef.current = setTimeout(connect, delay);
      }
    };
  }, [role]);

  useEffect(() => {
    closedByUs.current = false;
    connect();
    return () => {
      closedByUs.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('[WS] not open, dropping', message.type);
    }
  }, []);

  const subscribe = useCallback((handler: Handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  return { isConnected, sendMessage, subscribe };
};
