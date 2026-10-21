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
    ], { tipoDivisione: "canale", dataDivisione: [] });

    expect(result.tipoDivisione).toBe("canale");
    //Il contratto identifica la sezione con id (guid lowercase) e label, non con guidCanale.
    expect(result.risultati).toHaveLength(2);
    expect(result.risultati.map(s => s.id)).toEqual(["canale-1", "canale-2"]);

    const canale1 = result.risultati.find(s => s.id === "canale-1")!;
    expect(canale1.label).toBe("canale-1");
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

  it("dichiara i campi anteprima presenti nei record, sul naming effettivo", async () => {
    const conPrezzoPromo = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", reparto: "58-01", prezzo_promo: "1,49" };
    const conPrezzo = { tema: "Vini", "Scatto.CodiceGruppo": "G002", reparto: "62-03", prezzo: "3,90" };
    const senzaPrezzo = { tema: "Pane", "Scatto.CodiceGruppo": "G003", reparto: "70-01" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [conPrezzoPromo]),
      buildTracciato("canale-2", "area-1", [conPrezzo]),
      buildTracciato("canale-3", "area-1", [senzaPrezzo]),
    ], { tipoDivisione: "canale", dataDivisione: [] });

    const [primo, secondo, terzo] = result.risultati;
    // prezzo_promo vince su prezzo, ma se c'è solo prezzo si usa quello (naming per GDO)
    expect(primo.campi_anteprima).toEqual([
      { nome_campo: "reparto", label: "Reparto" },
      { nome_campo: "prezzo_promo", label: "Prezzo promo" },
    ]);
    expect(secondo.campi_anteprima).toEqual([
      { nome_campo: "reparto", label: "Reparto" },
      { nome_campo: "prezzo", label: "Prezzo promo" },
    ]);
    // campo assente nei record → non viene dichiarato
    expect(terzo.campi_anteprima).toEqual([{ nome_campo: "reparto", label: "Reparto" }]);
  });

  it("splits results by area", async () => {
    const record = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", codice_referenza: "001" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [record]),
      buildTracciato("canale-2", "area-1", [{ ...record, "Scatto.CodiceGruppo": "G002" }]),
      buildTracciato("canale-1", "area-2", [{ ...record, "Scatto.CodiceGruppo": "G003" }]),
    ], { tipoDivisione: "area", dataDivisione: [] });

    expect(result.tipoDivisione).toBe("area");
    expect(result.risultati).toHaveLength(2);
    expect(result.risultati.map(s => s.id)).toEqual(["area-1", "area-2"]);
    expect(result.risultati.map(s => s.label)).toEqual(["area-1", "area-2"]);
  });

  it("splits results by area_e_canale", async () => {
    const record = { tema: "Ortofrutta", "Scatto.CodiceGruppo": "G001", codice_referenza: "001" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [record]),
      buildTracciato("canale-1", "area-2", [{ ...record, "Scatto.CodiceGruppo": "G002" }]),
      buildTracciato("canale-2", "area-1", [{ ...record, "Scatto.CodiceGruppo": "G003" }]),
    ], { tipoDivisione: "area_e_canale", dataDivisione: [] });

    expect(result.tipoDivisione).toBe("area_e_canale");
    expect(result.risultati).toHaveLength(3);
    expect(result.risultati.map(s => s.id)).toEqual([
      "canale-1:area-1",
      "canale-1:area-2",
      "canale-2:area-1",
    ]);
    expect(result.risultati.map(s => s.label)).toEqual([
      "canale-1 / area-1",
      "canale-1 / area-2",
      "canale-2 / area-1",
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
    ], { tipoDivisione: "canale", dataDivisione: [] });

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

    // I gruppi/tema normali producono un unico filtro per tema, senza criterio reparto:
    // diversi reparti sotto lo stesso tema NON generano filtri separati. Ogni filtro ha
    // come limite le referenze del proprio tema, non quelle dell'intero gruppo (I20-966).
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
              ],
            },
            {
              limite: 1,
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

  // I20-966: un tema trascinato intero usciva con limite 0 («Ill.» nel plug-in) e, sulla
  // pagina condivisa, si prendeva anche i posti dell'EX TRIPLA.
  it("gives a whole tema split over two pages the limit of its referenze on each page", () => {
    const sprintSourceKey = JSON.stringify(["canale-1", "tema", "SPRINT", 0]);
    const exTriplaSourceKey = JSON.stringify([
      JSON.stringify(["canale-1", "format1", "FORMAT+", 1]),
      "sub",
      "tema",
      "EX TRIPLA",
    ]);
    const sprint = (reparto: string) => ({ tema: "SPRINT", reparto });
    const exTripla = { tema: "EX TRIPLA", reparto: "Drogheria" };

    const payload = sut.buildIndesignPluginJson({
      divisionId: "canale-1",
      divisionLabel: "Canale 1",
      pageCount: 4,
      updatedAt: new Date().toISOString(),
      pages: [
        {
          pageIndex: 2,
          pageNumber: 3,
          referenzePerPagina: 12,
          groups: [
            {
              id: "g-sprint-p2",
              groupId: "g-sprint",
              sourceKey: sprintSourceKey,
              label: "SPRINT",
              colorIdx: 0,
              recordKeys: ["s1", "s2", "s3"],
              records: [sprint("Drogheria"), sprint("Bevande"), sprint("Bevande")],
              recordCount: 3,
            },
            {
              id: "g-extripla-p2",
              groupId: "g-extripla",
              sourceKey: exTriplaSourceKey,
              label: "FORMAT+ · EX TRIPLA",
              colorIdx: 1,
              recordKeys: ["e1", "e2"],
              records: [exTripla, exTripla],
              recordCount: 2,
            },
          ],
        },
        {
          pageIndex: 3,
          pageNumber: 4,
          referenzePerPagina: 12,
          groups: [
            {
              id: "g-sprint-p3",
              groupId: "g-sprint",
              sourceKey: sprintSourceKey,
              label: "SPRINT",
              colorIdx: 0,
              recordKeys: ["s4", "s5"],
              records: [sprint("Freschi"), sprint("Freschi")],
              recordCount: 2,
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      source: [
        {
          pagina: "3",
          active: false,
          blocco: false,
          limite: 12,
          filtri: [
            { limite: 3, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "SPRINT" }] },
            { limite: 2, ordine: 2, criteri: [{ chiave: "tema", operatore: "=", valore: "EX TRIPLA" }] },
          ],
        },
        {
          pagina: "4",
          active: false,
          blocco: false,
          limite: 12,
          filtri: [
            { limite: 2, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "SPRINT" }] },
          ],
        },
      ],
    });
  });

  it("sums the referenze of different jolly temi in the single `tema in JOLLY` filter", () => {
    const payload = sut.buildIndesignPluginJson({
      divisionId: "canale-1",
      divisionLabel: "Canale 1",
      pageCount: 2,
      updatedAt: new Date().toISOString(),
      pages: [
        {
          pageIndex: 1,
          pageNumber: 2,
          referenzePerPagina: 12,
          groups: [
            {
              id: "g-jolly-p1",
              groupId: "g-jolly",
              sourceKey: JSON.stringify(["canale-1", "tema", "JOLLY A", 0]),
              label: "JOLLY",
              colorIdx: 0,
              recordKeys: ["j1", "j2", "j3"],
              records: [
                { tema: "JOLLY A", reparto: "Drogheria" },
                { tema: "JOLLY A", reparto: "Bevande" },
                { tema: "jolly b", reparto: "Freschi" },
              ],
              recordCount: 3,
            },
          ],
        },
      ],
    });

    expect(payload.source[0].filtri).toEqual([
      { limite: 3, ordine: 1, criteri: [{ chiave: "tema", operatore: "in", valore: "JOLLY" }] },
    ]);
  });
});
