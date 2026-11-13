// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElementoMenu, Menu } from "@/stores/sideMenuSlice_istanta";
import { nestedMenu } from "./side-menu";
import SideMenu from "./SideMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom non implementa ResizeObserver, usato da Headless UI per l'elenco ancorato del selettore
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const sottovoci: Menu[] = Array.from({ length: 12 }, (_, i) => ({
  icon: "Circle",
  title: `Voce ${i + 1}`,
  pathname: `/gestione-interna/voce-${i + 1}`,
}));

const menu: Array<Menu | string> = [
  { icon: "Home", title: "Home", pathname: "/home" },
  { icon: "Lock", title: "Archivio", pathname: "/archivio", disabled: true },
  { icon: "Settings", title: "Gestione interna", subMenu: sottovoci },
];

let contenitore: HTMLDivElement;
let radice: Root;

/** Menu diviso in aree, come lo manda /api/menu/me. */
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

interface PaginaProps {
  voci?: ElementoMenu[];
  compresso?: boolean;
  onSeleziona?: (pathname: string) => void;
}

/** Il menu e, fuori dal menu, il percorso corrente e i collegamenti di una pagina qualsiasi. */
function Pagina({ voci = menu, compresso, onSeleziona }: PaginaProps) {
  const location = useLocation();
  return (
    <>
      <SideMenu menu={nestedMenu(voci, location)} percorso={location.pathname} compresso={compresso} onSeleziona={onSeleziona} />
      <output data-testid="percorso">{location.pathname}</output>
      <div data-testid="contenuto">
        <Link to="/promozioni/storico">Vai allo storico</Link>
        <Link to="/volantini/attivi">Vai ai volantini</Link>
        <Link to="/profilo">Vai al profilo</Link>
        <Link to="/volantini/promozioni/p1">Vai alla promozione</Link>
        <Link to="/volantini/tutti_i_volantini?kit=k1">Vai al volantino</Link>
      </div>
    </>
  );
}

const apri = (percorso: string, voci?: ElementoMenu[], altre: Omit<PaginaProps, "voci"> = {}) =>
  act(() => {
    radice.render(
      // La chiave rifà il router a ogni apertura: initialEntries vale solo alla creazione
      <MemoryRouter key={percorso} initialEntries={[percorso]}>
        <Routes>
          <Route path="*" element={<Pagina voci={voci} {...altre} />} />
        </Routes>
      </MemoryRouter>
    );
  });

const gruppo = () =>
  [...contenitore.querySelectorAll("button")].find((b) => b.textContent?.includes("Gestione interna"))!;
const sottomenu = () => contenitore.querySelector(`#${gruppo().getAttribute("aria-controls")}`)!.parentElement!;
const clic = (elemento: Element) =>
  act(() => {
    elemento.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });

const percorso = () => contenitore.querySelector('[data-testid="percorso"]')!.textContent;
const menuLaterale = () => contenitore.querySelector("ul.scrollable")!;
const vociMostrate = () =>
  [...menuLaterale().querySelectorAll(".side-menu__link__title")].map((titolo) => titolo.textContent);
const vocePagina = () => menuLaterale().querySelector('[aria-current="page"]');
const voceMenu = (titolo: string) =>
  [...menuLaterale().querySelectorAll<HTMLElement>(".side-menu__link")].find(
    (voce) => voce.querySelector(".side-menu__link__title")?.textContent === titolo
  )!;
const pulsanteArea = () => contenitore.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]');
// L'elenco delle aree si apre in un portale nel body
const elencoAree = () => document.querySelector<HTMLElement>('[role="listbox"]');
const opzioneArea = (nome: string) =>
  [...document.querySelectorAll('[role="option"]')].find(
    (opzione) => opzione.querySelector(".selettore-area__nome")?.textContent === nome
  )!;
const collegamento = (testo: string) =>
  [...contenitore.querySelectorAll('[data-testid="contenuto"] a')].find((a) => a.textContent === testo)!;
const scegliArea = (nome: string) => {
  clic(pulsanteArea()!);
  clic(opzioneArea(nome));
};

beforeEach(() => {
  contenitore = document.createElement("div");
  document.body.appendChild(contenitore);
  radice = createRoot(contenitore);
});

afterEach(() => {
  act(() => radice.unmount());
  contenitore.remove();
});

describe("SideMenu", () => {
  it("il click apre un gruppo chiuso con tutte le sottovoci e un secondo click lo richiude", () => {
    apri("/home");
    expect(gruppo().getAttribute("aria-expanded")).toBe("false");
    expect(sottomenu().dataset.open).toBe("false");

    clic(gruppo());
    expect(gruppo().getAttribute("aria-expanded")).toBe("true");
    expect(sottomenu().dataset.open).toBe("true");
    expect(sottomenu().querySelectorAll("a")).toHaveLength(12);
    expect(sottomenu().className).not.toMatch(/max-h/);

    clic(gruppo());
    expect(gruppo().getAttribute("aria-expanded")).toBe("false");
  });

  it("segna la pagina corrente e apre il suo gruppo", () => {
    apri("/gestione-interna/voce-12");

    expect(gruppo().getAttribute("aria-expanded")).toBe("true");
    const correnti = contenitore.querySelectorAll('[aria-current="page"]');
    expect(correnti).toHaveLength(1);
    expect(correnti[0].textContent).toContain("Voce 12");
  });

  it("una voce disattivata non cambia pagina", () => {
    apri("/home");
    const archivio = [...contenitore.querySelectorAll("a")].find((a) => a.textContent?.includes("Archivio"))!;

    expect(archivio.getAttribute("aria-disabled")).toBe("true");
    clic(archivio);
    expect(contenitore.querySelector('[data-testid="percorso"]')!.textContent).toBe("/home");
  });

  it("un menu senza sezioni mostra tutte le voci senza selettore dell'area", () => {
    apri("/home");

    expect(pulsanteArea()).toBeNull();
    expect(vociMostrate()).toEqual(["Home", "Archivio", "Gestione interna", ...sottovoci.map((v) => v.title)]);
  });
});

describe("SideMenu ad area attiva", () => {
  it("con una sola area non mostra il selettore", () => {
    apri("/volantini/attivi", [
      { sezione: "visualizzazione", title: "Visualizzazione" },
      "MATERIALI VOLANTINO",
      { icon: "Newspaper", title: "Volantini attivi", pathname: "/volantini/attivi" },
    ]);

    expect(pulsanteArea()).toBeNull();
    expect(vociMostrate()).toEqual(["Volantini attivi"]);
    expect(menuLaterale().querySelectorAll(".side-menu__divider")).toHaveLength(1);
  });

  it("con più aree mostra il selettore e le sole voci dell'area della pagina corrente", () => {
    apri("/promozioni/in-corso", menuAree);

    const pulsante = pulsanteArea()!;
    expect(pulsante).not.toBeNull();
    expect(pulsante.getAttribute("aria-label")).toBe("Area: Produzione");
    expect(pulsante.getAttribute("aria-expanded")).toBe("false");
    expect(pulsante.textContent).toContain("Promozioni, stampa e impostazioni dei kit");
    expect(vociMostrate()).toEqual(["Promozioni in corso", "Storico promozioni"]);
    expect([...menuLaterale().querySelectorAll(".side-menu__divider")].map((g) => g.textContent)).toEqual([
      "PROMOZIONI",
    ]);
    expect(vocePagina()!.textContent).toContain("Promozioni in corso");
  });

  it("l'area segue la pagina corrente, anche quando la pagina è una sottovoce", () => {
    apri("/promozioni/in-corso", menuAree);

    clic(collegamento("Vai ai volantini"));
    expect(percorso()).toBe("/volantini/attivi");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");
    expect(vociMostrate()).toEqual(["Volantini attivi"]);
    expect(vocePagina()!.textContent).toContain("Volantini attivi");

    apri("/gestione-interna/aree", menuAree);
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Gestione interna");
    expect(vocePagina()!.textContent).toContain("Aree");
  });

  it("scegliere un'area dal selettore cambia le voci ma non la pagina", () => {
    apri("/promozioni/in-corso", menuAree);

    scegliArea("Visualizzazione");

    expect(percorso()).toBe("/promozioni/in-corso");
    expect(elencoAree()).toBeNull();
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");
    expect(vociMostrate()).toEqual(["Volantini attivi"]);
    expect(vocePagina()).toBeNull();
  });

  it("dopo una scelta dal selettore, aprire una pagina di un'altra area riporta il menu su quell'area", () => {
    apri("/promozioni/in-corso", menuAree);
    scegliArea("Gestione interna");
    expect(vociMostrate()).toEqual(["Utenti", "Impostazioni", "Canali", "Aree"]);

    clic(collegamento("Vai allo storico"));

    expect(percorso()).toBe("/promozioni/storico");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");
    expect(vocePagina()!.textContent).toContain("Storico promozioni");
  });

  /** "Volantini attivi" messa anche in Produzione dall'amministratore. */
  const menuDueAree: ElementoMenu[] = [
    { sezione: "produzione", title: "Produzione" },
    "PROMOZIONI",
    { icon: "Tag", title: "Promozioni in corso", pathname: "/promozioni/in-corso" },
    { icon: "Newspaper", title: "Volantini da Produzione", pathname: "/volantini/attivi", area: "produzione" },
    { sezione: "visualizzazione", title: "Visualizzazione" },
    "MATERIALI VOLANTINO",
    { icon: "Newspaper", title: "Volantini attivi", pathname: "/volantini/attivi" },
    { sezione: "comunicazione", title: "Comunicazione" },
    { icon: "Send", title: "Campagne", pathname: "/whatsapp/campagne-whatsapp" },
  ];

  it("una pagina in due aree, aperta dall'area mostrata, lascia il menu su quell'area", () => {
    apri("/promozioni/in-corso", menuDueAree);
    clic(voceMenu("Volantini da Produzione"));
    expect(percorso()).toBe("/volantini/attivi");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");
    expect(vocePagina()!.textContent).toContain("Volantini da Produzione");

    clic(voceMenu("Promozioni in corso"));
    scegliArea("Visualizzazione");
    clic(voceMenu("Volantini attivi"));
    expect(percorso()).toBe("/volantini/attivi");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");
    expect(vocePagina()!.textContent).toContain("Volantini attivi");
  });

  it("una pagina in due aree, aperta da un'area che non la contiene, porta il menu sulla prima area che la contiene", () => {
    apri("/promozioni/in-corso", menuDueAree);
    scegliArea("Comunicazione");

    clic(collegamento("Vai ai volantini"));

    expect(percorso()).toBe("/volantini/attivi");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");
    expect(vocePagina()!.textContent).toContain("Volantini da Produzione");
  });

  it("aperta direttamente, una pagina in due aree mostra la prima area che la contiene", () => {
    apri("/volantini/attivi", menuDueAree);
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");
  });

  it("se la pagina corrente non è nel menu né nel catalogo delle pagine resta l'ultima area; all'inizio quella della pagina iniziale", () => {
    apri("/profilo", menuAree);
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");

    clic(collegamento("Vai allo storico"));
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");

    clic(collegamento("Vai al profilo"));
    expect(percorso()).toBe("/profilo");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");
    expect(vociMostrate()).toEqual(["Promozioni in corso", "Storico promozioni"]);
  });

  it("una pagina fuori dal menu prende l'area del catalogo: il dettaglio di una promozione è in Visualizzazione", () => {
    apri("/promozioni/in-corso", menuAree);
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Produzione");

    clic(collegamento("Vai alla promozione"));

    expect(percorso()).toBe("/volantini/promozioni/p1");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");
    expect(vociMostrate()).toEqual(["Volantini attivi"]);
    // Non è una voce del menu: nessuna voce è segnata come pagina corrente
    expect(vocePagina()).toBeNull();
  });

  it("aperta direttamente, una pagina fuori dal menu non mostra l'area della pagina iniziale ma la sua", () => {
    // La pagina iniziale è in Produzione: prima ci si ricadeva
    const conInizioInProduzione = menuAree.map((voce) =>
      typeof voce === "object" && "pathname" in voce && voce.pathname === "/volantini/attivi"
        ? { ...voce, start_page: false }
        : typeof voce === "object" && "pathname" in voce && voce.pathname === "/promozioni/in-corso"
          ? { ...voce, start_page: true }
          : voce
    );
    apri("/volantini/tutti_i_volantini", conInizioInProduzione);

    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");

    // Dal selettore si cambia area senza cambiare pagina; aprendo un'altra pagina fuori menu si torna alla sua area
    scegliArea("Gestione interna");
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Gestione interna");
    clic(collegamento("Vai alla promozione"));
    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");
  });

  it("l'elenco mette le aree di lavoro prima di \"Amministrazione\", con la spunta sull'area corrente", () => {
    apri("/promozioni/in-corso", menuAree);

    clic(pulsanteArea()!);

    expect(pulsanteArea()!.getAttribute("aria-expanded")).toBe("true");
    const gruppi = [...elencoAree()!.querySelectorAll('[role="group"]')];
    const nomi = (gruppo: Element) =>
      [...gruppo.querySelectorAll('[role="option"] .selettore-area__nome')].map((n) => n.textContent);
    expect(gruppi).toHaveLength(2);
    expect(nomi(gruppi[0])).toEqual(["Produzione", "Visualizzazione"]);
    expect(gruppi[1].querySelector(".selettore-area__separatore")!.textContent).toBe("Amministrazione");
    expect(nomi(gruppi[1])).toEqual(["Gestione interna"]);

    const corrente = opzioneArea("Produzione");
    expect(corrente.getAttribute("aria-selected")).toBe("true");
    expect(corrente.querySelector(".selettore-area__spunta")).not.toBeNull();
    expect(corrente.querySelector(".selettore-area__conta")).toBeNull();
    expect(opzioneArea("Visualizzazione").getAttribute("aria-selected")).toBe("false");
    expect(opzioneArea("Visualizzazione").querySelector(".selettore-area__conta")!.textContent).toBe("1 voce");
    expect(opzioneArea("Gestione interna").querySelector(".selettore-area__conta")!.textContent).toBe("3 voci");
  });

  it("Esc chiude l'elenco e riporta il focus sul pulsante dell'area", () => {
    apri("/promozioni/in-corso", menuAree);
    const pulsante = pulsanteArea()!;

    clic(pulsante);
    const elenco = elencoAree()!;
    expect(elenco).not.toBeNull();
    act(() => {
      elenco.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });

    expect(elencoAree()).toBeNull();
    expect(pulsante.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(pulsante);
    expect(vociMostrate()).toEqual(["Promozioni in corso", "Storico promozioni"]);
  });

  it("i gruppi aperti in un'area restano aperti tornandoci", () => {
    apri("/promozioni/in-corso", menuAree);
    scegliArea("Gestione interna");
    const impostazioni = () => voceMenu("Impostazioni");
    expect(impostazioni().getAttribute("aria-expanded")).toBe("false");

    clic(impostazioni());
    scegliArea("Produzione");
    scegliArea("Gestione interna");

    expect(impostazioni().getAttribute("aria-expanded")).toBe("true");
  });

  it("nel menu compresso il selettore resta il riquadro dell'area e l'elenco si apre più largo", () => {
    apri("/promozioni/in-corso", menuAree, { compresso: true });

    expect(contenitore.querySelector(".selettore-area")!.classList).toContain("selettore-area--compresso");
    expect(pulsanteArea()!.getAttribute("title")).toBe("Area: Produzione");

    clic(pulsanteArea()!);
    expect(elencoAree()!.classList).toContain("selettore-area__elenco--compresso");
    clic(opzioneArea("Visualizzazione"));
    expect(menuLaterale().querySelector(".side-menu__link")!.getAttribute("title")).toBe("Volantini attivi");
  });

  it("con onSeleziona le voci sono pulsanti che passano l'indirizzo e non cambiano pagina", () => {
    const seleziona = vi.fn();
    apri("/promozioni/in-corso", menuAree, { onSeleziona: seleziona });

    expect(menuLaterale().querySelectorAll("a")).toHaveLength(0);
    const storico = voceMenu("Storico promozioni");
    expect(storico.tagName).toBe("BUTTON");
    clic(storico);

    expect(seleziona).toHaveBeenCalledWith("/promozioni/storico");
    expect(percorso()).toBe("/promozioni/in-corso");
    expect(vocePagina()!.textContent).toContain("Promozioni in corso");
  });

  it("con onSeleziona funziona anche fuori dal router e dal layout", () => {
    const seleziona = vi.fn();
    act(() => {
      radice.render(
        <SideMenu
          menu={nestedMenu(menuAree, { pathname: "/volantini/attivi", search: "" })}
          onSeleziona={seleziona}
        />
      );
    });

    expect(pulsanteArea()!.getAttribute("aria-label")).toBe("Area: Visualizzazione");
    scegliArea("Gestione interna");
    expect(vociMostrate()).toEqual(["Utenti", "Impostazioni", "Canali", "Aree"]);

    clic(voceMenu("Utenti"));
    expect(seleziona).toHaveBeenCalledWith("/gestione-interna/utenti");
  });
});
