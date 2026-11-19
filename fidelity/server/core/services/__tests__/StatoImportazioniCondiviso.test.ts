import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../models', () => ({ Tracciati: { findByPk: vi.fn() } }));

import { StatoImportazioniCondiviso, type StatoLetto } from '../StatoImportazioniCondiviso';

/**
 * Spec ciclo-promozione-importazione, "Stato dell'importazione senza richieste superflue"
 * (TASK-f4e1fc7c): Istanta riceve al piu' una richiesta per tracciato nel periodo della sua fase,
 * qualunque sia il numero di utenti, e nessuna per un tracciato gia' importato o scartato.
 */
const crea = (statoRegistrato: string | null = null) => {
  const orologio = { adesso: 1_000_000 };
  const registrato = vi.fn(async () => statoRegistrato);
  const servizio = new StatoImportazioniCondiviso({ statoRegistrato: registrato, adesso: () => orologio.adesso });
  return { servizio, orologio, registrato };
};

const istanta = (stato: string) => vi.fn(async (): Promise<StatoLetto> => ({ stato, error: '', esito: true }));

describe('StatoImportazioniCondiviso', () => {
  it('dieci richieste contemporanee per lo stesso tracciato fanno una sola chiamata a Istanta', async () => {
    const { servizio } = crea();
    let rispondi: (valore: StatoLetto) => void = () => undefined;
    const chiama = vi.fn(() => new Promise<StatoLetto>((r) => { rispondi = r; }));

    const risposte = Promise.all(Array.from({ length: 10 }, () => servizio.leggi('t1', chiama)));
    await new Promise((r) => setTimeout(r, 0));
    rispondi({ stato: 'ElaborazioneDati', esito: true });

    expect((await risposte).map((r) => r.stato)).toEqual(Array(10).fill('ElaborazioneDati'));
    expect(chiama).toHaveBeenCalledTimes(1);
  });

  it('mentre Istanta importa riusa la risposta per 5 secondi', async () => {
    const { servizio, orologio } = crea();
    const chiama = istanta('InCoda');

    await servizio.leggi('t1', chiama);
    orologio.adesso += 4_999;
    await servizio.leggi('t1', chiama);
    expect(chiama).toHaveBeenCalledTimes(1);

    orologio.adesso += 2;
    await servizio.leggi('t1', chiama);
    expect(chiama).toHaveBeenCalledTimes(2);
  });

  it("mentre l'importazione aspetta l'operatore riusa la risposta per un minuto", async () => {
    const { servizio, orologio } = crea();
    const chiama = istanta('InAttesaDiConfermaUtente');

    await servizio.leggi('t1', chiama);
    orologio.adesso += 59_000;
    await servizio.leggi('t1', chiama);
    expect(chiama).toHaveBeenCalledTimes(1);

    orologio.adesso += 2_000;
    await servizio.leggi('t1', chiama);
    expect(chiama).toHaveBeenCalledTimes(2);
  });

  it('un esito finale resta valido per 10 minuti', async () => {
    const { servizio, orologio } = crea();
    const chiama = istanta('TerminataConErrori');

    await servizio.leggi('t1', chiama);
    orologio.adesso += 9 * 60_000;
    await servizio.leggi('t1', chiama);
    expect(chiama).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Terminata', 'Terminata'],
    ['Scartato', 'Scartata'],
  ])('un tracciato registrato in FP come %s non si chiede a Istanta', async (registrato, stato) => {
    const { servizio } = crea(registrato);
    const chiama = istanta('InCoda');

    expect(await servizio.leggi('t1', chiama)).toEqual({ stato, error: '', esito: true });
    expect(chiama).not.toHaveBeenCalled();
  });

  it("un errore non resta: la richiesta successiva riprova", async () => {
    const { servizio } = crea();
    const chiama = vi.fn<() => Promise<StatoLetto>>()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ stato: 'InCoda', esito: true });

    await expect(servizio.leggi('t1', chiama)).rejects.toThrow('ECONNREFUSED');
    expect((await servizio.leggi('t1', chiama)).stato).toBe('InCoda');
    expect(chiama).toHaveBeenCalledTimes(2);
  });

  it('tracciati diversi non condividono la risposta', async () => {
    const { servizio } = crea();
    const chiama = istanta('InCoda');

    await servizio.leggi('t1', chiama);
    await servizio.leggi('t2', chiama);
    expect(chiama).toHaveBeenCalledTimes(2);
  });

  it("dimentica: dopo l'eliminazione si richiede", async () => {
    const { servizio } = crea();
    const chiama = istanta('InAttesaDiConfermaUtente');

    await servizio.leggi('t1', chiama);
    servizio.dimentica('t1');
    await servizio.leggi('t1', chiama);
    expect(chiama).toHaveBeenCalledTimes(2);
  });
});

// Spec processi-in-produzione, "Modifiche valide in tutti i processi"
describe('StatoImportazioniCondiviso con piu\' worker', () => {
  it('dimentica avvisa gli altri processi', () => {
    const avvisaAltriProcessi = vi.fn();
    const servizio = new StatoImportazioniCondiviso({ statoRegistrato: async () => null, adesso: () => 0, avvisaAltriProcessi });

    servizio.dimentica('t1');

    expect(avvisaAltriProcessi).toHaveBeenCalledWith('t1');
  });

  it('dimenticaQui, per l\'avviso di un altro worker, scarta la risposta senza rimandare l\'avviso', async () => {
    const avvisaAltriProcessi = vi.fn();
    const servizio = new StatoImportazioniCondiviso({ statoRegistrato: async () => null, adesso: () => 0, avvisaAltriProcessi });
    const chiama = istanta('InAttesaDiConfermaUtente');

    await servizio.leggi('t1', chiama);
    servizio.dimenticaQui('t1');
    await servizio.leggi('t1', chiama);

    expect(chiama).toHaveBeenCalledTimes(2);
    expect(avvisaAltriProcessi).not.toHaveBeenCalled();
  });
});
