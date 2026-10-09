import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe('FileManagementService.invioMaterialeAdFP: tipo di file non supportato', () => {
  let tmpRoot: string;
  let temporaneo: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-invio-'));
    fs.mkdirSync(path.join(tmpRoot, 'server/core/public/uploads/materiali_POP'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'temporanei'));
    temporaneo = path.join(tmpRoot, 'temporanei', '3f2a9c1e.txt');
    fs.writeFileSync(temporaneo, 'testo');
    vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  const invia = () => {
    const tipoExportService = { getTipoExportById: vi.fn().mockResolvedValue({ codice: 'STAMPA' }) };
    const service = new FileManagementService(
      {} as any, tipoExportService as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    return service.invioMaterialeAdFP(
      'kit-1', 'tipo-1', 'materiale.txt', '{}',
      { path: temporaneo, originalname: 'materiale.txt', mimetype: 'text/plain' } as Express.Multer.File,
      { headers: {} } as any
    );
  };

  it('il chiamante riceve l\'errore del tipo (400) e il temporaneo viene rimosso', async () => {
    await expect(invia()).rejects.toMatchObject({ httpStatus: 400, message: expect.stringContaining("'.txt' non supportato") });
    expect(fs.existsSync(temporaneo)).toBe(false);
  });

  it('un temporaneo gia\' assente non copre l\'errore del tipo con ENOENT', async () => {
    fs.rmSync(temporaneo);

    await expect(invia()).rejects.toMatchObject({ httpStatus: 400, message: expect.stringContaining('non supportato') });
  });
});
