import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ID_CLIENT } from '../identificativiRichiesta';
import { ServerCall } from '../server_call';

// Un doppio click su Salva o su Elimina manda una sola richiesta; ogni scrittura porta la sua
// Idempotency-Key e l'identificativo della scheda (X-Client-Id).

type Risposta = { resolve: (corpo: Response) => void };

let inAttesa: Risposta[] = [];
let fetchFinta: ReturnType<typeof vi.fn>;

const ok = (indice: number, corpo: unknown = {}) => inAttesa[indice].resolve(new Response(JSON.stringify(corpo), { status: 200 }));

const intestazioniDi = (chiamata: number): Record<string, string> => {
  const init = fetchFinta.mock.calls[chiamata][1] as { headers: Headers | Record<string, string> };
  const trovate: Record<string, string> = {};
  if (init.headers instanceof Headers) init.headers.forEach((valore, chiave) => { trovate[chiave.toLowerCase()] = valore; });
  else for (const [chiave, valore] of Object.entries(init.headers)) trovate[chiave.toLowerCase()] = String(valore);
  return trovate;
};

beforeEach(() => {
  inAttesa = [];
  fetchFinta = vi.fn(() => new Promise<Response>((resolve) => { inAttesa.push({ resolve }); }));
  vi.stubGlobal('fetch', fetchFinta);
  vi.spyOn(ServerCall, 'ensureCSRFToken').mockResolvedValue(null);
  vi.spyOn(ServerCall, 'getCSRFToken').mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const attendiPartenza = async () => { await vi.waitFor(() => expect(fetchFinta).toHaveBeenCalled()); };

describe.each([
  ['put', (url: string, corpo: object) => ServerCall.put(url, corpo)],
  ['delete', (url: string, corpo: object) => ServerCall.delete(url, corpo)],
  ['patch', (url: string, corpo: object) => ServerCall.patch(url, corpo)],
  ['post', (url: string, corpo: object) => ServerCall.post(url, corpo)],
] as const)('ServerCall.%s', (_nome, invia) => {
  it('due richieste identiche in corso partono una volta sola e ricevono la stessa risposta', async () => {
    const prima = invia('/api/area/1', { nome: 'Nord' });
    const seconda = invia('/api/area/1', { nome: 'Nord' });
    await attendiPartenza();

    expect(fetchFinta).toHaveBeenCalledTimes(1);
    ok(0, { fatto: true });
    expect(await prima).toEqual({ fatto: true });
    expect(await seconda).toEqual({ fatto: true });
  });

  it('un contenuto diverso e\' un\'altra richiesta', async () => {
    const prima = invia('/api/area/1', { nome: 'Nord' });
    const seconda = invia('/api/area/1', { nome: 'Sud' });
    await vi.waitFor(() => expect(fetchFinta).toHaveBeenCalledTimes(2));

    ok(0);
    ok(1);
    await Promise.all([prima, seconda]);
  });

  it('finita la prima, la richiesta successiva riparte', async () => {
    const prima = invia('/api/area/1', { nome: 'Nord' });
    await attendiPartenza();
    ok(0);
    await prima;

    const seconda = invia('/api/area/1', { nome: 'Nord' });
    await vi.waitFor(() => expect(fetchFinta).toHaveBeenCalledTimes(2));
    ok(1);
    await seconda;
  });

  it('manda una Idempotency-Key e l\'identificativo della scheda; la chiave cambia a ogni richiesta', async () => {
    const prima = invia('/api/area/1', { nome: 'Nord' });
    await attendiPartenza();
    ok(0);
    await prima;
    const seconda = invia('/api/area/1', { nome: 'Nord' });
    await vi.waitFor(() => expect(fetchFinta).toHaveBeenCalledTimes(2));
    ok(1);
    await seconda;

    expect(intestazioniDi(0)['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(intestazioniDi(0)['x-client-id']).toBe(ID_CLIENT);
    expect(intestazioniDi(1)['idempotency-key']).not.toBe(intestazioniDi(0)['idempotency-key']);
  });
});
