// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));

import { idPromoDalPercorso } from "@/hooks/usePromoName";
import { opzioniPromo } from "@/query/condivise";
import SmartBreadcrumb from "./SmartBreadcrumb";

const PROMO = "11111111-2222-4333-8444-555555555555";
const KIT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const nuovoClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });

// La pagina del dettaglio promo legge la stessa query del breadcrumb
const PaginaPromo = ({ idPromo }: { idPromo: string }) => {
  const promo = useQuery(opzioniPromo(idPromo));
  return <p>Pagina: {promo.data?.nome ?? "…"}</p>;
};

const apri = (percorso: string, conPagina = false) =>
  render(
    <QueryClientProvider client={nuovoClient()}>
      <MemoryRouter initialEntries={[percorso]}>
        <SmartBreadcrumb />
        {conPagina && <PaginaPromo idPromo={PROMO} />}
      </MemoryRouter>
    </QueryClientProvider>
  );

const chiamatePromo = () => finti.get.mock.calls.filter(([url]) => String(url).startsWith("/promo/"));

describe("SmartBreadcrumb", () => {
  beforeEach(() => {
    sessionStorage.clear();
    finti.get.mockReset();
    finti.get.mockImplementation(async (url: string) => {
      if (url === `/promo/${PROMO}`) return { id: PROMO, nome: "Promo di Natale" };
      throw Object.assign(new Error("Not found"), { httpStatus: 404 });
    });
  });

  it("nel percorso di un kit chiede solo la promo, una volta, e non l'id del kit", async () => {
    apri(`/promozioni/in-corso/dettagli/${PROMO}/kits/${KIT}`);

    expect(await screen.findByText("Promo di Natale")).toBeInTheDocument();
    expect(screen.getByText(`${KIT.substring(0, 8)}...`)).toBeInTheDocument();
    expect(chiamatePromo()).toEqual([[`/promo/${PROMO}`]]);
  });

  it("con la pagina del dettaglio aperta breadcrumb e pagina fanno una sola richiesta della promo", async () => {
    apri(`/promozioni/storico/dettagli/${PROMO}`, true);

    expect(await screen.findByText("Pagina: Promo di Natale")).toBeInTheDocument();
    expect(screen.getByText("Promo di Natale")).toBeInTheDocument();
    expect(chiamatePromo()).toHaveLength(1);
  });

  it("fuori dalle rotte della promo non chiede nulla, anche con UUID nel percorso", async () => {
    apri(`/punti-vendita/${KIT}`);

    expect(screen.getByText(`${KIT.substring(0, 8)}...`)).toBeInTheDocument();
    await waitFor(() => expect(finti.get).not.toHaveBeenCalled());
  });

  it("con il nome già in sessione non chiede nulla", () => {
    sessionStorage.setItem(`promo_${PROMO}`, "Promo salvata");

    apri(`/promozioni/in-corso/dettagli/${PROMO}/kits/${KIT}`);

    expect(screen.getByText("Promo salvata")).toBeInTheDocument();
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("salva in sessione il nome letto, come prima", async () => {
    apri(`/promozioni/in-corso/dettagli/${PROMO}`);

    await screen.findByText("Promo di Natale");

    await waitFor(() => expect(sessionStorage.getItem(`promo_${PROMO}`)).toBe("Promo di Natale"));
  });
});

describe("idPromoDalPercorso", () => {
  it("riconosce l'id che segue promozioni/{in-corso|storico}/dettagli", () => {
    expect(idPromoDalPercorso(["promozioni", "in-corso", "dettagli", PROMO, "kits", KIT])).toBe(PROMO);
    expect(idPromoDalPercorso(["promozioni", "storico", "dettagli", PROMO, "anteprima-tracciato", KIT])).toBe(PROMO);
  });

  it("non considera promo gli UUID di altre rotte né un segmento che non è un UUID", () => {
    expect(idPromoDalPercorso(["punti-vendita", PROMO])).toBeNull();
    expect(idPromoDalPercorso(["promozioni", "altro", "dettagli", PROMO])).toBeNull();
    expect(idPromoDalPercorso(["promozioni", "in-corso", "dettagli", "nuova"])).toBeNull();
  });
});
