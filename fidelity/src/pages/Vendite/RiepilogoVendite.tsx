import PageError from "@/components/Base/PageError";
import Sezione from "@/components/Base/Sezione";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import { formatDataOra, formatNumero } from "@/utils/format";
import type { UseQueryResult } from "@tanstack/react-query";
import type { RiepilogoVendite as DatiRiepilogo } from "../../../lib/vendite/tipi";
import { conteggio, esitoImport, formatPeriodo } from "./formato";

interface RiepilogoVenditeProps {
  query: Pick<UseQueryResult<DatiRiepilogo>, "data" | "isLoading" | "isError" | "error" | "refetch">;
}

/**
 * Cosa c'è oggi nelle vendite della GDO: righe, prodotti, punti vendita, periodo coperto e
 * l'ultimo import con il suo esito.
 */
export function RiepilogoVendite({ query }: RiepilogoVenditeProps) {
  if (query.isError) {
    return (
      <PageError
        compatta
        titolo="Riepilogo delle vendite non caricato"
        motivo={(query.error as Error | null)?.message || "Errore del server"}
        onRiprova={() => query.refetch()}
      />
    );
  }

  const dati = query.data;
  const caricamento = query.isLoading;
  const ultimo = dati?.ultimoImport ?? null;
  const esito = ultimo ? esitoImport(ultimo.stato) : null;

  return (
    <Sezione titolo="Riepilogo" icona="ChartColumn" aria-label="Riepilogo delle vendite">
      <StatCardGrid>
        <StatCard etichetta="Righe di vendita" icona="Table" valore={dati ? formatNumero(dati.righe) : null} loading={caricamento} />
        <StatCard etichetta="Prodotti" icona="Package" valore={dati ? formatNumero(dati.prodotti) : null} loading={caricamento} />
        <StatCard etichetta="Punti vendita" icona="Store" valore={dati ? formatNumero(dati.puntiVendita) : null} loading={caricamento} />
        <StatCard
          etichetta="Periodo coperto"
          icona="CalendarRange"
          valore={dati ? formatPeriodo(dati.dal, dati.al) : null}
          loading={caricamento}
        />
      </StatCardGrid>

      {!caricamento && dati && (
        <div className="mt-4 flex flex-col gap-1 border-t border-dashed border-slate-200 pt-4 text-sm dark:border-darkmode-400">
          <span className="title-eyebrow">Ultimo import</span>
          {ultimo && esito ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge tono={esito.tono} etichetta={esito.etichetta} icon={esito.icona} />
              <span className="font-medium text-slate-700 dark:text-slate-200" title={ultimo.nomeFile}>
                {ultimo.nomeFile}
              </span>
              <span className="text-slate-500">
                {ultimo.terminatoIl ? `terminato il ${formatDataOra(ultimo.terminatoIl)}` : `avviato il ${formatDataOra(ultimo.avviatoIl)}`}
              </span>
              <span className="tabular-nums text-slate-600 dark:text-slate-300">
                {conteggio(ultimo.scritte, "riga scritta", "righe scritte")} · {conteggio(ultimo.scartate, "scartata", "scartate")}
              </span>
              {ultimo.stato === "fallito" && ultimo.errore && (
                <span className="basis-full text-xs text-danger">{ultimo.errore}</span>
              )}
            </div>
          ) : (
            <span className="text-slate-500">Nessun import: le vendite della GDO non sono ancora state caricate.</span>
          )}
        </div>
      )}
    </Sezione>
  );
}

export default RiepilogoVendite;
