import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const socket = vi.hoisted(() => ({ emitToClients: vi.fn() }));
vi.mock('../../../ws-server', () => ({ emitToClients: socket.emitToClients }));

import { RegistroLavoriInMemoria } from '../../../__tests__/registroLavoriInMemoria';
import { ContrattoTipografia } from '../../models/contratto_tipografia';
import { FilesRuntime } from '../../models/files_runtime';
import { OrdiniDiStampa } from '../../models/ordini_di_stampa';
import { OrdiniDiStampaInvii } from '../../models/ordini_di_stampa_invii';
import { OrdiniStampaService } from '../../services/OrdiniStampaService';
import { ServerUtils } from '../../utils/ServerUtils';
import { OrdiniDiStampaController } from '../OrdiniDiStampaController';

// Il server gira con piu worker senza sticky session: avvio e stato del raggruppamento arrivano a
// processi diversi, che condividono solo il DB (qui il registro dei lavori in memoria)

const kit = { id: 'k1', guidId: 'k1', titolo: 'Kit k1', stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, tipi_di_export_in_kit: [{ tipo_di_export_guid_id: 't1' }] };

function dueWorker() {
  const registro = new RegistroLavoriInMemoria();
  let rispondiOlimpo: (risposta: unknown) => void = () => undefined;
  vi.spyOn(OrdiniDiStampa, 'findByPk').mockResolvedValue({ dataValues: { id_ordinistampa: 'o1', id_promo_ordinistampa: 'p1' } } as any);
  vi.spyOn(ContrattoTipografia, 'findAll').mockResolvedValue([{ id_contrattotipografia: 'c1', tipiexport_contrattotipografia: ['t1'], json_contrattotipografia: {} }] as any);
  vi.spyOn(OrdiniDiStampaInvii, 'findAll').mockResolvedValue([] as any);
  vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([
    { id_olimpo_cloud: 'f1', nome: 'a.pdf', id_runtime: 'k1' },
    { id_olimpo_cloud: 'f2', nome: 'b.pdf', id_runtime: 'k1' },
  ] as any);
  const olimpo = vi.spyOn(ServerUtils, 'sendToFICOApi').mockImplementation((() => new Promise(resolve => { rispondiOlimpo = resolve; })) as any);
  const kitRuntimeService = { getAllKitRuntimeByIdPromo: vi.fn().mockResolvedValue([kit]) };

  const worker = () => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { req.session = { id_utente: 'u1', private_key: 'chiave-di-prova' }; next(); });
    const service = new OrdiniStampaService({} as any, kitRuntimeService as any, registro);
    new OrdiniDiStampaController(service, {} as any, kitRuntimeService as any).registerRoutes(app);
    return app;
  };
  return { workerA: worker(), workerB: worker(), olimpo, rispondi: (risposta: unknown) => rispondiOlimpo(risposta) };
}

const avviaRaggruppamento = (app: express.Express) =>
  request(app).post('/api/ordini-stampa/group-files-by-equality').send({ idOrdineDiStampa: 'o1' });
const statoRaggruppamento = (app: express.Express) =>
  request(app).get('/api/ordini-stampa/group-files-status').query({ idOrdineDiStampa: 'o1' });

describe('raggruppamento dei file uguali con piu worker', () => {
  it('avviato su un worker, lo stato chiesto a un altro worker e in corso con lo stesso socketId', async () => {
    const { workerA, workerB } = dueWorker();

    const avvio = await avviaRaggruppamento(workerA);
    const stato = await statoRaggruppamento(workerB);

    expect(avvio.status).toBe(200);
    expect(avvio.body).toMatchObject({ esito: true, socketId: expect.stringMatching(/^grouping_o1_/) });
    expect(stato.status).toBe(200);
    expect(stato.body).toMatchObject({ status: 'running', socketId: avvio.body.socketId });
  });

  it('un secondo avvio su un altro worker si aggancia a quello in corso invece di avviarne un altro', async () => {
    const { workerA, workerB, olimpo } = dueWorker();
    const primo = await avviaRaggruppamento(workerA);
    await vi.waitFor(() => expect(olimpo).toHaveBeenCalled());

    const secondo = await avviaRaggruppamento(workerB);

    expect(secondo.status).toBe(200);
    expect(secondo.body).toMatchObject({ esito: true, socketId: primo.body.socketId, message: 'Un processo di raggruppamento è già in corso' });
    expect(olimpo).toHaveBeenCalledTimes(1);
  });

  it('finito il raggruppamento, lo stato su un altro worker e completato con il risultato', async () => {
    const { workerA, workerB, olimpo, rispondi } = dueWorker();
    const avvio = await avviaRaggruppamento(workerA);
    await vi.waitFor(() => expect(olimpo).toHaveBeenCalled());

    rispondi({ data: { esito: true, groups: [{ groupId: 'gr1', ids: ['f1', 'f2'] }], unmatchedIds: [] }, status: 200 });

    await vi.waitFor(async () => expect((await statoRaggruppamento(workerB)).body).toMatchObject({
      status: 'completed', socketId: avvio.body.socketId, result: { groupCount: 1, groups: [{ groupId: 'gr1', size: 2 }] },
    }));
  });

  it('senza raggruppamenti per l\'ordine lo stato e idle', async () => {
    const { workerB } = dueWorker();

    const stato = await statoRaggruppamento(workerB);

    expect(stato.status).toBe(200);
    expect(stato.body).toEqual({ status: 'idle' });
  });

  it('senza idOrdineDiStampa risponde 400 e non avvia niente', async () => {
    const { workerA, olimpo } = dueWorker();

    const res = await request(workerA).post('/api/ordini-stampa/group-files-by-equality').send({});

    expect(res.status).toBe(400);
    expect(olimpo).not.toHaveBeenCalled();
  });
});
