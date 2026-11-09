import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RiepilogoDaSalvare, RigaReferenzaKit } from '../../repositories/AnalisiPuntiVenditaRepository';
import { AGGREGATI_VUOTI, type AggregatiKit, aggregatiDi, VERSIONE_ANALISI_KIT } from '../../utils/analisiKit';
import { AnalisiKitService, CHIAVE_PRODOTTO, KIT_PER_LETTURA, leggiReferenzeKit, type RepositoryRiepiloghiKit, ultimaModifica } from '../AnalisiKitService';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../logger', () => ({ log }));

// I riepiloghi dei kit in analisi_kit, condivisi fra le pagine del punto vendita e il viaggio del
// prodotto negli insight del volantino: quelli salvati e validi si usano, gli altri si calcolano
// dalle referenze a blocchi e si salvano prima di rispondere.

const kit = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const riga = (idKit: string, id: string, dati: Partial<RigaReferenzaKit> = {}): RigaReferenzaKit => ({
  id,
  id_runtime_kit: idKit,
  compiled_fields: [],
  data_fields: { codice_referenza: id, descrizione_uno: `Prodotto ${id}`, prezzo: 1.5, prezzo_anziche: 2 },
  foto: [],
  meccanica: '',
  codice_box: id,
  group_elements: [],
  pag: 1,
  x: 10,
  y: 10,
  w: 50,
  h: 50,
  w_page: 210,
  h_page: 287,
  perc_ingombro: null,
  aggiornata_il: new Date('2026-10-01T10:00:00Z'),
  storico: false,
  ...dati,
});

function creaRepository(salvati: Map<string, AggregatiKit>, righe: RigaReferenzaKit[]) {
  return {
    aggregatiKit: vi.fn(async (idKit: readonly string[], _versione: number) => new Map(idKit.flatMap(id => {
      const aggregati = salvati.get(id);
      return aggregati ? [[id, aggregati] as const] : [];
    }))),
    referenzeDeiKit: vi.fn(async (idKit: readonly string[]) => righe.filter(voce => idKit.includes(voce.id_runtime_kit))),
    salvaRiepiloghi: vi.fn(async (voci: readonly RiepilogoDaSalvare[]) => {
      for (const voce of voci) salvati.set(voce.idKit, aggregatiDi(voce.riepilogo.dati));
    }),
  } satisfies RepositoryRiepiloghiKit;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnalisiKitService.aggregati', () => {
  it('usa i riepiloghi salvati e calcola gli altri dalle referenze, salvandoli con versione e ultima modifica', async () => {
    const salvato: AggregatiKit = { ...AGGREGATI_VUOTI, referenze: 7 };
    const repository = creaRepository(new Map([[kit(1), salvato]]), [
      riga(kit(2), 'A'),
      riga(kit(2), 'B', { aggiornata_il: '2026-10-03T08:00:00Z' }),
      riga(kit(3), 'C', { storico: true }),
    ]);
    const servizio = new AnalisiKitService(repository, 'Insight volantino');

    const aggregati = await servizio.aggregati([kit(1), kit(2), kit(3), kit(2)]);

    // Una volta per kit anche se chiesto due volte
    expect(repository.aggregatiKit).toHaveBeenCalledWith([kit(1), kit(2), kit(3)], VERSIONE_ANALISI_KIT);
    expect(repository.referenzeDeiKit).toHaveBeenCalledWith([kit(2), kit(3)]);
    expect(repository.salvaRiepiloghi).toHaveBeenCalledWith([
      expect.objectContaining({ idKit: kit(2), versione: VERSIONE_ANALISI_KIT, referenzeAl: new Date('2026-10-03T08:00:00Z') }),
      expect.objectContaining({ idKit: kit(3), versione: VERSIONE_ANALISI_KIT, referenzeAl: new Date('2026-10-01T10:00:00Z') }),
    ]);
    expect(aggregati.get(kit(1))).toBe(salvato);
    expect(aggregati.get(kit(2))?.referenze).toBe(2);
    expect(aggregati.get(kit(3))?.referenze).toBe(1);
    // Il log dice quale pagina ha fatto calcolare i riepiloghi
    expect(log.info).toHaveBeenCalledWith('Insight volantino: riepiloghi dei kit da calcolare', { kit: 2 });
  });

  it('un kit senza referenze ha un riepilogo vuoto, salvato anche lui senza data di modifica', async () => {
    const repository = creaRepository(new Map(), []);

    const aggregati = await new AnalisiKitService(repository).aggregati([kit(9)]);

    expect(aggregati.get(kit(9))).toMatchObject({ referenze: 0, pagine: 0 });
    expect(repository.salvaRiepiloghi).toHaveBeenCalledWith([expect.objectContaining({ idKit: kit(9), referenzeAl: null })]);
  });

  it('i kit mancanti si leggono a blocchi di KIT_PER_LETTURA', async () => {
    const molti = Array.from({ length: KIT_PER_LETTURA * 2 + 1 }, (_, indice) => kit(indice + 100));
    const repository = creaRepository(new Map(), []);

    await new AnalisiKitService(repository).aggregati(molti);

    expect(repository.referenzeDeiKit.mock.calls.map(([idKit]) => idKit.length)).toEqual([KIT_PER_LETTURA, KIT_PER_LETTURA, 1]);
    expect(repository.salvaRiepiloghi).toHaveBeenCalledTimes(3);
  });

  it('con tutti i riepiloghi salvati, o senza kit, non legge referenze ne\' salva nulla', async () => {
    const repository = creaRepository(new Map([[kit(1), AGGREGATI_VUOTI]]), []);
    const servizio = new AnalisiKitService(repository);

    await servizio.aggregati([kit(1)]);
    await expect(servizio.aggregati([])).resolves.toEqual(new Map());

    expect(repository.aggregatiKit).toHaveBeenCalledTimes(1);
    expect(repository.referenzeDeiKit).not.toHaveBeenCalled();
    expect(repository.salvaRiepiloghi).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('se il salvataggio non riesce l\'errore arriva a chi chiede: i riepiloghi sarebbero incompleti', async () => {
    const repository = creaRepository(new Map(), [riga(kit(2), 'A')]);
    repository.salvaRiepiloghi.mockRejectedValueOnce(new Error('database in sola lettura'));

    await expect(new AnalisiKitService(repository).aggregati([kit(2)])).rejects.toThrow('database in sola lettura');
  });
});

describe('lettura delle referenze dei kit', () => {
  it('ogni riga si legge secondo l\'origine del suo kit e l\'ultima modifica ignora le date non valide', () => {
    const righe = [riga(kit(1), 'A'), riga(kit(2), 'B', { storico: true, aggiornata_il: 'non una data' }), riga(kit(2), 'C', { aggiornata_il: null })];

    expect(leggiReferenzeKit(righe).map(referenza => [referenza.chiave, referenza.prezzo])).toEqual([['c-A', 1.5], ['c-B', 1.5], ['c-C', 1.5]]);
    expect(ultimaModifica(righe)).toEqual(new Date('2026-10-01T10:00:00Z'));
    expect(ultimaModifica([])).toBeNull();
  });

  it('le chiavi dei prodotti valide sono quelle di chiaveProdotto', () => {
    expect(CHIAVE_PRODOTTO.test('c-8001234')).toBe(true);
    expect(CHIAVE_PRODOTTO.test('d-TW96emFyZWxsYXxHcmFuYXJvbG98MTI1IGc')).toBe(true);
    expect(CHIAVE_PRODOTTO.test('x-1')).toBe(false);
    expect(CHIAVE_PRODOTTO.test('c-con spazio')).toBe(false);
    expect(CHIAVE_PRODOTTO.test('c-')).toBe(false);
  });
});
