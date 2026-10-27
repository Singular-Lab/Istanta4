// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Menu } from "@/stores/sideMenuSlice_istanta";
import { nestedMenu } from "./side-menu";
import SideMenu from "./SideMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function Pagina() {
  const location = useLocation();
  return (
    <>
      <SideMenu menu={nestedMenu(menu, location)} />
      <output data-testid="percorso">{location.pathname}</output>
    </>
  );
}

const apri = (percorso: string) =>
  act(() => {
    radice.render(
      <MemoryRouter initialEntries={[percorso]}>
        <Routes>
          <Route path="*" element={<Pagina />} />
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
});
