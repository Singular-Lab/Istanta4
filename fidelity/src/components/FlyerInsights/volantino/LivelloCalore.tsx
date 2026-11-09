import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, useState } from "react";
import { coloraDensita, SCALA_CALORE_STANDARD, type DensitaPagina } from "../../../../lib/insightVolantino/calore";
import { FATTORE_DISEGNO } from "./mappaCalore";

/**
 * Disegna la densità di una pagina nel canvas: i pixel di coloraDensita in un ImageData piccolo
 * (una cella per pixel), poi ingranditi con imageSmoothing di alta qualità, così la mappa resta
 * morbida e non a quadretti. Falso se il browser non dà il contesto 2D (e allora non c'è calore).
 */
export function disegnaDensita(
  tela: HTMLCanvasElement,
  densita: DensitaPagina,
  tappe: readonly string[] = SCALA_CALORE_STANDARD
): boolean {
  const piccola = tela.ownerDocument.createElement("canvas");
  piccola.width = densita.colonne;
  piccola.height = densita.righe;
  const contestoPiccolo = piccola.getContext("2d");
  if (!contestoPiccolo) return false;
  const immagine = contestoPiccolo.createImageData(densita.colonne, densita.righe);
  immagine.data.set(coloraDensita(densita, tappe));
  contestoPiccolo.putImageData(immagine, 0, 0);

  // Ridimensionare il canvas azzera il suo stato: le impostazioni di sfumatura vengono dopo
  tela.width = densita.colonne * FATTORE_DISEGNO;
  tela.height = densita.righe * FATTORE_DISEGNO;
  const contesto = tela.getContext("2d");
  if (!contesto) return false;
  contesto.clearRect(0, 0, tela.width, tela.height);
  contesto.imageSmoothingEnabled = true;
  contesto.imageSmoothingQuality = "high";
  contesto.drawImage(piccola, 0, 0, tela.width, tela.height);
  return true;
}

export interface LivelloCaloreProps {
  numero: number;
  densita: DensitaPagina;
  /** Tappe della scala; a schermo SCALA_CALORE_STANDARD (la palette del cliente vale solo nel report PDF). */
  tappe?: readonly string[];
}

/**
 * Il calore di una pagina, sopra l'immagine e sotto i riquadri: copre la pagina rifilata come i
 * riquadri (che usano le stesse coordinate), quindi resta allineato anche con l'abbondanza.
 * Compare con una dissolvenza breve, niente movimento se l'utente lo ha chiesto.
 */
export function LivelloCalore({ numero, densita, tappe = SCALA_CALORE_STANDARD }: LivelloCaloreProps) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [disegnata, setDisegnata] = useState(false);

  useEffect(() => {
    const elemento = tela.current;
    if (!elemento) return;
    setDisegnata(disegnaDensita(elemento, densita, tappe));
  }, [densita, tappe]);

  return (
    <canvas
      ref={tela}
      aria-hidden="true"
      data-testid={`calore-${numero}`}
      data-disegnata={disegnata || undefined}
      className={twMerge(
        "pointer-events-none absolute inset-0 block h-full w-full motion-safe:transition-opacity motion-safe:duration-300",
        disegnata ? "opacity-100 dark:opacity-90" : "opacity-0"
      )}
    />
  );
}

export default LivelloCalore;
