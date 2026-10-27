// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));

import routes from ".";

const rotta = (percorso: string) => matchRoutes(routes, percorso)!.at(-1)!;

describe("vecchio indirizzo della pubblicazione del kit", () => {
  it("porta al dettaglio del kit, dove si gestisce la pubblicazione", async () => {
    const corrispondenza = rotta("/promozioni/in-corso/dettagli/p1/kits/k1/dettagli-pubblicazione");
    const route = corrispondenza.route as RouteObject;

    expect(route.lazy).toBeUndefined();
    const risposta = (await (route.loader as any)({ params: corrispondenza.params })) as Response;

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/promozioni/in-corso/dettagli/p1/kits/k1");
  });

  it("l'indirizzo del dettaglio del kit resta una pagina", () => {
    const route = rotta("/promozioni/in-corso/dettagli/p1/kits/k1").route as RouteObject;

    expect(route.path).toBe("promozioni/in-corso/dettagli/:idPromo/kits/:idKit");
    expect(route.lazy).toBeDefined();
  });
});
