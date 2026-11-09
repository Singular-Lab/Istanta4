// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MASSIMO_CATEGORIE, tintaCategoria, tintaSequenziale, TINTA_NEUTRA } from "@/components/Grafici";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import type { BoxInsight, RepartoInsight } from "../../../../lib/insightVolantino/tipi";
import { MECCANICHE } from "../../../../lib/puntiVendita/analisi";
import { STATI_DIFFERENZA } from "../confronti/supporto";
import {
  coloriReparti,
  fasciaSconto,
  fasciaVisibilita,
  legendaDifferenze,
  legendaModo,
  stileBox,
  stileDifferenza,
  tintaSconto,
  tintaVisibilita,
} from "./colori";

// Colori dei riquadri del volantino: reparti dalla config o automatici, meccaniche, fasce di sconto
// e di visibilità, differenze fra varianti

type BoxColori = Pick<BoxInsight, "id" | "reparto" | "spazio" | "meccanica" | "sconto" | "visibilita">;
const box = (id: string, dati: Partial<BoxColori> = {}): BoxColori => ({
  id,
  reparto: null,
  spazio: 5,
  meccanica: null,
  sconto: null,
  visibilita: 50,
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

describe("fasce di sconto e di visibilità", () => {
  it("lo sconto cade nella sua fascia di 10 punti, l'ultima da 50% in su; senza sconto è neutro", () => {
    expect([0, 9.9, 10, 35, 50, 80].map(fasciaSconto)).toEqual([0, 0, 1, 3, 5, 5]);
    expect(fasciaSconto(null)).toBe(-1);
    expect(tintaSconto(35)).toEqual(tintaSequenziale(4));
    expect(tintaSconto(null)).toBe(TINTA_NEUTRA);
  });

  it("la visibilità va a fasce di 20 su 100", () => {
    expect([0, 19, 20, 79, 80, 100].map(fasciaVisibilita)).toEqual([0, 0, 1, 3, 4, 4]);
    expect(tintaVisibilita(100)).toEqual(tintaSequenziale(6));
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
    expect(legendaModo("visibilita", [box("a")], reparti).map(v => v.etichetta)).toEqual(["0–20", "20–40", "40–60", "60–80", "80–100"]);
  });
});

describe("differenze fra varianti", () => {
  it("i box prendono le tinte dei confronti; gli uguali e quelli senza stato sono attenuati", () => {
    expect(stileDifferenza("solo-qui")).toEqual({ tinta: STATI_DIFFERENZA["solo-qui"].tinta, attenuato: false });
    expect(stileDifferenza("uguale").attenuato).toBe(true);
    expect(stileDifferenza(undefined)).toEqual({ tinta: TINTA_NEUTRA, attenuato: true });
  });

  it("la legenda ha solo gli stati dei box del volantino, nell'ordine dei confronti", () => {
    const voci = legendaDifferenze([box("a"), box("b"), box("c")], { a: "uguale", b: "solo-qui", z: "solo-altra" });
    expect(voci.map(v => v.etichetta)).toEqual([STATI_DIFFERENZA["solo-qui"].etichetta, STATI_DIFFERENZA.uguale.etichetta]);
  });
});
