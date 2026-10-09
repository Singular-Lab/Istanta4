import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// vi.mock viene spostato in cima al file: la costante deve esserlo anche lei
const passa = vi.hoisted(() => (_req: any, _res: any, next: any) => next());

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: passa,
  integrationAuthMiddleware: passa,
}));

// Nessun permesso: la risposta dice quale permesso la route ha chiesto
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: any, res: any) => res.status(403).json({ codice }),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { DisplayContextController } from '../DisplayContextController';
import { IstantaController } from '../IstantaController';
import { KitRuntimeController } from '../KitRuntimeController';
import { PromoController } from '../PromoController';
import { TracciatoController } from '../TracciatoController';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { id_utente: 'u1', tipo_utente: 'GUEST' };
    next();
  });
  new TracciatoController({} as any).registerRoutes(app);
  new PromoController({} as any, {} as any, {} as any).registerRoutes(app);
  new KitRuntimeController({} as any, {} as any).registerRoutes(app);
  new DisplayContextController({} as any).registerRoutes(app);
  new IstantaController({} as any).registerRoutes(app);
  return app;
}

describe('permessi sulle route che modificano dati', () => {
  const casi: Array<[string, 'post' | 'put' | 'delete', string, string]> = [
    ['cancellazione di un tracciato', 'delete', '/api/tracciati/t1', 'file.upload_tracciato'],
    ['salvataggio del layout del menabo', 'put', '/api/promo/p1/menabo-layout', 'promo.modifica'],
    ['export xlsx del menabo', 'post', '/api/promo/p1/export/xlsx', 'promo.visualizza'],
    ['avvio di una lavorazione (getKitByPromo)', 'put', '/api/getKitByPromo', 'kit_runtime.crea'],
    ['cancellazione dei file di un kit runtime', 'delete', '/api/clearAllFilesKitRuntime/k1/e1', 'kit_runtime.elimina_file'],
    ['creazione di un contesto display', 'post', '/api/display-contexts', 'gdo.gestisci_punti_vendita'],
    ['download dei kit per tipo di export', 'post', '/api/downloadKitsByTipoDiExport', 'file.download'],
  ];

  it.each(casi)('%s richiede il permesso giusto', async (_nome, metodo, url, permesso) => {
    const res = await request(createApp())[metodo](url).send({});

    expect(res.status).toBe(403);
    expect(res.body.codice).toBe(permesso);
  });

  it('i momenti di una promo restano aperti a ogni utente autenticato', async () => {
    const res = await request(createApp()).post('/api/tracciati/momenti').send({ id_promo: 'p1', nome: 'M1' });

    expect(res.status).not.toBe(403);
  });
});
