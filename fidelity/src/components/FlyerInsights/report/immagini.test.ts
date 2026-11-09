import { describe, expect, it, vi } from "vitest";
import type { SezioneReport } from "../../../../lib/insightVolantino/report";
import { urlPaginaMateriale } from "@/utils/materiali";
import { paginaNellImmagine } from "../volantino/geometria";
import { reportDiProva } from "./datiDiProva";
import {
  disegnaPagina,
  eseguiConLimite,
  LARGHEZZA_CALORE,
  LATO_MASSIMO,
  misuraRidotta,
  preparaImmagini,
  type AmbienteImmagini,
  type CanvasReport,
  type ContestoReport,
} from "./immagini";

interface CanvasFinto extends CanvasReport {
  ctx: ContestoReport & { drawImage: ReturnType<typeof vi.fn>; putImageData: ReturnType<typeof vi.fn> };
}

/** Canvas e immagini finti: le pagine rispondono con le misure date, o falliscono. */
function ambienteFinto(pagine: Record<number, { larghezza: number; altezza: number } | Error>) {
  const canvas: CanvasFinto[] = [];
  let inCorso = 0;
  let massimoInCorso = 0;
  const caricaImmagine = vi.fn(async (url: string) => {
    inCorso += 1;
    massimoInCorso = Math.max(massimoInCorso, inCorso);
    await new Promise((risolvi) => setTimeout(risolvi, 1));
    inCorso -= 1;
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
      createImageData: (larghezza: number, altezza: number) =>
        ({ data: new Uint8ClampedArray(larghezza * altezza * 4), width: larghezza, height: altezza }) as unknown as ImageData,
      putImageData: vi.fn(),
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
  return { ambiente, canvas, caricaImmagine, massimoInCorso: () => massimoInCorso };
}

const sezionePagine: SezioneReport = { tipo: "pagine", titolo: "Mappa dello sconto", misura: "sconto", introduzione: null, boxInEvidenza: 5 };
const sintesi: SezioneReport = { tipo: "sintesi", titolo: "Sintesi", indicatori: [], frasi: [] };

describe("misure e concorrenza", () => {
  it("riduce perche' il lato lungo non superi il massimo, senza mai ingrandire", () => {
    expect(misuraRidotta(2800, 3960)).toEqual({ larghezza: 990, altezza: LATO_MASSIMO });
    expect(misuraRidotta(600, 800)).toEqual({ larghezza: 600, altezza: 800 });
  });

  it("non supera il limite di compiti insieme e tiene l'ordine dei risultati", async () => {
    let inCorso = 0;
    let massimo = 0;
    const risultati = await eseguiConLimite([5, 1, 4, 2, 3], 2, async (valore) => {
      inCorso += 1;
      massimo = Math.max(massimo, inCorso);
      await new Promise((risolvi) => setTimeout(risolvi, valore));
      inCorso -= 1;
      return valore * 10;
    });
    expect(risultati).toEqual([50, 10, 40, 20, 30]);
    expect(massimo).toBe(2);
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

describe("preparazione delle immagini del report", () => {
  it("scarica da Olimpo le pagine del PDF; quelle che mancano restano bianche", async () => {
    const { ambiente, caricaImmagine, massimoInCorso } = ambienteFinto({
      1: { larghezza: 2800, altezza: 3960 },
      2: { larghezza: 800, altezza: 800 },
      3: new Error("Olimpo non risponde"),
    });
    const avanzamento = vi.fn();
    const report = reportDiProva({ sezioni: [sintesi, sezionePagine] });

    const immagini = await preparaImmagini(report, avanzamento, ambiente);

    expect(caricaImmagine.mock.calls.map(([url]) => url)).toEqual([1, 2, 3].map((pagina) => urlPaginaMateriale("o1", pagina)));
    expect(immagini.pagine.get(1)).toBe(`data:image/jpeg;base64,990x${LATO_MASSIMO}`);
    expect(immagini.pagine.get(2)).toBeNull();
    expect(immagini.pagine.get(3)).toBeNull();
    expect(massimoInCorso()).toBeLessThanOrEqual(3);
    expect(avanzamento).toHaveBeenNthCalledWith(1, { fatte: 0, totale: 3 });
    expect(avanzamento).toHaveBeenLastCalledWith({ fatte: 3, totale: 3 });
  });

  it("la mappa di calore e' un PNG per ogni pagina con valori, sotto l'indice della sua sezione", async () => {
    const { ambiente, canvas } = ambienteFinto({});
    const report = reportDiProva({ sezioni: [sintesi, sezionePagine] });

    const immagini = await preparaImmagini(report, undefined, ambiente);

    const calore = immagini.calore.get(1);
    // Pagina 3: il suo unico box non ha sconto
    expect([...(calore?.keys() ?? [])].sort()).toEqual([1, 2]);
    expect(calore?.get(1)).toMatch(/^data:image\/png;base64,/);
    expect(immagini.calore.has(0)).toBe(false);
    const grandi = canvas.filter((voce) => voce.width === LARGHEZZA_CALORE);
    expect(grandi).toHaveLength(2);
    expect(grandi[0].ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("senza sezioni di pagine scarica solo la copertina; senza PDF non scarica niente", async () => {
    const primo = ambienteFinto({ 1: { larghezza: 707, altezza: 1000 } });
    const soloCopertina = await preparaImmagini(reportDiProva({ sezioni: [sintesi] }), undefined, primo.ambiente);
    expect(primo.caricaImmagine).toHaveBeenCalledTimes(1);
    expect(soloCopertina.pagine.get(1)).toMatch(/^data:image\/jpeg;/);
    expect(soloCopertina.calore.size).toBe(0);

    const secondo = ambienteFinto({});
    const senzaPdf = await preparaImmagini(reportDiProva({ sezioni: [sezionePagine], pdf: null }), undefined, secondo.ambiente);
    expect(secondo.caricaImmagine).not.toHaveBeenCalled();
    expect(senzaPdf.pagine.size).toBe(0);
  });
});
