import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useFetchFlyerInsightsConfig } from "@/query/query";
import { FlyerInsights as FlyerInsightsType } from "@/types/flyerInsights";
import clsx from "clsx";
import { FC } from "react";
import { PrezziSconti, RepartiVolantino } from "./analisi";
import { sezioneAttiva } from "./configurazione";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";

interface FlyerInsightsProps {
  insights: FlyerInsightsType | null;
  isLoading?: boolean;
  className?: string;
  exportCodes?: string[];
}

const TITOLO_VUOTO = "Analisi del volantino";

/** Quando il server non ha mandato l'analisi (risposta di un server non ancora aggiornato). */
function NonDisponibile() {
  return (
    <EmptyState
      compatta
      icon="ChartColumn"
      title="Analisi non disponibile"
      description="Per questo volantino il server non ha restituito questa analisi."
    />
  );
}

/**
 * Le analisi del volantino come sezioni della pagina, senza schede: Reparti (spazio e referenze, senza
 * sconto medio) e Meccaniche (i box in sottocosto, senza fasce di sconto né sconto medio per meccanica),
 * affiancate sugli schermi larghi. La config della GDO puo' spegnere reparti e meccaniche (enabled:
 * false). Niente sezione delle marche con piu' spazio (spec insight-volantino, "Prezzi, sconti,
 * spazio e marche del volantino"): il numero delle marche e la quota del distributore stanno negli
 * indicatori in alto. Sintesi, distribuzione nelle pagine, volantino sfogliabile e marchi del
 * distributore li mette la pagina, fuori da qui.
 */
const FlyerInsights: FC<FlyerInsightsProps> = ({ insights, isLoading = false, className, exportCodes }) => {
  const { data: insightsConfig } = useFetchFlyerInsightsConfig();

  if (isLoading) {
    return (
      <Sezione titolo={TITOLO_VUOTO} className={className}>
        <div aria-busy="true" className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-80" />
        </div>
      </Sezione>
    );
  }

  if (exportCodes !== undefined && !exportCodes.includes(EXPORT_DI_SISTEMA.VOL)) {
    return (
      <Sezione titolo={TITOLO_VUOTO} className={className}>
        <EmptyState
          compatta
          icon="FileSearch"
          title="Per questo kit non è presente il tipo di esportazione VOL"
          description="Le statistiche sono disponibili per i kit con esportazione VOL."
          className="border border-dashed border-slate-200"
        />
      </Sezione>
    );
  }

  if (!insights || insights.totaleReferenze === 0) {
    return (
      <Sezione titolo={TITOLO_VUOTO} className={className}>
        <EmptyState
          compatta
          icon="FileSearch"
          title="Nessuna referenza trovata"
          description="Le statistiche saranno disponibili quando le referenze avranno dati di posizione."
          className="border border-dashed border-slate-200"
        />
      </Sezione>
    );
  }

  // Le sezioni nuove possono mancare in una risposta di un server non ancora aggiornato: la sezione
  // lo dice invece di rompere la pagina
  const copertura = insights.sintesi?.copertura;
  const box = insights.box ?? [];
  const conReparti = sezioneAttiva(insightsConfig, "reparti");
  const conMeccaniche = sezioneAttiva(insightsConfig, "meccaniche");

  return (
    <div className={clsx("flex flex-col gap-6", className)}>
      {(conReparti || conMeccaniche) && (
        <div className={clsx("grid grid-cols-1 items-start gap-6", conReparti && conMeccaniche && "lg:grid-cols-2")}>
          {conReparti && (
            <Sezione titolo="Reparti" descrizione="Spazio e referenze di ogni reparto." className="min-w-0">
              {insights.spazio ? (
                <RepartiVolantino perReparto={insights.spazio.perReparto} copertura={copertura} />
              ) : (
                <NonDisponibile />
              )}
            </Sezione>
          )}
          {conMeccaniche && (
            <Sezione titolo="Meccaniche" descrizione="I box in sottocosto." className="min-w-0">
              {insights.prezziSconti ? <PrezziSconti prezziSconti={insights.prezziSconti} box={box} /> : <NonDisponibile />}
            </Sezione>
          )}
        </div>
      )}
    </div>
  );
};

export default FlyerInsights;
