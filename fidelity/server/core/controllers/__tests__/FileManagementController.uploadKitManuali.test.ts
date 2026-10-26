import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

// I temporanei di multer vanno in una cartella di prova, non nel repository
const cartelle = vi.hoisted(() => ({ tmpRoot: '', tmpDir: '' }));

vi.mock('../../config/percorsi', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  cartelle.tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-kit-manuali-'));
  cartelle.tmpDir = path.join(cartelle.tmpRoot, 'uploads', 'tmp');
  return { PROJECT_ROOT: cartelle.tmpRoot, UPLOAD_DIR: path.join(cartelle.tmpRoot, 'uploads'), UPLOAD_TMP_DIR: cartelle.tmpDir };
});

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  integrationAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { FileManagementController } from '../FileManagementController';

afterAll(() => {
  fs.rmSync(cartelle.tmpRoot, { recursive: true, force: true });
});

function createApp() {
  const service = { uploadKitManuali: vi.fn().mockResolvedValue({ ok: true }) };
  const app = express();
  new FileManagementController(service as any).registerRoutes(app);
  return { app, service };
}

const temporanei = () => (fs.existsSync(cartelle.tmpDir) ? fs.readdirSync(cartelle.tmpDir) : []);

describe('POST /api/uploadKitManuali/:idPromo/:idKit', () => {
  it('con metadati non validi risponde 400 e rimuove i file gia caricati', async () => {
    const { app, service } = createApp();

    const res = await request(app)
      .post('/api/uploadKitManuali/promo-1/kit-1')
      .field('metadata', '{non json')
      .attach('file', Buffer.from('primo'), 'uno.pdf')
      .attach('file', Buffer.from('secondo'), 'due.pdf');

    expect(res.status).toBe(400);
    expect(service.uploadKitManuali).not.toHaveBeenCalled();
    expect(temporanei()).toEqual([]);
  });

  it('con metadati validi passa i file al service dalla cartella dei temporanei', async () => {
    const { app, service } = createApp();

    const res = await request(app)
      .post('/api/uploadKitManuali/promo-1/kit-1')
      .field('metadata', JSON.stringify([{ nome: 'uno.pdf' }]))
      .attach('file', Buffer.from('primo'), 'uno.pdf');

    expect(res.status).toBe(201);
    const [, , files, metadata] = service.uploadKitManuali.mock.calls[0];
    expect(metadata).toEqual([{ nome: 'uno.pdf' }]);
    expect(path.dirname(files[0].path)).toBe(cartelle.tmpDir);
  });
});
