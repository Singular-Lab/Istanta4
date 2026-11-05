// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { STATO_PROMO } from "../../../lib/enums";
import type { StatoKitMateriali } from "../../../lib/materiali/tipi";
import type { KitAvanzamento, PromoAvanzamento, TipoKitAvanzamento } from "../../../lib/produzione/avanzamento";

const finti = vi.hoisted(() => ({
  permessi: [] as string[],
  avanzamento: {} as Record<string, unknown>,
  stretto: false,
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.includes(codice) }));
vi.mock("@/components/PuntiVendita/useSchermoStretto", () => ({ useSchermoStretto: () => finti.stretto }));
vi.mock("@/query/query", () => ({ useFetchAvanzamentoProduzione: () => finti.avanzamento }));

import AvanzamentoProduzione from ".";

const kit = (titolo: string, stato: `${StatoKitMateriali}`, tipo: TipoKitAvanzamento = "VOL", altro: Partial<KitAvanzamento> = {}): KitAvanzamento => ({
  id: stato === "NON_AVVIATO" ? null : `kit-${titolo}`,
  idDesign: `design-${titolo}`,
  titolo,
  tipo,
  stato: stato as StatoKitMateriali,
  area: { id: "area-to", nome: "Toscana" },
  canale: { id: "canale-ss", nome: "Superstore" },
  numeroFile: stato === "NON_AVVIATO" ? 0 : 4,
  fileAccettati: 0,
  fileInErrore: 0,
  avviatoIl: stato === "NON_AVVIATO" ? null : "2026-10-28",
  ...altro,
});

const promo = (
  nome: string,
  stato: string,
  giorni: number | null,
  kits: KitAvanzamento[],
  altro: Partial<PromoAvanzamento> = {}
): PromoAvanzamento => ({
  id: `id-${nome}`,
  nome,
  stato: stato as STATO_PROMO,
  validitaDal: "2026-11-05",
  validitaAl: "2026-11-17",
  scadenzaLavorazione: "2026-11-03",
  giorniAllaScadenza: giorni,
  kit: kits,
  nonAvviatiDisponibili: true,
  ...altro,
});

// Come le ordina il server: dalla scadenza della lavorazione più vicina
const PROMOZIONI = [
  promo("LP2681_LAZIO", "IN_RITARDO", -2, [kit("VOL_LZRM", "IN_LAVORAZIONE_CON_ERRORI"), kit("VOL_LZLT", "IN_REVISIONE")]),
  promo("P2682_VOL", "IN_SCADENZA", 4, [
    kit("VOL_CNTO", "PUBBLICATO"),
    kit("POP_A4", "IN_REVISIONE", "POP", { numeroFile: 312, fileAccettati: 290, fileInErrore: 4 }),
    kit("VOL_CNSA", "NON_AVVIATO"),
  ]),
  promo("CAT2685_SDB", "IN_LAVORAZIONE", 9, [kit("VOL_SPAZIO", "IN_LAVORAZIONE")]),
];

const conDati = (promozioni: PromoAvanzamento[]) => {
  finti.avanzamento = { isPending: false, isError: false, isFetching: false, data: { promozioni }, dataUpdatedAt: 0, refetch: vi.fn() };
};

const apri = () =>
  render(
    <MemoryRouter>
      <AvanzamentoProduzione />
    </MemoryRouter>
  );

const elenco = () => screen.getByRole("list", { name: "Promozioni in corso" });
const nomiInElenco = () =>
  within(elenco())
    .getAllByRole("button", { expanded: false })
    .map((riga) => riga.querySelector("span span")?.textContent);
const tessera = (nome: RegExp) => within(screen.getByRole("group", { name: "Da guardare" })).getByRole("button", { name: nome });
/** Il numero grande della tessera. */
const numero = (nome: RegExp) => tessera(nome).querySelector("span")?.textContent;

describe("Avanzamento produzione", () => {
  beforeEach(() => {
    finti.permessi = ["promo.visualizza"];
    finti.stretto = false;
    conDati(PROMOZIONI);
  });

  it("elenca le promo dalla scadenza della lavorazione più vicina, la prima in ritardo, con i kit per stato", () => {
    apri();

    expect(nomiInElenco()).toEqual(["LP2681_LAZIO", "P2682_VOL", "CAT2685_SDB"]);
    const prima = within(elenco()).getAllByRole("listitem")[0];
    expect(within(prima).getByText("In ritardo di 2 giorni")).toBeInTheDocument();
    expect(within(prima).getByRole("img", { name: "Kit per stato: 1 con errori, 1 in revisione" })).toBeInTheDocument();
  });

  it("in testa conta gli elementi da guardare, e sceglierne uno filtra l'elenco; sceglierlo di nuovo toglie il filtro", async () => {
    apri();

    expect(numero(/Kit con errori/)).toBe("1");
    expect(numero(/Kit in revisione/)).toBe("2");
    expect(numero(/Promo in ritardo/)).toBe("1");
    expect(numero(/Scadono entro 7 giorni/)).toBe("1");
    expect(numero(/Kit non avviati/)).toBe("1");

    await userEvent.click(tessera(/Kit con errori/));
    expect(tessera(/Kit con errori/)).toHaveAttribute("aria-pressed", "true");
    expect(nomiInElenco()).toEqual(["LP2681_LAZIO"]);

    await userEvent.click(tessera(/Kit con errori/));
    expect(nomiInElenco()).toEqual(["LP2681_LAZIO", "P2682_VOL", "CAT2685_SDB"]);
  });

  it("filtrando per POP restano le promo con kit POP e i conteggi contano solo quelli", async () => {
    apri();

    await userEvent.click(screen.getByRole("radio", { name: /POP/ }));

    expect(nomiInElenco()).toEqual(["P2682_VOL"]);
    expect(numero(/Kit in revisione/)).toBe("1");
    expect(numero(/Kit con errori/)).toBe("0");
  });

  it("aperta una promo elenca i kit dai più urgenti; quelli avviati aprono il dettaglio di produzione", async () => {
    apri();

    await userEvent.click(within(elenco()).getByRole("button", { name: /P2682_VOL/ }));

    const tabella = screen.getByRole("table", { name: "Kit di P2682_VOL" });
    const righe = within(tabella).getAllByRole("row").slice(1);
    expect(righe.map((riga) => within(riga).getAllByRole("cell")[0].textContent)).toEqual(["POP_A4", "VOL_CNSA", "VOL_CNTO"]);
    expect(within(righe[0]).getByText("290 accettati")).toBeInTheDocument();
    expect(within(righe[0]).getByText("4 in errore")).toBeInTheDocument();
    expect(within(righe[0]).getByRole("link", { name: "Apri il kit POP_A4" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/id-P2682_VOL/kits/kit-POP_A4"
    );
    expect(within(righe[1]).getByText("Da avviare")).toBeInTheDocument();
    expect(within(righe[1]).queryByRole("link")).not.toBeInTheDocument();
  });

  it("senza il permesso sulle promo il kit non ha il collegamento al dettaglio", async () => {
    finti.permessi = [];
    apri();

    await userEvent.click(within(elenco()).getByRole("button", { name: /LP2681_LAZIO/ }));

    expect(within(screen.getByRole("table", { name: "Kit di LP2681_LAZIO" })).queryByRole("link")).not.toBeInTheDocument();
  });

  it("se Istanta non ha risposto la promo lo dice, e mostra i kit avviati", async () => {
    conDati([promo("PE2684", "IN_SCADENZA", 5, [kit("VOL_TO", "IN_LAVORAZIONE")], { nonAvviatiDisponibili: false })]);
    apri();

    expect(screen.getByText(/I kit non ancora avviati non sono disponibili: Istanta non ha risposto/)).toBeInTheDocument();
    await userEvent.click(within(elenco()).getByRole("button", { name: /PE2684/ }));
    expect(within(screen.getByRole("table", { name: "Kit di PE2684" })).getByText("VOL_TO")).toBeInTheDocument();
  });

  it("su schermo stretto i kit diventano schede", async () => {
    finti.stretto = true;
    apri();

    await userEvent.click(within(elenco()).getByRole("button", { name: /LP2681_LAZIO/ }));

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Kit di LP2681_LAZIO" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("senza promozioni in corso lo dice, senza filtri né elementi da guardare", () => {
    conDati([]);
    apri();

    expect(screen.getByText("Nessuna promozione in corso")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Da guardare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Tipo di kit" })).not.toBeInTheDocument();
  });

  it("se il caricamento fallisce mostra l'errore con Riprova", async () => {
    const refetch = vi.fn();
    finti.avanzamento = { isPending: false, isError: true, isFetching: false, error: new Error("Servizio non raggiungibile"), refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Avanzamento non caricato");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });
});
