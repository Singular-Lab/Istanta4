import 'dayjs/locale/it';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../lib/errors';
import type { ReferenzeIstanta } from '../../../../lib/types';
import type { IAreaService } from '../../interfaces/IAreaService';
import type { ICanaleService } from '../../interfaces/ICanaleService';
import type { IGdoService } from '../../interfaces/IGdoService';
import type { ITipoExportService } from '../../interfaces/ITipoExportService';
import { WorkspaceWebpliant } from '../../models/workspace_webpliant';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { WebPliantService } from '../WebPliantService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Oggi, per tutti i casi: 29 ottobre 2026
const OGGI = new Date('2026-10-29T10:00:00Z');

function creaService(promo?: { id_promo: string; validita_dal: Date; validita_al: Date }) {
  const promoRepository = { findById: vi.fn().mockResolvedValue(promo ?? null) };
  const service = new WebPliantService(
    promoRepository as unknown as IPromoRepository,
    {} as unknown as IAreaService,
    {} as unknown as ICanaleService,
    {} as unknown as IGdoService,
    {} as unknown as ITipoExportService
  );
  return { service, promoRepository };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(OGGI);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WebPliantService.prendiWorkspaceDaID: elementi con date (keyframe)', () => {
  const nelPassato = { startDate: '2026-10-20', endDate: '2026-10-25', modification: { content: { testo: 'scaduto' } } };
  const inCorso = { startDate: '2026-10-28', endDate: '2026-10-30', modification: { content: { testo: 'di oggi' } } };

  const workspaceSalvato = {
    id: 'w1', id_area: 'a1', id_canale: 'c1', id_gdo: 'g1', nome_workspace: 'Volantino',
    sitemap: [],
    webpliant: [{
      id: 'p1', nome: 'Home', struttura: [
        { id: 'ibrido-scaduto', type: 'banner', is_hybrid: true, keyframes: [nelPassato], content: { testo: 'base' } },
        { id: 'ibrido-in-corso', type: 'banner', is_hybrid: true, keyframes: [inCorso], content: { testo: 'base' } },
        { id: 'normale-in-corso', type: 'banner', keyframes: [inCorso], content: { testo: 'base' } },
        { id: 'normale', type: 'banner', content: { testo: 'base' } },
      ],
    }],
  };

  function trovaWorkspace() {
    vi.spyOn(WorkspaceWebpliant, 'findOne').mockResolvedValue(
      structuredClone(workspaceSalvato) as unknown as Awaited<ReturnType<typeof WorkspaceWebpliant.findOne>>
    );
  }

  const elementi = (workspace: { webpliant: Array<{ struttura: unknown[] }> }) =>
    workspace.webpliant[0].struttura as Array<{ id: string; content: { testo: string } }>;

  it('al pubblico un elemento ibrido fuori dalle sue date non arriva', async () => {
    trovaWorkspace();
    const { service } = creaService();

    const workspace = await service.prendiWorkspaceDaID('w1', false);

    expect(elementi(workspace).map(e => e.id)).toEqual(['ibrido-in-corso', 'normale-in-corso', 'normale']);
  });

  it('al pubblico arriva il contenuto del keyframe in corso', async () => {
    trovaWorkspace();
    const { service } = creaService();

    const workspace = await service.prendiWorkspaceDaID('w1', false);

    expect(elementi(workspace).map(e => [e.id, e.content.testo])).toEqual([
      ['ibrido-in-corso', 'di oggi'],
      ['normale-in-corso', 'di oggi'],
      ['normale', 'base'],
    ]);
  });

  it('all\'editor il workspace arriva cosi com\'e salvato', async () => {
    trovaWorkspace();
    const { service } = creaService();

    const workspace = await service.prendiWorkspaceDaID('w1', true);

    expect(elementi(workspace)).toEqual(workspaceSalvato.webpliant[0].struttura);
    expect(workspace).toMatchObject({ idWorkspace: 'w1', idArea: 'a1', idCanale: 'c1', idGDO: 'g1', nomeWorkspace: 'Volantino' });
  });

  it('un workspace inesistente e\' un 404', async () => {
    vi.spyOn(WorkspaceWebpliant, 'findOne').mockResolvedValue(null);
    const { service } = creaService();

    await expect(service.prendiWorkspaceDaID('w-assente', false)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('WebPliantService.getDataValiditaPerCarosello', () => {
  const referenza = (dataFields: Record<string, unknown>, idPromo = 'p1') =>
    ({ id_promo: idPromo, data_fields: dataFields }) as unknown as ReferenzeIstanta;
  const automatico = { options: { validita: { auto: true } } };

  it('senza referenze non scrive date e non fallisce', async () => {
    const { service, promoRepository } = creaService();

    await expect(service.getDataValiditaPerCarosello(automatico, [])).resolves.toBe('');
    await expect(service.getDataValiditaPerCarosello(automatico, undefined as unknown as ReferenzeIstanta[])).resolves.toBe('');
    expect(promoRepository.findById).not.toHaveBeenCalled();
  });

  it('referenze con le stesse date: periodo completo', async () => {
    const { service } = creaService();
    const date = { data_da: '2026-11-01', data_a: '2026-11-07' };

    const scritta = await service.getDataValiditaPerCarosello(automatico, [referenza(date), referenza(date)]);

    expect(scritta).toBe('Offerte valide dal 1 Novembre al 7 Novembre');
  });

  it('referenze con data_a diverse: solo la data di inizio, comune a tutte', async () => {
    const { service } = creaService();

    const scritta = await service.getDataValiditaPerCarosello(automatico, [
      referenza({ data_da: '2026-11-01', data_a: '2026-11-07' }),
      referenza({ data_da: '2026-11-01', data_a: '2026-11-14' }),
    ]);

    expect(scritta).toBe('Offerte valide a partire dal 1 Novembre');
  });

  it('referenze con data_da diverse: solo la data di fine, comune a tutte', async () => {
    const { service } = creaService();

    const scritta = await service.getDataValiditaPerCarosello(automatico, [
      referenza({ data_da: '2026-11-01', data_a: '2026-11-07' }),
      referenza({ data_da: '2026-11-03', data_a: '2026-11-07' }),
    ]);

    expect(scritta).toBe('Offerte valide fino al 7 Novembre');
  });

  it('una referenza senza date proprie vale con le date di riferimento', async () => {
    const { service } = creaService();

    const scritta = await service.getDataValiditaPerCarosello(automatico, [
      referenza({ data_da: '2026-11-01', data_a: '2026-11-07' }),
      referenza({}),
    ]);

    expect(scritta).toBe('Offerte valide dal 1 Novembre al 7 Novembre');
  });

  it('se la prima referenza non ha date usa quelle della promo', async () => {
    const { service, promoRepository } = creaService({
      id_promo: 'p1', validita_dal: new Date('2026-11-01T10:00:00Z'), validita_al: new Date('2026-11-07T10:00:00Z'),
    });

    const scritta = await service.getDataValiditaPerCarosello(automatico, [referenza({})]);

    expect(promoRepository.findById).toHaveBeenCalledWith('p1');
    expect(scritta).toBe('Offerte valide dal 1 Novembre al 7 Novembre');
  });

  it('la promo delle date di riferimento non esiste: 404', async () => {
    const { service } = creaService();

    await expect(service.getDataValiditaPerCarosello(automatico, [referenza({})])).rejects.toBeInstanceOf(NotFoundError);
  });
});
