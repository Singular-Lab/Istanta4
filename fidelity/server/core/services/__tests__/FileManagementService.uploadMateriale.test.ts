import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE } from '../../../../lib/enums';
import type { FileItemKitLog } from '../../../../lib/types';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Spec acquisizione-materiali-esportati: il file su disco non va sovrascritto e il temporaneo non deve restare
describe('FileManagementService.uploadMateriale', () => {
  let tmpRoot: string;
  let temporaneo: string;

  beforeEach(() => {
    // cwd punta alla stessa radice del temporaneo: qualunque scrittura del servizio resterebbe visibile qui
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-upload-'));
    fs.mkdirSync(path.join(tmpRoot, 'temporanei'));
    temporaneo = path.join(tmpRoot, 'temporanei', '3f2a9c1e.pdf');
    fs.writeFileSync(temporaneo, '%PDF-1.4');
    vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  const fileSottoRadice = () => (fs.readdirSync(tmpRoot, { recursive: true }) as string[])
    .filter((relativo) => fs.statSync(path.join(tmpRoot, relativo)).isFile());

  const file = () => ({ path: temporaneo, originalname: 'materiale.pdf', mimetype: 'application/pdf' } as Express.Multer.File);

  it('errore: il temporaneo viene rimosso e nessun file viene scritto altrove', async () => {
    // Tipo export inesistente: il servizio si ferma prima di contattare Olimpo
    const tipoExportService = { getTipoExportById: vi.fn().mockResolvedValue(null) };
    const service = new FileManagementService(
      {} as any, tipoExportService as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );

    await expect(service.uploadMateriale(
      file(),
      { guidKitRuntime: 'kit-1', tipoExport: 'tipo-1', nomeFile: '../../fuori.pdf', meta: '{}' },
      { headers: {} } as any
    )).rejects.toThrow();

    expect(fileSottoRadice()).toEqual([]);
  });

  it('PDF caricato: Olimpo riceve il nome logico, il temporaneo viene rimosso e su disco non resta nulla', async () => {
    const tipoExportService = { getTipoExportById: vi.fn().mockResolvedValue({ codice: 'STAMPA' }) };
    const kitRuntimeService = {
      getKitRuntimeById: vi.fn().mockResolvedValue({ stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE }),
      getFilesRuntimeByIdKitRuntime: vi.fn().mockResolvedValue([]),
      insertNewFileRuntime: vi.fn().mockResolvedValue(undefined),
      getFileRunTimeLogByNomeFileEIdKitRuntime: vi.fn().mockResolvedValue(null),
      insertNewFileRuntimeLog: vi.fn().mockResolvedValue(undefined),
    };
    // Olimpo finto dietro il client HTTP comune
    const post = vi.fn(async () => new Response(
      JSON.stringify({ esito: true, error: '', content: { id: 'olimpo-1', file_name: 'volantino.pdf', json_meta: '{}' } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', post);
    const service = new FileManagementService(
      kitRuntimeService as any, tipoExportService as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );

    await service.uploadMateriale(
      file(),
      { guidKitRuntime: 'kit-1', tipoExport: 'tipo-1', nomeFile: '../volantino.pdf', meta: '{}' },
      { headers: { authorization: 'Bearer x' } } as any
    );

    const [url, opzioni] = post.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/materiali\/uploadMateriale$/);
    expect(((opzioni.body as FormData).get('file') as File).name).toBe('volantino.pdf');
    expect(new Headers(opzioni.headers).get('authorization')).toBe('Bearer x');
    // Tempo massimo degli upload: la chiamata parte con un segnale di scadenza
    expect(opzioni.signal).toBeInstanceOf(AbortSignal);
    expect(kitRuntimeService.insertNewFileRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'volantino.pdf', id_olimpo_cloud: 'olimpo-1' })
    );
    expect(fileSottoRadice()).toEqual([]);
  });

  /** Carica volantino.pdf con l'ultimo log del file indicato e restituisce il nuovo log registrato. */
  const caricaConUltimoLog = async (ultimoLog: FileItemKitLog | null) => {
    const kitRuntimeService = {
      getKitRuntimeById: vi.fn().mockResolvedValue({ stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE }),
      getFilesRuntimeByIdKitRuntime: vi.fn().mockResolvedValue([]),
      insertNewFileRuntime: vi.fn().mockResolvedValue(undefined),
      getFileRunTimeLogByNomeFileEIdKitRuntime: vi.fn().mockResolvedValue(ultimoLog),
      insertNewFileRuntimeLog: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ esito: true, error: '', content: { id: 'olimpo-1', file_name: 'volantino.pdf', json_meta: '{}' } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )));
    const dipendenze = [kitRuntimeService, { getTipoExportById: vi.fn().mockResolvedValue({ codice: 'STAMPA' }) }, {}, {}, {}, {}, {}];
    const service = new FileManagementService(
      ...(dipendenze as unknown as ConstructorParameters<typeof FileManagementService>)
    );

    await service.uploadMateriale(
      file(),
      { guidKitRuntime: 'kit-1', tipoExport: 'tipo-1', nomeFile: 'volantino.pdf', meta: '{}' },
      { headers: { authorization: 'Bearer x' } } as unknown as Request
    );

    expect(kitRuntimeService.getFileRunTimeLogByNomeFileEIdKitRuntime).toHaveBeenCalledWith('volantino.pdf', 'kit-1');
    expect(kitRuntimeService.insertNewFileRuntimeLog).toHaveBeenCalledOnce();
    return kitRuntimeService.insertNewFileRuntimeLog.mock.calls[0][0] as FileItemKitLog;
  };

  const logAllaVersione = (versione: number): FileItemKitLog => ({
    id: `log-v${versione}`,
    guid_kit_runtime: 'kit-1',
    nome_file: 'volantino.pdf',
    data_registrazione: new Date('2026-10-01T08:00:00.000Z'),
    versione,
    stato: STATO_LOG_FILE.IN_ATTESA,
    logs: [{ messaggio: `caricamento v${versione}`, data_notifica: new Date('2026-10-01T08:00:00.000Z'), azione: 'Upload' }],
  });

  // Ogni nuovo caricamento dello stesso file registra un log alla versione successiva all'ultima,
  // anche quando l'ultima e' la 0 (prima la versione 0 era trattata come "nessun log")
  it.each([
    { versioni: 'da 0 a 1', precedente: 0, attesa: 1 },
    { versioni: 'da 3 a 4', precedente: 3, attesa: 4 },
  ])('il nuovo log passa alla versione successiva all\'ultimo ($versioni) e ne conserva lo storico', async ({ precedente, attesa }) => {
    const ultimoLog = logAllaVersione(precedente);

    const nuovoLog = await caricaConUltimoLog(ultimoLog);

    expect(nuovoLog).toMatchObject({
      guid_kit_runtime: 'kit-1',
      nome_file: 'volantino.pdf',
      versione: attesa,
      stato: STATO_LOG_FILE.IN_ATTESA,
      logs: ultimoLog.logs,
    });
    expect(nuovoLog.id).not.toBe(ultimoLog.id);
  });

  it('senza log precedente il nuovo log parte dalla versione 0', async () => {
    const nuovoLog = await caricaConUltimoLog(null);

    expect(nuovoLog).toMatchObject({ guid_kit_runtime: 'kit-1', nome_file: 'volantino.pdf', versione: 0, stato: STATO_LOG_FILE.IN_ATTESA });
    expect(nuovoLog.logs).toBeUndefined();
  });
});
