import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMESSI } from '../../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { log } from '../../logger';
import {
  type EsitoMigrazioneMenuAvanzamento,
  type FonteMenuAvanzamento,
  migraMenuAvanzamento,
} from '../migrazioneMenuAvanzamento';
import type { MenuInTransazione, RigaMenu } from '../migrazioneMenuMateriali';

const AGENZIA = { tipo_utente: TIPO_UTENTI.AGENZIA, id_ruolo_utente_gdo: null, ruolo_gdo: null };
const GDO_ADMIN = { tipo_utente: TIPO_UTENTI.GDO, id_ruolo_utente_gdo: 'ruolo-admin', ruolo_gdo: 'GDO_ADMIN' };
const CATEGORY = { tipo_utente: TIPO_UTENTI.CATEGORY, id_ruolo_utente_gdo: null, ruolo_gdo: null };

const riga = (
  id: string,
  menu: Pick<RigaMenu, 'tipo_utente' | 'id_ruolo_utente_gdo' | 'ruolo_gdo'>,
  titolo: string,
  pathname: string | null,
  ordinamento: number
): RigaMenu => ({
  id_menu_item: id,
  ...menu,
  id_parent: null,
  tipo: pathname ? 'item' : 'separator',
  titolo,
  icona: pathname ? 'Circle' : null,
  pathname,
  codice_permesso: null,
  disabilitato: false,
  start_page: false,
  ordinamento,
});

const menuSalvati = (): RigaMenu[] => [
  riga('ag-sep', AGENZIA, 'PROMOZIONI', null, 0),
  riga('ag-nuova', AGENZIA, 'Nuova promozione', '/promozioni/nuova', 1),
  riga('ag-in-corso', AGENZIA, 'Promozioni in corso', '/promozioni/in-corso', 2),
  riga('gdo-in-corso', GDO_ADMIN, 'Promozioni', '/promozioni/in-corso', 0),
  riga('gdo-vol', GDO_ADMIN, 'Volantini attivi', '/volantini/attivi', 1),
  // Category senza Promozioni in corso: non cambia
  riga('cat-vol', CATEGORY, 'Volantini attivi', '/volantini/attivi', 0),
];

const creaFonte = (righe: RigaMenu[], registrata = false) => {
  let tabella = new Map(righe.map(r => [r.id_menu_item, { ...r }]));
  const registro = { esiti: registrata ? [{} as EsitoMigrazioneMenuAvanzamento] : [] as EsitoMigrazioneMenuAvanzamento[] };
  const menu: MenuInTransazione = {
    leggiVoci: async () => Array.from(tabella.values(), r => ({ ...r })),
    aggiornaVoce: vi.fn(async (voce: RigaMenu) => { tabella.set(voce.id_menu_item, { ...voce }); }),
    inserisciVoce: vi.fn(async (voce: RigaMenu) => {
      if (tabella.has(voce.id_menu_item)) throw new Error(`id duplicato: ${voce.id_menu_item}`);
      tabella.set(voce.id_menu_item, { ...voce });
    }),
    incrementaVersione: vi.fn(async () => { }),
  };
  // Una transazione finta: se il lavoro fallisce, tabella e registro tornano com'erano.
  const fonte: FonteMenuAvanzamento = {
    inTransazione: async (lavoro) => {
      const copia = new Map(tabella);
      const esiti = [...registro.esiti];
      try {
        return await lavoro(menu, {
          eseguita: async () => registro.esiti.length > 0,
          registra: async (esito) => { registro.esiti.push(esito); },
        });
      } catch (errore) {
        tabella = copia;
        registro.esiti = esiti;
        throw errore;
      }
    },
  };
  return { fonte, menu, registro, tabella: () => tabella };
};

const menuDi = (tabella: Map<string, RigaMenu>, chi: { tipo_utente: string; id_ruolo_utente_gdo: string | null }) =>
  Array.from(tabella.values())
    .filter(r => r.tipo_utente === chi.tipo_utente && r.id_ruolo_utente_gdo === chi.id_ruolo_utente_gdo)
    .sort((a, b) => a.ordinamento - b.ordinamento)
    .map(r => [r.titolo, r.pathname, r.ordinamento]);

let progressivo: number;
const nuovoId = () => `avanzamento-${++progressivo}`;

beforeEach(() => {
  progressivo = 0;
  vi.mocked(log.info).mockClear();
});

describe('voce Avanzamento produzione nei menu salvati, all\'avvio', () => {
  it('la aggiunge prima di Promozioni in corso in ogni menu che la ha, alza la versione e registra l\'esecuzione', async () => {
    const { fonte, menu, registro, tabella } = creaFonte(menuSalvati());

    const esito = await migraMenuAvanzamento(fonte, nuovoId);

    expect(menuDi(tabella(), AGENZIA)).toEqual([
      ['PROMOZIONI', null, 0],
      ['Nuova promozione', '/promozioni/nuova', 1],
      ['Avanzamento produzione', '/avanzamento-produzione', 2],
      ['Promozioni in corso', '/promozioni/in-corso', 3],
    ]);
    expect(menuDi(tabella(), GDO_ADMIN)).toEqual([
      ['Avanzamento produzione', '/avanzamento-produzione', 0],
      ['Promozioni', '/promozioni/in-corso', 1],
      ['Volantini attivi', '/volantini/attivi', 2],
    ]);
    expect(menuDi(tabella(), CATEGORY)).toEqual([['Volantini attivi', '/volantini/attivi', 0]]);
    expect(tabella().get('avanzamento-1')).toMatchObject({
      ...AGENZIA,
      codice_permesso: PERMESSI.KIT_RUNTIME.VISUALIZZA,
      icona: 'Gauge',
      start_page: false,
    });
    expect(esito).toEqual({ stato: 'eseguita', menu: 2, aggiornate: 3, inserite: 2 });
    expect(registro.esiti).toEqual([esito]);
    expect(menu.incrementaVersione).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('in 2 menu'));
  });

  it('una volta sola: registrata, non rimette la voce che l\'amministratore ha tolto', async () => {
    const { fonte, tabella } = creaFonte(menuSalvati());
    await migraMenuAvanzamento(fonte, nuovoId);
    tabella().delete('avanzamento-1');

    const esito = await migraMenuAvanzamento(fonte, nuovoId);

    expect(esito.stato).toBe('gia-eseguita');
    expect(menuDi(tabella(), AGENZIA).map(([titolo]) => titolo)).not.toContain('Avanzamento produzione');
  });

  it('un database senza menu (installazione nuova, prima del seed) non la registra: la farà l\'avvio dopo il seed', async () => {
    const { fonte, menu, registro } = creaFonte([]);

    expect(await migraMenuAvanzamento(fonte, nuovoId)).toMatchObject({ stato: 'senza-menu' });
    expect(registro.esiti).toEqual([]);
    expect(menu.incrementaVersione).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('se nessun menu ha Promozioni in corso si registra lo stesso, senza alzare la versione', async () => {
    const { fonte, menu, registro } = creaFonte([riga('cat-vol', CATEGORY, 'Volantini attivi', '/volantini/attivi', 0)]);

    const esito = await migraMenuAvanzamento(fonte, nuovoId);

    expect(esito).toEqual({ stato: 'eseguita', menu: 0, aggiornate: 0, inserite: 0 });
    expect(registro.esiti).toHaveLength(1);
    expect(menu.incrementaVersione).not.toHaveBeenCalled();
  });

  it('se una scrittura fallisce nessun menu cambia e non resta registrata', async () => {
    const { fonte, menu, registro, tabella } = creaFonte(menuSalvati());
    vi.mocked(menu.inserisciVoce).mockRejectedValueOnce(new Error('scrittura fallita'));

    await expect(migraMenuAvanzamento(fonte, nuovoId)).rejects.toThrow('scrittura fallita');

    expect(menuDi(tabella(), AGENZIA).map(([titolo]) => titolo)).not.toContain('Avanzamento produzione');
    expect(registro.esiti).toEqual([]);
  });
});
