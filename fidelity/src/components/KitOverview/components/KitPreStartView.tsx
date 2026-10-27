import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { formatData, formatNumero } from "@/utils/format";
import { FC } from "react";
import { KitPreStartViewProps } from "../types";
import HeroBanner from "./HeroBanner";
import InfoBadges from "./InfoBadges";
import KitInfo from "./KitInfo";

/**
 * KitPreStartView - Pagina dedicata per kit non ancora avviati.
 *
 * Usa lo stesso layout e design del KitOverviewLayout:
 * HeroBanner → StatsGrid → InfoBadges → Grid 3 colonne (contenuto + sidebar)
 */
const KitPreStartView: FC<KitPreStartViewProps> = ({
  lavorazione,
  exportTypes,
  isManuale,
  tipoLavorazione,
  onStartLavorazione,
  isStarting,
}) => {
  const files = (lavorazione as any).files ?? [];

  return (
    <div className="flex flex-col gap-6">
      <HeroBanner
        lavorazione={lavorazione}
        aspetto={{
          icon: "Play",
          subtitle: "Kit non ancora avviato",
          gradient: "from-slate-600 via-slate-500 to-slate-400",
        }}
        data={lavorazione.createdAt}
        primaryAction={{
          label: isStarting ? "Avvio in corso…" : "Avvia lavorazione",
          icon: "Zap",
          onClick: onStartLavorazione,
          loading: isStarting,
        }}
      />

      <StatCardGrid>
        <StatCard densita="compatta" icona="Files" tono="brand" etichetta="File attesi" valore={isManuale ? files.length : undefined} />
        <StatCard
          densita="compatta"
          icona="Layers"
          tono="info"
          etichetta="Tipi di export"
          valore={exportTypes.length}
          sottotitolo={exportTypes.join(", ")}
        />
        <StatCard densita="compatta" icona="Copy" tono="success" etichetta="Copie" valore={formatNumero(lavorazione.quantitaCopie ?? 1)} />
        <StatCard densita="compatta" icona="Calendar" tono="warning" etichetta="Creato il" valore={formatData(lavorazione.createdAt)} />
      </StatCardGrid>

      {/* Info Badges — reused identical */}
      <InfoBadges
        nomeArea={lavorazione.nomeArea}
        nomeCanale={lavorazione.nomeCanale}
        tipoKit={lavorazione.tipo}
        tipoLavorazione={tipoLavorazione}
      />

      {/* Main Content Grid — same 3-column structure */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {exportTypes.length > 0 && (
            <Sezione icona="Layers" titolo="Tipi di export" descrizione={`${exportTypes.length} tipi configurati`}>
              <div className="flex flex-wrap gap-2">
                {exportTypes.map((code, idx) => (
                  <Badge key={idx} variant="primary">
                    <Lucide icon="FileOutput" aria-hidden="true" className="h-3.5 w-3.5" />
                    {code}
                  </Badge>
                ))}
              </div>
            </Sezione>
          )}

          {/* File attesi dal template (solo kit manuali) */}
          {isManuale && files.length > 0 && (
            <Sezione icona="FileStack" titolo="File attesi dal template" descrizione={`${files.length} file da caricare`}>
              <ul className="divide-y divide-slate-100">
                {files.map((file: any, idx: number) => (
                  <li key={file.id || idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-control bg-slate-100">
                      <Lucide icon="File" className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {file.nome || file.nome_originale || "File"}
                      </p>
                      {file.direttive && <p className="truncate text-xs text-slate-400">{file.direttive}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {(file.tipo_export_codice || file.tipo_export) && (
                        <Badge variant="secondary" size="sm">
                          {file.tipo_export_codice || file.tipo_export}
                        </Badge>
                      )}
                      {file.isOptional || file.is_optional ? (
                        <StatusBadge tono="neutral" etichetta="Opzionale" />
                      ) : (
                        <StatusBadge tono="brand" etichetta="Obbligatorio" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Sezione>
          )}

          {/* Empty state for left column if no content */}
          {exportTypes.length === 0 && !(isManuale && files.length > 0) && (
            <Sezione>
              <EmptyState
                compatta
                icon="PackageOpen"
                title="Nessun file da gestire"
                description="Avvia la lavorazione per iniziare a gestire i file"
              />
            </Sezione>
          )}
        </div>

        {/* Right Column - Sidebar (1/3) */}
        <div className="flex flex-col gap-6">
          <KitInfo lavorazione={lavorazione} />

          <Sezione
            icona="Zap"
            titolo="Avvia lavorazione"
            descrizione={isManuale ? "Carica e gestisci i file" : "Processamento automatico"}
          >
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                {isManuale
                  ? "Avvia la lavorazione per iniziare a caricare e gestire i file per questo kit."
                  : "Avvia la lavorazione per processare automaticamente questo kit."}
              </p>
              <Button variant="primary" className="w-full" onClick={onStartLavorazione} loading={isStarting}>
                {!isStarting && <Lucide icon="Zap" aria-hidden="true" className="mr-2 h-4 w-4" />}
                {isStarting ? "Avvio in corso…" : "Avvia lavorazione"}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Questa azione non può essere annullata una volta confermata.
              </p>
            </div>
          </Sezione>
        </div>
      </div>
    </div>
  );
};

export default KitPreStartView;
