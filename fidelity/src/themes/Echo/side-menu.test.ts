import { describe, expect, it } from "vitest";
import { Menu } from "@/stores/sideMenuSlice_istanta";
import { FormattedMenu, gruppiAttivi, nestedMenu, toggleGruppo } from "./side-menu";

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
const voce = (voci: Array<FormattedMenu | string>, indice: number) => voci[indice] as FormattedMenu;

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

  it("toggleGruppo apre e chiude un gruppo senza toccare gli altri", () => {
    const aperti = new Set(["2"]);

    const conStampa = toggleGruppo(aperti, "3");
    expect([...conStampa].sort()).toEqual(["2", "3"]);
    expect([...aperti]).toEqual(["2"]);

    expect([...toggleGruppo(conStampa, "2")]).toEqual(["3"]);
  });
});
