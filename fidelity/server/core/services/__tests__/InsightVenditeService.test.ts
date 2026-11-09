import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../../../lib/errors';
import type { RegolePrevisione, RichiestaSimulazione } from '../../../../lib/insightVolantino/rendimento';
import type { PdfVolantino, PesiVisibilita } from '../../../../lib/insightVolantino/tipi';
import type { AmbitoGdo } from '../../accessi/contestoAccesso';
import type { RigaReferenzaKit } from '../../repositories/AnalisiPuntiVenditaRepository';
import type {
  AmbitoVendite,
  EdizionePrecedente,
  IInsightVenditeRepository,
  PeriodoDiVendita,
} from '../../repositories/InsightVenditeRepository';
import type { KitInsight } from '../../repositories/InsightVolantinoRepository';
import type { RigaReferenza } from '../../utils/referenzaStampata';
import type { VenditeDelPeriodo } from '../../utils/rendimentoInsight';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Le letture del kit (InsightVolantinoRepository) arrivano finte dal costruttore: il modulo vero
// non si carica, cosi' il test non tocca il database.
vi.mock('../../repositories/InsightVolantinoRepository', () => ({
  kitNellAmbito: vi.fn(),
  pdfDelKit: vi.fn(),
  righeDelKit: vi.fn(),
}));

import type { LettureKitInsight } from '../InsightConfrontiService';
import { DURATA_CACHE_PREVISIONE_MS, InsightVenditeService, oggiARoma, periodoDelKit } from '../InsightVenditeService';

// Rendimento dalle vendite, previsione e simulazione del volantino: ambito GDO, vendite cercate per
// area, canale, periodo e codici del volantino, storico delle edizioni precedenti, regole e pesi della
// libreria agenzia del cliente. I calcoli hanno i loro test (rendimentoInsight, previsioneInsight):
// qui i conti sono quelli piu' semplici, con casiMinimi 0.

const GDO = '11111111-1111-4111-8111-111111111111';
const AMBITO: AmbitoGdo = { idGdo: GDO };
const ID_KIT = 'a0000000-0000-4000-8000-000000000001';
const ID_FEBBRAIO = 'a0000000-0000-4000-8000-000000000002';
const ID_GENNAIO = 'a0000000-0000-4000-8000-000000000003';
const ESTRANEO = 'a0000000-0000-4000-8000-000000000099';

const kitInsight = (id: string, dati: Partial<KitInsight> = {}): KitInsight => ({
  id,
  titolo: 'Volantino Liguria',
  idPromo: 'promo-marzo',
  nomePromo: 'Promo di marzo',
  idArea: 'area-li',
  idCanale: 'canale-ss',
  area: 'Liguria',
  canale: 'Superstore',
  validitaDal: '2026-03-10',
  validitaAl: '2026-03-20',
  data: '2026-03-10',
  storico: false,
  importStorico: null,
  gdo: GDO,
  ...dati,
});

const KIT = kitInsight(ID_KIT);
const FEBBRAIO = kitInsight(ID_FEBBRAIO, { titolo: 'Volantino febbraio', idPromo: 'promo-febbraio', validitaDal: '2026-02-10', validitaAl: '2026-02-20', data: '2026-02-10' });
const GENNAIO = kitInsight(ID_GENNAIO, { titolo: 'Volantino gennaio', idPromo: 'promo-gennaio', validitaDal: '2026-01-10', validitaAl: '2026-01-20', data: '2026-01-10' });

/** Pagina 100×100: un box 50×20 e' il 10% della pagina. In alto: y 0; in fondo: y 80. */
const IN_COPERTINA_ALTO = { pag: 1, x: 0, y: 0 } as const;
const DENTRO_IN_FONDO = { pag: 5, x: 0, y: 80 } as const;

const riga = (id: string, dati: Record<string, unknown>, extra: Partial<RigaReferenza> = {}): RigaReferenza => ({
  id,
  compiled_fields: [],
  data_fields: dati,
  foto: [],
  meccanica: '',
  codice_box: id,
  group_elements: [],
  pag: 1,
  x: 0,
  y: 0,
  w: 50,
  h: 20,
  w_page: 100,
  h_page: 100,
  perc_ingombro: null,
  ...extra,
});

const dellEdizione = (idKit: string, voce: RigaReferenza): RigaReferenzaKit => ({ ...voce, id_runtime_kit: idKit, aggiornata_il: null, storico: false });

// La mozzarella ha codice "000123" nel volantino; le vendite la scrivono "123"
const RIGHE_KIT = [
  riga('k-a', { codice_referenza: '000123', descrizione_uno: 'Mozzarella' }, IN_COPERTINA_ALTO),
  riga('k-b', { codice_referenza: 'B7', descrizione_uno: 'Acqua' }, DENTRO_IN_FONDO),
  riga('k-c', { codice_referenza: 'C1', descrizione_uno: 'Olio' }, { x: null, y: null }),
];
const RIGHE_STORICO = [
  dellEdizione(ID_FEBBRAIO, riga('f-a', { codice_referenza: '000123', descrizione_uno: 'Mozzarella' }, IN_COPERTINA_ALTO)),
  dellEdizione(ID_GENNAIO, riga('g-a', { codice_referenza: '000123', descrizione_uno: 'Mozzarella' }, DENTRO_IN_FONDO)),
];
const PDF_8_PAGINE: PdfVolantino = { idOlimpoCloud: 'olimpo', pagine: 8 };
const EDIZIONI: EdizionePrecedente[] = [{ kit: FEBBRAIO, pdf: PDF_8_PAGINE }, { kit: GENNAIO, pdf: PDF_8_PAGINE }];

/** Pezzi per kit e codice: la mozzarella 200 in copertina a febbraio, 100 dentro a gennaio. */
const PEZZI: Record<string, Record<string, number>> = {
  [ID_KIT]: { '123': 250, B7: 50 },
  [ID_FEBBRAIO]: { '123': 200 },
  [ID_GENNAIO]: { '123': 100 },
};

const REGOLE_ESATTE: Partial<RegolePrevisione> = { casiMinimi: 0 };

function creaServizio(opzioni: {
  kit?: KitInsight;
  righe?: RigaReferenza[];
  pezzi?: Record<string, Record<string, number>>;
  previsione?: Partial<RegolePrevisione>;
  pesiVisibilita?: PesiVisibilita;
  adesso?: () => Date;
  /** "Vendite e previsioni" della GDO (default accesa, per provare il modello). */
  venditeAttive?: boolean;
} = {}) {
  const kit = opzioni.kit ?? KIT;
  const pezzi = opzioni.pezzi ?? PEZZI;
  const letture = {
    kitNellAmbito: vi.fn(async (idKit: string, _ambito: AmbitoGdo) => (idKit === kit.id ? kit : null)),
    pdfDelKit: vi.fn(async (_idKit: string): Promise<PdfVolantino | null> => PDF_8_PAGINE),
    righeDelKit: vi.fn(async (_idKit: string) => opzioni.righe ?? RIGHE_KIT),
  } satisfies LettureKitInsight;
  const repository = {
    venditeNeiPeriodi: vi.fn(async (_ambito: AmbitoVendite, periodi: readonly PeriodoDiVendita[], codici: readonly string[]) => {
      const risultato = new Map<string, VenditeDelPeriodo>();
      for (const periodo of periodi) {
        const perCodice = new Map(Object.entries(pezzi[periodo.idKit] ?? {})
          .filter(([codice]) => codici.includes(codice))
          .map(([codice, quanti]) => [codice, { pezzi: quanti, valore: null }] as const));
        if (perCodice.size > 0) {
          risultato.set(periodo.idKit, { periodo: { dal: periodo.dal, al: periodo.al }, puntiVendita: 7, perCodice, conValore: false });
        }
      }
      return risultato;
    }),
    edizioniPrecedenti: vi.fn(async (_kit: KitInsight, _quante: number) => EDIZIONI),
  } satisfies IInsightVenditeRepository;
  const referenze = {
    referenzeDeiKit: vi.fn(async (idKit: readonly string[]) => RIGHE_STORICO.filter(voce => idKit.includes(voce.id_runtime_kit))),
  };
  const config = {
    getFlyerInsightsConfig: vi.fn(async () => ({})),
    getFunzionalita: vi.fn(async (_idGdo: string | null) => ({ momenti: false, menabo: false, vendite: opzioni.venditeAttive ?? true })),
  };
  const agenziaLib = { insightVolantino: { previsione: opzioni.previsione, pesiVisibilita: opzioni.pesiVisibilita } };
  const orologio = opzioni.adesso ?? (() => new Date('2026-03-01T10:00:00Z'));
  const servizio = new InsightVenditeService(repository, referenze, config, agenziaLib, letture, orologio);
  return { servizio, letture, repository, referenze, config };
}

const richiesta = (dati: Partial<RichiestaSimulazione> = {}): RichiestaSimulazione => ({
  chiave: 'c-000123', pagina: 1, x: 0.25, y: 0.1, spazio: 10, sconto: null, ...dati,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('kit e ambito GDO', () => {
  it('un kit inesistente o di un\'altra GDO e\' 404 per tutte e tre, senza leggere vendite ne\' storico', async () => {
    const { servizio, letture, repository } = creaServizio();

    await expect(servizio.rendimento(ESTRANEO, AMBITO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.previsione(ESTRANEO, AMBITO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.simula(ESTRANEO, richiesta(), AMBITO)).rejects.toBeInstanceOf(NotFoundError);

    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ESTRANEO, AMBITO);
    expect(letture.righeDelKit).not.toHaveBeenCalled();
    expect(repository.venditeNeiPeriodi).not.toHaveBeenCalled();
    expect(repository.edizioniPrecedenti).not.toHaveBeenCalled();
  });

  it('un id che non e\' un UUID risponde come un kit inesistente, senza cercarlo', async () => {
    const { servizio, letture } = creaServizio();

    await expect(servizio.rendimento('42', AMBITO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.previsione('non-un-kit', 'tutte')).rejects.toBeInstanceOf(NotFoundError);
    expect(letture.kitNellAmbito).not.toHaveBeenCalled();
  });
});

describe('rendimento', () => {
  it('vendite dei codici dei box con geometria, nella forma delle vendite, nell\'area, canale e periodo del volantino', async () => {
    const { servizio, repository, letture } = creaServizio();

    const rendimento = await servizio.rendimento(ID_KIT, AMBITO);

    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ID_KIT, AMBITO);
    expect(repository.venditeNeiPeriodi).toHaveBeenCalledWith(
      { idGdo: GDO, idArea: 'area-li', idCanale: 'canale-ss' },
      [{ idKit: ID_KIT, dal: '2026-03-10', al: '2026-03-20' }],
      // C1 non ha geometria: non si cerca
      ['123', 'B7'],
    );
    expect(rendimento).toMatchObject({ periodo: { dal: '2026-03-10', al: '2026-03-20' }, puntiVendita: 7, misura: 'pezzi', totalePezzi: 300 });
    expect(rendimento?.perBox.map(voce => [voce.idBox, voce.pezzi, voce.quota])).toEqual([['k-a', 250, 83.3], ['k-b', 50, 16.7]]);
  });

  it('null senza vendite nel periodo, senza date della promo o senza GDO del kit', async () => {
    expect(await creaServizio({ pezzi: {} }).servizio.rendimento(ID_KIT, AMBITO)).toBeNull();

    const senzaDate = creaServizio({ kit: kitInsight(ID_KIT, { validitaDal: null, validitaAl: null }) });
    expect(await senzaDate.servizio.rendimento(ID_KIT, AMBITO)).toBeNull();
    expect(senzaDate.repository.venditeNeiPeriodi).not.toHaveBeenCalled();

    const senzaGdo = creaServizio({ kit: kitInsight(ID_KIT, { gdo: null }) });
    expect(await senzaGdo.servizio.rendimento(ID_KIT, 'tutte')).toBeNull();
    expect(senzaGdo.repository.venditeNeiPeriodi).not.toHaveBeenCalled();
  });

  it('una config degli insight che non si legge non ferma il rendimento', async () => {
    const { servizio, config } = creaServizio();
    config.getFlyerInsightsConfig.mockRejectedValueOnce(new Error('config assente'));

    expect((await servizio.rendimento(ID_KIT, AMBITO))?.totalePezzi).toBe(300);
  });
});

describe('previsione', () => {
  it('dalle vendite delle edizioni precedenti della stessa area e canale, con il reale del volantino', async () => {
    const { servizio, repository, referenze } = creaServizio({ previsione: REGOLE_ESATTE });

    const previsione = await servizio.previsione(ID_KIT, AMBITO);

    expect(repository.edizioniPrecedenti).toHaveBeenCalledWith(KIT, 26);
    expect(referenze.referenzeDeiKit).toHaveBeenCalledWith([ID_FEBBRAIO, ID_GENNAIO]);
    expect(repository.venditeNeiPeriodi).toHaveBeenCalledWith(
      { idGdo: GDO, idArea: 'area-li', idCanale: 'canale-ss' },
      [{ idKit: ID_FEBBRAIO, dal: '2026-02-10', al: '2026-02-20' }, { idKit: ID_GENNAIO, dal: '2026-01-10', al: '2026-01-20' }],
      ['123'],
    );
    expect(previsione).toMatchObject({ tipo: 'vendite', unita: 'pezzi', edizioniStoriche: 2, promoValida: false });
    // Mozzarella in copertina come a febbraio: 200; l'acqua non ha storico, vale la media (150) in fondo a una pagina interna (2/3)
    expect(previsione?.perBox.map(voce => [voce.idBox, voce.valore, voce.casiStorici, voce.reale])).toEqual([
      ['k-a', 200, 2, 250],
      ['k-b', 100, 0, 50],
    ]);
    expect(previsione?.scartoMedio).toBe(33.3);
  });

  it('le regole della libreria agenzia del cliente: quante edizioni guardare', async () => {
    const { servizio, repository } = creaServizio({ previsione: { edizioniStoriche: 4 } });

    await servizio.previsione(ID_KIT, AMBITO);

    expect(repository.edizioniPrecedenti).toHaveBeenCalledWith(KIT, 4);
  });

  it('teorica senza vendite nelle edizioni precedenti, con i pesi della visibilita\' del cliente', async () => {
    const senzaStorico = { [ID_KIT]: PEZZI[ID_KIT] };
    const standard = await creaServizio({ pezzi: senzaStorico }).servizio.previsione(ID_KIT, AMBITO);
    const tuttiUguali: PesiVisibilita = { copertina: 1, ultima: 1, primaDoppia: 1, altre: 1, alto: 1, basso: 1 };
    const delCliente = await creaServizio({ pezzi: senzaStorico, pesiVisibilita: tuttiUguali }).servizio.previsione(ID_KIT, AMBITO);

    expect(standard).toMatchObject({ tipo: 'teorica', unita: 'indice', edizioniStoriche: 0 });
    expect(standard?.nota).toMatch(/^Stima teorica: nessuna vendita importata/);
    // 10 × 1 × 0.96 contro 10 × 0.5 × 0.64
    expect(standard?.perBox.map(voce => voce.valore)).toEqual([100, 33.3]);
    expect(delCliente?.perBox.map(voce => voce.valore)).toEqual([100, 100]);
  });

  it('null senza box con geometria, senza leggere lo storico', async () => {
    const { servizio, repository } = creaServizio({ righe: [riga('k-c', { codice_referenza: 'C1' }, { x: null, y: null })] });

    expect(await servizio.previsione(ID_KIT, AMBITO)).toBeNull();
    expect(repository.edizioniPrecedenti).not.toHaveBeenCalled();
  });

  it('un kit senza GDO non ha storico: stima teorica', async () => {
    const { servizio, repository } = creaServizio({ kit: kitInsight(ID_KIT, { gdo: null }) });

    expect((await servizio.previsione(ID_KIT, 'tutte'))?.tipo).toBe('teorica');
    expect(repository.edizioniPrecedenti).not.toHaveBeenCalled();
  });

  it('la promo gia\' iniziata, nel calendario di Roma', async () => {
    // 23:30 UTC del 9 marzo: a Roma e' gia' il 10, il primo giorno della promo
    const { servizio } = creaServizio({ adesso: () => new Date('2026-03-09T23:30:00Z') });

    expect((await servizio.previsione(ID_KIT, AMBITO))?.promoValida).toBe(true);
    expect(oggiARoma(new Date('2026-03-09T22:30:00Z'))).toBe('2026-03-09');
  });
});

describe('simulazione', () => {
  it('nello stesso modello della previsione, con i casi simili del prodotto', async () => {
    const { servizio } = creaServizio({ previsione: REGOLE_ESATTE });

    const simulazione = await servizio.simula(ID_KIT, richiesta(), AMBITO);

    expect(simulazione).toMatchObject({ tipo: 'vendite', unita: 'pezzi', valore: 200, casiStorici: 2 });
    expect(simulazione.casiSimili.map(caso => [caso.idKit, caso.titolo, caso.data, caso.valore])).toEqual([
      [ID_FEBBRAIO, 'Volantino febbraio', '2026-02-10', 200],
      [ID_GENNAIO, 'Volantino gennaio', '2026-01-10', 100],
    ]);
  });

  it.each([
    ['chiave vuota', { chiave: ' ' }],
    ['chiave che non e\' di un prodotto', { chiave: 'x-123' }],
    ['pagina 0', { pagina: 0 }],
    ['x fuori pagina', { x: 1.2 }],
    ['spazio 0', { spazio: 0 }],
    ['sconto oltre 100', { sconto: 120 }],
  ])('%s: 400 prima di cercare il kit', async (_, errata) => {
    const { servizio, letture } = creaServizio();

    await expect(servizio.simula(ID_KIT, richiesta(errata), AMBITO)).rejects.toBeInstanceOf(ValidationError);
    expect(letture.kitNellAmbito).not.toHaveBeenCalled();
  });

  it('previsione e simulazioni dello stesso volantino leggono lo storico una volta', async () => {
    const { servizio, repository, referenze } = creaServizio();

    await servizio.previsione(ID_KIT, AMBITO);
    await servizio.simula(ID_KIT, richiesta(), AMBITO);
    await servizio.simula(ID_KIT, richiesta({ pagina: 5, y: 0.9 }), AMBITO);

    expect(repository.edizioniPrecedenti).toHaveBeenCalledTimes(1);
    expect(referenze.referenzeDeiKit).toHaveBeenCalledTimes(1);
  });

  it('lo storico in memoria scade; un calcolo fallito non resta in memoria', async () => {
    let adesso = new Date('2026-03-01T10:00:00Z').getTime();
    const { servizio, repository } = creaServizio({ adesso: () => new Date(adesso) });
    repository.edizioniPrecedenti.mockRejectedValueOnce(new Error('database non raggiungibile'));

    await expect(servizio.previsione(ID_KIT, AMBITO)).rejects.toThrow('database non raggiungibile');
    await servizio.previsione(ID_KIT, AMBITO);
    expect(repository.edizioniPrecedenti).toHaveBeenCalledTimes(2);

    adesso += DURATA_CACHE_PREVISIONE_MS + 1;
    await servizio.simula(ID_KIT, richiesta(), AMBITO);
    expect(repository.edizioniPrecedenti).toHaveBeenCalledTimes(3);
  });
});

describe('vendite e previsioni: funzionalita da attivare per GDO', () => {
  it('spenta per la GDO del volantino: niente previsione, senza leggere lo storico', async () => {
    const { servizio, config, repository } = creaServizio({ venditeAttive: false });

    expect(await servizio.previsione(KIT.id, AMBITO)).toBeNull();
    expect(config.getFunzionalita).toHaveBeenCalledWith(KIT.gdo);
    expect(repository.edizioniPrecedenti).not.toHaveBeenCalled();
  });

  it('spenta: la simulazione e\' rifiutata con 403', async () => {
    const { servizio } = creaServizio({ venditeAttive: false });

    await expect(servizio.simula(KIT.id, richiesta(), AMBITO)).rejects.toMatchObject({
      httpStatus: 403,
      message: 'Vendite e previsioni non sono attive per questa GDO',
    });
  });

  it('spenta: niente rendimento dalle vendite, senza leggerle', async () => {
    const { servizio, repository } = creaServizio({ venditeAttive: false });

    expect(await servizio.rendimento(KIT.id, AMBITO)).toBeNull();
    expect(repository.venditeNeiPeriodi).not.toHaveBeenCalled();
  });

  it('accesa: rendimento e previsione ci sono', async () => {
    const { servizio } = creaServizio({ venditeAttive: true });

    expect(await servizio.rendimento(KIT.id, AMBITO)).not.toBeNull();
    expect(await servizio.previsione(KIT.id, AMBITO)).not.toBeNull();
  });

  it('se le funzionalita non si leggono, vendite e previsioni restano spente', async () => {
    const { servizio, config } = creaServizio();
    config.getFunzionalita.mockRejectedValueOnce(new Error('config non raggiungibile'));

    expect(await servizio.previsione(KIT.id, AMBITO)).toBeNull();
  });
});

describe('periodoDelKit', () => {
  it('le date della promo; con una sola, quel giorno; senza date o invertite nessun periodo', () => {
    expect(periodoDelKit({ validitaDal: '2026-03-10', validitaAl: '2026-03-20' })).toEqual({ dal: '2026-03-10', al: '2026-03-20' });
    expect(periodoDelKit({ validitaDal: '2026-03-10', validitaAl: null })).toEqual({ dal: '2026-03-10', al: '2026-03-10' });
    expect(periodoDelKit({ validitaDal: null, validitaAl: null })).toBeNull();
    expect(periodoDelKit({ validitaDal: '2026-03-20', validitaAl: '2026-03-10' })).toBeNull();
  });
});
