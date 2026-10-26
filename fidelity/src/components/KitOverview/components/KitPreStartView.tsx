import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import LoadingIcon from "@/components/Base/LoadingIcon";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { FC } from "react";
import { Link } from "react-router-dom";
import { STATO_PROMO, TIPO_LAVORAZIONE } from "../../../../lib/enums";
import { KitPreStartViewProps } from "../types";
import InfoBadges from "./InfoBadges";
import KitInfo from "./KitInfo";
import StatCard from "./StatCard";

dayjs.locale("it");

// Same SVG pattern used by HeroBanner
const bgPattern =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48cGF0aCBkPSJNLTE1IDE1TDQ1IDc1TTYwIDBMMCA2MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTAgMEw2MCA2MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==";

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
  const isPromoFinalState =
    lavorazione.promo?.stato === STATO_PROMO.VALIDA ||
    lavorazione.promo?.stato === STATO_PROMO.VALIDA_CON_ERRORI ||
    lavorazione.promo?.stato === STATO_PROMO.ARCHIVIATA;

  const files = (lavorazione as any).files ?? [];

  return (
    <div className="space-y-6">
      {/* Hero Banner — same markup as HeroBanner.tsx with pre-start config */}
      <div
        className={clsx(
          "relative overflow-hidden rounded-2xl p-8",
          "bg-gradient-to-br from-slate-600 via-slate-500 to-slate-400"
        )}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: `url('${bgPattern}')` }}
        />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left Side - Icon and Info */}
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Lucide icon="Play" className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {lavorazione.titolo}
                </h2>
                <p className="text-white/80 text-sm">
                  Kit non ancora avviato
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                    <Lucide icon="Calendar" className="h-3 w-3" />
                    {lavorazione.createdAt
                      ? dayjs(lavorazione.createdAt).format(
                          "DD MMMM YYYY, HH:mm"
                        )
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {lavorazione.idPromo && (
                <Link
                  to={`/${
                    isPromoFinalState
                      ? "promozioni/storico"
                      : "promozioni/in-corso"
                  }/dettagli/${lavorazione.idPromo}`}
                >
                  <Button
                    variant="outline-secondary"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    <Lucide icon="ArrowLeft" className="h-4 w-4 mr-2" />
                    Vai alla Promozione
                  </Button>
                </Link>
              )}
              <Button
                variant="primary"
                className="bg-white text-slate-800 hover:bg-white/90 shadow-lg"
                onClick={onStartLavorazione}
                disabled={isStarting}
              >
                {isStarting ? (
                  <>
                    <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                    Avvio in corso...
                  </>
                ) : (
                  <>
                    <Lucide icon="Zap" className="h-4 w-4 mr-2" />
                    Avvia Lavorazione
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid — same layout as StatsGrid using StatCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="Files"
          iconColor="text-theme-1"
          iconBg="bg-theme-1/10"
          value={isManuale ? files.length : "-"}
          label="File attesi"
        />
        <StatCard
          icon="Layers"
          iconColor="text-info"
          iconBg="bg-info/10"
          value={exportTypes.length}
          label="Tipi di export"
          sublabel={exportTypes.join(", ")}
        />
        <StatCard
          icon="Copy"
          iconColor="text-success"
          iconBg="bg-success/10"
          value={(lavorazione.quantitaCopie ?? 1).toLocaleString()}
          label="Copie"
        />
        <StatCard
          icon="Calendar"
          iconColor="text-warning"
          iconBg="bg-warning/10"
          value={
            lavorazione.createdAt
              ? dayjs(lavorazione.createdAt).format("DD/MM/YYYY")
              : "-"
          }
          label="Creato il"
          sublabel={
            lavorazione.createdAt
              ? dayjs(lavorazione.createdAt).format("HH:mm")
              : undefined
          }
        />
      </div>

      {/* Info Badges — reused identical */}
      <InfoBadges
        nomeArea={lavorazione.nomeArea}
        nomeCanale={lavorazione.nomeCanale}
        tipoKit={lavorazione.tipo}
        tipoLavorazione={tipoLavorazione}
      />

      {/* Main Content Grid — same 3-column structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Export Types card */}
          {exportTypes.length > 0 && (
            <div className="box box--stacked p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                  <Lucide icon="Layers" className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    Tipi di Export
                  </h3>
                  <p className="text-xs text-slate-500">
                    {exportTypes.length} tipi configurati
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {exportTypes.map((code, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-theme-1/10 text-theme-1 text-sm font-medium border border-theme-1/20"
                  >
                    <Lucide
                      icon="FileOutput"
                      className="h-3.5 w-3.5 mr-1.5"
                    />
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* File attesi dal template (solo kit manuali) */}
          {isManuale && files.length > 0 && (
            <div className="box box--stacked p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <Lucide
                    icon="FileStack"
                    className="h-5 w-5 text-slate-600"
                  />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    File attesi dal template
                  </h3>
                  <p className="text-xs text-slate-500">
                    {files.length} file da caricare
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {files.map((file: any, idx: number) => (
                  <div
                    key={file.id || idx}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <Lucide
                        icon="File"
                        className="h-4 w-4 text-slate-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {file.nome || file.nome_originale || "File"}
                      </p>
                      {file.direttive && (
                        <p className="text-xs text-slate-400 truncate">
                          {file.direttive}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(file.tipo_export_codice || file.tipo_export) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {file.tipo_export_codice || file.tipo_export}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          file.isOptional || file.is_optional
                            ? "bg-slate-100 text-slate-500"
                            : "bg-theme-1/10 text-theme-1"
                        }`}
                      >
                        {file.isOptional || file.is_optional
                          ? "Opzionale"
                          : "Obbligatorio"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for left column if no content */}
          {exportTypes.length === 0 && !(isManuale && files.length > 0) && (
            <div className="box box--stacked p-6">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                  <Lucide
                    icon="PackageOpen"
                    className="h-7 w-7 text-slate-400"
                  />
                </div>
                <p className="text-sm text-slate-500">
                  Avvia la lavorazione per iniziare a gestire i file
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar (1/3) */}
        <div className="space-y-6">
          {/* KitInfo — reused identical */}
          <KitInfo lavorazione={lavorazione} />

          {/* CTA Panel — same structure as ActionPanel */}
          <div className="box my-5 mb-10">
            <div className="pt-5 p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme-1/10">
                    <Lucide icon="Zap" className="h-5 w-5 text-theme-1" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">
                      Avvia Lavorazione
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isManuale
                        ? "Carica e gestisci i file"
                        : "Processamento automatico"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  {isManuale
                    ? "Avvia la lavorazione per iniziare a caricare e gestire i file per questo kit."
                    : "Avvia la lavorazione per processare automaticamente questo kit."}
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={onStartLavorazione}
                  disabled={isStarting}
                >
                  {isStarting ? (
                    <>
                      <LoadingIcon icon="oval" className="w-5 h-5 mr-2" />
                      Avvio in corso...
                    </>
                  ) : (
                    <>
                      <Lucide icon="Zap" className="w-5 h-5 mr-2" />
                      Avvia Lavorazione
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-400 text-center">
                  Questa azione non puo' essere annullata una volta confermata.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitPreStartView;
