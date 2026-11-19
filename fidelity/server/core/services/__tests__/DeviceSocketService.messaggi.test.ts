import type { Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { DispositivoPuntoVenditaResponseDTO } from '../../dto/PuntoVenditaDTO';
import { deviceSocketService } from '../DeviceSocketService';
import { PuntoVenditaService } from '../PuntoVenditaService';

/**
 * Spec processi-in-produzione, "Richieste e messaggi malformati non fermano Fidelity": i messaggi
 * del canale in tempo reale si gestiscono nel primary, e quelli senza dati validi si ignorano.
 */

let prossimo = 0;
function socketFinto() {
  prossimo++;
  return {
    id: `s${prossimo}`,
    handshake: { query: { deviceToken: 'token-dispositivo' } },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
  };
}

const come = (socket: ReturnType<typeof socketFinto>) => socket as unknown as Socket;

function dispositivoCollegato() {
  const socket = socketFinto();
  const dispositivo = { id: `d-${socket.id}`, id_puntivendita: 'pv-1', nome: 'Totem cassa', is_active: true } as unknown as DispositivoPuntoVenditaResponseDTO;
  deviceSocketService.handleDeviceConnect(come(socket), dispositivo);
  socket.emit.mockClear();
  return socket;
}

describe('DeviceSocketService: messaggi senza dati validi', () => {
  it('iscrizione a un punto vendita senza dati: ignorata, nessun errore', () => {
    const socket = socketFinto();

    expect(() => deviceSocketService.subscribeToPV(come(socket), undefined)).not.toThrow();
    expect(() => deviceSocketService.subscribeToPV(come(socket), { pvId: 42 } as never)).not.toThrow();
    expect(() => deviceSocketService.unsubscribeFromPV(come(socket), undefined)).not.toThrow();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('iscrizione valida: entra nella stanza del punto vendita e riceve lo stato attuale', () => {
    const socket = socketFinto();

    deviceSocketService.subscribeToPV(come(socket), { pvId: 'pv-9' });

    expect(socket.join).toHaveBeenCalledWith('pv:pv-9');
    expect(socket.emit).toHaveBeenCalledWith('pv:initial-status', []);
  });

  it('heartbeat senza timestamp: il dispositivo resta vivo, latenza 0', () => {
    vi.spyOn(PuntoVenditaService.prototype, 'deviceHeartbeat').mockResolvedValue(true);
    const socket = dispositivoCollegato();

    expect(() => deviceSocketService.handleDeviceHeartbeat(come(socket), undefined)).not.toThrow();

    expect(socket.emit).toHaveBeenCalledWith('device:heartbeat-ack', expect.objectContaining({ latencyMs: 0 }));
  });

  it('cambio slide senza indice valido: ignorato, nessun errore', () => {
    const socket = dispositivoCollegato();

    expect(() => deviceSocketService.handleDeviceSlideChange(come(socket), undefined)).not.toThrow();
    expect(() => deviceSocketService.handleDeviceSlideChange(come(socket), { slideIndex: 'due', totalSlides: 3 } as never)).not.toThrow();
  });
});
