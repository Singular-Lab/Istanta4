// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MASSIMO_CATEGORIE, tintaCategoria, tintaSequenziale, TINTA_NEUTRA } from "@/components/Grafici";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import type { BoxInsight, RepartoInsight } from "../../../../lib/insightVolantino/tipi";
import { MECCANICHE } from "../../../../lib/puntiVendita/analisi";
import { coloreMarketing, coloriReparti, fasciaSconto, gruppoBox, legendaModo, stileBox, tintaSconto } from "./colori";

// Colori dei riquadri del volantino: reparti con il colore per il marketing, dalla config o
// automatici, meccaniche, fasce di sconto

type BoxColori = Pick<BoxInsight, "id" | "reparto" | "spazio" | "meccanica" | "sconto">;
const box = (id: string, dati: Partial<BoxColori> = {}): BoxColori => ({
  id,
  reparto: null,
  spazio: 5,
  meccanica: null,
  sconto: null,
  ...dati,
});
const reparto = (codice: string, descrizione: string): RepartoInsight => ({ codice, descrizione });

const DROGHERIA = reparto("01", "DROGHERIA ALIMENTARE");
const LATTICINI = reparto("24", "LATTICINI");
const VARIE = reparto("99", "VARIE");

// Solo le parti della config che servono ai colori: il resto non conta
const configurazione = (parti: Partial<FlyerInsightsConfig>): FlyerInsightsConfig => parti as FlyerInsightsConfig;

const MAPPA = configurazione({
  mappa: {
    title: "Mappa visiva",
    colorField: "reparto",
    colorStrategy: {
      type: "static",
      map: { "01": { hex: "#f97316", label: "Drogheria alimentare" } },
      default: { hex: "#64748b", label: "Altro" },
    },
    emptyState: { icon: "MapPinOff", message: "Nessuna referenza" },
  },
});

describe("colori dei reparti", () => {
  it("dalla mappa della config: il reparto fuori mappa prende il predefinito, la legenda dice i nomi", () => {
    const colori = coloriReparti([box("a", { reparto: DROGHERIA }), box("b", { reparto: VARIE })], MAPPA);

    expect(colori.daConfigurazione).toBe(true);
    expect(colori.tinta(DROGHERIA).colore).toBe("#f97316");
    expect(colori.tinta(VARIE).colore).toBe("#64748b");
    expect(colori.voci.map(v => v.etichetta)).toEqual(["Drogheria alimentare", "Altro"]);
  });

  it("la mappa riconosce il reparto anche dalla descrizione, senza badare alle maiuscole", () => {
    const perDescrizione = configurazione({
      mappa: { ...MAPPA.mappa!, colorStrategy: { type: "static", map: { "Latticini": { hex: "#3b82f6" } }, default: { hex: "#64748b" } } },
    });
    expect(coloriReparti([box("a", { reparto: LATTICINI })], perDescrizione).tinta(LATTICINI).colore).toBe("#3b82f6");
  });

  it("senza mappa valgono i colori dei reparti (anche a pattern), e con colorSource \"reparti\" vincono sulla mappa", () => {
    const reparti = configurazione({
      reparti: {
        title: "Reparti",
        chart: { type: "bar" },
        fields: { labelField: "descrizione", valueField: "numeroReferenze" },
        display: { showLegend: false },
        emptyState: { icon: "Info", message: "" },
        colorStrategy: { type: "pattern", matchers: [{ patterns: ["LATTI"], hex: "#0ea5e9", tw: "" }], default: { hex: "#94a3b8", tw: "" } },
      },
    });
    expect(coloriReparti([box("a", { reparto: LATTICINI })], reparti).tinta(LATTICINI).colore).toBe("#0ea5e9");
    expect(coloriReparti([box("a", { reparto: VARIE })], reparti).tinta(VARIE).colore).toBe("#94a3b8");

    const entrambe = configurazione({ ...reparti, mappa: { ...MAPPA.mappa!, colorSource: "reparti" } });
    expect(coloriReparti([box("a", { reparto: LATTICINI })], entrambe).tinta(LATTICINI).colore).toBe("#0ea5e9");
    // Senza colorSource la mappa resta la prima, come nella mappa di sempre
    const mappaPrima = configurazione({ ...reparti, mappa: MAPPA.mappa });
    expect(coloriReparti([box("a", { reparto: DROGHERIA })], mappaPrima).tinta(DROGHERIA).colore).toBe("#f97316");
  });

  it("senza config i colori sono automatici e assegnati per nome; il box senza reparto è neutro", () => {
    const colori = coloriReparti([box("a", { reparto: LATTICINI, spazio: 30 }), box("b", { reparto: DROGHERIA, spazio: 5 }), box("c")]);

    expect(colori.daConfigurazione).toBe(false);
    expect(colori.tinta(DROGHERIA)).toEqual(tintaCategoria(0));
    expect(colori.tinta(LATTICINI)).toEqual(tintaCategoria(1));
    expect(colori.tinta(null)).toBe(TINTA_NEUTRA);
    expect(colori.voci.map(v => v.etichetta)).toEqual(["DROGHERIA ALIMENTARE", "LATTICINI", "Reparto non noto"]);
  });

  it("oltre i colori distinti il reparto con meno spazio finisce negli altri", () => {
    const tanti = Array.from({ length: MASSIMO_CATEGORIE + 1 }, (_, i) => box(`b${i}`, { reparto: reparto(String(i), `Reparto ${i}`), spazio: 100 - i }));
    const colori = coloriReparti(tanti);

    expect(colori.tinta(reparto(String(MASSIMO_CATEGORIE), `Reparto ${MASSIMO_CATEGORIE}`))).toBe(TINTA_NEUTRA);
    expect(colori.voci.at(-1)?.etichetta).toBe("Altri reparti");
    expect(colori.voci).toHaveLength(MASSIMO_CATEGORIE);
  });
});

describe("fasce di sconto", () => {
  it("lo sconto cade nella sua fascia di 10 punti, l'ultima da 50% in su; senza sconto è neutro", () => {
    expect([0, 9.9, 10, 35, 50, 80].map(fasciaSconto)).toEqual([0, 0, 1, 3, 5, 5]);
    expect(fasciaSconto(null)).toBe(-1);
    expect(tintaSconto(35)).toEqual(tintaSequenziale(4));
    expect(tintaSconto(null)).toBe(TINTA_NEUTRA);
  });
});

describe("stile e legenda nel modo scelto", () => {
  const reparti = coloriReparti([]);

  it("un box senza il dato del modo è attenuato", () => {
    expect(stileBox(box("a"), "meccanica", reparti)).toEqual({ tinta: TINTA_NEUTRA, attenuato: true });
    expect(stileBox(box("a", { meccanica: "fidelity" }), "meccanica", reparti)).toEqual({
      tinta: tintaCategoria(MECCANICHE.indexOf("fidelity")),
      attenuato: false,
    });
    expect(stileBox(box("a", { sconto: 42 }), "sconto", reparti).attenuato).toBe(false);
    expect(stileBox(box("a"), "sconto", reparti).attenuato).toBe(true);
  });

  it("la legenda delle meccaniche ha solo quelle del volantino, più la voce dei box non riconosciuti", () => {
    const voci = legendaModo("meccanica", [box("a", { meccanica: "punti" }), box("b", { meccanica: "sconto" }), box("c")], reparti);
    expect(voci.map(v => v.etichetta)).toEqual(["Sconto in %", "Bollini e punti", "Non riconosciuta"]);
  });

  it("la legenda dello sconto ha tutte le fasce; \"Senza sconto\" solo se qualche box non ne ha", () => {
    const conSconto = legendaModo("sconto", [box("a", { sconto: 20 })], reparti).map(v => v.etichetta);
    expect(conSconto).toEqual(["0–10%", "10–20%", "20–30%", "30–40%", "40–50%", "≥ 50%"]);
    expect(legendaModo("sconto", [box("a")], reparti).at(-1)?.etichetta).toBe("Senza sconto");
  });
});

describe("gruppo di un box per la ripartizione della pagina", () => {
  const automatici = coloriReparti([box("a", { reparto: LATTICINI }), box("b", { reparto: DROGHERIA })]);

  it("per reparto: il nome del reparto con la tinta del suo riquadro, \"Reparto non noto\" senza", () => {
    const gruppo = gruppoBox(box("a", { reparto: LATTICINI }), "reparto", automatici);
    expect(gruppo).toEqual({ id: "24", etichetta: "LATTICINI", tinta: automatici.tinta(LATTICINI) });
    expect(gruppoBox(box("x"), "reparto", automatici)).toEqual({ id: "senza", etichetta: "Reparto non noto", tinta: TINTA_NEUTRA });
  });

  it("per reparto con la config: il reparto fuori mappa resta col suo nome, non \"Altri reparti\"", () => {
    const conMappa = coloriReparti([box("a", { reparto: VARIE })], MAPPA);
    expect(gruppoBox(box("a", { reparto: VARIE }), "reparto", conMappa).etichetta).toBe("VARIE");
  });

  it("per meccanica e per fascia di sconto: stessi id e tinte della legenda", () => {
    expect(gruppoBox(box("a", { meccanica: "fidelity" }), "meccanica", automatici)).toEqual({
      id: "fidelity",
      etichetta: "Prezzo Fidelity",
      tinta: tintaCategoria(MECCANICHE.indexOf("fidelity")),
    });
    expect(gruppoBox(box("a"), "meccanica", automatici).etichetta).toBe("Non riconosciuta");
    const fascia = gruppoBox(box("a", { sconto: 32 }), "sconto", automatici);
    const voce = legendaModo("sconto", [box("a", { sconto: 32 })], automatici).find(v => v.id === fascia.id);
    expect(fascia).toEqual({ id: "sconto-3", etichetta: "30–40%", tinta: voce?.tinta });
    expect(gruppoBox(box("a"), "sconto", automatici)).toEqual({ id: "senza", etichetta: "Senza sconto", tinta: TINTA_NEUTRA });
  });
});

describe("colori per il marketing dei reparti", () => {
  const FRESCHI = { codice: "24", descrizione: "Freschissimi", colore: "#0ea5e9" };

  it("il colore per il marketing della GDO vale più della config, con il nome per il marketing in legenda", () => {
    const colori = coloriReparti([box("a", { reparto: { ...DROGHERIA, colore: "#16a34a" } }), box("b", { reparto: VARIE })], MAPPA);

    expect(colori.tinta({ ...DROGHERIA, colore: "#16a34a" }).colore).toBe("#16a34a");
    // Il reparto senza colore per il marketing resta sulla config
    expect(colori.tinta(VARIE).colore).toBe("#64748b");
    expect(colori.voci.map(v => v.etichetta)).toEqual(["DROGHERIA ALIMENTARE", "Altro"]);
    expect(stileBox(box("a", { reparto: { ...DROGHERIA, colore: "#16a34a" } }), "reparto", colori).tinta.colore).toBe("#16a34a");
  });

  it("senza config i reparti con il colore per il marketing lo tengono e gli altri prendono la palette", () => {
    const colori = coloriReparti([box("a", { reparto: FRESCHI }), box("b", { reparto: VARIE }), box("c")]);

    expect(colori.tinta(FRESCHI).colore).toBe("#0ea5e9");
    expect(colori.tinta(VARIE)).toEqual(tintaCategoria(0));
    expect(colori.voci.map(v => v.etichetta)).toEqual(["Freschissimi", "VARIE", "Reparto non noto"]);
    expect(gruppoBox(box("a", { reparto: FRESCHI }), "reparto", colori)).toEqual({ id: "24", etichetta: "Freschissimi", tinta: colori.tinta(FRESCHI) });
  });

  it("un nome per il marketing condiviso da più box è una voce sola; un colore non valido non conta", () => {
    const colori = coloriReparti([box("a", { reparto: FRESCHI }), box("b", { reparto: FRESCHI }), box("c", { reparto: { ...VARIE, colore: "blu" } })]);

    expect(colori.voci.filter(v => v.etichetta === "Freschissimi")).toHaveLength(1);
    expect(coloreMarketing({ colore: "blu" })).toBeNull();
    expect(coloreMarketing({ colore: " #ABC " })).toBe("#ABC");
    expect(coloreMarketing(null)).toBeNull();
    expect(colori.tinta({ ...VARIE, colore: "blu" })).toEqual(tintaCategoria(0));
  });
});
