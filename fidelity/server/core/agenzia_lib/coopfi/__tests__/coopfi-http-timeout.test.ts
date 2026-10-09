import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableError } from "../../../../../lib/errors";
import { CoopfiAgenziaLib } from "../index.js";

const BASE = "http://127.0.0.1:5003";
const URL_UTENTI = `${BASE}/commons/utenti-AD/`;

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coopfi: timeout delle chiamate HTTP", () => {
  it("token e dato Coopfi vengono richiesti con un signal di timeout", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(200, { access_token: "t1", expires_in: 3600 }))
      .mockResolvedValueOnce(json(200, [{ nome: "Mario" }]));
    vi.stubGlobal("fetch", fetchMock);
    const lib = new CoopfiAgenziaLib({} as any) as any;

    await lib.fetchWithFibRetry(URL_UTENTI, BASE);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, opzioni] of fetchMock.mock.calls) {
      expect(opzioni.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("timeout sulla richiesta ripetuta dopo il 401: ServiceUnavailableError, non un errore grezzo", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(200, { access_token: "scaduto" }))
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { access_token: "nuovo" }))
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    const lib = new CoopfiAgenziaLib({} as any) as any;

    // Nessun tentativo transitorio residuo: errore subito, senza attese di backoff
    await expect(lib.fetchWithFibRetry(URL_UTENTI, BASE, 0)).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
