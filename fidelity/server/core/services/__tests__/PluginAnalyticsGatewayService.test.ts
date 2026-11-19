import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { ConnectionError, DatabaseError } from 'sequelize';
import type { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../logger', () => ({ log }));

import { PluginAnalyticsEvent } from '../../models/plugin_analytics_event';
import {
  eDatoRifiutato,
  MASSIMO_EVENTI_IN_ATTESA,
  PluginAnalyticsGatewayService,
  rigaEventoPlugin,
  type ContestoEventoPlugin,
} from '../PluginAnalyticsGatewayService';

/**
 * Spec processi-in-produzione, "Eventi del plugin non validi scartati senza bloccare gli altri" e
 * "Richieste e messaggi malformati non fermano Fidelity": il gateway gira nel primary.
 */

const CONTESTO: ContestoEventoPlugin = { slug: 'volantino', fpVersion: '1.0.0', origin: 'https://sito.example.test', ip: '10.0.0.1', userAgent: 'browser' };

const evento = (n: number, extra: Record<string, unknown> = {}) => ({
  type: 'page_view',
  eventId: `e-${n}`,
  timestamp: '2026-11-19T10:00:00.000Z',
  sessionId: 's-1',
  sequence: n,
  ...extra,
});

const erroreDiDato = () => new DatabaseError(Object.assign(new Error('value too long for type character varying(50)'), { code: '22001', sql: 'INSERT' }) as never);
const erroreDiConnessione = () => new ConnectionError(new Error('connect ECONNREFUSED'));

function wsFinto() {
  const ws = new EventEmitter() as EventEmitter & { OPEN: number; readyState: number; send: ReturnType<typeof vi.fn>; ping: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  ws.OPEN = 1;
  ws.readyState = 1;
  ws.send = vi.fn();
  ws.ping = vi.fn();
  ws.close = vi.fn();
  return ws;
}

const richiesta = { headers: { origin: CONTESTO.origin, 'user-agent': CONTESTO.userAgent }, socket: { remoteAddress: CONTESTO.ip } } as unknown as IncomingMessage;

function collega() {
  const gateway = PluginAnalyticsGatewayService.getInstance();
  const ws = wsFinto();
  gateway.handleConnection(ws as unknown as WebSocket, richiesta, { slug: CONTESTO.slug, fpVersion: CONTESTO.fpVersion });
  const invia = (eventi: unknown[]) => ws.emit('message', JSON.stringify({ type: 'events:batch', events: eventi }));
  return { gateway, ws, invia };
}

const ack = (ws: ReturnType<typeof wsFinto>) => ws.send.mock.calls.map(([m]) => JSON.parse(m as string)).filter(m => m.type === 'ack');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.spyOn(PluginAnalyticsEvent, 'bulkCreate').mockResolvedValue([]);
  await PluginAnalyticsGatewayService.getInstance().shutdown();
  vi.useRealTimers();
});

describe('rigaEventoPlugin', () => {
  it('un evento valido diventa la riga da salvare, con i dati della connessione', () => {
    const esito = rigaEventoPlugin(evento(1, { pagePath: '/p'.repeat(400) }), CONTESTO);

    expect('riga' in esito && esito.riga).toMatchObject({
      event_id: 'e-1',
      event_type: 'page_view',
      slug: 'volantino',
      fp_version: '1.0.0',
      page_origin: CONTESTO.origin,
      session_id: 's-1',
      sequence: 1,
      ip_address: '10.0.0.1',
    });
    expect('riga' in esito && esito.riga.page_path).toHaveLength(500);
  });

  it.each([
    ['tipo oltre 50 caratteri', { type: 'x'.repeat(51) }],
    ['data non valida', { timestamp: 'ieri' }],
    ['eventId mancante', { eventId: undefined }],
    ['sessionId oltre 36 caratteri', { sessionId: 's'.repeat(37) }],
    ['sequence non intera', { sequence: 1.5 }],
    ['sequence fuori dagli interi', { sequence: 2 ** 40 }],
  ])('scarta un evento con %s', (_caso, extra) => {
    expect(rigaEventoPlugin(evento(1, extra), CONTESTO)).toHaveProperty('motivo');
  });

  it('scarta cio\' che non e\' un oggetto', () => {
    expect(rigaEventoPlugin('page_view', CONTESTO)).toHaveProperty('motivo');
    expect(rigaEventoPlugin(null, CONTESTO)).toHaveProperty('motivo');
  });
});

describe('eDatoRifiutato', () => {
  it('un dato rifiutato dal database non si riprova, una connessione caduta si', () => {
    expect(eDatoRifiutato(erroreDiDato())).toBe(true);
    expect(eDatoRifiutato(erroreDiConnessione())).toBe(false);
    expect(eDatoRifiutato(new Error('qualcosa'))).toBe(false);
  });
});

describe('PluginAnalyticsGatewayService', () => {
  it('su 10 eventi con uno non valido conferma e salva i 9 validi', async () => {
    const bulkCreate = vi.spyOn(PluginAnalyticsEvent, 'bulkCreate').mockResolvedValue([]);
    const { gateway, ws, invia } = collega();

    invia([...Array.from({ length: 9 }, (_, i) => evento(i)), evento(9, { type: 'x'.repeat(60) })]);
    await gateway.forceFlush();

    expect(ack(ws)).toEqual([{ type: 'ack', count: 9 }]);
    expect(bulkCreate.mock.calls[0][0]).toHaveLength(9);
  });

  it('se il database rifiuta un evento del lotto, salva gli altri uno alla volta e scarta quello', async () => {
    vi.spyOn(PluginAnalyticsEvent, 'bulkCreate').mockRejectedValue(erroreDiDato());
    const create = vi.spyOn(PluginAnalyticsEvent, 'create').mockImplementation((async (riga: { event_id: string }) => {
      if (riga.event_id === 'e-1') throw erroreDiDato();
      return riga;
    }) as never);
    const { gateway, invia } = collega();

    invia([evento(0), evento(1), evento(2)]);
    await gateway.forceFlush();

    expect(create).toHaveBeenCalledTimes(3);
    expect(gateway.getMetrics()).toMatchObject({ totalEventsPersisted: 2, queueSize: 0 });
    expect(log.warn).toHaveBeenCalledWith('[PluginAnalytics] Eventi del plugin scartati', expect.objectContaining({ nonValidi: 1 }));
  });

  it('con il database non raggiungibile gli eventi restano in coda e si salvano quando torna', async () => {
    const bulkCreate = vi.spyOn(PluginAnalyticsEvent, 'bulkCreate').mockRejectedValueOnce(erroreDiConnessione()).mockResolvedValue([]);
    const { gateway, invia } = collega();

    invia([evento(0), evento(1)]);
    await gateway.forceFlush();
    expect(gateway.getMetrics()).toMatchObject({ queueSize: 2, totalEventsPersisted: 0 });

    await gateway.forceFlush();
    expect(bulkCreate).toHaveBeenCalledTimes(2);
    expect(gateway.getMetrics()).toMatchObject({ queueSize: 0, totalEventsPersisted: 2 });
  });

  it('oltre il massimo di eventi in attesa scarta i piu\' vecchi e lo dice nel log', async () => {
    vi.spyOn(PluginAnalyticsEvent, 'bulkCreate').mockRejectedValue(erroreDiConnessione());
    const gateway = PluginAnalyticsGatewayService.getInstance();
    const righe = Array.from({ length: MASSIMO_EVENTI_IN_ATTESA + 5 }, (_, i) => {
      const esito = rigaEventoPlugin(evento(i), CONTESTO);
      if (!('riga' in esito)) throw new Error('evento di prova non valido');
      return esito.riga;
    });
    // accoda e' privato: qui si riempie la coda senza 100 connessioni finte
    (gateway as unknown as { accoda: (r: typeof righe) => void }).accoda(righe);

    await gateway.forceFlush();

    expect(gateway.getMetrics().queueSize).toBe(MASSIMO_EVENTI_IN_ATTESA);
    expect(log.warn).toHaveBeenCalledWith('[PluginAnalytics] Eventi del plugin scartati', expect.objectContaining({ oltreIlLimite: 5 }));
  });

  it('un frame non valido (evento error della connessione) non diventa un\'eccezione', () => {
    const { ws } = collega();

    expect(() => ws.emit('error', new RangeError('Invalid WebSocket frame: RSV1 must be clear'))).not.toThrow();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('chiusa per errore'), { errore: 'Invalid WebSocket frame: RSV1 must be clear' });
  });
});
