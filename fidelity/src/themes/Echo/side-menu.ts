import { ElementoMenu, Menu } from "@/stores/sideMenuSlice_istanta";
import { sezioneDiPercorso } from "../../../lib/accessi/pagine";
import { eSezioneMenu, SEZIONI } from "../../../lib/accessi/sezioni";
import type { MenuSezione } from "../../../lib/types";
import { NavigateFunction } from "react-router-dom";

interface Location {
  pathname: string;
  search: string;
  forceActiveMenu?: string;
}

export interface FormattedMenu extends Menu {
  active?: boolean;
  activeDropdown?: boolean;
  subMenu?: FormattedMenu[];
}

/** Un elemento del menu laterale pronto da mostrare: voce, intestazione di gruppo o inizio di un'area. */
export type ElementoMenuFormattato = FormattedMenu | string | MenuSezione;

// Setup side menu
/**
 * Determina ricorsivamente se un menu o uno dei suoi sottomenu corrisponde
 * al percorso attuale in base all’oggetto `Location`, tenendo conto del flag
 * `forceActiveMenu`. Restituisce `true` se viene trovato un elemento attivo,
 * altrimenti `false`.
 *
 * @param subMenu - Collezione di voci di menu da analizzare.
 * @param location - Informazioni sulla posizione corrente, inclusi pathname, query string e flag di forzatura.
 * @returns `true` se una voce corrispondente viene trovata, `false` in caso contrario.
 */
const findActiveMenu = (subMenu: Menu[], location: Location): boolean => {
  let match = false;

  subMenu.forEach((item) => {
    if (
      (
        (location.forceActiveMenu !== undefined &&
          item.pathname === location.forceActiveMenu) ||
        (location.forceActiveMenu === undefined &&
          item.pathname === location.pathname)
      ) &&
      !item.ignore
    ) {
      match = true;
    } else if (!match && item.subMenu) {
      match = findActiveMenu(item.subMenu, location);
    }
  });

  return match;
};

const nestedMenu = (menu: ElementoMenu[], location: Location) => {
  const formattedMenu: ElementoMenuFormattato[] = [];
  menu.forEach((item) => {
    if (typeof item !== "string" && !eSezioneMenu(item)) {
      const menuItem: FormattedMenu = {
        icon: item.icon,
        title: item.title,
        badge: item.badge,
        pathname: item.pathname,
        subMenu: item.subMenu,
        ignore: item.ignore,
        disabled: item.disabled,
        visible: item.visible,
        start_page: item.start_page
      };
      menuItem.active =
        ((location.forceActiveMenu !== undefined &&
          menuItem.pathname === location.forceActiveMenu) ||
          (location.forceActiveMenu === undefined &&
            menuItem.pathname === location.pathname + location.search) ||
          (menuItem.subMenu && findActiveMenu(menuItem.subMenu, location))) &&
        !menuItem.ignore;

      if (menuItem.subMenu) {
        menuItem.activeDropdown = findActiveMenu(menuItem.subMenu, location);

        // Nested menu
        const subMenu: Array<FormattedMenu> = [];
        nestedMenu(menuItem.subMenu, location).map(
          (menu) => typeof menu !== "string" && !eSezioneMenu(menu) && subMenu.push(menu)
        );
        menuItem.subMenu = subMenu;
      }

      formattedMenu.push(menuItem);
    } else {
      formattedMenu.push(item);
    }
  });

  return formattedMenu;
};

const linkTo = (menu: FormattedMenu, navigate: NavigateFunction) => {
  if (menu.subMenu && menu.subMenu.length > 0) {
    menu.activeDropdown = !menu.activeDropdown;
  } else {
    if (menu.pathname !== undefined) {
      navigate(menu.pathname);
    }
  }
};

/**
 * Chiavi dei gruppi che contengono la pagina corrente: sono quelli da tenere
 * aperti. La chiave di un gruppo e la posizione nel menu ("2", "2.0", ...).
 */
const gruppiAttivi = (
  menu: ElementoMenuFormattato[],
  prefisso = ""
): string[] => {
  const chiavi: string[] = [];
  menu.forEach((item, indice) => {
    if (typeof item === "string" || eSezioneMenu(item) || !item.subMenu || item.subMenu.length === 0) {
      return;
    }
    const chiave = prefisso + indice;
    if (item.activeDropdown) {
      chiavi.push(chiave);
    }
    chiavi.push(...gruppiAttivi(item.subMenu, `${chiave}.`));
  });
  return chiavi;
};

/** Apre il gruppo se e chiuso, lo chiude se e aperto; gli altri restano come sono. */
const toggleGruppo = (aperti: ReadonlySet<string>, chiave: string): Set<string> => {
  const prossimi = new Set(aperti);
  if (prossimi.has(chiave)) {
    prossimi.delete(chiave);
  } else {
    prossimi.add(chiave);
  }
  return prossimi;
};

/**
 * Un'area del menu laterale: una sezione di primo livello (Produzione, Visualizzazione...) con le
 * sue voci e le intestazioni dei suoi gruppi. Il menu ne mostra una alla volta.
 */
export interface AreaMenu {
  /** Identifica l'area nel selettore e nelle chiavi dei gruppi aperti: la sezione, o AREA_UNICA. */
  chiave: string;
  titolo: string;
  /** Icona Lucide (PascalCase) del riquadro nel selettore. */
  icona: string;
  descrizione: string;
  /** Gestione interna e Sistema: nel selettore stanno dopo le aree di lavoro. */
  amministrazione: boolean;
  /** Voci e intestazioni di gruppo dell'area, nell'ordine del menu, senza l'elemento della sezione. */
  elementi: Array<FormattedMenu | string>;
}

/** Chiave dell'area di un menu senza sezioni (server che non le manda): una sola area, senza selettore. */
const AREA_UNICA = "menu";

const nuovaArea = (elemento: MenuSezione): AreaMenu => {
  const nota = SEZIONI.find((s) => s.sezione === elemento.sezione);
  return {
    chiave: elemento.sezione,
    titolo: elemento.title || nota?.titolo || elemento.sezione,
    icona: nota?.icona ?? "LayoutGrid",
    descrizione: nota?.descrizione ?? "",
    amministrazione: nota?.amministrazione ?? false,
    elementi: [],
  };
};

const haVoci = (area: AreaMenu) => area.elementi.some((elemento) => typeof elemento !== "string");

/**
 * Divide il menu nelle sue aree: ogni elemento `sezione` apre un'area che contiene gli elementi
 * fino alla sezione successiva. Gli elementi prima della prima sezione vanno nella prima area; una
 * sezione ripetuta riprende la sua area. Un menu senza sezioni è un'area unica; le aree senza voci
 * (solo intestazioni) non compaiono.
 */
const areeDelMenu = (menu: ReadonlyArray<ElementoMenuFormattato>): AreaMenu[] => {
  const aree: AreaMenu[] = [];
  const iniziali: Array<FormattedMenu | string> = [];
  let corrente: AreaMenu | undefined;

  for (const elemento of menu) {
    if (eSezioneMenu(elemento)) {
      corrente = aree.find((area) => area.chiave === elemento.sezione);
      if (!corrente) {
        corrente = nuovaArea(elemento);
        if (aree.length === 0) {
          corrente.elementi.push(...iniziali);
        }
        aree.push(corrente);
      }
    } else if (corrente) {
      corrente.elementi.push(elemento);
    } else {
      iniziali.push(elemento);
    }
  }

  if (aree.length === 0) {
    aree.push({
      chiave: AREA_UNICA,
      titolo: "Menu",
      icona: "LayoutGrid",
      descrizione: "",
      amministrazione: false,
      elementi: iniziali,
    });
  }
  return aree.filter(haVoci);
};

/** Prefisso delle chiavi dei gruppi di un'area: tiene distinti i gruppi di aree diverse. */
const prefissoArea = (chiave: string) => `${chiave}:`;

/** Chiavi dei gruppi da tenere aperti in tutte le aree ("produzione:2", "gestione:0.1"...). */
const gruppiAttiviDelleAree = (aree: ReadonlyArray<AreaMenu>): string[] =>
  aree.flatMap((area) => gruppiAttivi(area.elementi, prefissoArea(area.chiave)));

/** L'area che contiene la pagina corrente (voce attiva, anche tramite una sottovoce). */
const areaDellaPagina = (aree: ReadonlyArray<AreaMenu>): AreaMenu | undefined =>
  aree.find((area) => area.elementi.some((elemento) => typeof elemento !== "string" && elemento.active));

/**
 * L'area di una pagina che non è una voce del menu (dettaglio di una promozione, insight di un
 * volantino...): quella che il catalogo delle pagine le assegna, se il menu la mostra. Così la
 * consultazione resta in Visualizzazione invece di ricadere sulla prima area.
 */
const areaDelPercorso = (aree: ReadonlyArray<AreaMenu>, percorso: string | undefined): AreaMenu | undefined => {
  const sezione = percorso ? sezioneDiPercorso(percorso) : undefined;
  return sezione ? aree.find((area) => area.chiave === sezione) : undefined;
};

/** Indirizzo della voce attiva più interna, per accorgersi che la pagina corrente è cambiata. */
const percorsoAttivo = (voci: ReadonlyArray<FormattedMenu | string>): string | undefined => {
  for (const voce of voci) {
    if (typeof voce === "string" || !voce.active) {
      continue;
    }
    return (voce.subMenu && percorsoAttivo(voce.subMenu)) ?? voce.pathname ?? voce.title;
  }
  return undefined;
};

const contienePaginaIniziale = (voci: ReadonlyArray<FormattedMenu | string>): boolean =>
  voci.some(
    (voce) =>
      typeof voce !== "string" &&
      (voce.start_page === true || (!!voce.subMenu && contienePaginaIniziale(voce.subMenu)))
  );

/** Area da mostrare finché non ce n'è una scelta o della pagina: quella della pagina iniziale, o la prima. */
const areaIniziale = (aree: ReadonlyArray<AreaMenu>): AreaMenu | undefined =>
  aree.find((area) => contienePaginaIniziale(area.elementi)) ?? aree[0];

/** Pagine che l'area apre: le voci e le sottovoci con un indirizzo, o senza sottovoci. */
const contaVoci = (voci: ReadonlyArray<FormattedMenu | string>): number =>
  voci.reduce<number>((totale, voce) => {
    if (typeof voce === "string") {
      return totale;
    }
    const sottovoci = voce.subMenu ?? [];
    const propria = voce.pathname || sottovoci.length === 0 ? 1 : 0;
    return totale + propria + contaVoci(sottovoci);
  }, 0);

export {
  AREA_UNICA,
  areaDellaPagina,
  areaDelPercorso,
  areaIniziale,
  areeDelMenu,
  contaVoci,
  gruppiAttivi,
  gruppiAttiviDelleAree,
  linkTo,
  nestedMenu,
  percorsoAttivo,
  prefissoArea,
  toggleGruppo,
};
