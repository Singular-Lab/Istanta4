import { describe, expect, it } from "vitest";
import { ElementoMenu, Menu } from "@/stores/sideMenuSlice_istanta";
import {
  AREA_UNICA,
  areaDellaPagina,
  areaDelPercorso,
  areaIniziale,
  areeDelMenu,
  contaVoci,
  ElementoMenuFormattato,
  FormattedMenu,
  gruppiAttivi,
  gruppiAttiviDelleAree,
  nestedMenu,
  percorsoAttivo,
  toggleGruppo,
} from "./side-menu";

const menu: Array<Menu | string> = [
  "Promozioni",
  { icon: "Home", title: "Home", pathname: "/home" },
  {
    icon: "Settings",
    title: "Gestione interna",
    subMenu: [
      { icon: "Users", title: "Utenti", pathname: "/gestione-interna/gestione-utenti" },
      { icon: "Store", title: "Punti vendita", pathname: "/gestione-interna/punti-vendita" },
    ],
  },
  {
    icon: "Printer",
    title: "Stampa",
    subMenu: [{ icon: "List", title: "Ordini", pathname: "/ordini", ignore: true }],
  },
];

const formatta = (pathname: string) => nestedMenu(menu, { pathname, search: "" });
const voce = (voci: ElementoMenuFormattato[], indice: number) => voci[indice] as FormattedMenu;

describe("menu laterale", () => {
  it("tiene aperto il gruppo che contiene la pagina corrente", () => {
    const voci = formatta("/gestione-interna/punti-vendita");

    expect(gruppiAttivi(voci)).toEqual(["2"]);
    expect(voce(voci, 2).active).toBe(true);
    expect(voce(voci, 2).subMenu![1].active).toBe(true);
  });

  it("non apre gruppi se la pagina corrente non ne fa parte", () => {
    expect(gruppiAttivi(formatta("/home"))).toEqual([]);
  });

  it("una voce ignorata non diventa attiva e non apre il suo gruppo", () => {
    const voci = formatta("/ordini");

    expect(voce(voci, 3).active).toBeFalsy();
    expect(gruppiAttivi(voci)).toEqual([]);
  });

  it("le intestazioni di sezione passano invariate e contano nella posizione dei gruppi", () => {
    const conSezioni = [{ sezione: "gestione" as const, title: "Gestione interna" }, ...menu];
    const voci = nestedMenu(conSezioni, { pathname: "/gestione-interna/punti-vendita", search: "" });

    expect(voci[0]).toEqual({ sezione: "gestione", title: "Gestione interna" });
    expect(gruppiAttivi(voci)).toEqual(["3"]);
  });

  it("toggleGruppo apre e chiude un gruppo senza toccare gli altri", () => {
    const aperti = new Set(["2"]);

    const conStampa = toggleGruppo(aperti, "3");
    expect([...conStampa].sort()).toEqual(["2", "3"]);
    expect([...aperti]).toEqual(["2"]);

    expect([...toggleGruppo(conStampa, "2")]).toEqual(["3"]);
  });
});

const menuAree: ElementoMenu[] = [
  { sezione: "produzione", title: "Produzione" },
  "PROMOZIONI",
  { icon: "Tag", title: "Promozioni in corso", pathname: "/promozioni/in-corso" },
  { icon: "History", title: "Storico promozioni", pathname: "/promozioni/storico" },
  { sezione: "visualizzazione", title: "Visualizzazione" },
  "MATERIALI VOLANTINO",
  { icon: "Newspaper", title: "Volantini attivi", pathname: "/volantini/attivi", start_page: true },
  { sezione: "gestione", title: "Gestione interna" },
  { icon: "Users", title: "Utenti", pathname: "/gestione-interna/utenti" },
  {
    icon: "Settings",
    title: "Impostazioni",
    subMenu: [
      { icon: "Store", title: "Canali", pathname: "/gestione-interna/canali" },
      { icon: "Circle", title: "Aree", pathname: "/gestione-interna/aree" },
    ],
  },
];

const areeIn = (pathname: string) => areeDelMenu(nestedMenu(menuAree, { pathname, search: "" }));

describe("aree del menu laterale", () => {
  it("ogni sezione apre un'area con gli elementi fino alla sezione successiva", () => {
    const aree = areeIn("/home");

    expect(aree.map((a) => a.chiave)).toEqual(["produzione", "visualizzazione", "gestione"]);
    expect(aree[0]).toMatchObject({
      titolo: "Produzione",
      icona: "Factory",
      descrizione: "Promozioni, stampa e impostazioni dei kit",
      amministrazione: false,
    });
    expect(aree[0].elementi.map((e) => (typeof e === "string" ? e : e.title))).toEqual([
      "PROMOZIONI",
      "Promozioni in corso",
      "Storico promozioni",
    ]);
    expect(aree[2].amministrazione).toBe(true);
  });

  it("un menu senza sezioni è un'area unica con tutti i suoi elementi", () => {
    const aree = areeDelMenu(formatta("/home"));

    expect(aree).toHaveLength(1);
    expect(aree[0].chiave).toBe(AREA_UNICA);
    expect(aree[0].elementi).toHaveLength(4);
  });

  it("le aree senza voci non compaiono e gli elementi prima della prima sezione vanno nella prima area", () => {
    const aree = areeDelMenu([
      { icon: "Home", title: "Home", pathname: "/home" },
      { sezione: "produzione", title: "Produzione" },
      { icon: "Tag", title: "Promozioni in corso", pathname: "/promozioni/in-corso" },
      { sezione: "comunicazione", title: "Comunicazione" },
      "SOLO UN GRUPPO",
    ]);

    expect(aree.map((a) => a.chiave)).toEqual(["produzione"]);
    expect(aree[0].elementi.map((e) => (typeof e === "string" ? e : e.title))).toEqual([
      "Home",
      "Promozioni in corso",
    ]);
  });

  it("l'area della pagina è quella della voce attiva, anche tramite una sottovoce", () => {
    expect(areaDellaPagina(areeIn("/volantini/attivi"))?.chiave).toBe("visualizzazione");
    expect(areaDellaPagina(areeIn("/gestione-interna/aree"))?.chiave).toBe("gestione");
    expect(areaDellaPagina(areeIn("/profilo"))).toBeUndefined();
  });

  it("una pagina fuori dal menu ha l'area che le dà il catalogo delle pagine, se il menu la mostra", () => {
    const aree = areeIn("/volantini/promozioni/p1");

    expect(areaDellaPagina(aree)).toBeUndefined();
    expect(areaDelPercorso(aree, "/volantini/promozioni/p1")?.chiave).toBe("visualizzazione");
    expect(areaDelPercorso(aree, "/volantini/tutti_i_volantini")?.chiave).toBe("visualizzazione");
    // Fuori dal catalogo, o senza indirizzo, nessuna area
    expect(areaDelPercorso(aree, "/profilo")).toBeUndefined();
    expect(areaDelPercorso(aree, undefined)).toBeUndefined();
    // Un'area che il menu non mostra non vale
    expect(areaDelPercorso(aree.filter((a) => a.chiave !== "visualizzazione"), "/volantini/promozioni/p1")).toBeUndefined();
  });

  it("percorsoAttivo restituisce l'indirizzo della voce attiva più interna", () => {
    const gestione = areeIn("/gestione-interna/aree")[2];

    expect(percorsoAttivo(gestione.elementi)).toBe("/gestione-interna/aree");
    expect(percorsoAttivo(areeIn("/profilo")[2].elementi)).toBeUndefined();
  });

  it("all'inizio mostra l'area della pagina iniziale, altrimenti la prima", () => {
    expect(nestedMenu(menuAree, { pathname: "/", search: "" })).toContainEqual(
      expect.objectContaining({ title: "Volantini attivi", start_page: true })
    );
    expect(areaIniziale(areeIn("/profilo"))?.chiave).toBe("visualizzazione");

    const senzaPaginaIniziale = menuAree.map((e) =>
      typeof e === "object" && "start_page" in e ? { ...e, start_page: false } : e
    );
    expect(areaIniziale(areeDelMenu(nestedMenu(senzaPaginaIniziale, { pathname: "/", search: "" })))?.chiave).toBe(
      "produzione"
    );
    expect(areaIniziale([])).toBeUndefined();
  });

  it("contaVoci conta le pagine dell'area, comprese le sottovoci", () => {
    const aree = areeIn("/home");

    expect(aree.map((a) => contaVoci(a.elementi))).toEqual([2, 1, 3]);
  });

  it("le chiavi dei gruppi aperti includono l'area: restano le stesse cambiando area", () => {
    expect(gruppiAttiviDelleAree(areeIn("/gestione-interna/canali"))).toEqual(["gestione:1"]);
    expect(gruppiAttiviDelleAree(areeIn("/promozioni/in-corso"))).toEqual([]);
  });
});
