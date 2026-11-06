import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../models', () => ({
  UtentiGDO: { findOne: vi.fn(async () => ({ id_gdo_utentegdo: 'coop-firenze', id_ruolo_utente_gdo: 'admin' })) },
}));

import { UtentiGDO } from '../../models';
import { ambitoGdoDellaRichiesta, gdoOperativa, gdoOperativaPerRichiesta, leggiContestoAccesso } from '../contestoAccesso';

describe('gdoOperativa', () => {
  it('per un utente GDO vale sempre la GDO della sessione', () => {
    expect(gdoOperativa(TIPO_UTENTI.GDO, 'coop-firenze', 'altra-gdo')).toBe('coop-firenze');
  });

  it('Superadmin e Agenzia possono indicare la GDO su cui operano', () => {
    expect(gdoOperativa(TIPO_UTENTI.AGENZIA, null, 'coop-firenze')).toBe('coop-firenze');
    expect(gdoOperativa(TIPO_UTENTI.SUPERADMIN, null, 'coop-firenze')).toBe('coop-firenze');
    expect(gdoOperativa(TIPO_UTENTI.AGENZIA, 'propria', null)).toBe('propria');
  });
});

describe('gdoOperativaPerRichiesta', () => {
  it('ignora la GDO della richiesta per un utente GDO', async () => {
    const req = { session: { id_utente: 'u1', tipo_utente: TIPO_UTENTI.GDO } } as any;
    expect(await gdoOperativaPerRichiesta(req, { locals: {} } as any, 'altra-gdo')).toBe('coop-firenze');
  });

  it('le chiamate di servizio indicano la GDO nella richiesta', async () => {
    const req = { session: {} } as any;
    expect(await gdoOperativaPerRichiesta(req, { locals: { authVia: 'internal' } } as any, 'coop-firenze')).toBe('coop-firenze');
  });
});

describe('leggiContestoAccesso', () => {
  it('usa il tipo della sessione e GDO e sotto-ruolo dell\'anagrafica, una volta per richiesta', async () => {
    const req = { session: { id_utente: 'u1', tipo_utente: TIPO_UTENTI.GDO } } as any;
    const res = { locals: {} } as any;
    const contesto = await leggiContestoAccesso(req, res);
    expect(contesto).toEqual({ idUtente: 'u1', tipo: TIPO_UTENTI.GDO, idGdo: 'coop-firenze', idRuoloGdo: 'admin', superadmin: false });
    expect(await leggiContestoAccesso(req, res)).toBe(contesto);
  });

  it('senza sessione non c\'è contesto', async () => {
    expect(await leggiContestoAccesso({ session: {} } as any)).toBeNull();
  });
});

describe('ambitoGdoDellaRichiesta (dati di consultazione)', () => {
  const senzaAssociazione = () => vi.mocked(UtentiGDO.findOne).mockResolvedValueOnce(null);
  const richiesta = (idUtente: string, tipo: TIPO_UTENTI) =>
    ({ session: { id_utente: idUtente, tipo_utente: tipo } }) as unknown as Request;
  const risposta = () => ({ locals: {} }) as unknown as Response;

  it('un utente GDO vede solo la sua GDO, qualunque GDO indichi', async () => {
    expect(await ambitoGdoDellaRichiesta(richiesta('u1', TIPO_UTENTI.GDO), risposta(), 'altra-gdo')).toEqual({ idGdo: 'coop-firenze' });
  });

  it('Superadmin e Agenzia senza GDO vedono tutte le GDO, o quella che indicano', async () => {
    senzaAssociazione();
    expect(await ambitoGdoDellaRichiesta(richiesta('s1', TIPO_UTENTI.SUPERADMIN), risposta())).toBe('tutte');

    expect(await ambitoGdoDellaRichiesta(richiesta('a1', TIPO_UTENTI.AGENZIA), risposta(), 'coop-firenze')).toEqual({ idGdo: 'coop-firenze' });
  });

  it('un utente senza GDO che non opera per più GDO non vede i dati di nessuna', async () => {
    senzaAssociazione();
    expect(await ambitoGdoDellaRichiesta(richiesta('m1', TIPO_UTENTI.MARKETING), risposta(), 'coop-firenze')).toBe('nessuna');
  });
});
