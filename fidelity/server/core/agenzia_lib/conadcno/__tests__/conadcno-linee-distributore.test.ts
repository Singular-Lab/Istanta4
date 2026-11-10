import { describe, expect, it } from "vitest";
import type { IUserService } from "../../../interfaces/IUserService";
import { DefaultAgenziaLib } from "../../default/index.js";
import type { IAgenziaLib, TestiPerLinea } from "../../types.js";
import { ConadcnoAgenziaLib } from "../index.js";
import { lineaConadDaTesti } from "../linee-distributore.js";

// Spec insight-volantino, "Linee del distributore con loghi e bolli": CONAD CNO dichiara le sue
// linee e i bolli; la linea dai testi stampati segue la cascata di prodotto_conad di Istanta
// (AgenziaLib/Edro21.cs, getLoghiEBolliNew), un caso per ramo e i casi in cui conta l'ordine.

const testi = (marca: string | null, descrizione: string | null = null, gusto: string | null = null): TestiPerLinea => ({ marca, descrizione, gusto });

describe("CONAD CNO: linee e bolli dichiarati", () => {
  const { insightVolantino } = new ConadcnoAgenziaLib({} as IUserService);
  const linee = insightVolantino?.lineeDistributore;

  it("le linee nell'ordine in cui si mostrano, con il nome italiano", () => {
    expect(linee?.linee.map(linea => [linea.sigla, linea.nome])).toEqual([
      ["conad_logo", "Conad"],
      ["conad_saporidintorni", "Sapori & Dintorni"],
      ["conad_saporidintorniPQ", "Sapori & Dintorni Percorso Qualità"],
      ["conad_cpq", "Percorso Qualità"],
      ["conad_saporiidee", "Sapori & Idee"],
      ["conad_saporiideePQ", "Sapori & Idee Percorso Qualità"],
      ["conad_vn", "Verso Natura"],
      ["conad_bio", "Il Biologico"],
      ["conad_piacersi", "Piacersi"],
      ["conad_armomia", "Armomia"],
      ["conad_aslattosio", "Alimentum senza lattosio"],
      ["conad_asglutine", "Alimentum senza glutine"],
      ["conad_parafarmacia", "Parafarmacia"],
      ["conad_11p", "11 Paralleli"],
      ["conad_baby", "Baby"],
      ["conad_essentiae", "Essentiae"],
      ["conad_essentiae_LAB", "Essentiae Lab"],
      ["conad_petfrplus", "PetFriends Plus"],
      ["conad_PetFr", "PetFriends"],
    ]);
  });

  it("ogni linea ha un colore esadecimale diverso", () => {
    const colori = linee?.linee.map(linea => linea.colore) ?? [];
    expect(colori.every(colore => /^#[0-9a-f]{6}$/i.test(colore ?? ""))).toBe(true);
    expect(new Set(colori).size).toBe(colori.length);
  });

  it("i bolli da contare, con il loro nome", () => {
    expect(linee?.bolli?.map(bollo => [bollo.sigla, bollo.nome])).toEqual([
      ["dop", "DOP"],
      ["igp", "IGP"],
      ["LOGO_filiera", "Filiera controllata"],
      ["logo_BassieFissi", "Bassi e Fissi"],
      ["Logo_SDB", "Scelte di Benessere"],
      ["Logo_BDP", "Buono del Paese"],
      ["LOGO_bandiera_italiana", "Prodotto italiano"],
      ["LOGO_carneS_USOdiANTIBIOTICI", "Senza antibiotici"],
      ["LOGO_Carne_Chianina", "Chianina"],
      ["Logo_VistoinTV", "Visto in TV"],
      ["Logo_Agriqualità", "Agriqualità"],
      ["logo_selezione", "Selezione Conad"],
    ]);
  });

  it("la regola dai testi e' quella di CONAD CNO", () => {
    expect(linee?.lineaDaTesti?.(testi("CONAD SAPORI&DINTORNI"))).toBe("conad_saporidintorni");
  });

  it("il default non dichiara linee: la sezione non compare", () => {
    const predefinita: IAgenziaLib = new DefaultAgenziaLib({} as IUserService);
    expect(predefinita.insightVolantino?.lineeDistributore).toBeUndefined();
  });
});

describe("lineaConadDaTesti: un caso per ramo della cascata", () => {
  it.each([
    ["Armomia", testi("Conad Armomia"), "conad_armomia"],
    ["Il Biologico, anche con gli spazi tolti", testi("Conad", "Passata IL BIO LOGICO"), "conad_bio"],
    ["Sapori & Dintorni Percorso Qualità", testi("Conad Sapori&Dintorni", "Prosciutto", "Percorso Qualità"), "conad_saporidintorniPQ"],
    ["Sapori & Idee Percorso Qualità", testi("Conad Sapori&Idee", "Percorso qualità"), "conad_saporiideePQ"],
    ["Percorso Qualità, anche senza spazio", testi("Conad PercorsoQualità"), "conad_cpq"],
    ["Sapori & Dintorni", testi("CONAD SAPORI&DINTORNI"), "conad_saporidintorni"],
    ["Sapori & Idee", testi("Conad", null, "sapori&idee"), "conad_saporiidee"],
    ["Piacersi", testi("Conad Piacersi"), "conad_piacersi"],
    ["Alimentum senza lattosio", testi("Conad Alimentum", "Latte senza lattosio"), "conad_aslattosio"],
    ["Alimentum senza glutine", testi("Conad Alimentum", "Biscotti senza glutine"), "conad_asglutine"],
    ["Verso Natura", testi("Conad Verso Natura"), "conad_vn"],
    ["Parafarmacia", testi("Conad Parafarmacia"), "conad_parafarmacia"],
    ["11 Paralleli", testi("Conad 11 Paralleli"), "conad_11p"],
    ["Baby", testi("Conad Baby"), "conad_baby"],
    ["Essentiae Lab", testi("Conad Essentiae Lab"), "conad_essentiae_LAB"],
    ["Essentiae", testi("Conad Essentiae"), "conad_essentiae"],
    ["PetFriends Plus", testi("Conad PetFriends Plus"), "conad_petfrplus"],
    ["PetFriends", testi("Conad PetFriends"), "conad_PetFr"],
    ["nessuna linea: il logo Conad", testi("Conad", "Pasta di semola", "Spaghetti"), "conad_logo"],
  ])("%s", (_nome, ingresso, attesa) => {
    expect(lineaConadDaTesti(ingresso)).toBe(attesa);
  });

  it("senza CONAD nella marca non e' del distributore, anche se i testi nominano una linea", () => {
    expect(lineaConadDaTesti(testi("Barilla", "Sapori&Dintorni", "Percorso Qualità"))).toBeNull();
    expect(lineaConadDaTesti(testi(null, "Conad Sapori&Dintorni"))).toBeNull();
    expect(lineaConadDaTesti(testi("", "Conad"))).toBeNull();
  });

  it("le sottostringhe sono quelle di Istanta: '&' senza spazi e qualità con l'accento", () => {
    expect(lineaConadDaTesti(testi("Conad Sapori & Dintorni"))).toBe("conad_logo");
    expect(lineaConadDaTesti(testi("Conad Sapori e Dintorni"))).toBe("conad_logo");
    expect(lineaConadDaTesti(testi("Conad Percorso Qualita"))).toBe("conad_logo");
    expect(lineaConadDaTesti(testi("Conad", "Essentiaelab"))).toBe("conad_essentiae");
  });
});

describe("lineaConadDaTesti: l'ordine della cascata", () => {
  it("Armomia vince anche quando i testi nominano un'altra linea", () => {
    expect(lineaConadDaTesti(testi("Conad Sapori&Dintorni", "Armomia"))).toBe("conad_armomia");
    expect(lineaConadDaTesti(testi("Conad Il Biologico", null, "armomia"))).toBe("conad_armomia");
  });

  it("Il Biologico prima di Percorso Qualità e delle linee Sapori", () => {
    expect(lineaConadDaTesti(testi("Conad Il Biologico", "Percorso Qualità"))).toBe("conad_bio");
    expect(lineaConadDaTesti(testi("Conad Sapori&Dintorni", "Il Biologico"))).toBe("conad_bio");
  });

  it("Sapori con Percorso Qualità prima di Percorso Qualità da solo; Dintorni prima di Idee", () => {
    expect(lineaConadDaTesti(testi("Conad Sapori&Dintorni Sapori&Idee", "Percorso Qualità"))).toBe("conad_saporidintorniPQ");
    expect(lineaConadDaTesti(testi("Conad Sapori&Dintorni Sapori&Idee"))).toBe("conad_saporidintorni");
  });

  it("Percorso Qualità prima delle linee Sapori senza Percorso Qualità", () => {
    // Le linee Sapori con Percorso Qualità vogliono "percorso qualità" con lo spazio, come in Istanta
    expect(lineaConadDaTesti(testi("Conad", "PercorsoQualità Sapori&Idee"))).toBe("conad_cpq");
    expect(lineaConadDaTesti(testi("Conad Percorso Qualità", "Verso Natura"))).toBe("conad_cpq");
  });

  it("Piacersi ferma la cascata prima di Alimentum e Verso Natura", () => {
    expect(lineaConadDaTesti(testi("Conad Piacersi", "Alimentum senza lattosio"))).toBe("conad_piacersi");
    expect(lineaConadDaTesti(testi("Conad Piacersi Verso Natura"))).toBe("conad_piacersi");
  });

  it("Alimentum senza lattosio e senza glutine: vince la parola che compare prima", () => {
    expect(lineaConadDaTesti(testi("Conad Alimentum", "senza lattosio e senza glutine"))).toBe("conad_aslattosio");
    expect(lineaConadDaTesti(testi("Conad Alimentum", "senza glutine e senza lattosio"))).toBe("conad_asglutine");
  });

  it("Alimentum senza nessuna delle due diciture: le linee che seguono, poi il logo Conad", () => {
    expect(lineaConadDaTesti(testi("Conad Alimentum", "Verso Natura"))).toBe("conad_vn");
    expect(lineaConadDaTesti(testi("Conad Alimentum"))).toBe("conad_logo");
  });

  it("Verso Natura prima di Parafarmacia e Baby; Essentiae Lab prima di Essentiae; PetFriends Plus prima di PetFriends", () => {
    expect(lineaConadDaTesti(testi("Conad Verso Natura", "Baby"))).toBe("conad_vn");
    expect(lineaConadDaTesti(testi("Conad Parafarmacia", "Baby"))).toBe("conad_parafarmacia");
    expect(lineaConadDaTesti(testi("Conad", "Essentiae", "Essentiae Lab"))).toBe("conad_essentiae_LAB");
    expect(lineaConadDaTesti(testi("Conad", "PetFriends", "PetFriends Plus"))).toBe("conad_petfrplus");
  });

  it("le maiuscole non contano: i testi si confrontano in minuscolo", () => {
    expect(lineaConadDaTesti(testi("CONAD", "PASSATA", "IL BIOLOGICO"))).toBe("conad_bio");
    expect(lineaConadDaTesti(testi("cOnAd PeTfRiEnDs"))).toBe("conad_PetFr");
  });
});
