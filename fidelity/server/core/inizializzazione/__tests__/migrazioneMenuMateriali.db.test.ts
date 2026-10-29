import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMESSI } from '../../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../../lib/enums';

// La fonte predefinita della migrazione: le query sui menu salvati, dentro una transazione con il lock.
const { transazione, query } = vi.hoisted(() => ({
  transazione: { id: 'tx' },
  query: vi.fn(),
}));
vi.mock('../../db/SequelizeConnector', () => ({
  sequelize: {
    query,
    transaction: vi.fn(async (lavoro: (t: unknown) => Promise<unknown>) => lavoro(transazione)),
  },
}));
vi.mock('../../accessi/versionePermessi', () => ({ incrementaVersionePermessi: vi.fn() }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { incrementaVersionePermessi } from '../../accessi/versionePermessi';
import { migraMenuMateriali, type RigaMenu } from '../migrazioneMenuMateriali';

const MATERIALI_ATTIVI: RigaMenu = {
  id_menu_item: 'voce-attivi',
  tipo_utente: TIPO_UTENTI.SUPERADMIN,
  ruolo_gdo: null,
  id_ruolo_utente_gdo: null,
  id_parent: null,
  tipo: 'item',
  titolo: 'Materiali attivi',
  icona: 'FolderOpen',
  pathname: '/materiali-attivi',
  codice_permesso: 'pagina.materiali_attivi',
  disabilitato: false,
  start_page: false,
  ordinamento: 0,
};

const chiamate = (inizio: string) =>
  query.mock.calls.filter(([sql]) => String(sql).trim().startsWith(inizio));

describe('migrazione dei menu Materiali sul database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockImplementation(async (sql: string) =>
      sql.includes('FROM menu_items') ? [MATERIALI_ATTIVI] : []
    );
  });

  it('prende il lock, legge, aggiorna e inserisce nella stessa transazione e alza la versione dei permessi', async () => {
    const esito = await migraMenuMateriali();

    expect(esito).toEqual({ menu: 1, aggiornate: 1, inserite: 1 });
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    for (const [, opzioni] of query.mock.calls) expect(opzioni.transaction).toBe(transazione);

    const [[, aggiornamento]] = chiamate('UPDATE menu_items');
    expect(aggiornamento.replacements).toEqual({
      id_menu_item: 'voce-attivi',
      titolo: 'Volantini attivi',
      pathname: '/volantini/attivi',
      codice_permesso: PERMESSI.MATERIALI.VISUALIZZA,
      ordinamento: 0,
    });

    const [[, inserimento]] = chiamate('INSERT INTO menu_items');
    expect(inserimento.replacements).toMatchObject({
      tipo_utente: TIPO_UTENTI.SUPERADMIN,
      ruolo_gdo: null,
      id_ruolo_utente_gdo: null,
      id_parent: null,
      tipo: 'item',
      titolo: 'POP attivi',
      icona: 'FolderOpen',
      pathname: '/pop/attivi',
      codice_permesso: PERMESSI.MATERIALI.VISUALIZZA,
      disabilitato: false,
      start_page: false,
      ordinamento: 1,
    });
    // Senza generatore la voce POP riceve un uuid nuovo
    expect(inserimento.replacements.id_menu_item).toMatch(/^[0-9a-f-]{36}$/);

    expect(incrementaVersionePermessi).toHaveBeenCalledWith(transazione);
  });

  it('su menu già convertiti non scrive nulla e non alza la versione', async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes('FROM menu_items')
        ? [{ ...MATERIALI_ATTIVI, titolo: 'Volantini attivi', pathname: '/volantini/attivi' }]
        : []
    );

    expect(await migraMenuMateriali()).toEqual({ menu: 0, aggiornate: 0, inserite: 0 });
    expect(chiamate('UPDATE menu_items')).toHaveLength(0);
    expect(chiamate('INSERT INTO menu_items')).toHaveLength(0);
    expect(incrementaVersionePermessi).not.toHaveBeenCalled();
  });
});
