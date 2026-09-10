import { Menu } from "@/stores/sideMenuSlice_istanta";
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

const nestedMenu = (menu: Array<Menu | string>, location: Location) => {
  const formattedMenu: Array<FormattedMenu | string> = [];
  menu.forEach((item) => {
    if (typeof item !== "string") {
      const menuItem: FormattedMenu = {
        icon: item.icon,
        title: item.title,
        badge: item.badge,
        pathname: item.pathname,
        subMenu: item.subMenu,
        ignore: item.ignore,
        disabled: item.disabled,
        visible: item.visible
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
          (menu) => typeof menu !== "string" && subMenu.push(menu)
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

export { linkTo, nestedMenu };
