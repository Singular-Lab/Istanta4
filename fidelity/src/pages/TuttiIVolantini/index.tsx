import Alert from "@/components/Base/Alert";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { FlyerInsights as FlyerInsightsComponent } from "@/components/FlyerInsights";
import ReferenzeInVolantinoBox from "@/components/ReferenzeInVolantinoBox";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchFlyerInsights, useFetchFlyerInsightsConfig } from "@/query/query";
import type { ReferenzaPosizione } from "@/types/flyerInsights";
import { resolveColor } from "@/utils/flyerInsightsHelpers";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";

type FileKit = {
  nome: string;
  nome_originale?: string;
  url: string;
  url_download: string;
};

type FileDelKit = { titolo: string; files: FileKit[] };
type GruppoReferenze = { sigla: string; descrizione: string; referenze: ReferenzaPosizione[] };

const INDIETRO = { to: "/volantini", etichetta: "Torna ai volantini" };

const numeroPagina = (valore: string | null): number | undefined => {
  const numero = Number(valore);
  return Number.isInteger(numero) && numero > 0 ? numero : undefined;
};

/** Dettaglio di sola consultazione del volantino: insight e, se autorizzati, file pubblicati. */
const TuttiIVolantini: React.FC = () => {
  const [parametri] = useSearchParams();
  const idKit = parametri.get("kit") ?? "";
  const pagina = numeroPagina(parametri.get("pagina"));
  const referenza = parametri.get("referenza") ?? "";
  const puoScaricare = usePermission(PERMISSIONS.FILE.DOWNLOAD);
  const insights = useFetchFlyerInsights(idKit);
  const configurazione = useFetchFlyerInsightsConfig();
  const file = useQuery({
    queryKey: ["fileVolantinoConsultazione", idKit],
    queryFn: () => ServerCall.get<FileDelKit>(`/getAllFiles?id=${encodeURIComponent(idKit)}`),
    enabled: Boolean(idKit && puoScaricare),
  });
  const [cerca, setCerca] = useState("");

  const fileFiltrati = useMemo(() => {
    const elenco = file.data?.files ?? [];
    const testo = cerca.trim().toLowerCase();
    if (!testo) return elenco;
    return elenco.filter((voce) =>
      [voce.nome, voce.nome_originale].some((valore) => valore?.toLowerCase().includes(testo))
    );
  }, [file.data?.files, cerca]);

  const referenzePerReparto = useMemo<GruppoReferenze[]>(() => {
    const dati = insights.data;
    if (!dati) return [];
    const gruppi = new Map<string, GruppoReferenze>();
    for (const reparto of dati.riepilogoReparti) {
      gruppi.set(reparto.sigla, { sigla: reparto.sigla, descrizione: reparto.descrizione, referenze: [] });
    }
    for (const voce of dati.referenze) {
      const sigla = String(voce.reparto || "ALTRO");
      const gruppo = gruppi.get(sigla) ?? {
        sigla,
        descrizione: String(voce.descrizioneReparto || sigla),
        referenze: [],
      };
      gruppo.referenze.push(voce);
      gruppi.set(sigla, gruppo);
    }
    return [...gruppi.values()]
      .filter((gruppo) => gruppo.referenze.length > 0)
      .sort((a, b) => b.referenze.length - a.referenze.length);
  }, [insights.data]);

  if (!idKit) {
    return (
      <Pagina titolo="Dettaglio volantino" indietro={INDIETRO}>
        <PageError compatta titolo="Volantino non indicato" motivo="L'indirizzo non contiene il volantino da consultare." />
      </Pagina>
    );
  }

  if (insights.isError) {
    return (
      <Pagina titolo="Dettaglio volantino" indietro={INDIETRO}>
        <PageError
          compatta
          titolo="Insight non caricati"
          motivo={insights.error?.message || "Non è stato possibile caricare il volantino."}
          onRiprova={() => insights.refetch()}
        />
      </Pagina>
    );
  }

  const contesto = insights.data?.contesto;
  const descrizione = [contesto?.nomeArea, contesto?.nomeCanale].filter(Boolean).join(" · ");

  return (
    <Pagina
      titolo={contesto?.titolo || "Dettaglio volantino"}
      descrizione={descrizione || "Insight e materiali del volantino"}
      indietro={INDIETRO}
    >
      <Sezione titolo="Insight del volantino" descrizione="Pagine, reparti, meccaniche e distribuzione delle referenze.">
        {insights.isLoading ? (
          <div aria-busy="true" className="space-y-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-80" />
          </div>
        ) : (
          <FlyerInsightsComponent
            insights={insights.data ?? null}
            paginaSelezionata={pagina}
            exportCodes={[EXPORT_DI_SISTEMA.VOL]}
          />
        )}
      </Sezione>

      {insights.data && referenzePerReparto.length > 0 && (
        <ReferenzeInVolantinoBox
          exportTypes={[EXPORT_DI_SISTEMA.VOL]}
          referenzePerReparto={referenzePerReparto}
          flyerInsights={insights.data}
          insightsConfig={configurazione.data}
          resolveColor={resolveColor}
          ricercaIniziale={referenza}
        />
      )}

      {!puoScaricare ? (
        <Alert variant="soft-info" icona="Eye">
          Gli insight sono disponibili in consultazione. Per scaricare i file serve il permesso di download.
        </Alert>
      ) : (
        <Sezione senzaPadding titolo="File del volantino" descrizione="File pubblicati disponibili per il download.">
          <BarraFiltri>
            <CampoRicerca etichetta="Cerca file" placeholder="Cerca file…" value={cerca} onChange={setCerca} />
          </BarraFiltri>
          {file.isLoading ? (
            <div aria-busy="true" className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((indice) => <Skeleton key={indice} className="h-56" />)}
            </div>
          ) : file.isError ? (
            <div className="p-5">
              <PageError
                compatta
                titolo="File non caricati"
                motivo={file.error?.message || "I file del volantino non sono stati caricati."}
                onRiprova={() => file.refetch()}
              />
            </div>
          ) : fileFiltrati.length === 0 ? (
            <EmptyState
              compatta
              icon={cerca.trim() ? "SearchX" : "FileX"}
              title="Nessun file"
              description={cerca.trim() ? `Nessun file corrisponde a «${cerca.trim()}»` : "Il volantino non contiene file pubblicati."}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {fileFiltrati.map((voce, indice) => (
                <li key={`${voce.url_download}-${indice}`} className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4">
                  <div className="h-36 overflow-hidden rounded-control border border-slate-200 bg-slate-100">
                    <img alt="" className="h-full w-full object-cover" src={voce.url} loading="lazy" />
                  </div>
                  <p className="truncate text-sm font-medium text-slate-800" title={voce.nome}>{voce.nome}</p>
                  <Button
                    as="a"
                    href={voce.url_download}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    size="sm"
                    variant="outline-secondary"
                    className="self-start"
                  >
                    <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Scarica PDF
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Sezione>
      )}
    </Pagina>
  );
};

export default withSessionCheck(TuttiIVolantini);
