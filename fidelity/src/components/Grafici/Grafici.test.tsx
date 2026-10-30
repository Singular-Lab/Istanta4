// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BarreImpilate100,
  BarreOrizzontali,
  Colonne,
  FasceNelTempo,
  GraficoLinee,
  Heatmap,
  MiniaturaPagina,
  MiniBarre,
  PaginaVolantino,
  StrisciaNumeri,
  TimelineVolantini,
  tintaCategoria,
  TINTA_NEUTRA,
  type BoxPagina,
  type ColonnaTimeline,
} from ".";
import { distanziaColonne } from "./TimelineVolantini";

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
  const colonne: ColonnaTimeline[] = [
    { id: "k1", data: "2024-03-04", valore: 120, gruppo: "city", titolo: "Promo marzo" },
    { id: "k2", data: "2025-05-10", valore: 160, gruppo: "superstore", titolo: "Promo maggio" },
    { id: "k3", data: "2025-10-23", valore: 148, gruppo: "superstore", titolo: "Promo ottobre" },
  ];
  const gruppi = [
    { id: "city", etichetta: "Conad City", tinta: tintaCategoria(0) },
    { id: "superstore", etichetta: "Conad Superstore", tinta: tintaCategoria(1) },
  ];
  const disegna = (props: Partial<Parameters<typeof TimelineVolantini>[0]> = {}) =>
    render(
      <TimelineVolantini
        colonne={colonne}
        gruppi={gruppi}
        fasce={[
          { id: "f1", dal: "2024-01-01", al: "2024-12-31", gruppo: "city", etichetta: "Conad City · Liguria" },
          { id: "f2", dal: "2025-01-01", al: "2025-12-31", gruppo: "superstore", etichetta: "Conad Superstore · Liguria" },
        ]}
        eventi={[{ id: "e1", data: "2025-01-01", forma: "cerchio", etichetta: "Diventa Conad Superstore" }]}
        nomiEventi={{ cerchio: "cambio di insegna" }}
        titolo="Timeline dei volantini"
        descrizioneValore="Referenze"
        descrizioneGruppo="Insegna"
        selezionata="k3"
        onSeleziona={vi.fn()}
        {...props}
      />
    );

  it("una colonna per volantino, come opzione con nome; quella scelta è selezionata ed etichettata", () => {
    disegna();

    const opzioni = screen.getAllByRole("option");
    expect(opzioni).toHaveLength(3);
    expect(screen.getByRole("option", { name: /Promo ottobre/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Promo marzo/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Selezionato · 148")).toBeInTheDocument();
  });

  it("clic e frecce scelgono il volantino", () => {
    const onSeleziona = vi.fn();
    disegna({ onSeleziona });

    fireEvent.click(screen.getByRole("option", { name: /Promo marzo/ }));
    fireEvent.keyDown(screen.getByRole("option", { name: /Promo ottobre/ }), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("option", { name: /Promo ottobre/ }), { key: "Home" });

    expect(onSeleziona.mock.calls).toEqual([["k1"], ["k2"], ["k1"]]);
  });

  it("fascia delle insegne con le etichette, eventi e legenda di insegne ed eventi", () => {
    disegna();

    const grafico = screen.getByRole("group", { name: "Timeline dei volantini" });
    expect(within(grafico).getByText("Conad City · Liguria")).toBeInTheDocument();
    expect(within(grafico).getByText("Diventa Conad Superstore")).toBeInTheDocument();
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Conad City", "Conad Superstore", "cambio di insegna"]);
  });

  it("lo zoom su un anno mostra solo i suoi volantini e i mesi sull'asse", () => {
    disegna({ intervallo: { dal: "2025-01-01", al: "2025-12-31" } });

    expect(screen.getAllByRole("option")).toHaveLength(2);
    const grafico = screen.getByRole("group", { name: "Timeline dei volantini" });
    expect(within(grafico).getByText("gen")).toBeInTheDocument();
    expect(within(grafico).queryByText("2024")).not.toBeInTheDocument();
  });

  it("i volantini con la stessa data (le varianti per area) si affiancano invece di coprirsi, e ognuno si sceglie", () => {
    const onSeleziona = vi.fn();
    render(
      <TimelineVolantini
        colonne={["Emilia", "Liguria", "Piemonte"].map(area => ({ id: area, data: "2026-10-26", valore: 148, gruppo: "city", titolo: `Promo ${area}` }))}
        gruppi={gruppi}
        titolo="Timeline dei volantini"
        descrizioneValore="Referenze"
        onSeleziona={onSeleziona}
      />
    );

    const aree = screen.getAllByRole("option").map(opzione => ({ x: Number(opzione.getAttribute("x")), w: Number(opzione.getAttribute("width")) }));
    expect(new Set(aree.map(a => a.x)).size).toBe(3);
    for (let i = 1; i < aree.length; i++) expect(aree[i].x).toBeGreaterThanOrEqual(aree[i - 1].x + aree[i - 1].w - 0.01);
    fireEvent.click(screen.getByRole("option", { name: /Promo Liguria/ }));
    expect(onSeleziona).toHaveBeenCalledWith("Liguria");
  });

  it("il tooltip della colonna dice volantino, referenze e insegna", () => {
    disegna();

    fireEvent.mouseMove(screen.getByRole("option", { name: /Promo maggio/ }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Promo maggio");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Referenze160");
    expect(screen.getByRole("tooltip")).toHaveTextContent("InsegnaConad Superstore");
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

describe("distanziaColonne", () => {
  it("affianca le colonne con la stessa data attorno alla data e lascia dove sono quelle lontane", () => {
    expect(distanziaColonne([100, 100, 100, 300], 10)).toEqual([90, 100, 110, 300]);
  });

  it("un gruppo che sporgerebbe oltre il margine destro rientra, tenendo la distanza", () => {
    expect(distanziaColonne([100, 100, 105], 10, 0, 112)).toEqual([92, 102, 112]);
  });
});
