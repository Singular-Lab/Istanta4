import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportStorico } from '../../../../lib/types';
import type { IConfigService } from '../../interfaces/IConfigService';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import { Referenze } from '../../models/referenze';
import { ReferenzeGruppo } from '../../models/referenze_gruppo';
import { RuntimeKit } from '../../models/runtime_kit';
import { VolantinoService } from '../VolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

function creaServizio(referenze: Array<Record<string, unknown>>, config: Record<string, unknown>, importStorico: ImportStorico | null = null) {
  vi.spyOn(TipiDiExport, 'findOne').mockResolvedValue({ id_tipiexport: 'tipo-vol' } as never);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
  vi.spyOn(Referenze, 'findAll').mockResolvedValue(referenze as never);
  vi.spyOn(ReferenzeGruppo, 'findAll').mockResolvedValue([] as never);
  vi.spyOn(RuntimeKit, 'findOne').mockResolvedValue({
    titolo: 'Volantino Edro21',
    nome_area: 'Liguria',
    nome_canale: 'Conad',
    id_promo: 'promo-1',
    import_storico: importStorico,
  } as never);
  const configService = { getFlyerInsightsConfig: vi.fn(async () => config) } as unknown as IConfigService;
  return new VolantinoService(configService);
}

afterEach(() => {
  vi.restoreAllMocks();
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
