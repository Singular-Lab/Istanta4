import { twMerge } from "@/utils/twMerge";
import type { Tinta } from "./colori";
import { percorsoCroce, percorsoRombo, percorsoTriangolo } from "./scale";

/** Forma del segno in legenda: rimanda al segno del grafico (barre e aree quadrate, linee, marcatori). */
export type FormaSegno = "quadrato" | "linea" | "cerchio" | "rombo" | "triangolo" | "croce" | "anello";

export interface VoceLegenda {
  id: string;
  etichetta: string;
  forma: FormaSegno;
  /** Colore del segno; per anelli e marcatori vuoti è il bordo. */
  tinta?: Tinta;
  /** Classi stroke-* per linee, anelli e contorni (al posto della tinta). */
  classeTratto?: string;
}

/** Il segno di una voce, 12×12. */
export function SegnoLegenda({ forma, tinta, classeTratto }: Omit<VoceLegenda, "id" | "etichetta">) {
  const fill = tinta?.colore;
  const classeFill = tinta?.classe;
  const tratto = classeTratto ?? "stroke-slate-700 dark:stroke-slate-200";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="flex-none">
      {forma === "quadrato" &&
        (tinta ? (
          <rect x="1" y="1" width="10" height="10" rx="2" fill={fill} className={classeFill} />
        ) : (
          <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" strokeWidth="1.5" className={twMerge("fill-white dark:fill-darkmode-600", tratto)} />
        ))}
      {forma === "linea" && <line x1="0" x2="12" y1="6" y2="6" strokeWidth="2" strokeLinecap="round" stroke={fill} className={classeTratto} />}
      {forma === "cerchio" && <circle cx="6" cy="6" r="4.5" fill={fill} className={classeFill} />}
      {forma === "anello" && <circle cx="6" cy="6" r="4" strokeWidth="2" className={twMerge("fill-white dark:fill-darkmode-600", tratto)} />}
      {forma === "rombo" && <path d={percorsoRombo(6, 6, 4.5)} strokeWidth="1.5" fill={fill} className={twMerge(classeFill, !tinta && "fill-white dark:fill-darkmode-600", tratto)} />}
      {forma === "triangolo" && <path d={percorsoTriangolo(6, 6.5, 4.5)} strokeWidth="1.5" className={twMerge("fill-white dark:fill-darkmode-600", tratto)} />}
      {forma === "croce" && <path d={percorsoCroce(6, 6, 3.5)} strokeWidth="2" strokeLinecap="round" className={tratto} />}
    </svg>
  );
}

/**
 * Legenda dei grafici con due o più serie: identifica le serie con il segno accanto al nome,
 * il nome resta nel colore del testo.
 */
export function Legenda({ voci, titolo, className }: { voci: VoceLegenda[]; titolo?: string; className?: string }) {
  if (voci.length === 0) return null;
  return (
    <ul
      aria-label={titolo ?? "Legenda"}
      className={twMerge("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300", className)}
    >
      {titolo && (
        <li aria-hidden="true" className="text-slate-500 dark:text-slate-400">
          {titolo}
        </li>
      )}
      {voci.map(voce => (
        <li key={voce.id} className="inline-flex items-center gap-1.5">
          <SegnoLegenda forma={voce.forma} tinta={voce.tinta} classeTratto={voce.classeTratto} />
          {voce.etichetta}
        </li>
      ))}
    </ul>
  );
}

export default Legenda;
