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

import { AnalisiPuntoVenditaController } from '../AnalisiPuntoVenditaController';
import { DisplayContextController } from '../DisplayContextController';
import { IstantaController } from '../IstantaController';
import { KitRuntimeController } from '../KitRuntimeController';
import { PromoController } from '../PromoController';
import { PuntoVenditaController } from '../PuntoVenditaController';
import { StoriaPuntoVenditaController } from '../StoriaPuntoVenditaController';
import type { IAnalisiPuntoVenditaService } from '../../interfaces/IAnalisiPuntoVenditaService';
import type { IStoriaPuntoVenditaService } from '../../interfaces/IStoriaPuntoVenditaService';
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
  new PuntoVenditaController({} as any, {} as any, {} as any).registerRoutes(app);
  new StoriaPuntoVenditaController({} as IStoriaPuntoVenditaService).registerRoutes(app);
  new AnalisiPuntoVenditaController({} as IAnalisiPuntoVenditaService, {} as IStoriaPuntoVenditaService).registerRoutes(app);
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
    ['import dei punti vendita da Excel', 'post', '/api/ACPV/importaPV', 'gdo.gestisci_punti_vendita'],
    ['annullamento dell\'import dei punti vendita', 'post', '/api/ACPV/importaPV/j1/annulla', 'gdo.gestisci_punti_vendita'],
    ['decisione sulla riga dell\'import in attesa', 'post', '/api/ACPV/importaPV/j1/decisione', 'gdo.gestisci_punti_vendita'],
    ['import degli export del Plugin nella storia dei PV', 'post', '/api/punti-vendita/storia/import-export', 'gdo.gestisci_punti_vendita'],
    ['collegamento a mano di una riga dei volantini a un PV', 'post', '/api/punti-vendita/gestione/righe-non-abbinate/collega', 'gdo.gestisci_punti_vendita'],
    ['annullamento di un collegamento fatto a mano', 'delete', '/api/punti-vendita/gestione/collegamenti-manuali/c1', 'gdo.gestisci_punti_vendita'],
    ['verifica dell\'archivio storico del volantino-analyzer', 'post', '/api/promo/verifica-archivio', 'promo.visualizza'],
    ['creazione in blocco delle promo dell\'archivio', 'post', '/api/promo/archivio', 'promo.crea'],
    ['contesti in blocco delle promo dell\'archivio', 'post', '/api/promo/contesto-importazione/archivio', 'promo.crea'],
    ['rinvio di un tracciato a Istanta', 'post', '/api/tracciati/t1/rimanda-istanta', 'file.upload_tracciato'],
    ['modifica del contesto di un tracciato in attesa', 'put', '/api/tracciati/t1/contesto', 'file.upload_tracciato'],
  ];

  it.each(casi)('%s richiede il permesso giusto', async (_nome, metodo, url, permesso) => {
    const res = await request(createApp())[metodo](url).send({});

    expect(res.status).toBe(403);
    expect(res.body.codice).toBe(permesso);
  });

  // Prima aperti a ogni utente autenticato: ora ogni funzione ha il suo permesso (spec ruoli-permessi)
  it('i momenti di una promo chiedono promo.gestisci_momenti', async () => {
    const res = await request(createApp()).post('/api/tracciati/momenti').send({ id_promo: 'p1', nome: 'M1' });

    expect(res.status).toBe(403);
    expect(res.body.codice).toBe('promo.gestisci_momenti');
  });
});
