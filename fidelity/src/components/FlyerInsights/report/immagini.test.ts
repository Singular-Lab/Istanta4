import { describe, expect, it, vi } from "vitest";
import type { SezioneReport } from "../../../../lib/insightVolantino/report";
import { urlPaginaMateriale } from "@/utils/materiali";
import { paginaNellImmagine } from "../volantino/geometria";
import { reportDiProva } from "./datiDiProva";
import {
  disegnaPagina,
  LATO_MASSIMO,
  misuraRidotta,
  preparaImmagini,
  type AmbienteImmagini,
  type CanvasReport,
  type ContestoReport,
} from "./immagini";

interface CanvasFinto extends CanvasReport {
  ctx: ContestoReport & { drawImage: ReturnType<typeof vi.fn> };
}

/** Canvas e immagini finti: le pagine rispondono con le misure date, o falliscono. */
function ambienteFinto(pagine: Record<number, { larghezza: number; altezza: number } | Error>) {
  const canvas: CanvasFinto[] = [];
  const caricaImmagine = vi.fn(async (url: string) => {
    await new Promise((risolvi) => setTimeout(risolvi, 1));
    const pagina = Number(new URL(url, "http://fidelity.test").searchParams.get("page"));
    const esito = pagine[pagina];
    if (!esito) throw new Error("404");
    if (esito instanceof Error) throw esito;
    return { ...esito, sorgente: { pagina } as unknown as CanvasImageSource };
  });
  const creaCanvas = (): CanvasReport => {
    const ctx = {
      fillStyle: "",
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low" as ImageSmoothingQuality,
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const nuovo: CanvasFinto = {
      width: 0,
      height: 0,
      ctx,
      getContext: () => ctx,
      toDataURL: (tipo: string) => `data:${tipo};base64,${nuovo.width}x${nuovo.height}`,
    };
    canvas.push(nuovo);
    return nuovo;
  };
  const ambiente: AmbienteImmagini = { caricaImmagine, creaCanvas };
  return { ambiente, canvas, caricaImmagine };
}

const sintesi: SezioneReport = { tipo: "sintesi", titolo: "Sintesi", indicatori: [], frasi: [] };

describe("misure", () => {
  it("riduce perche' il lato lungo non superi il massimo, senza mai ingrandire", () => {
    expect(misuraRidotta(2800, 3960)).toEqual({ larghezza: 990, altezza: LATO_MASSIMO });
    expect(misuraRidotta(600, 800)).toEqual({ larghezza: 600, altezza: 800 });
  });
});

describe("immagine di una pagina", () => {
  it("rifila l'abbondanza e ridisegna la pagina come JPEG", () => {
    const { ambiente, canvas } = ambienteFinto({});
    const immagine = { larghezza: 1060, altezza: 1474, sorgente: {} as CanvasImageSource };
    const risultato = disegnaPagina(immagine, 0.707, ambiente);
    const pagina = paginaNellImmagine(1060, 1474, 0.707)!;

    expect(risultato).toMatch(/^data:image\/jpeg;base64,/);
    const [, sx, sy, sw, sh] = canvas[0].ctx.drawImage.mock.calls[0];
    expect(sx).toBeCloseTo(pagina.x * 1060);
    expect(sy).toBeCloseTo(pagina.y * 1474);
    expect(sw).toBeCloseTo(pagina.w * 1060);
    expect(sh).toBeCloseTo(pagina.h * 1474);
    expect(sx).toBeGreaterThan(0);
  });

  it("il segnaposto quadrato di Olimpo non e' la pagina: pagina bianca", () => {
    const { ambiente, canvas } = ambienteFinto({});
    expect(disegnaPagina({ larghezza: 800, altezza: 800, sorgente: {} as CanvasImageSource }, 0.707, ambiente)).toBeNull();
    expect(canvas).toHaveLength(0);
  });
});

describe("preparazione della miniatura della copertina", () => {
  it("scarica da Olimpo solo la prima pagina del PDF e la rifila come JPEG", async () => {
    const { ambiente, caricaImmagine } = ambienteFinto({
      1: { larghezza: 2800, altezza: 3960 },
      2: { larghezza: 2800, altezza: 3960 },
      3: { larghezza: 2800, altezza: 3960 },
    });
    const report = reportDiProva({ sezioni: [sintesi] });

    const immagini = await preparaImmagini(report, ambiente);

    // Le altre pagine del volantino non entrano nel report: non si scaricano
    expect(caricaImmagine.mock.calls.map(([url]) => url)).toEqual([urlPaginaMateriale("o1", 1)]);
    expect(immagini).toEqual({ copertina: `data:image/jpeg;base64,990x${LATO_MASSIMO}` });
  });

  it("se la prima pagina non arriva, o e' il segnaposto di Olimpo, la copertina resta con la pagina bianca", async () => {
    const nonArriva = ambienteFinto({ 1: new Error("Olimpo non risponde") });
    expect(await preparaImmagini(reportDiProva(), nonArriva.ambiente)).toEqual({ copertina: null });
    expect(nonArriva.caricaImmagine).toHaveBeenCalledTimes(1);

    const segnaposto = ambienteFinto({ 1: { larghezza: 800, altezza: 800 } });
    expect(await preparaImmagini(reportDiProva(), segnaposto.ambiente)).toEqual({ copertina: null });
  });

  it("se il browser non da' il contesto del canvas la copertina resta con la pagina bianca, senza errori", async () => {
    const { ambiente } = ambienteFinto({ 1: { larghezza: 707, altezza: 1000 } });
    const senzaContesto: AmbienteImmagini = {
      ...ambiente,
      creaCanvas: () => ({ ...ambiente.creaCanvas(), getContext: () => null }),
    };
    expect(await preparaImmagini(reportDiProva(), senzaContesto)).toEqual({ copertina: null });
  });

  it("senza PDF non scarica niente", async () => {
    const { ambiente, caricaImmagine } = ambienteFinto({});
    const senzaPdf = await preparaImmagini(reportDiProva({ pdf: null }), ambiente);
    expect(caricaImmagine).not.toHaveBeenCalled();
    expect(senzaPdf).toEqual({ copertina: null });
  });
});
