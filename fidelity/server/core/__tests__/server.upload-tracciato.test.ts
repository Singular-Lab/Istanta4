import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagementController } from '../controllers/FileManagementController';
import type { IFileManagementService } from '../interfaces/IFileManagementService';
import { Tracciati } from '../models';
import { ServerUtils } from '../utils/ServerUtils';

vi.mock('../config/multerConfig', () => {
    const single = vi.fn(() => (req: any, _res: any, next: any) => {
        req.file = {
            fieldname: 'file',
            originalname: 'ufi.xlsx',
            encoding: '7bit',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 9,
            buffer: Buffer.from('fake-xlsx')
        };
        return next();
    });
    const array = vi.fn(() => (_req: any, _res: any, next: any) => next());
    const uploader = { single, array };

    return {
        uploadMaterialiPubblicazioni: uploader,
        uploadOlimpoImages: uploader,
        uploadTracciati: uploader,
        uploadZipMemory: uploader
    };
});

vi.mock('../middleware/authMiddleware', () => ({
    authMiddleware: (_req: any, _res: any, next: any) => next()
}));

vi.mock('../middleware/permissionGuard', () => ({
    permissionGuard: () => (_req: any, _res: any, next: any) => next()
}));

vi.mock('../logger', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../di/container', () => ({
    getService: () => ({
        getPromoById: async (id: string) => ({ id, nome: `Promo ${id}` })
    })
}));

/**
 * I20-957: il file del marketing si carica col suo nome originale. Lo stesso nome
 * puo ripetersi fra promo diverse (es. promo 2025 e 2026), non nella stessa promo.
 */
describe('POST /api/uploadTracciato/:idPromo - unicita del nome file nella promo', () => {
    // Tracciato gia presente a DB: ufi.xlsx nella promo 2025
    const esistente = { id_tracciati: 't-2025', filename_tracciati: 'ufi.xlsx', id_promo_tracciati: 'promo-2025' };

    const createApp = () => {
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            (req as any).session = {};
            next();
        });
        new FileManagementController({} as IFileManagementService).registerRoutes(app);
        return app;
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        // findOne si comporta come il DB: trova il record solo se tutti i campi del where coincidono
        vi.spyOn(Tracciati, 'findOne').mockImplementation(async (opzioni: any) =>
            (Object.entries(opzioni.where).every(([campo, valore]) => (esistente as any)[campo] === valore) ? esistente : null) as never
        );
        vi.spyOn(Tracciati, 'create').mockImplementation(async (valori: any) => valori as never);
        vi.spyOn(ServerUtils, 'sendToFicoApiAxiosUploadTracciato').mockResolvedValue({ status: 200, data: { esito: true } } as never);
    });

    it("accetta un file con lo stesso nome gia presente in un'altra promo, mantenendo il nome", async () => {
        const res = await request(createApp())
            .post('/api/uploadTracciato/promo-2026')
            .send({ context: '[]' });

        expect(res.status).toBe(201);
        expect(res.body.filename_tracciati).toBe('ufi.xlsx');
        expect(res.body.id_promo_tracciati).toBe('promo-2026');
        expect(ServerUtils.sendToFicoApiAxiosUploadTracciato).toHaveBeenCalledOnce();
    });

    it('rifiuta con 409 lo stesso nome file nella stessa promo senza inviare nulla a Istanta', async () => {
        const res = await request(createApp())
            .post('/api/uploadTracciato/promo-2025')
            .send({ context: '[]' });

        expect(res.status).toBe(409);
        expect(ServerUtils.sendToFicoApiAxiosUploadTracciato).not.toHaveBeenCalled();
        expect(Tracciati.create).not.toHaveBeenCalled();
    });
});
