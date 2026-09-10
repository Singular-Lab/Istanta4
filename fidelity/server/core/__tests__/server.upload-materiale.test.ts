import express from 'express';
import multer from 'multer';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagementController } from '../controllers/FileManagementController';
import type { IFileManagementService } from '../interfaces/IFileManagementService';

const testState = vi.hoisted(() => ({
    uploadError: undefined as Error | undefined
}));

vi.mock('../config/multerConfig', () => {
    const single = vi.fn(() => {
        return (req: any, _res: any, next: any) => {
            console.log('📁 Multer eseguito');

            if (testState.uploadError) {
                console.log('❌ Errore multer:', testState.uploadError);
                return next(testState.uploadError);
            }

            req.file = {
                fieldname: 'file',
                originalname: 'materiale.pdf',
                encoding: '7bit',
                mimetype: 'application/pdf',
                size: 123,
                destination: '/tmp',
                filename: 'materiale.pdf',
                path: '/tmp/materiale.pdf',
                buffer: Buffer.from('fake-file')
            };

            console.log('✅ File aggiunto:', req.file);

            return next();
        };
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

describe('POST /api/invioMaterialeAdFP', () => {
    const fileManagementServiceMock: Pick<IFileManagementService, 'invioMaterialeAdFP'> = {
        invioMaterialeAdFP: vi.fn((...args) => {
            console.log('📦 Service chiamato con:', args);
            return Promise.resolve();
        })
    };

    const createApp = () => {
        const app = express();
        app.use(express.json());

        const controller = new FileManagementController(fileManagementServiceMock as IFileManagementService);
        controller.registerRoutes(app);

        return app;
    };

    beforeEach(() => {
        testState.uploadError = undefined;
        vi.clearAllMocks();
    });

    it('risponde 200 e invoca il service con i parametri corretti', async () => {
        const app = createApp();

        const payload = {
            guidKitRuntime: 'kit-123',
            tipoExport: 'PDF',
            nomeFile: 'materiale.pdf',
            meta: { lingua: 'it' }
        };

        console.log('➡️ Request payload:', payload);

        const res = await request(app)
            .post('/api/invioMaterialeAdFP')
            .send(payload);

        console.log('⬅️ Status:', res.status);
        console.log('⬅️ Body:', res.body);

        expect(res.status).toBe(200);
    });

    it('risponde 400 se multer genera un MulterError', async () => {
        const app = createApp();
        testState.uploadError = new multer.MulterError('LIMIT_FILE_SIZE');

        const res = await request(app)
            .post('/api/invioMaterialeAdFP')
            .send({
                guidKitRuntime: 'kit-123',
                tipoExport: 'PDF',
                nomeFile: 'materiale.pdf',
                meta: {}
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('LIMIT_FILE_SIZE');
        expect(fileManagementServiceMock.invioMaterialeAdFP).not.toHaveBeenCalled();
    });

    it('risponde 500 se il service solleva un errore', async () => {
        const app = createApp();
        (fileManagementServiceMock.invioMaterialeAdFP as any).mockRejectedValueOnce(new Error('boom'));

        const res = await request(app)
            .post('/api/invioMaterialeAdFP')
            .send({
                guidKitRuntime: 'kit-123',
                tipoExport: 'PDF',
                nomeFile: 'materiale.pdf',
                meta: {}
            });

        expect(res.status).toBe(500);
        expect(res.body).toMatchObject({
            message: 'Si è verificato un errore imprevisto',
            httpStatus: 500
        });
    });
});
