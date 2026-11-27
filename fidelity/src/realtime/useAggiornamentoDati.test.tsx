// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FINESTRA_RILETTURA_MS } from './aggiornamentoDati';
import { EVENTO_DATI_CAMBIATI, useAggiornamentoDati, useCambioDati } from './useAggiornamentoDati';

// Spec interfaccia-operatore, "Dati aggiornati in tempo reale": gli avvisi del canale fanno rileggere
// le pagine; dopo una riconnessione che non ha recuperato gli avvisi si rilegge tutto.

class CanaleFinto {
  recovered = false;
  private readonly ascoltatori = new Map<string, Set<(...argomenti: unknown[]) => void>>();
  on(evento: string, ascoltatore: (...argomenti: unknown[]) => void) {
    const set = this.ascoltatori.get(evento) ?? new Set();
    set.add(ascoltatore);
    this.ascoltatori.set(evento, set);
  }
  off(evento: string, ascoltatore?: (...argomenti: unknown[]) => void) {
    if (ascoltatore) this.ascoltatori.get(evento)?.delete(ascoltatore);
  }
  emetti(evento: string, ...argomenti: unknown[]) {
    for (const ascoltatore of [...(this.ascoltatori.get(evento) ?? [])]) ascoltatore(...argomenti);
  }
  quanti(evento: string) {
    return this.ascoltatori.get(evento)?.size ?? 0;
  }
}

const avviso = (risorsa: string, origine: string | null = null) =>
  new TextEncoder().encode(JSON.stringify({ risorsa, azione: 'creato', id: null, origine })).buffer;

let ricarica: ReturnType<typeof vi.fn<() => void>>;
let ricaricaPromo: ReturnType<typeof vi.fn<() => void>>;
let queryClient: QueryClient;
let invalida: ReturnType<typeof vi.spyOn>;

function Prova({ canale }: { canale: CanaleFinto }) {
  useAggiornamentoDati(canale);
  useCambioDati(() => ricarica());
  useCambioDati(() => ricaricaPromo(), ['promo']);
  return null;
}

const monta = (canale: CanaleFinto) => {
  const router = createMemoryRouter([{ path: '/', element: <Prova canale={canale} /> }]);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

const passa = () => act(() => { vi.advanceTimersByTime(FINESTRA_RILETTURA_MS + 10); });

beforeEach(() => {
  vi.useFakeTimers();
  // Senza tempo casuale prima della rilettura
  vi.spyOn(Math, 'random').mockReturnValue(0);
  ricarica = vi.fn<() => void>();
  ricaricaPromo = vi.fn<() => void>();
  queryClient = new QueryClient();
  invalida = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useAggiornamentoDati', () => {
  it('un avviso di un\'altra scheda fa rileggere le query e avvisa le pagine iscritte', () => {
    const canale = new CanaleFinto();
    monta(canale);

    act(() => canale.emetti(EVENTO_DATI_CAMBIATI, avviso('acpv', 'un-altra-scheda')));
    passa();

    expect(invalida).toHaveBeenCalledTimes(1);
    expect(ricarica).toHaveBeenCalledTimes(1);
    expect(ricaricaPromo).not.toHaveBeenCalled();
  });

  it('una pagina iscritta a un tipo di dato rilegge solo per quello', () => {
    const canale = new CanaleFinto();
    monta(canale);

    act(() => canale.emetti(EVENTO_DATI_CAMBIATI, avviso('promo', 'un-altra-scheda')));
    passa();

    expect(ricaricaPromo).toHaveBeenCalledTimes(1);
  });

  it('un avviso che non si capisce non fa niente', () => {
    const canale = new CanaleFinto();
    monta(canale);

    act(() => canale.emetti(EVENTO_DATI_CAMBIATI, 'non json'));
    passa();

    expect(invalida).not.toHaveBeenCalled();
    expect(ricarica).not.toHaveBeenCalled();
  });

  it('il primo collegamento non rilegge; una riconnessione senza avvisi recuperati rilegge tutto', () => {
    const canale = new CanaleFinto();
    monta(canale);

    act(() => canale.emetti('connect'));
    passa();
    expect(invalida).not.toHaveBeenCalled();

    canale.recovered = false;
    act(() => canale.emetti('connect'));
    passa();
    expect(invalida).toHaveBeenCalledTimes(1);
    expect(ricaricaPromo).toHaveBeenCalledTimes(1);
  });

  it('una riconnessione che ha recuperato gli avvisi non rilegge', () => {
    const canale = new CanaleFinto();
    monta(canale);

    act(() => canale.emetti('connect'));
    canale.recovered = true;
    act(() => canale.emetti('connect'));
    passa();

    expect(invalida).not.toHaveBeenCalled();
  });

  it('smontando la pagina toglie gli ascoltatori', () => {
    const canale = new CanaleFinto();
    const { unmount } = monta(canale);
    expect(canale.quanti(EVENTO_DATI_CAMBIATI)).toBe(1);

    unmount();

    expect(canale.quanti(EVENTO_DATI_CAMBIATI)).toBe(0);
    expect(canale.quanti('connect')).toBe(0);
  });

  it('senza canale non fa niente', () => {
    function SenzaCanale() {
      useAggiornamentoDati(null);
      return null;
    }
    const router = createMemoryRouter([{ path: '/', element: <SenzaCanale /> }]);

    expect(() => render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)).not.toThrow();
  });
});
