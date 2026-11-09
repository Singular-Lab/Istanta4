import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import { type BoxInsight, MAX_TAPPE_VIAGGIO, type PdfVolantino, type TappaProdotto } from '../../../../lib/insightVolantino/tipi';
import type { ImportStorico } from '../../../../lib/types';
import type { AmbitoGdo } from '../../accessi/contestoAccesso';
import type { RiepilogoDaSalvare, RigaReferenzaKit } from '../../repositories/AnalisiPuntiVenditaRepository';
import type { IInsightConfrontiRepository } from '../../repositories/InsightConfrontiRepository';
import type { KitInsight } from '../../repositories/InsightVolantinoRepository';
import {
  AGGREGATI_VUOTI,
  aggregatiDi,
  type BoxKit,
  descrizioneDaCompatta,
  prodottoDaCompatto,
  type RiepilogoKit,
} from '../../utils/analisiKit';
import { chiaveDescrizione } from '../../utils/analisiPuntoVendita';
import type { OpzioniInsight } from '../../utils/insightVolantino';
import { scontoDaiPrezzi } from '../../utils/referenzaStampata';
import { urlFotoOlimpo } from '../../utils/urlOlimpo';

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

// Box e sezioni degli insight (utils/insightVolantino) hanno i loro test: qui finti e semplici, per
// vedere con quali opzioni li chiama il servizio e come ne combina i risultati.
const insight = vi.hoisted(() => {
  const boxFinti = (box: readonly BoxKit[], opzioni: OpzioniInsight) => box.map(singolo => ({
    id: singolo.id,
    codiceBox: singolo.codiceBox,
    pagina: singolo.pagina,
    spazio: singolo.geometria?.spazio ?? 0,
    chiave: singolo.prodotti[0]?.chiave ?? '',
    nome: singolo.prodotti[0]?.nome ?? '',
    reparto: opzioni.repartoConfigurato?.(singolo.id) ?? null,
    origine: opzioni.origine?.(singolo.codiceBox),
  }) as unknown as BoxInsight);
  return {
    boxInsight: vi.fn(boxFinti),
    sezioniInsight: vi.fn((box: readonly BoxKit[], opzioni: OpzioniInsight) => {
      // Spazio per reparto: la somma degli spazi dei box, per il reparto della config
      const perReparto = new Map<string, { etichetta: string; spazio: number }>();
      for (const singolo of box) {
        const reparto = opzioni.repartoConfigurato?.(singolo.id) ?? { codice: '', descrizione: 'Reparto non indicato' };
        const voce = perReparto.get(reparto.codice) ?? { etichetta: reparto.descrizione, spazio: 0 };
        voce.spazio += singolo.geometria?.spazio ?? 0;
        perReparto.set(reparto.codice, voce);
      }
      const sconti = box.flatMap(singolo => (singolo.sconto === null ? [] : [singolo.sconto]));
      return {
        box: boxFinti(box, opzioni),
        sintesi: {
          referenze: box.reduce((totale, singolo) => totale + singolo.referenze.length, 0),
          box: box.length,
          pagine: opzioni.totalePagine,
          scontoMedio: sconti.length === 0 ? null : sconti.reduce((a, b) => a + b, 0) / sconti.length,
          boxConSconto: sconti.length,
          quotaFidelity: box.length === 0 ? 0 : (box.filter(singolo => singolo.meccanica === 'fidelity').length / box.length) * 100,
          sottocosto: 0,
          marche: 0,
          copertura: { prezzo: 0, marca: 0, reparto: 0, geometria: 0 },
        },
        prezziSconti: { fasce: [], perReparto: [], perMeccanica: [], sottocosto: [], conPrezzoAlKg: 0 },
        spazio: {
          perReparto: [...perReparto].map(([chiave, voce]) => ({
            chiave, etichetta: voce.etichetta, referenze: 0, spazio: voce.spazio, quotaReferenze: 0, quotaSpazio: voce.spazio,
          })),
          perMeccanica: [],
          perMarca: [],
          perPagina: [],
        },
        marche: { elenco: [], quotaDistributore: null },
        zoneCalde: { boxPiuVisibili: [], perReparto: [], perMarca: [], calore: [], pesi: {} },
      } as never;
    }),
  };
});
vi.mock('../../utils/insightVolantino', () => insight);

import { contestoDallaConfig, InsightConfrontiService, limitaTappe, type LettureKitInsight, type RepositoryAnalisiViaggio } from '../InsightConfrontiService';

const GDO = '11111111-1111-4111-8111-111111111111';
const AMBITO: AmbitoGdo = { idGdo: GDO };
const ID_KIT = 'a0000000-0000-4000-8000-000000000001';
const ID_PRECEDENTE = 'a0000000-0000-4000-8000-000000000002';
const ID_VARIANTE = 'a0000000-0000-4000-8000-000000000003';
const ID_ALTRA_PROMO = 'a0000000-0000-4000-8000-000000000004';
const ESTRANEO = 'a0000000-0000-4000-8000-000000000099';

const IMPORT_STORICO: ImportStorico = {
  importatoIl: '2026-02-01T09:00:00Z',
  nonImpaginate: [],
  lasciapassareNonImpaginate: false,
  fuoriListino: [{ codiceBox: 'box-manuale', pag: 1 }],
  fuoriListinoIgnorati: 0,
};

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
/** L'edizione precedente viene dallo storico, con un box compilato a mano. */
const PRECEDENTE = kitInsight(ID_PRECEDENTE, {
  titolo: 'Volantino Liguria febbraio', idPromo: 'promo-febbraio', nomePromo: 'Promo di febbraio',
  validitaDal: '2026-02-10', validitaAl: '2026-02-20', data: '2026-02-10', storico: true, importStorico: IMPORT_STORICO,
});
const VARIANTE = kitInsight(ID_VARIANTE, { titolo: 'Volantino Toscana', idArea: 'area-to', area: 'Toscana' });
const ALTRA_PROMO = kitInsight(ID_ALTRA_PROMO, { idPromo: 'promo-aprile' });
const KIT_PER_ID = new Map([KIT, PRECEDENTE, VARIANTE, ALTRA_PROMO].map(kit => [kit.id, kit] as const));

const riga = (idKit: string, id: string, dati: Record<string, unknown>, extra: Partial<RigaReferenzaKit> = {}): RigaReferenzaKit => ({
  id,
  id_runtime_kit: idKit,
  compiled_fields: [],
  data_fields: dati,
  foto: [],
  meccanica: '',
  codice_box: id,
  group_elements: [],
  pag: 1,
  x: 10,
  y: 10,
  w: 50,
  h: 50,
  w_page: 210,
  h_page: 287,
  perc_ingombro: null,
  aggiornata_il: new Date('2026-10-01T10:00:00Z'),
  storico: false,
  ...extra,
});

const RIGHE: RigaReferenzaKit[] = [
  riga(ID_KIT, 'k-a', { codice_referenza: 'A', descrizione_uno: 'Mozzarella', descrizione_due: 'Latteria', prezzo: 1.2, prezzo_anziche: 2, reparto: '1' }, { foto: ['guid-mozzarella'] }),
  riga(ID_KIT, 'k-b', { codice_referenza: 'B', descrizione_uno: 'Acqua', prezzo: 3, reparto: '02' }, { pag: 2, meccanica: 'TP_FID' }),
  riga(ID_PRECEDENTE, 'p-a', { codice_referenza: 'A', descrizione_uno: 'Mozzarella', prezzo: 1.5, reparto: '01' }, { storico: true }),
  riga(ID_PRECEDENTE, 'p-c', { codice_referenza: 'C', descrizione_uno: 'Biscotti', prezzo: 0.99, reparto: '03' }, { storico: true, codice_box: 'box-manuale' }),
  riga(ID_VARIANTE, 'v-a', { codice_referenza: 'A', descrizione_uno: 'Mozzarella', prezzo: 1.3, prezzo_anziche: 2 }),
  riga(ID_VARIANTE, 'v-d', { codice_referenza: 'D', descrizione_uno: 'Olio', prezzo: 5 }, { pag: 2 }),
  riga(ID_ALTRA_PROMO, 'x-a', { codice_referenza: 'A', descrizione_uno: 'Mozzarella', prezzo: 1.1 }),
];

const PDF = new Map<string, PdfVolantino>([
  [ID_KIT, { idOlimpoCloud: 'olimpo-kit', pagine: 8 }],
  // Il file non dice le pagine: valgono quelle del volantino
  [ID_VARIANTE, { idOlimpoCloud: 'olimpo-variante', pagine: 0 }],
]);

const CONFIG = {
  dataMapping: {
    referenzaFields: {
      reparto: ['dataFields.reparto', 'dataFields.Referenza.Reparto'],
      descrizioneReparto: 'dataFields.descrizione_reparto',
      meccanica: ['meccanica', 'dataFields.meccanica'],
    },
    reparti: [{ codice: '01', descrizione: 'Freschi' }, { codice: '02', descrizione: 'Bevande' }],
  },
  reparti: { groupBy: { field: 'reparto', descriptionField: 'descrizioneReparto' } },
  meccaniche: { groupBy: { field: 'meccanica' } },
  marche: { distributore: ['Marca del distributore', ' '] },
};

function creaServizio(opzioni: { salvati?: Map<string, RiepilogoKit>; config?: () => Promise<Record<string, unknown>> } = {}) {
  const salvati = opzioni.salvati ?? new Map<string, RiepilogoKit>();
  const letture = {
    kitNellAmbito: vi.fn(async (idKit: string, _ambito: AmbitoGdo) => KIT_PER_ID.get(idKit.toLowerCase()) ?? null),
    pdfDelKit: vi.fn(async (idKit: string) => PDF.get(idKit) ?? null),
    righeDelKit: vi.fn(async (idKit: string) => RIGHE.filter(voce => voce.id_runtime_kit === idKit)),
  } satisfies LettureKitInsight;
  const repository = {
    edizionePrecedente: vi.fn(async (_kit: KitInsight): Promise<KitInsight | null> => PRECEDENTE),
    // Il repository esclude gia' il kit; se tornasse, il servizio non lo elenca
    variantiDellaPromo: vi.fn(async (_kit: KitInsight) => [VARIANTE, KIT]),
    kitDellaGdoPerViaggio: vi.fn(async (_kit: KitInsight) => [PRECEDENTE, VARIANTE, KIT]),
  } satisfies IInsightConfrontiRepository;
  // analisi_kit in memoria, come nei test delle pagine del punto vendita
  const analisi = {
    aggregatiKit: vi.fn(async (idKit: readonly string[], _versione: number) => new Map(idKit.flatMap((id) => {
      const riepilogo = salvati.get(id);
      return riepilogo ? [[id, aggregatiDi(riepilogo.dati)] as const] : [];
    }))),
    referenzeDeiKit: vi.fn(async (idKit: readonly string[]) => RIGHE.filter(voce => idKit.includes(voce.id_runtime_kit))),
    salvaRiepiloghi: vi.fn(async (voci: readonly RiepilogoDaSalvare[]) => {
      for (const voce of voci) salvati.set(voce.idKit, voce.riepilogo);
    }),
    presenzeProdotto: vi.fn(async (idKit: readonly string[], chiave: string) => new Map(idKit.flatMap((id) => {
      const tupla = salvati.get(id)?.dati.prodotti.find(prodotto => prodotto[0] === chiave);
      return tupla ? [[id, prodottoDaCompatto(tupla)] as const] : [];
    }))),
    descrizioniProdotti: vi.fn(async (coppie: ReadonlyArray<{ idKit: string; chiave: string }>) => new Map(coppie.flatMap(({ idKit, chiave }) => {
      const descrizione = salvati.get(idKit)?.descrizioni[chiave];
      return descrizione ? [[chiaveDescrizione(idKit, chiave), descrizioneDaCompatta(descrizione)] as const] : [];
    }))),
  } satisfies RepositoryAnalisiViaggio;
  const leggiConfig: () => Promise<Record<string, unknown>> = opzioni.config ?? (async () => CONFIG);
  const config = { getFlyerInsightsConfig: vi.fn(leggiConfig) };
  const servizio = new InsightConfrontiService(repository, analisi, config, letture);
  return { servizio, letture, repository, analisi, config, salvati };
}

/** Le opzioni con cui il servizio ha chiesto le sezioni del kit che contiene la referenza indicata. */
function opzioniDelleSezioni(idReferenza: string): OpzioniInsight {
  const chiamata = insight.sezioniInsight.mock.calls.find(([box]) => box.some(singolo => singolo.id === idReferenza));
  if (!chiamata) throw new Error(`sezioniInsight non chiamata per ${idReferenza}`);
  return chiamata[1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('kit di partenza e ambito GDO', () => {
  it('un kit inesistente o di un\'altra GDO e\' 404 per tutti i confronti, senza leggere altro', async () => {
    const { servizio, letture, repository } = creaServizio();

    await expect(servizio.confronti(ESTRANEO, AMBITO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.differenzeVarianti(ESTRANEO, ID_VARIANTE, AMBITO)).rejects.toBeInstanceOf(NotFoundError);
    await expect(servizio.viaggioProdotto(ESTRANEO, 'c-A', AMBITO)).rejects.toBeInstanceOf(NotFoundError);

    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ESTRANEO, AMBITO);
    expect(repository.edizionePrecedente).not.toHaveBeenCalled();
    expect(repository.kitDellaGdoPerViaggio).not.toHaveBeenCalled();
    expect(letture.righeDelKit).not.toHaveBeenCalled();
  });

  it('un id che non e\' un UUID e\' una richiesta non valida, senza cercare il kit', async () => {
    const { servizio, letture } = creaServizio();

    await expect(servizio.confronti('42', AMBITO)).rejects.toBeInstanceOf(BadRequestError);
    await expect(servizio.differenzeVarianti(ID_KIT, 'non-un-kit', AMBITO)).rejects.toBeInstanceOf(BadRequestError);
    expect(letture.kitNellAmbito).toHaveBeenCalledTimes(1);
    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ID_KIT, AMBITO);
  });

  it('l\'ambito della sessione arriva alla lettura del kit cosi\' com\'e\'', async () => {
    const { servizio, letture } = creaServizio();

    await servizio.confronti(ID_KIT, 'tutte');

    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ID_KIT, 'tutte');
  });
});

describe('edizione precedente e varianti', () => {
  it('la prima edizione di un\'area e un canale non ha confronto; senza varianti l\'elenco e\' vuoto', async () => {
    const { servizio, repository, letture, config } = creaServizio();
    repository.edizionePrecedente.mockResolvedValueOnce(null);
    repository.variantiDellaPromo.mockResolvedValueOnce([]);

    await expect(servizio.confronti(ID_KIT, AMBITO)).resolves.toEqual({ edizionePrecedente: null, varianti: [] });
    expect(repository.edizionePrecedente).toHaveBeenCalledWith(KIT);
    expect(repository.variantiDellaPromo).toHaveBeenCalledWith(KIT);
    // Senza confronto non si legge nessun volantino
    expect(letture.righeDelKit).not.toHaveBeenCalled();
    expect(config.getFlyerInsightsConfig).not.toHaveBeenCalled();
  });

  it('numeri chiave, spazio per reparto e prodotti entrati e usciti rispetto all\'edizione precedente', async () => {
    const { servizio } = creaServizio();

    const confronti = await servizio.confronti(ID_KIT, AMBITO);
    const confronto = confronti.edizionePrecedente;

    expect(confronto?.edizione).toEqual({
      idKit: ID_PRECEDENTE, titolo: 'Volantino Liguria febbraio', idPromo: 'promo-febbraio', nomePromo: 'Promo di febbraio',
      area: 'Liguria', canale: 'Superstore', validitaDal: '2026-02-10', validitaAl: '2026-02-20', storico: true,
    });
    // Pagine: 8 dal PDF del kit; l'edizione dello storico non ha PDF, vale la pagina piu' alta (1)
    expect(confronto?.sintesi.pagine).toEqual({ attuale: 8, precedente: 1, differenza: 7 });
    expect(confronto?.sintesi.box).toEqual({ attuale: 2, precedente: 2, differenza: 0 });
    expect(confronto?.sintesi.scontoMedio).toEqual({ attuale: 40, precedente: null, differenza: null });
    expect(confronto?.sintesi.quotaFidelity).toEqual({ attuale: 50, precedente: 0, differenza: 50 });
    // "1" e "01" sono lo stesso reparto dell'anagrafica; "03" non c'e' e resta com'e'
    expect(confronto?.spazioPerReparto.map(voce => [voce.chiave, voce.etichetta, voce.attuale > 0, voce.precedente > 0])).toEqual([
      ['01', 'Freschi', true, true],
      ['02', 'Bevande', true, false],
      ['03', '03', false, true],
    ]);
    expect(confronto?.prodottiEntrati).toEqual([{ chiave: 'c-B', nome: 'Acqua', marca: null, prezzo: 3, sconto: null }]);
    expect(confronto?.prodottiUsciti).toEqual([{ chiave: 'c-C', nome: 'Biscotti', marca: null, prezzo: 0.99, sconto: null }]);
    // Le varianti senza il volantino stesso
    expect(confronti.varianti.map(variante => [variante.idKit, variante.area])).toEqual([[ID_VARIANTE, 'Toscana']]);
  });

  it('le sezioni dei due volantini usano config, foto e origine dello storico come la scheda degli insight', async () => {
    const { servizio } = creaServizio();

    await servizio.confronti(ID_KIT, AMBITO);

    const attuale = opzioniDelleSezioni('k-a');
    expect(attuale.totalePagine).toBe(8);
    expect(attuale.anagraficaReparti).toEqual(CONFIG.dataMapping.reparti);
    expect(attuale.marcheDistributore).toEqual(['Marca del distributore']);
    expect(attuale.repartoConfigurato?.('k-a')).toEqual({ codice: '01', descrizione: 'Freschi' });
    expect(attuale.repartoConfigurato?.('sconosciuta')).toBeNull();
    expect(attuale.meccanicaOriginale?.('k-b')).toBe('TP_FID');
    expect(attuale.meccanicaOriginale?.('k-a')).toBeNull();
    expect(attuale.urlFoto('guid-1')).toBe(urlFotoOlimpo('guid-1', { performante: true }));
    // Istanta: niente origine; storico: i box compilati a mano sono fuori listino
    expect(attuale.origine).toBeUndefined();
    const precedente = opzioniDelleSezioni('p-a');
    expect(precedente.origine?.('box-manuale')).toBe('fuori_listino');
    expect(precedente.origine?.('p-a')).toBe('listino');
    expect(precedente.repartoConfigurato?.('p-c')).toEqual({ codice: '03', descrizione: '03' });
  });

  it('senza la config degli insight i confronti si fanno lo stesso, con la sola lettura generica', async () => {
    const { servizio } = creaServizio({
      config: async () => { throw new NotFoundError({ message: 'File flyerInsightsConfig.json non trovato', entityType: 'FlyerInsightsConfig' }); },
    });

    const confronti = await servizio.confronti(ID_KIT, AMBITO);

    expect(confronti.edizionePrecedente?.prodottiEntrati.map(prodotto => prodotto.chiave)).toEqual(['c-B']);
    const opzioni = opzioniDelleSezioni('k-a');
    expect(opzioni.anagraficaReparti).toEqual([]);
    expect(opzioni.marcheDistributore).toEqual([]);
    expect(opzioni.repartoConfigurato?.('k-a')).toBeNull();
    expect(opzioni.meccanicaOriginale?.('k-b')).toBeNull();
  });
});

describe('differenze fra varianti', () => {
  it('le due varianti, il PDF e i box dell\'altra, lo stato dei box e i prodotti diversi', async () => {
    const { servizio } = creaServizio();

    const differenze = await servizio.differenzeVarianti(ID_KIT, ID_VARIANTE, AMBITO);

    expect(differenze.qui).toMatchObject({ idKit: ID_KIT, area: 'Liguria' });
    expect(differenze.altra).toMatchObject({ idKit: ID_VARIANTE, area: 'Toscana' });
    // Il file non dice le pagine: quelle del volantino (la pagina piu' alta con un box)
    expect(differenze.pdfAltra).toEqual({ idOlimpoCloud: 'olimpo-variante', pagine: 2 });
    expect(differenze.boxAltra.map(box => box.id)).toEqual(['v-a', 'v-d']);
    expect(differenze.statoBoxQui).toEqual({ 'k-a': 'prezzo-diverso', 'k-b': 'solo-qui' });
    expect(differenze.statoBoxAltra).toEqual({ 'v-a': 'prezzo-diverso', 'v-d': 'solo-altra' });
    expect(differenze.differenze.map(differenza => [differenza.chiave, differenza.stato])).toEqual([
      ['c-B', 'solo-qui'],
      ['c-D', 'solo-altra'],
      ['c-A', 'prezzo-diverso'],
    ]);
    expect(differenze.conteggi).toEqual({ 'solo-qui': 1, 'solo-altra': 1, 'prezzo-diverso': 1, uguale: 0 });
  });

  it('un volantino di un\'altra promo, o lo stesso volantino, e\' una richiesta non valida', async () => {
    const { servizio, letture } = creaServizio();

    await expect(servizio.differenzeVarianti(ID_KIT, ID_ALTRA_PROMO, AMBITO)).rejects.toBeInstanceOf(BadRequestError);
    await expect(servizio.differenzeVarianti(ID_KIT, ID_KIT.toUpperCase(), AMBITO)).rejects.toBeInstanceOf(BadRequestError);
    expect(letture.righeDelKit).not.toHaveBeenCalled();
  });

  it('una variante inesistente o fuori dall\'ambito GDO e\' 404', async () => {
    const { servizio, letture } = creaServizio();

    await expect(servizio.differenzeVarianti(ID_KIT, ESTRANEO, AMBITO)).rejects.toBeInstanceOf(NotFoundError);
    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ESTRANEO, AMBITO);
  });
});

describe('viaggio del prodotto', () => {
  const riepilogoCon = (chiave: string, prezzo: number, descrizione: RiepilogoKit['descrizioni'][string], conFoto: 0 | 1 = 0): RiepilogoKit => ({
    dati: { ...AGGREGATI_VUOTI, marche: [], prodotti: [[chiave, prezzo, null, 0, null, 1, 5, conFoto]] },
    descrizioni: { [chiave]: descrizione },
  });

  it('i volantini della GDO in cui compare, dal piu\' recente, con il volantino di partenza segnato', async () => {
    const { servizio, analisi, repository } = creaServizio();

    const viaggio = await servizio.viaggioProdotto(ID_KIT, 'c-A', AMBITO);

    expect(repository.kitDellaGdoPerViaggio).toHaveBeenCalledWith(KIT);
    // I riepiloghi mancanti si calcolano e si salvano prima di cercare il prodotto
    expect(analisi.aggregatiKit).toHaveBeenCalledWith([ID_KIT, ID_VARIANTE, ID_PRECEDENTE], expect.any(Number));
    expect(analisi.salvaRiepiloghi).toHaveBeenCalledTimes(1);
    expect(analisi.salvaRiepiloghi.mock.invocationCallOrder[0]).toBeLessThan(analisi.presenzeProdotto.mock.invocationCallOrder[0]);
    expect(analisi.presenzeProdotto).toHaveBeenCalledWith([ID_KIT, ID_VARIANTE, ID_PRECEDENTE], 'c-A');

    expect(viaggio).toMatchObject({ chiave: 'c-A', nome: 'Mozzarella', marca: 'Latteria', foto: [urlFotoOlimpo('guid-mozzarella', { performante: true })] });
    expect(viaggio.tappe.map(tappa => [tappa.idKit, tappa.data, tappa.prezzo, tappa.sconto, tappa.questoVolantino])).toEqual([
      [ID_KIT, '2026-03-10', 1.2, scontoDaiPrezzi(1.2, 2), true],
      [ID_VARIANTE, '2026-03-10', 1.3, scontoDaiPrezzi(1.3, 2), false],
      [ID_PRECEDENTE, '2026-02-10', 1.5, null, false],
    ]);
    expect(viaggio.tappe[0]).toMatchObject({ titolo: 'Volantino Liguria', area: 'Liguria', canale: 'Superstore', barrato: 2, pagina: 1, sottocosto: false });
  });

  it('al massimo MAX_TAPPE_VIAGGIO tappe; il volantino di partenza, piu\' vecchio, c\'e\' sempre', async () => {
    const recenti = Array.from({ length: MAX_TAPPE_VIAGGIO + 4 }, (_, indice) => {
      const giorno = new Date(Date.UTC(2026, 5, 30 - indice)).toISOString().slice(0, 10);
      return kitInsight(`b0000000-0000-4000-8000-${String(indice).padStart(12, '0')}`, { titolo: `Volantino ${giorno}`, data: giorno, validitaAl: giorno });
    });
    const salvati = new Map(recenti.map(kit => [kit.id, riepilogoCon('c-A', 1.1, ['Mozzarella', null, null, null])] as const));
    const { servizio, repository, analisi } = creaServizio({ salvati });
    // Il kit di partenza e' piu' vecchio dei volantini letti per il viaggio: si aggiunge
    repository.kitDellaGdoPerViaggio.mockResolvedValueOnce(recenti);

    const viaggio = await servizio.viaggioProdotto(ID_KIT, 'c-A', AMBITO);

    expect(analisi.aggregatiKit.mock.calls[0][0]).toEqual([...recenti.map(kit => kit.id), ID_KIT]);
    expect(viaggio.tappe).toHaveLength(MAX_TAPPE_VIAGGIO);
    expect(viaggio.tappe.slice(0, -1).map(tappa => tappa.idKit)).toEqual(recenti.slice(0, MAX_TAPPE_VIAGGIO - 1).map(kit => kit.id));
    expect(viaggio.tappe[MAX_TAPPE_VIAGGIO - 1]).toMatchObject({ idKit: ID_KIT, questoVolantino: true });
  });

  it('un prodotto che il volantino di partenza non ha: nome e foto dalle descrizioni dei volantini piu\' recenti', async () => {
    const salvati = new Map([[ID_PRECEDENTE, riepilogoCon('c-Z', 2.4, ['Biscotti al burro', 'Forno', '500 g', 'guid-biscotti'], 1)]]);
    const { servizio, analisi } = creaServizio({ salvati });

    const viaggio = await servizio.viaggioProdotto(ID_KIT, 'c-Z', AMBITO);

    expect(analisi.descrizioniProdotti).toHaveBeenCalledWith([{ idKit: ID_PRECEDENTE, chiave: 'c-Z' }]);
    expect(viaggio).toMatchObject({
      chiave: 'c-Z', nome: 'Biscotti al burro', marca: 'Forno', formato: '500 g',
      foto: [urlFotoOlimpo('guid-biscotti', { performante: true })],
    });
    expect(viaggio.tappe.map(tappa => [tappa.idKit, tappa.questoVolantino])).toEqual([[ID_PRECEDENTE, false]]);
  });

  it('un prodotto che non compare in nessun volantino della GDO e\' 404', async () => {
    const { servizio } = creaServizio();

    await expect(servizio.viaggioProdotto(ID_KIT, 'c-NESSUNO', AMBITO)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('una chiave che non e\' di un prodotto e\' una richiesta non valida, senza leggere il kit', async () => {
    const { servizio, letture } = creaServizio();

    await expect(servizio.viaggioProdotto(ID_KIT, 'x-1', AMBITO)).rejects.toBeInstanceOf(BadRequestError);
    await expect(servizio.viaggioProdotto(ID_KIT, 'c-con spazio', AMBITO)).rejects.toBeInstanceOf(BadRequestError);
    expect(letture.kitNellAmbito).not.toHaveBeenCalled();
  });
});

describe('limitaTappe', () => {
  const tappa = (idKit: string, questoVolantino = false): TappaProdotto => ({
    idKit, titolo: idKit, data: '2026-01-01', area: '', canale: '', prezzo: null, barrato: null, sconto: null,
    sottocosto: false, meccanica: null, pagina: null, spazio: null, questoVolantino,
  });

  it('entro il limite restano tutte; oltre, le piu\' recenti con il volantino di partenza al posto dell\'ultima', () => {
    expect(limitaTappe([tappa('a'), tappa('b', true)], 3).map(voce => voce.idKit)).toEqual(['a', 'b']);
    expect(limitaTappe([tappa('a', true), tappa('b'), tappa('c'), tappa('d')], 3).map(voce => voce.idKit)).toEqual(['a', 'b', 'c']);
    expect(limitaTappe([tappa('a'), tappa('b'), tappa('c'), tappa('d', true)], 3).map(voce => voce.idKit)).toEqual(['a', 'b', 'd']);
    expect(limitaTappe([tappa('a'), tappa('b'), tappa('c'), tappa('d')], 3).map(voce => voce.idKit)).toEqual(['a', 'b', 'c']);
    expect(limitaTappe([], 3)).toEqual([]);
  });
});

describe('contestoDallaConfig', () => {
  it('senza config, o con una config senza i campi, non c\'e\' niente da mappare', () => {
    for (const config of [null, undefined, 'testo', {}, { dataMapping: { referenzaFields: [] }, marche: { distributore: 'non un elenco' } }]) {
      expect(contestoDallaConfig(config)).toEqual({
        anagraficaReparti: [], marcheDistributore: [], percorsoReparto: null, percorsoDescrizioneReparto: null, percorsoMeccanica: null,
      });
    }
  });

  it('senza groupBy valgono i campi predefiniti della scheda: reparto, descrizioneReparto e meccanica', () => {
    const contesto = contestoDallaConfig({
      dataMapping: { referenzaFields: { reparto: 'dataFields.reparto', descrizioneReparto: ['', 'dataFields.desc'], meccanica: 'meccanica' } },
    });

    expect(contesto).toMatchObject({ percorsoReparto: 'dataFields.reparto', percorsoDescrizioneReparto: ['dataFields.desc'], percorsoMeccanica: 'meccanica' });
  });
});
