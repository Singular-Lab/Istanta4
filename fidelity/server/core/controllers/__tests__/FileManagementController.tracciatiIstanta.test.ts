import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as MulterConfig from '../../config/multerConfig';

// TASK-3dfe3302: il tracciato che Istanta non accetta si salva in FP e va in coda; le liste
// dell'archivio storico arrivano in blocco, solo dove c'e' l'import da storico.

vi.mock('../../config/multerConfig', async (importOriginal) => {
  const originale = await importOriginal<typeof MulterConfig>();
  const { default: multer } = await import('multer');
  // Lotto piccolo, per provare il limite senza 51 file
  return {
    ...originale,
    LISTE_PER_LOTTO_ARCHIVIO: 3,
    uploadTracciatiArchivio: multer({ storage: multer.memoryStorage(), limits: { files: 3 } }),
  };
});
vi.mock('../../middleware/authMiddleware', () => {
  const passa = (req: express.Request, _res: unknown, next: () => void) => {
    req.session = { id_utente: 'u-operatore' } as express.Request['session'];
    next();
  };
  return { authMiddleware: passa, integrationAuthMiddleware: passa };
});
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const stato = vi.hoisted(() => ({
  agenzia: { supportaImportStorico: true } as { supportaImportStorico?: boolean },
  promo: { id: 'promo-1', nome: 'P2101_VOL_07-01-21' } as { id: string; nome: string } | null,
}));
vi.mock('../../di', () => ({
  TYPES: { AgenziaLib: 'AgenziaLib' },
  container: { get: () => stato.agenzia },
}));
vi.mock('../../di/container', () => ({
  getService: () => ({ getPromoById: async () => stato.promo }),
}));
vi.mock('../../services/AllineamentoIstanta', () => ({
  accodaPerIstanta: vi.fn(async () => undefined),
  salvaListeArchivio: vi.fn(async () => []),
}));

import { sequelize } from '../../db/SequelizeConnector';
import type { IFileManagementService } from '../../interfaces/IFileManagementService';
import { Tracciati } from '../../models';
import { accodaPerIstanta, salvaListeArchivio } from '../../services/AllineamentoIstanta';
import { AuditLogService } from '../../services/AuditLogService';
import { ServerUtils } from '../../utils/ServerUtils';
import { FileManagementController } from '../FileManagementController';

const XLSX = Buffer.from('PK finto xlsx');

function creaApp() {
  const app = express();
  new FileManagementController({} as IFileManagementService).registerRoutes(app);
  return app;
}

let istanta: ReturnType<typeof vi.spyOn>;
let creaTracciato: ReturnType<typeof vi.spyOn>;
let attivita: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stato.agenzia = { supportaImportStorico: true };
  stato.promo = { id: 'promo-1', nome: 'P2101_VOL_07-01-21' };
  istanta = vi.spyOn(ServerUtils, 'sendToFicoApiAxiosUploadTracciato').mockResolvedValue({ data: { esito: true }, status: 200, statusText: 'OK' } as never);
  attivita = vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as never);
  vi.spyOn(Tracciati, 'findOne').mockResolvedValue(null);
  creaTracciato = vi.spyOn(Tracciati, 'create').mockImplementation(async (valori: { id_tracciati?: string; filename_tracciati?: string }) => ({
    ...valori,
    toJSON: () => ({ id_tracciati: valori.id_tracciati, filename_tracciati: valori.filename_tracciati }),
  }) as never);
  vi.spyOn(sequelize, 'transaction').mockImplementation((async (fn: (t: unknown) => unknown) => fn({ tx: true })) as never);
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ entityChanged: vi.fn() } as unknown as AuditLogService);
  vi.mocked(accodaPerIstanta).mockClear();
  vi.mocked(salvaListeArchivio).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const carica = (nomeFile = 'lista.xlsx') => request(creaApp())
  .post('/api/uploadTracciato/promo-1')
  .field('context', JSON.stringify([{ nome_field: 'idLabel', user_value: 'main' }]))
  .attach('file', XLSX, nomeFile);

describe('POST /api/uploadTracciato: Istanta non accetta', () => {
  it('Istanta accetta: 201 e niente coda, come prima', async () => {
    const res = await carica();

    expect(res.status).toBe(201);
    expect(creaTracciato).toHaveBeenCalledTimes(1);
    expect(accodaPerIstanta).not.toHaveBeenCalled();
    expect(attivita).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['rifiuta (esito false)', { data: { esito: false, error: 'label non valida' }, status: 200, statusText: 'OK' }],
    ['non risponde', { data: null, status: 0, statusText: 'timeout' }],
  ])('Istanta %s: il tracciato si salva in FP e va in coda col motivo, 202', async (_caso, risposta) => {
    istanta.mockResolvedValue(risposta as never);

    const res = await carica();

    expect(res.status).toBe(202);
    expect(res.body.istanta).toMatchObject({ stato: 'errore', tentativi: 1 });
    expect(res.body.istanta.errore).toBeTruthy();
    expect(creaTracciato).toHaveBeenCalledTimes(1);
    const [voci, transazione] = vi.mocked(accodaPerIstanta).mock.calls[0];
    expect(voci).toEqual([{ idTracciato: res.body.id_tracciati, idUtente: 'u-operatore', motivo: res.body.istanta.errore }]);
    // Tracciato e coda nella stessa transazione
    expect(transazione).toEqual({ tx: true });
    // L'attivita' di import la registra l'allineamento quando Istanta lo accetta
    expect(attivita).not.toHaveBeenCalled();
  });

  it('un file che non e Excel non si salva e non va a Istanta', async () => {
    const res = await carica('lista.csv');

    expect(res.status).toBe(400);
    expect(istanta).not.toHaveBeenCalled();
    expect(creaTracciato).not.toHaveBeenCalled();
    expect(accodaPerIstanta).not.toHaveBeenCalled();
  });
});

const lotto = (voci: unknown, file = 2) => {
  let richiesta = request(creaApp()).post('/api/tracciati/archivio').field('liste', typeof voci === 'string' ? voci : JSON.stringify(voci));
  for (let i = 0; i < file; i++) richiesta = richiesta.attach('files', XLSX, `0${i}_SSCN.xlsx`);
  return richiesta;
};
const VOCI = [
  { nomeFile: '00_SSCN.xlsx', idPromo: 'promo-1', context: [] },
  { nomeFile: '01_CY_è.xlsx', idPromo: 'promo-2', context: [] },
];

describe('POST /api/tracciati/archivio', () => {
  it('salva le liste del lotto col nome della voce e risponde con l esito di ognuna', async () => {
    vi.mocked(salvaListeArchivio).mockResolvedValue([
      { nomeFile: '00_SSCN.xlsx', idPromo: 'promo-1', esito: 'caricata', id: 't1' },
      { nomeFile: '01_CY_è.xlsx', idPromo: 'promo-2', esito: 'presente' },
    ]);

    const res = await lotto(VOCI);

    expect(res.status).toBe(200);
    expect(res.body.liste.map((l: { esito: string }) => l.esito)).toEqual(['caricata', 'presente']);
    const [liste, idUtente] = vi.mocked(salvaListeArchivio).mock.calls[0];
    expect(idUtente).toBe('u-operatore');
    // Il nome viene dalla voce, in UTF-8, non dal nome del file letto da multer
    expect(liste.map((l) => [l.nomeFile, l.idPromo, l.contenuto.equals(XLSX)])).toEqual([
      ['00_SSCN.xlsx', 'promo-1', true],
      ['01_CY_è.xlsx', 'promo-2', true],
    ]);
  });

  it('senza import da storico rifiuta il lotto senza leggerlo', async () => {
    stato.agenzia = {};

    const res = await lotto(VOCI);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/storico non e disponibile/);
    expect(salvaListeArchivio).not.toHaveBeenCalled();
  });

  it('piu liste del limite: 413 e nulla salvato', async () => {
    const res = await lotto([...VOCI, ...VOCI], 4);

    expect(res.status).toBe(413);
    expect(salvaListeArchivio).not.toHaveBeenCalled();
  });

  it.each([
    ['liste non JSON', '{ rotto'],
    ['una voce in meno dei file', [VOCI[0]]],
  ])('%s: 400 e nulla salvato', async (_caso, voci) => {
    const res = await lotto(voci);

    expect(res.status).toBe(400);
    expect(salvaListeArchivio).not.toHaveBeenCalled();
  });
});
