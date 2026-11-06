// @vitest-environment jsdom
import axios, { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/server_call", () => ({ ServerCall: { getUrl: () => "/api" } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

import { nomeDaIntestazione, scaricaFileConsultazione } from "./scaricaFileConsultazione";

/** Risposta di errore di axios con il corpo come Blob, come arriva con responseType "blob". */
const erroreConCorpo = (status: number, corpo: unknown) => {
  const blob = new Blob([JSON.stringify(corpo)], { type: "application/json" });
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status, statusText: "", data: blob, headers: {}, config: { headers: new AxiosHeaders() },
  });
};

describe("scaricaFileConsultazione", () => {
  let linkCliccati: { href: string; download: string }[];

  beforeEach(() => {
    linkCliccati = [];
    window.URL.createObjectURL = vi.fn(() => "blob:file");
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      linkCliccati.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chiede il file alla consultazione e lo salva con il nome dato dal server", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: new Blob(["%PDF"]),
      headers: { "content-disposition": "attachment; filename=\"volantino.pdf\"; filename*=UTF-8''Volantino%20Natale%20%C3%A8.pdf" },
    });

    await scaricaFileConsultazione("f1", "nome di riserva.pdf");

    expect(get).toHaveBeenCalledWith("/api/consultazione/file/f1", { responseType: "blob" });
    expect(linkCliccati).toEqual([{ href: "blob:file", download: "Volantino Natale è.pdf" }]);
  });

  it("se il server rifiuta lancia il suo motivo e non salva niente", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(erroreConCorpo(404, { message: "File non disponibile: non è di un materiale pubblicato della tua GDO." }));

    await expect(scaricaFileConsultazione("f1")).rejects.toThrow("File non disponibile: non è di un materiale pubblicato della tua GDO.");
    expect(linkCliccati).toEqual([]);
  });

  it("senza motivo dal server dice che manca il permesso o che il download non è riuscito", async () => {
    vi.spyOn(axios, "get").mockRejectedValueOnce(erroreConCorpo(403, {}));
    await expect(scaricaFileConsultazione("f1")).rejects.toThrow("Manca il permesso di scaricare volantini e POP");

    vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("rete"));
    await expect(scaricaFileConsultazione("f1")).rejects.toThrow("Download del file non riuscito");
  });
});

describe("nomeDaIntestazione", () => {
  it("preferisce filename* in UTF-8, poi filename, altrimenti niente", () => {
    expect(nomeDaIntestazione("attachment; filename=\"a.pdf\"; filename*=UTF-8''b%20c.pdf")).toBe("b c.pdf");
    expect(nomeDaIntestazione("attachment; filename=\"a.pdf\"")).toBe("a.pdf");
    expect(nomeDaIntestazione(undefined)).toBeNull();
  });
});
