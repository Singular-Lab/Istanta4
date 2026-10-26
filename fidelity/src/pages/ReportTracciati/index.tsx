import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from "@/context/NotificationContext";
import { useCalcolaQueryDaOpzione, useFetchReportOptions } from "@/query/query";
import clsx from "clsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReportOptionDTO } from "../../../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: ReportOptionDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      type="button"
      className={clsx(
        "group relative flex w-full flex-col gap-4 rounded-xl border-2 p-5 text-left transition-all duration-150",
        selected
          ? "border-primary bg-primary/[0.03] shadow-md shadow-primary/10"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
    >
      {/* Check badge */}
      <span
        className={clsx(
          "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full transition-transform duration-150",
          selected ? "scale-100 bg-primary opacity-100" : "scale-75 opacity-0"
        )}
      >
        <Lucide icon="Check" className="h-3 w-3 text-white" />
      </span>

      {/* Icon + header */}
      <div className="flex items-start gap-4">
        <div
          className={clsx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
            selected ? "bg-primary/15" : "bg-slate-100 group-hover:bg-slate-150"
          )}
        >
          <Lucide
            icon={option.icona ?? "FileBarChart"}
            className={clsx("h-6 w-6 transition-colors", selected ? "text-primary" : "text-slate-400")}
          />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <div
            className={clsx(
              "text-sm font-bold leading-snug",
              selected ? "text-primary" : "text-slate-800"
            )}
          >
            {option.titolo}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {option.descrizione}
          </p>
        </div>
      </div>

      {/* Plugin chips */}
      {option.plugins.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {option.plugins.map((p) => (
            <span
              key={p.id}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                selected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
              )}
            >
              <Lucide icon="Layers" className="h-3 w-3 shrink-0" />
              {p.titolo}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function Main() {
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const optionsQuery = useFetchReportOptions();
  const queryMutation = useCalcolaQueryDaOpzione();

  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);

  const options = optionsQuery.data ?? [];
  const activeOption = options.find((o) => o.id === activeOptionId) ?? null;

  const handleExecute = () => {
    if (!activeOptionId) return;
    queryMutation.mutate(activeOptionId, {
      onSuccess: (result) => {
        if (result.aggregazione === "merged" && result.report) {
          navigate("/report/tracciati/risultato", { state: { report: result.report } });
        } else {
          navigate("/report/tracciati/risultato", { state: { queryResult: result } });
        }
      },
      onError: (error: unknown) => {
        const err = error as { status?: number; message?: string };
        const is404 =
          err?.status === 404 ||
          String(err?.message ?? "").toLowerCase().includes("nessun");
        showNotification(
          <div className="flex items-start gap-3">
            <Lucide icon="CircleAlert" className="h-6 w-6 shrink-0 text-danger" />
            <div>
              <div className="text-sm font-semibold">Calcolo non riuscito</div>
              <div className="mt-1 text-xs text-slate-500">
                {is404
                  ? "Nessun confronto disponibile per questa opzione. Verifica i momenti dalla gestione lavorazioni."
                  : err?.message || "Si è verificato un errore."}
              </div>
            </div>
          </div>,
          { variant: "error" }
        );
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Report Tracciati"
        description="Seleziona un'analisi preconfigurata per il tuo cliente e avvia il calcolo."
      />

      <div className="grid grid-cols-12 gap-5">

        {/* ── Colonna principale ─────────────────────────────────────────── */}
        <div className="col-span-12 xl:col-span-8">

          {optionsQuery.isLoading && (
            <div className="box box--stacked p-8 flex flex-col items-center gap-3 text-slate-400">
              <Lucide icon="Loader" className="h-7 w-7 animate-spin" />
              <span className="text-sm">Caricamento opzioni…</span>
            </div>
          )}

          {optionsQuery.isError && (
            <div className="box box--stacked p-8">
              <EmptyState
                icon="TriangleAlert"
                title="Impossibile caricare le opzioni"
                description="Verifica la connessione al server e ricarica la pagina."
              />
            </div>
          )}

          {!optionsQuery.isLoading && !optionsQuery.isError && options.length === 0 && (
            <div className="box box--stacked p-8">
              <EmptyState
                icon="FileChartLine"
                title="Nessuna opzione disponibile"
                description="Non sono state definite opzioni di report per questo cliente."
              />
            </div>
          )}

          {options.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {options.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={activeOptionId === option.id}
                  onSelect={() => setActiveOptionId(option.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="col-span-12 xl:col-span-4 space-y-4">

          {/* Riepilogo */}
          <div className="box box--stacked p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lucide icon="FileSearch" className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold text-slate-800">Analisi selezionata</h3>
            </div>

            {activeOption ? (
              <div className="space-y-3">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lucide
                      icon={activeOption.icona ?? "FileBarChart"}
                      className="h-4 w-4 text-primary shrink-0"
                    />
                    <span className="text-sm font-semibold text-primary">
                      {activeOption.titolo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {activeOption.descrizione}
                  </p>
                </div>

                {activeOption.plugins.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                      Plugin inclusi
                    </div>
                    <div className="space-y-1.5">
                      {activeOption.plugins.map((p, i) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 text-xs text-slate-700"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-medium text-xs shrink-0">
                            {i + 1}
                          </span>
                          {p.titolo}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400 italic">
                Nessuna analisi selezionata. Scegli un'opzione dalla lista.
              </div>
            )}
          </div>

          {/* Esegui */}
          <Button
            variant="primary"
            className="w-full justify-center"
            disabled={!activeOptionId || queryMutation.isPending}
            loading={queryMutation.isPending}
            onClick={handleExecute}
          >
            {!queryMutation.isPending && <Lucide icon="Play" className="mr-2 h-4 w-4" />}
            {queryMutation.isPending ? "Calcolo in corso…" : "Esegui analisi"}
          </Button>

          {queryMutation.isError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/5 p-3">
              <Lucide icon="CircleAlert" className="h-4 w-4 shrink-0 text-danger mt-0.5" />
              <p className="text-xs text-danger leading-relaxed">
                Nessun confronto disponibile per l'analisi selezionata. Verifica i momenti dalla gestione lavorazioni.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <Lucide icon="Info" className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Le analisi richiedono che i momenti e i relativi confronti siano già stati calcolati dalla pagina di gestione lavorazioni.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default withSessionCheck(Main);
