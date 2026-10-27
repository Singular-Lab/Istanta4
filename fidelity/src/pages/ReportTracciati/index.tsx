import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
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
      aria-pressed={selected}
      className={clsx(
        "group relative flex w-full flex-col gap-4 rounded-card border-2 p-5 text-left transition-all duration-150",
        selected
          ? "border-primary bg-primary/5"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      {/* Check badge */}
      <span
        aria-hidden="true"
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
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-card transition-colors",
            selected ? "bg-primary/15" : "bg-slate-100 group-hover:bg-slate-200"
          )}
        >
          <Lucide
            icon={option.icona ?? "FileBarChart"}
            aria-hidden="true"
            className={clsx("h-6 w-6 transition-colors", selected ? "text-primary" : "text-slate-400")}
          />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <span className={clsx("title-card block", selected && "text-primary")}>{option.titolo}</span>
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
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-medium",
                selected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
              )}
            >
              <Lucide icon="Layers" aria-hidden="true" className="h-3 w-3 shrink-0" />
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
          is404
            ? "Calcolo non riuscito: nessun confronto disponibile per questa opzione. Verifica i momenti dalla gestione lavorazioni."
            : `Calcolo non riuscito: ${err?.message || "si è verificato un errore."}`,
          { variant: "error" }
        );
      },
    });
  };

  return (
    <Pagina
      titolo="Report tracciati"
      descrizione="Seleziona un'analisi preconfigurata per il tuo cliente e avvia il calcolo."
    >
      <div className="grid grid-cols-12 gap-6">
        {/* ── Colonna principale ─────────────────────────────────────────── */}
        <Sezione
          className="col-span-12 xl:col-span-8"
          titolo="Analisi disponibili"
          descrizione="Le analisi preconfigurate per il tuo cliente"
        >
          {optionsQuery.isLoading && (
            <div role="status" className="flex flex-col items-center gap-3 py-8 text-slate-500">
              <Spinner decorativo />
              <span className="text-sm">Caricamento opzioni…</span>
            </div>
          )}

          {optionsQuery.isError && (
            <PageError
              compatta
              titolo="Impossibile caricare le opzioni"
              motivo={optionsQuery.error?.message || "Verifica la connessione al server e riprova."}
              onRiprova={() => optionsQuery.refetch()}
            />
          )}

          {!optionsQuery.isLoading && !optionsQuery.isError && options.length === 0 && (
            <EmptyState
              compatta
              icon="FileChartLine"
              title="Nessuna opzione disponibile"
              description="Non sono state definite opzioni di report per questo cliente."
            />
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
        </Sezione>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <Sezione as="aside" className="col-span-12 self-start xl:sticky xl:top-24 xl:col-span-4" titolo="Analisi selezionata" icona="FileSearch">
          <div className="space-y-4">
            {activeOption ? (
              <div className="space-y-3">
                <div className="rounded-control border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Lucide
                      icon={activeOption.icona ?? "FileBarChart"}
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-primary"
                    />
                    <span className="text-sm font-semibold text-primary">{activeOption.titolo}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{activeOption.descrizione}</p>
                </div>

                {activeOption.plugins.length > 0 && (
                  <div>
                    <h3 className="title-eyebrow mb-2">Plugin inclusi</h3>
                    <ol className="space-y-1.5">
                      {activeOption.plugins.map((p, i) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium tabular-nums text-slate-500"
                          >
                            {i + 1}
                          </span>
                          {p.titolo}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                compatta
                icon="MousePointerClick"
                title="Nessuna analisi selezionata"
                description="Scegli un'opzione dalla lista."
                className="border border-dashed border-slate-200"
              />
            )}

            {/* Esegui */}
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={!activeOptionId || queryMutation.isPending}
              loading={queryMutation.isPending}
              onClick={handleExecute}
            >
              {!queryMutation.isPending && <Lucide icon="Play" aria-hidden="true" className="mr-2 h-4 w-4" />}
              Esegui analisi
            </Button>

            {queryMutation.isError && (
              <Alert variant="soft-danger" icona="CircleAlert">
                Nessun confronto disponibile per l'analisi selezionata. Verifica i momenti dalla gestione lavorazioni.
              </Alert>
            )}

            {/* Nota: non è un avviso, resta un testo d'aiuto */}
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <Lucide icon="Info" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              Le analisi richiedono che i momenti e i relativi confronti siano già stati calcolati dalla pagina di gestione lavorazioni.
            </p>
          </div>
        </Sezione>
      </div>
    </Pagina>
  );
}

export default withSessionCheck(Main);
