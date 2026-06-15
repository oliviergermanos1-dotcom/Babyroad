import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { auth } from './firebase';
import { WS_URL } from './config';
import type { WebSocketMessage } from './websocket';

type Handler = (m: WebSocketMessage) => void;

interface Ctx {
  isConnected: boolean;
  sendMessage: (m: WebSocketMessage) => void;
  subscribe: (h: Handler) => () => void;
}

const WSContext = createContext<Ctx>({
  isConnected: false,
  sendMessage: () => {},
  subscribe: () => () => {},
});

export const useWS = () => useContext(WSContext);

/**
 * Single shared WebSocket for the whole authenticated app. Mounting one
 * connection (instead of one per screen) avoids the previous bug where each
 * screen re-authenticated under the same uid and the server overwrote the
 * connection, so START_AUDIO_STREAM and its responses landed on different
 * sockets and never reached the caregiver.
 */
export const WebSocketProvider: React.FC<{
  role: 'parent' | 'caregiver';
  children: React.ReactNode;
}> = ({ role, children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlers = useRef<Set<Handler>>(new Set());
  const reconnect = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  const closedByUs = useRef(false);

  const connect = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      attempts.current = 0;
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
      handlers.current.forEach((h) => h(msg));
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      setIsConnected(false);
      if (!closedByUs.current) {
        const delay = Math.min(1000 * 2 ** attempts.current, 16000);
        attempts.current += 1;
        reconnect.current = setTimeout(connect, delay);
      }
    };
  }, [role]);

  useEffect(() => {
    closedByUs.current = false;
    connect();
    return () => {
      closedByUs.current = true;
      if (reconnect.current) clearTimeout(reconnect.current);
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
    handlers.current.add(handler);
    return () => handlers.current.delete(handler);
  }, []);

  return (
    <WSContext.Provider value={{ isConnected, sendMessage, subscribe }}>
      {children}
    </WSContext.Provider>
  );
};
