import dayjs from "dayjs";
import "dayjs/locale/it";
import { FC } from "react";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../../lib/enums";
import { getStateConfig } from "../config/stateConfig";
import { StatsGridProps } from "../types";
import StatCard from "./StatCard";

dayjs.locale("it");

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="Files"
          iconColor="text-theme-1"
          iconBg="bg-theme-1/10"
          value={filesCount}
          label="File totali"
          sublabel={`${totalPages} pagine`}
        />
        <StatCard
          icon="CircleCheck"
          iconColor="text-success"
          iconBg="bg-success/10"
          value={acceptedCount}
          label="Accettati"
          sublabel="File approvati"
        />
        <StatCard
          icon="CircleX"
          iconColor="text-danger"
          iconBg="bg-danger/10"
          value={rejectedCount}
          label="Rifiutati"
          sublabel="Da correggere"
        />
        <StatCard
          icon="Clock"
          iconColor="text-warning"
          iconBg="bg-warning/10"
          value={pendingCount}
          label="In attesa"
          sublabel="Da revisionare"
        />
      </div>
    );
  }

  // Stats per IN_LAVORAZIONE_CON_ERRORI
  if (showErrorStats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="Files"
          iconColor="text-theme-1"
          iconBg="bg-theme-1/10"
          value={filesCount}
          label="File totali"
          sublabel={`${totalPages} pagine`}
        />
        <StatCard
          icon="CircleCheck"
          iconColor="text-success"
          iconBg="bg-success/10"
          value={acceptedCount}
          label="Accettati"
          sublabel="File approvati"
        />
        <StatCard
          icon="CircleX"
          iconColor="text-danger"
          iconBg="bg-danger/10"
          value={rejectedCount}
          label="Rifiutati"
          sublabel="Da correggere"
        />
        <StatCard
          icon="TriangleAlert"
          iconColor="text-danger"
          iconBg="bg-danger/10"
          value={`${errorPercentage.toFixed(0)}%`}
          label="% Errori"
          sublabel="Percentuale file errati"
        />
      </div>
    );
  }

  // Stats default per IN_LAVORAZIONE e PUBBLICATO
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        icon="Files"
        iconColor="text-theme-1"
        iconBg="bg-theme-1/10"
        value={filesCount}
        label={stato === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO ? "File pubblicati" : "File caricati"}
        sublabel={`${totalPages} pagine totali`}
      />
      <StatCard
        icon="Layers"
        iconColor="text-info"
        iconBg="bg-info/10"
        value={exportTypesCount}
        label="Tipi di export"
        sublabel={exportTypesList.join(", ")}
      />
      <StatCard
        icon="Package"
        iconColor="text-success"
        iconBg="bg-success/10"
        value={referenzeCount}
        label="Referenze"
        sublabel={paginAnalizzate ? `${paginAnalizzate} pagine analizzate` : undefined}
      />
      <StatCard
        icon="Clock"
        iconColor={isTimerLive ? "text-theme-1" : "text-warning"}
        iconBg={isTimerLive ? "bg-theme-1/10" : "bg-warning/10"}
        value={productionDuration || "-"}
        label={isTimerLive ? "Tempo (in corso)" : "Tempo produzione"}
        sublabel={createdAt ? `Dal ${dayjs(createdAt).format("DD/MM")}` : undefined}
        isLive={isTimerLive}
      />
    </div>
  );
};

export default StatsGrid;
