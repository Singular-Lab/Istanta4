// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Skeleton from ".";

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

describe("Skeleton", () => {
  it("le dimensioni passate con className non vengono sovrascritte", () => {
    const blocco = disegna(<Skeleton className="w-10 h-10 rounded-full" />);

    expect(blocco.style.width).toBe("");
    expect(blocco.style.height).toBe("");
    expect(blocco.style.borderRadius).toBe("");
    expect(blocco.className).toContain("w-10");
    expect(blocco.className).toContain("h-10");
    expect(blocco.className).toContain("rounded-full");
    expect(blocco.className).not.toMatch(/\bw-full\b|\bh-5\b/);
  });

  it("senza indicazioni occupa tutta la larghezza con altezza predefinita", () => {
    const blocco = disegna(<Skeleton />);

    expect(blocco.className).toContain("w-full");
    expect(blocco.className).toContain("h-5");
  });

  it("height, width e borderRadius espliciti restano validi", () => {
    const blocco = disegna(<Skeleton height="40px" width="100px" borderRadius="12px" />);

    expect(blocco.style.height).toBe("40px");
    expect(blocco.style.width).toBe("100px");
    expect(blocco.style.borderRadius).toBe("12px");
  });
});
