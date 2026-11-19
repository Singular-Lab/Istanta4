import type { Request } from 'express';
import { Op } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { idPezzo, MESSAGGIO_AVVIO_PROXY, type ProxyNoti } from '../../../../lib/areeCanali/proxy';
import { BusinessError } from '../../../../lib/errors';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { DesignKit } from '../../models/design_kit';
import { Formati } from '../../models/formati';
import { Promo } from '../../models/promo';
import { RaccoglitoreKit } from '../../models/raccoglitore_kit';
import { RuntimeKit } from '../../models/runtime_kit';
import { TipiDiExport } from '../../models/tipi_di_export';
import { KitRuntimeService } from '../KitRuntimeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Proxy noti, letti dal database: qui finti
const proxyDb = vi.hoisted(() => ({
  caricaProxy: vi.fn(async (): Promise<ProxyNoti> => ({ canali: new Map(), aree: new Map() })),
  trovaPezzo: vi.fn(async (_id: string): Promise<{ idDesign: string; idCanale: string; idArea: string } | null> => null),
}));
vi.mock('../areeCanaliProxy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../areeCanaliProxy')>()),
  ...proxyDb,
}));

// Un design su un canale proxy (RIL su SSCNCY = Superstore, Conad, City) ha un runtime per pezzo:
// uno per canale e area del membro, tutti legati allo stesso design

const PROXY = { canali: new Map([['sscncy', ['ss', 'cn', 'cy']]]), aree: new Map() };
const service = (istantaService: Record<string, unknown> = {}) => new KitRuntimeService(istantaService as never, {} as never);

beforeEach(() => {
  proxyDb.caricaProxy.mockResolvedValue(PROXY);
  proxyDb.trovaPezzo.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('runtime dei pezzi di un design proxy', () => {
  it('bulkCreateRuntime cerca il runtime di un pezzo anche per canale e area, quello di un design normale no', async () => {
    const findAll = vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([{ id: 'rt', stato_lavorazione: 'IN_LAVORAZIONE' }] as never);

    await service().bulkCreateRuntime([
      { guidId: 'd-ril', guidCanale: 'cn', guidArea: 'la', idPromo: 'p1', pezzo: true },
      { guidId: 'd-vol', guidCanale: 'ss', guidArea: 'la', idPromo: 'p1' },
    ] as never);

    const filtri = findAll.mock.calls.map(([opzioni]) => (opzioni as { where: unknown }).where);
    expect(filtri).toContainEqual({ id_design: 'd-ril', id_promo: 'p1', id_canale: 'cn', id_area: 'la' });
    expect(filtri).toContainEqual({ id_design: 'd-vol', id_promo: 'p1' });
  });

  it('createKitRunTime per combinazione restituisce il runtime di quel pezzo, se esiste', async () => {
    const findOne = vi.spyOn(RuntimeKit, 'findOne').mockResolvedValue({ id: 'rt-cn', id_design: 'd-ril', id_canale: 'cn' } as never);

    const runtime = await service().createKitRunTime(
      { guidIdDesign: 'd-ril', idPromo: 'p1', guidCanale: 'cn', guidArea: 'la' } as never,
      { perCombinazione: true }
    );

    expect((findOne.mock.calls[0][0] as { where: unknown }).where).toEqual({ id_design: 'd-ril', id_promo: 'p1', id_canale: 'cn', id_area: 'la' });
    expect(runtime).toMatchObject({ guidId: 'rt-cn', guidCanale: 'cn' });
  });

  it('un design proxy non si avvia a mano da FP: errore con il motivo, nessun runtime', async () => {
    const create = vi.spyOn(RuntimeKit, 'create');
    vi.spyOn(RaccoglitoreKit, 'findOne').mockResolvedValue(null);

    const errore = await service().creaKitRuntimeManuale('p1', { guidId: 'd-ril', guidCanale: 'sscncy', guidArea: 'la' } as never).catch(e => e);

    expect(errore).toBeInstanceOf(BusinessError);
    expect(errore.message).toBe(MESSAGGIO_AVVIO_PROXY);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('gestione lavorazione con un design proxy', () => {
  it('il design proxy compare diviso nei pezzi delle combinazioni della promo, ognuno con il suo runtime', async () => {
    const istanta = {
      getCombinazioniDaIstanta: vi.fn(async () => ({
        lista: [{ guidIdCanale: 'ss', guidIdArea: 'la' }, { guidIdCanale: 'cn', guidIdArea: 'la' }],
      })),
    };
    const designFindAll = vi.spyOn(DesignKit, 'findAll').mockResolvedValue([
      { id: 'd-ril', titolo: 'RIL', id_canale: 'sscncy', id_area: 'la', id_formato: 'f1', tipi_di_export_in_kit: [] },
    ] as never);
    vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([
      { id: 'rt-ss', id_design: 'd-ril', id_canale: 'ss', id_area: 'la', id_formato: 'f1', id_promo: 'p1', titolo: 'RIL', tipi_di_export_in_kit: [] },
    ] as never);
    vi.spyOn(TipiDiExport, 'findAll').mockResolvedValue([]);
    vi.spyOn(Canale, 'findAll').mockResolvedValue([
      { id_canali: 'ss', nome_canali: 'Superstore' }, { id_canali: 'cn', nome_canali: 'Conad' },
    ] as never);
    vi.spyOn(Area, 'findAll').mockResolvedValue([{ id_aree: 'la', nome_aree: 'Lazio' }] as never);
    vi.spyOn(Formati, 'findAll').mockResolvedValue([]);
    vi.spyOn(Promo, 'findAll').mockResolvedValue([]);
    const { FilesRuntime } = await import('../../models/files_runtime');
    const { Referenze } = await import('../../models/referenze');
    vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([]);
    vi.spyOn(Referenze, 'findAll').mockResolvedValue([]);

    const { lavorazioni } = await service(istanta).getAllKitPerGestioneLavorazione('p1', {} as Request);

    // Il proxy entra nella ricerca dei design perche' ha un membro fra le combinazioni della promo
    expect((designFindAll.mock.calls[0][0] as { where: { id_canale: Record<symbol, unknown> } }).where.id_canale[Op.in]).toEqual(['ss', 'cn', 'sscncy']);
    const perCanale = Object.fromEntries(lavorazioni.map((k: Record<string, unknown>) => [k.nomeCanale, k]));
    // CY non e' fra le combinazioni della promo in Istanta: nessun pezzo
    expect(Object.keys(perCanale).sort()).toEqual(['Conad', 'Superstore']);
    expect(perCanale.Superstore).toMatchObject({ guidId: 'rt-ss', lavorazioneStarted: true, nomeArea: 'Lazio' });
    expect(perCanale.Conad).toMatchObject({ guidId: idPezzo('d-ril', 'cn', 'la'), guidIdDesign: 'd-ril', lavorazioneStarted: false });
  });
});
