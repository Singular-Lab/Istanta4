// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STATO_ORDINI_STAMPA, STATO_PROMO } from "../../../../lib/enums";
import StatusBadge from ".";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let contenitore: HTMLDivElement;
let radice: Root;

const disegna = (elemento: React.ReactElement) => {
  act(() => radice.render(elemento));
  return contenitore.firstElementChild as HTMLElement;
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

describe("StatusBadge", () => {
  it("mostra etichetta e tono dello stato dal catalogo", () => {
    const badge = disegna(<StatusBadge dominio="promo" stato={STATO_PROMO.VALIDA} />);

    expect(badge.textContent).toBe("Valida");
    expect(badge.title).toBe("Valida");
    expect(badge.dataset.tono).toBe("success");
    expect(badge.className).toContain("bg-teal-100");
  });

  it("lo stesso valore cambia etichetta secondo il dominio", () => {
    const badge = disegna(<StatusBadge dominio="ordineStampa" stato={STATO_ORDINI_STAMPA.FINITO} />);

    expect(badge.textContent).toBe("Completato");
  });

  it("uno stato sconosciuto non diventa uno stato valido", () => {
    const badge = disegna(<StatusBadge dominio="promo" stato="NON_PREVISTO" />);

    expect(badge.textContent).toBe("Stato sconosciuto");
    expect(badge.dataset.tono).toBe("neutral");
  });

  it("accetta tono ed etichetta diretti per stati fuori catalogo", () => {
    const badge = disegna(<StatusBadge tono="warning" etichetta="Da verificare" className="ml-2" />);

    expect(badge.textContent).toBe("Da verificare");
    expect(badge.dataset.tono).toBe("warning");
    expect(badge.className).toContain("ml-2");
  });
});
