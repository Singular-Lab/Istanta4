// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSimpleBar } from "./useSimpleBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// SimpleBar finto: conta le istanze create e smontate su ogni elemento
const simplebar = vi.hoisted(() => ({
  create: vi.fn<(el: HTMLElement) => void>(),
  unMount: vi.fn<(el: HTMLElement) => void>(),
}));

vi.mock("simplebar", () => ({
  default: class {
    el: HTMLElement;
    constructor(el: HTMLElement) {
      this.el = el;
      simplebar.create(el);
    }
    unMount() {
      simplebar.unMount(this.el);
    }
  },
}));

/** Come il layout: il contenitore del menu resta montato mentre la pagina cambia. */
function Layout() {
  const ref = useSimpleBar<HTMLDivElement>();
  const location = useLocation();
  return (
    <div>
      <div ref={ref} data-testid="menu">
        <span>{location.pathname}</span>
      </div>
      <Link to="/uno">Uno</Link>
      <Link to="/due">Due</Link>
    </div>
  );
}

let contenitore: HTMLDivElement;
let radice: Root;

const attive = () => simplebar.create.mock.calls.length - simplebar.unMount.mock.calls.length;

function clicca(testo: string) {
  const link = [...contenitore.querySelectorAll("a")].find((a) => a.textContent === testo)!;
  act(() => {
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
}

describe("useSimpleBar", () => {
  beforeEach(() => {
    simplebar.create.mockClear();
    simplebar.unMount.mockClear();
    contenitore = document.createElement("div");
    document.body.appendChild(contenitore);
    radice = createRoot(contenitore);
  });

  afterEach(() => {
    act(() => radice.unmount());
    contenitore.remove();
  });

  it("crea una sola barra sull'elemento, anche dopo molti cambi di pagina", () => {
    act(() => {
      radice.render(
        <MemoryRouter initialEntries={["/"]}>
          <Layout />
        </MemoryRouter>,
      );
    });
    const menu = contenitore.querySelector('[data-testid="menu"]');
    expect(simplebar.create).toHaveBeenCalledTimes(1);
    expect(simplebar.create).toHaveBeenCalledWith(menu);

    for (let i = 0; i < 10; i++) {
      clicca(i % 2 === 0 ? "Uno" : "Due");
    }

    expect(contenitore.textContent).toContain("/due");
    expect(simplebar.create).toHaveBeenCalledTimes(1);
    expect(simplebar.unMount).not.toHaveBeenCalled();
  });

  it("smonta la barra quando il componente sparisce", () => {
    act(() => {
      radice.render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>,
      );
    });
    const menu = contenitore.querySelector('[data-testid="menu"]');

    act(() => radice.render(<MemoryRouter />));

    expect(simplebar.unMount).toHaveBeenCalledTimes(1);
    expect(simplebar.unMount).toHaveBeenCalledWith(menu);
    expect(attive()).toBe(0);
  });

  it("in StrictMode resta una sola barra attiva", () => {
    act(() => {
      radice.render(
        <StrictMode>
          <MemoryRouter>
            <Layout />
          </MemoryRouter>
        </StrictMode>,
      );
    });

    clicca("Uno");

    expect(attive()).toBe(1);
  });
});
