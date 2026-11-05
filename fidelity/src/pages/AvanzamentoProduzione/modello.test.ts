import { describe, expect, it } from "vitest";
import type { STATO_PROMO } from "../../../lib/enums";
import type { StatoKitMateriali } from "../../../lib/materiali/tipi";
import type { KitAvanzamento, PromoAvanzamento, TipoKitAvanzamento } from "../../../lib/produzione/avanzamento";
import {
  ELEMENTI_DA_GUARDARE,
  FILTRI_VUOTI,
  descriviScadenza,
  ordinaKit,
  promoVisibili,
  type FiltriAvanzamento,
  type IdElemento,
} from "./modello";

const kit = (titolo: string, stato: `${StatoKitMateriali}`, tipo: TipoKitAvanzamento = "VOL", area = "Toscana"): KitAvanzamento => ({
  id: stato === "NON_AVVIATO" ? null : `id-${titolo}`,
  idDesign: `design-${titolo}`,
  titolo,
  tipo,
  stato: stato as StatoKitMateriali,
  area: { id: `area-${area}`, nome: area },
  canale: { id: "canale-ss", nome: "Superstore" },
  numeroFile: 0,
  fileAccettati: 0,
  fileInErrore: 0,
  avviatoIl: null,
});

const promo = (nome: string, giorni: number | null, kits: KitAvanzamento[], stato = "IN_LAVORAZIONE"): PromoAvanzamento => ({
  id: nome,
  nome,
  stato: stato as STATO_PROMO,
  validitaDal: null,
  validitaAl: null,
  scadenzaLavorazione: null,
  giorniAllaScadenza: giorni,
  kit: kits,
  nonAvviatiDisponibili: true,
});

const elemento = (id: IdElemento) => ELEMENTI_DA_GUARDARE.find((voce) => voce.id === id)!;

const PROMOZIONI = [
  promo("In ritardo", -2, [kit("A", "IN_LAVORAZIONE_CON_ERRORI"), kit("B", "IN_REVISIONE", "POP")]),
  promo("Fra tre giorni", 3, [kit("C", "IN_REVISIONE"), kit("D", "NON_AVVIATO", "VOL", "Liguria")]),
  promo("Fra nove giorni", 9, [kit("E", "PUBBLICATO", "POP", "Liguria")]),
];

describe("elementi da guardare", () => {
  it("contano kit con errori, in revisione, non avviati, promo in ritardo e in scadenza entro 7 giorni", () => {
    const conteggi = ELEMENTI_DA_GUARDARE.map((voce) => [voce.id, voce.conta(PROMOZIONI, FILTRI_VUOTI)]);
    expect(conteggi).toEqual([
      ["errori", 1],
      ["revisione", 2],
      ["ritardo", 1],
      ["scadenza", 1],
      ["nonAvviati", 1],
    ]);
  });

  it("scegliendo un elemento restano solo le promo che ne fanno parte", () => {
    expect(PROMOZIONI.filter((p) => elemento("errori").riguarda(p, FILTRI_VUOTI)).map((p) => p.nome)).toEqual(["In ritardo"]);
    expect(PROMOZIONI.filter((p) => elemento("revisione").riguarda(p, FILTRI_VUOTI)).map((p) => p.nome)).toEqual([
      "In ritardo",
      "Fra tre giorni",
    ]);
  });

  it("con un filtro di tipo contano solo i kit di quel tipo, e restano solo le promo che ne hanno", () => {
    const soloPop: FiltriAvanzamento = { ...FILTRI_VUOTI, tipo: "POP" };
    const visibili = promoVisibili(PROMOZIONI, soloPop);

    expect(visibili.map((p) => p.nome)).toEqual(["In ritardo", "Fra nove giorni"]);
    expect(elemento("revisione").conta(visibili, soloPop)).toBe(1);
    expect(elemento("errori").conta(visibili, soloPop)).toBe(0);
  });

  it("il filtro per area tiene le promo con almeno un kit dell'area", () => {
    const liguria: FiltriAvanzamento = { ...FILTRI_VUOTI, area: "area-Liguria" };
    expect(promoVisibili(PROMOZIONI, liguria).map((p) => p.nome)).toEqual(["Fra tre giorni", "Fra nove giorni"]);
  });
});

describe("scadenza della lavorazione", () => {
  it.each([
    [-2, "In ritardo di 2 giorni", "danger"],
    [-1, "In ritardo di 1 giorno", "danger"],
    [0, "Scade oggi", "warning"],
    [1, "Scade domani", "warning"],
    [7, "Scade tra 7 giorni", "warning"],
    [9, "Tra 9 giorni", "neutral"],
    [null, "Senza scadenza", "neutral"],
  ])("%s giorni: %s", (giorni, testo, tono) => {
    expect(descriviScadenza(giorni)).toEqual({ testo, tono });
  });
});

it("i kit della promo si ordinano dai più urgenti: errori, revisione, lavorazione, non avviati, pubblicati", () => {
  const ordinati = ordinaKit([
    kit("Pubblicato", "PUBBLICATO"),
    kit("Da avviare", "NON_AVVIATO"),
    kit("POP in revisione", "IN_REVISIONE", "POP"),
    kit("VOL in revisione", "IN_REVISIONE"),
    kit("Con errori", "IN_LAVORAZIONE_CON_ERRORI"),
    kit("In lavorazione", "IN_LAVORAZIONE"),
  ]);
  expect(ordinati.map((k) => k.titolo)).toEqual([
    "Con errori",
    "VOL in revisione",
    "POP in revisione",
    "In lavorazione",
    "Da avviare",
    "Pubblicato",
  ]);
});
