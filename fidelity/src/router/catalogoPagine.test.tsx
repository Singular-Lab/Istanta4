// @vitest-environment jsdom
import type { RouteObject } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { paginaPer } from "../../lib/accessi/pagine";

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));

import routes from ".";

/** Rotte a schermo intero, fuori dal layout, che verificano comunque la sessione e la pagina. */
const PROTETTE_FUORI_DAL_LAYOUT = [
  "/promozioni/in-corso/dettagli/:idPromo/menabo",
  "/promozioni/storico/dettagli/:idPromo/menabo",
  "/promozioni/in-corso/dettagli/:idPromo/anteprima-tracciato/:idTracciato",
  "/promozioni/storico/dettagli/:idPromo/anteprima-tracciato/:idTracciato",
  "webliant/impostazioni-webpliant/workspace",
];

const unisci = (base: string, path?: string) =>
  path === undefined ? base : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

/** Percorsi delle pagine vere (con componente) dentro il layout principale. */
const pagineDelLayout = (nodi: RouteObject[], base: string): string[] =>
  nodi.flatMap((r) => {
    const percorso = unisci(base, r.path);
    const figli = r.children ? pagineDelLayout(r.children, percorso) : [];
    const ePagina = !!(r.lazy || r.Component || r.element) && r.path !== "*" && !r.index;
    return ePagina && r.path !== undefined ? [percorso, ...figli] : figli;
  });

describe("catalogo delle pagine", () => {
  const layout = routes.find((r) => r.path === "/")!;
  const percorsi = [...pagineDelLayout(layout.children ?? [], "/"), ...PROTETTE_FUORI_DAL_LAYOUT];

  it("ogni pagina protetta del router ha una voce nel catalogo dei permessi", () => {
    const mancanti = percorsi.filter((p) => !paginaPer(p.replace(/:[^/]+/g, "x")));
    expect(mancanti).toEqual([]);
  });

  it("le rotte fuori dal layout esistono davvero nel router", () => {
    const radici = routes.map((r) => r.path);
    for (const p of PROTETTE_FUORI_DAL_LAYOUT) expect(radici).toContain(p);
  });
});
