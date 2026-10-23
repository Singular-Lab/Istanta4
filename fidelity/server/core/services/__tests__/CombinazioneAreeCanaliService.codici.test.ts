import { afterEach, describe, expect, it, vi } from 'vitest';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { CombinazioneAreeCanaliService } from '../CombinazioneAreeCanaliService';

vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Il modale di inserimento manuale dell'import sceglie canale e area per codice

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAllCombinazioniForGDOReworked', () => {
  it('restituisce anche i codici di canale e area, oltre ai nomi', async () => {
    const combinazioneRepository = {
      findByGdoId: vi.fn(async () => [{
        id_combinazione_canale_area: 'k1',
        id_canale_combinazione_canale_area: 'c1',
        id_area_combinazione_canale_area: 'a1',
        stato_combinazione_canale_area: 'ATTIVO',
      }]),
    };
    vi.spyOn(Canale, 'findAll').mockResolvedValue([{ id_canali: 'c1', codice_canali: 'tuday', nome_canali: 'TuDay' }] as any);
    vi.spyOn(Area, 'findAll').mockResolvedValue([{ id_aree: 'a1', codice_aree: 'TO', nome_aree: 'Toscana' }] as any);

    const [combinazione] = await new CombinazioneAreeCanaliService(combinazioneRepository as any, {} as any, {} as any)
      .getAllCombinazioniForGDOReworked('g1');

    expect(combinazione).toMatchObject({
      id: 'k1', sigla_combinazione: 'tuday_TO', codice_canale: 'tuday', codice_area: 'TO', nome_canale: 'TuDay', nome_area: 'Toscana',
    });
  });
});
