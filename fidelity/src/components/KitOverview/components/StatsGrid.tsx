import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import { formatData } from "@/utils/format";
import { FC } from "react";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../../lib/enums";
import { getStateConfig } from "../config/stateConfig";
import { StatsGridProps } from "../types";

/**
 * StatsGrid - Griglia di statistiche che mostra metriche diverse in base allo stato.
 *
 * Per IN_LAVORAZIONE e PUBBLICATO:
 * - File totali, Export types, Referenze, Tempo produzione
 *
 * Per IN_REVISIONE:
 * - File totali, Accettati, Rifiutati, In attesa
 *
 * Per IN_LAVORAZIONE_CON_ERRORI:
 * - File totali, Rifiutati, % Errori, Da correggere
 */
const StatsGrid: FC<StatsGridProps> = ({
  filesCount,
  totalPages,
  exportTypesCount,
  exportTypesList,
  referenzeCount = 0,
  origineStorico,
  paginAnalizzate,
  productionDuration,
  isTimerLive,
  createdAt,
  acceptedCount = 0,
  rejectedCount = 0,
  pendingCount = 0,
  errorPercentage = 0,
  stato
}) => {
  const config = getStateConfig(stato);
  const { showRevisionStats, showErrorStats } = config.stats;

  // Stats per IN_REVISIONE
  if (showRevisionStats && !showErrorStats) {
    return (
      <StatCardGrid>
        <StatCard
          densita="compatta"
          icona="Files"
          tono="brand"
          etichetta="File totali"
          valore={filesCount}
          sottotitolo={`${totalPages} pagine`}
        />
        <StatCard
          densita="compatta"
          icona="CircleCheck"
          tono="success"
          etichetta="Accettati"
          valore={acceptedCount}
          sottotitolo="File approvati"
        />
        <StatCard
          densita="compatta"
          icona="CircleX"
          tono="danger"
          etichetta="Rifiutati"
          valore={rejectedCount}
          sottotitolo="Da correggere"
        />
        <StatCard
          densita="compatta"
          icona="Clock"
          tono="warning"
          etichetta="In attesa"
          valore={pendingCount}
          sottotitolo="Da revisionare"
        />
      </StatCardGrid>
    );
  }

  // Stats per IN_LAVORAZIONE_CON_ERRORI
  if (showErrorStats) {
    return (
      <StatCardGrid>
        <StatCard
          densita="compatta"
          icona="Files"
          tono="brand"
          etichetta="File totali"
          valore={filesCount}
          sottotitolo={`${totalPages} pagine`}
        />
        <StatCard
          densita="compatta"
          icona="CircleCheck"
          tono="success"
          etichetta="Accettati"
          valore={acceptedCount}
          sottotitolo="File approvati"
        />
        <StatCard
          densita="compatta"
          icona="CircleX"
          tono="danger"
          etichetta="Rifiutati"
          valore={rejectedCount}
          sottotitolo="Da correggere"
        />
        <StatCard
          densita="compatta"
          icona="TriangleAlert"
          tono="danger"
          etichetta="% Errori"
          valore={`${errorPercentage.toFixed(0)}%`}
          sottotitolo="Percentuale file errati"
        />
      </StatCardGrid>
    );
  }

  // Stats default per IN_LAVORAZIONE e PUBBLICATO
  return (
    <StatCardGrid>
      <StatCard
        densita="compatta"
        icona="Files"
        tono="brand"
        etichetta={stato === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO ? "File pubblicati" : "File caricati"}
        valore={filesCount}
        sottotitolo={`${totalPages} pagine totali`}
      />
      <StatCard
        densita="compatta"
        icona="Layers"
        tono="info"
        etichetta="Tipi di export"
        valore={exportTypesCount}
        sottotitolo={exportTypesList.join(", ")}
      />
      <StatCard
        densita="compatta"
        icona="Package"
        tono="success"
        etichetta="Referenze"
        valore={referenzeCount}
        sottotitolo={origineStorico && origineStorico.totaleFuoriListino > 0
          ? `di cui ${origineStorico.totaleFuoriListino} fuori listino`
          : paginAnalizzate ? `${paginAnalizzate} pagine analizzate` : undefined}
      />
      <StatCard
        densita="compatta"
        icona="Clock"
        tono={isTimerLive ? "brand" : "warning"}
        etichetta={isTimerLive ? "Tempo (in corso)" : "Tempo produzione"}
        valore={productionDuration}
        sottotitolo={createdAt ? `Dal ${formatData(createdAt)}` : undefined}
        pulsa={isTimerLive}
        evidenzia={isTimerLive}
      />
    </StatCardGrid>
  );
};

export default StatsGrid;
