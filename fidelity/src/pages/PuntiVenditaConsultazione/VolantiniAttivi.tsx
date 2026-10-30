import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import EmptyState from "@/components/EmptyState";
import { useFetchVolantiniAttiviPuntoVendita } from "@/query/query";
import { formatData } from "@/utils/format";

/**
 * Volantini delle promo valide, dai kit pubblicati con la stessa area e lo stesso canale del
 * punto vendita (spec anagrafica-punti-vendita, "Volantini attivi nel dettaglio del punto vendita").
 */
export function VolantiniAttivi({ idPv, canaleArea }: { idPv: string; canaleArea: string }) {
  const { data: volantini = [], isLoading, isError, error, refetch } = useFetchVolantiniAttiviPuntoVendita(idPv);

  return (
    <Sezione titolo="Volantini attivi" descrizione={canaleArea}>
      {isLoading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" decorativo /> Caricamento volantini...
        </div>
      ) : isError ? (
        <PageError
          compatta
          titolo="Volantini non caricati"
          motivo={(error as Error)?.message || "Errore durante il recupero dei volantini"}
          onRiprova={() => refetch()}
        />
      ) : volantini.length === 0 ? (
        <EmptyState
          compatta
          icon="FileSearch"
          title="Nessun volantino attivo"
          description="Nessun volantino attivo per questo canale e quest'area."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {volantini.map(v => (
            <div key={v.id_kit}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                <h3 className="title-card min-w-0 [overflow-wrap:anywhere] dark:text-slate-100">{v.promo.nome}</h3>
                <span className="text-xs tabular-nums text-slate-500">
                  dal {formatData(v.promo.validita_dal)} al {formatData(v.promo.validita_al)}
                </span>
              </div>
              {/* Compatti: una miniatura bassa per file, in una griglia fitta */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {v.files.map(f => (
                  <div key={f.id} className="overflow-hidden rounded-control border border-slate-200 dark:border-darkmode-400">
                    <img src={f.url} alt={f.nome} loading="lazy" className="h-28 w-full bg-slate-50 object-cover object-top dark:bg-darkmode-700" />
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span className="truncate text-xs" title={f.nome}>{f.nome}</span>
                      <a href={f.url_download} download={f.nome_download} className="ml-auto flex flex-none items-center text-xs text-primary">
                        <Lucide icon="Download" aria-hidden="true" className="mr-1 h-3.5 w-3.5 stroke-[1.3]" /> PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sezione>
  );
}

export default VolantiniAttivi;
