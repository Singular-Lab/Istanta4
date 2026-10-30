import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { StatoImportPuntiVenditaDTO } from "../../../server/core/dto";
import { percentualeImport } from "../../utils/importPuntiVendita";

interface AvanzamentoImportProps {
  stato: StatoImportPuntiVenditaDTO;
  annullamento: boolean;
  /** Apre la finestra dell'import, con il dettaglio e i comandi. */
  onDettagli: () => void;
  /** Riapre la riga in attesa, se l'utente l'aveva rimandata. */
  onApriRiga?: () => void;
}

/**
 * Fascia dell'import Excel che gira in background: la pagina resta usabile e l'avanzamento si
 * vede senza tenere aperta la finestra. In pausa dice che serve l'inserimento manuale.
 */
export function AvanzamentoImport({ stato, annullamento, onDettagli, onApriRiga }: AvanzamentoImportProps) {
  const inPausa = stato.stato === "in_attesa";
  const percentuale = percentualeImport(stato);
  const titolo = annullamento ? "Annullamento dell'import in corso" : inPausa ? "Import Excel in pausa" : "Import Excel in corso";

  return (
    <div
      role="status"
      aria-label={titolo}
      className={twMerge(
        "flex flex-col gap-3 rounded-card border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4",
        inPausa ? "border-warning/30 bg-warning/5" : "border-primary/20 bg-primary/5"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Lucide
          icon={inPausa ? "CirclePause" : "LoaderCircle"}
          aria-hidden="true"
          className={twMerge("h-4 w-4 flex-none", inPausa ? "text-warning" : "animate-spin text-primary")}
        />
        <strong className="text-sm text-slate-800 dark:text-slate-200">{titolo}</strong>
      </div>
      <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
        {formatNumero(stato.elaborate)} di {formatNumero(stato.totale)} righe · {formatNumero(stato.creati)} creati ·{" "}
        {formatNumero(stato.aggiornati)} aggiornati · {formatNumero(stato.scartati)} scartati
        {inPausa && stato.rigaInAttesa && ` · ferma sulla riga ${stato.rigaInAttesa.riga}: serve il tuo inserimento`}
      </span>
      <div
        className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-darkmode-400"
        role="progressbar"
        aria-label="Avanzamento dell'import"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentuale}
      >
        <div className={twMerge("h-full transition-all", inPausa ? "bg-warning" : "bg-primary")} style={{ width: `${percentuale}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {inPausa && onApriRiga && (
          <Button size="sm" variant="outline-warning" onClick={onApriRiga}>
            Apri la riga in attesa
          </Button>
        )}
        <Button size="sm" variant="outline-secondary" onClick={onDettagli}>
          Dettagli
        </Button>
      </div>
    </div>
  );
}

export default AvanzamentoImport;
