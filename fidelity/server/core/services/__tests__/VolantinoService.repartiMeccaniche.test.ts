import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportStorico } from '../../../../lib/types';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import { insightVolantinoConadCno } from '../../agenzia_lib/conadcno/insight-volantino';
import type { LogoDelCatalogo } from '../../interfaces/ICatalogoLoghiService';
import type { IConfigService } from '../../interfaces/IConfigService';
import type { RepartoSalvato } from '../../utils/repartiGdo';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import { ReferenzeGruppo } from '../../models/referenze_gruppo';
import { kitNellAmbito, pdfDelKit, righeDelKit } from '../../repositories/InsightVolantinoRepository';
import { VolantinoService } from '../VolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../repositories/InsightVolantinoRepository', () => ({
  kitNellAmbito: vi.fn(),
  pdfDelKit: vi.fn(),
  righeDelKit: vi.fn(),
}));

// Reparti e meccaniche di /api/flyer-insights uguali per Istanta e storico (spec insight-volantino).
// Sui dati Edro21 Istanta scrive il reparto "01" con la descrizione e la meccanica nella colonna;
// lo storico scrive "1" senza descrizione e la meccanica fra i data_fields, con la colonna vuota.

const STORICO: ImportStorico = {
  importatoIl: '2026-11-06T10:00:00.000Z',
  nomeFile: 'volantino-novembre.json',
  nonImpaginate: [],
  lasciapassareNonImpaginate: false,
  fuoriListino: [],
  fuoriListinoIgnorati: 0,
};

const CONFIG_EDRO21 = {
  dataMapping: {
    referenzaFields: {
      codiceReferenza: ['data_fields.codice_referenza', 'data_fields.Referenza.Codice'],
      reparto: 'data_fields.reparto',
      descrizioneReparto: 'data_fields.descrizione_reparto',
      meccanica: ['meccanica', 'data_fields.meccanica'],
    },
    reparti: [
      { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
      { codice: '05', descrizione: 'DROGHERIA CHIMICA' },
      { codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' },
    ],
  },
  reparti: { groupBy: { field: 'reparto', descriptionField: 'descrizioneReparto' } },
  meccaniche: { groupBy: { field: 'meccanica' } },
};

/** La configurazione di prima: un solo percorso per campo, nessuna anagrafica. */
const CONFIG_SEMPLICE = {
  dataMapping: {
    referenzaFields: {
      reparto: 'data_fields.reparto',
      descrizioneReparto: 'data_fields.descrizione_reparto',
      meccanica: 'meccanica',
    },
  },
};

const referenza = (id: string, dati: Record<string, unknown>) => ({
  id, compiled_fields: [], data_fields: {}, foto: [], meccanica: '', codice_box: id, group_elements: [],
  pag: 1, x: 10, y: 10, w: 50, h: 50, w_page: 210, h_page: 287, perc_ingombro: 4, ...dati,
});

interface Extra {
  reparti?: RepartoSalvato[];
  agenzia?: Pick<IAgenziaLib, 'insightVolantino'>;
  catalogo?: Map<string, LogoDelCatalogo>;
}

function creaServizio(referenze: Array<Record<string, unknown>>, config: Record<string, unknown>, importStorico: ImportStorico | null = null, extra: Extra = {}) {
  vi.spyOn(TipiDiExport, 'findOne').mockResolvedValue({ id_tipiexport: 'tipo-vol' } as never);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.spyOn(ReferenzeGruppo, 'findAll').mockResolvedValue([] as never);
  vi.mocked(kitNellAmbito).mockResolvedValue({
    id: 'kit-1',
    titolo: 'Volantino di novembre',
    idPromo: 'promo-1',
    nomePromo: 'Promo di novembre',
    idArea: 'area-1',
    idCanale: 'canale-1',
    area: 'Nord',
    canale: 'Super',
    validitaDal: '2026-11-01',
    validitaAl: '2026-11-14',
    data: '2026-11-01',
    storico: importStorico !== null,
    importStorico,
    gdo: 'gdo-1',
  });
  // Il repository le restituisce gia' ordinate per pagina e posizione
  vi.mocked(righeDelKit).mockResolvedValue(referenze as never);
  vi.mocked(pdfDelKit).mockResolvedValue(null);
  configService = { getFlyerInsightsConfig: vi.fn(async (_idGdo?: string | null) => config) } as unknown as IConfigService;
  const reparti = { repartiSalvati: vi.fn(async (_idGdo: string) => extra.reparti ?? []) };
  const catalogo = { catalogo: vi.fn(async () => extra.catalogo ?? new Map<string, LogoDelCatalogo>()) };
  return new VolantinoService(configService, reparti, extra.agenzia ?? {}, catalogo);
}

let configService: IConfigService;

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('VolantinoService.getFlyerInsights: reparti e meccaniche per ogni fonte', () => {
  it('storico: reparto "1" senza descrizione diventa 01 DROGHERIA ALIMENTARE, la meccanica arriva dai dati', async () => {
    const servizio = creaServizio([
      referenza('s1', { data_fields: { codice_referenza: 'A1', reparto: '1', meccanica: 'TP_FID_KgL' } }),
      referenza('s2', { data_fields: { codice_referenza: 'A2', reparto: '1', meccanica: 'TP_FID_KgL' } }),
      referenza('s3', { data_fields: { codice_referenza: 'A3', reparto: '24', meccanica: 'PERCENTO_FID_ALL' } }),
    ], CONFIG_EDRO21, STORICO);

    const insights = await servizio.getFlyerInsights('kit-storico');

    expect(insights.riepilogoReparti.map(r => [r.sigla, r.descrizione, r.numeroReferenze])).toEqual([
      ['01', 'DROGHERIA ALIMENTARE', 2],
      ['24', 'DEPERIBILI LIBERO SERVIZIO', 1],
    ]);
    expect(insights.riepilogoMeccaniche.map(m => [m.meccanica, m.numeroReferenze])).toEqual([
      ['TP_FID_KgL', 2],
      ['PERCENTO_FID_ALL', 1],
    ]);
    expect(insights.referenze[0]).toMatchObject({ codiceReferenza: 'A1', reparto: '01', descrizioneReparto: 'DROGHERIA ALIMENTARE' });
    expect(insights.riepilogoPagine[0].reparti).toEqual([
      { sigla: '01', descrizione: 'DROGHERIA ALIMENTARE', count: 2 },
      { sigla: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO', count: 1 },
    ]);
  });

  it('Istanta: reparto e meccanica restano quelli della referenza; senza codice il reparto si trova dalla descrizione', async () => {
    const servizio = creaServizio([
      referenza('i1', { meccanica: 'TP_MM', data_fields: { codice_referenza: 'B1', reparto: '01', descrizione_reparto: 'DROGHERIA ALIMENTARE' } }),
      // Kit di Istanta con le chiavi puntate: niente codice reparto, solo la descrizione
      referenza('i2', { meccanica: 'NM_MIX_MM', data_fields: { 'Referenza.Codice': 'B2', sigla_reparto: 'PC', descrizione_reparto: 'DROGHERIA CHIMICA' } }),
    ], CONFIG_EDRO21);

    const insights = await servizio.getFlyerInsights('kit-istanta');

    expect(insights.riepilogoReparti.map(r => [r.sigla, r.descrizione]).sort()).toEqual([
      ['01', 'DROGHERIA ALIMENTARE'],
      ['05', 'DROGHERIA CHIMICA'],
    ]);
    expect(insights.riepilogoMeccaniche.map(m => m.meccanica).sort()).toEqual(['NM_MIX_MM', 'TP_MM']);
    expect(insights.referenze[1]).toMatchObject({ codiceReferenza: 'B2', reparto: '05' });
  });

  it('reparto fuori anagrafica: compare con il valore ricevuto', async () => {
    const servizio = creaServizio([
      referenza('x1', { data_fields: { reparto: '99' } }),
    ], CONFIG_EDRO21, STORICO);

    const insights = await servizio.getFlyerInsights('kit-storico');

    expect(insights.riepilogoReparti.map(r => [r.sigla, r.descrizione])).toEqual([['99', '']]);
  });

  it('configurazione con un solo percorso e senza anagrafica: come prima', async () => {
    const servizio = creaServizio([
      referenza('s1', { data_fields: { reparto: '1', meccanica: 'TP_FID_KgL' } }),
      referenza('i1', { meccanica: 'TP_MM', data_fields: { reparto: '01', descrizione_reparto: 'DROGHERIA ALIMENTARE' } }),
    ], CONFIG_SEMPLICE);

    const insights = await servizio.getFlyerInsights('kit-misto');

    expect(insights.riepilogoReparti.map(r => [r.sigla, r.descrizione]).sort()).toEqual([
      ['01', 'DROGHERIA ALIMENTARE'],
      ['1', ''],
    ]);
    expect(insights.riepilogoMeccaniche.map(m => m.meccanica).sort()).toEqual(['', 'TP_MM']);
  });
});

describe('VolantinoService.getFlyerInsights: sezioni nuove con la config dell\'installazione', () => {
  it('storico: il box prende reparto e meccanica come li mappa la config, e l\'origine dal report dell\'import', async () => {
    const servizio = creaServizio([
      referenza('s1', { codice_box: '11', data_fields: { codice_referenza: 'A1', descrizione_uno: 'Pasta', reparto: '1', meccanica: 'TP_FID_KgL' } }),
      referenza('s2', { codice_box: '12', x: 100, data_fields: { codice_referenza: 'A2', descrizione_uno: 'Yogurt', reparto: '24', meccanica: 'PERCENTO_FID_ALL' } }),
    ], CONFIG_EDRO21, { ...STORICO, fuoriListino: [{ codiceBox: '12' }] });

    const insights = await servizio.getFlyerInsights('kit-storico');
    const box = new Map(insights.box.map(singolo => [singolo.id, singolo]));

    expect(box.get('s1')).toMatchObject({
      reparto: { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
      meccanicaOriginale: 'TP_FID_KgL',
      origine: 'listino',
    });
    expect(box.get('s2')).toMatchObject({
      reparto: { codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' },
      meccanicaOriginale: 'PERCENTO_FID_ALL',
      origine: 'fuori_listino',
    });
    // Stessi codici dei riepiloghi di sempre: i colori della config valgono anche qui
    expect(insights.spazio.perReparto.map(voce => voce.chiave).sort()).toEqual(insights.riepilogoReparti.map(voce => voce.sigla).sort());
    expect(insights.referenze.map(ref => ref.origine)).toEqual(['listino', 'fuori_listino']);
  });

  it('Istanta: meccanica dalla colonna, nessuna origine; senza config il reparto e\' quello letto dai dati', async () => {
    const conConfig = creaServizio([
      referenza('i1', { meccanica: 'TP_MM', data_fields: { codice_referenza: 'B1', descrizione_uno: 'Caffe', reparto: '01', descrizione_reparto: 'DROGHERIA ALIMENTARE' } }),
    ], CONFIG_EDRO21);
    const [istanta] = (await conConfig.getFlyerInsights('kit-istanta')).box;

    expect(istanta).toMatchObject({ reparto: { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' }, meccanicaOriginale: 'TP_MM' });
    expect(istanta).not.toHaveProperty('origine');

    const senzaConfig = creaServizio([
      referenza('i1', { meccanica: 'TP_MM', data_fields: { codice_referenza: 'B1', descrizione_uno: 'Caffe', descrizione_reparto: 'DROGHERIA ALIMENTARE' } }),
    ], {});
    const [letto] = (await senzaConfig.getFlyerInsights('kit-istanta')).box;

    expect(letto).toMatchObject({ reparto: { codice: 'Drogheria alimentare', descrizione: 'Drogheria alimentare' }, meccanicaOriginale: null });
  });

  it('marche del distributore dalla config (marche.distributore); senza, la quota non c\'e\'', async () => {
    const righe = [
      referenza('m1', { x: 0, data_fields: { descrizione_uno: 'Pasta', descrizione_due: 'Insegna' } }),
      referenza('m2', { x: 100, data_fields: { descrizione_uno: 'Latte', descrizione_due: 'Granarolo' } }),
    ];

    const conMarche = await creaServizio(righe, { ...CONFIG_EDRO21, marche: { distributore: ['insegna', 42] } }).getFlyerInsights('kit-1');
    const senzaMarche = await creaServizio(righe, CONFIG_EDRO21).getFlyerInsights('kit-1');

    // Stesso spazio e stessi box: in ordine di nome
    expect(conMarche.marche.elenco.map(marca => [marca.nome, marca.distributore])).toEqual([['Granarolo', false], ['Insegna', true]]);
    expect(conMarche.marche.quotaDistributore).toEqual({ quotaSpazio: 50, quotaBox: 50 });
    expect(senzaMarche.marche.quotaDistributore).toBeNull();
  });
});

describe('VolantinoService.getFlyerInsights: contesto, reparti della GDO e linee del distributore', () => {
  it('il contesto ha le date di validita\' della promo del kit, e la config e\' quella della GDO del kit', async () => {
    const servizio = creaServizio([referenza('c1', { data_fields: { reparto: '01' } })], CONFIG_EDRO21);

    const insights = await servizio.getFlyerInsights('kit-1');

    expect(insights.contesto).toEqual({
      titolo: 'Volantino di novembre',
      nomeArea: 'Nord',
      nomeCanale: 'Super',
      idPromo: 'promo-1',
      validitaDal: '2026-11-01',
      validitaAl: '2026-11-14',
    });
    expect(configService.getFlyerInsightsConfig).toHaveBeenCalledWith('gdo-1');
  });

  it('nomi per il marketing: codici con lo stesso nome sono un reparto solo, con il codice piu\' basso e il colore della GDO', async () => {
    const servizio = creaServizio([
      referenza('r1', { x: 0, data_fields: { reparto: '1', descrizione_uno: 'Pasta' } }),
      referenza('r2', { x: 60, data_fields: { reparto: '05', descrizione_uno: 'Detersivo' } }),
      referenza('r3', { x: 120, data_fields: { reparto: '24', descrizione_uno: 'Yogurt' } }),
    ], CONFIG_EDRO21, STORICO, {
      // Stesso nome senza maiuscole e spazi doppi; il colore e' il primo del gruppo dal codice piu' basso
      reparti: [
        { codice: '05', nomeDati: 'DROGHERIA CHIMICA', nomeMarketing: 'Spesa di casa ', colore: '#8b5cf6' },
        { codice: '01', nomeDati: 'DROGHERIA ALIMENTARE', nomeMarketing: 'spesa  DI casa', colore: null },
        { codice: '24', nomeDati: 'DEPERIBILI LIBERO SERVIZIO', nomeMarketing: null, colore: '#eab308' },
      ],
    });

    const insights = await servizio.getFlyerInsights('kit-storico');
    const box = new Map(insights.box.map(singolo => [singolo.id, singolo.reparto]));

    expect(box.get('r1')).toEqual({ codice: '01', descrizione: 'spesa  DI casa', colore: '#8b5cf6', marketing: true });
    expect(box.get('r2')).toEqual(box.get('r1'));
    expect(box.get('r3')).toEqual({ codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO', colore: '#eab308' });
    expect(insights.riepilogoReparti.map(voce => [voce.sigla, voce.descrizione, voce.numeroReferenze, voce.colore])).toEqual([
      ['01', 'spesa  DI casa', 2, '#8b5cf6'],
      ['24', 'DEPERIBILI LIBERO SERVIZIO', 1, '#eab308'],
    ]);
    expect(insights.spazio.perReparto.map(voce => [voce.chiave, voce.etichetta])).toEqual([
      ['01', 'spesa  DI casa'],
      ['24', 'DEPERIBILI LIBERO SERVIZIO'],
    ]);
    expect(insights.referenze.map(ref => ref.reparto)).toEqual(['01', '01', '24']);
  });

  it('senza reparti salvati per la GDO restano i reparti dell\'anagrafica, senza colore', async () => {
    const insights = await creaServizio([referenza('r1', { data_fields: { reparto: '1' } })], CONFIG_EDRO21, STORICO).getFlyerInsights('kit-storico');

    expect(insights.box[0].reparto).toEqual({ codice: '01', descrizione: 'DROGHERIA ALIMENTARE' });
    expect(insights.riepilogoReparti[0]).not.toHaveProperty('colore');
  });

  it('linee del distributore: quella assegnata da Istanta, o ricavata dai testi; bolli dichiarati; loghi dal catalogo', async () => {
    const servizio = creaServizio([
      // Istanta: la linea e i bolli assegnati (un logo spento non conta)
      referenza('l1', { x: 0, w: 100, foto_extra: [
        { guidId: 'g-1', attiva: true, sigla: 'conad_SaporiDintorni', tipo: 3 },
        { guid_id: 'g-2', sigla: 'DOP', tipo: 2 },
        { guidId: 'g-3', attiva: false, sigla: 'igp', tipo: 2 },
      ], data_fields: { descrizione_uno: 'Pecorino', descrizione_due: 'Conad', prezzo: 3, prezzo_anziche: 4 } }),
      // Storico: nessun logo, la linea dai testi stampati
      referenza('l2', { x: 110, w: 50, data_fields: { descrizione_uno: 'Passata', descrizione_due: 'Conad Il Biologico' } }),
      referenza('l3', { x: 170, w: 50, data_fields: { descrizione_uno: 'Latte', descrizione_due: 'Granarolo' } }),
    ], CONFIG_EDRO21, null, {
      agenzia: { insightVolantino: insightVolantinoConadCno },
      catalogo: new Map([['conad_saporidintorni', { sigla: 'conad_SaporiDintorni', guidId: 'logo-sd', tipo: 3 }]]),
    });

    const insights = await servizio.getFlyerInsights('kit-1');
    const box = new Map(insights.box.map(singolo => [singolo.id, singolo]));

    expect(box.get('l1')).toMatchObject({ linea: { sigla: 'conad_saporidintorni', nome: 'Sapori & Dintorni' }, bolli: ['dop'] });
    expect(box.get('l2')).toMatchObject({ linea: { sigla: 'conad_bio', nome: 'Il Biologico' }, bolli: [] });
    expect(box.get('l3')).toMatchObject({ linea: null, bolli: [] });
    expect(insights.lineeDistributore).toMatchObject({
      box: 2,
      quotaBox: 66.7,
      linee: [
        { sigla: 'conad_saporidintorni', nome: 'Sapori & Dintorni', box: 1, referenze: 1, scontoMedio: 25, logo: '/olimpo/foto/getThumbNailOnDemand?guidId=logo-sd&width=96&height=0' },
        { sigla: 'conad_bio', nome: 'Il Biologico', box: 1, referenze: 1, logo: null },
      ],
      bolli: [{ sigla: 'dop', nome: 'DOP', box: 1, logo: null }],
    });
  });

  it('senza linee dichiarate dalla libreria agenzia i box non hanno linea e la sezione e\' null', async () => {
    const insights = await creaServizio([
      referenza('l1', { foto_extra: [{ guidId: 'g-1', sigla: 'conad_saporidintorni', tipo: 3 }], data_fields: { descrizione_due: 'Conad' } }),
    ], CONFIG_EDRO21).getFlyerInsights('kit-1');

    expect(insights.lineeDistributore).toBeNull();
    expect(insights.box[0]).not.toHaveProperty('linea');
    expect(insights.box[0]).not.toHaveProperty('bolli');
  });
});
