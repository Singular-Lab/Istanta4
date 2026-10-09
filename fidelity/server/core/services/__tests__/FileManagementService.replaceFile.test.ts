import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalApiError } from '../../../../lib/errors';
import { FilesRuntime } from '../../models/files_runtime';
import { FilesRuntimeLog } from '../../models/files_runtime_log';
import { ServerUtils } from '../../utils/ServerUtils';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// File del kit da sostituire: il nome nel kit e diverso dal nome del file caricato in sostituzione
const fileDelKit = { id: 'file-1', id_runtime: 'kit-1', nome: 'volantino_TO.pdf', meta_olimpo_cloud: { reparto: 'ORTO' } };
const fileCaricato = { buffer: Buffer.from('%PDF-1.4'), originalname: 'correzione_finale.pdf', mimetype: 'application/pdf' } as Express.Multer.File;
const req = { session: { id_utente: 'u1' } } as any;

function makeService(rispostaOlimpo: unknown) {
  vi.spyOn(FilesRuntime, 'findOne').mockResolvedValue(fileDelKit as any);
  const upload = vi.spyOn(ServerUtils, 'sendToFicoApiAxiosUpload').mockResolvedValue({ data: rispostaOlimpo, status: 200 } as any);
  const updateFile = vi.spyOn(FilesRuntime, 'update').mockResolvedValue([1] as any);
  const service = new FileManagementService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, upload, updateFile };
}

const caricato = { esito: true, error: '', content: { id: 'olimpo-nuovo', file_name: 'correzione_finale.pdf', json_meta: '{}' } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FileManagementService.replaceFileKitRuntime', () => {
  it('upload riuscito: il file del kit punta al nuovo materiale e il log e quello del file sostituito', async () => {
    const { service, upload, updateFile } = makeService(caricato);
    const cercaLog = vi.spyOn(FilesRuntimeLog, 'findOne').mockResolvedValue({ id: 'log-1', versione: 2, logs: [] } as any);
    const aggiornaLog = vi.spyOn(FilesRuntimeLog, 'update').mockResolvedValue([1] as any);

    await service.replaceFileKitRuntime('file-1', fileCaricato, req);

    expect(upload).toHaveBeenCalledWith(req, expect.stringMatching(/\/materiali\/uploadMateriale$/), expect.any(FormData));
    expect(updateFile).toHaveBeenCalledWith({ id_olimpo_cloud: 'olimpo-nuovo' }, { where: { id: 'file-1' } });
    expect(cercaLog).toHaveBeenCalledWith(expect.objectContaining({
      where: { id_kit_runtime: 'kit-1', nome_file: 'volantino_TO.pdf' }
    }));
    expect(aggiornaLog).toHaveBeenCalledWith(expect.anything(), { where: { id: 'log-1' } });
  });

  it('senza log precedente il nuovo log prende il nome del file sostituito', async () => {
    const { service } = makeService(caricato);
    vi.spyOn(FilesRuntimeLog, 'findOne').mockResolvedValue(null);
    const creaLog = vi.spyOn(FilesRuntimeLog, 'create').mockResolvedValue({} as any);

    await service.replaceFileKitRuntime('file-1', fileCaricato, req);

    expect(creaLog).toHaveBeenCalledWith(expect.objectContaining({ nome_file: 'volantino_TO.pdf', id_kit_runtime: 'kit-1' }));
  });

  it('il materiale caricato su Olimpo conserva il meta del file sostituito', async () => {
    const { service, upload } = makeService(caricato);
    vi.spyOn(FilesRuntimeLog, 'findOne').mockResolvedValue(null);
    vi.spyOn(FilesRuntimeLog, 'create').mockResolvedValue({} as any);

    await service.replaceFileKitRuntime('file-1', fileCaricato, req);

    const formData = upload.mock.calls[0][2] as FormData;
    expect(JSON.parse(formData.get('json_meta_materiale') as string).JsonMeta).toEqual({ reparto: 'ORTO' });
  });

  it('Olimpo rifiuta il file: errore esterno e il file del kit non cambia', async () => {
    const { service, updateFile } = makeService({ esito: false, error: 'file non valido' });
    const cercaLog = vi.spyOn(FilesRuntimeLog, 'findOne').mockResolvedValue(null);

    await expect(service.replaceFileKitRuntime('file-1', fileCaricato, req)).rejects.toBeInstanceOf(ExternalApiError);

    expect(updateFile).not.toHaveBeenCalled();
    expect(cercaLog).not.toHaveBeenCalled();
  });
});
