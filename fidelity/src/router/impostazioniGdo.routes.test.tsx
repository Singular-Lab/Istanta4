// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));

import routes from ".";

const corrispondenze = (percorso: string) => matchRoutes(routes, percorso)!;
const rotta = (percorso: string) => corrispondenze(percorso).at(-1)!.route as RouteObject;

type LoaderDiProva = (args: { request: Request; params: Record<string, string | undefined> }) => Promise<Response>;

const vaiA = async (indirizzo: string) => {
  const ultima = corrispondenze(new URL(indirizzo).pathname).at(-1)!;
  return (ultima.route.loader as LoaderDiProva)({
    request: new Request(indirizzo),
    params: ultima.params,
  });
};

describe("Impostazioni GDO e Workspace WebPliant", () => {
  it("Impostazioni GDO e Workspace WebPliant sono pagine del layout", () => {
    expect(rotta("/impostazioni-gdo").path).toBe("impostazioni-gdo");
    expect(rotta("/impostazioni-gdo").lazy).toBeDefined();
    expect(rotta("/webliant/workspace").path).toBe("webliant/workspace");
    expect(rotta("/webliant/workspace").lazy).toBeDefined();
  });

  it("l'editor del workspace è a schermo intero, fuori dal layout", () => {
    const [prima] = corrispondenze("/webliant/workspace/editor");
    expect(prima.route.path).toBe("webliant/workspace/editor");
    expect(prima.route.lazy).toBeDefined();
  });

  it("la vecchia pagina dei workspace porta a Workspace WebPliant", async () => {
    const risposta = await vaiA("http://localhost/webliant/impostazioni-webpliant");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/webliant/workspace");
  });

  it("la vecchia configurazione WebPliant porta alle Impostazioni GDO", async () => {
    const risposta = await vaiA("http://localhost/webliant/impostazioni-webpliant/configurazione-webpliant");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/impostazioni-gdo");
  });

  it("il vecchio indirizzo dell'editor apre il nuovo editor con lo stesso workspace", async () => {
    const risposta = await vaiA("http://localhost/webliant/impostazioni-webpliant/workspace?id=ws-1");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/webliant/workspace/editor?id=ws-1");
  });
});
