// @vitest-environment jsdom
import type { RouteObject } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));
vi.mock("../../lib/server_call", () => ({ ServerCall: { get: finti.get, getUrl: () => "" } }));

import routes from ".";

const indirizzoPrincipale = async () => {
  const indice = routes.find((r) => r.index) as RouteObject;
  return (await (indice.loader as () => Promise<Response>)()) as Response;
};

describe("indirizzo principale", () => {
  beforeEach(() => {
    finti.get.mockReset();
  });

  it("porta alla pagina iniziale del menu dell'utente", async () => {
    finti.get.mockResolvedValue({ percorso: "/category/dashboard" });

    const risposta = await indirizzoPrincipale();

    expect(finti.get).toHaveBeenCalledWith("/menu/pagina-iniziale");
    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/category/dashboard");
  });

  it.each([
    ["senza pagina iniziale", { percorso: null }],
    ["con un indirizzo esterno", { percorso: "//sito-esterno.example/x" }],
    ["con un indirizzo non relativo", { percorso: "https://sito-esterno.example" }],
  ])("%s porta alla panoramica dei volantini", async (_caso, risposta) => {
    finti.get.mockResolvedValue(risposta);

    expect((await indirizzoPrincipale()).headers.get("Location")).toBe("/gdo/dashboard");
  });

  it("se la richiesta fallisce, sessione scaduta compresa, porta alla panoramica dei volantini", async () => {
    finti.get.mockRejectedValue(new Error("401"));

    expect((await indirizzoPrincipale()).headers.get("Location")).toBe("/gdo/dashboard");
  });
});
