import { describe, expect, it } from "vitest";
import {
  anteprimaMenu,
  aperturaConsentita,
  impostaPaginaIniziale,
  inserisciPagina,
  leggiMenu,
  serializzaMenu,
  spostaConTastiera,
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

  it("una pagina lasciata in un gruppo della sua area va nel punto di rilascio, con titolo e icona del catalogo", () => {
    const modello = base();
    const esito = inserisciPagina(modello, "/ods-in-corso", { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 1 });

    expect(esito).toMatchObject({ esito: "aggiunta", sezione: "produzione", altraArea: false });
    expect(forma(esito.modello)[0].gruppi[0].voci).toEqual(["/promozioni/nuova", "/ods-in-corso", "/nuovo-ods"]);
    expect(vociDelModello(esito.modello).find((v) => v.pathname === "/ods-in-corso")).toMatchObject({
      titolo: "Ordine di Stampa in corso",
      icona: "Truck",
    });
  });

  it("una pagina lasciata in un'altra area va in fondo alla sua, creando l'area con un gruppo senza titolo", () => {
    const modello = base();
    const esito = inserisciPagina(modello, "/whatsapp/campagne-whatsapp", { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 0 });

    expect(esito).toMatchObject({ esito: "aggiunta", sezione: "comunicazione", altraArea: true });
    expect(forma(esito.modello).map((a) => a.area)).toEqual(["produzione", "visualizzazione", "comunicazione"]);
    expect(forma(esito.modello)[2].gruppi).toEqual([{ titolo: "", voci: ["/whatsapp/campagne-whatsapp"] }]);
  });

  it("senza destinazione la pagina va in fondo all'ultimo gruppo della sua area", () => {
    const esito = inserisciPagina(base(), "/ods-completati");
    expect(forma(esito.modello)[0].gruppi[1].voci).toEqual(["/impostazioni-tipografia", "/ods-completati"]);
  });

  it("una pagina già nel menu non si aggiunge di nuovo", () => {
    const modello = base();
    const esito = inserisciPagina(modello, "/volantini/attivi/");
    expect(esito.esito).toBe("gia-presente");
    expect(esito.modello).toBe(modello);
  });

  it("una voce si sposta nella sua area ma non in un'altra", () => {
    const modello = base();
    const dentro = spostaVoce(modello, idDi(modello, "/promozioni/nuova"), { gruppoId: gruppoDi(modello, "/impostazioni-tipografia"), indice: 1 });
    expect(dentro.esito).toBe("spostata");
    expect(forma(dentro.modello)[0].gruppi).toEqual([
      { titolo: "CREA", voci: ["/nuovo-ods"] },
      { titolo: "IMPOSTAZIONI", voci: ["/impostazioni-tipografia", "/promozioni/nuova"] },
    ]);

    const fuori = spostaVoce(modello, idDi(modello, "/promozioni/nuova"), { gruppoId: gruppoDi(modello, "/volantini/attivi"), indice: 0 });
    expect(fuori.esito).toBe("altra-area");
    expect(fuori.modello).toBe(modello);
  });

  it("nello stesso gruppo il punto di rilascio conta le voci come si vedono", () => {
    const modello = base();
    const esito = spostaVoce(modello, idDi(modello, "/promozioni/nuova"), { gruppoId: gruppoDi(modello, "/nuovo-ods"), indice: 2 });
    expect(forma(esito.modello)[0].gruppi[0].voci).toEqual(["/nuovo-ods", "/promozioni/nuova"]);
  });

  it("da tastiera la voce passa al gruppo successivo o precedente della stessa area, e non oltre", () => {
    const modello = base();
    const giu = spostaConTastiera(modello, idDi(modello, "/nuovo-ods"), 1);
    expect(giu.esito).toBe("spostata");
    expect(forma(giu.modello)[0].gruppi).toEqual([
      { titolo: "CREA", voci: ["/promozioni/nuova"] },
      { titolo: "IMPOSTAZIONI", voci: ["/nuovo-ods", "/impostazioni-tipografia"] },
    ]);

    const su = spostaConTastiera(giu.modello, idDi(giu.modello, "/nuovo-ods"), -1);
    expect(forma(su.modello)[0].gruppi[0].voci).toEqual(["/promozioni/nuova", "/nuovo-ods"]);

    expect(spostaConTastiera(modello, idDi(modello, "/promozioni/nuova"), -1).esito).toBe("prima");
    // L'ultima voce di Produzione non passa a Visualizzazione
    expect(spostaConTastiera(modello, idDi(modello, "/impostazioni-tipografia"), 1).esito).toBe("ultima");
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

  it("senza permessi noti non filtra, e il Superadmin vede tutto", () => {
    const { modello } = leggiMenu([voce("/promozioni/nuova", "Nuova promozione")]);
    expect(anteprimaMenu(modello, aperturaConsentita(null, false)).nascoste).toBe(0);
    expect(anteprimaMenu(modello, aperturaConsentita(new Set(), true)).paginaIniziale).toBe("/promozioni/nuova");
  });
});
