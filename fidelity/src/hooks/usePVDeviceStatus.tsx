/**
 * usePVDeviceStatus
 *
 * Hook per la subscription real-time agli aggiornamenti dei dispositivi
 * di un punto vendita dalla pagina di gestione.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PVDeviceStatusPayload } from '../../lib/types';
import { useSocket } from './useSocket';

/* ======================================================
 * TYPES
 * ====================================================== */

interface DeviceRealtimeStatus {
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  latencyMs: number | null;
  currentSlideIndex: number | null;
  totalSlides: number | null;
  slideName: string | null;
  slideUrl: string | null;
  lastUpdate: Date;
}

type DeviceStatusMap = Record<string, DeviceRealtimeStatus>;

interface UsePVDeviceStatusReturn {
  /** Map of device statuses keyed by deviceId */
  deviceStatuses: DeviceStatusMap;
  /** Check if a specific device is connected via WebSocket */
  isDeviceConnectedRealtime: (deviceId: string) => boolean;
  /** Get real-time status for a specific device */
  getDeviceStatus: (deviceId: string) => DeviceRealtimeStatus | null;
  /** Whether the subscription is active */
  isSubscribed: boolean;
}

/* ======================================================
 * CONSTANTS
 * ====================================================== */

// Se non riceviamo heartbeat per 15s → offline
const OFFLINE_TIMEOUT_MS = 15_000;
const TIMEOUT_CHECK_INTERVAL_MS = 2_000;

/* ======================================================
 * HOOK
 * ====================================================== */

export function usePVDeviceStatus(pvId: string | null): UsePVDeviceStatusReturn {
  const socket = useSocket();

  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatusMap>({});
  const [isSubscribed, setIsSubscribed] = useState(false);

  /* ======================================================
   * TIMEOUT CHECK (FAILSAFE)
   * ====================================================== */

  useEffect(() => {
    if (!isSubscribed) return;

    const intervalId = setInterval(() => {
      const now = Date.now();

      setDeviceStatuses(prev => {
        let hasChanges = false;
        const next: DeviceStatusMap = { ...prev };

        Object.entries(next).forEach(([deviceId, status]) => {
          if (!status.isConnected) return;

          const diff = now - status.lastUpdate.getTime();
          if (diff > OFFLINE_TIMEOUT_MS) {
            next[deviceId] = {
              ...status,
              isConnected: false,
              lastUpdate: new Date(now),
            };
            hasChanges = true;

            console.log(
              `[PVDeviceStatus] Device ${status.deviceName} timed out (${diff}ms)`
            );
          }
        });

        return hasChanges ? next : prev;
      });
    }, TIMEOUT_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isSubscribed]);

  /* ======================================================
   * HANDLE DEVICE STATUS (UNIFICATO)
   * ====================================================== */

  const handleDeviceStatus = useCallback((payload: PVDeviceStatusPayload) => {
    setDeviceStatuses(prev => {
      const existing = prev[payload.deviceId];

      return {
        ...prev,
        [payload.deviceId]: {
          deviceId: payload.deviceId,
          deviceName: payload.deviceName,
          isConnected: payload.isConnected,
          latencyMs: payload.latencyMs ?? existing?.latencyMs ?? null,
          currentSlideIndex:
            payload.currentSlideIndex ?? existing?.currentSlideIndex ?? null,
          totalSlides:
            payload.totalSlides ?? existing?.totalSlides ?? null,
          slideName: payload.slideName ?? existing?.slideName ?? null,
          slideUrl: payload.slideUrl ?? existing?.slideUrl ?? null,
          lastUpdate: new Date(payload.lastUpdate),
        },
      };
    });
  }, []);

  /* ======================================================
   * INITIAL STATUS (BULK)
   * ====================================================== */

  const handleInitialStatus = useCallback((statuses: PVDeviceStatusPayload[]) => {
    const map: DeviceStatusMap = {};

    statuses.forEach(payload => {
      map[payload.deviceId] = {
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        isConnected: payload.isConnected,
        latencyMs: payload.latencyMs ?? null,
        currentSlideIndex: payload.currentSlideIndex ?? null,
        totalSlides: payload.totalSlides ?? null,
        slideName: payload.slideName ?? null,
        slideUrl: payload.slideUrl ?? null,
        lastUpdate: new Date(payload.lastUpdate),
      };
    });

    setDeviceStatuses(map);
  }, []);

  /* ======================================================
   * SOCKET SUBSCRIPTION
   * ====================================================== */

  useEffect(() => {
    if (!socket || !pvId) {
      setIsSubscribed(false);
      return;
    }

    console.log('[PVDeviceStatus] Subscribing to PV:', pvId);

    socket.emit('pv:subscribe', { pvId });
    setIsSubscribed(true);

    socket.on('pv:initial-status', handleInitialStatus);
    socket.on('pv:device-connected', handleDeviceStatus);
    socket.on('pv:device-disconnected', handleDeviceStatus);
    socket.on('pv:device-heartbeat', handleDeviceStatus);
    socket.on('pv:device-slide-update', handleDeviceStatus);

    return () => {
      console.log('[PVDeviceStatus] Unsubscribing from PV:', pvId);

      socket.emit('pv:unsubscribe', { pvId });
      setIsSubscribed(false);

      socket.off('pv:initial-status', handleInitialStatus);
      socket.off('pv:device-connected', handleDeviceStatus);
      socket.off('pv:device-disconnected', handleDeviceStatus);
      socket.off('pv:device-heartbeat', handleDeviceStatus);
      socket.off('pv:device-slide-update', handleDeviceStatus);

      setDeviceStatuses({});
    };
  }, [socket, pvId, handleDeviceStatus, handleInitialStatus]);

  /* ======================================================
   * HELPERS
   * ====================================================== */

  const isDeviceConnectedRealtime = useCallback(
    (deviceId: string): boolean => {
      return deviceStatuses[deviceId]?.isConnected ?? false;
    },
    [deviceStatuses]
  );

  const getDeviceStatus = useCallback(
    (deviceId: string): DeviceRealtimeStatus | null => {
      return deviceStatuses[deviceId] ?? null;
    },
    [deviceStatuses]
  );

  return useMemo(
    () => ({
      deviceStatuses,
      isDeviceConnectedRealtime,
      getDeviceStatus,
      isSubscribed,
    }),
    [deviceStatuses, isDeviceConnectedRealtime, getDeviceStatus, isSubscribed]
  );
}

export default usePVDeviceStatus;
