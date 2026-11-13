import { describe, expect, it } from "vitest";
import type { BoxInsight, ProdottoInsight } from "../../../../lib/insightVolantino/tipi";
import {
  alternaValore,
  condizioniAttive,
  condizioniDisponibili,
  conIntervallo,
  conTesto,
  eanCercati,
  eanDisponibile,
  elencoCondizioniAttive,
  INTERROGAZIONE_VUOTA,
  interroga,
  intervalliDisponibili,
  ordinaRisultati,
  sintesiRisultati,
  togliIntervallo,
  togliScelta,
  togliTesto,
  type Interrogazione,
} from "./interrogazione";

// L'interrogazione dei box del volantino (spec insight-volantino, "Interrogazione dei box del
// volantino"): condizioni combinate con i conteggi, sintesi dei risultati, niente vendite né calore

const prodotto = (dati: Partial<ProdottoInsight> = {}): ProdottoInsight => ({
  chiave: "c-1",
  nome: "Prodotto",
  marca: null,
  formato: null,
  gusto: null,
  codice: null,
  ean: ["8000000000001"],
  prezzo: null,
  settore: null,
  segmento: null,
  tema: null,
  ruolo: null,
  ...dati,
});

const box = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: `B${id}`,
  pagina: 1,
  geometria: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 },
  spazio: 10,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [`r-${id}`],
  dettaglioProdotti: [prodotto()],
  ...dati,
});

const CARNI = { codice: "10", descrizione: "CARNI" };
const ORTO = { codice: "33", descrizione: "ORTOFRUTTA" };

const VOLANTINO = [
  box("bistecca", { reparto: CARNI, pagina: 4, sconto: 35, prezzo: 9.9, meccanica: "fidelity", spazio: 20 }),
  box("pollo", { reparto: CARNI, pagina: 5, sconto: 30, prezzo: 4.5, meccanica: "sconto", spazio: 10 }),
  box("salsiccia", { reparto: CARNI, pagina: 12, sconto: 10, prezzo: 3.2, meccanica: "fidelity", spazio: 10 }),
  box("mele", { reparto: ORTO, pagina: 2, sconto: 40, prezzo: 1.5, meccanica: "sconto", spazio: 30, idReferenze: ["r-m1", "r-m2"] }),
  box("pane", { pagina: 3, prezzo: 2, spazio: 30, dettaglioProdotti: [prodotto({ ean: [] })] }),
];

const con = (...passi: Array<(interrogazione: Interrogazione) => Interrogazione>): Interrogazione =>
  passi.reduce((interrogazione, passo) => passo(interrogazione), INTERROGAZIONE_VUOTA);

const ids = (elenco: readonly BoxInsight[] | null) => elenco?.map(voce => voce.id) ?? null;

describe("interroga: condizioni combinate", () => {
  it("reparto e sconto da 30%: solo i box che rispettano tutte e due, in ordine di lettura", () => {
    const domanda = con(
      q => alternaValore(q, "reparto", "10"),
      q => conIntervallo(q, "sconto", { da: 30, a: null })
    );

    expect(ids(interroga(VOLANTINO, domanda))).toEqual(["bistecca", "pollo"]);
    expect(condizioniAttive(domanda)).toBe(2);
  });

  it("più valori della stessa condizione valgono in alternativa", () => {
    const domanda = con(
      q => alternaValore(q, "reparto", "10"),
      q => alternaValore(q, "reparto", "33")
    );

    expect(ids(interroga(VOLANTINO, domanda))).toEqual(["mele", "bistecca", "pollo", "salsiccia"]);
  });

  it("senza condizioni non interroga; togliere le condizioni torna a nessuna interrogazione", () => {
    expect(interroga(VOLANTINO, INTERROGAZIONE_VUOTA)).toBeNull();
    const domanda = con(
      q => alternaValore(q, "meccanica", "fidelity"),
      q => conIntervallo(q, "prezzo", { da: 5, a: null })
    );
    expect(ids(interroga(VOLANTINO, domanda))).toEqual(["bistecca"]);
    expect(interroga(VOLANTINO, togliIntervallo(togliScelta(domanda, "meccanica"), "prezzo"))).toBeNull();
    // Scegliere due volte lo stesso valore lo toglie
    expect(interroga(VOLANTINO, alternaValore(alternaValore(INTERROGAZIONE_VUOTA, "reparto", "10"), "reparto", "10"))).toBeNull();
  });

  it("un intervallo esclude i box senza il dato e scambia i limiti scritti al contrario", () => {
    const domanda = conIntervallo(INTERROGAZIONE_VUOTA, "sconto", { da: 40, a: 30 });

    expect(domanda.intervalli.sconto).toEqual({ da: 30, a: 40 });
    expect(ids(interroga(VOLANTINO, domanda))).toEqual(["mele", "bistecca", "pollo"]);
  });

  it("condizioni che nessun box soddisfa danno un elenco vuoto", () => {
    expect(interroga(VOLANTINO, con(q => alternaValore(q, "reparto", "33"), q => alternaValore(q, "meccanica", "fidelity")))).toEqual([]);
  });

  it("i box senza pagina restano fuori: non si possono mostrare", () => {
    const elenco = [...VOLANTINO, box("fuori", { reparto: CARNI, pagina: null })];
    expect(ids(interroga(elenco, alternaValore(INTERROGAZIONE_VUOTA, "reparto", "10")))).not.toContain("fuori");
  });

  it("settore, tema e ruolo vengono dai prodotti del box, anche del gruppo", () => {
    const elenco = [
      box("a", { dettaglioProdotti: [prodotto({ settore: "Freschi" }), prodotto({ settore: "Latticini", tema: "MBIS", ruolo: "STAR" })] }),
      box("b", { dettaglioProdotti: [prodotto({ settore: "Bevande", ean: [] })] }),
    ];

    expect(ids(interroga(elenco, alternaValore(INTERROGAZIONE_VUOTA, "settore", "latticini")))).toEqual(["a"]);
    expect(ids(interroga(elenco, alternaValore(INTERROGAZIONE_VUOTA, "ruolo", "star")))).toEqual(["a"]);
  });

  it("un box senza ruolo ha 'Senza ruolo', proposto accanto agli altri ruoli e in fondo", () => {
    const elenco = [
      box("a", { dettaglioProdotti: [prodotto({ ruolo: "Star" })] }),
      box("b", { dettaglioProdotti: [prodotto({ ruolo: "Star" })] }),
      box("senza", { dettaglioProdotti: [prodotto({ ruolo: null })] }),
    ];

    const ruolo = condizioniDisponibili(elenco, elenco, INTERROGAZIONE_VUOTA).find(condizione => condizione.id === "ruolo");
    expect(ruolo?.valori.map(valore => [valore.etichetta, valore.box])).toEqual([
      ["Star", 2],
      ["Senza ruolo", 1],
    ]);
    expect(ids(interroga(elenco, alternaValore(INTERROGAZIONE_VUOTA, "ruolo", "senza")))).toEqual(["senza"]);
  });

  it("il tema arriva già leggibile: scritture diverse sono un valore, con quella della fonte per il suggerimento", () => {
    const elenco = [
      box("a", { dettaglioProdotti: [prodotto({ tema: "Tante altre offerte", temaOriginale: "tantealtreoff" })] }),
      box("b", { dettaglioProdotti: [prodotto({ tema: "Tante altre offerte", temaOriginale: "TANTEALTREOFF" })] }),
      box("c", { dettaglioProdotti: [prodotto({ tema: "I numeri 1", temaOriginale: "mnumeri1" })] }),
    ];

    const tema = condizioniDisponibili(elenco, elenco, INTERROGAZIONE_VUOTA).find(condizione => condizione.id === "tema");
    expect(tema?.valori.map(valore => [valore.etichetta, valore.fonte, valore.box])).toEqual([
      ["Tante altre offerte", "tantealtreoff", 2],
      ["I numeri 1", "mnumeri1", 1],
    ]);
  });
});

describe("interroga: l'EAN scritto", () => {
  const ELENCO = [
    box("nutella", { dettaglioProdotti: [prodotto({ ean: ["8000500425183"] })] }),
    // L'EAN di un prodotto del gruppo, non del pilota
    box("mozzarella", { reparto: CARNI, dettaglioProdotti: [prodotto({ ean: [] }), prodotto({ chiave: "c-2", ean: ["8033281161575", "8033281162091"] })] }),
    box("pane", { dettaglioProdotti: [prodotto({ ean: [] })] }),
  ];
  const conEan = (testo: string) => conTesto(INTERROGAZIONE_VUOTA, "ean", testo);

  it("gli EAN cercati: separati da virgola, punto e virgola o spazi, solo le cifre", () => {
    expect(eanCercati(" 8000500425183, 80332-81161575;  12 ")).toEqual(["8000500425183", "8033281161575", "12"]);
    expect(eanCercati("abc")).toEqual([]);
    expect(eanCercati(undefined)).toEqual([]);
  });

  it("trova il box dall'EAN anche scritto in parte, anche di un prodotto del gruppo", () => {
    expect(ids(interroga(ELENCO, conEan("425183")))).toEqual(["nutella"]);
    expect(ids(interroga(ELENCO, conEan("8033281162091")))).toEqual(["mozzarella"]);
  });

  it("più EAN valgono in alternativa", () => {
    expect(ids(interroga(ELENCO, conEan("8000500425183, 8033281161575")))).toEqual(expect.arrayContaining(["nutella", "mozzarella"]));
    expect(interroga(ELENCO, conEan("8000500425183, 8033281161575"))).toHaveLength(2);
  });

  it("vale insieme alle altre condizioni e conta fra quelle attive", () => {
    const domanda = alternaValore(conEan("8000500425183"), "reparto", "10");

    expect(condizioniAttive(domanda)).toBe(2);
    expect(interroga(ELENCO, domanda)).toEqual([]);
    expect(elencoCondizioniAttive(domanda, [])).toEqual(
      expect.arrayContaining([{ tipo: "testo", id: "ean", etichetta: "EAN", valori: ["8000500425183"] }])
    );
  });

  it("un campo vuoto o senza cifre non è una condizione; togliendolo si torna come prima", () => {
    expect(interroga(ELENCO, conEan("  "))).toBeNull();
    expect(condizioniAttive(conEan("abc"))).toBe(0);
    expect(interroga(ELENCO, togliTesto(conEan("425183"), "ean"))).toBeNull();
  });

  it("il campo EAN si propone solo se qualche box ha prodotti con l'EAN", () => {
    expect(eanDisponibile(ELENCO)).toBe(true);
    expect(eanDisponibile([ELENCO[2]])).toBe(false);
    // Server non aggiornati: senza i prodotti del box
    expect(eanDisponibile(ELENCO.map(voce => ({ ...voce, dettaglioProdotti: undefined })))).toBe(false);
  });
});

describe("condizioniDisponibili: valori presenti con i conteggi", () => {
  it("accanto a ogni reparto quanti box ha con le altre condizioni scelte; non i reparti assenti", () => {
    const domanda = alternaValore(INTERROGAZIONE_VUOTA, "meccanica", "fidelity");
    const reparto = condizioniDisponibili(VOLANTINO, VOLANTINO, domanda).find(condizione => condizione.id === "reparto");

    expect(reparto?.valori.map(valore => [valore.etichetta, valore.box])).toEqual([
      ["CARNI", 2],
      ["ORTOFRUTTA", 0],
      ["Reparto non noto", 0],
    ]);
    // La condizione stessa non restringe i suoi conteggi
    const meccanica = condizioniDisponibili(VOLANTINO, VOLANTINO, domanda).find(condizione => condizione.id === "meccanica");
    // Le meccaniche nell'ordine di sempre (sconto, fidelity...), "non riconosciuta" in fondo
    expect(meccanica?.valori.map(valore => [valore.chiave, valore.box, valore.scelto])).toEqual([
      ["sconto", 2, false],
      ["fidelity", 2, true],
      ["senza", 1, false],
    ]);
  });

  it("i conteggi tengono conto della ricerca: si contano solo i box della base", () => {
    const base = VOLANTINO.filter(voce => voce.id !== "bistecca");
    const reparto = condizioniDisponibili(VOLANTINO, base, INTERROGAZIONE_VUOTA).find(condizione => condizione.id === "reparto");

    expect(reparto?.valori.find(valore => valore.chiave === "10")?.box).toBe(2);
  });

  it("una condizione senza dati nel volantino non si propone; sì/no solo se qualche box ha il sì", () => {
    const proposte = condizioniDisponibili(VOLANTINO, VOLANTINO, INTERROGAZIONE_VUOTA).map(condizione => condizione.id);

    // Nessun settore, tema, linea, bollo, punti, sottocosto né origine nei dati
    for (const assente of ["settore", "segmento", "tema", "ruolo", "linea", "bolli", "punti", "sottocosto", "origine"]) {
      expect(proposte).not.toContain(assente);
    }
    expect(proposte).toEqual(expect.arrayContaining(["reparto", "meccanica"]));
    // L'EAN non è più una scelta "con o senza": si scrive (eanDisponibile)
    expect(proposte).not.toContain("ean");
  });

  it("nessuna condizione su vendite, previsioni, calore o visibilità", () => {
    const tutte = [
      ...condizioniDisponibili(VOLANTINO, VOLANTINO, INTERROGAZIONE_VUOTA).map(condizione => condizione.etichetta),
      ...intervalliDisponibili(VOLANTINO).map(intervallo => intervallo.etichetta),
    ];

    expect(tutte.join(" ")).not.toMatch(/vendit|prevision|calore|visibilit/i);
  });
});

describe("intervalliDisponibili", () => {
  it("propone prezzo, sconto, spazio e pagine con il minimo e il massimo del volantino; non i prodotti, tutti uguali", () => {
    const intervalli = intervalliDisponibili(VOLANTINO);

    expect(intervalli.map(intervallo => intervallo.id)).toEqual(["prezzo", "sconto", "spazio", "pagine"]);
    expect(intervalli.find(intervallo => intervallo.id === "prezzo")).toMatchObject({ minimo: 1.5, massimo: 9.9, unita: "€" });
  });
});

describe("elencoCondizioniAttive", () => {
  it("dice ogni condizione attiva con le etichette dei valori scelti e i limiti degli intervalli", () => {
    const domanda = con(
      q => alternaValore(q, "reparto", "10"),
      q => alternaValore(q, "reparto", "33"),
      q => conIntervallo(q, "sconto", { da: 30, a: null })
    );
    const condizioni = condizioniDisponibili(VOLANTINO, VOLANTINO, domanda);

    expect(elencoCondizioniAttive(domanda, condizioni)).toEqual([
      { tipo: "scelta", id: "reparto", etichetta: "Reparto", valori: ["CARNI", "ORTOFRUTTA"] },
      { tipo: "intervallo", id: "sconto", etichetta: "Sconto", unita: "%", intervallo: { da: 30, a: null } },
    ]);
  });
});

describe("sintesiRisultati e ordine", () => {
  it("box, referenze, pagine, quota di spazio sul volantino, sconto medio e prezzi minimo, medio e massimo", () => {
    const trovati = VOLANTINO.filter(voce => ["bistecca", "pollo", "mele"].includes(voce.id));

    expect(sintesiRisultati(trovati, VOLANTINO)).toEqual({
      box: 3,
      referenze: 4,
      pagine: 3,
      quotaSpazio: 60,
      scontoMedio: 35,
      prezzoMinimo: 1.5,
      prezzoMedio: (9.9 + 4.5 + 1.5) / 3,
      prezzoMassimo: 9.9,
    });
  });

  it("ordina per pagina, prezzo dal più basso, sconto e spazio dal più alto; i box senza il dato in fondo", () => {
    expect(ids(ordinaRisultati(VOLANTINO, "pagina"))).toEqual(["mele", "pane", "bistecca", "pollo", "salsiccia"]);
    expect(ids(ordinaRisultati(VOLANTINO, "prezzo"))).toEqual(["mele", "pane", "salsiccia", "pollo", "bistecca"]);
    expect(ids(ordinaRisultati(VOLANTINO, "sconto"))).toEqual(["mele", "bistecca", "pollo", "salsiccia", "pane"]);
    expect(ids(ordinaRisultati(VOLANTINO, "spazio"))).toEqual(["mele", "pane", "bistecca", "pollo", "salsiccia"]);
  });
});
