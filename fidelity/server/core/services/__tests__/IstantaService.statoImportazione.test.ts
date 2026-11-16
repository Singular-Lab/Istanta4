import type { Request } from 'express';
import { Op } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../models', () => ({ Tracciati: { update: vi.fn(async () => [1]) } }));
vi.mock('../../models/files_runtime', () => ({ FilesRuntime: {} }));
vi.mock('../../models/runtime_kit', () => ({ RuntimeKit: {} }));

import { OperationStatus } from '../../../../lib/enums';
import config from '../../config';
import { Tracciati } from '../../models';
import { ServerUtils } from '../../utils/ServerUtils';
import { IstantaService } from '../IstantaService';

const req = { session: { id_utente: 'u1' } } as unknown as Request;
const risponde = (data: unknown) =>
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ data, status: 200, statusText: 'OK' } as never);

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(Tracciati.update).mockClear();
});

// TASK-f4e1fc7c, spec "Autore e date del tracciato": l'esito finale e' un aggiornamento del tracciato,
// registrato solo quando cambia, mai a ogni lettura
describe('IstantaService.getStatusImportazione: esito registrato in FP', () => {
  it.each([
    [OperationStatus.Terminata, 'Terminata'],
    [OperationStatus.Scartata, 'Scartato'],
  ])("registra l'esito %s con la data di aggiornamento, solo se lo stato salvato e' diverso", async (stato, registrato) => {
    risponde({ esito: true, stato, error: '' });

    await new IstantaService().getStatusImportazione('t1', req);

    expect(Tracciati.update).toHaveBeenCalledTimes(1);
    const [valori, opzioni] = vi.mocked(Tracciati.update).mock.calls[0] as unknown as [
      { stato_tracciati: string; updatedat: Date },
      { where: Record<string | symbol, unknown> },
    ];
    expect(valori.stato_tracciati).toBe(registrato);
    expect(valori.updatedat).toBeInstanceOf(Date);
    expect(opzioni.where.id_tracciati).toBe('t1');
    // La condizione esclude il tracciato che ha gia' quello stato: le letture successive non lo aggiornano
    const alternative = opzioni.where[Op.or] as unknown[];
    expect(alternative).toHaveLength(2);
    expect(alternative[0]).toMatchObject({ attribute: { col: 'stato_tracciati' }, comparator: Op.is, logic: null });
    expect(alternative[1]).toEqual({ stato_tracciati: { [Op.ne]: registrato } });
  });

  it("uno stato non finale non tocca il tracciato e arriva col suo nome", async () => {
    risponde({ esito: true, stato: OperationStatus.InAttesaDiConfermaUtente, error: '' });

    const stato = await new IstantaService().getStatusImportazione('t1', req);

    expect(Tracciati.update).not.toHaveBeenCalled();
    expect(stato.stato).toBe('InAttesaDiConfermaUtente');
  });
});

describe('IstantaService.scartaImportazione', () => {
  it("chiede a Istanta lo scarto e restituisce l'esito con lo stato per nome", async () => {
    const chiamata = risponde({ esito: true, scartata: false, stato: OperationStatus.InCoda, error: null });

    expect(await new IstantaService().scartaImportazione('t1', req)).toEqual({ scartata: false, stato: 'InCoda' });
    expect(chiamata).toHaveBeenCalledWith(req, `${config.ISTANTA_IP_ADDRESS}/FicoProcess/scartaImportazione/t1`, 'POST', {}, undefined, undefined, { categoria: 'scrittura', idempotente: true });
  });

  it('se Istanta risponde con esito false lancia, e il tracciato non si elimina', async () => {
    risponde({ esito: false, scartata: false, stato: null, error: 'Importazione non trovata Guid: t1' });

    await expect(new IstantaService().scartaImportazione('t1', req)).rejects.toThrow();
  });
});
