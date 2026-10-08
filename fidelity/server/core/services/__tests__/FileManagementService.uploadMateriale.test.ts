import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagementService } from '../FileManagementService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe('FileManagementService.uploadMateriale', () => {
  let tmpRoot: string;

  beforeEach(() => {
    // Il servizio scrive in <cwd>/server/core/public/uploads/materiali_POP.
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-upload-'));
    fs.mkdirSync(path.join(tmpRoot, 'server', 'core', 'public', 'uploads'), { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('con un nomeFile che contiene ../ scrive comunque nella cartella dei materiali', async () => {
    const sorgente = path.join(tmpRoot, 'ricevuto.tmp');
    fs.writeFileSync(sorgente, 'pdf');
    // Tipo export inesistente: il servizio si ferma subito dopo aver salvato il file.
    const tipoExportService = { getTipoExportById: vi.fn().mockResolvedValue(null) };
    const service = new FileManagementService(
      {} as any, tipoExportService as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    const file = { path: sorgente, originalname: 'materiale.pdf', mimetype: 'application/pdf' } as Express.Multer.File;

    await expect(service.uploadMateriale(
      file,
      { guidKitRuntime: 'kit-1', tipoExport: 'tipo-1', nomeFile: '../../fuori.pdf', meta: '{}' },
      {} as any
    )).rejects.toThrow();

    expect(fs.existsSync(path.join(tmpRoot, 'server', 'core', 'public', 'uploads', 'materiali_POP', 'fuori.pdf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, 'server', 'core', 'public', 'fuori.pdf'))).toBe(false);
  });
});
