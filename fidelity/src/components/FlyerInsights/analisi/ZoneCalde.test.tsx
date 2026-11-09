// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatNumero } from "@/utils/format";
import { PESI_VISIBILITA, type BoxInsight, type ZoneCalde as DatiZoneCalde } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { spiegazioneVisibilita, vociVisibilita, ZoneCalde } from "./ZoneCalde";

const box = (id: string, campi: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 25,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  visibilita: 50,
  ...campi,
});

const BOX = [
  box("b1", { nome: "Caffè in grani", marca: "Marca A", formato: "1 kg", pagina: 1, visibilita: 100 }),
  box("b2", { nome: "Pasta di semola", pagina: 5, visibilita: 62.4 }),
  box("b3", { nome: "Acqua minerale", pagina: 8, visibilita: 10 }),
];

const dati = (campi: Partial<DatiZoneCalde> = {}): DatiZoneCalde => ({
  boxPiuVisibili: ["b1", "b2", "inesistente"],
  perReparto: [
    { chiave: "01", etichetta: "Drogheria", quotaVisibilita: 45, quotaSpazio: 30 },
    { chiave: "02", etichetta: "Bevande", quotaVisibilita: 10, quotaSpazio: 20 },
  ],
  perMarca: [{ chiave: "MARCA A", etichetta: "Marca A", quotaVisibilita: 20, quotaSpazio: 19 }],
  calore: [],
  pesi: PESI_VISIBILITA,
  ...campi,
});

describe("ZoneCalde", () => {
  it("spiega che la visibilità è una stima, con i pesi della costante e non scritti a mano", () => {
    render(<ZoneCalde zoneCalde={dati()} box={BOX} />);

    const spiegazione = screen.getByText(/La visibilità è una stima/);
    expect(spiegazione).toHaveTextContent(`copertina ${formatNumero(PESI_VISIBILITA.copertina)}`);
    expect(spiegazione).toHaveTextContent(`pagine 2 e 3 ${formatNumero(PESI_VISIBILITA.primaDoppia)}`);
    expect(spiegazione).toHaveTextContent(`ultima pagina ${formatNumero(PESI_VISIBILITA.ultima)}`);
    expect(spiegazione).toHaveTextContent(`altre ${formatNumero(PESI_VISIBILITA.altre)}`);
    expect(spiegazione).toHaveTextContent(`in cima ${formatNumero(PESI_VISIBILITA.alto)}, in fondo ${formatNumero(PESI_VISIBILITA.basso)}`);
  });

  it("i box più visibili, dal primo, con marca, formato, pagina e visibilità", () => {
    render(<ZoneCalde zoneCalde={dati()} box={BOX} />);

    const elenco = within(screen.getByRole("region", { name: "I box più visibili" })).getAllByRole("listitem");
    // L'id che non è fra i box si salta
    expect(elenco).toHaveLength(2);
    expect(elenco[0]).toHaveTextContent("Caffè in grani");
    expect(elenco[0]).toHaveTextContent("Marca A · 1 kg · pagina 1");
    expect(elenco[0]).toHaveTextContent("Visibilità 100");
    expect(elenco[1]).toHaveTextContent("Pasta di semola");
    expect(elenco[1]).toHaveTextContent("pagina 5");
    expect(elenco[1]).toHaveTextContent("Visibilità 62");
  });

  it("affianca visibilità e spazio per reparto e per marca, evidenziando chi è più in vista del suo spazio", () => {
    render(<ZoneCalde zoneCalde={dati()} box={BOX} />);

    const reparti = screen.getByRole("table", { name: "Visibilità e spazio per reparto" });
    const drogheria = within(reparti).getByRole("rowheader", { name: "Drogheria" }).closest("tr")!;
    expect(drogheria).toHaveAttribute("data-evidenziata", "true");
    expect(drogheria).toHaveTextContent("+15 punti");
    expect(within(reparti).getByRole("rowheader", { name: "Bevande" }).closest("tr")).not.toHaveAttribute("data-evidenziata");

    const marche = screen.getByRole("table", { name: "Visibilità e spazio per marca" });
    expect(within(marche).getByRole("rowheader", { name: "Marca A" }).closest("tr")).not.toHaveAttribute("data-evidenziata");
  });

  it("senza posizioni dice che la visibilità non si stima, e spiega comunque come si calcolerebbe", () => {
    render(<ZoneCalde zoneCalde={dati({ boxPiuVisibili: [], perReparto: [], perMarca: [] })} box={BOX} copertura={{ prezzo: 100, marca: 100, reparto: 100, geometria: 0 }} />);

    expect(screen.getByText("Visibilità non stimabile")).toBeInTheDocument();
    expect(screen.getByText(/La visibilità è una stima/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("con la posizione nota solo per pochi box lo dice", () => {
    render(<ZoneCalde zoneCalde={dati()} box={BOX} copertura={{ prezzo: 100, marca: 100, reparto: 100, geometria: 35 }} />);

    expect(screen.getByText(/la posizione nella pagina è nota per il 35% dei box/)).toBeInTheDocument();
  });
});

describe("spiegazioneVisibilita e vociVisibilita", () => {
  it("scrive i pesi che arrivano con i dati", () => {
    const pesi = { ...PESI_VISIBILITA, altre: 0.4 } as unknown as typeof PESI_VISIBILITA;
    expect(spiegazioneVisibilita(pesi)).toContain(`altre ${formatNumero(0.4)}`);
  });

  it("dice se i pesi sono quelli standard o quelli propri del cliente (libreria agenzia)", () => {
    expect(spiegazioneVisibilita(PESI_VISIBILITA)).toContain("con pesi fissi uguali per tutti i volantini");
    const delCliente = spiegazioneVisibilita({ ...PESI_VISIBILITA, copertina: 1.2 });
    expect(delCliente).toContain("con i pesi propri del cliente");
    expect(delCliente).not.toContain("uguali per tutti i volantini");
  });

  it("ordina dalla visibilità più alta", () => {
    expect(
      vociVisibilita([
        { chiave: "a", etichetta: "A", quotaVisibilita: 1, quotaSpazio: 5 },
        { chiave: "b", etichetta: "B", quotaVisibilita: 9, quotaSpazio: 5 },
      ]).map(v => v.id)
    ).toEqual(["b", "a"]);
  });
});
