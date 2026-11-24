import { describe, expect, it } from "vitest";
import type { RegolaMenabo, ValoreSuggerito } from "../../../lib/impostazioniGdo/tipi";
import { regoleDaValori } from "./regoleDaValori";

let contatore = 0;
const id = () => `nuova-${++contatore}`;

const VALORI: ValoreSuggerito[] = [
  { valore: "DIS-DISPENSA_doppia", referenze: 40, nomeLeggibile: "Dispensa" },
  { valore: "DIS-DISPENSA_singola", referenze: 11, nomeLeggibile: "Dispensa" },
  { valore: "OF-ORTOFRUTTA", referenze: 90, nomeLeggibile: "Ortofrutta" },
  { valore: "PB-Pagina bianca", referenze: 3, nomeLeggibile: null },
];

describe("regoleDaValori", () => {
  it("una regola per ogni nome leggibile, dalla più usata, con tutti i valori che lo danno", () => {
    const { regole, saltate } = regoleDaValori("mastro", VALORI, [], id);

    expect(saltate).toBe(0);
    expect(regole.map(r => [r.titolo, r.sezione])).toEqual([
      ["Da mastro: Ortofrutta", "Ortofrutta"],
      ["Da mastro: Dispensa", "Dispensa"],
      ["Da mastro: non è una sezione", null],
    ]);
    expect(regole[0].condizione.figli).toEqual([{ tipo: "condizione", campo: "mastro", operatore: "uguale", valore: "OF-ORTOFRUTTA", valori: [] }]);
    expect(regole[1].condizione.figli).toEqual([
      { tipo: "condizione", campo: "mastro", operatore: "uno_di", valore: "", valori: ["DIS-DISPENSA_doppia", "DIS-DISPENSA_singola"] },
    ]);
    expect(regole.every(r => r.livello === "box" && r.colore === null)).toBe(true);
  });

  it("i nomi che differiscono solo per maiuscole e spazi sono lo stesso gruppo", () => {
    const { regole } = regoleDaValori("mastro", [
      { valore: "F-Focus Pulizia Casa", referenze: 5, nomeLeggibile: "Focus Pulizia Casa" },
      { valore: "K-PULIZIA", referenze: 4, nomeLeggibile: "Focus puliziacasa" },
    ], [], id);

    expect(regole).toHaveLength(1);
    expect(regole[0].condizione.figli[0]).toMatchObject({ operatore: "uno_di", valori: ["F-Focus Pulizia Casa", "K-PULIZIA"] });
  });

  it("una regola con lo stesso titolo già presente non si ripete", () => {
    const esistenti = [{ id: "x", titolo: "Da mastro: Dispensa" }] as RegolaMenabo[];

    const { regole, saltate } = regoleDaValori("mastro", VALORI, esistenti, id);

    expect(saltate).toBe(1);
    expect(regole.map(r => r.sezione)).toEqual(["Ortofrutta", null]);
  });

  it("senza nome leggibile (campo senza libreria) il nome è il valore stesso", () => {
    const { regole } = regoleDaValori("tema", [{ valore: "rilancio", referenze: 2 }], [], id);

    expect(regole[0]).toMatchObject({ titolo: "Da tema: rilancio", sezione: "rilancio" });
  });

  it("nessun valore: nessuna regola", () => {
    expect(regoleDaValori("mastro", [], [], id)).toEqual({ regole: [], saltate: 0 });
  });
});
