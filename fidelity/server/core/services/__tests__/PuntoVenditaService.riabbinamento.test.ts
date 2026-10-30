import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PuntoVenditaResponseDTO } from '../../dto';
import type { IPuntoVenditaRepository } from '../../repositories/PuntoVenditaRepository';
import { PuntoVenditaService } from '../PuntoVenditaService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Storia del punto vendita: quando un PV si crea o cambia, le righe dei volantini della sua GDO ancora
// senza PV si riabbinano. Quelle gia' collegate a un PV restano sue, qualunque cosa cambi del PV:
// la sua storia non deve sparire proprio quando trasloca o cambia numero.

const prima = {
  id_puntivendita: 'pv-1',
  id_gdo_puntivendita: 'gdo-1',
  nome_puntivendita: 'Conad Pra',
  citta_puntivendita: 'Genova',
  indirizzo_puntivendita: 'Via Murtola 12/14',
  telefono_puntivendita: '010 6197180',
};

const dto = (sovrascritti: Partial<PuntoVenditaResponseDTO> = {}) => ({
  id: 'pv-1', id_gdo: 'gdo-1', nome: 'Conad Pra', citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180', ...sovrascritti,
}) as PuntoVenditaResponseDTO;

function servizio(dopo: PuntoVenditaResponseDTO) {
  const repository = {
    findById: vi.fn(async (): Promise<typeof prima | null> => prima),
    update: vi.fn(async () => undefined),
    create: vi.fn(async () => ({ id_puntivendita: 'pv-1' })),
  };
  const riabbinamento = { pianificaRiabbinamento: vi.fn() };
  const service = new PuntoVenditaService(repository as unknown as IPuntoVenditaRepository, riabbinamento);
  vi.spyOn(service, 'getPuntoVenditaById').mockResolvedValue(dopo);
  return { service, repository, riabbinamento };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PuntoVenditaService: riabbinamento dei volantini', () => {
  it('PV creato: riabbina le righe senza PV della sua GDO', async () => {
    const { service, riabbinamento } = servizio(dto());

    await service.createPuntoVendita({ nome: 'Conad Pra', citta: 'Genova', id_gdo: 'gdo-1' });

    expect(riabbinamento.pianificaRiabbinamento).toHaveBeenCalledOnce();
    expect(riabbinamento.pianificaRiabbinamento).toHaveBeenCalledWith('gdo-1');
  });

  it.each([
    ['indirizzo e telefono', { indirizzo: 'Via Nuova 3', telefono: '010 0000000' }],
    ['citta', { citta: 'Pra' }],
    ['solo il nome', { nome: 'Conad City Pra' }],
  ])('PV modificato (%s): solo le righe senza PV della GDO, le sue restano collegate', async (_campi, cambio) => {
    const { service, riabbinamento } = servizio(dto(cambio));

    await service.updatePuntoVendita('pv-1', cambio);

    // Nessun PV da ricontrollare: il servizio della storia riceve solo la GDO
    expect(riabbinamento.pianificaRiabbinamento).toHaveBeenCalledOnce();
    expect(riabbinamento.pianificaRiabbinamento).toHaveBeenCalledWith('gdo-1');
  });

  it('PV passato a un\'altra GDO: si riabbinano le righe senza PV della nuova', async () => {
    const { service, riabbinamento } = servizio(dto({ id_gdo: 'gdo-2' }));

    await service.updatePuntoVendita('pv-1', { id_gdo: 'gdo-2' });

    expect(riabbinamento.pianificaRiabbinamento).toHaveBeenCalledOnce();
    expect(riabbinamento.pianificaRiabbinamento).toHaveBeenCalledWith('gdo-2');
  });

  it('un riabbinamento che non si riesce a pianificare non fa fallire il salvataggio', async () => {
    const { service, riabbinamento } = servizio(dto({ telefono: '010 0000000' }));
    riabbinamento.pianificaRiabbinamento.mockImplementation(() => { throw new Error('rotto'); });

    await expect(service.updatePuntoVendita('pv-1', { telefono: '010 0000000' })).resolves.toMatchObject({ id: 'pv-1' });
    await expect(service.createPuntoVendita({ nome: 'Conad Pra', id_gdo: 'gdo-1' })).resolves.toMatchObject({ id: 'pv-1' });
  });

  it('PV inesistente: niente aggiornamento e niente riabbinamento', async () => {
    const { service, repository, riabbinamento } = servizio(dto());
    repository.findById.mockResolvedValue(null);

    expect(await service.updatePuntoVendita('pv-9', { telefono: '010 0000000' })).toBeNull();
    expect(riabbinamento.pianificaRiabbinamento).not.toHaveBeenCalled();
  });

  it('senza servizio della storia il PV si salva come prima', async () => {
    const repository = { findById: vi.fn(async () => prima), update: vi.fn(async () => undefined) };
    const service = new PuntoVenditaService(repository as unknown as IPuntoVenditaRepository);
    vi.spyOn(service, 'getPuntoVenditaById').mockResolvedValue(dto({ telefono: '010 0000000' }));

    await expect(service.updatePuntoVendita('pv-1', { telefono: '010 0000000' })).resolves.toMatchObject({ id: 'pv-1' });
  });
});
