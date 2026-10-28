import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes } from '../../../../lib/errors/ErrorCodes';
import { ExternalApiError } from '../../../../lib/errors/infrastructure/ExternalApiError';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { OidcService, TIMEOUT_SCAMBIO_TOKEN_MS } from '../OidcService';

const fetchFinto = vi.fn();
vi.stubGlobal('fetch', fetchFinto);

const PROVIDER = {
  codice: 'entra_id',
  tipo: 'oidc',
  config_client: { client_id: 'c', redirect_uri: 'https://fidelity.esempio.it/cb' },
  config_server: { token_url: 'https://idp.esempio.it/token', client_secret: 'in-chiaro' },
} as any;

const scambia = () => new OidcService().exchangeCodeForTokens(PROVIDER, 'code-monouso', 'verifier').catch((e) => e);

afterEach(() => {
  fetchFinto.mockReset();
  vi.restoreAllMocks();
});

describe('OidcService.exchangeCodeForTokens', () => {
  it('scambia il code con una sola chiamata POST', async () => {
    fetchFinto.mockResolvedValueOnce(new Response(JSON.stringify({ id_token: 't' }), { status: 200 }));

    await expect(new OidcService().exchangeCodeForTokens(PROVIDER, 'code-monouso', 'verifier')).resolves.toEqual({ id_token: 't' });
    expect(fetchFinto).toHaveBeenCalledWith('https://idp.esempio.it/token', expect.objectContaining({ method: 'POST' }));
  });

  it('se il provider non risponde entro 10 secondi: errore chiaro e un solo tentativo', async () => {
    // La scadenza scatta subito: fetch viene annullata come allo scadere dei 10 s
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort(new DOMException('scaduto', 'TimeoutError')));
    fetchFinto.mockImplementation(async (_url: string, init: RequestInit) => { throw init.signal?.reason; });

    const errore = await scambia();

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toMatch(/non ha risposto entro 10 secondi/);
    expect(errore.details).toMatchObject({ errorCode: ErrorCodes.OIDC_CALLBACK_FAILED, motivo: 'timeout' });
    expect(timeout).toHaveBeenCalledWith(TIMEOUT_SCAMBIO_TOKEN_MS);
    expect(TIMEOUT_SCAMBIO_TOKEN_MS).toBe(10_000);
    expect(fetchFinto).toHaveBeenCalledOnce();
  });

  it('connessione caduta: nessun nuovo tentativo, il code vale una volta sola', async () => {
    fetchFinto.mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }));

    const errore = await scambia();

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toMatch(/non e' raggiungibile/);
    expect(fetchFinto).toHaveBeenCalledOnce();
  });

  it('un 503 del provider non viene ritentato', async () => {
    fetchFinto.mockResolvedValue(new Response('occupato', { status: 503 }));

    const errore = await scambia();

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toMatch(/Token exchange fallito: 503/);
    expect(fetchFinto).toHaveBeenCalledOnce();
  });
});
