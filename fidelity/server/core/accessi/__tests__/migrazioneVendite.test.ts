import { describe, expect, it, vi } from 'vitest';
import { PERMESSI as P } from '../../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../../lib/enums';

const db = vi.hoisted(() => ({
  sottoRuoli: [] as Array<{ id_ruolo_utente_gdo: string; ruolo_ruolo_utente_gdo: string }>,
  impostati: [] as Array<{ id_ruolo_utente_gdo: string; codice: string }>,
  query: [] as Array<{ sql: string; opzioni: unknown }>,
}));

vi.mock('../../db/SequelizeConnector', () => ({
  sequelize: {
    query: vi.fn(async (sql: string, opzioni: unknown) => {
      db.query.push({ sql, opzioni });
      if (sql.includes('FROM ruolo_utente_gdo')) return db.sottoRuoli;
      if (sql.includes('FROM permessi_ruolo pr')) return db.impostati;
      return [];
    }),
  },
}));

import { applicaPianoVendite, calcolaPianoVendite, descriviPianoVendite, leggiPianoVendite } from '../migrazioneVendite';
import { normalizzaNomeSottoRuolo, permessiPredefinitiDelSottoRuolo } from '../predefiniti';

// Schema 3 degli accessi: l'import delle vendite all'ADMIN della GDO sulle installazioni esistenti

const ADMIN = { id_ruolo_utente_gdo: 'id-admin', ruolo_ruolo_utente_gdo: 'ADMIN' };
const IMPIEGATO = { id_ruolo_utente_gdo: 'id-impiegato', ruolo_ruolo_utente_gdo: 'IMPIEGATO' };
const DEVELOPER = { id_ruolo_utente_gdo: 'id-developer', ruolo_ruolo_utente_gdo: 'DEVELOPER' };

describe('permessi predefiniti dei sotto-ruoli GDO', () => {
  it('l\'ADMIN importa le vendite, gli altri sotto-ruoli no', () => {
    expect(permessiPredefinitiDelSottoRuolo('ADMIN')).toEqual([P.ANALISI.IMPORTA_VENDITE]);
    expect(permessiPredefinitiDelSottoRuolo('IMPIEGATO')).toEqual([]);
    expect(permessiPredefinitiDelSottoRuolo('AMMINISTRATORE_DELEGATO')).toEqual([]);
    expect(permessiPredefinitiDelSottoRuolo('SCONOSCIUTO')).toEqual([]);
  });

  it('riconosce il sotto-ruolo anche scritto come GDO_ADMIN o in minuscolo', () => {
    expect(normalizzaNomeSottoRuolo(' gdo_admin ')).toBe('ADMIN');
    expect(permessiPredefinitiDelSottoRuolo('GDO_ADMIN')).toEqual([P.ANALISI.IMPORTA_VENDITE]);
    expect(permessiPredefinitiDelSottoRuolo('admin')).toEqual([P.ANALISI.IMPORTA_VENDITE]);
  });
});

describe('piano dello schema 3 (import delle vendite)', () => {
  it('concede l\'import delle vendite al solo sotto-ruolo ADMIN', () => {
    expect(calcolaPianoVendite([ADMIN, IMPIEGATO, DEVELOPER], [])).toEqual([
      { idRuoloGdo: 'id-admin', nomeRuolo: 'ADMIN', codice: P.ANALISI.IMPORTA_VENDITE },
    ]);
  });

  it('non tocca un valore gia\' impostato dall\'amministratore, nemmeno se disabilitato', () => {
    expect(calcolaPianoVendite([ADMIN], [{ id_ruolo_utente_gdo: 'id-admin', codice: P.ANALISI.IMPORTA_VENDITE }])).toEqual([]);
  });

  it('senza sotto-ruolo ADMIN non concede nulla', () => {
    expect(calcolaPianoVendite([IMPIEGATO], [])).toEqual([]);
    expect(calcolaPianoVendite([], [])).toEqual([]);
  });

  it('scrive il permesso sul livello GDO del sotto-ruolo, abilitato', async () => {
    const scriviLivello = vi.fn(async () => undefined);
    const transaction = {} as never;
    const piano = calcolaPianoVendite([ADMIN], []);

    await applicaPianoVendite(piano, { scriviLivello }, new Map([[P.ANALISI.IMPORTA_VENDITE, 'id-permesso']]), transaction);

    expect(scriviLivello).toHaveBeenCalledTimes(1);
    expect(scriviLivello).toHaveBeenCalledWith(
      { tipo: TIPO_UTENTI.GDO, idRuoloGdo: 'id-admin' },
      new Map([['id-permesso', true]]),
      transaction
    );
  });

  it('un codice non ancora nel catalogo del database non si scrive', async () => {
    const scriviLivello = vi.fn(async () => undefined);
    await applicaPianoVendite(calcolaPianoVendite([ADMIN], []), { scriviLivello }, new Map(), {} as never);
    expect(scriviLivello).not.toHaveBeenCalled();
  });

  it('il log elenca ogni concessione', () => {
    const testo = descriviPianoVendite(calcolaPianoVendite([ADMIN], []));
    expect(testo).toContain('concessi ai sotto-ruoli GDO: 1');
    expect(testo).toContain(`GDO · ADMIN  + ${P.ANALISI.IMPORTA_VENDITE}`);
  });
});

describe('lettura del piano dal database', () => {
  it('legge sotto-ruoli e valori gia\' impostati per il tipo GDO, nella transazione dell\'avvio', async () => {
    db.sottoRuoli = [ADMIN, IMPIEGATO];
    db.impostati = [];
    db.query = [];
    const transaction = { id: 't' } as never;

    const piano = await leggiPianoVendite(transaction);

    expect(piano).toEqual([{ idRuoloGdo: 'id-admin', nomeRuolo: 'ADMIN', codice: P.ANALISI.IMPORTA_VENDITE }]);
    const valori = db.query.find(q => q.sql.includes('FROM permessi_ruolo pr'));
    expect(valori?.opzioni).toMatchObject({
      transaction,
      replacements: { tipo: TIPO_UTENTI.GDO, codici: [P.ANALISI.IMPORTA_VENDITE] },
    });
    expect(db.query.every(q => (q.opzioni as { transaction?: unknown }).transaction === transaction)).toBe(true);
  });

  it('con il permesso gia\' impostato sull\'ADMIN il piano e\' vuoto', async () => {
    db.sottoRuoli = [ADMIN];
    db.impostati = [{ id_ruolo_utente_gdo: 'id-admin', codice: P.ANALISI.IMPORTA_VENDITE }];
    expect(await leggiPianoVendite({} as never)).toEqual([]);
  });
});
