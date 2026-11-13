import Lucide from "@/components/Base/Lucide";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import type { KitPromozioneConsultazione } from "../../../lib/consultazione/tipi";
import { nomeKit } from "./analisi";

export interface CopertinaProps {
  kit: Pick<KitPromozioneConsultazione, "canale" | "area" | "copertina">;
  /** Misure e bordi: la copertina riempie il suo riquadro. */
  className?: string;
  /** Nel segnaposto anche canale e area; nelle miniature piccole basta il foglio con l'icona. */
  conNome?: boolean;
  /** Segnaposto come un foglio bianco anche nel tema scuro (sul muro della banda, fra le copertine vere). */
  carta?: boolean;
}

/** Vero se il kit ha la miniatura della copertina (il PDF del volantino servito da Olimpo). */
export const conMiniatura = (kit: Pick<KitPromozioneConsultazione, "copertina">): boolean => Boolean(kit.copertina?.anteprima);

/**
 * La copertina del volantino dalla sua miniatura; finché non arriva un fondo che pulsa, così non resta
 * un riquadro bianco; senza miniatura, o se non si carica, un foglio segnaposto con canale e area. È
 * decorativa: il nome del kit lo dice il collegamento che la contiene.
 */
export function Copertina({ kit, className, conNome = true, carta = false }: CopertinaProps) {
  const [rotta, setRotta] = useState(false);
  const [caricata, setCaricata] = useState(false);
  const anteprima = kit.copertina?.anteprima;

  if (!anteprima || rotta) {
    return (
      <span
        aria-hidden="true"
        className={twMerge(
          "flex flex-col items-center justify-center gap-1 overflow-hidden p-1 text-center text-slate-400",
          carta ? "bg-white" : "bg-slate-50 dark:bg-darkmode-500",
          className
        )}
      >
        <Lucide icon="Newspaper" className="h-5 w-5 max-h-[40%] max-w-[60%] flex-none" />
        {conNome && (
          <span
            className={twMerge(
              "text-3xs font-semibold leading-tight text-slate-600 [overflow-wrap:anywhere]",
              !carta && "dark:text-slate-300"
            )}
          >
            {nomeKit(kit)}
          </span>
        )}
      </span>
    );
  }

  return (
    <img
      src={anteprima}
      alt=""
      loading="lazy"
      onLoad={() => setCaricata(true)}
      onError={() => setRotta(true)}
      data-caricata={caricata || undefined}
      className={twMerge("block object-cover", caricata ? "bg-white" : "bg-slate-200 motion-safe:animate-pulse dark:bg-darkmode-400", className)}
    />
  );
}

export default Copertina;
