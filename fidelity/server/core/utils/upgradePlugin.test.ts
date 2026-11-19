import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../logger', () => ({ log }));

beforeEach(() => {
  vi.clearAllMocks();
});

import { gestisciUpgrade, type DipendenzeUpgrade } from './upgradePlugin';
import { campoTesto, gestoreProtetto, leggiIndirizzoUpgrade } from './socketSicuro';

/**
 * Spec processi-in-produzione, "Richieste e messaggi malformati non fermano Fidelity": l'upgrade
 * WebSocket gira nel primary, dove un'eccezione fermerebbe tutta Fidelity.
 */

/** Il socket di un upgrade: cosa gli si scrive e se viene chiuso. */
function socketFinto() {
  const socket = new EventEmitter() as EventEmitter & { scritto: string[]; destroyed: boolean; write: (d: string) => boolean; destroy: () => void };
  socket.scritto = [];
  socket.destroyed = false;
  socket.write = (dati: string) => { socket.scritto.push(dati); return true; };
  socket.destroy = () => { socket.destroyed = true; };
  return socket;
}

function richiesta(url: string, host = 'fidelity.example.test:3400'): IncomingMessage {
  return {
    url,
    headers: { host, origin: 'https://sito.example.test', 'user-agent': 'browser' },
    socket: { remoteAddress: '10.0.0.5' },
  } as unknown as IncomingMessage;
}

function dipendenze(esito: Promise<{ valid: boolean }> = Promise.resolve({ valid: true })) {
  const validaToken = vi.fn<DipendenzeUpgrade['validaToken']>(() => esito);
  const accetta = vi.fn<DipendenzeUpgrade['accetta']>();
  return { validaToken, accetta };
}

const PLUGIN = '/ws/plugin-events?token=tk&browserHash=bh&slug=volantino&fpVersion=1.2.3';
const testa = Buffer.alloc(0);
const attendi = () => new Promise((r) => setTimeout(r, 0));

describe('gestisciUpgrade', () => {
  it('un\'intestazione Host non valida non fa lanciare nulla: il percorso si legge lo stesso', async () => {
    const socket = socketFinto();
    const dip = dipendenze();

    expect(() => gestisciUpgrade(richiesta(PLUGIN, 'x:99999'), socket as unknown as Duplex, testa, dip)).not.toThrow();
    await attendi();

    expect(dip.validaToken).toHaveBeenCalledWith('tk', 'https://sito.example.test', 'bh', '10.0.0.5', 'browser');
    expect(dip.accetta).toHaveBeenCalledWith(expect.anything(), socket, testa, { slug: 'volantino', fpVersion: '1.2.3' });
  });

  it('un indirizzo che non si legge si rifiuta con 400', () => {
    const socket = socketFinto();
    const dip = dipendenze();

    expect(() => gestisciUpgrade(richiesta('//['), socket as unknown as Duplex, testa, dip)).not.toThrow();

    expect(socket.scritto[0]).toMatch(/^HTTP\/1\.1 400 Bad Request/);
    expect(socket.destroyed).toBe(true);
    expect(dip.validaToken).not.toHaveBeenCalled();
  });

  it('un errore del socket durante l\'upgrade (il client chiude) non diventa un\'eccezione', () => {
    const socket = socketFinto();
    gestisciUpgrade(richiesta('/socket.io/?EIO=4&transport=websocket'), socket as unknown as Duplex, testa, dipendenze());

    expect(() => socket.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).not.toThrow();
  });

  it('gli upgrade di socket.io si lasciano a engine.io', () => {
    const socket = socketFinto();
    const dip = dipendenze();

    gestisciUpgrade(richiesta('/socket.io/?EIO=4&transport=websocket'), socket as unknown as Duplex, testa, dip);

    expect(socket.scritto).toEqual([]);
    expect(socket.destroyed).toBe(false);
    expect(dip.validaToken).not.toHaveBeenCalled();
  });

  it('un altro percorso si rifiuta con 404', () => {
    const socket = socketFinto();

    gestisciUpgrade(richiesta('/altro'), socket as unknown as Duplex, testa, dipendenze());

    expect(socket.scritto[0]).toMatch(/^HTTP\/1\.1 404/);
    expect(socket.destroyed).toBe(true);
  });

  it('senza token o browserHash il canale del plugin risponde 401', () => {
    const socket = socketFinto();

    gestisciUpgrade(richiesta('/ws/plugin-events?token=tk'), socket as unknown as Duplex, testa, dipendenze());

    expect(socket.scritto[0]).toMatch(/^HTTP\/1\.1 401/);
  });

  it('un token non valido risponde 401 e non apre la connessione', async () => {
    const socket = socketFinto();
    const dip = dipendenze(Promise.resolve({ valid: false }));

    gestisciUpgrade(richiesta(PLUGIN), socket as unknown as Duplex, testa, dip);
    await attendi();

    expect(socket.scritto[0]).toMatch(/^HTTP\/1\.1 401/);
    expect(dip.accetta).not.toHaveBeenCalled();
  });

  it('una verifica del token che fallisce risponde 500, senza eccezioni', async () => {
    const socket = socketFinto();
    const dip = dipendenze(Promise.reject(new Error('database non raggiungibile')));

    gestisciUpgrade(richiesta(PLUGIN), socket as unknown as Duplex, testa, dip);
    await attendi();

    expect(socket.scritto[0]).toMatch(/^HTTP\/1\.1 500/);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('verifica del token'), { errore: 'database non raggiungibile' });
  });

  it('se il client chiude mentre si verifica il token non si apre nulla', async () => {
    const socket = socketFinto();
    const dip = dipendenze();

    gestisciUpgrade(richiesta(PLUGIN), socket as unknown as Duplex, testa, dip);
    socket.destroyed = true;
    await attendi();

    expect(dip.accetta).not.toHaveBeenCalled();
  });
});

describe('socketSicuro', () => {
  it('campoTesto legge solo testi non vuoti e non troppo lunghi', () => {
    expect(campoTesto(undefined, 'pvId')).toBeNull();
    expect(campoTesto(42, 'pvId')).toBeNull();
    expect(campoTesto({ pvId: 7 }, 'pvId')).toBeNull();
    expect(campoTesto({ pvId: '   ' }, 'pvId')).toBeNull();
    expect(campoTesto({ pvId: 'x'.repeat(201) }, 'pvId')).toBeNull();
    expect(campoTesto({ pvId: 'pv-1' }, 'pvId')).toBe('pv-1');
  });

  it('leggiIndirizzoUpgrade non dipende dall\'intestazione Host', () => {
    expect(leggiIndirizzoUpgrade('/ws/plugin-events?token=a')?.percorso).toBe('/ws/plugin-events');
    expect(leggiIndirizzoUpgrade('/ws/plugin-events?token=a')?.parametri.get('token')).toBe('a');
    expect(leggiIndirizzoUpgrade('//[')).toBeNull();
  });

  it('gestoreProtetto: un errore, anche di una promise, va nel log e non esce dal gestore', async () => {
    const lancia = gestoreProtetto('pv:subscribe', (payload: { pvId: string }) => payload.pvId.length);
    const rifiuta = gestoreProtetto('menabo:join', async () => { throw new Error('rotto'); });

    expect(() => lancia(undefined as never)).not.toThrow();
    expect(() => rifiuta()).not.toThrow();
    await attendi();

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"pv:subscribe"'), expect.objectContaining({ errore: expect.any(String) }));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('"menabo:join"'), { errore: 'rotto' });
  });
});
