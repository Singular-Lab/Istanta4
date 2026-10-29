import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_LOG_FILE, TIPO_ATTIVITA } from '../../../../lib/enums';
import { ExternalApiError } from '../../../../lib/errors';
import config from '../../config';
import { FilesRuntimeLog, type FilesRuntimeLogAttributes } from '../../models/files_runtime_log';
import { ServerUtils } from '../../utils/ServerUtils';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

/*
 * Contratto Fidelity -> Correggo4: POST {CORREGGO_IP_ADDRESS}/UploadVolFromFP.ashx con un .pack
 *   [4 byte big-endian: lunghezza dell'header] [header JSON UTF-8] [4 byte big-endian: lunghezza del PDF] [PDF]
 * Il consumatore (correggo4 IngestioneController.UploadVolFromFP + LettorePack.Leggi) risponde
 * { result: 'ok' | 'error', errorDetails }. Tutte le chiamate HTTP passano da un fetch finto.
 */

const CORREGGO_FINTO = 'http://127.0.0.1:61991';
const AUTORIZZAZIONE = 'Bearer integrazione-correggo';

// Header con lettere accentate e un trattino lungo: in UTF-8 occupa piu' byte che caratteri
const HEADER = JSON.stringify({ promo: { titolo: 'Volantino città – però più caffè' }, guidKitRuntime: 'kit-1' });
// PDF con byte oltre 0x7F: la copia nel pacchetto deve essere binaria, non testuale
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n%'), Buffer.from([0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff]), Buffer.from('\n%%EOF')]);

const olimpoOk = { esito: true, error: '', content: { id: 'olimpo-1', file_name: 'materiale.pdf', pagine: 4 } };

type Chiamata = { url: string; init: RequestInit };
type RigaLog = Pick<FilesRuntimeLogAttributes, 'id' | 'id_kit_runtime' | 'nome_file' | 'versione' | 'stato'> & {
  logs: Array<{ messaggio: string; data_notifica: string; azione: 'Upload' }>;
};

/** Intero a 32 bit big-endian scritto a mano, indipendente da Buffer.writeUInt32BE. */
const bigEndian32 = (n: number) => Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

const rispostaJson = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } });

describe('FileManagementService.invioMaterialeAdFP: pacchetto .pack verso Correggo', () => {
  let tmpRoot: string;
  let temporaneo: string;
  let chiamate: Chiamata[];
  let correggoPrecedente: string | undefined;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-correggo-'));
    temporaneo = path.join(tmpRoot, '3f2a9c1e.pdf');
    fs.writeFileSync(temporaneo, PDF);
    chiamate = [];
    correggoPrecedente = config.CORREGGO_IP_ADDRESS;
    config.CORREGGO_IP_ADDRESS = CORREGGO_FINTO;
  });

  afterEach(() => {
    config.CORREGGO_IP_ADDRESS = correggoPrecedente;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  /** Olimpo e Correggo finti dietro fetch; i log del file e le attivita' simulati sul modello. */
  function prepara(rispostaCorreggo: unknown, logEsistenti: RigaLog[]) {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      chiamate.push({ url, init });
      if (url.endsWith('/materiali/uploadMateriale')) return rispostaJson(olimpoOk);
      if (url.endsWith('/UploadVolFromFP.ashx')) return rispostaJson(rispostaCorreggo);
      throw new Error(`Chiamata non prevista dal test: ${url}`);
    }));

    // savePdfToOlympusAndFP cerca il log ma per CORREGGO non lo crea ne' lo aggiorna
    vi.spyOn(FilesRuntimeLog, 'findOne').mockResolvedValue(null);
    const cercaLog = vi.spyOn(FilesRuntimeLog, 'findAll')
      .mockResolvedValue(logEsistenti as unknown as Awaited<ReturnType<typeof FilesRuntimeLog.findAll>>);
    const aggiornaLog = vi.spyOn(FilesRuntimeLog, 'update')
      .mockResolvedValue([1] as unknown as Awaited<ReturnType<typeof FilesRuntimeLog.update>>);
    const creaLog = vi.spyOn(FilesRuntimeLog, 'create')
      .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof FilesRuntimeLog.create>>);
    const attivita = vi.spyOn(ServerUtils, 'CREA_ATTIVITA')
      .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof ServerUtils.CREA_ATTIVITA>>);

    const kitRuntimeService = {
      getFilesRuntimeByIdKitRuntime: vi.fn().mockResolvedValue([]),
      insertNewFileRuntime: vi.fn().mockResolvedValue({ id: 'file-1' }),
      updateSingleFileRuntime: vi.fn(),
    };
    const tipoExportService = { getTipoExportById: vi.fn().mockResolvedValue({ id: 'tipo-correggo', codice: 'CORREGGO' }) };
    const dipendenze = [kitRuntimeService, tipoExportService, {}, {}, {}, {}, {}];
    const service = new FileManagementService(
      ...(dipendenze as unknown as ConstructorParameters<typeof FileManagementService>)
    );

    const invia = (meta: unknown = HEADER) => service.invioMaterialeAdFP(
      'kit-1', 'tipo-correggo', 'materiale.pdf', meta,
      { path: temporaneo, originalname: 'materiale.pdf', mimetype: 'application/pdf' } as Express.Multer.File,
      { headers: { authorization: AUTORIZZAZIONE }, session: {} } as unknown as Request
    );

    return { invia, cercaLog, aggiornaLog, creaLog, attivita, kitRuntimeService };
  }

  const chiamataCorreggo = () => {
    const trovate = chiamate.filter(c => c.url.endsWith('/UploadVolFromFP.ashx'));
    expect(trovate).toHaveLength(1);
    return trovate[0];
  };

  const logAllaVersione = (id: string, versione: number): RigaLog => ({
    id,
    id_kit_runtime: 'kit-1',
    nome_file: 'materiale.pdf',
    versione,
    stato: STATO_LOG_FILE.IN_ATTESA,
    logs: [{ messaggio: `caricamento v${versione}`, data_notifica: '2026-10-01T08:00:00.000Z', azione: 'Upload' }],
  });

  it('il .pack e\' lunghezza header (byte, big-endian) + header UTF-8 + lunghezza PDF + PDF, byte per byte', async () => {
    const { invia } = prepara({ result: 'ok', errorDetails: '' }, []);

    await invia();

    const pack = (chiamataCorreggo().init.body as FormData).get('file') as File;
    expect(pack.name).toBe('materiale.pack');
    const byte = Buffer.from(await pack.arrayBuffer());

    const header = Buffer.from(HEADER, 'utf8');
    // Il caso ha senso solo se i byte superano i caratteri: la lunghezza deve essere quella in byte
    expect(header.length).toBeGreaterThan(HEADER.length);
    expect(byte.subarray(0, 4)).toEqual(bigEndian32(header.length));
    expect(byte.subarray(4, 4 + header.length).toString('utf8')).toBe(HEADER);
    expect(byte.subarray(4 + header.length, 8 + header.length)).toEqual(bigEndian32(PDF.length));
    expect(byte.subarray(8 + header.length)).toEqual(PDF);
    expect(byte).toEqual(Buffer.concat([bigEndian32(header.length), header, bigEndian32(PDF.length), PDF]));
  });

  it('chiama POST {CORREGGO_IP_ADDRESS}/UploadVolFromFP.ashx inoltrando l\'Authorization della richiesta', async () => {
    const { invia } = prepara({ result: 'ok', errorDetails: '' }, []);

    await invia();

    const { url, init } = chiamataCorreggo();
    expect(url).toBe(`${CORREGGO_FINTO}/UploadVolFromFP.ashx`);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe(AUTORIZZAZIONE);
    expect(init.body).toBeInstanceOf(FormData);
  });

  it.each([
    { caso: 'result error con errorDetails', risposta: { result: 'error', errorDetails: 'empty file', error_detail: 'empty file' }, messaggio: 'Correggo: empty file' },
    { caso: 'risposta senza result', risposta: { esito: true }, messaggio: "Correggo non ha confermato l'operazione" },
  ])('$caso: ExternalApiError 502 e log del file non aggiornato', async ({ risposta, messaggio }) => {
    const { invia, cercaLog, aggiornaLog, creaLog, attivita } = prepara(risposta, [logAllaVersione('log-1', 1)]);

    const errore = await invia().catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore).toMatchObject({ httpStatus: 502, message: messaggio });
    expect(cercaLog).not.toHaveBeenCalled();
    expect(aggiornaLog).not.toHaveBeenCalled();
    expect(creaLog).not.toHaveBeenCalled();
    expect(attivita).not.toHaveBeenCalled();
    // Il temporaneo non resta su disco nemmeno in caso di errore
    expect(fs.existsSync(temporaneo)).toBe(false);
  });

  it('risposta ok: il log alla versione piu\' alta passa a IN_ATTESA_DI_CORREGGO con la versione successiva', async () => {
    const { invia, aggiornaLog, creaLog, attivita } = prepara(
      { result: 'ok', errorDetails: '' },
      [logAllaVersione('log-v1', 1), logAllaVersione('log-v3', 3), logAllaVersione('log-v2', 2)]
    );

    const esito = await invia();

    expect(esito).toEqual({
      esito: true,
      error: '',
      content: { nome_file: 'materiale.pack', olympus_id: 'olimpo-1', pages: 4 },
    });
    expect(aggiornaLog).toHaveBeenCalledOnce();
    const [valori, opzioni] = aggiornaLog.mock.calls[0] as unknown as [
      { stato: STATO_LOG_FILE; versione: number; logs: Array<{ messaggio: string; data_notifica: Date }> },
      { where: { id: string } }
    ];
    expect(opzioni.where).toEqual({ id: 'log-v3' });
    expect(valori.stato).toBe(STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO);
    expect(valori.versione).toBe(4);
    // Lo storico resta, con le date normalizzate, e in coda c'e' l'invio a Correggo
    expect(valori.logs).toHaveLength(2);
    expect(valori.logs[0]).toMatchObject({ messaggio: 'caricamento v3', data_notifica: new Date('2026-10-01T08:00:00.000Z') });
    expect(valori.logs[1]).toMatchObject({ messaggio: 'File inviato a Correggo', azione: 'Upload', utente_notifica: 'system' });
    expect(creaLog).not.toHaveBeenCalled();
    expect(attivita).toHaveBeenCalledWith(
      null,
      TIPO_ATTIVITA.INVIO_FILE_CORREGGO,
      expect.anything(),
      expect.objectContaining({ nome_file: 'materiale.pack', id_kit_runtime: 'kit-1', id_olimpo_cloud: 'olimpo-1' })
    );
    expect(fs.existsSync(temporaneo)).toBe(false);
  });

  it('risposta ok senza log esistente: l\'invio riesce ma nessun log viene creato ne\' aggiornato (comportamento attuale)', async () => {
    const { invia, cercaLog, aggiornaLog, creaLog, kitRuntimeService } = prepara({ result: 'ok', errorDetails: '' }, []);

    const esito = await invia();

    expect(esito).toMatchObject({ esito: true, content: { nome_file: 'materiale.pack' } });
    expect(cercaLog).toHaveBeenCalledWith(expect.objectContaining({
      where: { id_kit_runtime: 'kit-1', nome_file: 'materiale.pdf' }
    }));
    expect(aggiornaLog).not.toHaveBeenCalled();
    expect(creaLog).not.toHaveBeenCalled();
    // Il file del kit invece e' registrato da savePdfToOlympusAndFP
    expect(kitRuntimeService.insertNewFileRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'materiale.pdf', id_olimpo_cloud: 'olimpo-1', tipo_export_codice: 'CORREGGO' })
    );
  });
});
