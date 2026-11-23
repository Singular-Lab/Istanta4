// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSorvoloMenu } from "./useSorvoloMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let disegni = 0;

/** Come il layout: il contenitore del menu riceve i due gestori del puntatore. */
function Menu({ compresso }: { compresso: boolean }) {
  disegni++;
  const { sorvolato, onMouseEnter, onMouseLeave } = useSorvoloMenu(compresso);
  return (
    <div data-testid="menu" data-sorvolato={String(sorvolato)} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      voci
    </div>
  );
}

let contenitore: HTMLDivElement;
let radice: Root;

const menu = () => contenitore.querySelector<HTMLElement>('[data-testid="menu"]')!;
const sorvolato = () => menu().dataset.sorvolato;

function disegna(compresso: boolean) {
  act(() => radice.render(<Menu compresso={compresso} />));
}

// React ricava mouseenter e mouseleave da mouseover e mouseout
function entra() {
  act(() => {
    menu().dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
  });
}

function esce() {
  act(() => {
    menu().dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
  });
}

describe("useSorvoloMenu", () => {
  beforeEach(() => {
    disegni = 0;
    contenitore = document.createElement("div");
    document.body.appendChild(contenitore);
    radice = createRoot(contenitore);
  });

  afterEach(() => {
    act(() => radice.unmount());
    contenitore.remove();
  });

  it("a menu espanso entrare e uscire non ridisegna il menu", () => {
    disegna(false);
    const prima = disegni;

    for (let i = 0; i < 5; i++) {
      entra();
      esce();
    }

    expect(disegni).toBe(prima);
    expect(sorvolato()).toBe("false");
  });

  it("a menu compresso si apre all'entrata e si chiude all'uscita", () => {
    disegna(true);
    expect(sorvolato()).toBe("false");

    entra();
    expect(sorvolato()).toBe("true");

    esce();
    expect(sorvolato()).toBe("false");
  });

  it("comprimendo col puntatore sopra il menu resta aperto finché il puntatore non esce", () => {
    disegna(false);
    entra();

    disegna(true);
    expect(sorvolato()).toBe("true");

    esce();
    expect(sorvolato()).toBe("false");
  });

  it("comprimendo col puntatore fuori il menu si chiude subito", () => {
    disegna(false);
    entra();
    esce();

    disegna(true);

    expect(sorvolato()).toBe("false");
  });

  it("espandendo il menu il sorvolo torna falso", () => {
    disegna(true);
    entra();
    expect(sorvolato()).toBe("true");

    disegna(false);

    expect(sorvolato()).toBe("false");
  });
});
