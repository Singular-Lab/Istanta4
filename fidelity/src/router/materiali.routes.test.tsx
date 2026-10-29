// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paginaPer } from "../../lib/accessi/pagine";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));
vi.mock("../../lib/server_call", () => ({ ServerCall: { get: finti.get, getUrl: () => "" } }));
// Basta l'identità dei componenti, non serve caricare le pagine vere
vi.mock("@/pages/VolantiniKit", () => ({ default: function VolantiniKit() { return null; } }));
vi.mock("@/pages/PopMateriali", () => ({ default: function PopMateriali() { return null; } }));

import routes from ".";

type Loader = (argomenti: { request: Request; params: Record<string, string | undefined> }) => unknown;

const corrispondenze = (percorso: string) => matchRoutes(routes, percorso)!;
const rotta = (percorso: string) => corrispondenze(percorso).at(-1)!.route as RouteObject;

const vaiA = async (indirizzo: string) => {
  const ultima = corrispondenze(new URL(indirizzo).pathname).at(-1)!;
  return (await (ultima.route.loader as Loader)({ request: new Request(indirizzo), params: ultima.params })) as Response;
};

describe("viste Volantini e POP", () => {
  beforeEach(() => {
    finti.get.mockReset();
  });

  it.each([
    ["/volantini/in-corso", "in-corso", "VolantiniKit"],
    ["/volantini/attivi", "attivi", "VolantiniKit"],
    ["/volantini/storico", "storico", "VolantiniKit"],
    ["/pop/in-corso", "in-corso", "PopMateriali"],
    ["/pop/attivi", "attivi", "PopMateriali"],
    ["/pop/storico", "storico", "PopMateriali"],
  ])("%s apre la sua pagina con il periodo %s, con il permesso dei materiali", async (percorso, periodo, pagina) => {
    const route = rotta(percorso);
    const { Component } = await (route.lazy as () => Promise<Partial<RouteObject>>)();

    expect(route.path).toBe(percorso.slice(1));
    expect(Component?.name).toBe(pagina);
    expect(await (route.loader as Loader)({ request: new Request(`http://localhost${percorso}`), params: {} })).toEqual({ periodo });
    expect(paginaPer(percorso)?.permesso).toBe("materiali.visualizza");
  });

  it("le pagine dei volantini che c'erano già restano le stesse", () => {
    expect(rotta("/volantini").path).toBe("volantini");
    expect(rotta("/volantini/tutti_i_volantini").path).toBe("volantini/tutti_i_volantini");
    expect(rotta("/storico-volantini").path).toBe("storico-volantini");
  });

  it("un periodo inesistente non apre nessuna vista", () => {
    expect(rotta("/volantini/futuri").path).toBe("*");
    expect(rotta("/pop/futuri").path).toBe("*");
  });

  it("/pop da solo apre il periodo in corso", async () => {
    const risposta = await vaiA("http://localhost/pop");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/pop/in-corso");
  });

  it.each([
    ["/materiali-in-corso", "/volantini/in-corso"],
    ["/materiali-attivi", "/volantini/attivi"],
    ["/storico-materiali", "/volantini/storico"],
  ])("il vecchio indirizzo %s porta a %s", async (vecchio, nuovo) => {
    const risposta = await vaiA(`http://localhost${vecchio}`);

    expect(rotta(vecchio).lazy).toBeUndefined();
    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe(nuovo);
  });

  it.each([
    ["in-corso", "IN_LAVORAZIONE", "/volantini/in-corso?promo=p1"],
    ["in-corso", "VALIDA", "/volantini/attivi?promo=p1"],
    ["storico", "VALIDA_CON_ERRORI", "/volantini/attivi?promo=p1"],
    ["storico", "ARCHIVIATA", "/volantini/storico?promo=p1"],
  ])("i materiali di una promo (dal dettaglio %s, stato %s) portano ai volantini del suo periodo", async (sezione, stato, atteso) => {
    finti.get.mockResolvedValue({ id: "p1", nome: "Ottobre", stato });

    const risposta = await vaiA(`http://localhost/promozioni/${sezione}/dettagli/p1/materiali`);

    expect(finti.get).toHaveBeenCalledWith("/promo/p1");
    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe(atteso);
  });

  it("i materiali di una promo eliminata riportano al suo dettaglio", async () => {
    finti.get.mockResolvedValue({ id: "p1", nome: "Ottobre", stato: "ELIMINATA" });

    const risposta = await vaiA("http://localhost/promozioni/in-corso/dettagli/p1/materiali");

    expect(risposta.headers.get("Location")).toBe("/promozioni/in-corso/dettagli/p1");
  });

  it("se la promo non si legge si torna al dettaglio da cui si veniva", async () => {
    finti.get.mockRejectedValue(new Error("Promo not found"));

    const risposta = await vaiA("http://localhost/promozioni/storico/dettagli/p1/materiali");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/promozioni/storico/dettagli/p1");
  });
});
