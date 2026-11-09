import { twMerge } from "@/utils/twMerge";
import { useState, type SyntheticEvent } from "react";
import type { GeometriaPagina } from "../../../../lib/insightVolantino/tipi";
import { paginaNellImmagine, stileImmagine, type PaginaNellImmagine } from "../volantino/geometria";
import { NOME_POSIZIONE_ATTUALE, stessaZona, ZONE_PAGINA, type Zona } from "./supporto";

export interface ZonaPaginaProps {
  pagina: number;
  /** Larghezza/altezza della pagina rifilata. */
  proporzione: number;
  /** Immagine della pagina da Olimpo; null: pagina bianca. */
  immagine: string | null;
  zona: Zona;
  onCambia: (zona: Zona) => void;
  /** Posizione attuale del prodotto, se sta in questa pagina: riquadro tratteggiato e pulsante per tornarci. */
  attuale: { centro: Zona; riquadro: GeometriaPagina } | null;
  /** Il box simulato, per vedere quanto spazio occupa e dove. */
  simulato: GeometriaPagina | null;
}

type EsitoImmagine = { url: string; pagina: PaginaNellImmagine | null };

const percento = (valore: number): string => `${Number((valore * 100).toFixed(3))}`;

/**
 * Scelta della zona sull'anteprima della pagina: una griglia 3×3 di pulsanti sopra l'immagine
 * (allineata alla pagina rifilata come nel visualizzatore), il riquadro tratteggiato della posizione
 * attuale e quello pieno del box simulato, grande quanto lo spazio indicato.
 */
export function ZonaPagina({ pagina, proporzione, immagine, zona, onCambia, attuale, simulato }: ZonaPaginaProps) {
  const [esito, setEsito] = useState<EsitoImmagine | null>(null);
  const allineamento = esito && esito.url === immagine ? esito.pagina : null;

  const caricata = (evento: SyntheticEvent<HTMLImageElement>) => {
    if (!immagine) return;
    const { naturalWidth, naturalHeight } = evento.currentTarget;
    setEsito({ url: immagine, pagina: paginaNellImmagine(naturalWidth, naturalHeight, proporzione) });
  };
  const nonCaricata = () => {
    if (immagine) setEsito({ url: immagine, pagina: null });
  };

  const sullaAttuale = attuale !== null && stessaZona(zona, attuale.centro);

  return (
    <div role="group" aria-label={`Zona della pagina ${pagina}`} className="flex flex-col items-start gap-2">
      <div
        className="relative w-full max-w-[15rem] overflow-hidden rounded-control border border-slate-200 bg-white shadow-card dark:border-darkmode-400 dark:bg-darkmode-700"
        style={{ aspectRatio: String(proporzione) }}
      >
        {immagine && (
          <img
            key={immagine}
            src={immagine}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={caricata}
            onError={nonCaricata}
            className={twMerge("pointer-events-none absolute max-w-none select-none", !allineamento && "invisible")}
            style={allineamento ? stileImmagine(allineamento) : { left: 0, top: 0, width: "100%", height: "100%" }}
          />
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full">
          {attuale && (
            <rect
              data-testid="riquadro-attuale"
              x={percento(attuale.riquadro.x)}
              y={percento(attuale.riquadro.y)}
              width={percento(attuale.riquadro.w)}
              height={percento(attuale.riquadro.h)}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              className="stroke-slate-700 dark:stroke-slate-200"
            />
          )}
          {simulato && (
            <rect
              data-testid="riquadro-simulato"
              x={percento(simulato.x)}
              y={percento(simulato.y)}
              width={percento(simulato.w)}
              height={percento(simulato.h)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              className="fill-primary/25 stroke-primary dark:fill-indigo-300/25 dark:stroke-indigo-300"
            />
          )}
        </svg>
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {ZONE_PAGINA.map(voce => {
            const scelta = !sullaAttuale && stessaZona(zona, voce);
            return (
              <button
                key={voce.id}
                type="button"
                aria-label={voce.nome}
                aria-pressed={scelta}
                title={voce.nome}
                onClick={() => onCambia({ x: voce.x, y: voce.y })}
                className={twMerge(
                  "border border-dashed border-slate-400/40 outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:border-slate-300/30",
                  scelta && "bg-primary/15 dark:bg-indigo-300/15"
                )}
              />
            );
          })}
        </div>
      </div>
      {attuale && (
        <button
          type="button"
          aria-pressed={sullaAttuale}
          onClick={() => onCambia(attuale.centro)}
          className={twMerge(
            "rounded-control border px-2.5 py-1 text-xs transition-colors",
            sullaAttuale
              ? "border-primary bg-primary/10 font-medium text-primary dark:border-indigo-300 dark:text-indigo-200"
              : "border-slate-200 text-slate-600 hover:border-primary hover:text-primary dark:border-darkmode-400 dark:text-slate-300"
          )}
        >
          {NOME_POSIZIONE_ATTUALE}
        </button>
      )}
    </div>
  );
}

export default ZonaPagina;
