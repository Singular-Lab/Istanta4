import type { AnalisiMomentoTracciato, DataFields } from "../../../../../lib/types";
import { describe, expect, it } from "vitest";
import { CoopfiAgenziaLib } from "../index.js";

const buildTracciato = (
  guidCanale: string,
  guidArea: string,
  records: DataFields[],
): AnalisiMomentoTracciato => ({
  guidCanale,
  guidArea,
  context: "ctx",
  records,
});

describe("coopfi menabo", () => {
  const sut = new CoopfiAgenziaLib({} as any);

  it("splits results by canale and deduplicates records by Scatto.CodiceGruppo", async () => {
    const ortoRecord = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", codice_referenza: "001", descrizione_uno: "Mele" };
    const viniRecord = { tema: "Vini", "Scatto.CodiceGruppo": "G002", codice_referenza: "002", descrizione_uno: "Chianti" };
    const ortoDuplicate = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", codice_referenza: "999", descrizione_uno: "Mele duplicate" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [ortoRecord, { ...ortoRecord }, viniRecord]),
      buildTracciato("canale-1", "area-2", [ortoDuplicate]),
      buildTracciato("canale-2", "area-1", [viniRecord]),
    ], { tipoDivisione: "canale", filtroCanale: "canale-1" });

    expect(result.tipoDivisione).toBe("canale");
    expect(result.risultati).toHaveLength(1);
    expect(result.risultati.map(s => s.guidCanale)).toEqual(["canale-1"]);

    const canale1 = result.risultati[0];
    expect(canale1.raggruppamento.map(g => [g.valore_campo, g.conteggio])).toEqual([
      ["Ortofrutta", 1],
      ["Vini", 1],
    ]);
    expect(canale1.raggruppamento[0].records[0].codice_referenza).toBe("001");
    expect(canale1.campi_filtro).toEqual([
      { nome_campo: "tema" },
      { nome_campo: "Scatto.CodiceGruppo" },
      { nome_campo: "codice_referenza" },
      { nome_campo: "descrizione_uno" },
    ]);
  });

  it("splits results by area", async () => {
    const record = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", codice_referenza: "001" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [record]),
      buildTracciato("canale-2", "area-1", [{ ...record, "Scatto.CodiceGruppo": "G002" }]),
      buildTracciato("canale-1", "area-2", [{ ...record, "Scatto.CodiceGruppo": "G003" }]),
    ], { tipoDivisione: "area" });

    expect(result.tipoDivisione).toBe("area");
    expect(result.risultati).toHaveLength(2);
    expect(result.risultati.map(s => s.guidArea)).toEqual(["area-1", "area-2"]);
  });

  it("splits results by area_e_canale", async () => {
    const record = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", codice_referenza: "001" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [record]),
      buildTracciato("canale-1", "area-2", [{ ...record, "Scatto.CodiceGruppo": "G002" }]),
      buildTracciato("canale-2", "area-1", [{ ...record, "Scatto.CodiceGruppo": "G003" }]),
    ], { tipoDivisione: "area_e_canale" });

    expect(result.tipoDivisione).toBe("area_e_canale");
    expect(result.risultati).toHaveLength(3);
    expect(result.risultati.map(s => `${s.guidCanale}:${s.guidArea}`)).toEqual([
      "canale-1:area-1",
      "canale-1:area-2",
      "canale-2:area-1",
    ]);
  });

  it("adds FORMAT+ macro-group for referenze with '+' in format1 across all channels", async () => {
    const result = await sut.getDatoPerMenabo([
      buildTracciato("A", "area-1", [
        { tema: "Ortofrutta", format1: "Iper", "Scatto.CodiceGruppo": "G001", codice_referenza: "001" },
        { tema: "Vini", format_1: "42UFI+17TDM+A", "Scatto.CodiceGruppo": "G002", codice_referenza: "002" },
        { tema: "SPENDI PUNTI EXTRA (F) ZAINO STARTER", format1: "26UFI+3TDM", "Scatto.CodiceGruppo": "G005", codice_referenza: "005" },
        { tema: "PIU VALORE SOCI (OS15A)", format1: "25UFI+13TDM", "Scatto.CodiceGruppo": "G006", codice_referenza: "006" },
      ]),
      buildTracciato("B", "area-1", [
        { tema: "Dispensa", format1: "X+Y", "Scatto.CodiceGruppo": "G003", codice_referenza: "003" },
        { tema: "Cantina", format1: "SenzaPlus", "Scatto.CodiceGruppo": "G004", codice_referenza: "004" },
      ]),
    ], { tipoDivisione: "canale" });

    const sezioneA = result.risultati.find((r) => r.id === "a");
    const sezioneB = result.risultati.find((r) => r.id === "b");

    expect(sezioneA).toBeDefined();
    expect(sezioneB).toBeDefined();

    const groupsA = new Map(sezioneA?.raggruppamento.map((g) => [`${g.nome_campo}:${g.valore_campo}`, g.conteggio]));
    const groupsB = new Map(sezioneB?.raggruppamento.map((g) => [`${g.nome_campo}:${g.valore_campo}`, g.conteggio]));

    expect(groupsA.get("format1:FORMAT+")).toBe(1);
    expect(groupsA.get("tema:Ortofrutta")).toBe(1);
    expect(groupsA.get("tema:SPENDI PUNTI EXTRA (F) ZAINO STARTER")).toBe(1);
    expect(groupsA.get("tema:PIU VALORE SOCI (OS15A)")).toBe(1);
    expect(groupsA.has("tema:Vini")).toBe(false);
    expect(groupsB.get("format1:FORMAT+")).toBe(1);
    expect(groupsB.get("tema:Cantina")).toBe(1);
    expect(groupsB.has("tema:Dispensa")).toBe(false);

    const formatPlusA = sezioneA?.raggruppamento.find((g) => g.nome_campo === "format1" && g.valore_campo === "FORMAT+");
    const formatPlusB = sezioneB?.raggruppamento.find((g) => g.nome_campo === "format1" && g.valore_campo === "FORMAT+");
    expect(formatPlusA?.records.map((record) => record.tema)).toEqual(["Vini"]);
    expect(formatPlusB?.records.map((record) => record.tema)).toEqual(["Dispensa"]);
    expect(formatPlusA?.chiavi_sottogruppi).toEqual([{ nome_campo: "tema", label: "Tema" }]);
    expect(formatPlusB?.chiavi_sottogruppi).toEqual([{ nome_campo: "tema", label: "Tema" }]);
  });

  it("builds InDesign filters grouped by tema only for normal groups (no reparto split) and supports non-string values", () => {
    const payload = sut.buildIndesignPluginJson({
      divisionId: "canale-1",
      divisionLabel: "Canale 1",
      pageCount: 1,
      updatedAt: new Date().toISOString(),
      pages: [
        {
          pageIndex: 0,
          pageNumber: 1,
          referenzePerPagina: 12,
          groups: [
            {
              id: "g1-1",
              groupId: "g1",
              sourceKey: "s1",
              label: "Gruppo 1",
              colorIdx: 0,
              recordKeys: ["r1", "r2", "r3"],
              records: [
                { tema: "Ortofrutta", reparto: "Frutta" },
                { tema: "Ortofrutta", reparto: "Verdura" },
                { tema: 123, reparto: 7 },
              ],
              recordCount: 3,
            },
          ],
        },
      ],
    });

    // I gruppi/tema normali producono un unico filtro per tema, senza criterio reparto,
    // e con limite 0 (il tetto è dato dal limite di pagina). Diversi reparti sotto lo
    // stesso tema NON generano filtri separati.
    expect(payload).toEqual({
      source: [
        {
          pagina: "1",
          active: false,
          blocco: false,
          limite: 12,
          filtri: [
            {
              limite: 0,
              ordine: 1,
              criteri: [
                { chiave: "tema", operatore: "=", valore: "Ortofrutta" },
              ],
            },
            {
              limite: 0,
              ordine: 2,
              criteri: [
                { chiave: "tema", operatore: "=", valore: "123" },
              ],
            },
          ],
        },
      ],
    });
  });

  it("keeps the reparto criterion when a reparto subgroup is dragged explicitly", () => {
    const repartoSourceKey = JSON.stringify([
      JSON.stringify(["canale-1", "tema", "Ortofrutta", 0]),
      "sub",
      "reparto",
      "Frutta",
    ]);

    const payload = sut.buildIndesignPluginJson({
      divisionId: "canale-1",
      divisionLabel: "Canale 1",
      pageCount: 1,
      updatedAt: new Date().toISOString(),
      pages: [
        {
          pageIndex: 0,
          pageNumber: 1,
          referenzePerPagina: 12,
          groups: [
            {
              id: "g1-1",
              groupId: "g1",
              sourceKey: repartoSourceKey,
              label: "Ortofrutta · Frutta",
              colorIdx: 0,
              recordKeys: ["r1", "r2"],
              records: [
                { tema: "Ortofrutta", reparto: "Frutta" },
                { tema: "Ortofrutta", reparto: "Frutta" },
              ],
              recordCount: 2,
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      source: [
        {
          pagina: "1",
          active: false,
          blocco: false,
          limite: 12,
          filtri: [
            {
              limite: 2,
              ordine: 1,
              criteri: [
                { chiave: "tema", operatore: "=", valore: "Ortofrutta" },
                { chiave: "reparto", operatore: "=", valore: "Frutta" },
              ],
            },
          ],
        },
      ],
    });
  });

  it("builds InDesign filters grouped by tema for FORMAT+ subgroups", () => {
    const formatPlusSourceKey = JSON.stringify([
      JSON.stringify(["canale-1", "format1", "FORMAT+", 0]),
      "sub",
      "tema",
      "Vini",
    ]);

    const payload = sut.buildIndesignPluginJson({
      divisionId: "canale-1",
      divisionLabel: "Canale 1",
      pageCount: 1,
      updatedAt: new Date().toISOString(),
      pages: [
        {
          pageIndex: 0,
          pageNumber: 1,
          referenzePerPagina: 12,
          groups: [
            {
              id: "g-format-1",
              groupId: "g-format",
              sourceKey: formatPlusSourceKey,
              label: "FORMAT+ · Vini",
              colorIdx: 0,
              recordKeys: ["r1", "r2"],
              records: [
                { tema: "Vini", reparto: "Cantina" },
                { tema: "Vini", reparto: "Enoteca" },
              ],
              recordCount: 2,
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      source: [
        {
          pagina: "1",
          active: false,
          blocco: false,
          limite: 12,
          filtri: [
            {
              limite: 2,
              ordine: 1,
              criteri: [
                { chiave: "tema", operatore: "=", valore: "Vini" },
              ],
            },
          ],
        },
      ],
    });
  });
});
