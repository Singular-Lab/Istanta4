import { describe, expect, it } from "vitest";
import {
  anteprimaMenu,
  aperturaConsentita,
  areeDaMostrare,
  areeDellePagine,
  rilascioVietato,
  impostaPaginaIniziale,
  inserisciPagina,
  leggiMenu,
  serializzaMenu,
  spostaConTastiera,
  spostaTitolo,
  spostaTitoloConTastiera,
  spostaVoce,
  titoliEreditati,
  vociDelModello,
  type MenuItemDTO,
  type ModelloMenu,
} from "./modelloMenu";

let ordine = 0;
const voce = (pathname: string, titolo: string, altro: Partial<MenuItemDTO> = {}): MenuItemDTO => ({
  tipo_utente: "Superadmin",
  tipo: "item",
  titolo,
  icona: "Circle",
  pathname,
  ordinamento: ordine++,
  ...altro,
});
const separatore = (titolo: string): MenuItemDTO => ({ tipo_utente: "Superadmin", tipo: "separator", titolo, ordinamento: ordine++ });

/** Il modello senza gli identificativi locali: area → gruppi → percorsi. */
const forma = (modello: ModelloMenu) =>
  modello.aree.map((area) => ({
    area: area.sezione,
    gruppi: area.gruppi.map((g) => ({ titolo: g.titolo, voci: g.voci.map((v) => v.pathname) })),
  }));

const idDi = (modello: ModelloMenu, pathname: string) => vociDelModello(modello).find((v) => v.pathname === pathname)!.id;
const gruppoDi = (modello: ModelloMenu, pathname: string) =>
  modello.aree.flatMap((a) => a.gruppi).find((g) => g.voci.some((v) => v.pathname === pathname))!.id;

describe("modello del menu: lettura", () => {
  it("mette ogni voce nell'area della sua pagina e divide un gruppo con pagine di aree diverse", () => {
    const { modello, scartate } = leggiMenu([
      voce("/gdo/dashboard", "Panoramica"),
      separatore("LAVORO"),
      voce("/promozioni/nuova", "Nuova promozione"),
      voce("/volantini/attivi", "Volantini attivi"),
      voce("/promozioni/in-corso", "Promozioni in corso"),
    ]);

    expect(scartate).toEqual([]);
    expect(forma(modello)).toEqual([
      { area: "produzione", gruppi: [{ titolo: "LAVORO", voci: ["/promozioni/nuova", "/promozioni/in-corso"] }] },
      {
        area: "visualizzazione",
        gruppi: [
          { titolo: "", voci: ["/gdo/dashboard"] },
          { titolo: "LAVORO", voci: ["/volantini/attivi"] },
        ],
      },
    ]);
  });

  it("legge le voci nell'ordine di ordinamento, non in quello dell'elenco", () => {
    const { modello } = leggiMenu([
      { ...voce("/volantini/storico", "Storico"), ordinamento: 2 },
      { ...voce("/volantini/attivi", "Attivi"), ordinamento: 1 },
    ]);
    expect(forma(modello)[0].gruppi[0].voci).toEqual(["/volantini/attivi", "/volantini/storico"]);
  });

  it("tiene fuori le voci senza pagina e i doppioni, e non li salva", () => {
    const lettura = leggiMenu([
      voce("/gestione-pagine-singular", "Pagine Singular"),
      voce("/dashboard-overview-8", "Overview"),
      voce("/volantini/attivi", "Volantini attivi"),
      voce("/volantini/attivi/", "Ancora volantini"),
      voce("", "Senza indirizzo"),
    ]);

    expect(lettura.scartate.map((v) => [v.titolo, v.motivo])).toEqual([
      ["Pagine Singular", "senza-pagina"],
      ["Overview", "senza-pagina"],
      ["Ancora volantini", "doppione"],
      ["Senza indirizzo", "senza-pagina"],
    ]);
    expect(serializzaMenu(lettura.modello, "Superadmin").map((v) => v.pathname)).toEqual(["/volantini/attivi"]);
  });

  it("mette la voce nell'area salvata con lei e scarta i doppioni solo nella stessa area", () => {
    const lettura = leggiMenu([
      separatore("PROMOZIONI"),
      voce("/promozioni/in-corso", "Promozioni in corso"),
      voce("/volantini/attivi", "Volantini", { sezione: "produzione" }),
      voce("/volantini/attivi", "Volantini di nuovo", { sezione: "produzione" }),
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi"),
      voce("/pop/attivi", "POP", { sezione: "area-che-non-esiste" }),
    ]);

    expect(forma(lettura.modello)).toEqual([
      { area: "produzione", gruppi: [{ titolo: "PROMOZIONI", voci: ["/promozioni/in-corso", "/volantini/attivi"] }] },
      { area: "visualizzazione", gruppi: [{ titolo: "CONSULTA", voci: ["/volantini/attivi", "/pop/attivi"] }] },
    ]);
    expect(lettura.scartate.map((v) => [v.titolo, v.motivo])).toEqual([["Volantini di nuovo", "doppione"]]);
  });

  it("resta pagina iniziale solo la prima voce segnata", () => {
    const { modello } = leggiMenu([
      voce("/volantini/attivi", "Volantini attivi", { start_page: true }),
      voce("/pop/attivi", "POP attivi", { start_page: true }),
    ]);
    expect(vociDelModello(modello).filter((v) => v.iniziale).map((v) => v.pathname)).toEqual(["/volantini/attivi"]);
  });
});

describe("modello del menu: salvataggio", () => {
  it("salva area per area nell'ordine delle sezioni, con ordinamento progressivo, e rilegge lo stesso menu", () => {
    const { modello } = leggiMenu([
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi"),
      separatore("CREA"),
      voce("/promozioni/nuova", "Nuova promozione", { start_page: true }),
      voce("/nuovo-ods", "Nuovo ordine", { disabilitato: true }),
    ]);

    const salvate = serializzaMenu(modello, "Agenzia");
    expect(salvate.map((v) => [v.tipo, v.titolo, v.ordinamento])).toEqual([
      ["separator", "CREA", 0],
      ["item", "Nuova promozione", 1],
      ["item", "Nuovo ordine", 2],
      ["separator", "CONSULTA", 3],
      ["item", "Volantini attivi", 4],
    ]);
    expect(salvate[1]).toMatchObject({ tipo_utente: "Agenzia", pathname: "/promozioni/nuova", start_page: true, disabilitato: false });
    expect(salvate[2]).toMatchObject({ disabilitato: true, start_page: false });
    expect(salvate.some((v) => "id_menu_item" in v)).toBe(false);

    expect(forma(leggiMenu(salvate).modello)).toEqual(forma(modello));
  });

  it("salva l'area solo per le voci che stanno fuori dalla loro area predefinita", () => {
    const { modello } = leggiMenu([
      separatore("PROMOZIONI"),
      voce("/promozioni/in-corso", "Promozioni in corso"),
      voce("/volantini/attivi", "Volantini", { sezione: "produzione" }),
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi", { sezione: "visualizzazione" }),
    ]);

    const salvate = serializzaMenu(modello, "Superadmin").filter((v) => v.tipo === "item");
    expect(salvate.map((v) => [v.pathname, v.sezione ?? null])).toEqual([
      ["/promozioni/in-corso", null],
      ["/volantini/attivi", "produzione"],
      ["/volantini/attivi", null],
    ]);
    expect(salvate.every((v) => v.sezione !== undefined || !("sezione" in v))).toBe(true);
    expect(forma(leggiMenu(serializzaMenu(modello, "Superadmin")).modello)).toEqual(forma(modello));
  });

  it("un gruppo senza titolo non ha separatore e i gruppi vuoti non si salvano", () => {
    const { modello } = leggiMenu([voce("/volantini/attivi", "Volantini attivi")]);
    modello.aree[0].gruppi.push({ id: "vuoto", titolo: "VUOTO", voci: [] });

    expect(serializzaMenu(modello, "Superadmin").map((v) => v.tipo)).toEqual(["item"]);
  });

  it("conserva così come sono le sottovoci di una voce", () => {
    const sottovoci = [voce("/pop/attivi", "POP attivi", { id_menu_item: "s1", id_parent: "p1" })];
    const { modello } = leggiMenu([voce("/volantini", "Volantini", { id_menu_item: "p1", subMenu: sottovoci })]);

    expect(serializzaMenu(modello, "Superadmin")[0].subMenu).toEqual(sottovoci);
  });

  it("una voce senza titolo si salva con il titolo proposto dal catalogo", () => {
    const { modello } = leggiMenu([voce("/volantini/attivi", "")]);
    expect(serializzaMenu(modello, "Superadmin")[0].titolo).toBe("Volantini attivi");
  });

  it("un gruppo senza titolo dopo uno con titolo ne eredita l'intestazione nel menu", () => {
    const { modello } = leggiMenu([separatore("CREA"), voce("/promozioni/nuova", "Nuova"), voce("/volantini/attivi", "Volantini")]);
    // Visualizzazione: il gruppo letto ha il titolo CREA; lo si toglie
    modello.aree[1].gruppi[0].titolo = "";
    expect([...titoliEreditati(modello).values()]).toEqual(["CREA"]);
  });
});

describe("modello del menu: pagine e spostamenti", () => {
  const base = () =>
    leggiMenu([
      separatore("CREA"),
      voce("/promozioni/nuova", "Nuova promozione"),
      voce("/nuovo-ods", "Nuovo ordine"),
      separatore("IMPOSTAZIONI"),
      voce("/impostazioni-tipografia", "Tipografia"),
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi"),
    ]).modello;

  /** "Volantini attivi" in fondo a Produzione (area scelta) e in Visualizzazione (la sua). */
  const inDueAree = () =>
    leggiMenu([
      separatore("PROMOZIONI"),
      voce("/promozioni/nuova", "Nuova promozione"),
      voce("/volantini/attivi", "Volantini", { sezione: "produzione" }),
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi"),
    ]).modello;

  it("una pagina lasciata in un gruppo della sua area va nel punto di rilascio, con titolo e icona del catalogo", () => {
    const modello = base();
    const esito = inserisciPagina(modello, "/ods-in-corso", { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 1 });

    expect(esito).toMatchObject({ esito: "aggiunta", sezione: "produzione" });
    expect(forma(esito.modello)[0].gruppi[0].voci).toEqual(["/promozioni/nuova", "/ods-in-corso", "/nuovo-ods"]);
    expect(vociDelModello(esito.modello).find((v) => v.pathname === "/ods-in-corso")).toMatchObject({
      titolo: "Ordine di Stampa in corso",
      icona: "Truck",
    });
  });

  it("una pagina lasciata in un gruppo di un'altra area resta lì, nel punto di rilascio", () => {
    const modello = base();
    const esito = inserisciPagina(modello, "/whatsapp/campagne-whatsapp", { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 1 });

    expect(esito).toMatchObject({ esito: "aggiunta", sezione: "produzione" });
    expect(forma(esito.modello).map((a) => a.area)).toEqual(["produzione", "visualizzazione"]);
    expect(forma(esito.modello)[0].gruppi[0].voci).toEqual(["/promozioni/nuova", "/whatsapp/campagne-whatsapp", "/nuovo-ods"]);
  });

  it("senza destinazione la pagina va in fondo all'ultimo gruppo della sua area predefinita, creandola se manca", () => {
    const esito = inserisciPagina(base(), "/ods-completati");
    expect(forma(esito.modello)[0].gruppi[1].voci).toEqual(["/impostazioni-tipografia", "/ods-completati"]);

    const nuova = inserisciPagina(base(), "/whatsapp/campagne-whatsapp");
    expect(forma(nuova.modello).map((a) => a.area)).toEqual(["produzione", "visualizzazione", "comunicazione"]);
    expect(forma(nuova.modello)[2].gruppi).toEqual([{ titolo: "", voci: ["/whatsapp/campagne-whatsapp"] }]);
  });

  it("la stessa pagina si aggiunge in un'altra area, ma non due volte nella stessa", () => {
    const modello = base();
    const nellaStessa = inserisciPagina(modello, "/volantini/attivi/");
    expect(nellaStessa).toMatchObject({ esito: "gia-presente", sezione: "visualizzazione" });
    expect(nellaStessa.modello).toBe(modello);

    const inProduzione = inserisciPagina(modello, "/volantini/attivi", { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 0 });
    expect(inProduzione.esito).toBe("aggiunta");
    expect(forma(inProduzione.modello)[0].gruppi[0].voci).toEqual(["/volantini/attivi", "/promozioni/nuova", "/nuovo-ods"]);
    expect(forma(inProduzione.modello)[1].gruppi[0].voci).toEqual(["/volantini/attivi"]);
    expect(areeDellePagine(inProduzione.modello).get("/volantini/attivi")).toEqual(["produzione", "visualizzazione"]);

    const ancora = inserisciPagina(inProduzione.modello, "/volantini/attivi", { gruppoId: gruppoDi(modello, "/impostazioni-tipografia"), indice: 0 });
    expect(ancora).toMatchObject({ esito: "gia-presente", sezione: "produzione" });
  });

  it("una voce si sposta in qualunque area, se lì la sua pagina non c'è già", () => {
    const modello = base();
    const dentro = spostaVoce(modello, idDi(modello, "/promozioni/nuova"), { gruppoId: gruppoDi(modello, "/impostazioni-tipografia"), indice: 1 });
    expect(dentro.esito).toBe("spostata");
    expect(forma(dentro.modello)[0].gruppi).toEqual([
      { titolo: "CREA", voci: ["/nuovo-ods"] },
      { titolo: "IMPOSTAZIONI", voci: ["/impostazioni-tipografia", "/promozioni/nuova"] },
    ]);

    const fuori = spostaVoce(modello, idDi(modello, "/promozioni/nuova"), { gruppoId: gruppoDi(modello, "/volantini/attivi"), indice: 0 });
    expect(fuori.esito).toBe("spostata");
    expect(forma(fuori.modello)[1].gruppi[0].voci).toEqual(["/promozioni/nuova", "/volantini/attivi"]);
    expect(forma(fuori.modello)[0].gruppi[0].voci).toEqual(["/nuovo-ods"]);
  });

  it("una voce non si sposta in un'area che ha già la sua pagina", () => {
    const modello = inDueAree();
    const inVisualizzazione = modello.aree[1].gruppi[0].voci[0];
    const esito = spostaVoce(modello, inVisualizzazione.id, { gruppoId: modello.aree[0].gruppi[0].id, indice: 0 });

    expect(esito).toMatchObject({ esito: "gia-presente", sezione: "produzione" });
    expect(esito.modello).toBe(modello);
    expect(rilascioVietato(modello.aree[0], { voceId: inVisualizzazione.id, sezione: "visualizzazione", percorso: "/volantini/attivi" })).toBe(true);
    expect(rilascioVietato(modello.aree[0], { percorso: "/volantini/attivi", sezione: "visualizzazione" })).toBe(true);
    expect(rilascioVietato(modello.aree[0], { percorso: "/volantini/storico", sezione: "visualizzazione" })).toBe(false);
    // Nella propria area una voce si può sempre riordinare
    expect(rilascioVietato(modello.aree[1], { voceId: inVisualizzazione.id, sezione: "visualizzazione", percorso: "/volantini/attivi" })).toBe(false);
  });

  it("nello stesso gruppo il punto di rilascio conta le voci come si vedono", () => {
    const modello = base();
    const esito = spostaVoce(modello, idDi(modello, "/promozioni/nuova"), { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 2 });
    expect(forma(esito.modello)[0].gruppi[0].voci).toEqual(["/nuovo-ods", "/promozioni/nuova"]);
  });

  it("da tastiera la voce passa al gruppo successivo o precedente, poi all'area vicina", () => {
    const modello = base();
    const giu = spostaConTastiera(modello, idDi(modello, "/nuovo-ods"), 1);
    expect(giu.esito).toBe("spostata");
    expect(forma(giu.modello)[0].gruppi).toEqual([
      { titolo: "CREA", voci: ["/promozioni/nuova"] },
      { titolo: "IMPOSTAZIONI", voci: ["/nuovo-ods", "/impostazioni-tipografia"] },
    ]);

    const su = spostaConTastiera(giu.modello, idDi(giu.modello, "/nuovo-ods"), -1);
    expect(forma(su.modello)[0].gruppi[0].voci).toEqual(["/promozioni/nuova", "/nuovo-ods"]);

    // Produzione è la prima area: la sua prima voce non va oltre
    expect(spostaConTastiera(modello, idDi(modello, "/promozioni/nuova"), -1).esito).toBe("prima");

    // L'ultima voce di Produzione passa in cima a Visualizzazione
    const inVisualizzazione = spostaConTastiera(modello, idDi(modello, "/impostazioni-tipografia"), 1);
    expect(inVisualizzazione.esito).toBe("spostata");
    expect(forma(inVisualizzazione.modello)[1].gruppi[0].voci).toEqual(["/impostazioni-tipografia", "/volantini/attivi"]);

    // La prima voce di Visualizzazione torna in fondo all'ultimo gruppo di Produzione
    const indietro = spostaConTastiera(modello, idDi(modello, "/volantini/attivi"), -1);
    expect(forma(indietro.modello)[0].gruppi[1].voci).toEqual(["/impostazioni-tipografia", "/volantini/attivi"]);

    // L'ultima voce di Visualizzazione passa a Comunicazione, ancora vuota, in un gruppo senza titolo
    const inComunicazione = spostaConTastiera(modello, idDi(modello, "/volantini/attivi"), 1);
    expect(forma(inComunicazione.modello).map((a) => a.area)).toEqual(["produzione", "visualizzazione", "comunicazione"]);
    expect(forma(inComunicazione.modello)[2].gruppi).toEqual([{ titolo: "", voci: ["/volantini/attivi"] }]);
  });

  it("da tastiera la voce non passa a un'area che ha già la sua pagina", () => {
    const modello = inDueAree();
    const inVisualizzazione = modello.aree[1].gruppi[0].voci[0];
    const esito = spostaConTastiera(modello, inVisualizzazione.id, -1);
    expect(esito).toMatchObject({ esito: "gia-presente", sezione: "produzione" });
    expect(esito.modello).toBe(modello);
  });

  it("l'editor mostra tutte le aree tranne Account, anche quelle senza voci", () => {
    expect(areeDaMostrare(base()).map((a) => [a.sezione, a.gruppi.length])).toEqual([
      ["produzione", 2],
      ["visualizzazione", 1],
      ["comunicazione", 0],
      ["gestione", 0],
      ["sistema", 0],
    ]);
  });

  it("la pagina iniziale è una sola: segnarne un'altra toglie il segno alla prima", () => {
    let modello = base();
    modello = impostaPaginaIniziale(modello, idDi(modello, "/nuovo-ods"));
    modello = impostaPaginaIniziale(modello, idDi(modello, "/volantini/attivi"));
    expect(vociDelModello(modello).filter((v) => v.iniziale).map((v) => v.pathname)).toEqual(["/volantini/attivi"]);
    expect(serializzaMenu(modello, "Superadmin").filter((v) => v.start_page).map((v) => v.pathname)).toEqual(["/volantini/attivi"]);

    modello = impostaPaginaIniziale(modello, idDi(modello, "/volantini/attivi"));
    expect(vociDelModello(modello).some((v) => v.iniziale)).toBe(false);
  });
});

describe("modello del menu: titoli dei gruppi", () => {
  const conTitoli = () =>
    leggiMenu([
      separatore("PROMOZIONI"),
      voce("/promozioni/nuova", "Nuova promozione"),
      voce("/promozioni/in-corso", "Promozioni in corso"),
      separatore("STAMPA"),
      voce("/nuovo-ods", "Nuovo ordine"),
      voce("/ods-in-corso", "Ordini in corso"),
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi"),
    ]).modello;
  const gruppo = (modello: ModelloMenu, titolo: string) => modello.aree.flatMap((a) => a.gruppi).find((g) => g.titolo === titolo)!.id;

  it("trascinato fra due voci, il titolo prende le voci che lo seguono fino al titolo successivo", () => {
    const modello = conTitoli();
    const esito = spostaTitolo(modello, gruppo(modello, "STAMPA"), { gruppoId: gruppo(modello, "PROMOZIONI"), indice: 1 });

    expect(esito.esito).toBe("spostato");
    expect(forma(esito.modello)[0].gruppi).toEqual([
      { titolo: "PROMOZIONI", voci: ["/promozioni/nuova"] },
      { titolo: "STAMPA", voci: ["/promozioni/in-corso", "/nuovo-ods", "/ods-in-corso"] },
    ]);
    // Il gruppo del titolo conserva il suo id: il focus e le chiavi restano sullo stesso gruppo
    expect(gruppo(esito.modello, "STAMPA")).toBe(gruppo(modello, "STAMPA"));
  });

  it("dentro il suo gruppo, il titolo lascia le voci che scavalca al gruppo precedente", () => {
    const modello = conTitoli();
    const giu = spostaTitolo(modello, gruppo(modello, "STAMPA"), { gruppoId: gruppo(modello, "STAMPA"), indice: 1 });
    expect(forma(giu.modello)[0].gruppi).toEqual([
      { titolo: "PROMOZIONI", voci: ["/promozioni/nuova", "/promozioni/in-corso", "/nuovo-ods"] },
      { titolo: "STAMPA", voci: ["/ods-in-corso"] },
    ]);

    const fermo = spostaTitolo(modello, gruppo(modello, "STAMPA"), { gruppoId: gruppo(modello, "STAMPA"), indice: 0 });
    expect(fermo.esito).toBe("invariato");
    expect(fermo.modello).toBe(modello);
  });

  it("il primo gruppo che perde il titolo resta, senza titolo, in cima all'area", () => {
    const modello = conTitoli();
    const esito = spostaTitolo(modello, gruppo(modello, "PROMOZIONI"), { gruppoId: gruppo(modello, "STAMPA"), indice: 1 });

    expect(forma(esito.modello)[0].gruppi).toEqual([
      { titolo: "", voci: ["/promozioni/nuova", "/promozioni/in-corso"] },
      { titolo: "STAMPA", voci: ["/nuovo-ods"] },
      { titolo: "PROMOZIONI", voci: ["/ods-in-corso"] },
    ]);
  });

  it("in un'altra area il titolo divide il gruppo di arrivo, e le voci non cambiano area", () => {
    const modello = conTitoli();
    const esito = spostaTitolo(modello, gruppo(modello, "STAMPA"), { gruppoId: gruppo(modello, "CONSULTA"), indice: 0 });

    expect(forma(esito.modello)).toEqual([
      { area: "produzione", gruppi: [{ titolo: "PROMOZIONI", voci: ["/promozioni/nuova", "/promozioni/in-corso", "/nuovo-ods", "/ods-in-corso"] }] },
      // Il gruppo con titolo rimasto vuoto resta nell'editor e non si salva
      { area: "visualizzazione", gruppi: [{ titolo: "CONSULTA", voci: [] }, { titolo: "STAMPA", voci: ["/volantini/attivi"] }] },
    ]);
    expect(serializzaMenu(esito.modello, "Superadmin").filter((v) => v.tipo === "separator").map((v) => v.titolo)).toEqual([
      "PROMOZIONI",
      "STAMPA",
    ]);
  });

  it("lasciato in un gruppo senza titolo in cima, il titolo prende tutte le sue voci", () => {
    const { modello } = leggiMenu([
      voce("/promozioni/nuova", "Nuova promozione"),
      separatore("STAMPA"),
      voce("/nuovo-ods", "Nuovo ordine"),
    ]);
    const senzaTitolo = modello.aree[0].gruppi[0].id;
    const esito = spostaTitolo(modello, gruppo(modello, "STAMPA"), { gruppoId: senzaTitolo, indice: 0 });

    expect(forma(esito.modello)[0].gruppi).toEqual([{ titolo: "STAMPA", voci: ["/promozioni/nuova", "/nuovo-ods"] }]);
    // Un gruppo senza titolo non ha un titolo da spostare
    expect(spostaTitolo(modello, senzaTitolo, { gruppoId: gruppo(modello, "STAMPA"), indice: 1 }).esito).toBe("invariato");
  });

  it("da tastiera il titolo sale o scende di una voce, e non esce dalla sua area", () => {
    const modello = conTitoli();
    const su = spostaTitoloConTastiera(modello, gruppo(modello, "STAMPA"), -1);
    expect(su.esito).toBe("spostato");
    expect(forma(su.modello)[0].gruppi).toEqual([
      { titolo: "PROMOZIONI", voci: ["/promozioni/nuova"] },
      { titolo: "STAMPA", voci: ["/promozioni/in-corso", "/nuovo-ods", "/ods-in-corso"] },
    ]);

    const giu = spostaTitoloConTastiera(modello, gruppo(modello, "STAMPA"), 1);
    expect(forma(giu.modello)[0].gruppi).toEqual([
      { titolo: "PROMOZIONI", voci: ["/promozioni/nuova", "/promozioni/in-corso", "/nuovo-ods"] },
      { titolo: "STAMPA", voci: ["/ods-in-corso"] },
    ]);

    expect(spostaTitoloConTastiera(modello, gruppo(modello, "PROMOZIONI"), -1).esito).toBe("prima");

    // CONSULTA scende sotto la sua unica voce e poi non va oltre
    const sotto = spostaTitoloConTastiera(modello, gruppo(modello, "CONSULTA"), 1);
    expect(forma(sotto.modello)[1].gruppi).toEqual([
      { titolo: "", voci: ["/volantini/attivi"] },
      { titolo: "CONSULTA", voci: [] },
    ]);
    expect(spostaTitoloConTastiera(sotto.modello, gruppo(modello, "CONSULTA"), 1).esito).toBe("ultima");
  });
});

describe("modello del menu: anteprima", () => {
  it("mostra solo le pagine consentite, per sezione, con la pagina iniziale fra quelle", () => {
    const { modello } = leggiMenu([
      separatore("CREA"),
      voce("/promozioni/nuova", "Nuova promozione", { start_page: true }),
      voce("/volantini/attivi", "Volantini attivi"),
      voce("/pop/attivi", "POP attivi"),
    ]);
    expect(vociDelModello(modello).find((v) => v.iniziale)?.pathname).toBe("/promozioni/nuova");

    const anteprima = anteprimaMenu(modello, aperturaConsentita(new Set(["materiali.visualizza"]), false));

    expect(anteprima.nascoste).toBe(1);
    // La voce segnata non è consentita: si entra dalla prima voce visibile
    expect(anteprima.paginaIniziale).toBe("/volantini/attivi");
    expect(anteprima.elementi).toEqual([
      { sezione: "visualizzazione", title: "Visualizzazione" },
      "CREA",
      expect.objectContaining({ title: "Volantini attivi", pathname: "/volantini/attivi", start_page: true }),
      expect.objectContaining({ title: "POP attivi", pathname: "/pop/attivi" }),
    ]);
  });

  it("mostra la voce nell'area scelta e la stessa pagina in due aree", () => {
    const { modello } = leggiMenu([
      separatore("PROMOZIONI"),
      voce("/promozioni/in-corso", "Promozioni in corso"),
      voce("/volantini/attivi", "Volantini", { sezione: "produzione" }),
      separatore("CONSULTA"),
      voce("/volantini/attivi", "Volantini attivi"),
    ]);

    const elementi = anteprimaMenu(modello, aperturaConsentita(null, true)).elementi;
    expect(elementi.map((e) => (typeof e === "string" ? `# ${e}` : "sezione" in e ? `== ${e.title}` : e.pathname))).toEqual([
      "== Produzione",
      "# PROMOZIONI",
      "/promozioni/in-corso",
      "/volantini/attivi",
      "== Visualizzazione",
      "# CONSULTA",
      "/volantini/attivi",
    ]);
  });

  it("senza permessi noti non filtra, e il Superadmin vede tutto", () => {
    const { modello } = leggiMenu([voce("/promozioni/nuova", "Nuova promozione")]);
    expect(anteprimaMenu(modello, aperturaConsentita(null, false)).nascoste).toBe(0);
    expect(anteprimaMenu(modello, aperturaConsentita(new Set(), true)).paginaIniziale).toBe("/promozioni/nuova");
  });
});
