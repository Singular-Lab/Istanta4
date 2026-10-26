// @vitest-environment jsdom
import { matchRoutes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Le pagine di errore non servono per verificare la struttura delle rotte
vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));

import routes from ".";

describe("rotte dell'anteprima tracciato", () => {
    it.each([
        ["/promozioni/in-corso/dettagli/p1/anteprima-tracciato/t1"],
        ["/promozioni/storico/dettagli/p1/anteprima-tracciato/t1"],
    ])("%s si apre a schermo intero, fuori dal layout principale", percorso => {
        const corrispondenze = matchRoutes(routes, percorso);
        expect(corrispondenze).not.toBeNull();
        expect(corrispondenze).toHaveLength(1);
        expect(corrispondenze![0].route.path).not.toBe("/");
        expect(corrispondenze![0].params).toMatchObject({ idPromo: "p1", idTracciato: "t1" });
    });

    it("i dettagli della promo restano dentro il layout principale", () => {
        const corrispondenze = matchRoutes(routes, "/promozioni/in-corso/dettagli/p1");
        expect(corrispondenze).not.toBeNull();
        expect(corrispondenze![0].route.path).toBe("/");
    });
});
