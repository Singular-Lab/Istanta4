import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../lib/errors';
import type { RigaPuntoVenditaConsultazione, RigaStoriaInElenco } from '../../repositories/ConsultazionePuntiVenditaRepository';
import { ConsultazionePuntiVenditaService, inConsultazione, storiaInElenco } from '../ConsultazionePuntiVenditaService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Consultazione dei punti vendita: il DTO porta solo l'anagrafica, mai dati inventati.

const PV = '11111111-1111-4111-8111-111111111111';

const riga = (dati: Partial<RigaPuntoVenditaConsultazione> = {}): RigaPuntoVenditaConsultazione => ({
  id: PV,
  nome: 'Conad Lucca',
  ragione_sociale: null,
  indirizzo: 'Via Roma 1',
  cap: '55100',
  citta: 'Lucca',
  provincia: 'LU',
  regione: null,
  telefono: null,
  meta: null,
  lat: null,
  lon: null,
  id_canale: 'c1',
  nome_canale: 'Conad City',
  codice_canale: 'CC',
  id_area: 'a1',
  nome_area: 'Toscana',
  codice_area: 'TO',
  ...dati,
});

describe('inConsultazione', () => {
  it('i campi vuoti restano null, senza segnaposto', () => {
    const pv = inConsultazione(riga({ ragione_sociale: '  ', telefono: '' }));

    expect(pv.ragioneSociale).toBeNull();
    expect(pv.regione).toBeNull();
    expect(pv.telefono).toBeNull();
    expect(pv.meta).toEqual({});
  });

  it('senza una delle due coordinate il punto vendita non ha posizione (mai 0,0)', () => {
    expect(inConsultazione(riga({ lat: '43.84', lon: null })).coordinate).toBeNull();
    expect(inConsultazione(riga({ lat: 'abc', lon: '10.5' })).coordinate).toBeNull();
    expect(inConsultazione(riga({ lat: '43.84', lon: '10.5' })).coordinate).toEqual({ lat: 43.84, lon: 10.5 });
    expect(inConsultazione(riga({ lat: 0, lon: 0 })).coordinate).toEqual({ lat: 0, lon: 0 });
  });

  it('senza combinazione canale e area sono null; senza nome si usa il codice', () => {
    const senza = inConsultazione(riga({ id_canale: null, nome_canale: null, codice_canale: null, id_area: null, nome_area: null, codice_area: null }));
    expect(senza.canale).toBeNull();
    expect(senza.area).toBeNull();

    expect(inConsultazione(riga({ nome_area: null })).area).toEqual({ id: 'a1', nome: 'TO', codice: 'TO' });
  });
});

describe('ConsultazionePuntiVenditaService', () => {
  const crea = (trovato: RigaPuntoVenditaConsultazione | null) => {
    const repository = {
      elencaDellaGdo: vi.fn(async () => [riga()]),
      trovaDellaGdo: vi.fn(async () => trovato),
      storiaInElenco: vi.fn(async (): Promise<RigaStoriaInElenco[]> => []),
    };
    const puntoVenditaService = { getVolantiniAttivi: vi.fn(async () => []) };
    return { servizio: new ConsultazionePuntiVenditaService(repository, puntoVenditaService), repository, puntoVenditaService };
  };

  it('cerca il punto vendita sempre dentro la GDO indicata', async () => {
    const { servizio, repository } = crea(riga());

    await servizio.dettaglio('g1', PV);

    expect(repository.trovaDellaGdo).toHaveBeenCalledWith('g1', PV);
  });

  it('fuori dalla GDO il punto vendita non esiste: NotFoundError, e niente volantini', async () => {
    const { servizio, puntoVenditaService } = crea(null);

    await expect(servizio.dettaglio('g1', PV)).rejects.toThrow(NotFoundError);
    await expect(servizio.volantiniAttivi('g1', PV)).rejects.toThrow(NotFoundError);
    expect(puntoVenditaService.getVolantiniAttivi).not.toHaveBeenCalled();
  });

  it('i volantini attivi sono quelli della gestione, dopo il controllo della GDO', async () => {
    const { servizio, puntoVenditaService } = crea(riga());

    await servizio.volantiniAttivi('g1', PV);

    expect(puntoVenditaService.getVolantiniAttivi).toHaveBeenCalledWith(PV);
  });
});

describe('storiaInElenco', () => {
  const voce = (idPuntoVendita: string, anno: number, idCanale: string | null, volantini: number): RigaStoriaInElenco => ({
    id_punto_vendita: idPuntoVendita, anno, id_canale: idCanale, nome_canale: idCanale ? `Insegna ${idCanale}` : '', volantini,
  });

  it('per PV: volantini, l\'insegna con piu\' volantini di ogni anno (a parita\' per nome) e se cambia', () => {
    const storie = storiaInElenco([
      voce('pv-1', 2024, 'B', 5),
      voce('pv-1', 2023, 'A', 10),
      voce('pv-1', 2024, 'A', 5),
      voce('pv-2', 2023, 'A', 3),
      voce('pv-2', 2024, 'A', 7),
    ]);

    expect(storie.get('pv-1')).toEqual({
      volantini: 20,
      insegnePerAnno: [{ anno: 2023, canale: { id: 'A', nome: 'Insegna A' } }, { anno: 2024, canale: { id: 'A', nome: 'Insegna A' } }],
      cambioInsegna: false,
    });
    expect(storie.get('pv-2')).toMatchObject({ volantini: 10, cambioInsegna: false });
    expect(storiaInElenco([voce('pv-3', 2023, 'A', 2), voce('pv-3', 2024, 'B', 2)]).get('pv-3')?.cambioInsegna).toBe(true);
  });

  it('un anno senza canale non e\' un cambio di insegna; i PV senza volantini non ci sono', () => {
    const storie = storiaInElenco([voce('pv-1', 2023, null, 1), voce('pv-1', 2024, 'A', 1)]);
    expect(storie.get('pv-1')).toMatchObject({ insegnePerAnno: [{ anno: 2023, canale: null }, { anno: 2024, canale: { id: 'A' } }], cambioInsegna: false });
    expect(storie.has('pv-9')).toBe(false);
    expect(storiaInElenco([]).size).toBe(0);
  });
});
