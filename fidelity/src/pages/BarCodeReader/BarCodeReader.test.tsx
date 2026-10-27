// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/query/query", () => ({ useFetchConfig: () => ({ data: undefined }) }));
vi.mock("barcode-detector/ponyfill", () => ({ BarcodeDetector: vi.fn() }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn() } }));
vi.mock("../WebPliant/BoxRef", () => ({ default: () => null }));

import BarCodeReader from ".";

// Classi Bootstrap che la pagina usava: Fidelity non carica Bootstrap, quindi non avevano effetto
const CLASSI_BOOTSTRAP = [
  "shop-main",
  "d-flex",
  "flex-column",
  "align-items-center",
  "justify-content-center",
  "col-12",
  "card",
  "card-body",
  "bg-dark",
  "btn",
  "btn-primary",
  "w-100",
  "h-100",
  "position-relative",
  "position-absolute",
  "start-0",
  "pt-xl-5",
];

describe("BarCodeReader", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("Permesso negato")) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("senza permesso per la fotocamera lo dice, con il titolo della pagina", async () => {
    render(<BarCodeReader />);

    expect(screen.getByRole("heading", { level: 1, name: "Lettore codici a barre" })).toHaveClass("title-page");
    expect(await screen.findByText("Accesso alla fotocamera negato.")).toBeInTheDocument();
  });

  it("non usa classi Bootstrap", async () => {
    const { container } = render(<BarCodeReader />);
    await screen.findByText("Accesso alla fotocamera negato.");

    const selettore = CLASSI_BOOTSTRAP.map((classe) => `.${classe}`).join(", ");
    expect(container.querySelector(selettore)).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });
});
