// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le pagine del volantino disegnate dal PDF (spec insight-volantino, "Pagine vere del volantino con
// le referenze"): il PDF si legge a pezzi, si apre una volta e si chiude, la pagina si disegna alla
// grandezza in cui si vede, con un tetto ai pixel.

const finti = vi.hoisted(() => ({
  getDocument: vi.fn(),
  opzioniWorker: { workerSrc: "" },
}));

vi.mock("pdfjs-dist", () => ({ getDocument: finti.getDocument, GlobalWorkerOptions: finti.opzioniWorker }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/assets/pdf.worker.min.mjs" }));

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  browserSupportaPdfjs,
  DENSITA_MASSIMA,
  PEZZO_PDF,
  PIXEL_MASSIMI_PAGINA,
  scalaDisegno,
  TEMPO_MASSIMO_APERTURA_MS,
  useDisegnoPdf,
  useDocumentoPdf,
} from "./pdfVolantino";

/** Un'apertura di pdf.js che si risolve (o fallisce) quando lo decide il test. */
function apertura() {
  let risolvi!: (documento: unknown) => void;
  let rifiuta!: (errore: unknown) => void;
  const promise = new Promise((ok, ko) => {
    risolvi = ok;
    rifiuta = ko;
  });
  return { promise, destroy: vi.fn(), risolvi, rifiuta };
}

describe("scalaDisegno", () => {
  it("tanti pixel quanti ne servono alla larghezza mostrata, per la densità dello schermo", () => {
    // Una pagina larga 600 punti mostrata larga 300 px CSS: a densità 2 servono 600 pixel
    expect(scalaDisegno(600, 800, 300, 2)).toBe(1);
    expect(scalaDisegno(600, 800, 300, 1)).toBe(0.5);
  });

  it("la densità conta al più fino a DENSITA_MASSIMA e non sotto 1", () => {
    expect(scalaDisegno(600, 800, 300, 3)).toBe(scalaDisegno(600, 800, 300, DENSITA_MASSIMA));
    expect(scalaDisegno(600, 800, 300, 0.5)).toBe(scalaDisegno(600, 800, 300, 1));
  });

  it("molto ingrandita, la pagina non supera PIXEL_MASSIMI_PAGINA", () => {
    const scala = scalaDisegno(600, 800, 20_000, 2);
    expect(600 * scala * 800 * scala).toBeCloseTo(PIXEL_MASSIMI_PAGINA, -2);
  });

  it("misure che non valgono danno 0: niente disegno", () => {
    expect(scalaDisegno(0, 800, 300, 1)).toBe(0);
    expect(scalaDisegno(600, 800, 0, 1)).toBe(0);
    expect(scalaDisegno(Number.NaN, 800, 300, 1)).toBe(0);
  });
});

describe("useDocumentoPdf", () => {
  beforeEach(() => {
    finti.getDocument.mockReset();
    // jsdom non ha i worker: un browser che li ha
    vi.stubGlobal("Worker", class {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("un browser senza worker non scarica pdf.js: le pagine saranno le immagini di Olimpo", async () => {
    vi.stubGlobal("Worker", undefined);
    expect(browserSupportaPdfjs()).toBe(false);

    const { result } = renderHook(() => useDocumentoPdf("/olimpo/materiali/getMaterialePDF?id=o1"));

    await waitFor(() => expect(result.current).toEqual({ stato: "nonSupportato" }));
    expect(finti.getDocument).not.toHaveBeenCalled();
  });

  it("un browser senza le funzioni recenti che pdf.js usa non è supportato", () => {
    // Il tipo di Promise del progetto non conosce ancora withResolvers (lib es2024)
    const promessa = Promise as unknown as { withResolvers?: unknown };
    const originale = promessa.withResolvers;
    delete promessa.withResolvers;
    try {
      expect(browserSupportaPdfjs()).toBe(false);
    } finally {
      promessa.withResolvers = originale;
    }
    expect(browserSupportaPdfjs()).toBe(true);
  });

  it("un PDF che non si apre entro il tempo massimo lascia il posto alle immagini, e si chiude", async () => {
    vi.useFakeTimers();
    const lettura = apertura();
    finti.getDocument.mockReturnValue(lettura);

    const { result } = renderHook(() => useDocumentoPdf("/olimpo/materiali/getMaterialePDF?id=lento"));
    await vi.waitFor(() => expect(finti.getDocument).toHaveBeenCalled());
    expect(result.current).toEqual({ stato: "caricamento" });

    await vi.advanceTimersByTimeAsync(TEMPO_MASSIMO_APERTURA_MS);

    expect(result.current).toEqual({ stato: "errore" });
    expect(lettura.destroy).toHaveBeenCalled();
  });

  it("Riprova riapre il PDF da capo", async () => {
    finti.getDocument.mockImplementation(() => apertura());

    const { rerender } = renderHook(({ tentativo }) => useDocumentoPdf("/olimpo/materiali/getMaterialePDF?id=o1", tentativo), {
      initialProps: { tentativo: 0 },
    });
    await waitFor(() => expect(finti.getDocument).toHaveBeenCalledTimes(1));
    rerender({ tentativo: 1 });

    await waitFor(() => expect(finti.getDocument).toHaveBeenCalledTimes(2));
  });

  it("senza indirizzo non apre nulla", () => {
    const { result } = renderHook(() => useDocumentoPdf(null));

    expect(result.current).toEqual({ stato: "assente" });
    expect(finti.getDocument).not.toHaveBeenCalled();
  });

  it("apre il PDF a pezzi, senza scaricarlo tutto, con il worker di pdf.js", async () => {
    const lettura = apertura();
    finti.getDocument.mockReturnValue(lettura);
    const documento = { numPages: 24 };

    const { result } = renderHook(() => useDocumentoPdf("/olimpo/materiali/getMaterialePDF?id=o1"));
    expect(result.current).toEqual({ stato: "caricamento" });

    await waitFor(() => expect(finti.getDocument).toHaveBeenCalledTimes(1));
    expect(finti.getDocument).toHaveBeenCalledWith({
      url: "/olimpo/materiali/getMaterialePDF?id=o1",
      disableAutoFetch: true,
      disableStream: true,
      rangeChunkSize: PEZZO_PDF,
    });
    expect(finti.opzioniWorker.workerSrc).toBe("/assets/pdf.worker.min.mjs");

    lettura.risolvi(documento);
    await waitFor(() => expect(result.current).toEqual({ stato: "pronto", documento }));
  });

  it("lasciando la pagina chiude il PDF", async () => {
    const lettura = apertura();
    finti.getDocument.mockReturnValue(lettura);

    const { unmount } = renderHook(() => useDocumentoPdf("/olimpo/materiali/getMaterialePDF?id=o1"));
    await waitFor(() => expect(finti.getDocument).toHaveBeenCalled());
    unmount();

    expect(lettura.destroy).toHaveBeenCalledTimes(1);
  });

  it("un PDF che non si legge dà errore, perché si possa ripiegare sulle immagini", async () => {
    const lettura = apertura();
    finti.getDocument.mockReturnValue(lettura);

    const { result } = renderHook(() => useDocumentoPdf("/olimpo/materiali/getMaterialePDF?id=rotto"));
    await waitFor(() => expect(finti.getDocument).toHaveBeenCalled());
    lettura.rifiuta(new Error("Invalid PDF structure"));

    await waitFor(() => expect(result.current).toEqual({ stato: "errore" }));
  });
});

describe("useDisegnoPdf", () => {
  const disegnaImmagine = vi.fn();
  let render: ReturnType<typeof vi.fn>;
  let annulla: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    disegnaImmagine.mockReset();
    annulla = vi.fn();
    render = vi.fn(() => ({ promise: Promise.resolve(), cancel: annulla }));
    // jsdom non disegna: basta un contesto che accetti la copia dal canvas fuori schermo
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ drawImage: disegnaImmagine }) as unknown as CanvasRenderingContext2D
    );
  });
  afterEach(() => vi.restoreAllMocks());

  /** Un documento con pagine da 600×800 punti (abbondanza compresa). */
  const documento = (getPage = vi.fn(async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render }))) =>
    ({ fingerprints: ["impronta"], getPage }) as unknown as PDFDocumentProxy;

  it("disegna la pagina alla larghezza in cui si vede e la copia nel canvas visibile", async () => {
    const canvas = { current: document.createElement("canvas") };
    const doc = documento();

    const { result } = renderHook(() => useDisegnoPdf(doc, 3, canvas, 300));

    await waitFor(() => expect(result.current).toEqual({ stato: "pronta", misure: { larghezza: 600, altezza: 800 } }));
    expect(doc.getPage).toHaveBeenCalledWith(3);
    // 300 px arrotondati al passo di 64 (320), a densità 1: 320 pixel di larghezza
    expect(canvas.current.width).toBe(320);
    expect(canvas.current.height).toBe(Math.ceil(800 * (320 / 600)));
    expect(disegnaImmagine).toHaveBeenCalledTimes(1);
  });

  it("senza documento o senza larghezza non disegna", () => {
    const canvas = { current: document.createElement("canvas") };

    const senzaDocumento = renderHook(() => useDisegnoPdf(null, 1, canvas, 300));
    const senzaLarghezza = renderHook(() => useDisegnoPdf(documento(), 1, canvas, 0));

    expect(senzaDocumento.result.current).toEqual({ stato: "caricamento" });
    expect(senzaLarghezza.result.current).toEqual({ stato: "caricamento" });
    expect(render).not.toHaveBeenCalled();
  });

  it("una pagina che non si disegna dà errore", async () => {
    const canvas = { current: document.createElement("canvas") };
    const doc = documento(vi.fn(async () => {
      throw new Error("pagina rovinata");
    }));

    const { result } = renderHook(() => useDisegnoPdf(doc, 2, canvas, 300));

    await waitFor(() => expect(result.current).toEqual({ stato: "errore" }));
  });

  it("un disegno superato da un'altra grandezza si annulla", async () => {
    let finito!: () => void;
    render.mockImplementation(() => ({ promise: new Promise<void>(ok => (finito = ok)), cancel: annulla }));
    const canvas = { current: document.createElement("canvas") };
    const doc = documento();

    const { rerender } = renderHook(({ larghezza }) => useDisegnoPdf(doc, 1, canvas, larghezza), { initialProps: { larghezza: 300 } });
    await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    rerender({ larghezza: 900 });

    expect(annulla).toHaveBeenCalledTimes(1);
    finito();
  });
});
