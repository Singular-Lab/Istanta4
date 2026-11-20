// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BarreImpilate100,
  BarreOrizzontali,
  Colonne,
  FasceNelTempo,
  ForbicePrezzo,
  GraficoLinee,
  Heatmap,
  isoData,
  MiniaturaPagina,
  MiniBarre,
  msData,
  MS_GIORNO,
  PaginaVolantino,
  StrisciaNumeri,
  StrisciaPresenze,
  TimelineVolantini,
  tintaCategoria,
  TINTA_NEUTRA,
  type BoxPagina,
  type TracciaTimeline,
} from ".";
import type { BarraTimeline } from "./TimelineVolantini";

// Grafici SVG delle pagine dei punti vendita: valori, etichette, tooltip, legenda, tabella dei dati e dati vuoti

const percento = (v: number) => `${v}%`;

/** Il segno (o la sua area attiva) che contiene un testo del grafico. */
const segnoDi = (grafico: HTMLElement, testo: string) => within(grafico).getByText(testo).closest("g") as Element;

describe("BarreOrizzontali", () => {
  const voci = [
    { id: "conad", etichetta: "Conad", valore: 21.4 },
    { id: "barilla", etichetta: "Barilla", valore: 3.2 },
  ];

  it("etichetta a sinistra, valore in fondo alla barra e i dati anche in tabella", () => {
    render(<BarreOrizzontali voci={voci} titolo="Marche più presenti" descrizioneValore="Quota delle referenze" formatta={percento} />);

    const grafico = screen.getByRole("img", { name: "Marche più presenti" });
    expect(within(grafico).getByText("Conad")).toBeInTheDocument();
    expect(within(grafico).getByText("21.4%")).toBeInTheDocument();
    const tabella = screen.getByRole("table", { name: "Marche più presenti" });
    expect(within(tabella).getAllByRole("row")).toHaveLength(3);
    expect(within(tabella).getByRole("rowheader", { name: "Barilla" })).toBeInTheDocument();
  });

  it("il tooltip dice voce e valore al passaggio del mouse e sparisce uscendo", () => {
    render(<BarreOrizzontali voci={voci} titolo="Marche" descrizioneValore="Quota delle referenze" formatta={percento} />);

    const barra = segnoDi(screen.getByRole("img", { name: "Marche" }), "Barilla");
    fireEvent.mouseMove(barra, { clientX: 10, clientY: 10 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Barilla");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Quota delle referenze3.2%");

    fireEvent.mouseLeave(barra);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("con onSeleziona le barre sono pulsanti, anche da tastiera", () => {
    const onSeleziona = vi.fn();
    render(<BarreOrizzontali voci={voci} titolo="Marche" descrizioneValore="Quota" formatta={percento} onSeleziona={onSeleziona} />);

    fireEvent.click(screen.getByRole("button", { name: "Conad: 21.4%" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Barilla: 3.2%" }), { key: "Enter" });

    expect(onSeleziona.mock.calls).toEqual([["conad"], ["barilla"]]);
  });

  it("senza voci lo dice, senza grafico", () => {
    render(<BarreOrizzontali voci={[]} titolo="Marche" descrizioneValore="Quota" vuoto="Nessuna marca." />);

    expect(screen.getByText("Nessuna marca.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("una voce con la sua tinta ha il colore della sua entità, le altre quello della serie", () => {
    const tinta = tintaCategoria(2);
    render(
      <BarreOrizzontali
        voci={[{ ...voci[0], tinta }, voci[1]]}
        titolo="Insegne"
        descrizioneValore="Punti vendita"
        formatta={percento}
      />
    );

    const grafico = screen.getByRole("img", { name: "Insegne" });
    const conTinta = segnoDi(grafico, "Conad").querySelector("path") as SVGPathElement;
    const senzaTinta = segnoDi(grafico, "Barilla").querySelector("path") as SVGPathElement;
    if (tinta.colore) expect(conTinta.getAttribute("fill")).toBe(tinta.colore);
    expect(senzaTinta.getAttribute("fill")).toBeNull();
  });

  it("riferimento e nota: la tacca sulla riga, la nota dopo il valore, una riga nel tooltip, la legenda e le colonne della tabella", () => {
    const { container } = render(
      <BarreOrizzontali
        voci={[{ ...voci[0], riferimento: 17.3, nota: "+4,1 punti" }, voci[1]]}
        titolo="Marche"
        descrizioneValore="Quota delle referenze"
        formatta={percento}
        nomeRiferimento="nel 2024"
      />
    );

    const grafico = screen.getByRole("img", { name: "Marche" });
    // Una tacca sola: Barilla non ha riferimento
    expect(container.querySelectorAll("[data-riferimento]")).toHaveLength(1);
    expect(container.querySelector('[data-riferimento="conad"]')).toBeInTheDocument();
    expect(within(grafico).getByText("+4,1 punti")).toBeInTheDocument();

    fireEvent.mouseMove(segnoDi(grafico, "Conad"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Quota delle referenze21.4%");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Nel 202417.3%");

    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["valore nel 2024"]);
    const tabella = screen.getByRole("table", { name: "Marche" });
    expect(within(tabella).getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Voce", "Quota delle referenze", "Nel 2024", "Nota"]);
    expect(within(tabella).getByRole("rowheader", { name: "Conad" }).closest("tr")).toHaveTextContent("Conad21.4%17.3%+4,1 punti");
    expect(within(tabella).getByRole("rowheader", { name: "Barilla" }).closest("tr")).toHaveTextContent("Barilla3.2%—");
  });

  it("la scala comprende il riferimento: una tacca oltre il valore più alto resta nel grafico e il valore va dopo la tacca", () => {
    const { container } = render(
      <BarreOrizzontali voci={[{ id: "a", etichetta: "Conad", valore: 10, riferimento: 20 }]} titolo="Marche" descrizioneValore="Quota" formatta={percento} />
    );

    const tacca = Number(container.querySelector('[data-riferimento="a"] line')!.getAttribute("x1"));
    const valore = Number(within(screen.getByRole("img", { name: "Marche" })).getByText("10%").getAttribute("x"));
    expect(tacca).toBeLessThanOrEqual(480);
    expect(valore).toBeGreaterThan(tacca);
    // Senza nome del riferimento, uno generico
    expect(within(screen.getByRole("list", { name: "Legenda" })).getByRole("listitem")).toHaveTextContent("valore di riferimento");
  });

  it("senza riferimenti né note: niente tacche, niente legenda, la tabella con voce e valore", () => {
    const { container } = render(<BarreOrizzontali voci={voci} titolo="Marche" descrizioneValore="Quota" formatta={percento} />);

    expect(container.querySelector("[data-riferimento]")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Marche" })).getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Voce", "Quota"]);
  });

  it("le etichette prendono fino al 45% della larghezza; oltre si tagliano, intere nel tooltip e nella tabella", () => {
    render(
      <BarreOrizzontali
        voci={[
          // 27 caratteri: oltre il 40% di 480 px, dentro il 45%
          { id: "bio", etichetta: "CONAD Verso Natura Bio Plus", valore: 5 },
          { id: "lunga", etichetta: "CONAD Verso Natura Veg Senza Glutine Integrale", valore: 4 },
        ]}
        titolo="Marche"
        descrizioneValore="Quota"
        formatta={percento}
      />
    );

    const grafico = screen.getByRole("img", { name: "Marche" });
    expect(within(grafico).getByText("CONAD Verso Natura Bio Plus")).toBeInTheDocument();
    const tagliata = within(grafico).getByText(/^CONAD Verso Natura Veg.*…$/);
    fireEvent.mouseMove(tagliata.closest("g")!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("CONAD Verso Natura Veg Senza Glutine Integrale");
    expect(within(screen.getByRole("table", { name: "Marche" })).getByRole("rowheader", { name: "CONAD Verso Natura Veg Senza Glutine Integrale" })).toBeInTheDocument();
  });
});

describe("Colonne", () => {
  const voci = [1, 2, 3].map(n => ({ id: String(n), etichetta: String(n), titolo: `Pagina ${n}`, valore: n * 3 }));

  it("la colonna in evidenza ha il valore sulla cima ed è segnata come premuta", () => {
    render(<Colonne voci={voci} titolo="Referenze per pagina" descrizioneValore="Referenze" evidenziata="2" onSeleziona={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Pagina 2: 6" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pagina 1: 3" })).toHaveAttribute("aria-pressed", "false");
    expect(within(screen.getByRole("img", { name: "Referenze per pagina" })).getByText("6")).toBeInTheDocument();
  });

  it("clic su una colonna la sceglie", () => {
    const onSeleziona = vi.fn();
    render(<Colonne voci={voci} titolo="Referenze per pagina" descrizioneValore="Referenze" onSeleziona={onSeleziona} />);

    fireEvent.click(screen.getByRole("button", { name: "Pagina 3: 9" }));

    expect(onSeleziona).toHaveBeenCalledWith("3");
  });

  it("l'ultima colonna ha sempre l'etichetta; quella diradata prima, se la toccherebbe, cede il posto", () => {
    const pagine = Array.from({ length: 24 }, (_, i) => ({ id: String(i + 1), etichetta: String(i + 1), valore: i }));
    render(<Colonne voci={pagine} titolo="Referenze per pagina" descrizioneValore="Referenze" />);

    // 320 px per 24 colonne: un'etichetta ogni due, poi la 24, senza la 23 accanto
    const etichette = [...screen.getByRole("img", { name: "Referenze per pagina" }).querySelectorAll("text")].map(testo => testo.textContent);
    expect(etichette).toEqual(["1", "3", "5", "7", "9", "11", "13", "15", "17", "19", "21", "24"]);
  });
});

describe("TabellaDati", () => {
  it("la nasconde un contenitore sr-only: la tabella stessa non scende sotto il suo contenuto e farebbe scorrere la pagina", () => {
    render(<BarreOrizzontali voci={[{ id: "a", etichetta: "Conad", valore: 3 }]} titolo="Marche" descrizioneValore="Quota" />);

    const tabella = screen.getByRole("table", { name: "Marche" });
    expect(tabella).not.toHaveClass("sr-only");
    expect(tabella.parentElement).toHaveClass("sr-only");
  });
});

describe("MiniBarre", () => {
  it("il nome accessibile elenca tutti i valori e ogni barra ha il tooltip", () => {
    render(<MiniBarre valori={[{ etichetta: "2021", valore: 3 }, { etichetta: "2022", valore: 4 }]} descrizioneValore="Volantini" />);

    const grafico = screen.getByRole("img", { name: "Volantini: 2021 3, 2022 4" });
    fireEvent.mouseMove(grafico.querySelectorAll("g")[1]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("2022");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Volantini4");
  });
});

describe("GraficoLinee", () => {
  const anni = [2021, 2022, 2023];

  it("una serie: niente legenda, il valore in fondo alla linea", () => {
    render(
      <GraficoLinee
        serie={[{ id: "s", nome: "Sconto medio", punti: [{ x: 2021, y: 20.9 }, { x: 2022, y: 22.4 }, { x: 2023, y: 24.1 }] }]}
        titolo="Sconto medio per anno"
        formattaX={String}
        formattaY={percento}
      />
    );

    expect(screen.queryByRole("list", { name: "Legenda" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("img", { name: "Sconto medio per anno" })).getByText("24.1%")).toBeInTheDocument();
  });

  it("due serie su un asse solo: legenda e un tooltip con tutte le serie alla x più vicina", () => {
    const { container } = render(
      <GraficoLinee
        serie={[
          { id: "offerta", nome: "Prezzo in offerta", punti: anni.map((x, i) => ({ x, y: 1.5 + i * 0.1, segnalato: i === 1 })) },
          { id: "barrato", nome: "Prezzo barrato", tono: "secondaria", punti: anni.map(x => ({ x, y: 2.9 })) },
        ]}
        titolo="Prezzo nel tempo"
        formattaX={String}
        formattaY={v => `€ ${v.toFixed(2)}`}
        etichettaSegnalati="Sottocosto"
      />
    );

    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Prezzo in offerta", "Prezzo barrato", "Sottocosto"]);

    fireEvent.mouseMove(container.querySelector('[data-x="2022"]')!);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("2022");
    expect(tooltip).toHaveTextContent("Prezzo in offerta€ 1.60");
    expect(tooltip).toHaveTextContent("Prezzo barrato€ 2.90");
    expect(tooltip).toHaveTextContent("Sottocostosì");
  });

  it("senza valori lo dice", () => {
    render(<GraficoLinee serie={[{ id: "s", nome: "Sconto", punti: [{ x: 2021, y: null }] }]} titolo="Sconto" formattaX={String} formattaY={percento} />);
    expect(screen.getByText("Nessun dato da mostrare.")).toBeInTheDocument();
  });
});

describe("Heatmap", () => {
  const props = {
    righe: [{ id: "sconto", etichetta: "Sconto in %" }, { id: "fidelity", etichetta: "Prezzo Fidelity" }],
    colonne: [{ id: "2021", etichetta: "2021" }, { id: "2022", etichetta: "2022" }],
    valori: [[41, 39], [14, null]],
    titolo: "Meccaniche per anno",
    descrizioneValore: "Quota delle referenze",
    formatta: percento,
  };

  it("valore nelle celle, passo della scala per valore e legenda delle classi", () => {
    render(<Heatmap {...props} />);

    const grafico = screen.getByRole("img", { name: "Meccaniche per anno" });
    expect(within(grafico).getByText("41%").closest("g")).toHaveAttribute("data-passo", "6");
    expect(within(grafico).getByText("14%").closest("g")).toHaveAttribute("data-passo", "2");
    expect(within(screen.getByRole("list", { name: "Quota delle referenze" })).getAllByRole("listitem")).toHaveLength(7);
  });

  it("una cella senza dato è neutra e il tooltip lo dice", () => {
    const { container } = render(<Heatmap {...props} />);

    const vuota = container.querySelector('[data-passo="-1"]')!;
    fireEvent.mouseMove(vuota);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Prezzo Fidelity");
    expect(screen.getByRole("tooltip")).toHaveTextContent("nessun dato");
  });
});

describe("BarreImpilate100", () => {
  it("una barra per riga, legenda delle categorie e quota dentro le parti dove ci sta", () => {
    render(
      <BarreImpilate100
        righe={[{ id: "2026", etichetta: "2026" }]}
        categorie={[{ id: "freschi", etichetta: "Freschi" }, { id: "bevande", etichetta: "Bevande" }]}
        valori={[[99, 1]]}
        titolo="Spazio per reparto"
        descrizioneValore="Spazio di pagina"
      />
    );

    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Freschi", "Bevande"]);
    const grafico = screen.getByRole("img", { name: "Spazio per reparto" });
    expect(within(grafico).getByText("99%")).toBeInTheDocument();
    // La parte dell'1% è troppo stretta per l'etichetta: il valore resta nel tooltip e nella tabella
    expect(within(grafico).queryByText("1%")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Spazio per reparto" })).getByText("1%")).toBeInTheDocument();
  });
});

describe("TimelineVolantini", () => {
  const barre: BarraTimeline[] = [
    { id: "k1", dal: "2024-03-04", al: "2024-03-17", gruppo: "city", titolo: "Promo marzo" },
    { id: "k2", dal: "2025-05-10", al: "2025-05-23", gruppo: "superstore", titolo: "Promo maggio", dettagli: [{ etichetta: "Referenze", valore: "160" }] },
    { id: "k3", dal: "2025-10-23", al: "2025-11-05", gruppo: "superstore", titolo: "Promo ottobre" },
  ];
  const gruppi = [
    { id: "city", etichetta: "Conad City", tinta: tintaCategoria(0) },
    { id: "superstore", etichetta: "Conad Superstore", tinta: tintaCategoria(1) },
  ];
  const disegna = (props: Partial<Parameters<typeof TimelineVolantini>[0]> = {}) =>
    render(
      <TimelineVolantini
        barre={barre}
        gruppi={gruppi}
        fasce={[
          { id: "f1", dal: "2024-01-01", al: "2024-12-31", gruppo: "city", etichetta: "Conad City · Liguria" },
          { id: "f2", dal: "2025-01-01", al: "2025-12-31", gruppo: "superstore", etichetta: "Conad Superstore · Liguria" },
        ]}
        eventi={[{ id: "e1", data: "2025-01-01", forma: "cerchio", etichetta: "Diventa Conad Superstore" }]}
        nomiEventi={{ cerchio: "cambio di insegna" }}
        oggi="2025-11-10"
        titolo="Timeline dei volantini"
        descrizioneGruppo="Insegna"
        selezionata="k3"
        onSeleziona={vi.fn()}
        {...props}
      />
    );
  /** Il rettangolo disegnato della barra di un volantino. */
  const barra = (container: HTMLElement, id: string) => {
    const rect = container.querySelector(`[data-barra="${id}"]`)!;
    return { x: Number(rect.getAttribute("x")), y: Number(rect.getAttribute("y")), w: Number(rect.getAttribute("width")) };
  };

  it("una barra per volantino, come opzione con nome; quella scelta è selezionata e contornata", () => {
    const { container } = disegna();

    const opzioni = screen.getAllByRole("option");
    expect(opzioni).toHaveLength(3);
    expect(screen.getByRole("option", { name: /Promo ottobre/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Promo marzo/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("option", { name: "Promo maggio, 10 mag 2025 – 23 mag 2025, Conad Superstore, Referenze 160" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-selezionata]")).toHaveLength(1);
  });

  it("clic, Invio, frecce e Home scelgono il volantino", () => {
    const onSeleziona = vi.fn();
    disegna({ onSeleziona });

    fireEvent.click(screen.getByRole("option", { name: /Promo marzo/ }));
    fireEvent.keyDown(screen.getByRole("option", { name: /Promo ottobre/ }), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("option", { name: /Promo ottobre/ }), { key: "Home" });
    fireEvent.keyDown(screen.getByRole("option", { name: /Promo maggio/ }), { key: "Enter" });

    expect(onSeleziona.mock.calls).toEqual([["k1"], ["k2"], ["k1"], ["k2"]]);
  });

  it("fascia delle insegne con le etichette, eventi e legenda di insegne ed eventi", () => {
    disegna();

    const grafico = screen.getByRole("group", { name: "Timeline dei volantini" });
    expect(within(grafico).getByText("Conad City · Liguria")).toBeInTheDocument();
    expect(within(grafico).getByText("Diventa Conad Superstore")).toBeInTheDocument();
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Conad City", "Conad Superstore", "cambio di insegna"]);
  });

  it("asse a calendario: i mesi con mese e anno, la linea di oggi e, nello zoom su un anno, solo i suoi volantini", () => {
    const { container } = disegna({ intervallo: { dal: "2025-01-01", al: "2025-12-31" } });

    expect(screen.getAllByRole("option")).toHaveLength(2);
    const grafico = screen.getByRole("group", { name: "Timeline dei volantini" });
    expect(within(grafico).getByText("gen 2025")).toBeInTheDocument();
    expect(within(grafico).getByText("dic 2025")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-mese]")).toHaveLength(12);
    expect(within(grafico).queryByText(/2024/)).not.toBeInTheDocument();
    expect(within(grafico).getByText("oggi")).toBeInTheDocument();
    expect(container.querySelector("[data-oggi]")).toHaveAttribute("data-oggi", "2025-11-10");
  });

  it("oggi fuori dal periodo: niente linea di oggi", () => {
    const { container } = disegna({ intervallo: { dal: "2024-01-01", al: "2024-12-31" } });

    expect(container.querySelector("[data-oggi]")).not.toBeInTheDocument();
    expect(screen.queryByText("oggi")).not.toBeInTheDocument();
  });

  it("su pochi mesi le settimane: il numero del giorno di ogni lunedì", () => {
    disegna({ intervallo: { dal: "2025-10-01", al: "2025-11-30" } });

    const grafico = screen.getByRole("group", { name: "Timeline dei volantini" });
    // Lunedì 6, 13, 20 e 27 ottobre 2025
    for (const giorno of ["6", "13", "20", "27"]) expect(within(grafico).getByText(giorno)).toBeInTheDocument();
    expect(within(grafico).getByText("ott 2025")).toBeInTheDocument();
  });

  it("la barra va dal primo all'ultimo giorno compreso; senza fine è un giorno solo", () => {
    const { container } = render(
      <TimelineVolantini
        barre={[
          { id: "a", dal: "2025-03-03", al: "2025-03-16", gruppo: "city", titolo: "Prima" },
          { id: "b", dal: "2025-03-17", al: "2025-03-30", gruppo: "city", titolo: "Seconda" },
          { id: "c", dal: "2025-05-10", al: null, gruppo: "city", titolo: "Un giorno" },
        ]}
        gruppi={gruppi}
        intervallo={{ dal: "2025-01-01", al: "2025-12-31" }}
        titolo="Timeline dei volantini"
      />
    );

    const [a, b, c] = ["a", "b", "c"].map(id => barra(container, id));
    // Due settimane ciascuna, una dopo l'altra: la seconda inizia dove finisce l'ultimo giorno della prima
    expect(b.w).toBeCloseTo(a.w, 5);
    expect(b.x).toBeCloseTo(a.x + a.w + 1, 5);
    expect(b.y).toBe(a.y);
    expect(c.w).toBeLessThan(a.w / 10);
    expect(screen.getByRole("option", { name: "Un giorno, 10 mag 2025, Conad City" })).toBeInTheDocument();
  });

  it("i volantini che si sovrappongono (le varianti per area) vanno su corsie diverse, e ognuno si sceglie", () => {
    const onSeleziona = vi.fn();
    const { container } = render(
      <TimelineVolantini
        barre={["Emilia", "Liguria", "Piemonte"].map(area => ({ id: area, dal: "2026-10-26", al: "2026-11-08", gruppo: "city", titolo: `Promo ${area}` }))}
        gruppi={gruppi}
        oggi="2026-11-10"
        titolo="Timeline dei volantini"
        onSeleziona={onSeleziona}
      />
    );

    const corsie = ["Emilia", "Liguria", "Piemonte"].map(id => barra(container, id));
    expect(new Set(corsie.map(c => c.y)).size).toBe(3);
    expect(new Set(corsie.map(c => c.x)).size).toBe(1);
    fireEvent.click(screen.getByRole("option", { name: /Promo Liguria/ }));
    expect(onSeleziona).toHaveBeenCalledWith("Liguria");
  });

  it("il nome del volantino sta dentro la barra quando c'è spazio, tagliato se serve", () => {
    disegna({ intervallo: { dal: "2025-10-15", al: "2025-11-15" } });

    expect(within(screen.getByRole("group", { name: "Timeline dei volantini" })).getByText("Promo ottobre")).toBeInTheDocument();
  });

  it("il tooltip della barra dice volantino, periodo, insegna e dettagli", () => {
    disegna();

    fireEvent.mouseMove(screen.getByRole("option", { name: /Promo maggio/ }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Promo maggio");
    expect(screen.getByRole("tooltip")).toHaveTextContent("10 mag 2025 – 23 mag 2025");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Referenze160");
    expect(screen.getByRole("tooltip")).toHaveTextContent("InsegnaConad Superstore");
  });
});

describe("TimelineVolantini: tracce, assenze e periodi lunghi", () => {
  const gruppi = [{ id: "city", etichetta: "Conad City", tinta: tintaCategoria(0) }];
  // A e B uno dopo l'altro sulla prima corsia; C si sovrappone ad A e va sulla seconda
  const barre: BarraTimeline[] = [
    { id: "a", dal: "2025-03-03", al: "2025-03-16", gruppo: "city", titolo: "Promo A" },
    { id: "b", dal: "2025-03-17", al: "2025-03-30", gruppo: "city", titolo: "Promo B" },
    { id: "c", dal: "2025-03-10", al: "2025-03-20", gruppo: "city", titolo: "Speciale C" },
  ];
  const referenze: TracciaTimeline = { tipo: "colonne", id: "referenze", etichetta: "Referenze", valori: { a: 120, b: 177, c: 40 }, formatta: String };
  const sconto: TracciaTimeline = { tipo: "linea", id: "sconto", etichetta: "Sconto medio", valori: { a: 21, b: 24.5, c: 30 }, formatta: percento };
  const meccaniche: TracciaTimeline = {
    tipo: "impilate",
    id: "meccaniche",
    etichetta: "Meccaniche",
    categorie: [
      { id: "taglio", etichetta: "Taglio prezzo", tinta: tintaCategoria(2) },
      { id: "multi", etichetta: "3x2", tinta: tintaCategoria(3) },
      { id: "sotto", etichetta: "Sottocosto", tinta: tintaCategoria(4) },
      { id: "altro", etichetta: "Altro", tinta: TINTA_NEUTRA },
    ],
    valori: { a: { taglio: 60, multi: 25, sotto: 10, altro: 5 }, b: { taglio: 40, multi: 40, sotto: 20 }, c: { multi: 100 } },
    formatta: percento,
  };
  const indirizzo: TracciaTimeline = {
    tipo: "fasce",
    id: "indirizzo",
    etichetta: "Indirizzo stampato",
    fasce: [
      { id: "r1", dal: "2025-01-01", al: "2025-03-15", etichetta: "Via Roma 3", tono: "attenzione" },
      { id: "r2", dal: "2025-03-16", al: "2025-12-31", etichetta: "C.so Nazario Sauro 44", tono: "evidenza" },
    ],
    nomiToni: { attenzione: "diverso dall'anagrafica", evidenza: "come in anagrafica" },
  };
  const disegna = (props: Partial<Parameters<typeof TimelineVolantini>[0]> = {}) =>
    render(
      <TimelineVolantini
        barre={barre}
        gruppi={gruppi}
        intervallo={{ dal: "2025-01-01", al: "2025-12-31" }}
        oggi="2025-11-10"
        titolo="Timeline"
        descrizioneGruppo="Insegna"
        {...props}
      />
    );
  const traccia = (container: HTMLElement, id: string) => container.querySelector(`[data-traccia="${id}"]`) as HTMLElement;
  const xBarra = (container: HTMLElement, id: string) => container.querySelector(`[data-barra="${id}"]`)!.getAttribute("x");
  const yRect = (elemento: Element) => Number(elemento.querySelector("rect")!.getAttribute("y"));

  it("colonne: un segno per volantino alla x della sua barra; quello sovrapposto a un altro è solo un contorno", () => {
    const { container } = disegna({ tracce: [referenze] });

    const colonne = traccia(container, "referenze");
    expect(colonne.querySelectorAll("[data-segno]")).toHaveLength(3);
    for (const id of ["a", "b", "c"]) expect(colonne.querySelector(`[data-segno="${id}"]`)).toHaveAttribute("data-x", xBarra(container, id));
    expect(colonne.querySelector('[data-segno="c"]')).toHaveAttribute("data-contorno");
    expect(colonne.querySelector('[data-segno="c"]')).toHaveAttribute("fill", "none");
    expect(colonne.querySelector('[data-segno="a"]')).not.toHaveAttribute("data-contorno");
    // Il nome della traccia e fin dove arriva
    expect(colonne).toHaveTextContent("Referenze · fino a 177");
  });

  it("linea: unisce solo i volantini della prima corsia; quello sovrapposto è un cerchio vuoto", () => {
    const { container } = disegna({ tracce: [sconto] });

    const linea = traccia(container, "sconto");
    expect(linea.querySelector("path")!.getAttribute("d")!.match(/[ML]/g)).toHaveLength(2);
    expect(linea.querySelector('[data-segno="c"]')).toHaveAttribute("data-contorno");
    expect(linea.querySelector('[data-segno="a"]')).not.toHaveAttribute("data-contorno");
    expect(linea.querySelector('[data-segno="b"]')).toHaveAttribute("data-x", xBarra(container, "b"));
    expect(linea).toHaveTextContent("Sconto medio · da 21% a 30%");
  });

  it("linea con più di 40 volantini: la linea senza punti, tranne quello del volantino scelto", () => {
    const settimane: BarraTimeline[] = Array.from({ length: 45 }, (_, i) => ({
      id: `s${i}`,
      dal: isoData(msData("2024-01-01") + i * 7 * MS_GIORNO),
      al: isoData(msData("2024-01-01") + (i * 7 + 6) * MS_GIORNO),
      gruppo: "city",
      titolo: `Settimana ${i + 1}`,
    }));
    const valori = Object.fromEntries(settimane.map((b, i) => [b.id, 20 + (i % 5)]));
    const { container } = disegna({
      barre: settimane,
      intervallo: { dal: "2024-01-01", al: "2024-12-31" },
      selezionata: "s10",
      tracce: [{ tipo: "linea", id: "sconto", etichetta: "Sconto medio", valori, formatta: percento }],
    });

    const linea = traccia(container, "sconto");
    expect(linea.querySelectorAll("circle")).toHaveLength(1);
    expect(linea.querySelector("circle")).toHaveAttribute("data-segno", "s10");
    expect(linea.querySelector("path")!.getAttribute("d")!.match(/L/g)).toHaveLength(44);
  });

  it("impilate: le quote di ogni volantino, e ogni corsia delle barre ha la sua fascia", () => {
    const { container } = disegna({ tracce: [meccaniche] });

    const impilate = traccia(container, "meccaniche");
    expect(impilate.querySelector('[data-segno="a"]')!.querySelectorAll("rect")).toHaveLength(4);
    expect(impilate.querySelector('[data-segno="a"]')).toHaveAttribute("data-x", xBarra(container, "a"));
    const fondoA = Math.max(...[...impilate.querySelectorAll('[data-segno="a"] rect')].map(r => Number(r.getAttribute("y")) + Number(r.getAttribute("height"))));
    const cimaC = Math.min(...[...impilate.querySelectorAll('[data-segno="c"] rect')].map(r => Number(r.getAttribute("y"))));
    expect(cimaC).toBeGreaterThanOrEqual(fondoA);
  });

  it("le colonne delle tracce sono aree attive: clic sceglie il volantino, ma non sono fermate del Tab", () => {
    const onSeleziona = vi.fn();
    const { container } = disegna({ tracce: [referenze], onSeleziona });

    const area = container.querySelector('[data-area-traccia="b"]')!;
    expect(area).not.toHaveAttribute("tabindex");
    expect(area.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-area-traccia]")).toHaveLength(3);
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.click(area);
    expect(onSeleziona).toHaveBeenCalledWith("b");
  });

  it("il tooltip della colonna e della barra aggiunge una riga per traccia; le impilate le 3 categorie più grandi", () => {
    const { container } = disegna({ tracce: [referenze, sconto, meccaniche, indirizzo] });

    fireEvent.mouseMove(container.querySelector('[data-area-traccia="a"]')!);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Promo A");
    expect(tooltip).toHaveTextContent("InsegnaConad City");
    expect(tooltip).toHaveTextContent("Referenze120");
    expect(tooltip).toHaveTextContent("Sconto medio21%");
    expect(tooltip).toHaveTextContent("Taglio prezzo60%");
    expect(tooltip).toHaveTextContent("3x225%");
    expect(tooltip).toHaveTextContent("Sottocosto10%");
    expect(tooltip).not.toHaveTextContent("Altro");
    expect(tooltip).toHaveTextContent("Indirizzo stampatoVia Roma 3");
    fireEvent.mouseLeave(container.querySelector('[data-area-traccia="a"]')!);

    fireEvent.mouseMove(screen.getByRole("option", { name: /Promo B/ }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Referenze177");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Indirizzo stampatoC.so Nazario Sauro 44");
  });

  it("i valori delle tracce sono anche nel nome dell'opzione e nella tabella dei dati", () => {
    disegna({ tracce: [referenze, meccaniche, indirizzo] });

    expect(screen.getByRole("option", { name: "Promo B, 17 mar 2025 – 30 mar 2025, Conad City, Referenze 177, Taglio prezzo 40%, 3x2 40%, Sottocosto 20%, Indirizzo stampato C.so Nazario Sauro 44" })).toBeInTheDocument();
    const tabella = screen.getByRole("table", { name: "Timeline" });
    expect(within(tabella).getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Volantino", "Dal", "Al", "Insegna", "Referenze", "Meccaniche", "Indirizzo stampato"]);
    expect(within(tabella).getByRole("rowheader", { name: "Promo A" }).closest("tr")).toHaveTextContent("Promo A3 mar 202516 mar 2025Conad City120Taglio prezzo 60%Via Roma 3");
  });

  it("fasce: i tratti col testo dentro e il tooltip; legende col nome della traccia per toni e categorie", () => {
    const { container } = disegna({ tracce: [meccaniche, indirizzo] });

    expect(within(traccia(container, "indirizzo")).getByText("C.so Nazario Sauro 44")).toBeInTheDocument();
    fireEvent.mouseMove(container.querySelector('[data-fascia="r1"]')!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Via Roma 3");
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 gen 2025 – 15 mar 2025");

    const toni = screen.getByRole("list", { name: "Indirizzo stampato" });
    expect(within(toni).getAllByRole("listitem").map(v => v.textContent)).toEqual(["diverso dall'anagrafica", "come in anagrafica"]);
    const categorie = screen.getByRole("list", { name: "Meccaniche" });
    expect(within(categorie).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Taglio prezzo", "3x2", "Sottocosto", "Altro"]);
    expect(within(screen.getByRole("list", { name: "Legenda" })).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Conad City"]);
  });

  it("il volantino scelto ha anche la sua colonna velata in tutte le tracce", () => {
    const { container } = disegna({ tracce: [referenze, sconto], selezionata: "b" });

    const colonna = container.querySelectorAll("[data-colonna-selezionata]");
    expect(colonna).toHaveLength(1);
    expect(Number(colonna[0].getAttribute("x"))).toBeCloseTo(Number(xBarra(container, "b")) - 2, 5);
    expect(colonna[0]).toHaveClass("pointer-events-none");
  });

  it("assenze: un riquadro tratteggiato che non copre mai una barra, col tooltip, in legenda e in tabella, ma non si sceglie", () => {
    const onSeleziona = vi.fn();
    const { container } = disegna({
      onSeleziona,
      assenze: [
        // In un buco della prima corsia
        { id: "x", dal: "2025-04-07", al: "2025-04-20", titolo: "Promo aprile Liguria" },
        // Sopra A (prima corsia) e C (seconda): va su una terza
        { id: "y", dal: "2025-03-05", al: "2025-03-12", titolo: "Speciale Liguria" },
      ],
    });

    const x = container.querySelector('[data-assenza="x"]')!;
    const y = container.querySelector('[data-assenza="y"]')!;
    const yBarra = (id: string) => Number(container.querySelector(`[data-barra="${id}"]`)!.getAttribute("y"));
    expect(yRect(x)).toBe(yBarra("a"));
    expect(new Set([yBarra("a"), yBarra("c"), yRect(y)]).size).toBe(3);
    // Tratteggiata e velata di rosso: ben distinta dalle barre piene dei volantini (richiesta del 2026-11-19)
    expect(x.querySelectorAll('rect[stroke-dasharray="3 2"]')).toHaveLength(1);
    expect(x.querySelector('rect[stroke-dasharray="3 2"]')!.getAttribute("class")).toMatch(/stroke-rose-600/);

    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.queryByRole("option", { name: /Promo aprile Liguria/ })).not.toBeInTheDocument();
    fireEvent.click(x);
    expect(onSeleziona).not.toHaveBeenCalled();

    fireEvent.mouseMove(x);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Promo aprile Liguria");
    expect(screen.getByRole("tooltip")).toHaveTextContent("7 apr 2025 – 20 apr 2025");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Senza il punto vendita");

    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Conad City", "senza il punto vendita"]);
    const tabella = screen.getByRole("table", { name: "Timeline" });
    expect(within(tabella).getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Volantino", "Dal", "Al", "Insegna", "Nota"]);
    expect(within(tabella).getByRole("rowheader", { name: "Promo aprile Liguria" }).closest("tr")).toHaveTextContent("senza il punto vendita");
    // In ordine di inizio con i volantini: A, poi l'assenza del 5 marzo
    expect(within(tabella).getAllByRole("rowheader").map(c => c.textContent)).toEqual(["Promo A", "Speciale Liguria", "Speciale C", "Promo B", "Promo aprile Liguria"]);
  });

  it("su 5 anni con pochi pixel per giorno: sta in meno di 1000 px e l'asse dice gli anni, a gennaio, a fasce alterne", () => {
    const { container } = disegna({
      barre: [{ id: "a", dal: "2022-03-07", al: "2022-03-20", gruppo: "city", titolo: "Promo" }],
      intervallo: { dal: "2021-11-17", al: "2026-11-17" },
      oggi: "2026-11-10",
      pixelGiornoMinimi: 0.5,
    });

    const grafico = screen.getByRole("group", { name: "Timeline" });
    expect(Number(grafico.getAttribute("width"))).toBeLessThan(1000);
    for (const anno of ["2022", "2023", "2024", "2025", "2026"]) expect(within(grafico).getByText(anno)).toBeInTheDocument();
    // Dal 17 novembre non c'è spazio per il 2021 prima di gennaio; e nessun nome di mese
    expect(within(grafico).queryByText("2021")).not.toBeInTheDocument();
    expect(within(grafico).queryByText(/^(gen|feb|mar|nov|dic)/)).not.toBeInTheDocument();
    // Fasce alterne per anno (gli anni dispari: 2021 in parte, 2023, 2025), non per mese
    expect([...container.querySelectorAll("[data-anno]")].map(r => r.getAttribute("data-anno"))).toEqual(["2021", "2023", "2025"]);
    // La barra di due settimane resta visibile, larga almeno 2 px
    expect(Number(container.querySelector('[data-barra="a"]')!.getAttribute("width"))).toBeGreaterThanOrEqual(2);
  });

  it("con i mesi stretti (solo il nome breve) gennaio dice l'anno", () => {
    // Un anno e mezzo in 720 px: 1,27 px per giorno, "gen 2025" non ci sta, "feb" sì
    disegna({ intervallo: { dal: "2024-07-01", al: "2025-12-31" }, pixelGiornoMinimi: 0.5 });

    const grafico = screen.getByRole("group", { name: "Timeline" });
    expect(within(grafico).getByText("2025")).toBeInTheDocument();
    expect(within(grafico).getByText("feb")).toBeInTheDocument();
    expect(within(grafico).queryByText("gen")).not.toBeInTheDocument();
    expect(within(grafico).queryByText("gen 2025")).not.toBeInTheDocument();
  });

  it("senza tracce né assenze la timeline è quella di prima: niente tracce, niente aree in più, stessa tabella", () => {
    const { container } = disegna();

    expect(container.querySelector("[data-tracce]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-area-traccia]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-anno]")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Timeline" })).getAllByRole("columnheader").map(c => c.textContent)).toEqual(["Volantino", "Dal", "Al", "Insegna"]);
  });
});

describe("StrisciaPresenze", () => {
  const volantini = [
    { id: "a", etichetta: "Promo gennaio" },
    { id: "b", etichetta: "Promo febbraio" },
    { id: "c", etichetta: "Promo marzo" },
  ];

  it("una tacca per volantino; il nome accessibile conta le presenze e il tooltip dice il volantino", () => {
    const { container } = render(<StrisciaPresenze volantini={volantini} presenti={new Set(["a", "c"])} titolo="Presenze della referenza" />);

    expect(screen.getByRole("img", { name: "Presenze della referenza: presente in 2 su 3 volantini" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-presente]")).toHaveLength(3);
    fireEvent.mouseMove(container.querySelector('[data-presente="false"]')!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Promo febbraio");
    expect(screen.getByRole("tooltip")).toHaveTextContent("assente");
  });

  it("al più 220 px: con molti volantini le tacche si stringono e perdono lo stacco; un volantino solo è al singolare", () => {
    const molti = Array.from({ length: 300 }, (_, i) => ({ id: String(i), etichetta: `Volantino ${i}` }));
    const { container, rerender } = render(<StrisciaPresenze volantini={molti} presenti={new Set(["1"])} titolo="Presenze" />);

    const striscia = screen.getByRole("img", { name: "Presenze: presente in 1 su 300 volantini" });
    expect(Number(striscia.getAttribute("width"))).toBeCloseTo(220, 5);
    const tacca = container.querySelector('[data-presente="true"] rect:last-child')!;
    expect(Number(tacca.getAttribute("width"))).toBeCloseTo(220 / 300, 5);

    rerender(<StrisciaPresenze volantini={molti.slice(0, 1)} presenti={new Set()} titolo="Presenze" />);
    expect(screen.getByRole("img", { name: "Presenze: presente in 0 su 1 volantino" })).toBeInTheDocument();
  });

  it("senza volantini non disegna niente", () => {
    const { container } = render(<StrisciaPresenze volantini={[]} presenti={new Set()} titolo="Presenze" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ForbicePrezzo", () => {
  const euro = (v: number) => `€ ${v.toFixed(2)}`;

  it("il segmento dal minimo al massimo e il punto dell'ultimo volantino; il nome accessibile dice i prezzi", () => {
    const { container } = render(<ForbicePrezzo minimo={1.49} massimo={2.19} ultimo={1.99} formatta={euro} />);

    expect(screen.getByRole("img", { name: "da € 1.49 a € 2.19, nell'ultimo volantino € 1.99" })).toBeInTheDocument();
    const forbice = container.querySelector("[data-forbice]")!;
    const inizio = Number(forbice.getAttribute("x"));
    const fine = inizio + Number(forbice.getAttribute("width"));
    const punto = Number(container.querySelector("[data-ultimo]")!.getAttribute("cx"));
    expect(punto).toBeGreaterThan(inizio);
    expect(punto).toBeLessThan(fine);
  });

  it("minimo uguale al massimo: niente segmento, il punto al centro", () => {
    const { container } = render(<ForbicePrezzo minimo={1.99} massimo={1.99} ultimo={1.99} formatta={euro} />);

    expect(container.querySelector("[data-forbice]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-ultimo]")).toHaveAttribute("cx", "60");
    expect(screen.getByRole("img", { name: "sempre € 1.99, nell'ultimo volantino € 1.99" })).toBeInTheDocument();
  });

  it("senza niente da disegnare non c'è: tutto null, o un prezzo solo senza l'ultimo volantino", () => {
    const { container, rerender } = render(<ForbicePrezzo minimo={null} massimo={null} ultimo={null} formatta={euro} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ForbicePrezzo minimo={1.99} massimo={1.99} ultimo={null} formatta={euro} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("senza forbice ma con l'ultimo prezzo: il punto al centro", () => {
    const { container } = render(<ForbicePrezzo minimo={null} massimo={null} ultimo={2.5} formatta={euro} />);

    expect(container.querySelector("[data-ultimo]")).toHaveAttribute("cx", "60");
    expect(screen.getByRole("img", { name: "nell'ultimo volantino € 2.50" })).toBeInTheDocument();
  });
});

describe("PaginaVolantino e MiniaturaPagina", () => {
  const box = (id: string, dati: Partial<BoxPagina> = {}): BoxPagina => ({
    id,
    x: 0,
    y: 0,
    w: 0.5,
    h: 0.3,
    tinta: TINTA_NEUTRA,
    descrizione: `Box ${id}`,
    tooltip: { titolo: `Referenza ${id}` },
    ...dati,
  });

  it("i box con una destinazione sono pulsanti; il box scelto è premuto", () => {
    const onSeleziona = vi.fn();
    render(
      <PaginaVolantino
        proporzione={210 / 297}
        boxes={[box("a", { etichetta: "−43%" }), box("b", { x: 0.5 }), box("c", { y: 0.5, disattivato: true })]}
        selezionato="b"
        onSeleziona={onSeleziona}
        titolo="Pagina 2"
      />
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Box b" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Box c" })).toBeInTheDocument();
    expect(screen.getByText("−43%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Box a" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Box b" }), { key: " " });
    expect(onSeleziona.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("al passaggio del mouse il tooltip della referenza; una pagina vuota lo dice", () => {
    const { rerender } = render(<PaginaVolantino proporzione={0.7} boxes={[box("a")]} titolo="Pagina 1" />);

    fireEvent.mouseMove(screen.getByRole("img", { name: "Box a" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Referenza a");

    rerender(<PaginaVolantino proporzione={0.7} boxes={[]} titolo="Pagina 1" vuota="Lista dei punti vendita" />);
    expect(screen.getByText("Lista dei punti vendita")).toBeInTheDocument();
  });

  it("la miniatura è decorativa senza titolo e segna il box evidenziato", () => {
    const { container } = render(
      <MiniaturaPagina proporzione={0.7} boxes={[{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5, evidenziato: true }]} />
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("[data-evidenziato]")).toHaveLength(1);
  });
});

describe("FasceNelTempo", () => {
  it("righe di tratti con l'etichetta dentro e la legenda dei toni usati", () => {
    render(
      <FasceNelTempo
        righe={[
          {
            id: "indirizzo",
            etichetta: "Indirizzo",
            fasce: [
              { id: "a", dal: "2021-01-04", al: "2022-09-11", etichetta: "Via Roma 3", tono: "attenzione" },
              { id: "b", dal: "2022-09-12", al: "2026-10-23", etichetta: "C.so Nazario Sauro 44", tono: "evidenza" },
            ],
          },
        ]}
        titolo="Indirizzi stampati"
        nomiToni={{ evidenza: "come in anagrafica", attenzione: "diverso dall'anagrafica" }}
      />
    );

    const grafico = screen.getByRole("img", { name: "Indirizzi stampati" });
    expect(within(grafico).getByText("C.so Nazario Sauro 44")).toBeInTheDocument();
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["diverso dall'anagrafica", "come in anagrafica"]);
  });
});

describe("StrisciaNumeri", () => {
  it("numero, che cosa conta e il contesto; un valore mancante è N/D", () => {
    render(
      <StrisciaNumeri
        titolo="Il punto vendita in numeri"
        voci={[
          { id: "volantini", valore: "212", etichetta: "volantini dal gen 2021", dettaglio: "2 attivi adesso" },
          { id: "sconto", valore: null, etichetta: "sconto medio" },
        ]}
      />
    );

    const numeri = screen.getByLabelText("Il punto vendita in numeri");
    const celle = numeri.querySelectorAll(":scope > div");
    expect(celle[0]).toHaveTextContent("volantini dal gen 2021");
    expect(celle[0]).toHaveTextContent("212");
    expect(celle[0]).toHaveTextContent("2 attivi adesso");
    expect(celle[1]).toHaveTextContent("sconto medioN/D");
  });

  it("durante il caricamento gli scheletri", () => {
    render(<StrisciaNumeri titolo="Numeri" voci={[]} loading vociAttese={3} />);
    expect(screen.getByRole("status", { name: "Caricamento: Numeri" })).toBeInTheDocument();
  });

  it("in riga: stessi numero, etichetta e contesto su una riga sottile, senza il riquadro", () => {
    const { container } = render(
      <StrisciaNumeri inRiga titolo="La referenza in numeri" voci={[{ id: "volantini", valore: "3", etichetta: "volantini di questo punto vendita", dettaglio: "dal ott 2026" }]} />
    );

    const numeri = screen.getByLabelText("La referenza in numeri");
    // Nessun riquadro attorno: la riga sta dentro un altro riquadro
    expect(container.firstElementChild).toBe(numeri);
    expect(numeri.tagName).toBe("DL");
    // Nel DOM l'etichetta (dt) precede il numero (dd), come vuole una lista di definizioni
    expect(numeri).toHaveTextContent("volantini di questo punto vendita3· dal ott 2026");
    expect(within(numeri).getByText("3").tagName).toBe("DD");
    expect(within(numeri).getByText("volantini di questo punto vendita").tagName).toBe("DT");
  });
});
