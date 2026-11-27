// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aggiornatoreDi,
  ATTESA_MASSIMA_RILETTURA_MS,
  creaAggiornatore,
  DISPERSIONE_MAX_MS,
  FINESTRA_RILETTURA_MS,
  INTERVALLO_QUERY_PESANTI_MS,
  intervalloMinimo,
  leggiAvviso,
  queryInteressata,
  TUTTE_LE_RISORSE,
  type AvvisoDati,
} from './aggiornamentoDati';

// Spec interfaccia-operatore, "Dati aggiornati in tempo reale".

const avviso = (modifiche: Partial<AvvisoDati> = {}): AvvisoDati => ({ risorsa: 'acpv', azione: 'creato', id: null, origine: null, ...modifiche });

type QueryFinta = { meta?: unknown; queryKey: unknown[]; queryHash: string; state: { dataUpdatedAt: number } };
const query = (modifiche: Partial<QueryFinta> = {}): QueryFinta => ({ queryKey: ['x'], queryHash: 'x', state: { dataUpdatedAt: 0 }, ...modifiche });
const predicatoDi = (invalida: { mock: { calls: unknown[][] } }, chiamata = 0) =>
  (invalida.mock.calls[chiamata][0] as { predicate: (q: QueryFinta) => boolean }).predicate;

const buffer = (oggetto: unknown): ArrayBuffer => {
  const byte = new TextEncoder().encode(JSON.stringify(oggetto));
  return byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.byteLength) as ArrayBuffer;
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('leggiAvviso', () => {
  it('legge l\'avviso come arriva dal canale: ArrayBuffer, testo JSON o oggetto', () => {
    const atteso = { risorsa: 'acpv', azione: 'eliminato', id: 'abc', origine: 'scheda-1' };

    expect(leggiAvviso(buffer(atteso))).toEqual(atteso);
    expect(leggiAvviso(JSON.stringify(atteso))).toEqual(atteso);
    expect(leggiAvviso(atteso)).toEqual(atteso);
    expect(leggiAvviso(new TextEncoder().encode(JSON.stringify(atteso)))).toEqual(atteso);
  });

  it('il tipo di dato si legge in minuscolo e l\'identificativo e l\'origine possono mancare', () => {
    expect(leggiAvviso({ risorsa: 'ACPV', azione: 'creato' })).toEqual({ risorsa: 'acpv', azione: 'creato', id: null, origine: null });
  });

  it('un avviso che non si capisce si scarta', () => {
    expect(leggiAvviso('non json')).toBeNull();
    expect(leggiAvviso(null)).toBeNull();
    expect(leggiAvviso(42)).toBeNull();
    expect(leggiAvviso({ risorsa: '', azione: 'creato' })).toBeNull();
    expect(leggiAvviso({ risorsa: 'acpv', azione: 'cancellato' })).toBeNull();
    expect(leggiAvviso({ azione: 'creato' })).toBeNull();
  });
});

describe('queryInteressata', () => {
  it('senza meta rilegge a ogni avviso', () => {
    expect(queryInteressata({ meta: undefined }, new Set(['promo']))).toBe(true);
  });

  it('con meta.realtime false non rilegge mai', () => {
    expect(queryInteressata({ meta: { realtime: false } }, new Set(['promo']))).toBe(false);
    expect(queryInteressata({ meta: { realtime: false } }, new Set([TUTTE_LE_RISORSE]))).toBe(false);
  });

  it('con meta.risorse rilegge solo per quei tipi di dato, e sempre dopo una riconnessione', () => {
    const query = { meta: { risorse: ['Promo', 'acpv'] } };

    expect(queryInteressata(query, new Set(['promo']))).toBe(true);
    expect(queryInteressata(query, new Set(['utenti']))).toBe(false);
    expect(queryInteressata(query, new Set([TUTTE_LE_RISORSE]))).toBe(true);
  });
});

describe('creaAggiornatore', () => {
  const nuovo = (opzioni = {}) => {
    const queryClient = new QueryClient();
    const invalida = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    // Senza dispersione casuale, raffreddamento e controllo di visibilita': qui si prova la logica semplice
    const aggiornatore = creaAggiornatore(queryClient, {
      idClient: 'questa-scheda', dispersioneMaxMs: 0, casuale: () => 0, raffreddamentoMs: 0, visibile: () => true, ...opzioni,
    });
    return { queryClient, invalida, aggiornatore };
  };

  it('un avviso fa invalidare le query attive dopo la finestra, una volta sola', () => {
    const { invalida, aggiornatore } = nuovo();

    aggiornatore.onAvviso(avviso());
    expect(invalida).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);

    expect(invalida).toHaveBeenCalledTimes(1);
    expect(invalida.mock.calls[0][0]).toMatchObject({ refetchType: 'active' });
  });

  it('piu\' avvisi ravvicinati danno una sola rilettura', () => {
    const { invalida, aggiornatore } = nuovo();

    aggiornatore.onAvviso(avviso({ risorsa: 'acpv' }));
    vi.advanceTimersByTime(100);
    aggiornatore.onAvviso(avviso({ risorsa: 'promo' }));
    vi.advanceTimersByTime(100);
    aggiornatore.onAvviso(avviso({ risorsa: 'utenti' }));
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);

    expect(invalida).toHaveBeenCalledTimes(1);
    const predicato = predicatoDi(invalida);
    expect(predicato(query({ meta: { risorse: ['promo'] } }))).toBe(true);
    expect(predicato(query({ meta: { risorse: ['altro'] } }))).toBe(false);
  });

  it('un flusso continuo di avvisi non rimanda la rilettura oltre l\'attesa massima', () => {
    const { invalida, aggiornatore } = nuovo();

    for (let trascorso = 0; trascorso < ATTESA_MASSIMA_RILETTURA_MS + 500; trascorso += 100) {
      aggiornatore.onAvviso(avviso());
      vi.advanceTimersByTime(100);
    }

    expect(invalida).toHaveBeenCalled();
  });

  it('l\'avviso della scheda che ha agito si ignora, quello di un\'altra no', () => {
    const { invalida, aggiornatore } = nuovo();

    aggiornatore.onAvviso(avviso({ origine: 'questa-scheda' }));
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);
    expect(invalida).not.toHaveBeenCalled();

    aggiornatore.onAvviso(avviso({ origine: 'altra-scheda' }));
    aggiornatore.onAvviso(avviso({ origine: null }));
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);
    expect(invalida).toHaveBeenCalledTimes(1);
  });

  it('un avviso nullo non fa niente', () => {
    const { invalida, aggiornatore } = nuovo();

    aggiornatore.onAvviso(null);
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);

    expect(invalida).not.toHaveBeenCalled();
  });

  it('dopo una riconnessione rilegge tutto, anche le query con meta.risorse', () => {
    const { invalida, aggiornatore } = nuovo();

    aggiornatore.onRiconnessione();
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);

    const predicato = predicatoDi(invalida);
    expect(predicato(query({ meta: { risorse: ['altro'] } }))).toBe(true);
    expect(predicato(query({ meta: { realtime: false } }))).toBe(false);
  });

  it('chi si iscrive riceve i tipi di dato cambiati a ogni rilettura, e puo\' smettere', () => {
    const { aggiornatore } = nuovo();
    const ascoltatore = vi.fn();
    const smetti = aggiornatore.iscrivi(ascoltatore);

    aggiornatore.onAvviso(avviso({ risorsa: 'promo' }));
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);
    expect(ascoltatore).toHaveBeenCalledTimes(1);
    expect([...ascoltatore.mock.calls[0][0]]).toEqual(['promo']);

    smetti();
    aggiornatore.onAvviso(avviso());
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);
    expect(ascoltatore).toHaveBeenCalledTimes(1);
  });

  it('un ascoltatore che sbaglia non ferma gli altri', () => {
    const { aggiornatore } = nuovo();
    const errore = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const buono = vi.fn();
    aggiornatore.iscrivi(() => { throw new Error('rotto'); });
    aggiornatore.iscrivi(buono);

    aggiornatore.onAvviso(avviso());
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS);

    expect(buono).toHaveBeenCalledTimes(1);
    errore.mockRestore();
  });

  it('chiudi annulla la rilettura in attesa', () => {
    const { invalida, aggiornatore } = nuovo();

    aggiornatore.onAvviso(avviso());
    aggiornatore.chiudi();
    vi.advanceTimersByTime(FINESTRA_RILETTURA_MS * 2);

    expect(invalida).not.toHaveBeenCalled();
  });
});

describe('molti utenti: le richieste non arrivano tutte insieme', () => {
  const nuovo = (opzioni: Parameters<typeof creaAggiornatore>[1] = {}, queryFinte: QueryFinta[] = []) => {
    const queryClient = new QueryClient();
    // Come fa la libreria: il filtro si applica alle query al momento della chiamata
    const invalida = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filtri) => {
      for (const voce of queryFinte) (filtri as { predicate?: (q: QueryFinta) => boolean }).predicate?.(voce);
    });
    let ora = 100_000;
    const aggiornatore = creaAggiornatore(queryClient, {
      idClient: 'questa-scheda', visibile: () => true, adesso: () => ora, ...opzioni,
    });
    return { invalida, aggiornatore, avanza: (ms: number) => { ora += ms; vi.advanceTimersByTime(ms); } };
  };

  it('ogni scheda aspetta un tempo casuale: con numeri diversi rilegge in momenti diversi', () => {
    const presto = nuovo({ casuale: () => 0, raffreddamentoMs: 0 });
    const tardi = nuovo({ casuale: () => 0.99, raffreddamentoMs: 0 });

    presto.aggiornatore.onAvviso(avviso());
    tardi.aggiornatore.onAvviso(avviso());
    presto.avanza(FINESTRA_RILETTURA_MS + 10);
    tardi.avanza(FINESTRA_RILETTURA_MS + 10);

    expect(presto.invalida).toHaveBeenCalledTimes(1);
    expect(tardi.invalida).not.toHaveBeenCalled();
    tardi.avanza(DISPERSIONE_MAX_MS);
    expect(tardi.invalida).toHaveBeenCalledTimes(1);
  });

  it('non rilegge piu\' spesso del raffreddamento: gli avvisi arrivati nel frattempo aspettano', () => {
    const { invalida, aggiornatore, avanza } = nuovo({ casuale: () => 0, raffreddamentoMs: 5000 });

    aggiornatore.onAvviso(avviso());
    avanza(FINESTRA_RILETTURA_MS + 10);
    expect(invalida).toHaveBeenCalledTimes(1);

    aggiornatore.onAvviso(avviso({ risorsa: 'promo' }));
    avanza(FINESTRA_RILETTURA_MS + 10);
    expect(invalida).toHaveBeenCalledTimes(1);

    avanza(5000);
    expect(invalida).toHaveBeenCalledTimes(2);
  });

  it('una scheda nascosta non rilegge: lo fa quando torna visibile', () => {
    let visibile = false;
    const { invalida, aggiornatore, avanza } = nuovo({ casuale: () => 0, raffreddamentoMs: 0, visibile: () => visibile });

    aggiornatore.onAvviso(avviso());
    avanza(FINESTRA_RILETTURA_MS + 10);
    expect(invalida).not.toHaveBeenCalled();

    visibile = true;
    document.dispatchEvent(new Event('visibilitychange'));
    avanza(DISPERSIONE_MAX_MS + 10);
    expect(invalida).toHaveBeenCalledTimes(1);
    aggiornatore.chiudi();
  });

  it('una query pesante riletta da poco resta da rileggere piu\' tardi, le altre si rileggono subito', () => {
    const ora = 100_000;
    const pesante = query({ queryKey: ['consultazione', 'volantini'], queryHash: 'pesante', state: { dataUpdatedAt: ora - 1000 } });
    const leggera = query({ queryKey: ['fetchAree'], queryHash: 'leggera', state: { dataUpdatedAt: ora - 1000 } });
    const { invalida, aggiornatore, avanza } = nuovo({ casuale: () => 0, raffreddamentoMs: 0 }, [pesante, leggera]);

    aggiornatore.onAvviso(avviso());
    avanza(FINESTRA_RILETTURA_MS + 10);

    const primo = predicatoDi(invalida, 0);
    expect(primo(leggera)).toBe(true);
    expect(primo(pesante)).toBe(false);

    avanza(INTERVALLO_QUERY_PESANTI_MS + 100);
    expect(invalida).toHaveBeenCalledTimes(2);
    const secondo = predicatoDi(invalida, 1);
    expect(secondo(pesante)).toBe(true);
    expect(secondo(leggera)).toBe(false);
  });

  it('una query pesante non letta da tempo si rilegge subito', () => {
    const { invalida, aggiornatore, avanza } = nuovo({ casuale: () => 0, raffreddamentoMs: 0 });
    const vecchia = query({ queryKey: ['flyerInsights', 'k'], queryHash: 'vecchia', state: { dataUpdatedAt: 100_000 - INTERVALLO_QUERY_PESANTI_MS - 1 } });

    aggiornatore.onAvviso(avviso());
    avanza(FINESTRA_RILETTURA_MS + 10);

    expect(predicatoDi(invalida)(vecchia)).toBe(true);
  });
});

describe('intervalloMinimo', () => {
  it('le query pesanti hanno un intervallo, le altre no, e meta.realtimeMinMs lo cambia', () => {
    expect(intervalloMinimo({ queryKey: ['consultazione', 'a'], meta: undefined })).toBe(INTERVALLO_QUERY_PESANTI_MS);
    expect(intervalloMinimo({ queryKey: ['flyerInsights', 'a'], meta: undefined })).toBe(INTERVALLO_QUERY_PESANTI_MS);
    expect(intervalloMinimo({ queryKey: ['fetchAree'], meta: undefined })).toBe(0);
    expect(intervalloMinimo({ queryKey: ['fetchAree'], meta: { realtimeMinMs: 10_000 } })).toBe(10_000);
    expect(intervalloMinimo({ queryKey: ['consultazione'], meta: { realtimeMinMs: 0 } })).toBe(0);
  });
});

describe('aggiornatoreDi', () => {
  it('un solo aggiornatore per QueryClient, anche chiamato piu\' volte', () => {
    const client = new QueryClient();

    expect(aggiornatoreDi(client)).toBe(aggiornatoreDi(client));
    expect(aggiornatoreDi(new QueryClient())).not.toBe(aggiornatoreDi(client));
  });
});
