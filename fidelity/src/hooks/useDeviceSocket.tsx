/**
 * useDeviceSocket
 *
 * Hook per la connessione WebSocket dei dispositivi display.
 * Gestisce autenticazione, heartbeat e invio stato slide.
 *
 * FIX: evita reconnect/disconnect continui rendendo stabile l'effetto di connessione.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import type {
  DeviceAuthErrorPayload,
  DeviceAuthSuccessPayload,
  DeviceHeartbeatAckPayload,
  DeviceSlideChangePayload,
} from "../../lib/types";

interface UseDeviceSocketOptions {
  token: string | null;
  heartbeatInterval?: number; // ms, default 5000
  onAuthError?: (message: string) => void;
}

interface UseDeviceSocketReturn {
  isConnected: boolean;
  isAuthenticated: boolean;
  latencyMs: number | null;
  deviceId: string | null;
  sendSlideChange: (
    slideIndex: number,
    totalSlides: number,
    slideName?: string,
    slideUrl?: string
  ) => void;
}

const DEFAULT_HEARTBEAT_INTERVAL = 5000; // 5s

export function useDeviceSocket(options: UseDeviceSocketOptions): UseDeviceSocketReturn {
  const { token, heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL, onAuthError } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * IMPORTANTISSIMO:
   * Non mettere `onAuthError` nelle deps del useEffect di connessione,
   * altrimenti ogni render crea una funzione nuova => effetto riparte => disconnect/reconnect.
   * Quindi la teniamo in una ref aggiornata.
   */
  const onAuthErrorRef = useRef<UseDeviceSocketOptions["onAuthError"]>(onAuthError);
  useEffect(() => {
    onAuthErrorRef.current = onAuthError;
  }, [onAuthError]);

  /**
   * Stessa cosa per heartbeatInterval: lo vogliamo sempre aggiornabile,
   * ma NON deve far ripartire l'effetto di connessione.
   */
  const heartbeatIntervalRefValue = useRef<number>(heartbeatInterval);
  useEffect(() => {
    heartbeatIntervalRefValue.current = heartbeatInterval;
  }, [heartbeatInterval]);

  /**
   * cleanup stabile: chiude interval + socket.
   * NON dipende da props o state, quindi non cambia mai.
   */
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  /**
   * Calcolo URL socket in modo deterministicamente stabile.
   * (Non è strettamente necessario, ma aiuta a non ricostruire roba inutilmente)
   */
  const socketUrl = useMemo(() => {
    // Build WebSocket URL
    let url =
      (window as unknown as { __WS_URL__?: string }).__WS_URL__ || import.meta.env.VITE_WS_URL;

    if (!url) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      url = `${protocol}//${window.location.hostname}:3400`;
    }

    // Remove /api suffix if present
    if (url.endsWith("/api")) url = url.slice(0, -4);

    return url;
  }, []);

  /**
   * EFFETTO DI CONNESSIONE: dipende SOLO dal token.
   * - Se token cambia: ricreo la sessione socket.
   * - Se token è nullo: cleanup e reset stati.
   *
   * Questo è il fix principale.
   */
  useEffect(() => {
    // Se manca token -> reset e chiusura
    if (!token) {
      cleanup();
      setIsConnected(false);
      setIsAuthenticated(false);
      setDeviceId(null);
      setLatencyMs(null);
      return;
    }

    // Evita doppia connessione se per qualche motivo l'effetto viene rieseguito
    // (React StrictMode in dev può montare/smontare per testare side effects)
    if (socketRef.current) {
      return;
    }

    console.log("[DeviceSocket] Connecting to:", socketUrl, "token:", `${token.slice(0, 8)  }...`);

    const socket = io(socketUrl, {
      transports: ["websocket"],
      forceNew: true,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      autoConnect: true,
      query: { deviceToken: token },
    });

    socketRef.current = socket;

    // --- Connection events
    socket.on("connect", () => {
      console.log("[DeviceSocket] Connected:", socket.id);
      setIsConnected(true);
    });

    socket.on("connect_error", (error: Error) => {
      console.error("[DeviceSocket] Connection error:", error);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on("disconnect", (reason: string) => {
      console.log("[DeviceSocket] Disconnected:", reason);
      setIsConnected(false);
      setIsAuthenticated(false);

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    });

    // --- Auth events
    socket.on("device:auth-success", (payload: DeviceAuthSuccessPayload) => {
      console.log("[DeviceSocket] Authenticated:", payload.deviceName);

      setIsAuthenticated(true);
      setDeviceId(payload.deviceId);

      // reset heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // send first heartbeat immediately
      socket.emit("device:heartbeat", { timestamp: Date.now() });

      // start heartbeat loop with latest interval value
      heartbeatIntervalRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit("device:heartbeat", { timestamp: Date.now() });
        }
      }, heartbeatIntervalRefValue.current);
    });

    socket.on("device:auth-error", (payload: DeviceAuthErrorPayload) => {
      console.error("[DeviceSocket] Auth error:", payload.message);
      setIsAuthenticated(false);
      setDeviceId(null);

      // usa la ref (non dipendenza)
      onAuthErrorRef.current?.(payload.message);
    });

    // --- Heartbeat ack
    socket.on("device:heartbeat-ack", (payload: DeviceHeartbeatAckPayload) => {
      setLatencyMs(payload.latencyMs);
    });

    // Cleanup se token cambia o unmount
    return cleanup;
  }, [token, socketUrl, cleanup]);

  /**
   * sendSlideChange: funzione stabile che usa ref e uno state.
   * Qui va bene dipendere da isAuthenticated perché è uno stato interno,
   * e NON fa ripartire l’effetto di connessione.
   */
  const sendSlideChange = useCallback(
    (slideIndex: number, totalSlides: number, slideName?: string, slideUrl?: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      if (!isAuthenticated) return;

      const payload: DeviceSlideChangePayload = {
        slideIndex,
        totalSlides,
        slideName,
        slideUrl,
      };

      socket.emit("device:slide-change", payload);
    },
    [isAuthenticated]
  );

  /**
   * Disconnect su unload: opzionale.
   * In generale basta il cleanup su unmount,
   * ma tenerlo non fa male se vuoi essere esplicito.
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return {
    isConnected,
    isAuthenticated,
    latencyMs,
    deviceId,
    sendSlideChange,
  };
}

export default useDeviceSocket;
