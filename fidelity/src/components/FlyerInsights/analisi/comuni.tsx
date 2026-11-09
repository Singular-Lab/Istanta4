import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useId, type ReactNode } from "react";
import { PESI_VISIBILITA, type PesiVisibilita } from "../../../../lib/insightVolantino/tipi";

/*
 * Pezzi comuni alle schede di analisi del volantino (sintesi, prezzi e sconti, spazio, marche,
 * zone calde). Le schede stanno dentro la Sezione della pagina: niente Sezione annidata, solo
 * blocchi con un titolo h3.
 */

/**
 * Scarto, in punti percentuali, oltre il quale una quota "sopra l'altra" si mette in evidenza:
 * sotto i 2 punti la differenza fra spazio e referenze e' rumore di arrotondamento e di formato.
 */
export const SCARTO_RILEVANTE = 2;

/** Righe mostrate prima di "Mostra tutte" negli elenchi lunghi (marche, sottocosto). */
export const RIGHE_INIZIALI = 10;

const CHIAVI_PESI: ReadonlyArray<keyof PesiVisibilita> = ["copertina", "ultima", "primaDoppia", "altre", "alto", "basso"];

/** Vero se i pesi della visibilità sono quelli standard; falso se la libreria agenzia del cliente ne dichiara di propri. */
export const pesiStandard = (pesi: PesiVisibilita): boolean => CHIAVI_PESI.every(chiave => pesi[chiave] === PESI_VISIBILITA[chiave]);

/** Un blocco titolato dentro una scheda: titolo h3, descrizione breve e, se servono, azioni a destra. */
export function Blocco({
  titolo,
  descrizione,
  azioni,
  children,
  className,
}: {
  titolo: string;
  descrizione?: ReactNode;
  azioni?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const idTitolo = useId();
  return (
    <section aria-labelledby={idTitolo} className={twMerge("min-w-0 space-y-3", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={idTitolo} className="title-card dark:text-slate-200">
            {titolo}
          </h3>
          {descrizione && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{descrizione}</p>}
        </div>
        {azioni}
      </header>
      {children}
    </section>
  );
}

/** Una nota piccola sotto un grafico: dato parziale, stima, criterio. */
export function Nota({ children, icona = "Info", className }: { children: ReactNode; icona?: string; className?: string }) {
  return (
    <p className={twMerge("flex gap-2 text-xs text-slate-500 dark:text-slate-400", className)}>
      <Lucide icon={icona} aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Pulsante per allungare un elenco tagliato. Non compare se l'elenco sta tutto nelle righe iniziali.
 * aria-controls collega il pulsante all'elenco che cambia.
 */
export function MostraTutte({
  totale,
  aperto,
  onCambia,
  iniziali = RIGHE_INIZIALI,
  controlla,
}: {
  totale: number;
  aperto: boolean;
  onCambia: (aperto: boolean) => void;
  iniziali?: number;
  controlla?: string;
}) {
  if (totale <= iniziali) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline-secondary"
      aria-expanded={aperto}
      aria-controls={controlla}
      onClick={() => onCambia(!aperto)}
    >
      <Lucide icon={aperto ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
      {aperto ? `Mostra le prime ${formatNumero(iniziali)}` : `Mostra tutte (${formatNumero(totale)})`}
    </Button>
  );
}

/**
 * Barra di una quota in una riga di tabella o di elenco: traccia grigia e riempimento nella tinta
 * della serie. La larghezza e' relativa a `massimo`, cosi' piu' barre nella stessa tabella si confrontano.
 */
export function BarraQuota({
  valore,
  massimo,
  classe,
  className,
}: {
  valore: number;
  massimo: number;
  /** Classi bg-* del riempimento, con la variante dark:. */
  classe: string;
  className?: string;
}) {
  const percentuale = massimo > 0 ? Math.max(0, Math.min(100, (valore / massimo) * 100)) : 0;
  return (
    <div aria-hidden="true" className={twMerge("h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400", className)}>
      <div className={twMerge("h-full rounded-full", classe)} style={{ width: `${percentuale}%` }} />
    </div>
  );
}
