import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMESSI } from '../../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../../lib/enums';

// La fonte predefinita della migrazione: le query sui menu salvati e sul registro degli script di
// dati, dentro una transazione con il lock.
const { transazione, query, registrata } = vi.hoisted(() => ({
  transazione: { id: 'tx' },
  query: vi.fn(),
  registrata: { valore: false },
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
import { migraMenuAvanzamento } from '../migrazioneMenuAvanzamento';
import type { RigaMenu } from '../migrazioneMenuMateriali';

const IN_CORSO: RigaMenu = {
  id_menu_item: 'voce-in-corso',
  tipo_utente: TIPO_UTENTI.AGENZIA,
  ruolo_gdo: null,
  id_ruolo_utente_gdo: null,
  id_parent: null,
  tipo: 'item',
  titolo: 'Promozioni in corso',
  icona: 'Activity',
  pathname: '/promozioni/in-corso',
  codice_permesso: null,
  disabilitato: false,
  start_page: true,
  ordinamento: 0,
};

const chiamate = (inizio: string) =>
  query.mock.calls.filter(([sql]) => String(sql).trim().startsWith(inizio));

describe('voce Avanzamento produzione sul database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registrata.valore = false;
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.script_dati_eseguiti')) return registrata.valore ? [{ nome: 'menu-avanzamento-produzione' }] : [];
      if (sql.includes('FROM menu_items')) return [IN_CORSO];
      return [];
    });
  });

  it('prende il lock, aggiunge la voce, alza la versione e registra l\'esecuzione nella stessa transazione', async () => {
    const esito = await migraMenuAvanzamento();

    expect(esito).toEqual({ stato: 'eseguita', menu: 1, aggiornate: 1, inserite: 1 });
    expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    for (const [, opzioni] of query.mock.calls) expect(opzioni.transaction).toBe(transazione);

    const [[, inserimento]] = chiamate('INSERT INTO menu_items');
    expect(inserimento.replacements).toMatchObject({
      tipo_utente: TIPO_UTENTI.AGENZIA,
      titolo: 'Avanzamento produzione',
      icona: 'Gauge',
      pathname: '/avanzamento-produzione',
      codice_permesso: PERMESSI.KIT_RUNTIME.VISUALIZZA,
      start_page: false,
      ordinamento: 0,
    });
    // Senza generatore la voce riceve un uuid nuovo
    expect(inserimento.replacements.id_menu_item).toMatch(/^[0-9a-f-]{36}$/);
    const [[, spostamento]] = chiamate('UPDATE menu_items');
    expect(spostamento.replacements).toMatchObject({ id_menu_item: 'voce-in-corso', ordinamento: 1 });
    expect(incrementaVersionePermessi).toHaveBeenCalledWith(transazione);

    const [[, registro]] = chiamate('INSERT INTO public.script_dati_eseguiti');
    expect(registro.replacements).toMatchObject({ nome: 'menu-avanzamento-produzione', ripetibile: false });
    expect(JSON.parse(registro.replacements.esito)).toEqual(esito);
  });

  it('già registrata: non legge i menu e non scrive nulla', async () => {
    registrata.valore = true;

    expect(await migraMenuAvanzamento()).toMatchObject({ stato: 'gia-eseguita' });
    expect(chiamate('SELECT id_menu_item')).toHaveLength(0);
    expect(chiamate('INSERT')).toHaveLength(0);
    expect(chiamate('UPDATE')).toHaveLength(0);
  });
});
