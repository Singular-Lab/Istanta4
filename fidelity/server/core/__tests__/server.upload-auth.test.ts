import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagementController } from '../controllers/FileManagementController';
import type { IFileManagementService } from '../interfaces/IFileManagementService';

const multerState = vi.hoisted(() => ({ calls: 0 }));

// Ogni esecuzione di multer conta come un file ricevuto e scritto.
vi.mock('../config/multerConfig', () => {
  const receive = () => (_req: any, _res: any, next: any) => {
    multerState.calls++;
    next();
  };
  const uploader = { single: receive, array: receive };

  return {
    uploadMaterialiPubblicazioni: uploader,
    uploadOlimpoImages: uploader,
    uploadTracciati: uploader,
    uploadZipMemory: uploader
  };
});

vi.mock('../middleware/authMiddleware', () => {
  const rifiuta = (_req: any, res: any) => res.status(401).json({ message: 'Non autenticato' });
  // invioMaterialeAdFP usa la variante di integrazione: deve rifiutare allo stesso modo
  return { authMiddleware: rifiuta, integrationAuthMiddleware: rifiuta };
});

vi.mock('../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next()
}));

vi.mock('../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const UPLOAD_ROUTES = [
  '/api/invioMaterialeAdFP',
  '/api/uploadTracciato/promo-1',
  '/api/uploadMateriale',
  '/api/uploadKitManuali/promo-1/kit-1',
  '/api/replaceFileKitRuntime/file-1',
  '/api/uploadForzatoImmaginiOlimpo',
  '/api/updateImmagineReferenza',
  '/api/updateImmagineGruppoReferenza',
  '/api/process-rejected-zip'
];

describe('upload senza autenticazione', () => {
  const app = express();
  new FileManagementController({} as IFileManagementService).registerRoutes(app);

  beforeEach(() => {
    multerState.calls = 0;
  });

  it.each(UPLOAD_ROUTES)('POST %s risponde 401 senza ricevere il file', async (route) => {
    const res = await request(app)
      .post(route)
      .attach('file', Buffer.from('contenuto'), 'materiale.pdf');

    expect(res.status).toBe(401);
    expect(multerState.calls).toBe(0);
  });
});
