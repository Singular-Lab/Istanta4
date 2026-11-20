// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HubServiceDTO } from "../../../lib/types";

const finti = vi.hoisted(() => ({
  servizi: [] as unknown[],
  navigate: vi.fn(),
  indirizzoFico: vi.fn(),
}));

vi.mock("../../../lib/server_call", () => ({
  ServerCall: {
    get: vi.fn(async (percorso: string) => {
      if (percorso === "/hub-user-info") return { id: "u1", email: "mario@esempio.it", tipo_utente: "Marketing" };
      if (percorso === "/hub-services") return finti.servizi;
      return [];
    }),
    getUrl: () => "http://fidelity.test/api",
  },
}));
vi.mock("react-router-dom", async importOriginal => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => finti.navigate,
}));
vi.mock("./aperturaFico", () => ({ indirizzoServizioFico: finti.indirizzoFico }));

import ServicesDashboard from ".";
import { dimenticaAccessoAppenaFatto, leggiAccessoAppenaFatto, segnaAccessoAppenaFatto, servizioDaAprireSubito } from "./ingressoDiretto";

/**
 * Spec hub-servizi, "Ingresso diretto con un solo servizio": dopo l'accesso, con un solo servizio da
 * aprire, l'hub ci porta dentro, una volta sola, nella stessa scheda.
 */

const servizio = (campi: Partial<HubServiceDTO>): HubServiceDTO =>
  ({
    id: "s1",
    codice: "suite",
    nome: "Istanta 2 GDO Suite",
    descrizione: "",
    icona: "Layout",
    colore: "#1e3a8a",
    url: "/promo",
    tipo_url: "internal",
    attivo: true,
    in_manutenzione: false,
    in_evidenza: false,
    ordine: 1,
    tipo_utente: "Marketing",
    documents: [],
    videos: [],
    ...campi,
  }) as HubServiceDTO;

const assign = vi.fn();
const open = vi.fn();
const posizioneOriginale = window.location;

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ServicesDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  finti.navigate.mockReset();
  finti.indirizzoFico.mockReset();
  assign.mockReset();
  open.mockReset();
  sessionStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (fatto: FrameRequestCallback) => setTimeout(() => fatto(0), 0));
  vi.stubGlobal("open", open);
  Object.defineProperty(window, "location", { configurable: true, value: { ...posizioneOriginale, assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, value: posizioneOriginale });
});

describe("servizioDaAprireSubito e segno dell'accesso", () => {
  it("c'e' un servizio da aprire subito solo quando l'utente ne puo' aprire esattamente uno", () => {
    expect(servizioDaAprireSubito([servizio({})])?.id).toBe("s1");
    expect(servizioDaAprireSubito([servizio({}), servizio({ id: "s2", in_manutenzione: true }), servizio({ id: "s3", attivo: false })])?.id).toBe("s1");
    expect(servizioDaAprireSubito([servizio({}), servizio({ id: "s2" })])).toBeNull();
    expect(servizioDaAprireSubito([servizio({ attivo: false })])).toBeNull();
    expect(servizioDaAprireSubito([])).toBeNull();
  });

  it("il segno dell'accesso si legge finche' non lo si dimentica", () => {
    expect(leggiAccessoAppenaFatto()).toBe(false);
    segnaAccessoAppenaFatto();
    expect(leggiAccessoAppenaFatto()).toBe(true);
    dimenticaAccessoAppenaFatto();
    expect(leggiAccessoAppenaFatto()).toBe(false);
  });
});

describe("Hub: ingresso diretto con un solo servizio", () => {
  it("dopo l'accesso, con un solo servizio interno, ci entra senza sceglierlo", async () => {
    finti.servizi = [servizio({})];
    segnaAccessoAppenaFatto();
    apri();

    await waitFor(() => expect(finti.navigate).toHaveBeenCalledWith("/promo"));
    expect(leggiAccessoAppenaFatto()).toBe(false);
  });

  it("una volta sola: tornando all'hub l'hub resta", async () => {
    finti.servizi = [servizio({})];
    segnaAccessoAppenaFatto();
    const primo = apri();
    await waitFor(() => expect(finti.navigate).toHaveBeenCalledTimes(1));
    primo.unmount();

    apri();
    expect(await screen.findByText("Istanta 2 GDO Suite")).toBeInTheDocument();
    expect(finti.navigate).toHaveBeenCalledTimes(1);
  });

  it("senza un accesso appena fatto l'hub resta, anche con un solo servizio", async () => {
    finti.servizi = [servizio({})];
    apri();

    expect(await screen.findByText("Istanta 2 GDO Suite")).toBeInTheDocument();
    expect(finti.navigate).not.toHaveBeenCalled();
  });

  it("con due servizi l'utente sceglie dall'hub", async () => {
    finti.servizi = [servizio({}), servizio({ id: "s2", codice: "correggo", nome: "Correggo", url: "https://correggo.test", tipo_url: "external" })];
    segnaAccessoAppenaFatto();
    apri();

    expect(await screen.findByText("Correggo")).toBeInTheDocument();
    await waitFor(() => expect(leggiAccessoAppenaFatto()).toBe(false));
    expect(finti.navigate).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("un unico servizio esterno si apre nella stessa scheda, non in una nuova", async () => {
    finti.servizi = [servizio({ url: "https://correggo.test", tipo_url: "external", nome: "Correggo" })];
    segnaAccessoAppenaFatto();
    apri();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://correggo.test"));
    expect(open).not.toHaveBeenCalled();
  });

  it("un unico servizio con accesso FICO che non si apre lascia l'hub con il motivo", async () => {
    finti.servizi = [servizio({ url: "https://correggo.test", tipo_url: "external_fico", nome: "Correggo" })];
    finti.indirizzoFico.mockResolvedValue({ errore: "Accesso automatico al servizio non riuscito" });
    segnaAccessoAppenaFatto();
    apri();

    expect(await screen.findByText("Accesso automatico al servizio non riuscito")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
