// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));

import { idPromoDalPercorso } from "@/hooks/usePromoName";
import { opzioniPromo } from "@/query/condivise";
import {
  useFetchPuntoVenditaConsultazione,
  useFetchPuntoVenditaGestione,
  useFetchReferenzaPuntoVendita,
  useFetchVolantinoPuntoVendita,
} from "@/query/query";
import type { PuntoVenditaResponseDTO } from "../../../server/core/dto";
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

describe("SmartBreadcrumb, etichette dei segmenti", () => {
  it("le sigle restano in maiuscolo e i marchi con la loro grafia", () => {
    apri("/ordini-di-stampa/ods-in-corso");
    expect(screen.getByText("Ordini di stampa")).toBeInTheDocument();
    expect(screen.getByText("ODS in corso")).toBeInTheDocument();
  });

  it("il segmento pop diventa POP, non Pop", () => {
    apri("/pop/storico");
    expect(screen.getByText("POP")).toBeInTheDocument();
    expect(screen.queryByText("Pop")).not.toBeInTheDocument();
    expect(screen.getByText("Storico")).toBeInTheDocument();
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

describe("SmartBreadcrumb nelle pagine dei punti vendita", () => {
  const PV = "33333333-4444-4555-8666-777777777777";
  const VOLANTINO = "99999999-8888-4777-8666-555555555555";
  // La chiave di una referenza non è un UUID e nell'indirizzo è codificata
  const CHIAVE = "d-Y29uZGltZW50byBjb24gdG9ubm8=";

  // Le pagine chiedono i loro dati con le query di query/query.tsx: il breadcrumb legge le stesse
  const PaginaConsultazione = () => {
    useFetchPuntoVenditaConsultazione(PV);
    return null;
  };
  const PaginaVolantino = () => {
    useFetchPuntoVenditaConsultazione(PV);
    useFetchVolantinoPuntoVendita(PV, VOLANTINO);
    return null;
  };
  const PaginaReferenza = () => {
    useFetchPuntoVenditaConsultazione(PV);
    useFetchReferenzaPuntoVendita(PV, CHIAVE);
    return null;
  };
  const PaginaGestione = ({ nome }: { nome: string }) => {
    useFetchPuntoVenditaGestione({ id: PV, nome, nome_display: "" } as PuntoVenditaResponseDTO);
    return null;
  };

  const apriPv = (percorso: string, pagina: ReactNode) =>
    render(
      <QueryClientProvider client={nuovoClient()}>
        <MemoryRouter initialEntries={[percorso]}>
          <SmartBreadcrumb />
          {pagina}
        </MemoryRouter>
      </QueryClientProvider>
    );

  const voci = () => screen.getAllByRole("listitem").map(voce => voce.textContent);

  beforeEach(() => {
    finti.get.mockReset();
    finti.get.mockImplementation(async (url: string) => {
      if (url === `/punti-vendita/${PV}`) return { id: PV, nome: "BOLOGNA SANT'ISAIA 67/2" };
      if (url === `/punti-vendita/${PV}/volantini/${VOLANTINO}`) return { kit: { id: VOLANTINO, titolo: "KIT_01" }, promo: { id: "p1", nome: "Promo di Natale" } };
      if (url === `/punti-vendita/${PV}/referenze/${encodeURIComponent(CHIAVE)}`) return { chiave: CHIAVE, nome: "Condimento con tonno" };
      throw Object.assign(new Error("Not found"), { httpStatus: 404 });
    });
  });

  it("la scheda di consultazione mostra il nome del punto vendita, con la sola richiesta della pagina", async () => {
    apriPv(`/punti-vendita/${PV}`, <PaginaConsultazione />);

    expect(await screen.findByText("BOLOGNA SANT'ISAIA 67/2")).toBeInTheDocument();
    expect(screen.queryByText(`${PV.substring(0, 8)}...`)).not.toBeInTheDocument();
    expect(finti.get).toHaveBeenCalledTimes(1);
  });

  it("un volantino mostra punto vendita e promo, senza il segmento \"Volantini\" che non è una pagina", async () => {
    apriPv(`/punti-vendita/${PV}/volantini/${VOLANTINO}`, <PaginaVolantino />);

    expect(await screen.findByText("Promo di Natale")).toBeInTheDocument();
    await waitFor(() => expect(voci()).toEqual(["FP", "Punti vendita", "BOLOGNA SANT'ISAIA 67/2", "Promo di Natale"]));
    expect(screen.getByRole("link", { name: "BOLOGNA SANT'ISAIA 67/2" })).toHaveAttribute("href", `/punti-vendita/${PV}`);
    expect(finti.get).toHaveBeenCalledTimes(2);
  });

  it("una referenza mostra il nome del prodotto al posto della chiave", async () => {
    apriPv(`/punti-vendita/${PV}/referenze/${encodeURIComponent(CHIAVE)}`, <PaginaReferenza />);

    expect(await screen.findByText("Condimento con tonno")).toBeInTheDocument();
    await waitFor(() => expect(voci()).toEqual(["FP", "Punti vendita", "BOLOGNA SANT'ISAIA 67/2", "Condimento con tonno"]));
  });

  it("su una riga sola: ogni voce si tronca con il nome intero nel title, l'ultima prende lo spazio che resta", async () => {
    apriPv(`/punti-vendita/${PV}/referenze/${encodeURIComponent(CHIAVE)}`, <PaginaReferenza />);

    await screen.findByText("Condimento con tonno");
    const [fp, ...segmenti] = screen.getAllByRole("listitem");
    // FP non si restringe mai
    expect(fp).toHaveClass("flex-none");
    const intermedie = segmenti.slice(0, -1);
    const ultima = segmenti[segmenti.length - 1];
    for (const voce of intermedie) {
      const testo = voce.querySelector("[title]")!;
      expect(testo).toHaveAttribute("title", testo.textContent);
      expect(testo).toHaveClass("truncate");
      // Una larghezza massima, cedono spazio prima dell'ultima; su mobile non ci sono
      expect(voce).toHaveClass("max-w-[11rem]", "shrink-[8]", "max-sm:hidden");
    }
    expect(screen.getByTitle("BOLOGNA SANT'ISAIA 67/2")).toHaveTextContent("BOLOGNA SANT'ISAIA 67/2");
    // L'ultima senza larghezza massima: da sm una riga con i puntini, su mobile al più due righe
    expect(ultima).toHaveClass("min-w-0");
    expect(ultima).not.toHaveClass("max-w-[11rem]");
    expect(screen.getByTitle("Condimento con tonno")).toHaveClass("sm:truncate", "max-sm:line-clamp-2");
  });

  it("la gestione mostra il nome del punto vendita del loader, senza richieste", async () => {
    apriPv(`/gestione-interna/punti-vendita/${PV}`, <PaginaGestione nome="CONAD FIRENZE" />);

    expect(await screen.findByText("CONAD FIRENZE")).toBeInTheDocument();
    expect(voci()).toEqual(["FP", "Gestione interna", "Punti vendita", "CONAD FIRENZE"]);
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("senza i dati della pagina resta l'id abbreviato e il breadcrumb non chiede nulla", async () => {
    apriPv(`/punti-vendita/${PV}`, null);

    expect(screen.getByText(`${PV.substring(0, 8)}...`)).toBeInTheDocument();
    await waitFor(() => expect(finti.get).not.toHaveBeenCalled());
  });
});
