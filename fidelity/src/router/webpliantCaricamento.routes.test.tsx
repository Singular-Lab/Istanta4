// @vitest-environment jsdom
import { createMemoryRouter, type RouteObject } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

// Loader del volantino restituiti da dentro lazy: React Router aspettava il chunk della pagina,
// poi quello dei loader, poi le API. Dichiarati sulla rotta partono insieme al chunk.

const finti = vi.hoisted(() => {
  let sbloccaPagine: () => void = () => undefined;
  const pagineCaricate = new Promise<void>((resolve) => {
    sbloccaPagine = resolve;
  });
  return { pagineCaricate, sbloccaPagine: () => sbloccaPagine() };
});

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));
vi.mock("@/pages/WebpliantLayout/index", () => ({ default: () => null }));
vi.mock("@/pages/WebpliantLayout/LoadingWebpliant", () => ({ LoadingWebpliant: () => null }));
vi.mock("@/pages/WebPliant", () => ({ default: () => null }));
vi.mock("@/pages/WebPliant/Ricette", () => ({ default: () => null }));

import routes from ".";

type Lazy = () => Promise<Partial<RouteObject>>;

const rotta = (percorso: string) => {
  const webpliant = routes.find((r) => r.path === "/webpliant") as RouteObject;
  return percorso === "/webpliant" ? webpliant : (webpliant.children ?? []).find((r) => r.path === percorso) as RouteObject;
};

const loaderChiamati: string[] = [];

/**
 * La stessa rotta con i chunk delle pagine (lazy) che arrivano solo quando il test li sblocca e,
 * al posto dei loader veri (che chiamerebbero le API), loader che registrano la chiamata. Solo i
 * loader dichiarati sulla rotta restano: quelli dentro lazy arriverebbero insieme al chunk.
 */
const conChunkInRitardo = (route: RouteObject): RouteObject => {
  const lazy = route.lazy as Lazy | undefined;
  return {
    ...route,
    lazy: lazy && (async () => {
      await finti.pagineCaricate;
      const caricata = await lazy();
      return caricata.loader ? { ...caricata, loader: async () => loaderChiamati.push(`${route.path} (da lazy)`) } : caricata;
    }),
    loader: route.loader && (async () => {
      loaderChiamati.push(String(route.path));
      return { rotta: route.path };
    }),
    children: route.children?.map(conChunkInRitardo),
  } as RouteObject;
};

afterEach(() => {
  finti.sbloccaPagine();
});

describe("caricamento della vetrina /webpliant", () => {
  it("aprendo il volantino i loader di layout e pagina partono prima che arrivino i chunk delle pagine", async () => {
    const router = createMemoryRouter([conChunkInRitardo(rotta("/webpliant"))], {
      initialEntries: ["/webpliant/volantino?id=w1&idArea=a1&idCanale=c1"],
    });

    await vi.waitFor(() => expect(loaderChiamati).toEqual(["/webpliant", "volantino"]));
    expect(router.state.initialized).toBe(false);

    finti.sbloccaPagine();
    await vi.waitFor(() => expect(router.state.initialized).toBe(true));
    expect(Object.values(router.state.loaderData)).toEqual([{ rotta: "/webpliant" }, { rotta: "volantino" }]);
    expect(loaderChiamati).toEqual(["/webpliant", "volantino"]);
    router.dispose();
  });

  it.each(["/webpliant", "volantino", "volantino/ricetta"])("il loader di %s e sulla rotta, non dentro lazy", async (percorso) => {
    const route = rotta(percorso);
    expect(typeof route.loader).toBe("function");

    const caricata = await (route.lazy as Lazy)();
    expect(caricata.Component).toBeDefined();
    expect(caricata.loader).toBeUndefined();
  });
});
