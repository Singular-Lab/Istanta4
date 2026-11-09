import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import { formatDataOra } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useState } from "react";
import type { ImportVendite } from "../../../lib/vendite/tipi";
import { descriviAvanzamento, esitoImport, fraseEsito, percentualeImport } from "./formato";

interface AvanzamentoImportVenditeProps {
  importazione: ImportVendite;
  /** L'utente ha provato ad avviare un import mentre questo era gia' in corso (409). */
  giaInCorso?: boolean;
  onAnnulla: () => void;
  annullamentoInCorso?: boolean;
  erroreAnnullamento?: string | null;
  /** Toglie l'esito finale dalla pagina; il riepilogo resta. */
  onChiudi?: () => void;
}

const VARIANTE_ESITO = {
  success: "soft-success",
  warning: "soft-warning",
  danger: "soft-danger",
  info: "soft-info",
  neutral: "soft-secondary",
  brand: "soft-primary",
} as const;

/**
 * Avanzamento dell'import delle vendite, che gira in background: barra con le righe lette, scritte
 * e scartate; "Annulla import" chiede conferma qui, senza finestre del browser. Alla fine mostra
 * l'esito.
 */
export function AvanzamentoImportVendite({
  importazione,
  giaInCorso = false,
  onAnnulla,
  annullamentoInCorso = false,
  erroreAnnullamento = null,
  onChiudi,
}: AvanzamentoImportVenditeProps) {
  const inCorso = importazione.stato === "in_corso";
  const [conferma, setConferma] = useState(false);
  const percentuale = percentualeImport(importazione);
  const esito = esitoImport(importazione.stato);

  // Finito l'import, la conferma dell'annullamento non ha piu' senso
  useEffect(() => {
    if (!inCorso) setConferma(false);
  }, [inCorso]);

  return (
    <Sezione
      titolo={inCorso ? "Import in corso" : "Esito dell'import"}
      icona={inCorso ? "LoaderCircle" : esito.icona}
      descrizione={`${importazione.nomeFile} · avviato il ${formatDataOra(importazione.avviatoIl)}`}
      azioni={!inCorso && onChiudi ? (
        <Button size="sm" variant="outline-secondary" onClick={onChiudi}>
          Chiudi
        </Button>
      ) : undefined}
    >
      <div className="flex flex-col gap-4">
        {giaInCorso && inCorso && (
          <Alert variant="soft-info" icona="Info" className="px-3 py-2 text-sm">
            Un import delle vendite era già in corso per questa GDO: la pagina segue quello. Il tuo file resta
            nell&apos;anteprima e si potrà confermare quando l&apos;import sarà terminato.
          </Alert>
        )}

        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge tono={esito.tono} etichetta={esito.etichetta} icon={esito.icona} />
            <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{descriviAvanzamento(importazione)}</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-darkmode-400"
            role="progressbar"
            aria-label="Avanzamento dell'import delle vendite"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentuale}
          >
            <div
              className={twMerge(
                "h-full transition-all",
                inCorso ? "bg-primary" : esito.tono === "success" ? "bg-success" : esito.tono === "danger" ? "bg-danger" : "bg-warning"
              )}
              style={{ width: `${percentuale}%` }}
            />
          </div>
        </div>

        {inCorso ? (
          conferma ? (
            <div
              role="group"
              aria-label="Conferma annullamento"
              className="flex flex-col gap-3 rounded-control border border-danger/20 bg-danger/5 px-4 py-3 sm:flex-row sm:items-center"
            >
              <p className="text-sm text-slate-700 dark:text-slate-200 sm:mr-auto">
                Annullare l&apos;import? Le righe già scritte restano: per sostituirle reimporta il file dello stesso periodo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline-secondary" onClick={() => setConferma(false)} disabled={annullamentoInCorso}>
                  No, continua
                </Button>
                <Button size="sm" variant="danger" onClick={onAnnulla} loading={annullamentoInCorso}>
                  Sì, annulla l&apos;import
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button size="sm" variant="outline-danger" onClick={() => setConferma(true)}>
                <Lucide icon="Ban" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Annulla import
              </Button>
            </div>
          )
        ) : (
          <Alert variant={VARIANTE_ESITO[esito.tono]} icona={esito.icona} className="px-3 py-2 text-sm">
            {fraseEsito(importazione)}
          </Alert>
        )}

        {erroreAnnullamento && (
          <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-sm">
            Annullamento non riuscito: {erroreAnnullamento}
          </Alert>
        )}
      </div>
    </Sezione>
  );
}

export default AvanzamentoImportVendite;
