import type { AnalisiMomentoTracciato, DataFields } from "../../../../../lib/types";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

    //I20-1255: PIU VALORE entra in FORMAT+ come gli altri temi con «+»; solo SPENDI PUNTI resta nel suo tema.
    expect(groupsA.get("format1:FORMAT+")).toBe(2);
    expect(groupsA.get("tema:Ortofrutta")).toBe(1);
    expect(groupsA.get("tema:SPENDI PUNTI EXTRA (F) ZAINO STARTER")).toBe(1);
    expect(groupsA.has("tema:PIU VALORE SOCI (OS15A)")).toBe(false);
    expect(groupsA.has("tema:Vini")).toBe(false);
    expect(groupsB.get("format1:FORMAT+")).toBe(1);
    expect(groupsB.get("tema:Cantina")).toBe(1);
    expect(groupsB.has("tema:Dispensa")).toBe(false);

    const formatPlusA = sezioneA?.raggruppamento.find((g) => g.nome_campo === "format1" && g.valore_campo === "FORMAT+");
    const formatPlusB = sezioneB?.raggruppamento.find((g) => g.nome_campo === "format1" && g.valore_campo === "FORMAT+");
    expect(formatPlusA?.records.map((record) => record.tema)).toEqual(["Vini", "PIU VALORE SOCI (OS15A)"]);
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
                // Dati sporchi del tracciato: numeri al posto delle stringhe
                { tema: 123, reparto: 7 } as unknown as Record<string, string>,
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
      { limite: 3, ordine: 1, criteri: [{ chiave: "tema", operatore: "IN", valore: "JOLLY" }] },
    ]);
  });
});

describe("coopfi menabo con lo stato in volantino core", () => {
  const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);

  it("esclude dal raggruppamento per tema le referenze fuori volantino, dal campo core o dal tema", async () => {
    const inVol = { tema: "SPRINT", "Scatto.CodiceGruppo": "G001", "Referenza.InVolantino": true };
    const fuoriDalPlugin = { tema: "SPRINT", "Scatto.CodiceGruppo": "G002", "Referenza.InVolantino": "false" };
    const fuoriDaListaVecchia = { tema: "FUORI DEPLIANT FOOD", "Scatto.CodiceGruppo": "G003" };

    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [inVol, fuoriDalPlugin, fuoriDaListaVecchia]),
    ], { tipoDivisione: "canale", dataDivisione: [] });

    const canale1 = result.risultati.find(s => s.id === "canale-1")!;
    expect(canale1.raggruppamento.map(g => [g.valore_campo, g.conteggio])).toEqual([["SPRINT", 1]]);
    expect(canale1.raggruppamento[0].records[0]["Scatto.CodiceGruppo"]).toBe("G001");
  });
});

describe("coopfi menabo: identità delle referenze", () => {
  it("riconosce una referenza dal codice del gruppo di scatto, altrimenti dal codice referenza", () => {
    const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);

    expect(sut.CAMPI_IDENTITA_MENABO).toEqual(["Scatto.CodiceGruppo", "Referenza.Codice"]);
  });
});

describe("coopfi menabo: numero di pagine scritto a mano (I20-1256)", () => {
  it("per Coop il numero di pagine si scrive a mano e da 5 pagine tolte si chiede conferma", () => {
    const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);

    expect(sut.MENABO_PAGINE_A_MANO).toEqual({ confermaDaPagineTolte: 5 });
  });
});

describe("coopfi menabo: colonna dei gruppi ridimensionabile (I20-1258)", () => {
  it("per Coop la colonna dei gruppi del menabò si ridimensiona", () => {
    const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);

    expect(sut.MENABO_COLONNA_GRUPPI_RIDIMENSIONABILE).toBe(true);
  });
});

describe("coopfi menabo: etichette della tendina (I20-1259)", () => {
  it("per Coop le etichette del menabò sono queste sette, in quest'ordine", () => {
    const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);

    expect(sut.MENABO_ETICHETTE).toEqual([
      "RICETTA",
      "COPERTINA",
      "JOLLY",
      "PRODOTTO ATTRAZIONE",
      "SPENDI PUNTI",
      "PRODOTTI SPRINT",
      "PROMO WEE",
    ]);
  });
});

describe("coopfi menabo: CAMPIONI DEL RISPARMIO per sconto (I20-1255)", () => {
  const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);
  const campioni = (codice: string, sconto: unknown) => ({
    tema: "CAMPIONI DEL RISPARMIO (OS20A) 62UFI+13TDM",
    reparto: "Drogheria",
    txt_sconto: sconto as string,
    "Scatto.CodiceGruppo": `G${codice}`,
    codice_referenza: codice,
  });
  const pagina = (groups: Array<{ id: string; records: Array<Record<string, string>>; unioneId?: string }>) => ({
    divisionId: "canale-1",
    divisionLabel: "Canale 1",
    pageCount: 1,
    updatedAt: new Date().toISOString(),
    pages: [{
      pageIndex: 0,
      pageNumber: 1,
      referenzePerPagina: 20,
      groups: groups.map(g => ({
        id: g.id,
        groupId: g.id,
        sourceKey: "s",
        label: g.id,
        colorIdx: 0,
        recordKeys: g.records.map((_, i) => String(i)),
        records: g.records,
        recordCount: g.records.length,
        ...(g.unioneId ? { unioneId: g.unioneId } : {}),
      })),
    }],
  });

  it("nel menabò il tema segue lo sconto, dal più alto al più basso, vuoto in fondo", async () => {
    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [
        campioni("1", "20"),
        campioni("2", ""),
        campioni("3", "40"),
        campioni("4", "30"),
        campioni("5", "0"),
      ]),
    ], { tipoDivisione: "canale", dataDivisione: [] });

    const gruppo = result.risultati[0].raggruppamento.find(g => g.valore_campo.startsWith("CAMPIONI"));
    expect(gruppo?.records.map(r => r.codice_referenza)).toEqual(["3", "4", "1", "2", "5"]);
  });

  it("a parità di sconto resta l'ordine di arrivo (merceologico)", async () => {
    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [campioni("1", "30"), campioni("2", "40"), campioni("3", "30")]),
    ], { tipoDivisione: "canale", dataDivisione: [] });

    const gruppo = result.risultati[0].raggruppamento.find(g => g.valore_campo.startsWith("CAMPIONI"));
    expect(gruppo?.records.map(r => r.codice_referenza)).toEqual(["2", "1", "3"]);
  });

  it("gli altri temi non cambiano ordine", async () => {
    const altro = (codice: string, sconto: string) => ({
      tema: "Ortofrutta", txt_sconto: sconto, "Scatto.CodiceGruppo": `G${codice}`, codice_referenza: codice,
    });
    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [altro("1", "10"), altro("2", "50")]),
    ], { tipoDivisione: "canale", dataDivisione: [] });

    const gruppo = result.risultati[0].raggruppamento.find(g => g.valore_campo === "Ortofrutta");
    expect(gruppo?.records.map(r => r.codice_referenza)).toEqual(["1", "2"]);
  });

  it("verso il Plugin esporta un filtro per sconto, dal più alto al più basso, con il vuoto in fondo", () => {
    const payload = sut.buildIndesignPluginJson(pagina([
      { id: "campioni", records: [campioni("1", "20"), campioni("2", ""), campioni("3", "40"), campioni("4", "40")] },
    ]));

    const filtri = payload.source[0].filtri;
    expect(filtri.map(f => f.criteri.map(c => c.valore))).toEqual([
      ["CAMPIONI DEL RISPARMIO (OS20A) 62UFI+13TDM", "40"],
      ["CAMPIONI DEL RISPARMIO (OS20A) 62UFI+13TDM", "20"],
      ["CAMPIONI DEL RISPARMIO (OS20A) 62UFI+13TDM", ""],
    ]);
    expect(filtri.map(f => f.limite)).toEqual([2, 1, 1]);
    expect(filtri.map(f => f.ordine)).toEqual([1, 2, 3]);
    expect(filtri[0].criteri[1]).toEqual({ chiave: "txt_sconto", operatore: "=", valore: "40" });
  });

  // Task 17ac016e: sottogruppi a fasce di dieci punti, poi lo sconto preciso.
  const gruppoCampioni = async (sconti: unknown[]) => {
    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", sconti.map((s, i) => campioni(String(i + 1), s))),
    ], { tipoDivisione: "canale", dataDivisione: [] });
    return result.risultati[0].raggruppamento.find(g => g.valore_campo.startsWith("CAMPIONI"))!;
  };

  it("i sottogruppi di CAMPIONI sono la fascia di sconto e poi lo sconto preciso", async () => {
    const gruppo = await gruppoCampioni(["40", "45"]);
    expect(gruppo.chiavi_sottogruppi).toEqual([
      { nome_campo: "fascia_sconto", label: "Fascia di sconto" },
      { nome_campo: "txt_sconto", label: "Sconto" },
    ]);
  });

  it("ogni referenza porta la sua fascia: 45 e 40 in 40-49, 30 in 30-39, vuoto e zero senza sconto", async () => {
    const gruppo = await gruppoCampioni(["45", "40", "30", "", "0"]);
    expect(gruppo.records.map(r => [r.txt_sconto, r.fascia_sconto])).toEqual([
      ["45", "40-49"], ["40", "40-49"], ["30", "30-39"], ["", "Senza sconto"], ["0", "Senza sconto"],
    ]);
  });

  it("lo sconto decimale, con «%» o con il segno meno sta nella fascia giusta", async () => {
    const gruppo = await gruppoCampioni(["32,5", "-30%", "9", "100"]);
    expect(gruppo.records.map(r => r.fascia_sconto)).toEqual(["100-109", "30-39", "30-39", "0-9"]);
  });

  it("le fasce restano in ordine decrescente, con «Senza sconto» in fondo", async () => {
    const gruppo = await gruppoCampioni(["", "20", "45", "35", "40"]);
    expect([...new Set(gruppo.records.map(r => r.fascia_sconto))]).toEqual(["40-49", "30-39", "20-29", "Senza sconto"]);
  });

  it("la fascia non diventa un campo filtro e non cambia i record del tracciato", async () => {
    const origine = [campioni("1", "40"), campioni("2", "20")];
    const result = await sut.getDatoPerMenabo([buildTracciato("canale-1", "area-1", origine)], { tipoDivisione: "canale", dataDivisione: [] });
    expect(result.risultati[0].campi_filtro.map(c => c.nome_campo)).not.toContain("fascia_sconto");
    expect(origine.every(r => !("fascia_sconto" in r))).toBe(true);
  });

  it("gli altri temi tengono i sottogruppi per reparto, senza fascia", async () => {
    const result = await sut.getDatoPerMenabo([
      buildTracciato("canale-1", "area-1", [{ tema: "Ortofrutta", reparto: "Frutta", txt_sconto: "40", "Scatto.CodiceGruppo": "G1", codice_referenza: "1" }]),
    ], { tipoDivisione: "canale", dataDivisione: [] });
    const gruppo = result.risultati[0].raggruppamento.find(g => g.valore_campo === "Ortofrutta")!;
    expect(gruppo.chiavi_sottogruppi?.map(c => c.nome_campo)).toEqual(["reparto"]);
    expect(gruppo.records[0]).not.toHaveProperty("fascia_sconto");
  });

  it("una fascia trascinata sulla pagina esporta un filtro per sconto, senza il criterio della fascia", () => {
    const records = [campioni("1", "45"), campioni("2", "40"), campioni("3", "40")].map(r => ({ ...r, fascia_sconto: "40-49" }));
    const payload = sut.buildIndesignPluginJson({
      ...pagina([{ id: "campioni", records }]),
      pages: [{
        pageIndex: 0, pageNumber: 1, referenzePerPagina: 20,
        groups: [{
          id: "f", groupId: "f", label: "CAMPIONI · 40-49", colorIdx: 0,
          sourceKey: JSON.stringify(["canale-1", "sub", "fascia_sconto", "40-49"]),
          recordKeys: records.map((_, i) => String(i)), records, recordCount: records.length,
        }],
      }],
    } as never);

    const filtri = payload.source[0].filtri;
    expect(filtri.map(f => f.criteri.map(c => c.chiave))).toEqual([
      ["tema", "txt_sconto"], ["tema", "txt_sconto"],
    ]);
    expect(filtri.map(f => f.criteri[1].valore)).toEqual(["45", "40"]);
    expect(filtri.map(f => f.limite)).toEqual([1, 2]);
  });

  it("un solo sconto trascinato esporta un filtro con il solo sconto, una volta", () => {
    const records = [campioni("1", "40"), campioni("2", "40")];
    const payload = sut.buildIndesignPluginJson({
      divisionId: "canale-1", divisionLabel: "Canale 1", pageCount: 1, updatedAt: new Date().toISOString(),
      pages: [{
        pageIndex: 0, pageNumber: 1, referenzePerPagina: 20,
        groups: [{
          id: "s", groupId: "s", label: "CAMPIONI · 40%", colorIdx: 0,
          sourceKey: JSON.stringify(["canale-1", "sub", "txt_sconto", "40"]),
          recordKeys: ["0", "1"], records, recordCount: 2,
        }],
      }],
    } as never);

    expect(payload.source[0].filtri).toHaveLength(1);
    expect(payload.source[0].filtri[0].criteri.map(c => c.chiave)).toEqual(["tema", "txt_sconto"]);
    expect(payload.source[0].filtri[0].limite).toBe(2);
  });

  it("un tema normale resta un solo filtro, senza criterio di sconto", () => {
    const payload = sut.buildIndesignPluginJson(pagina([
      { id: "orto", records: [{ tema: "Ortofrutta", txt_sconto: "10" }, { tema: "Ortofrutta", txt_sconto: "20" }] },
    ]));

    expect(payload.source[0].filtri).toEqual([
      { limite: 2, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "Ortofrutta" }] },
    ]);
  });
});

describe("coopfi menabo: unione di gruppi (I20-1255)", () => {
  const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);
  const gruppo = (tema: string, quante: number, unioneId?: string) => ({
    id: `g-${tema}`,
    groupId: `g-${tema}`,
    sourceKey: "s",
    label: tema,
    colorIdx: 0,
    recordKeys: Array.from({ length: quante }, (_, i) => String(i)),
    records: Array.from({ length: quante }, () => ({ tema, reparto: "Drogheria" })),
    recordCount: quante,
    ...(unioneId ? { unioneId } : {}),
  });
  const layout = (pagine: Array<Array<ReturnType<typeof gruppo>>>) => ({
    divisionId: "canale-1",
    divisionLabel: "Canale 1",
    pageCount: pagine.length,
    updatedAt: new Date().toISOString(),
    pages: pagine.map((groups, i) => ({ pageIndex: i, pageNumber: i + 1, referenzePerPagina: 20, groups })),
  });

  it("Coop dichiara l'unione di gruppi", () => {
    expect(sut.MENABO_UNIONE_GRUPPI).toBe(true);
  });

  it("due temi uniti nella stessa pagina diventano un solo filtro con i temi come valori alternativi", () => {
    const payload = sut.buildIndesignPluginJson(layout([[gruppo("TEMA A", 3, "u1"), gruppo("TEMA B", 2, "u1")]]));

    expect(payload.source[0].filtri).toEqual([
      { limite: 5, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "TEMA A||TEMA B" }] },
    ]);
  });

  it("senza unione ogni tema ha il suo filtro e il suo ordine", () => {
    const payload = sut.buildIndesignPluginJson(layout([[gruppo("TEMA A", 3), gruppo("TEMA B", 2)]]));

    expect(payload.source[0].filtri.map(f => [f.criteri[0].valore, f.limite, f.ordine])).toEqual([
      ["TEMA A", 3, 1],
      ["TEMA B", 2, 2],
    ]);
  });

  it("l'unione su più pagine genera un filtro per pagina, col limite delle referenze di quella pagina", () => {
    const payload = sut.buildIndesignPluginJson(layout([
      [gruppo("TEMA A", 4, "u1"), gruppo("TEMA B", 1, "u1")],
      [gruppo("TEMA B", 3, "u1")],
    ]));

    expect(payload.source[0].filtri).toEqual([
      { limite: 5, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "TEMA A||TEMA B" }] },
    ]);
    expect(payload.source[1].filtri).toEqual([
      { limite: 3, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "TEMA B" }] },
    ]);
  });

  it("un gruppo fuori dall'unione tiene il suo filtro, e l'unione sta dove era il suo primo gruppo", () => {
    const payload = sut.buildIndesignPluginJson(layout([[
      gruppo("TEMA A", 2, "u1"),
      gruppo("ALTRO", 2),
      gruppo("TEMA B", 2, "u1"),
    ]]));

    expect(payload.source[0].filtri.map(f => [f.criteri[0].valore, f.limite, f.ordine])).toEqual([
      ["TEMA A||TEMA B", 4, 1],
      ["ALTRO", 2, 2],
    ]);
  });

  it("un'unione con CAMPIONI DEL RISPARMIO tiene a parte quel tema, ordinato per sconto", () => {
    const campioni = { ...gruppo("CAMPIONI DEL RISPARMIO", 0, "u1"), records: [
      { tema: "CAMPIONI DEL RISPARMIO", reparto: "Drogheria", txt_sconto: "30" },
      { tema: "CAMPIONI DEL RISPARMIO", reparto: "Drogheria", txt_sconto: "40" },
    ], recordCount: 2 };
    const payload = sut.buildIndesignPluginJson(layout([[gruppo("TEMA A", 2, "u1"), campioni]]));

    expect(payload.source[0].filtri.map(f => [f.criteri.map(c => c.valore).join("/"), f.limite, f.ordine])).toEqual([
      ["TEMA A", 2, 1],
      ["CAMPIONI DEL RISPARMIO/40", 1, 2],
      ["CAMPIONI DEL RISPARMIO/30", 1, 3],
    ]);
  });

  it("i temi jolly uniti restano `tema in JOLLY`", () => {
    const payload = sut.buildIndesignPluginJson(layout([[gruppo("2026 JOLLY A", 1, "u1"), gruppo("2026 JOLLY B", 1, "u1")]]));

    expect(payload.source[0].filtri).toEqual([
      { limite: 2, ordine: 1, criteri: [{ chiave: "tema", operatore: "IN", valore: "JOLLY" }] },
    ]);
  });
});

// Task 17ac016e: i filtri esportati devono essere letti dal Plugin senza errori. Il Plugin conosce solo gli
// operatori del suo picker (filtri.js, addCriterio), le chiavi dichiarate in campiFiltro del cliente e vuole
// limite intero positivo, ordine progressivo senza buchi e pagina in forma di testo.
describe("coopfi menabo: filtri esportati conformi al Plugin", () => {
  const sut = new CoopfiAgenziaLib({} as ConstructorParameters<typeof CoopfiAgenziaLib>[0]);
  const OPERATORI_DEL_PLUGIN = ["=", "!=", "IN", "!IN", ">", ">=", "<", "<="];
  const sorgenteCustom = JSON.parse(readFileSync(
    fileURLToPath(new URL("../../../../../../Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json", import.meta.url)),
    "utf8",
  ).replace(/^\uFEFF/, ""));
  const CHIAVI_DEL_PLUGIN: string[] = (sorgenteCustom.campiFiltro as Array<{ campoAssociato: string }>).map(c => c.campoAssociato);

  const gruppo = (tema: string, records: Array<Record<string, string>>, unioneId?: string) => ({
    id: `g-${tema}`,
    groupId: `g-${tema}`,
    sourceKey: "s",
    label: tema,
    colorIdx: 0,
    recordKeys: records.map((_, i) => String(i)),
    records,
    recordCount: records.length,
    ...(unioneId ? { unioneId } : {}),
  });
  const rec = (tema: string, extra: Record<string, string> = {}) => ({ tema, reparto: "Drogheria", ...extra });
  const layout = (pagine: Array<Array<ReturnType<typeof gruppo>>>) => ({
    divisionId: "canale-1",
    divisionLabel: "Canale 1",
    pageCount: pagine.length,
    updatedAt: new Date().toISOString(),
    pages: pagine.map((groups, i) => ({ pageIndex: i, pageNumber: i + 1, referenzePerPagina: 20, groups })),
  });

  const esportazioneMista = () => sut.buildIndesignPluginJson(layout([
    [
      gruppo("TEMA A", [rec("TEMA A"), rec("TEMA A")], "u1"),
      gruppo("TEMA B", [rec("TEMA B")], "u1"),
      gruppo("JOLLY UNO", [rec("JOLLY UNO"), rec("JOLLY UNO")]),
      gruppo("CAMPIONI DEL RISPARMIO", [
        rec("CAMPIONI DEL RISPARMIO", { txt_sconto: "20" }),
        rec("CAMPIONI DEL RISPARMIO", { txt_sconto: "40" }),
        rec("CAMPIONI DEL RISPARMIO", { txt_sconto: "" }),
      ]),
    ],
    [gruppo("TEMA B", [rec("TEMA B")], "u1"), gruppo("TEMA C", [rec("TEMA C")])],
    [],
  ]));

  it("ogni criterio usa un operatore e una chiave che il Plugin legge", () => {
    for (const pagina of esportazioneMista().source) {
      for (const filtro of pagina.filtri) {
        expect(filtro.criteri.length).toBeGreaterThan(0);
        for (const criterio of filtro.criteri) {
          expect(OPERATORI_DEL_PLUGIN).toContain(criterio.operatore);
          expect(CHIAVI_DEL_PLUGIN).toContain(criterio.chiave);
          expect(typeof criterio.valore).toBe("string");
          // Il solo valore che può essere vuoto è lo sconto di una referenza senza sconto (il Plugin lo legge <VUOTO>).
          if (criterio.chiave !== "txt_sconto") expect(criterio.valore.trim()).not.toBe("");
        }
      }
    }
  });

  it("il filtro Jolly usa IN maiuscolo, come la voce del picker del Plugin", () => {
    const filtri = esportazioneMista().source[0].filtri;
    const jolly = filtri.find(f => f.criteri.some(c => c.valore === "JOLLY"));
    expect(jolly?.criteri[0].operatore).toBe("IN");
  });

  it("limiti interi positivi, ordine progressivo senza buchi, pagina in forma di testo", () => {
    for (const pagina of esportazioneMista().source) {
      expect(typeof pagina.pagina).toBe("string");
      expect(typeof pagina.limite).toBe("number");
      pagina.filtri.forEach((filtro, i) => {
        expect(Number.isInteger(filtro.limite)).toBe(true);
        expect(filtro.limite).toBeGreaterThan(0);
        expect(filtro.ordine).toBe(i + 1);
      });
      expect(pagina.blocco).toBe(pagina.filtri.length === 0);
    }
  });

  it("l'unione resta un solo filtro con i temi separati da || e il limite di quella pagina", () => {
    const [p1, p2] = esportazioneMista().source;
    const unione1 = p1.filtri.filter(f => f.criteri[0].valore === "TEMA A||TEMA B");
    expect(unione1).toHaveLength(1);
    expect(unione1[0].limite).toBe(3);
    // Sulla seconda pagina l'unione ha un solo tema: il valore alternativo resta quello solo.
    expect(p2.filtri.find(f => f.criteri[0].valore === "TEMA B")?.limite).toBe(1);
  });

  it("CAMPIONI DEL RISPARMIO: un filtro per sconto, dal più alto al più basso, vuoto in fondo", () => {
    const filtri = esportazioneMista().source[0].filtri
      .filter(f => f.criteri[0].valore === "CAMPIONI DEL RISPARMIO");
    expect(filtri.map(f => f.criteri[1].valore)).toEqual(["40", "20", ""]);
  });
});
