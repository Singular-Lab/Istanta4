import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type Express, type Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_DI_SISTEMA, STATO_LOG_FILE } from '../../../../lib/enums';
import type { FantasmaDeciso, FileItemKit, FileItemKitLog, ImportStorico, RecordListino, ReferenzeIstanta } from '../../../../lib/types';
import type { EsitoConfrontoStorico, PayloadConfrontoStorico, StoricoVolantinoAgenzia, SyncJsonPluginRef } from '../../agenzia_lib/types';
import type * as MulterConfig from '../../config/multerConfig';
import type { IExternalApiService } from '../../interfaces/IExternalApiService';
import type { EsitoListaVolantino, ListaVolantinoDaRegistrare } from '../../interfaces/IStoriaPuntoVenditaService';
import type { FilterTemplateService } from '../../services/FilterTemplateService';
import type { StatisticheApiService } from '../../services/StatisticheApiService';
import { ServerUtils } from '../../utils/ServerUtils';
import { ExternalApiController } from '../ExternalApiController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => { next(); },
}));
vi.mock('../../middleware/ephemeralTokenAuthMiddleware', () => ({
  ephemeralTokenAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => { next(); },
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => { next(); },
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Servizi del container: ogni test li ricrea in preparaServizi, qui c'e solo il registro
const stato = vi.hoisted(() => ({
  servizi: new Map<string, unknown>(),
  // Cartella temporanea del test: il file caricato non deve finire in uploads/tmp del repo
  cartellaUpload: '',
}));
vi.mock('../../di', () => ({
  TYPES: {
    KitRuntimeService: 'KitRuntimeService',
    ReferenzeService: 'ReferenzeService',
    PuntoVenditaService: 'PuntoVenditaService',
    StoriaPuntoVenditaService: 'StoriaPuntoVenditaService',
    PromoService: 'PromoService',
    AreaService: 'AreaService',
    CanaleService: 'CanaleService',
    TipoExportService: 'TipoExportService',
    AgenziaLib: 'AgenziaLib',
  },
  container: { get: (tipo: string) => stato.servizi.get(tipo) },
}));

// Come in produzione il volantino passa dal disco, ma nella cartella temporanea del test
vi.mock('../../config/multerConfig', async (importOriginal) => {
  const originale = await importOriginal<typeof MulterConfig>();
  const { default: multer } = await import('multer');
  const { randomUUID } = await import('node:crypto');
  return {
    ...originale,
    uploadMaterialiPubblicazioni: multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => { cb(null, stato.cartellaUpload); },
        filename: (_req, _file, cb) => { cb(null, `${randomUUID()}.pdf`); },
      }),
    }),
  };
});

const KIT = 'kit-1';
const PROMO = 'promo-1';
const AREA = 'area-1';
const CANALE = 'canale-1';
const NOME_FILE = 'VOL 45 Toscana.pdf';
const PDF = Buffer.from('%PDF-1.4\n% volantino finto del test\n');

/** Un box del volantino come lo manda il plugin: le foto possono arrivare come semplici nomi. */
const boxPlugin = (groupId: number, codice: string) => ({
  groupId,
  dna: `$dna{\n${codice}\n}`,
  foto: [`${codice}.psd`],
  compiledFields: [{ labelName: 'descrizione', paragraphName: 'desc', content: `Prodotto ${codice}` }],
});

/** Lo stesso box dopo il confronto con lo storico: a listino, col suo dato. */
const boxDaListino = (groupId: number, codice: string): SyncJsonPluginRef => ({
  groupId,
  dna: `$dna{\n${codice}\n}`,
  foto: [{ nome: `${codice}.psd`, guidId: `g-${codice}` }],
  compiledFields: [{ labelName: 'descrizione', paragraphName: 'desc', content: `Prodotto ${codice}` }],
  dataFields: { codice_referenza: codice, descrizione_uno: `PRODOTTO ${codice}` },
  pag: 2, x: 10, y: 20, w: 60, h: 40, wPage: 600, hPage: 800, percIngombro: 5, aspectRatio: 1.5,
});

/** Box del volantino che a listino non c'e (fantasma). */
const boxFantasma = (groupId: number, codice: string): SyncJsonPluginRef => ({
  groupId,
  dna: `$dna{\n${codice}\n}`,
  foto: [],
  compiledFields: [{ content: `Testo del box ${groupId}` }],
  pag: 3, x: 1, y: 2, w: 3, h: 4, wPage: 600, hPage: 800, percIngombro: 2, aspectRatio: 0.75,
});

const payloadBase = (): Record<string, unknown> => ({
  promo: 'Volantino 45',
  promoId: PROMO,
  areaId: AREA,
  canaleId: CANALE,
  kitGuidId: KIT,
  fileName: NOME_FILE,
  scannedAt: '2026-10-29T08:00:00.000Z',
  exportPath: '/export/vol45',
  refs: [boxPlugin(8, '4969665'), boxPlugin(9, '1404871')],
});

const esitoSenzaProblemi = (): EsitoConfrontoStorico => ({
  lista: [boxDaListino(8, '4969665'), boxDaListino(9, '1404871')],
  nonImpaginate: [],
  fuoriListino: [],
});

function preparaServizi() {
  const kitRuntime = {
    getKitRuntimeById: vi.fn(async (_id: string): Promise<{ guidId: string; guidArea: string; guidCanale: string } | null> => (
      { guidId: KIT, guidArea: AREA, guidCanale: CANALE }
    )),
    getFilesRuntimeByIdKitRuntime: vi.fn(async (_id: string): Promise<FileItemKit[] | null> => []),
    insertNewFileRuntime: vi.fn(async (_file: FileItemKit) => undefined),
    updateSingleFileRuntime: vi.fn(async (_file: FileItemKit) => undefined),
    getFileRunTimeLogByNomeFileEIdKitRuntime: vi.fn(async (_nomeFile: string, _idKit: string): Promise<FileItemKitLog | null> => null),
    insertNewFileRuntimeLog: vi.fn(async (_log: FileItemKitLog) => undefined),
    salvaImportStorico: vi.fn(async (_idKit: string, _esito: ImportStorico) => undefined),
    pubblicaKitDaStorico: vi.fn(async (_idKit: string, _idUtente: string) => true),
  };
  const referenze = {
    sostituisciReferenzeKit: vi.fn(async (_idKit: string, _referenze: ReferenzeIstanta[]) => undefined),
  };
  // L'anagrafica dei PV non si tocca piu' dal sync: la lista del volantino va nella storia dei PV
  const puntiVendita = {
    createPuntoVendita: vi.fn(),
    updatePuntoVendita: vi.fn(),
  };
  const storiaPuntiVendita = {
    registraListaVolantino: vi.fn(async (_lista: ListaVolantinoDaRegistrare): Promise<EsitoListaVolantino> => (
      { registrata: true, righe: 3, abbinate: 2, nonAbbinate: 1 }
    )),
  };
  const promo = {
    getPromoById: vi.fn(async (_id: string): Promise<{ id: string; context: Array<Record<string, unknown>> } | null> => ({
      id: PROMO,
      context: [{ nome_field: 'ap_name', user_value: 'LA SPEZIA', tipo: 'testo' }],
    })),
  };
  const area = { getAreaById: vi.fn(async (_id: string): Promise<{ id: string } | null> => ({ id: AREA })) };
  const canale = { getCanaleById: vi.fn(async (_id: string): Promise<{ id: string } | null> => ({ id: CANALE })) };
  const tipoExport = {
    getTipoExportByCodice: vi.fn(async (_codice: string): Promise<{ id: string; codice: string } | null> => ({ id: 'tipo-vol', codice: 'VOL' })),
  };
  const confronta = vi.fn(async (_req: Request, _payload: PayloadConfrontoStorico): Promise<EsitoConfrontoStorico> => esitoSenzaProblemi());
  const storico: StoricoVolantinoAgenzia = {
    confronta,
    campiObbligatoriFuoriListino: [{ campo: 'codice', etichetta: 'Codice referenza' }],
    referenzaFuoriListino: (record: RecordListino) => ({ dataFields: { codice_referenza: String(record.codice ?? '') }, meccanica: '' }),
    referenzaPerReport: (record: RecordListino) => ({ codice: String(record.codice ?? ''), descrizione: String(record.descrizione ?? ''), campi: [] }),
  };
  const agenziaLib: { storicoVolantino?: StoricoVolantinoAgenzia } = { storicoVolantino: storico };
  // Upload del PDF su Olimpo: nessuna chiamata di rete, risponde il finto Olimpo
  const uploadOlimpo = vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({
    data: { esito: true, error: '', content: { id: 'materiale-olimpo-1', file_name: 'volantino.pdf', json_meta: '{}', pagine: 4 } },
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
  });

  stato.servizi.clear();
  stato.servizi.set('KitRuntimeService', kitRuntime);
  stato.servizi.set('ReferenzeService', referenze);
  stato.servizi.set('PuntoVenditaService', puntiVendita);
  stato.servizi.set('StoriaPuntoVenditaService', storiaPuntiVendita);
  stato.servizi.set('PromoService', promo);
  stato.servizi.set('AreaService', area);
  stato.servizi.set('CanaleService', canale);
  stato.servizi.set('TipoExportService', tipoExport);
  stato.servizi.set('AgenziaLib', agenziaLib);

  return { kitRuntime, referenze, puntiVendita, storiaPuntiVendita, promo, area, canale, tipoExport, confronta, agenziaLib, uploadOlimpo };
}
type Servizi = ReturnType<typeof preparaServizi>;

function creaApp(): Express {
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u-operatore', id_gdo: 'gdo-1' } as Request['session'];
    next();
  });
  new ExternalApiController({} as IExternalApiService, {} as StatisticheApiService, {} as FilterTemplateService).registerRoutes(app);
  return app;
}

/** Invia il volantino come il plugin: il payload come testo e il PDF come file. */
async function invia(payload: unknown, opzioni: { conFile?: boolean } = {}) {
  const richiesta = request(creaApp())
    .post('/api/external/sync_json_plugin')
    .field('payload', typeof payload === 'string' ? payload : JSON.stringify(payload));
  return opzioni.conFile === false ? richiesta : richiesta.attach('file', PDF, 'volantino.pdf');
}

/** Il controller rimuove il temporaneo anche quando risponde con un errore (nel finally, dopo la risposta). */
async function cartellaUploadVuota() {
  await vi.waitFor(() => { expect(fs.readdirSync(stato.cartellaUpload)).toEqual([]); });
}

/** Nessun dato scritto: ne referenze, ne esito dell'import, ne file o log del kit, ne PDF su Olimpo. */
function nessunaScrittura(servizi: Servizi) {
  expect(servizi.referenze.sostituisciReferenzeKit).not.toHaveBeenCalled();
  expect(servizi.kitRuntime.salvaImportStorico).not.toHaveBeenCalled();
  expect(servizi.kitRuntime.insertNewFileRuntime).not.toHaveBeenCalled();
  expect(servizi.kitRuntime.updateSingleFileRuntime).not.toHaveBeenCalled();
  expect(servizi.kitRuntime.insertNewFileRuntimeLog).not.toHaveBeenCalled();
  expect(servizi.kitRuntime.pubblicaKitDaStorico).not.toHaveBeenCalled();
  expect(servizi.storiaPuntiVendita.registraListaVolantino).not.toHaveBeenCalled();
  expect(servizi.uploadOlimpo).not.toHaveBeenCalled();
}

/** Il payload e stato respinto prima di cercare promo, area, canale e kit. */
function nessunaRicerca(servizi: Servizi) {
  expect(servizi.promo.getPromoById).not.toHaveBeenCalled();
  expect(servizi.area.getAreaById).not.toHaveBeenCalled();
  expect(servizi.canale.getCanaleById).not.toHaveBeenCalled();
  expect(servizi.kitRuntime.getKitRuntimeById).not.toHaveBeenCalled();
}

beforeEach(() => {
  stato.cartellaUpload = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-sync-json-'));
});

afterEach(() => {
  fs.rmSync(stato.cartellaUpload, { recursive: true, force: true });
  stato.servizi.clear();
});

describe('POST /api/external/sync_json_plugin: payload', () => {
  it('payload che non e JSON: 400 e il file temporaneo viene rimosso', async () => {
    const servizi = preparaServizi();

    const res = await invia('{ questo non e json');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Errore durante il parsing del json');
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it('senza il campo payload: 400 come un JSON non valido', async () => {
    preparaServizi();

    const res = await request(creaApp()).post('/api/external/sync_json_plugin').attach('file', PDF, 'volantino.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Errore durante il parsing del json');
    await cartellaUploadVuota();
  });

  it.each([
    { caso: 'null', payload: 'null' },
    { caso: 'un numero', payload: '42' },
    { caso: 'un elenco', payload: '[{"promoId":"promo-1"}]' },
  ])('JSON valido ma $caso: 400 "Il payload deve essere un oggetto JSON", non un 500', async ({ payload }) => {
    const servizi = preparaServizi();

    const res = await invia(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Il payload deve essere un oggetto JSON');
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it('senza file: 400', async () => {
    const servizi = preparaServizi();

    const res = await invia(payloadBase(), { conFile: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Il file non è presente');
    nessunaRicerca(servizi);
    nessunaScrittura(servizi);
  });

  it.each([
    { campo: 'promoId', messaggio: "L'id promo non è valido" },
    { campo: 'areaId', messaggio: "L'id dell'area non è valido" },
    { campo: 'canaleId', messaggio: "L'id del canale non è valido" },
    { campo: 'kitGuidId', messaggio: "L'id del kit non è valido" },
  ])('senza $campo: 400 "$messaggio" prima di qualunque ricerca', async ({ campo, messaggio }) => {
    const servizi = preparaServizi();
    const payload = payloadBase();
    delete payload[campo];

    const res = await invia(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(messaggio);
    nessunaRicerca(servizi);
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it.each([
    { caso: 'assente', refs: undefined },
    { caso: 'un oggetto', refs: { groupId: 8 } },
    { caso: 'una stringa', refs: '8,9' },
  ])('refs $caso: 400 prima di qualunque ricerca, nessuna scrittura', async ({ refs }) => {
    const servizi = preparaServizi();

    const res = await invia({ ...payloadBase(), refs });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Le referenze del volantino (refs) devono essere un elenco');
    nessunaRicerca(servizi);
    expect(servizi.confronta).not.toHaveBeenCalled();
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });
});

describe('POST /api/external/sync_json_plugin: anagrafiche', () => {
  it.each([
    { cosa: 'promo', manca: (s: Servizi) => { s.promo.getPromoById.mockResolvedValue(null); }, messaggio: 'Non esiste nessuna promo con questo id' },
    { cosa: 'area', manca: (s: Servizi) => { s.area.getAreaById.mockResolvedValue(null); }, messaggio: 'Non esiste nessuna area con questo id' },
    { cosa: 'canale', manca: (s: Servizi) => { s.canale.getCanaleById.mockResolvedValue(null); }, messaggio: 'Non esiste nessun canale con questo id' },
    { cosa: 'kit runtime', manca: (s: Servizi) => { s.kitRuntime.getKitRuntimeById.mockResolvedValue(null); }, messaggio: 'Non esiste nessuna kit runtime con questo id' },
  ])('$cosa inesistente: 400 "$messaggio"', async ({ manca, messaggio }) => {
    const servizi = preparaServizi();
    manca(servizi);

    const res = await invia(payloadBase());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(messaggio);
    // Il payload e valido: si arriva davvero alle ricerche, a partire dalla promo
    expect(servizi.promo.getPromoById).toHaveBeenCalledWith(PROMO);
    expect(servizi.confronta).not.toHaveBeenCalled();
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it('cerca promo, area, canale e kit con gli id del payload', async () => {
    const servizi = preparaServizi();

    await invia(payloadBase());

    expect(servizi.promo.getPromoById).toHaveBeenCalledWith(PROMO);
    expect(servizi.area.getAreaById).toHaveBeenCalledWith(AREA);
    expect(servizi.canale.getCanaleById).toHaveBeenCalledWith(CANALE);
    expect(servizi.kitRuntime.getKitRuntimeById).toHaveBeenCalledWith(KIT);
  });

  it.each([
    { caso: 'di un\'altra area', guidArea: 'area-2', guidCanale: CANALE },
    { caso: 'di un altro canale', guidArea: AREA, guidCanale: 'canale-2' },
  ])('kit $caso: 400 senza confronto con lo storico', async ({ guidArea, guidCanale }) => {
    const servizi = preparaServizi();
    servizi.kitRuntime.getKitRuntimeById.mockResolvedValue({ guidId: KIT, guidArea, guidCanale });

    const res = await invia(payloadBase());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`Il kit ${KIT} appartiene ad area/canale ${guidArea}/${guidCanale}, non a ${AREA}/${CANALE}`);
    expect(servizi.confronta).not.toHaveBeenCalled();
    nessunaScrittura(servizi);
  });

  it('tipo export VOL non configurato: 400 "Il tipo di export VOL non e configurato"', async () => {
    const servizi = preparaServizi();
    servizi.tipoExport.getTipoExportByCodice.mockResolvedValue(null);

    const res = await invia(payloadBase());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Il tipo di export VOL non e configurato');
    expect(servizi.tipoExport.getTipoExportByCodice).toHaveBeenCalledWith(EXPORT_DI_SISTEMA.VOL);
    expect(servizi.confronta).not.toHaveBeenCalled();
    nessunaScrittura(servizi);
  });
});

describe('POST /api/external/sync_json_plugin: storico del cliente', () => {
  it('cliente senza storico: 400 esplicito e nessuna scrittura', async () => {
    const servizi = preparaServizi();
    delete servizi.agenziaLib.storicoVolantino;

    const res = await invia(payloadBase());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("L'import del volantino da storico non e disponibile per questo cliente");
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it('orfanelli senza lasciapassare: esito negativo con l\'elenco, nessuna scrittura', async () => {
    const servizi = preparaServizi();
    const orfanello = { codice: '5550001', descrizione: 'PASSATA 700G' };
    servizi.confronta.mockResolvedValue({ ...esitoSenzaProblemi(), nonImpaginate: [orfanello] });

    const res = await invia(payloadBase());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, esito: false, orfanelli: [orfanello], fantasmi: [] });
    expect(res.body.error).toContain('serve il lasciapassare');
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it('orfanelli col lasciapassare: si salva e l\'esito dell\'import li registra', async () => {
    const servizi = preparaServizi();
    const orfanello = { codice: '5550001', descrizione: 'PASSATA 700G' };
    servizi.confronta.mockResolvedValue({ ...esitoSenzaProblemi(), nonImpaginate: [orfanello] });

    const res = await invia({ ...payloadBase(), lasciapassareOrfanelli: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, orfanelliIgnorati: 1 });
    expect(servizi.referenze.sostituisciReferenzeKit).toHaveBeenCalledTimes(1);
    expect(servizi.kitRuntime.salvaImportStorico).toHaveBeenCalledWith(KIT, expect.objectContaining({
      nonImpaginate: [orfanello],
      lasciapassareNonImpaginate: true,
    }));
  });

  it('fantasmi senza conferma: esito negativo con l\'elenco, nessuna scrittura', async () => {
    const servizi = preparaServizi();
    const fantasma = boxFantasma(12, '7770001');
    servizi.confronta.mockResolvedValue({ ...esitoSenzaProblemi(), fuoriListino: [fantasma] });

    const res = await invia(payloadBase());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, esito: false, orfanelli: [], fantasmi: [fantasma] });
    expect(res.body.error).toContain('serve la conferma');
    nessunaScrittura(servizi);
    await cartellaUploadVuota();
  });

  it('fantasmi confermati ma senza decisione: dice quale box manca, nessuna scrittura', async () => {
    const servizi = preparaServizi();
    servizi.confronta.mockResolvedValue({ ...esitoSenzaProblemi(), fuoriListino: [boxFantasma(12, '7770001')] });

    const res = await invia({ ...payloadBase(), confermaFantasmi: true, fantasmi: [] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, esito: false });
    expect(res.body.fantasmiIncompleti).toEqual([expect.objectContaining({ groupId: 12, pag: 3 })]);
    nessunaScrittura(servizi);
  });
});

describe('POST /api/external/sync_json_plugin: salvataggio', () => {
  it('salva le referenze del listino, registra l\'import e rimuove il file temporaneo', async () => {
    const servizi = preparaServizi();
    const rimozione = vi.spyOn(fs.promises, 'rm');

    const res = await invia({ ...payloadBase(), confermaFantasmi: false, fantasmi: [], lasciapassareOrfanelli: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true, referenzeCreate: 2, referenzeFantasmaCreate: 0, fantasmiIgnorati: 0, orfanelliIgnorati: 0,
    });

    // Lo storico riceve il contesto della promo e le foto normalizzate, senza le decisioni dell'operatore
    const [, inviatoAlloStorico] = servizi.confronta.mock.calls[0];
    expect(inviatoAlloStorico.promoContext).toEqual([{ nome_field: 'ap_name', user_value: 'LA SPEZIA' }]);
    expect(inviatoAlloStorico.refs.map((ref) => ref.foto)).toEqual([[{ nome: '4969665.psd' }], [{ nome: '1404871.psd' }]]);
    expect(inviatoAlloStorico).not.toHaveProperty('confermaFantasmi');
    expect(inviatoAlloStorico).not.toHaveProperty('fantasmi');
    expect(inviatoAlloStorico).not.toHaveProperty('lasciapassareOrfanelli');

    // Il PDF va su Olimpo col suo hash e il nome indicato dal plugin
    const [, url, metodo, corpo] = servizi.uploadOlimpo.mock.calls[0];
    expect(url).toMatch(/\/materiali\/uploadMateriale$/);
    expect(metodo).toBe('POST');
    const metaMateriale = JSON.parse(String((corpo as FormData).get('json_meta_materiale')));
    expect(metaMateriale).toMatchObject({ FileName: NOME_FILE, FileHash: createHash('md5').update(PDF).digest('hex') });

    // Nuovo file del kit col tipo export VOL
    expect(servizi.kitRuntime.insertNewFileRuntime).toHaveBeenCalledWith(expect.objectContaining({
      id_runtime: KIT, id_olimpo_cloud: 'materiale-olimpo-1', nome: NOME_FILE, tipo_export: 'tipo-vol', tipo_export_codice: 'VOL', pages: 4,
    }));
    expect(servizi.kitRuntime.updateSingleFileRuntime).not.toHaveBeenCalled();

    // Le referenze del kit vengono sostituite in un colpo solo con quelle del listino
    expect(servizi.referenze.sostituisciReferenzeKit).toHaveBeenCalledTimes(1);
    const [idKit, referenze] = servizi.referenze.sostituisciReferenzeKit.mock.calls[0];
    expect(idKit).toBe(KIT);
    expect(referenze.map((referenza) => referenza.codiceBox)).toEqual(['8', '9']);
    expect(referenze[0]).toMatchObject({
      guidIdKitRuntime: KIT,
      idPromo: PROMO,
      contextPromo: [{ nome_field: 'ap_name', user_value: 'LA SPEZIA' }],
      visibile: true,
      foto: [{ nome: '4969665.psd', guidId: 'g-4969665' }],
      dataFields: { codice_referenza: '4969665', descrizione_uno: 'PRODOTTO 4969665' },
      compiledFields: [{
        labelName: 'descrizione', paragraphName: 'desc', content: 'Prodotto 4969665', label_name: 'descrizione', paragraph_name: 'desc',
      }],
      pag: 2, x: 10, y: 20, w: 60, h: 40,
    });

    expect(servizi.kitRuntime.salvaImportStorico).toHaveBeenCalledTimes(1);
    expect(servizi.kitRuntime.salvaImportStorico).toHaveBeenCalledWith(KIT, expect.objectContaining({
      nomeFile: NOME_FILE,
      nonImpaginate: [],
      lasciapassareNonImpaginate: false,
      fuoriListino: [],
      fuoriListinoIgnorati: 0,
      boxNelVolantino: 2,
      referenzeDaListino: 2,
      boxFuoriListino: [],
    }));

    // Il temporaneo scritto da multer e rimosso con fs.promises.rm prima delle scritture sul kit
    expect(rimozione).toHaveBeenCalledTimes(1);
    const percorso = String(rimozione.mock.calls[0][0]);
    expect(path.dirname(percorso)).toBe(stato.cartellaUpload);
    expect(fs.existsSync(percorso)).toBe(false);
    await cartellaUploadVuota();
  });

  it('fantasmi confermati e decisi: il compilato diventa referenza, l\'ignorato no', async () => {
    const servizi = preparaServizi();
    servizi.confronta.mockResolvedValue({
      ...esitoSenzaProblemi(),
      fuoriListino: [boxFantasma(12, '7770001'), boxFantasma(13, '7770002')],
    });
    const decisi: FantasmaDeciso[] = [
      { groupId: 12, pag: 3, ignorato: false, referenze: [{ codice: '7770001', descrizione: 'OLIVE VERDI' }] },
      { groupId: 13, pag: 3, ignorato: true, referenze: [] },
    ];

    const res = await invia({ ...payloadBase(), confermaFantasmi: true, fantasmi: decisi });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, referenzeCreate: 2, referenzeFantasmaCreate: 1, fantasmiIgnorati: 1 });
    const [, referenze] = servizi.referenze.sostituisciReferenzeKit.mock.calls[0];
    expect(referenze.map((referenza) => referenza.codiceBox)).toEqual(['8', '9', '12']);
    expect(referenze[2]).toMatchObject({
      guidIdKitRuntime: KIT, dataFields: { codice_referenza: '7770001' }, pag: 3, x: 1, y: 2, w: 3, h: 4,
    });
    expect(servizi.kitRuntime.salvaImportStorico).toHaveBeenCalledWith(KIT, expect.objectContaining({
      fuoriListino: [{ codiceBox: '12', pag: 3, codice: '7770001', descrizione: 'OLIVE VERDI' }],
      fuoriListinoIgnorati: 1,
    }));
  });
});

describe('POST /api/external/sync_json_plugin: lista dei punti vendita', () => {
  const LISTA_PV = 'LIGURIA\rProvincia di GENOVA\rPRA - Via Murtola 12/14 - tel. 010 6197180';

  it('registra la lista del volantino nella storia dei PV e risponde con righe e abbinamenti', async () => {
    const servizi = preparaServizi();

    const res = await invia({ ...payloadBase(), pv: LISTA_PV });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, pvRighe: 3, pvAbbinate: 2, pvNonAbbinate: 1 });
    expect(res.body).not.toHaveProperty('pvErrore');
    // I vecchi campi dell'import in anagrafica non ci sono piu'
    for (const campo of ['pvMatched', 'pvCreated', 'pvUpdated', 'pvMissing', 'pvPossibleDuplicates', 'pvDuplicates']) {
      expect(res.body).not.toHaveProperty(campo);
    }
    expect(servizi.storiaPuntiVendita.registraListaVolantino).toHaveBeenCalledWith({
      idKit: KIT, pv: LISTA_PV, pvData: undefined, nomeFile: NOME_FILE, idGdoRiserva: 'gdo-1',
    });
    // Dopo referenze e report dell'import
    expect(servizi.storiaPuntiVendita.registraListaVolantino.mock.invocationCallOrder[0])
      .toBeGreaterThan(servizi.kitRuntime.salvaImportStorico.mock.invocationCallOrder[0]);
  });

  it('non crea ne\' modifica punti vendita dell\'anagrafica, nemmeno con pvData.gruppi', async () => {
    const servizi = preparaServizi();
    const pvData = { testo: '', paragrafi: [], gruppi: [{ intestazione: 'BOLOGNA', style: 'citta', puntiVendita: [{ testo: 'Via Emilia 5', indirizzo: 'Via Emilia 5' }] }] };

    const res = await invia({ ...payloadBase(), pvData });

    expect(res.status).toBe(200);
    expect(servizi.puntiVendita.createPuntoVendita).not.toHaveBeenCalled();
    expect(servizi.puntiVendita.updatePuntoVendita).not.toHaveBeenCalled();
    expect(servizi.storiaPuntiVendita.registraListaVolantino).toHaveBeenCalledWith(expect.objectContaining({ idKit: KIT, pvData }));
  });

  it('un nuovo invio dello stesso volantino registra di nuovo la lista dello stesso kit (che la sostituisce)', async () => {
    const servizi = preparaServizi();

    await invia({ ...payloadBase(), pv: LISTA_PV });
    await invia({ ...payloadBase(), pv: LISTA_PV });

    expect(servizi.storiaPuntiVendita.registraListaVolantino).toHaveBeenCalledTimes(2);
    expect(servizi.storiaPuntiVendita.registraListaVolantino.mock.calls.map(([lista]) => lista.idKit)).toEqual([KIT, KIT]);
    expect(servizi.referenze.sostituisciReferenzeKit).toHaveBeenCalledTimes(2);
  });

  it('un errore nella registrazione della lista non fa fallire il sync: lo dice nella risposta', async () => {
    const servizi = preparaServizi();
    servizi.storiaPuntiVendita.registraListaVolantino.mockRejectedValue(new Error('database giu'));

    const res = await invia({ ...payloadBase(), pv: LISTA_PV });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, referenzeCreate: 2, pvRighe: 0, pvAbbinate: 0, pvNonAbbinate: 0 });
    // Il dettaglio del database resta nel log
    expect(res.body.pvErrore).toBe('Lista dei punti vendita non registrata: errore interno, reinviare il volantino');
    expect(servizi.referenze.sostituisciReferenzeKit).toHaveBeenCalledTimes(1);
    expect(servizi.kitRuntime.salvaImportStorico).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/external/sync_json_plugin: pubblicazione del kit', () => {
  it('il volantino recuperato dallo storico pubblica il kit, dopo referenze e report', async () => {
    const servizi = preparaServizi();

    const res = await invia(payloadBase());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, kitPubblicato: true });
    expect(servizi.kitRuntime.pubblicaKitDaStorico).toHaveBeenCalledWith(KIT, 'u-operatore');
    expect(servizi.kitRuntime.pubblicaKitDaStorico.mock.invocationCallOrder[0])
      .toBeGreaterThan(servizi.kitRuntime.salvaImportStorico.mock.invocationCallOrder[0]);
  });

  it('kit gia\' pubblicato (nuovo invio): il sync riesce e dice che non l\'ha ripubblicato', async () => {
    const servizi = preparaServizi();
    servizi.kitRuntime.pubblicaKitDaStorico.mockResolvedValue(false);

    const res = await invia(payloadBase());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, kitPubblicato: false, referenzeCreate: 2 });
  });

  it('orfanelli senza lasciapassare: niente pubblicazione', async () => {
    const servizi = preparaServizi();
    servizi.confronta.mockResolvedValue({ ...esitoSenzaProblemi(), nonImpaginate: [{ codice: '1' }] });

    const res = await invia(payloadBase());

    expect(res.body).toMatchObject({ success: false });
    expect(servizi.kitRuntime.pubblicaKitDaStorico).not.toHaveBeenCalled();
  });
});

describe('POST /api/external/sync_json_plugin: log del file', () => {
  const logEsistente = (versione: number): FileItemKitLog => ({
    id: 'log-precedente',
    guid_kit_runtime: KIT,
    nome_file: NOME_FILE,
    data_registrazione: new Date('2026-10-01T08:00:00.000Z'),
    versione,
    stato: STATO_LOG_FILE.ACCETTATO,
    logs: [{ messaggio: `Caricato volantino: ${NOME_FILE} per storico`, data_notifica: new Date('2026-10-01T08:00:00.000Z'), azione: 'Upload', utente_notifica: 'u-altro' }],
  });

  it.each([
    { precedente: 0, attesa: 1 },
    { precedente: 3, attesa: 4 },
  ])('log esistente con versione $precedente: il nuovo log ha versione $attesa', async ({ precedente, attesa }) => {
    const servizi = preparaServizi();
    const esistente = logEsistente(precedente);
    servizi.kitRuntime.getFileRunTimeLogByNomeFileEIdKitRuntime.mockResolvedValue(esistente);

    const res = await invia(payloadBase());

    expect(res.status).toBe(200);
    expect(servizi.kitRuntime.getFileRunTimeLogByNomeFileEIdKitRuntime).toHaveBeenCalledWith(NOME_FILE, KIT);
    expect(servizi.kitRuntime.insertNewFileRuntimeLog).toHaveBeenCalledTimes(1);
    const [nuovo] = servizi.kitRuntime.insertNewFileRuntimeLog.mock.calls[0];
    expect(nuovo).toMatchObject({ guid_kit_runtime: KIT, nome_file: NOME_FILE, versione: attesa, stato: STATO_LOG_FILE.IN_ATTESA });
    expect(nuovo.id).not.toBe(esistente.id);
    // La storia del file non si perde con la nuova versione
    expect(nuovo.logs).toEqual(expect.arrayContaining(esistente.logs ?? []));
  });

  it('senza log precedente: nuovo log con versione 1 e l\'upload dell\'operatore', async () => {
    const servizi = preparaServizi();

    const res = await invia(payloadBase());

    expect(res.status).toBe(200);
    expect(servizi.kitRuntime.insertNewFileRuntimeLog).toHaveBeenCalledTimes(1);
    const [nuovo] = servizi.kitRuntime.insertNewFileRuntimeLog.mock.calls[0];
    expect(nuovo).toMatchObject({ guid_kit_runtime: KIT, nome_file: NOME_FILE, versione: 1, stato: STATO_LOG_FILE.IN_ATTESA });
    expect(nuovo.logs).toEqual([expect.objectContaining({
      azione: 'Upload', messaggio: `Caricato volantino: ${NOME_FILE} per storico`, utente_notifica: 'u-operatore',
    })]);
  });
});
