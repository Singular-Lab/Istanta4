import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useFetchFlyerInsightsConfig } from "@/query/query";
import { FlyerInsights as FlyerInsightsType } from "@/types/flyerInsights";
import clsx from "clsx";
import { FC } from "react";
import { MarcheVolantino, PrezziSconti, RepartiVolantino } from "./analisi";
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
 * Le analisi del volantino come sezioni della pagina, una sotto l'altra e senza schede: Reparti e
 * Meccaniche e sconti affiancate sugli schermi larghi, poi Marche. La config della GDO puo' spegnere
 * reparti e meccaniche (enabled: false). Sintesi, distribuzione nelle pagine, volantino sfogliabile e
 * marchi del distributore li mette la pagina, fuori da qui.
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
            <Sezione titolo="Reparti" descrizione="Spazio, referenze e sconto medio di ogni reparto." className="min-w-0">
              {insights.spazio ? (
                <RepartiVolantino perReparto={insights.spazio.perReparto} scontoPerReparto={insights.prezziSconti?.perReparto} copertura={copertura} />
              ) : (
                <NonDisponibile />
              )}
            </Sezione>
          )}
          {conMeccaniche && (
            <Sezione titolo="Meccaniche e sconti" descrizione="Fasce di sconto, sconto medio per meccanica e box in sottocosto." className="min-w-0">
              {insights.prezziSconti ? <PrezziSconti prezziSconti={insights.prezziSconti} box={box} copertura={copertura} /> : <NonDisponibile />}
            </Sezione>
          )}
        </div>
      )}

      <Sezione titolo="Marche" descrizione="Le marche con più spazio e più box, con lo sconto medio di ciascuna.">
        {insights.marche ? (
          <MarcheVolantino marche={insights.marche} conLineeDistributore={Boolean(insights.lineeDistributore)} copertura={copertura} />
        ) : (
          <NonDisponibile />
        )}
      </Sezione>
    </div>
  );
};

export default FlyerInsights;
