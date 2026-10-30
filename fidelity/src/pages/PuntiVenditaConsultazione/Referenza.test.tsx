// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATO_PROMO } from "../../../lib/enums";
import type { DettaglioReferenzaPv, PresenzaReferenza } from "../../../lib/puntiVendita/analisi";

// Una referenza nei volantini del punto vendita (/punti-vendita/:id/referenze/:chiave): prezzi,
// posizione nella pagina, dati con la fonte, numeri, prezzo nel tempo e presenze

const finti = vi.hoisted(() => ({
  referenza: {} as Record<string, unknown>,
  richieste: [] as Array<[string, string]>,
}));

vi.mock("@/components/SessionChecker", () => ({ default: <P extends object>(Componente: ComponentType<P>) => Componente }));
vi.mock("@/query/query", () => ({
  useFetchReferenzaPuntoVendita: (idPv: string, chiave: string) => {
    finti.richieste.push([idPv, chiave]);
    return finti.referenza;
  },
  useFetchPuntoVenditaConsultazione: () => ({ data: { id: "pv1", nome: "Conad Lucca" }, isLoading: false, isError: false }),
}));

import ReferenzaPuntoVendita from "./Referenza";

const SUPERSTORE = { id: "c2", nome: "Conad Superstore" };
const TOSCANA = { id: "a1", nome: "Toscana" };

const presenza = (idKit: string, dal: string, dati: Partial<PresenzaReferenza>): PresenzaReferenza => ({
  idKit,
  promo: { id: `p-${idKit}`, nome: `Promo ${idKit}`, stato: STATO_PROMO.ARCHIVIATA },
  canale: SUPERSTORE,
  area: TOSCANA,
  dal,
  al: null,
  pagina: 2,
  spazio: 26,
  meccanica: "sconto",
  prezzo: 1.69,
  barrato: 2.95,
  sottocosto: false,
  ...dati,
});

const REFERENZA: DettaglioReferenzaPv = {
  chiave: "mozzarella-granarolo",
  nome: "Mozzarella Alta Qualità",
  marca: "Granarolo",
  formato: "conf. 100 g × 3",
  tipo: null,
  foto: ["guid-foto-1"],
  prezzo: 1.69,
  barrato: 2.95,
  sconto: 42.7,
  prezzoAlKg: "al kg da € 9,83 a € 5,63",
  meccanica: "fidelity",
  punti: "3 bollini con 2 pezzi",
  dati: {
    codice: "4969665",
    ean: "8002670012345",
    reparto: "LS · Latticini e salumi",
    settore: "Freschi",
    segmento: null,
    ruolo: null,
    tema: null,
    fonte: "db1",
  },
  posizione: {
    idKit: "k3",
    pagina: 2,
    pagine: 24,
    box: { x: 0.04, y: 0.03, w: 0.6, h: 0.4 },
    spazio: 26,
    referenzeNelBox: 1,
    altriBox: [{ x: 0.66, y: 0.03, w: 0.3, h: 0.2 }],
    proporzione: 210 / 297,
  },
  numeri: {
    volantini: 23,
    primoVolantino: "2021-03-08",
    prezzoMinimo: { prezzo: 1.49, dal: "2023-06-12", sottocosto: true },
    prezzoAttuale: 1.69,
    giorniFraPresenze: 38,
  },
  presenze: [
    presenza("k3", "2026-10-23", { al: "2026-11-05", meccanica: "fidelity" }),
    presenza("k2", "2026-08-28", { pagina: 5, spazio: 9, prezzo: 1.99, barrato: 2.89 }),
    presenza("k1", "2023-06-12", { pagina: 3, spazio: 12, meccanica: "sottocosto", prezzo: 1.49, barrato: 2.89, sottocosto: true }),
  ],
};

const caricato = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

function Volantino() {
  const posizione = useLocation();
  return <div>Volantino {posizione.pathname + posizione.search}</div>;
}

const apri = () =>
  render(
    <MemoryRouter initialEntries={["/punti-vendita/pv1/referenze/mozzarella-granarolo"]}>
      <Routes>
        <Route path="/punti-vendita/:id/referenze/:chiave" element={<ReferenzaPuntoVendita />} />
        <Route path="/punti-vendita/:id/volantini/:idKit" element={<Volantino />} />
        <Route path="/punti-vendita/:id" element={<div>Scheda del punto vendita</div>} />
      </Routes>
    </MemoryRouter>
  );

const sezione = (titolo: string) => screen.getByRole("region", { name: titolo });

describe("Referenza nei volantini del punto vendita", () => {
  beforeEach(() => {
    finti.referenza = caricato(REFERENZA);
    finti.richieste = [];
  });

  it("chiede la referenza per la chiave; il percorso è solo nel breadcrumb della barra, non nella pagina", () => {
    apri();

    expect(finti.richieste.at(-1)).toEqual(["pv1", "mozzarella-granarolo"]);
    expect(screen.queryByRole("navigation", { name: "Percorso" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna al punto vendita" })).toHaveAttribute("href", "/punti-vendita/pv1");
  });

  it("nome, marca e formato; foto dalla miniatura di Olimpo", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Mozzarella Alta Qualità" })).toBeInTheDocument();
    expect(screen.getByText("Granarolo · conf. 100 g × 3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto di Mozzarella Alta Qualità" })).toHaveAttribute(
      "src",
      "/olimpo/foto/getThumbNailOnDemand?guidId=guid-foto-1&performante=true"
    );
  });

  it("prezzi: offerta, barrato, sconto e prezzo al kg come stampato; meccanica e punti", () => {
    apri();

    const prezzi = screen.getByLabelText("Prezzi");
    expect(prezzi).toHaveTextContent("€ 1,69");
    expect(prezzi).toHaveTextContent("invece di € 2,95");
    expect(prezzi).toHaveTextContent("−42,7%");
    expect(prezzi).toHaveTextContent("al kg da € 9,83 a € 5,63");
    const scheda = sezione("La referenza");
    expect(scheda).toHaveTextContent("Prezzo Fidelity");
    expect(scheda).toHaveTextContent("3 bollini con 2 pezzi");
  });

  it("nel volantino: la pagina con il box evidenziato, i numeri e il link alla pagina", () => {
    apri();

    const scheda = sezione("La referenza");
    const miniatura = within(scheda).getByRole("img", { name: "Posizione del box nella pagina 2" });
    expect(miniatura.querySelectorAll("rect")).toHaveLength(2);
    expect(miniatura.querySelectorAll("[data-evidenziato]")).toHaveLength(1);
    expect(scheda).toHaveTextContent("2 di 24");
    expect(scheda).toHaveTextContent("26% della pagina");
    expect(scheda).toHaveTextContent("con 1 referenza");
    expect(within(scheda).getByRole("link", { name: /Apri la pagina/ })).toHaveAttribute(
      "href",
      "/punti-vendita/pv1/volantini/k3?pagina=2&referenza=mozzarella-granarolo"
    );
  });

  it("dati della referenza con la fonte; solo quelli che ci sono", () => {
    apri();

    const scheda = sezione("La referenza");
    expect(scheda).toHaveTextContent("Fonte: DB1");
    expect(scheda).toHaveTextContent("Codice4969665");
    expect(scheda).toHaveTextContent("RepartoLS · Latticini e salumi");
    expect(scheda).not.toHaveTextContent("Segmento");
    expect(scheda).not.toHaveTextContent("Riconosciuta dal testo stampato");
  });

  it("riconosciuta solo dal testo stampato: lo dice, con la fonte", () => {
    finti.referenza = caricato({ ...REFERENZA, dati: { ...REFERENZA.dati, codice: null, ean: null, reparto: null, settore: null, fonte: "testo" } });
    apri();

    const scheda = sezione("La referenza");
    expect(scheda).toHaveTextContent("Fonte: Testo stampato");
    expect(scheda).toHaveTextContent("Codice—");
    expect(scheda).toHaveTextContent("Riconosciuta dal testo stampato");
  });

  it("numeri: volantini, prezzo più basso con la data e il sottocosto, prezzo di adesso, giorni fra le presenze", () => {
    apri();

    const numeri = screen.getByLabelText("La referenza in numeri");
    expect(numeri).toHaveTextContent("volantini di questo punto vendita");
    expect(numeri).toHaveTextContent("dal mar 2021");
    expect(numeri).toHaveTextContent("€ 1,49");
    expect(numeri).toHaveTextContent("giu 2023, sottocosto");
    expect(numeri).toHaveTextContent("€ 0,20 sopra il minimo");
    expect(numeri).toHaveTextContent("38 gg");
  });

  it("numeri: con più di un numero la striscia sta in testa alla colonna dei grafici, fuori dal riquadro della referenza", () => {
    apri();

    const numeri = screen.getByLabelText("La referenza in numeri");
    expect(sezione("La referenza")).not.toContainElement(numeri);
    expect(numeri.querySelectorAll(":scope > div")).toHaveLength(4);
  });

  it("numeri: senza prezzi stampati e con una presenza sola restano i volantini, in una riga sotto i prezzi e senza celle N/D", () => {
    finti.referenza = caricato({
      ...REFERENZA,
      numeri: { ...REFERENZA.numeri, prezzoMinimo: null, prezzoAttuale: null, giorniFraPresenze: null },
    });
    apri();

    const numeri = screen.getByLabelText("La referenza in numeri");
    // Un numero solo non ha il suo riquadro largo quanto la colonna: sta nel riquadro della referenza
    expect(sezione("La referenza")).toContainElement(numeri);
    expect(numeri).toHaveTextContent("volantini di questo punto vendita23· dal mar 2021");
    expect(numeri).not.toHaveTextContent("N/D");
    expect(numeri).not.toHaveTextContent("prezzo più basso");
    expect(numeri).not.toHaveTextContent("fra due presenze");
  });

  it("prezzo nel tempo: offerta e barrato su un asse in euro, legenda con il sottocosto e i dati in tabella", () => {
    const { container: pagina } = apri();

    const prezzo = sezione("Prezzo nel tempo");
    expect(within(prezzo).getByRole("img", { name: "Prezzo della referenza nel tempo" })).toBeInTheDocument();
    const legenda = within(prezzo).getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Prezzo in offerta", "Prezzo barrato", "Sottocosto"]);
    const tabella = within(prezzo).getByRole("table", { name: "Prezzo della referenza nel tempo" });
    expect(within(tabella).getAllByRole("row")).toHaveLength(4);
    expect(within(tabella).getByRole("rowheader", { name: "12 giu 2023" }).closest("tr")).toHaveTextContent("€ 1,49€ 2,89sì");

    fireEvent.mouseMove(pagina.querySelector(`[data-x="${Date.UTC(2026, 7, 28)}"]`)!);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("28 ago 2026");
    expect(tooltip).toHaveTextContent("Prezzo in offerta€ 1,99");
    expect(tooltip).toHaveTextContent("Prezzo barrato€ 2,89");
    expect(tooltip).toHaveTextContent("VolantinoPromo k2");
  });

  it("senza prezzi stampati il grafico lascia il posto allo stato vuoto", () => {
    finti.referenza = caricato({ ...REFERENZA, presenze: REFERENZA.presenze.map(p => ({ ...p, prezzo: null, barrato: null })) });
    apri();

    expect(sezione("Prezzo nel tempo")).toHaveTextContent("Nessun prezzo");
  });

  it("presenze dalla più recente: ognuna apre il volantino alla pagina della referenza", async () => {
    apri();

    const righe = within(within(sezione("In quali volantini")).getByRole("table")).getAllByRole("row").slice(1);
    expect(righe).toHaveLength(3);
    expect(righe[0]).toHaveTextContent("Promo k3");
    expect(righe[0]).toHaveTextContent("23 ottobre – 5 novembre 2026Conad Superstore · Toscana");
    expect(righe[2]).toHaveTextContent("sottocosto");
    expect(within(righe[0]).getByRole("link", { name: "Promo k3" })).toHaveAttribute(
      "href",
      "/punti-vendita/pv1/volantini/k3?pagina=2&referenza=mozzarella-granarolo"
    );

    await userEvent.click(within(righe[1]).getByText("9%"));

    expect(screen.getByText("Volantino /punti-vendita/pv1/volantini/k2?pagina=5&referenza=mozzarella-granarolo")).toBeInTheDocument();
  });

  it("le varianti per area della stessa promo non sono righe uguali: ognuna dice la sua area", () => {
    const promo = { id: "p-sos", nome: "A2623_SC_30-10-26_SOS", stato: STATO_PROMO.ARCHIVIATA };
    const variante = (idKit: string, area: { id: string; nome: string }) =>
      presenza(idKit, "2026-10-26", { promo, area, canale: { id: "c3", nome: "City" }, al: "2026-11-12", pagina: 22, spazio: 4 });
    finti.referenza = caricato({ ...REFERENZA, presenze: [variante("k-em", { id: "a-em", nome: "Emilia" }), variante("k-li", { id: "a-li", nome: "Liguria" }), variante("k-pi", { id: "a-pi", nome: "Piemonte" })] });
    apri();

    const righe = within(within(sezione("In quali volantini")).getByRole("table")).getAllByRole("row").slice(1);
    expect(righe.map(riga => within(riga).getByText(/^City · /).textContent)).toEqual(["City · Emilia", "City · Liguria", "City · Piemonte"]);
    expect(within(righe[1]).getByRole("link", { name: "A2623_SC_30-10-26_SOS" })).toHaveAttribute(
      "href",
      "/punti-vendita/pv1/volantini/k-li?pagina=22&referenza=mozzarella-granarolo"
    );
  });

  it("una referenza che non compare nei volantini del punto vendita: \"Referenza non trovata\"", () => {
    finti.referenza = { data: undefined, isLoading: false, isError: true, error: Object.assign(new Error("Non trovata"), { httpStatus: 404 }), refetch: vi.fn() };
    apri();

    expect(screen.getByText("Referenza non trovata")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna al punto vendita" })).toHaveAttribute("href", "/punti-vendita/pv1");
  });
});
