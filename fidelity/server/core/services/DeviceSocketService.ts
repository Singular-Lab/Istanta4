/**
 * DeviceSocketService
 *
 * Gestisce lo stato real-time dei dispositivi punto vendita via WebSocket.
 * Responsabilità:
 * - Autenticazione dispositivi tramite token
 * - Gestione stato in-memory (ping, slide corrente)
 * - Routing eventi tra dispositivi e UI di gestione
 */

import type { Server as IOServer, Socket } from 'socket.io';
import { PuntoVenditaService } from './PuntoVenditaService.js';
import type { DispositivoPuntoVenditaResponseDTO } from '../dto/PuntoVenditaDTO.js';
import type { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService.js';
import { log } from '../logger';

/* ======================================================
 * TYPES
 * ====================================================== */

export interface DeviceRealtimeState {
  deviceId: string;
  socketId: string;
  pvId: string;
  gdoId: string;
  deviceName: string;
  currentSlideIndex: number;
  totalSlides: number;
  slideName?: string;
  slideUrl?: string;
  lastPingMs: number;
  lastHeartbeat: Date;
  isConnected: boolean;
}

export interface DeviceHeartbeatPayload {
  timestamp: number;
}

export interface DeviceSlideChangePayload {
  slideIndex: number;
  totalSlides: number;
  slideName?: string;
  slideUrl?: string;
}

export interface DeviceAuthSuccessPayload {
  deviceId: string;
  deviceName: string;
  serverTime: number;
}

export interface DeviceHeartbeatAckPayload {
  timestamp: number;
  serverTimestamp: number;
  latencyMs: number;
}

export interface PVDeviceStatusPayload {
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  latencyMs?: number;
  currentSlideIndex?: number;
  totalSlides?: number;
  slideName?: string;
  slideUrl?: string;
  lastUpdate: number;
}

export interface PVSubscribePayload {
  pvId: string;
}

/* ======================================================
 * SERVICE
 * ====================================================== */

class DeviceSocketService {
  private io: IOServer | null = null;
  private puntoVenditaService: IPuntoVenditaService;

  // In-memory state maps
  private deviceStates: Map<string, DeviceRealtimeState> = new Map();
  private socketToDevice: Map<string, string> = new Map(); // socketId -> deviceId

  constructor() {
    this.puntoVenditaService = new PuntoVenditaService({} as any);
  }

  /**
   * Inizializza il service con l'istanza Socket.IO
   */
  initialize(io: IOServer): void {
    this.io = io;
    log.info('DeviceSocketService inizializzato');
  }

  /**
   * Autentica un dispositivo tramite token
   */
  async authenticateDevice(token: string): Promise<DispositivoPuntoVenditaResponseDTO | null> {
    if (!token) return null;

    try {
      const device = await this.puntoVenditaService.getDispositivoByToken(token);
      if (!device) {
        log.warn('Autenticazione dispositivo fallita: token non valido o non trovato');
        return null;
      }

      if (!device.is_active) {
        log.warn('Autenticazione dispositivo fallita: dispositivo disattivato', { deviceId: device.id, deviceName: device.nome });
        return null;
      }

      return device;
    } catch (error) {
      log.error('Errore durante l\'autenticazione del dispositivo', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Gestisce la connessione di un dispositivo
   */
  handleDeviceConnect(socket: Socket, device: DispositivoPuntoVenditaResponseDTO): void {
    const pvId = device.id_puntivendita;
    const gdoId = (device.puntoVendita as any)?.id_gdo || '';

    // Crea stato iniziale
    const state: DeviceRealtimeState = {
      deviceId: device.id,
      socketId: socket.id,
      pvId,
      gdoId,
      deviceName: device.nome,
      currentSlideIndex: 0,
      totalSlides: 0,
      lastPingMs: 0,
      lastHeartbeat: new Date(),
      isConnected: true,
    };

    this.deviceStates.set(device.id, state);
    this.socketToDevice.set(socket.id, device.id);

    // Join room del punto vendita
    socket.join(`pv:${pvId}`);

    // Notifica auth success al dispositivo
    const authPayload: DeviceAuthSuccessPayload = {
      deviceId: device.id,
      deviceName: device.nome,
      serverTime: Date.now(),
    };
    socket.emit('device:auth-success', authPayload);

    // Notifica agli iscritti del PV
    this.emitToPV(pvId, 'pv:device-connected', {
      deviceId: device.id,
      deviceName: device.nome,
      isConnected: true,
      lastUpdate: Date.now(),
    } as PVDeviceStatusPayload);

    log.info('Dispositivo connesso', { deviceName: device.nome, deviceId: device.id, pvId });
  }

  /**
   * Gestisce l'heartbeat da un dispositivo
   */
  handleDeviceHeartbeat(socket: Socket, payload: DeviceHeartbeatPayload): void {
    const deviceId = this.socketToDevice.get(socket.id);
    if (!deviceId) return;

    const state = this.deviceStates.get(deviceId);
    if (!state) return;

    const serverTimestamp = Date.now();
    const latencyMs = Math.max(0, Math.floor((serverTimestamp - payload.timestamp) / 2));

    // Aggiorna stato
    state.lastPingMs = latencyMs;
    state.lastHeartbeat = new Date();

    // Acknowledge al dispositivo
    const ackPayload: DeviceHeartbeatAckPayload = {
      timestamp: payload.timestamp,
      serverTimestamp,
      latencyMs,
    };
    socket.emit('device:heartbeat-ack', ackPayload);

    // Notifica agli iscritti del PV
    this.emitToPV(state.pvId, 'pv:device-heartbeat', {
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      latencyMs,
      isConnected: true,
      lastUpdate: serverTimestamp,
    } as PVDeviceStatusPayload);

    // Aggiorna anche last_seen_at nel database (fire and forget)
    this.puntoVenditaService.deviceHeartbeat(
      this.getTokenFromSocket(socket),
      undefined
    ).catch(() => {});
  }

  /**
   * Gestisce il cambio slide da un dispositivo
   */
  handleDeviceSlideChange(socket: Socket, payload: DeviceSlideChangePayload): void {
    const deviceId = this.socketToDevice.get(socket.id);
    if (!deviceId) return;

    const state = this.deviceStates.get(deviceId);
    if (!state) return;

    // Aggiorna stato
    state.currentSlideIndex = payload.slideIndex;
    state.totalSlides = payload.totalSlides;
    state.slideName = payload.slideName;
    state.slideUrl = payload.slideUrl;

    // Notifica agli iscritti del PV
    this.emitToPV(state.pvId, 'pv:device-slide-update', {
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      currentSlideIndex: payload.slideIndex,
      totalSlides: payload.totalSlides,
      slideName: payload.slideName,
      slideUrl: payload.slideUrl,
      isConnected: true,
      lastUpdate: Date.now(),
    } as PVDeviceStatusPayload);
  }

  /**
   * Gestisce la disconnessione di un dispositivo
   */
  handleDeviceDisconnect(socket: Socket): void {
    const deviceId = this.socketToDevice.get(socket.id);
    if (!deviceId) return;

    const state = this.deviceStates.get(deviceId);
    if (state) {
      // Notifica agli iscritti del PV
      this.emitToPV(state.pvId, 'pv:device-disconnected', {
        deviceId: state.deviceId,
        deviceName: state.deviceName,
        isConnected: false,
        lastUpdate: Date.now(),
      } as PVDeviceStatusPayload);

      log.info('Dispositivo disconnesso', { deviceName: state.deviceName, deviceId });
    }

    // Cleanup
    this.deviceStates.delete(deviceId);
    this.socketToDevice.delete(socket.id);
  }

  /**
   * Iscrive un socket UI agli aggiornamenti di un punto vendita
   */
  subscribeToPV(socket: Socket, payload: PVSubscribePayload): void {
    const { pvId } = payload;
    socket.join(`pv:${pvId}`);

    // Invia stato corrente di tutti i dispositivi del PV
    const currentStatuses = this.getDeviceStatusForPV(pvId);
    socket.emit('pv:initial-status', currentStatuses);

    log.debug('Socket UI iscritto agli aggiornamenti del punto vendita', { socketId: socket.id, pvId });
  }

  /**
   * Disiscrive un socket UI dagli aggiornamenti di un punto vendita
   */
  unsubscribeFromPV(socket: Socket, payload: PVSubscribePayload): void {
    const { pvId } = payload;
    socket.leave(`pv:${pvId}`);
    log.debug('Socket UI disiscritto dagli aggiornamenti del punto vendita', { socketId: socket.id, pvId });
  }

  /**
   * Ottiene lo stato di tutti i dispositivi di un punto vendita
   */
  getDeviceStatusForPV(pvId: string): PVDeviceStatusPayload[] {
    const statuses: PVDeviceStatusPayload[] = [];

    for (const state of this.deviceStates.values()) {
      if (state.pvId === pvId) {
        statuses.push({
          deviceId: state.deviceId,
          deviceName: state.deviceName,
          isConnected: state.isConnected,
          latencyMs: state.lastPingMs,
          currentSlideIndex: state.currentSlideIndex,
          totalSlides: state.totalSlides,
          slideName: state.slideName,
          slideUrl: state.slideUrl,
          lastUpdate: state.lastHeartbeat.getTime(),
        });
      }
    }

    return statuses;
  }

  /**
   * Emette un evento a tutti gli iscritti di un punto vendita
   */
  private emitToPV(pvId: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(`pv:${pvId}`).emit(event, data);
  }

  /**
   * Estrae il token dal socket (passato come query param)
   */
  private getTokenFromSocket(socket: Socket): string {
    return (socket.handshake.query.deviceToken as string) || '';
  }

  /**
   * Verifica se un socket è un dispositivo autenticato
   */
  isDeviceSocket(socketId: string): boolean {
    return this.socketToDevice.has(socketId);
  }

  /**
   * Ottiene statistiche per debug
   */
  getStats(): { connectedDevices: number; pvRooms: number } {
    const pvRooms = new Set<string>();
    for (const state of this.deviceStates.values()) {
      pvRooms.add(state.pvId);
    }
    return {
      connectedDevices: this.deviceStates.size,
      pvRooms: pvRooms.size,
    };
  }
}

// Singleton instance
export const deviceSocketService = new DeviceSocketService();
