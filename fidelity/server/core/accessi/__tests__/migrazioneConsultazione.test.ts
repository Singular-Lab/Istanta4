import { describe, expect, it, vi } from 'vitest';
import { PERMESSI as P } from '../../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import type { RigaMenu } from '../../inizializzazione/migrazioneMenuMateriali';
import { calcolaPianoConsultazione, descriviPianoConsultazione, type RigaLivello } from '../migrazioneConsultazione';

const riga = (tipo: TIPO_UTENTI, codice: string, altro: Partial<RigaLivello> = {}): RigaLivello => ({
  tipo_utente: tipo, id_ruolo_utente_gdo: null, id_gdo: null, codice, abilitato: true, ...altro,
});

const voceMenu = (id: string, titolo: string, pathname: string | null, ordinamento: number, altro: Partial<RigaMenu> = {}): RigaMenu => ({
  id_menu_item: id,
  tipo_utente: TIPO_UTENTI.AGENZIA,
  ruolo_gdo: null,
  id_ruolo_utente_gdo: null,
  id_parent: null,
  tipo: pathname ? 'item' : 'separator',
  titolo,
  icona: null,
  pathname,
  codice_permesso: null,
  disabilitato: false,
  start_page: false,
  ordinamento,
  ...altro,
});

/** Le modifiche come testo, solo per i codici indicati (o tutte). */
const sintesi = (piano: ReturnType<typeof calcolaPianoConsultazione>, codici?: string[]) =>
  piano.modifiche
    .filter(m => !codici || codici.indexOf(m.codice) >= 0)
    .map(m => `${m.abilitato ? '+' : '-'} ${m.tipo}${m.idRuoloGdo ? `/${m.idRuoloGdo}` : ''}${m.idGdo ? `@${m.idGdo}` : ''} ${m.codice}`)
    .sort();

describe('schema 2 degli accessi: permessi di consultazione e Agenzia', () => {
  it('chi scaricava file o apriva le promozioni riceve i permessi di consultazione, a ogni livello', () => {
    const piano = calcolaPianoConsultazione([
      riga(TIPO_UTENTI.GDO, P.FILE.DOWNLOAD),
      riga(TIPO_UTENTI.GDO, P.PROMO.VISUALIZZA),
      riga(TIPO_UTENTI.GDO, P.FILE.DOWNLOAD, { id_ruolo_utente_gdo: 'admin' }),
      riga(TIPO_UTENTI.CATEGORY, P.PROMO.VISUALIZZA, { id_gdo: 'coop' }),
      // Disabilitato: niente da conservare
      riga(TIPO_UTENTI.MARKETING, P.FILE.DOWNLOAD, { abilitato: false }),
      // Il Superadmin ha gia' tutto
      riga(TIPO_UTENTI.SUPERADMIN, P.FILE.DOWNLOAD),
    ], []);

    expect(sintesi(piano, [P.MATERIALI.SCARICA])).toEqual([
      `+ GDO ${P.MATERIALI.SCARICA}`,
      `+ GDO/admin ${P.MATERIALI.SCARICA}`,
    ]);
    expect(sintesi(piano, [P.ANALISI.VISUALIZZA, P.PROMO.GESTISCI_MOMENTI, P.PROMO.GESTISCI_SCHEMI]).filter(r => !r.includes('Category ') && !r.includes('Marketing '))).toEqual([
      `+ Category@coop ${P.ANALISI.VISUALIZZA}`,
      `+ Category@coop ${P.PROMO.GESTISCI_MOMENTI}`,
      `+ Category@coop ${P.PROMO.GESTISCI_SCHEMI}`,
      `+ GDO ${P.ANALISI.VISUALIZZA}`,
      `+ GDO ${P.PROMO.GESTISCI_MOMENTI}`,
      `+ GDO ${P.PROMO.GESTISCI_SCHEMI}`,
    ]);
  });

  it('un livello che ha gia\' il permesso di consultazione, anche disabilitato, non cambia', () => {
    const piano = calcolaPianoConsultazione([
      riga(TIPO_UTENTI.GDO, P.FILE.DOWNLOAD),
      riga(TIPO_UTENTI.GDO, P.MATERIALI.SCARICA, { abilitato: false }),
      riga(TIPO_UTENTI.GUEST, P.VOLANTINI.VISUALIZZA, { abilitato: false }),
    ], []);

    expect(sintesi(piano, [P.MATERIALI.SCARICA])).toEqual([]);
    expect(sintesi(piano, [P.VOLANTINI.VISUALIZZA])).not.toContain(`+ Guest ${P.VOLANTINI.VISUALIZZA}`);
  });

  it('l\'Agenzia perde Visualizzazione e Comunicazione, anche negli override, e non riceve i permessi di consultazione', () => {
    const piano = calcolaPianoConsultazione([
      riga(TIPO_UTENTI.AGENZIA, P.FILE.DOWNLOAD),
      riga(TIPO_UTENTI.AGENZIA, P.PROMO.VISUALIZZA),
      riga(TIPO_UTENTI.AGENZIA, P.MATERIALI.VISUALIZZA),
      riga(TIPO_UTENTI.AGENZIA, P.GDO.VISUALIZZA),
      riga(TIPO_UTENTI.AGENZIA, P.WHATSAPP.VISUALIZZA_CAMPAGNE, { id_gdo: 'coop' }),
      // Gia' disabilitato nell'override: niente da togliere
      riga(TIPO_UTENTI.AGENZIA, P.VOLANTINI.VISUALIZZA, { id_gdo: 'coop', abilitato: false }),
    ], []);

    expect(piano.modifiche.filter(m => m.tipo === TIPO_UTENTI.AGENZIA && !m.abilitato).map(m => `${m.idGdo ?? ''} ${m.codice}`).sort()).toEqual([
      ` ${P.MATERIALI.VISUALIZZA}`,
      `coop ${P.WHATSAPP.VISUALIZZA_CAMPAGNE}`,
    ]);
    // Nessun permesso di Visualizzazione all'Agenzia; quelli di Produzione si'
    expect(sintesi(piano).filter(r => r.startsWith('+ Agenzia'))).toEqual([
      `+ Agenzia ${P.PROMO.GESTISCI_MOMENTI}`,
      `+ Agenzia ${P.PROMO.GESTISCI_SCHEMI}`,
    ]);
  });

  it('le pagine aperte a tutti chiedono ora un permesso: chi le apriva lo riceve', () => {
    const menu = [
      voceMenu('mkt', 'Dashboard Marketing', '/marketing/dashboard', 0, { tipo_utente: TIPO_UTENTI.GDO, id_ruolo_utente_gdo: 'admin' }),
      voceMenu('mkt-ag', 'Dashboard Marketing', '/marketing/dashboard', 0),
    ];

    const piano = calcolaPianoConsultazione([], menu);
    const panoramica = sintesi(piano, [P.VOLANTINI.VISUALIZZA]);

    expect(panoramica).toEqual(expect.arrayContaining([
      `+ Category ${P.VOLANTINI.VISUALIZZA}`, `+ GDO ${P.VOLANTINI.VISUALIZZA}`, `+ Guest ${P.VOLANTINI.VISUALIZZA}`,
      `+ Marketing ${P.VOLANTINI.VISUALIZZA}`, `+ PuntoVendita ${P.VOLANTINI.VISUALIZZA}`,
    ]));
    expect(panoramica.some(r => r.includes('Agenzia') || r.includes('Superadmin'))).toBe(false);
    expect(sintesi(piano, [P.ANALISI.DASHBOARD_CATEGORY, P.ANALISI.DASHBOARD_MARKETING, P.ANALISI.VISUALIZZA])).toEqual([
      `+ Category ${P.ANALISI.DASHBOARD_CATEGORY}`,
      `+ Category ${P.ANALISI.VISUALIZZA}`,
      `+ GDO/admin ${P.ANALISI.DASHBOARD_MARKETING}`,
      `+ GDO/admin ${P.ANALISI.VISUALIZZA}`,
      `+ Marketing ${P.ANALISI.DASHBOARD_MARKETING}`,
      `+ Marketing ${P.ANALISI.VISUALIZZA}`,
    ]);
  });

  it('pulisce i menu salvati dell\'Agenzia, non quelli degli altri tipi', () => {
    const menu = [
      voceMenu('dashboard', 'Dashboard', '/gdo/dashboard', 0, { start_page: true }),
      voceMenu('avanzamento', 'Avanzamento produzione', '/avanzamento-produzione', 1),
      voceMenu('cat-dashboard', 'Dashboard', '/gdo/dashboard', 0, { tipo_utente: TIPO_UTENTI.CATEGORY }),
    ];

    const piano = calcolaPianoConsultazione([], menu);

    expect(piano.menu).toEqual([{
      nome: TIPO_UTENTI.AGENZIA,
      tolte: [expect.objectContaining({ id_menu_item: 'dashboard' })],
      aggiornate: [expect.objectContaining({ id_menu_item: 'avanzamento', start_page: true })],
    }]);
  });

  it('il registro elenca i permessi concessi e tolti e le voci tolte da ogni menu', () => {
    const piano = calcolaPianoConsultazione(
      [riga(TIPO_UTENTI.GDO, P.FILE.DOWNLOAD), riga(TIPO_UTENTI.AGENZIA, P.MATERIALI.VISUALIZZA)],
      [voceMenu('dashboard', 'Dashboard', '/gdo/dashboard', 0, { start_page: true }), voceMenu('avanzamento', 'Avanzamento produzione', '/avanzamento-produzione', 1)]
    );

    const registro = descriviPianoConsultazione(piano, tipo => tipo);

    expect(registro).toContain(`+ ${P.MATERIALI.SCARICA}  (aveva ${P.FILE.DOWNLOAD})`);
    expect(registro).toContain(`- ${P.MATERIALI.VISUALIZZA}`);
    expect(registro).toContain('- Dashboard (/gdo/dashboard)');
    expect(registro).toContain('pagina iniziale: Avanzamento produzione (/avanzamento-produzione)');
  });
});
