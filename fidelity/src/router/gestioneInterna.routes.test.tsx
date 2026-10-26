// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));

import routes from ".";

const corrispondenze = (percorso: string) => matchRoutes(routes, percorso)!;
const rotta = (percorso: string) => corrispondenze(percorso).at(-1)!.route as RouteObject;

const vaiA = async (indirizzo: string) => {
  const ultima = corrispondenze(new URL(indirizzo).pathname).at(-1)!;
  const risposta = (await (ultima.route.loader as any)({
    request: new Request(indirizzo),
    params: ultima.params,
  })) as Response;
  return risposta;
};

describe("gestione interna", () => {
  it.each([
    "/gestione-interna/aree-e-canali",
    "/gestione-interna/punti-vendita",
    "/gestione-interna/punti-vendita/42",
    "/gestione-interna/gestione-utenti",
    "/gestione-interna/gestione-hub",
    "/gestione-interna/gestione-metodi-accesso",
    "/gestione-interna/gestione-permessi",
  ])("%s apre la sua pagina", (percorso) => {
    expect(rotta(percorso).lazy).toBeDefined();
  });

  it("il vecchio indirizzo porta al nuovo e conserva la query", async () => {
    const risposta = await vaiA("http://localhost/gestione-utenti?userId=u-1");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/gestione-interna/gestione-utenti?userId=u-1");
  });

  it("il dettaglio di un punto vendita porta al nuovo dettaglio", async () => {
    const risposta = await vaiA("http://localhost/punti-vendita/42");

    expect(risposta.headers.get("Location")).toBe("/gestione-interna/punti-vendita/42");
  });

  it("un percorso solo simile non viene reindirizzato", () => {
    expect(rotta("/punti-vendita-bis").path).toBe("*");
  });
});
