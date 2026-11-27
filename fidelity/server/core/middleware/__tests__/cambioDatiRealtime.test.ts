import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../../ws-server', () => ({ emitToClients: vi.fn() }));

import { cambioDatiRealtime, type Emetti, EVENTO_DATI_CAMBIATI, FINESTRA_AVVISI_MS, roomDegliInteressati, segnalaGdoDelCambio } from '../cambioDatiRealtime';

// Spec interfaccia-operatore, "Dati aggiornati in tempo reale": dopo una scrittura riuscita il server
// avvisa le pagine aperte della stessa GDO, senza il contenuto del dato.

interface Richiesta {
  method: string;
  originalUrl: string;
  headers?: Record<string, string>;
  session?: { id_gdo?: string; tipo_utente?: string; id_utente?: string };
}

const eseguire = (
  richiesta: Richiesta,
  { stato = 200, emetti = vi.fn<Emetti>(), adesso = () => 1000, middleware, preparaRisposta }: { stato?: number; emetti?: ReturnType<typeof vi.fn<Emetti>>; adesso?: () => number; middleware?: ReturnType<typeof cambioDatiRealtime>; preparaRisposta?: (res: Response) => void } = {}
) => {
  const mw = middleware ?? cambioDatiRealtime(emetti, adesso);
  const res = Object.assign(new EventEmitter(), { statusCode: stato, locals: {} as Record<string, unknown> });
  preparaRisposta?.(res as unknown as Response);
  const next = vi.fn();
  const req = {
    ...richiesta,
    url: richiesta.originalUrl,
    get: (nome: string) => richiesta.headers?.[nome.toLowerCase()],
  } as unknown as Request;
  mw(req, res as unknown as Response, next);
  res.emit('finish');
  return { emetti, next, mw };
};

const GDO = '11111111-1111-4111-8111-111111111111';
const AREA = '3f2b4c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('cambioDatiRealtime', () => {
  it('una creazione riuscita avvisa la room della GDO con tipo, azione e identificativo, e nient\'altro', () => {
    const { emetti, next } = eseguire({ method: 'DELETE', originalUrl: `/api/ACPV/eliminaArea/${AREA}`, session: { id_gdo: GDO } });

    expect(next).toHaveBeenCalledTimes(1);
    expect(emetti).toHaveBeenCalledTimes(1);
    expect(emetti).toHaveBeenCalledWith(EVENTO_DATI_CAMBIATI, { risorsa: 'acpv', azione: 'eliminato', id: AREA, origine: null }, `gdo:${GDO}`);
    expect(Object.keys(emetti.mock.calls[0][1] as object).sort()).toEqual(['azione', 'id', 'origine', 'risorsa']);
  });

  it('l\'identificativo di chi ha agito (X-Client-Id) va nell\'avviso, uno malformato no', () => {
    const buono = eseguire({ method: 'POST', originalUrl: '/api/promo', headers: { 'x-client-id': 'scheda-12345678' }, session: { id_gdo: GDO } });
    const cattivo = eseguire({ method: 'POST', originalUrl: '/api/promo', headers: { 'x-client-id': '<script>' }, session: { id_gdo: GDO } });

    expect((buono.emetti.mock.calls[0][1] as { origine: string }).origine).toBe('scheda-12345678');
    expect((cattivo.emetti.mock.calls[0][1] as { origine: null }).origine).toBeNull();
  });

  it('una risposta di errore, o una lettura, o un POST che legge non avvisa nessuno', () => {
    expect(eseguire({ method: 'POST', originalUrl: '/api/promo', session: { id_gdo: GDO } }, { stato: 500 }).emetti).not.toHaveBeenCalled();
    expect(eseguire({ method: 'POST', originalUrl: '/api/promo', session: { id_gdo: GDO } }, { stato: 400 }).emetti).not.toHaveBeenCalled();
    expect(eseguire({ method: 'GET', originalUrl: '/api/all_aree', session: { id_gdo: GDO } }).emetti).not.toHaveBeenCalled();
    expect(eseguire({ method: 'POST', originalUrl: '/api/scoreboard/query', session: { id_gdo: GDO } }).emetti).not.toHaveBeenCalled();
  });

  it('senza GDO avvisa i soli Superadmin; un utente senza GDO che non lo e\' non avvisa nessuno', () => {
    const superadmin = eseguire({ method: 'PUT', originalUrl: '/api/saveConfig', session: { tipo_utente: TIPO_UTENTI.SUPERADMIN } });
    const altro = eseguire({ method: 'PUT', originalUrl: '/api/saveConfig', session: { tipo_utente: TIPO_UTENTI.GDO } });
    const anonimo = eseguire({ method: 'PUT', originalUrl: '/api/saveConfig' });

    expect(superadmin.emetti).toHaveBeenCalledWith(EVENTO_DATI_CAMBIATI, expect.anything(), 'superadmin');
    expect(altro.emetti).not.toHaveBeenCalled();
    expect(anonimo.emetti).not.toHaveBeenCalled();
  });

  it('un avviso al secondo per GDO e tipo di dato: il primo parte subito, gli altri si fondono in uno alla fine della finestra', () => {
    const emetti = vi.fn<Emetti>();
    const mw = cambioDatiRealtime(emetti, Date.now);
    const crea = (id: string) => ({ method: 'POST', originalUrl: `/api/promo/${id}`, session: { id_gdo: GDO } });

    eseguire(crea('1'), { emetti, middleware: mw, adesso: Date.now });
    expect(emetti).toHaveBeenCalledTimes(1);

    for (let n = 2; n <= 50; n += 1) {
      vi.advanceTimersByTime(10);
      eseguire(crea(String(n)), { emetti, middleware: mw, adesso: Date.now });
    }
    expect(emetti).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(FINESTRA_AVVISI_MS);
    expect(emetti).toHaveBeenCalledTimes(2);
    // Gli identificativi diversi non si indicano piu': l'avviso dice solo che e' cambiato qualcosa
    expect(emetti.mock.calls[1][1]).toMatchObject({ risorsa: 'promo', azione: 'creato', id: null });
  });

  it('un solo avviso dentro la finestra parte alla fine con il suo identificativo', () => {
    const emetti = vi.fn<Emetti>();
    const mw = cambioDatiRealtime(emetti, Date.now);

    eseguire({ method: 'PUT', originalUrl: '/api/promo/1', session: { id_gdo: GDO } }, { emetti, middleware: mw, adesso: Date.now });
    vi.advanceTimersByTime(100);
    eseguire({ method: 'PUT', originalUrl: `/api/promo/${AREA}`, session: { id_gdo: GDO } }, { emetti, middleware: mw, adesso: Date.now });
    vi.advanceTimersByTime(FINESTRA_AVVISI_MS);

    expect(emetti).toHaveBeenCalledTimes(2);
    expect(emetti.mock.calls[1][1]).toMatchObject({ id: AREA });
  });

  it('dopo la finestra il prossimo avviso riparte subito', () => {
    const emetti = vi.fn<Emetti>();
    const mw = cambioDatiRealtime(emetti, Date.now);
    const richiesta = { method: 'POST', originalUrl: '/api/promo', session: { id_gdo: GDO } };

    eseguire(richiesta, { emetti, middleware: mw, adesso: Date.now });
    vi.advanceTimersByTime(FINESTRA_AVVISI_MS + 1);
    eseguire(richiesta, { emetti, middleware: mw, adesso: Date.now });

    expect(emetti).toHaveBeenCalledTimes(2);
  });

  it('GDO diverse e tipi di dato diversi non si fondono', () => {
    const emetti = vi.fn<Emetti>();
    const mw = cambioDatiRealtime(emetti, Date.now);

    eseguire({ method: 'POST', originalUrl: '/api/promo', session: { id_gdo: GDO } }, { emetti, middleware: mw, adesso: Date.now });
    eseguire({ method: 'POST', originalUrl: '/api/promo', session: { id_gdo: '22222222-2222-4222-8222-222222222222' } }, { emetti, middleware: mw, adesso: Date.now });
    eseguire({ method: 'POST', originalUrl: '/api/dispositivi', session: { id_gdo: GDO } }, { emetti, middleware: mw, adesso: Date.now });

    expect(emetti).toHaveBeenCalledTimes(3);
  });

  it('una funzione puo\' dichiarare la GDO del cambio quando la richiesta non ha una sessione (Plugin, integrazioni)', () => {
    const { emetti } = eseguire(
      { method: 'POST', originalUrl: '/api/external/sync_json_plugin' },
      { preparaRisposta: res => segnalaGdoDelCambio(res, GDO) }
    );

    expect(emetti).toHaveBeenCalledWith(EVENTO_DATI_CAMBIATI, expect.objectContaining({ risorsa: 'external' }), `gdo:${GDO}`);
  });

  it('la GDO dichiarata ha la precedenza su quella della sessione (il Superadmin che opera per una GDO)', () => {
    const { emetti } = eseguire(
      { method: 'PUT', originalUrl: '/api/saveConfig', session: { tipo_utente: TIPO_UTENTI.SUPERADMIN } },
      { preparaRisposta: res => segnalaGdoDelCambio(res, GDO) }
    );

    expect(emetti).toHaveBeenCalledWith(EVENTO_DATI_CAMBIATI, expect.anything(), `gdo:${GDO}`);
    expect(emetti).toHaveBeenCalledTimes(1);
  });

  it('un errore nell\'emissione non tocca la risposta', () => {
    const emetti = vi.fn<Emetti>(() => { throw new Error('canale chiuso'); });

    expect(() => eseguire({ method: 'POST', originalUrl: '/api/promo', session: { id_gdo: GDO } }, { emetti })).not.toThrow();
  });
});

describe('roomDegliInteressati', () => {
  it('la GDO ha la precedenza, poi i Superadmin, poi nessuno', () => {
    expect(roomDegliInteressati({ id_gdo: GDO, tipo_utente: TIPO_UTENTI.SUPERADMIN })).toBe(`gdo:${GDO}`);
    expect(roomDegliInteressati({ tipo_utente: TIPO_UTENTI.SUPERADMIN })).toBe('superadmin');
    expect(roomDegliInteressati({ tipo_utente: TIPO_UTENTI.GDO })).toBeNull();
    expect(roomDegliInteressati(null)).toBeNull();
  });
});
