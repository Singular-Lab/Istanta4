import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { PERMESSI } from '../../../../lib/accessi/catalogo';

const db = vi.hoisted(() => ({
  ruoli: [] as any[],
  menu: [] as any[],
  righeRuolo: [] as any[],
  righeOverride: [] as any[],
  codici: [] as any[],
}));

vi.mock('../../db/SequelizeConnector', () => ({
  sequelize: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM ruolo_utente_gdo')) return db.ruoli;
      if (sql.includes('FROM menu_items')) return db.menu;
      if (sql.includes('FROM permessi_ruolo_gdo')) return db.righeOverride;
      if (sql.includes('FROM permessi_ruolo pr')) return db.righeRuolo;
      if (sql.includes('SELECT codice FROM permessi')) return db.codici;
      return [];
    }),
  },
}));
vi.mock('../../repositories/PermessiRepository', () => ({ PermessiRepository: class { } }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { applicaPiano, calcolaPianoMigrazione, descriviPiano } from '../migrazioneAccessi';

describe('migrazione degli accessi al modello per aree', () => {
  beforeEach(() => {
    db.ruoli = [{ id_ruolo_utente_gdo: 'id-admin', ruolo_ruolo_utente_gdo: 'ADMIN' }];
    db.menu = [];
    db.righeRuolo = [];
    db.righeOverride = [];
    db.codici = [];
  });

  it('concede l\'accesso alle aree delle pagine oggi presenti e attive nel menu del ruolo', async () => {
    db.menu = [
      { tipo_utente: TIPO_UTENTI.MARKETING, ruolo_gdo: null, pathname: '/promozioni/in-corso', disabilitato: false },
      { tipo_utente: TIPO_UTENTI.MARKETING, ruolo_gdo: null, pathname: '/ods-in-corso', disabilitato: true },
      { tipo_utente: TIPO_UTENTI.MARKETING, ruolo_gdo: null, pathname: '/profilo-utente', disabilitato: false },
    ];
    const piano = await calcolaPianoMigrazione();
    expect(piano.concessioni.map(c => [c.tipo, c.codice])).toEqual([[TIPO_UTENTI.MARKETING, PERMESSI.PROMO.VISUALIZZA]]);
  });

  it('non concede ciò che il ruolo ha già', async () => {
    db.menu = [{ tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: null, pathname: '/promozioni/in-corso', disabilitato: false }];
    db.righeRuolo = [{ tipo_utente: TIPO_UTENTI.GDO, id_ruolo_utente_gdo: null, codice: PERMESSI.PROMO.VISUALIZZA, abilitato: true }];
    expect((await calcolaPianoMigrazione()).concessioni).toEqual([]);
  });

  it('collega i menu dei sotto-ruoli per nome e concede sul sotto-ruolo', async () => {
    // La consultazione dei punti vendita chiede solo l'accesso all'area GDO
    db.menu = [
      { tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: 'GDO_ADMIN', pathname: '/punti-vendita', disabilitato: false },
      { tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: 'GDO_FANTASMA', pathname: '/punti-vendita', disabilitato: false },
    ];
    const piano = await calcolaPianoMigrazione();
    expect(piano.menuRuoli).toEqual([
      { ruoloGdo: 'GDO_ADMIN', idRuoloGdo: 'id-admin' },
      { ruoloGdo: 'GDO_FANTASMA', idRuoloGdo: null },
    ]);
    expect(piano.concessioni).toEqual([
      expect.objectContaining({ tipo: TIPO_UTENTI.GDO, idRuoloGdo: 'id-admin', codice: PERMESSI.GDO.VISUALIZZA }),
    ]);
  });

  it('concede l\'accesso all\'area dove il ruolo ha già un\'azione, anche negli override', async () => {
    db.righeRuolo = [{ tipo_utente: TIPO_UTENTI.GDO, id_ruolo_utente_gdo: null, codice: PERMESSI.GDO.GESTISCI_PUNTI_VENDITA, abilitato: true }];
    db.righeOverride = [{ tipo_utente: TIPO_UTENTI.MARKETING, id_ruolo_utente_gdo: null, id_gdo: 'g1', codice: PERMESSI.WHATSAPP.INVIA_CAMPAGNA, abilitato: true }];
    const piano = await calcolaPianoMigrazione();
    expect(piano.concessioni.map(c => [c.tipo, c.idGdo, c.codice])).toEqual([
      [TIPO_UTENTI.GDO, null, PERMESSI.GDO.VISUALIZZA],
      [TIPO_UTENTI.MARKETING, 'g1', PERMESSI.WHATSAPP.VISUALIZZA_CAMPAGNE],
    ]);
  });

  it('segnala i codici obsoleti e chi perde la gestione degli accessi', async () => {
    db.codici = [{ codice: 'pagina.dashboard' }, { codice: 'permessi.gestisci' }, { codice: PERMESSI.PROMO.CREA }];
    db.righeRuolo = [{ tipo_utente: TIPO_UTENTI.AGENZIA, id_ruolo_utente_gdo: null, codice: 'permessi.gestisci', abilitato: true }];
    const piano = await calcolaPianoMigrazione();
    expect(piano.codiciObsoleti).toEqual(['pagina.dashboard', 'permessi.gestisci']);
    expect(piano.perdonoGestioneAccessi).toEqual([TIPO_UTENTI.AGENZIA]);
    expect(descriviPiano(piano)).toContain('perdono la gestione degli accessi');
  });

  it('applica le concessioni per livello, collega i menu e toglie i codici obsoleti', async () => {
    const repository = { scriviLivello: vi.fn(async () => undefined), rimuoviCodici: vi.fn(async () => 2) };
    await applicaPiano(
      {
        concessioni: [
          { tipo: TIPO_UTENTI.GDO, idRuoloGdo: null, idGdo: null, etichetta: 'GDO', codice: PERMESSI.PROMO.VISUALIZZA, motivo: 'x' },
          { tipo: TIPO_UTENTI.GDO, idRuoloGdo: null, idGdo: null, etichetta: 'GDO', codice: PERMESSI.GDO.VISUALIZZA, motivo: 'y' },
        ],
        menuRuoli: [{ ruoloGdo: 'GDO_ADMIN', idRuoloGdo: 'id-admin' }],
        codiciObsoleti: ['pagina.dashboard'],
        perdonoGestioneAccessi: [],
      },
      repository as any,
      new Map([[PERMESSI.PROMO.VISUALIZZA, 'p1'], [PERMESSI.GDO.VISUALIZZA, 'p2']]),
      'tx' as any
    );
    expect(repository.scriviLivello).toHaveBeenCalledTimes(1);
    const [ambito, valori] = repository.scriviLivello.mock.calls[0] as any[];
    expect(ambito).toEqual({ tipo: TIPO_UTENTI.GDO, idRuoloGdo: null, idGdo: null });
    expect(Array.from(valori.entries())).toEqual([['p1', true], ['p2', true]]);
    expect(repository.rimuoviCodici).toHaveBeenCalledWith(['pagina.dashboard'], 'tx');
  });
});
