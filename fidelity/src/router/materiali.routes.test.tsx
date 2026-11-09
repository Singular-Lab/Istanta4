// @vitest-environment jsdom
import { matchRoutes, type RouteObject } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paginaPer, voceDiMenuPer } from "../../lib/accessi/pagine";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/components/AppErrorFallback", () => ({ RouteErrorFallback: () => null }));
vi.mock("@/components/ErrorPage", () => ({ default: () => null }));
vi.mock("@/components/NotFoundPage", () => ({ default: () => null }));
vi.mock("../../lib/server_call", () => ({ ServerCall: { get: finti.get, getUrl: () => "" } }));
// Basta l'identità dei componenti, non serve caricare le pagine vere
vi.mock("@/pages/VolantiniKit", () => ({ default: function VolantiniKit() { return null; } }));
vi.mock("@/pages/PopMateriali", () => ({ default: function PopMateriali() { return null; } }));
vi.mock("@/pages/PromozioneVolantini", () => ({ default: function PromozioneVolantini() { return null; } }));

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
    ["/volantini/prossimi", "prossimi", "VolantiniKit"],
    ["/volantini/attivi", "attivi", "VolantiniKit"],
    ["/volantini/storico", "storico", "VolantiniKit"],
    ["/pop/prossimi", "prossimi", "PopMateriali"],
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
    expect(rotta("/volantini/tutti_i_volantini").path).toBe("volantini/tutti_i_volantini");
    expect(paginaPer("/volantini/tutti_i_volantini?kit=k1")?.permesso).toBe("materiali.visualizza");
    expect(rotta("/storico-volantini").path).toBe("storico-volantini");
  });

  it("la consultazione di una promozione ha la sua pagina, con il permesso dei materiali", async () => {
    const corrispondenza = corrispondenze("/volantini/promozioni/p1").at(-1)!;
    const { Component } = await (corrispondenza.route.lazy as () => Promise<Partial<RouteObject>>)();

    expect(corrispondenza.route.path).toBe("volantini/promozioni/:idPromo");
    expect(corrispondenza.params.idPromo).toBe("p1");
    expect(Component?.name).toBe("PromozioneVolantini");
    // La voce del dettaglio ha la sua voce nel catalogo, non quella dell'indirizzo /volantini
    expect(paginaPer("/volantini/promozioni/abc")?.percorso).toBe("/volantini/promozioni/:idPromo");
    expect(paginaPer("/volantini/promozioni/abc")?.permesso).toBe("materiali.visualizza");
    expect(paginaPer("/volantini/promozioni/abc")?.sezione).toBe("visualizzazione");
    expect(voceDiMenuPer("/volantini/promozioni/:idPromo")).toBeUndefined();
  });

  it("le viste del periodo restano le loro anche accanto al dettaglio della promozione", () => {
    expect(rotta("/volantini/attivi").path).toBe("volantini/attivi");
    expect(rotta("/volantini/tutti_i_volantini").path).toBe("volantini/tutti_i_volantini");
    // Senza id non è una pagina
    expect(rotta("/volantini/promozioni").path).toBe("*");
  });

  it("un periodo inesistente non apre nessuna vista", () => {
    expect(rotta("/volantini/futuri").path).toBe("*");
    expect(rotta("/pop/futuri").path).toBe("*");
  });

  it("/pop da solo apre i POP delle promozioni valide", async () => {
    const risposta = await vaiA("http://localhost/pop");

    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/pop/attivi");
  });

  it.each([
    ["/volantini/in-corso", "/volantini/prossimi"],
    ["/volantini/in-corso?promo=p%201", "/volantini/prossimi?promo=p%201"],
    ["/pop/in-corso", "/pop/prossimi"],
    ["/pop/in-corso?promo=p1&formato=f1", "/pop/prossimi?promo=p1&formato=f1"],
  ])("il vecchio periodo in corso %s porta a %s, con la promo dell'indirizzo", async (vecchio, nuovo) => {
    const risposta = await vaiA(`http://localhost${vecchio}`);

    expect(rotta(new URL(vecchio, "http://localhost").pathname).lazy).toBeUndefined();
    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe(nuovo);
  });

  it("la vecchia pagina Volantini non c'è più: il suo indirizzo porta a Volantini attivi, fuori dal menu", async () => {
    const risposta = await vaiA("http://localhost/volantini");

    expect(rotta("/volantini").lazy).toBeUndefined();
    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe("/volantini/attivi");
    expect(paginaPer("/volantini")?.permesso).toBe("materiali.visualizza");
    expect(voceDiMenuPer("/volantini")).toBeUndefined();
  });

  it.each([
    ["/materiali-in-corso", "/volantini/prossimi"],
    ["/materiali-attivi", "/volantini/attivi"],
    ["/storico-materiali", "/volantini/storico"],
  ])("il vecchio indirizzo %s porta a %s", async (vecchio, nuovo) => {
    const risposta = await vaiA(`http://localhost${vecchio}`);

    expect(rotta(vecchio).lazy).toBeUndefined();
    expect(risposta.status).toBe(302);
    expect(risposta.headers.get("Location")).toBe(nuovo);
  });

  it.each([
    ["in-corso", "IN_LAVORAZIONE", "/volantini/prossimi?promo=p1"],
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
