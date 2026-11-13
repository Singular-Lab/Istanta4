import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { NotFoundError } from '../../../../lib/errors';
import { PALETTE_REPORT_STANDARD, type SezioneReport } from '../../../../lib/insightVolantino/report';
import type { BoxInsight, ConfrontoEdizione } from '../../../../lib/insightVolantino/tipi';
import type { AmbitoGdo } from '../../accessi/contestoAccesso';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { FlyerInsightsDTO } from '../../dto';
import { log } from '../../logger';
import type { KitInsight } from '../../repositories/InsightVolantinoRepository';
import { chiaveSezione } from '../../utils/reportVolantino';
import { ReportVolantinoService } from '../ReportVolantinoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Le letture del kit arrivano finte dal costruttore: il modulo vero non si carica, cosi' il test
// non tocca il database.
vi.mock('../../repositories/InsightVolantinoRepository', () => ({
  kitNellAmbito: vi.fn(),
  pdfDelKit: vi.fn(),
  righeDelKit: vi.fn(),
}));

// Report PDF del volantino (spec insight-volantino): ambito GDO, confronto facoltativo che non ferma
// il report, palette e intestazione del cliente, sezioni composte dalla libreria agenzia. Per
// decisione della direzione niente pagine del volantino, vendite, previsioni ne' visibilita'.

const ID_KIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AMBITO: AmbitoGdo = { idGdo: 'gdo-1' };
const ADESSO = new Date('2026-11-09T08:30:00.000Z');

const KIT: KitInsight = {
  id: ID_KIT,
  titolo: 'Volantino 21',
  idPromo: 'promo-1',
  nomePromo: 'Promo di novembre',
  idArea: 'area-1',
  idCanale: 'canale-1',
  area: 'Toscana',
  canale: 'Conad City',
  validitaDal: '2026-11-03',
  validitaAl: '2026-11-16',
  data: '2026-11-03',
  storico: false,
  importStorico: null,
  gdo: 'gdo-1',
};

const BOX: BoxInsight = {
  id: 'b1', codiceBox: 'b1', pagina: 1, geometria: { x: 0, y: 0, w: 0.5, h: 0.5 }, spazio: 25, proporzionePagina: 0.7,
  chiave: 'c-1', nome: 'Mozzarella', marca: 'Alfa', formato: null, prezzo: 1.5, barrato: 2, sconto: 25, prezzoAlKg: null,
  punti: null, sottocosto: false, meccanica: 'sconto', meccanicaOriginale: null, reparto: { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
  foto: [], prodotti: 1, idReferenze: ['r1'],
};

const INSIGHT = {
  guidIdKitRuntime: ID_KIT,
  contesto: { titolo: 'Volantino 21', nomeArea: 'Toscana', nomeCanale: 'Conad City', idPromo: 'promo-1' },
  totaleReferenze: 1,
  totalePagine: 4,
  riepilogoPagine: [],
  riepilogoReparti: [],
  riepilogoMeccaniche: [],
  referenze: [],
  pdf: { idOlimpoCloud: 'pdf-1', pagine: 4 },
  box: [BOX],
  sintesi: {
    referenze: 1, box: 1, pagine: 4, scontoMedio: 25, boxConSconto: 1, quotaFidelity: 0, sottocosto: 0, marche: 1,
    copertura: { prezzo: 100, marca: 100, reparto: 100, geometria: 100 },
  },
  prezziSconti: {
    fasce: [{ da: 0, a: 10, box: 0 }, { da: 10, a: 20, box: 0 }, { da: 20, a: 30, box: 1 }, { da: 30, a: 40, box: 0 }, { da: 40, a: 50, box: 0 }, { da: 50, a: null, box: 0 }],
    perReparto: [],
    perMeccanica: [{ chiave: 'sconto', etichetta: 'Sconto in %', box: 1, scontoMedio: 25 }],
    sottocosto: [],
    conPrezzoAlKg: 0,
  },
  spazio: {
    perReparto: [{ chiave: '01', etichetta: 'DROGHERIA ALIMENTARE', referenze: 1, spazio: 25, quotaReferenze: 100, quotaSpazio: 100 }],
    perMeccanica: [],
    perMarca: [],
    perPagina: [],
  },
  marche: { elenco: [{ chiave: 'ALFA', nome: 'Alfa', box: 1, referenze: 1, quotaSpazio: 100, scontoMedio: 25, distributore: false }], quotaDistributore: null },
} as FlyerInsightsDTO;

const CONFRONTO = {
  edizione: { idKit: 'kit-0', titolo: 'Volantino 20', idPromo: 'promo-0', nomePromo: null, area: 'Toscana', canale: 'Conad City', validitaDal: '2026-10-20', validitaAl: '2026-11-02', storico: false },
  sintesi: {
    referenze: { attuale: 1, precedente: 2, differenza: -1 },
    box: { attuale: 1, precedente: 2, differenza: -1 },
    pagine: { attuale: 4, precedente: 4, differenza: 0 },
    scontoMedio: { attuale: 25, precedente: 20, differenza: 5 },
    quotaFidelity: { attuale: 0, precedente: 0, differenza: 0 },
    sottocosto: { attuale: 0, precedente: 0, differenza: 0 },
    marche: { attuale: 1, precedente: 2, differenza: -1 },
  },
  spazioPerReparto: [],
  prodottiEntrati: [],
  prodottiUsciti: [{ chiave: 'c-2', nome: 'Biscotti', marca: 'Beta', prezzo: 2, sconto: 10 }],
} satisfies ConfrontoEdizione;

function creaServizio(agenziaLib: Pick<IAgenziaLib, 'insightVolantino'> = {}) {
  const dipendenze = {
    volantino: { getFlyerInsights: vi.fn(async (_idKit: string, _ambito?: AmbitoGdo, _richiesta?: Request) => INSIGHT) },
    confronti: { edizionePrecedente: vi.fn(async (_idKit: string, _ambito: AmbitoGdo): Promise<ConfrontoEdizione | null> => CONFRONTO) },
    gdo: { getGDOById: vi.fn(async (id: string) => ({ id, nome: ' GDO di prova ', updatedat: new Date(0) })) },
    letture: { kitNellAmbito: vi.fn(async (_idKit: string, _ambito: AmbitoGdo): Promise<KitInsight | null> => KIT) },
  };
  const servizio = new ReportVolantinoService(
    dipendenze.volantino,
    dipendenze.confronti,
    dipendenze.gdo,
    agenziaLib,
    dipendenze.letture,
    () => ADESSO,
  );
  return { servizio, ...dipendenze };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReportVolantinoService.report: dati e intestazione', () => {
  it('raccoglie insight e confronto nell\'ambito della richiesta e compone il report', async () => {
    const { servizio, volantino, confronti, gdo, letture } = creaServizio();

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(letture.kitNellAmbito).toHaveBeenCalledWith(ID_KIT, AMBITO);
    expect(volantino.getFlyerInsights).toHaveBeenCalledWith(ID_KIT, AMBITO, undefined);
    expect(confronti.edizionePrecedente).toHaveBeenCalledWith(ID_KIT, AMBITO);
    expect(gdo.getGDOById).toHaveBeenCalledWith('gdo-1');
    expect(report).toMatchObject({
      generatoIl: '2026-11-09T08:30:00.000Z',
      idKit: ID_KIT,
      // Insegna e area, non il titolo tecnico del kit
      titolo: 'Conad City · Toscana',
      sottotitolo: 'Toscana · Conad City · dal 3 al 16 novembre 2026',
      pdf: { idOlimpoCloud: 'pdf-1', pagine: 4 },
      box: [BOX],
      totalePagine: 4,
    });
    expect(report.sezioni.map(chiaveSezione)).toEqual(['sintesi', 'assortimento', 'prezziMarche', 'confronto', 'entratiUsciti', 'metodo']);
  });

  it('niente pagine del volantino, vendite, previsione ne\' visibilita\' nel report', async () => {
    const { servizio } = creaServizio();

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(Object.keys(report).sort()).toEqual(['box', 'generatoIl', 'idKit', 'intestazione', 'palette', 'pdf', 'sezioni', 'sottotitolo', 'titolo', 'totalePagine']);
    expect(report.sezioni.map(sezione => sezione.tipo)).not.toContain('pagine');
    expect(report.palette).not.toHaveProperty('calore');
    expect(JSON.stringify(report)).not.toMatch(/"(zoneCalde|visibilita|calore|rendimento|previsione)"/);
  });

  it('senza regole del cliente: palette standard e intestazione col nome della GDO', async () => {
    const { servizio } = creaServizio();

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.palette).toEqual(PALETTE_REPORT_STANDARD);
    expect(report.intestazione).toEqual({ cliente: 'GDO di prova', sottotitolo: null, logo: null, riservatezza: 'Riservato - uso interno' });
  });

  it('palette e intestazione del cliente sopra gli standard; i grafici usano i suoi colori', async () => {
    const { servizio } = creaServizio({
      insightVolantino: {
        palette: { primario: '#123456', categorie: ['#aa0000', '#00aa00'] },
        intestazione: { cliente: 'Cliente di prova', riservatezza: 'Riservato' },
      },
    });

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.palette).toEqual({ ...PALETTE_REPORT_STANDARD, primario: '#123456', categorie: ['#aa0000', '#00aa00'] });
    expect(report.intestazione).toEqual({ cliente: 'Cliente di prova', sottotitolo: null, logo: null, riservatezza: 'Riservato' });
    const assortimento = report.sezioni.find(sezione => chiaveSezione(sezione) === 'assortimento');
    const meccaniche = assortimento?.tipo === 'grafici' ? assortimento.grafici.find(grafico => grafico.grafico.forma === 'ciambella')?.grafico : undefined;
    expect(meccaniche?.forma === 'ciambella' && meccaniche.voci[0].colore).toBe('#aa0000');
  });

  it('le sezioni sono quelle della libreria del cliente, che riceve i dati e le standard', async () => {
    const proprie: SezioneReport[] = [{ tipo: 'metodo', titolo: 'Note del cliente', paragrafi: ['Testo del cliente.'] }];
    const sezioniReport = vi.fn(() => proprie);
    const { servizio } = creaServizio({ insightVolantino: { sezioniReport } });

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.sezioni).toBe(proprie);
    const [dati, standard] = sezioniReport.mock.calls[0] as unknown as [Record<string, unknown>, SezioneReport[]];
    expect(dati).toMatchObject({
      contesto: { idKit: ID_KIT, titolo: 'Volantino 21', nomeGdo: 'GDO di prova', area: 'Toscana', canale: 'Conad City', validitaDal: '2026-11-03', validitaAl: '2026-11-16' },
      insight: { totalePagine: 4, totaleReferenze: 1, box: [BOX] },
      confronto: CONFRONTO,
      palette: PALETTE_REPORT_STANDARD,
    });
    expect(Object.keys(dati).sort()).toEqual(['confronto', 'contesto', 'insight', 'palette']);
    expect(dati.insight).not.toHaveProperty('zoneCalde');
    expect(standard.map(chiaveSezione)).toContain('sintesi');
  });

  it('se la libreria del cliente fallisce restano le sezioni standard, con un avviso', async () => {
    const { servizio } = creaServizio({ insightVolantino: { sezioniReport: () => { throw new Error('regola del cliente rotta'); } } });

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.sezioni.map(chiaveSezione)[0]).toBe('sintesi');
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('sezioni del cliente'), expect.objectContaining({ idKit: ID_KIT }));
  });

  it('senza GDO leggibile l\'intestazione resta senza nome, e il report esce lo stesso', async () => {
    const { servizio, gdo } = creaServizio();
    gdo.getGDOById.mockRejectedValueOnce(new Error('database non raggiungibile'));

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.intestazione.cliente).toBe('');
    expect(log.warn).toHaveBeenCalled();
  });
});

describe('ReportVolantinoService.report: ambito e confronto facoltativo', () => {
  it('un kit fuori ambito o inesistente e\' 404, senza leggere altro', async () => {
    const { servizio, letture, volantino, confronti } = creaServizio();
    letture.kitNellAmbito.mockResolvedValueOnce(null);

    await expect(servizio.report(ID_KIT, { idGdo: 'altra-gdo' })).rejects.toBeInstanceOf(NotFoundError);
    expect(volantino.getFlyerInsights).not.toHaveBeenCalled();
    expect(confronti.edizionePrecedente).not.toHaveBeenCalled();
  });

  it('confronto in errore: il report esce senza le sezioni del confronto', async () => {
    const { servizio, confronti } = creaServizio();
    confronti.edizionePrecedente.mockRejectedValueOnce(new Error('edizione precedente non leggibile'));

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.sezioni.map(chiaveSezione)).toEqual(['sintesi', 'assortimento', 'prezziMarche', 'metodo']);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('confronto'), expect.objectContaining({ idKit: ID_KIT, errore: 'edizione precedente non leggibile' }));
  });

  it('un 404 dal confronto vale per tutto il report', async () => {
    const { servizio, confronti } = creaServizio();
    confronti.edizionePrecedente.mockRejectedValueOnce(new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: ID_KIT }));

    await expect(servizio.report(ID_KIT, AMBITO)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('prima edizione: il report ha solo le sezioni dell\'impaginato', async () => {
    const { servizio, confronti } = creaServizio();
    confronti.edizionePrecedente.mockResolvedValueOnce(null);

    const report = await servizio.report(ID_KIT, AMBITO);

    expect(report.sezioni.map(chiaveSezione)).toEqual(['sintesi', 'assortimento', 'prezziMarche', 'metodo']);
    expect(log.warn).not.toHaveBeenCalled();
  });
});
