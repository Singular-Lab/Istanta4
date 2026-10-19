// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));
// Basta l'identità del componente, non serve caricare la pagina vera
vi.mock("@/pages/DettaglioKit", () => ({ default: function DettaglioKit() { return null; } }));

import routes from ".";

const caricaRotta = async (percorso: string) => {
  const route = matchRoutes(routes, percorso)!.at(-1)!.route as RouteObject;
  return (route.lazy as () => Promise<Partial<RouteObject>>)();
};

describe("rotta del kit POP", () => {
  it("apre DettaglioKit con lo stesso loader dei kit", async () => {
    const { default: DettaglioKit } = await import("@/pages/DettaglioKit");
    const pop = await caricaRotta("/promozioni/in-corso/dettagli/p1/pop/k1");
    const kit = await caricaRotta("/promozioni/in-corso/dettagli/p1/kits/k1");

    expect(pop.Component).toBe(DettaglioKit);
    expect(pop.loader).toBe(kit.loader);
  });
});
