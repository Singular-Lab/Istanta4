import Lucide from "@/components/Base/Lucide";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useState, type CSSProperties } from "react";
import type { VarianteConsultazione } from "../../../lib/consultazione/tipi";
import { fogliDelCollage, type FoglioCollage } from "./collage";

type VarianteCollage = "scheda" | "vetrina";

export interface CollageCopertineProps {
  /** Kit della promozione: il collage ne mostra al massimo `massimo`, alternando le insegne. */
  kit: readonly VarianteConsultazione[];
  /** Copertine al massimo: 5 nelle schede, 7 nella vetrina. */
  massimo: number;
  /**
   * scheda: la scrivania puntinata in testa alla card, con "+N" per i kit che non ci stanno;
   * vetrina: il ventaglio più grande sulla banda, senza fondo.
   */
  variante?: VarianteCollage;
  className?: string;
}

const FORMA: Readonly<Record<VarianteCollage, { contenitore: string; foglio: string; alzata: number }>> = {
  scheda: {
    contenitore:
      "aspect-[16/10] overflow-hidden bg-slate-100 bg-[radial-gradient(rgb(var(--color-theme-1)/0.07)_1px,transparent_1px)] bg-[length:14px_14px] dark:bg-darkmode-700 dark:bg-[radial-gradient(rgb(170_182_255/0.08)_1px,transparent_1px)]",
    foglio: "top-[10%] h-[80%]",
    alzata: 4,
  },
  vetrina: {
    // Su schermi larghi l'altezza si ferma: la vetrina non deve spingere le schede sotto la piega
    contenitore: "aspect-[16/11] max-h-[22rem] w-full",
    foglio: "top-[12%] h-[72%]",
    alzata: 6,
  },
};

/**
 * Posizione del foglio. --apertura (0 o 1) la imposta il contenitore al passaggio del mouse o col
 * focus, solo senza prefers-reduced-motion: il ventaglio si allarga, i fogli si alzano e ruotano un
 * po' di più. Una variabile sola basta per tutti i fogli, ognuno con i suoi spostamenti.
 */
const stileFoglio = (foglio: FoglioCollage<unknown>, alzata: number): CSSProperties => ({
  left: `${foglio.x}%`,
  zIndex: foglio.livello,
  transform: [
    `translateX(calc(-50% + ${foglio.apertura}px * var(--apertura, 0)))`,
    `translateY(calc(${foglio.y}% - ${alzata}px * var(--apertura, 0)))`,
    `rotate(calc(${foglio.rotazione}deg * (1 + 0.35 * var(--apertura, 0))))`,
  ].join(" "),
});

/** Copertina mancante: un foglio con testata, icona e canale · area, al posto di un buco. */
function Segnaposto({ etichetta, grande }: { etichetta: string; grande: boolean }) {
  return (
    <span className="flex h-full w-full flex-col bg-gradient-to-b from-white to-slate-100 dark:from-slate-100 dark:to-slate-300">
      <span className="h-[12%] flex-none bg-theme-1/85" />
      <span className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-1.5 text-center">
        <Lucide icon="Newspaper" aria-hidden="true" className={twMerge("text-theme-1/50", grande ? "h-8 w-8" : "h-5 w-5")} />
        <span
          className={twMerge(
            "font-semibold leading-tight text-slate-500 [overflow-wrap:anywhere]",
            grande ? "text-2xs" : "text-3xs"
          )}
        >
          {etichetta}
        </span>
      </span>
      {/* Due righe di "testo" stampato: il foglio si legge come un volantino, non come un errore */}
      <span className="flex flex-none flex-col gap-1 px-[14%] pb-[12%]">
        <span className="h-1 rounded-full bg-slate-200 dark:bg-slate-400/60" />
        <span className="h-1 w-2/3 rounded-full bg-slate-200 dark:bg-slate-400/60" />
      </span>
    </span>
  );
}

function Foglio({
  foglio,
  variante,
}: {
  foglio: FoglioCollage<VarianteConsultazione | null>;
  variante: VarianteCollage;
}) {
  // Una miniatura che non arriva (Olimpo non risponde) diventa il segnaposto, non un'icona rotta
  const [rotta, setRotta] = useState(false);
  const forma = FORMA[variante];
  const anteprima = foglio.kit?.copertina?.anteprima;
  const etichetta = foglio.kit ? `${foglio.kit.canale.nome} · ${foglio.kit.area.nome}` : "";

  return (
    <span
      className={twMerge(
        "absolute aspect-[5/7] overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgb(10_14_40/0.22),0_14px_26px_-12px_rgb(10_14_40/0.45)] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        forma.foglio
      )}
      style={stileFoglio(foglio, forma.alzata)}
    >
      {anteprima && !rotta ? (
        // Decorative: il nome della promozione sta nell'etichetta del collegamento che le contiene
        <img
          src={anteprima}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setRotta(true)}
          className="block h-full w-full object-cover object-top"
        />
      ) : (
        <Segnaposto etichetta={etichetta} grande={variante === "vetrina"} />
      )}
    </span>
  );
}

/**
 * Collage delle copertine dei primi kit di una promozione, sovrapposte come fogli stampati:
 * un'insegna alla volta (ordinaPerCollage), al massimo `massimo`. È decorativo (aria-hidden): chi
 * lo usa dice a parole quanti volantini ha la promozione. Il ventaglio si apre al passaggio sul
 * contenitore `group/promo` (la scheda o la vetrina), solo con motion-safe: un `group` senza nome
 * c'è anche nel layout, che lo terrebbe sempre aperto.
 */
function CollageCopertine({ kit, massimo, variante = "scheda", className }: CollageCopertineProps) {
  const { fogli, altri } = fogliDelCollage(kit, massimo);
  const forma = FORMA[variante];
  // Una promo arriva sempre con almeno un kit; se mancassero, un foglio bianco tiene la forma
  const daDisegnare: FoglioCollage<VarianteConsultazione | null>[] = fogli.length
    ? fogli
    : [{ kit: null, x: 50, y: 0, rotazione: -2, livello: 10, apertura: 0 }];

  return (
    <div
      aria-hidden="true"
      className={twMerge(
        "relative isolate motion-safe:group-hover/promo:[--apertura:1] motion-safe:group-focus-within/promo:[--apertura:1]",
        forma.contenitore,
        className
      )}
    >
      {daDisegnare.map((foglio, indice) => (
        <Foglio key={foglio.kit?.id ?? indice} foglio={foglio} variante={variante} />
      ))}
      {variante === "scheda" && altri > 0 && (
        <span className="absolute bottom-2.5 right-2.5 z-20 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-800 shadow-card dark:bg-darkmode-600 dark:text-slate-100">
          +{formatNumero(altri)}
        </span>
      )}
    </div>
  );
}

export default CollageCopertine;
