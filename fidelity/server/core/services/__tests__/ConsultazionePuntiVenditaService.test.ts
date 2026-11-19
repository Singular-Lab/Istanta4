import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../lib/errors';
import type {
  RigaCombinazioneVolantini,
  RigaPuntoVenditaConsultazione,
  RigaStoriaInElenco,
} from '../../repositories/ConsultazionePuntiVenditaRepository';
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
      puntiVenditaConCambioInsegna: vi.fn(async (): Promise<string[]> => []),
      combinazioniDeiVolantini: vi.fn(async (): Promise<RigaCombinazioneVolantini[]> => []),
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

  it('nell\'elenco segna i punti vendita la cui combinazione canale/area ha volantini', async () => {
    const { servizio, repository } = crea(riga());
    const PV_SENZA = '22222222-2222-4222-8222-222222222222';
    const PV_NESSUNA = '33333333-3333-4333-8333-333333333333';
    repository.elencaDellaGdo.mockResolvedValueOnce([
      riga(),
      riga({ id: PV_SENZA, id_area: 'a2', nome_area: 'Liguria' }),
      riga({ id: PV_NESSUNA, id_canale: null, id_area: null }),
    ]);
    // Gli id arrivano dal kit: maiuscole o minuscole non contano
    repository.combinazioniDeiVolantini.mockResolvedValueOnce([{ id_canale: 'C1', id_area: 'A1' }, { id_canale: 'c2', id_area: 'a2' }]);

    const elenco = await servizio.elenca('g1');

    expect(repository.combinazioniDeiVolantini).toHaveBeenCalledWith('g1');
    expect(elenco.map(pv => [pv.id, pv.combinazioneConVolantini])).toEqual([
      [PV, true],
      [PV_SENZA, false],
      [PV_NESSUNA, false],
    ]);
  });

  it('nell\'elenco "ha cambiato insegna" viene dalla regola delle insegne nel tempo, non dall\'insegna di ogni anno', async () => {
    const { servizio, repository } = crea(riga());
    const PV_2 = '22222222-2222-4222-8222-222222222222';
    repository.elencaDellaGdo.mockResolvedValueOnce([riga(), riga({ id: PV_2 })]);
    // PV: Conad nel 2025 per la lista ripetuta in un'altra area, City nel 2026 (insegna prevalente diversa)
    repository.storiaInElenco.mockResolvedValueOnce([
      { id_punto_vendita: PV, anno: 2025, id_canale: 'conad', nome_canale: 'Conad', volantini: 2 },
      { id_punto_vendita: PV, anno: 2026, id_canale: 'city', nome_canale: 'City', volantini: 2 },
      { id_punto_vendita: PV_2, anno: 2026, id_canale: 'city', nome_canale: 'City', volantini: 4 },
    ]);
    repository.puntiVenditaConCambioInsegna.mockResolvedValueOnce([PV_2]);

    const elenco = await servizio.elenca('g1');

    expect(repository.puntiVenditaConCambioInsegna).toHaveBeenCalledWith('g1');
    expect(elenco.map(pv => [pv.id, pv.storia?.cambioInsegna])).toEqual([[PV, false], [PV_2, true]]);
  });

  it('se i cambi di insegna non si leggono, l\'elenco esce con la storia e senza l\'indicazione', async () => {
    const { servizio, repository } = crea(riga());
    repository.storiaInElenco.mockResolvedValueOnce([{ id_punto_vendita: PV, anno: 2026, id_canale: 'city', nome_canale: 'City', volantini: 3 }]);
    repository.puntiVenditaConCambioInsegna.mockRejectedValueOnce(new Error('timeout'));

    const [pv] = await servizio.elenca('g1');

    expect(pv.storia).toMatchObject({ volantini: 3, cambioInsegna: false });
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

  it('per PV: volantini, l\'insegna con piu\' volantini di ogni anno (a parita\' per nome) e se ha cambiato insegna', () => {
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
    // L'insegna prevalente diversa da un anno all'altro non basta: decide la regola delle insegne nel tempo
    const cambiata = [voce('pv-3', 2023, 'A', 2), voce('pv-3', 2024, 'B', 2)];
    expect(storiaInElenco(cambiata).get('pv-3')?.cambioInsegna).toBe(false);
    expect(storiaInElenco(cambiata, new Set(['pv-3'])).get('pv-3')?.cambioInsegna).toBe(true);
  });

  it('un anno senza canale non e\' un cambio di insegna; i PV senza volantini non ci sono', () => {
    const storie = storiaInElenco([voce('pv-1', 2023, null, 1), voce('pv-1', 2024, 'A', 1)]);
    expect(storie.get('pv-1')).toMatchObject({ insegnePerAnno: [{ anno: 2023, canale: null }, { anno: 2024, canale: { id: 'A' } }], cambioInsegna: false });
    expect(storie.has('pv-9')).toBe(false);
    expect(storiaInElenco([]).size).toBe(0);
  });
});
