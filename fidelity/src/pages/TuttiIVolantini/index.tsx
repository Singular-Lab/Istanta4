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
import { SintesiInsight } from "@/components/FlyerInsights/analisi";
import { ScaricaReportPdf } from "@/components/FlyerInsights/report";
import { VolantinoSfogliabile } from "@/components/FlyerInsights/volantino";
import ReferenzeInVolantinoBox from "@/components/ReferenzeInVolantinoBox";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useConfrontiVolantino } from "@/query/flyerInsights";
import { useFetchFlyerInsights, useFetchFlyerInsightsConfig } from "@/query/query";
import type { ReferenzaPosizione } from "@/types/flyerInsights";
import { resolveColor } from "@/utils/flyerInsightsHelpers";
import { useVolantinoConsultazione } from "@/query/consultazione";
import { useScaricaFileConsultazione } from "@/utils/scaricaFileConsultazione";
import { lazy, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";
import type { BoxInsight } from "../../../lib/insightVolantino/tipi";

// I confronti stanno in fondo alla pagina e pesano: il loro codice si scarica a parte, con un solo
// caricamento per i due blocchi (due import() contemporanei dello stesso modulo sono inutili e, con
// i mock di vitest, il secondo riceverebbe il modulo vero)
let caricamentoConfronti: Promise<typeof import("@/components/FlyerInsights/confronti")> | undefined;
const caricaConfronti = () => (caricamentoConfronti ??= import("@/components/FlyerInsights/confronti"));
const ConfrontoEdizione = lazy(() => caricaConfronti().then(modulo => ({ default: modulo.ConfrontoEdizione })));
const DifferenzeVarianti = lazy(() => caricaConfronti().then(modulo => ({ default: modulo.DifferenzeVarianti })));

type GruppoReferenze = { sigla: string; descrizione: string; referenze: ReferenzaPosizione[] };

const INDIETRO = { to: "/volantini", etichetta: "Torna ai volantini" };

const numeroPagina = (valore: string | null): number | undefined => {
  const numero = Number(valore);
  return Number.isInteger(numero) && numero > 0 ? numero : undefined;
};

const normalizza = (testo: string): string => testo.trim().replace(/\s+/g, " ").toLocaleLowerCase("it");

/**
 * Il box da aprire all'avvio per il parametro ?referenza: è l'id di una referenza, oppure, dai
 * collegamenti della scheda del punto vendita, il nome stampato del prodotto (che vale per il pilota del box).
 */
const boxDellaReferenza = (box: readonly BoxInsight[], referenza: string): BoxInsight | null => {
  const cercata = referenza.trim();
  if (!cercata) return null;
  const perId = box.find(voce => voce.idReferenze.includes(cercata));
  if (perId) return perId;
  const nome = normalizza(cercata);
  return box.find(voce => normalizza(voce.nome) === nome) ?? null;
};

/**
 * Dettaglio di sola consultazione del volantino: sintesi, pagine con i box, insight, confronti e,
 * se autorizzati, file pubblicati; nell'intestazione il report PDF. Il kit è nella chiave: aprendo
 * un altro volantino da questa pagina (l'edizione precedente, un'altra variante) pagina, scelte e
 * filtri ripartono da capo.
 */
const TuttiIVolantini: React.FC = () => {
  const [parametri] = useSearchParams();
  const idKit = parametri.get("kit") ?? "";
  return <DettaglioVolantino key={idKit} idKit={idKit} />;
};

function DettaglioVolantino({ idKit }: { idKit: string }) {
  const [parametri] = useSearchParams();
  const pagina = numeroPagina(parametri.get("pagina"));
  const referenza = parametri.get("referenza") ?? "";
  const puoScaricare = usePermission(PERMISSIONS.MATERIALI.SCARICA);
  const insights = useFetchFlyerInsights(idKit);
  const configurazione = useFetchFlyerInsightsConfig();
  // Edizione precedente e varianti: partono subito, ma la pagina non le aspetta
  const confronti = useConfrontiVolantino(idKit || undefined);
  // File pubblicati del kit dalla consultazione: solo se è pubblicato e della GDO dell'utente
  const file = useVolantinoConsultazione(idKit, puoScaricare);
  const { inCorso, scarica } = useScaricaFileConsultazione();
  const [cerca, setCerca] = useState("");
  // Pagina del visualizzatore: finché l'utente non sfoglia vale quella dell'indirizzo, o quella del box cercato
  const [paginaSfogliata, setPaginaSfogliata] = useState<number | null>(null);

  const dati = insights.data;
  const boxVolantino = dati?.box;

  const boxIniziale = useMemo(() => (boxVolantino ? boxDellaReferenza(boxVolantino, referenza) : null), [boxVolantino, referenza]);
  const paginaVolantino = paginaSfogliata ?? pagina ?? boxIniziale?.pagina ?? 1;

  const fileFiltrati = useMemo(() => {
    const elenco = file.data?.file ?? [];
    const testo = cerca.trim().toLowerCase();
    if (!testo) return elenco;
    return elenco.filter((voce) => voce.nome.toLowerCase().includes(testo));
  }, [file.data?.file, cerca]);

  const referenzePerReparto = useMemo<GruppoReferenze[]>(() => {
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
  }, [dati]);

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

  const contesto = dati?.contesto;
  const titolo = contesto?.titolo || "Dettaglio volantino";
  const descrizione = [contesto?.nomeArea, contesto?.nomeCanale].filter(Boolean).join(" · ");
  const conPagine = Boolean(dati && (dati.pdf || (dati.box?.length ?? 0) > 0));

  return (
    <Pagina
      titolo={titolo}
      descrizione={descrizione || "Insight e materiali del volantino"}
      indietro={INDIETRO}
      azioni={<ScaricaReportPdf idKit={idKit} titolo={titolo} disabled={!dati} />}
    >
      {insights.isLoading ? (
        <div aria-busy="true" className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          {dati?.sintesi && (
            <Sezione titolo="In sintesi" descrizione="I numeri chiave del volantino e come cambiano rispetto all'edizione precedente.">
              <SintesiInsight
                sintesi={dati.sintesi}
                // undefined finché il confronto non c'è (in caricamento o non caricato), null se è la prima edizione
                confronto={confronti.data ? confronti.data.edizionePrecedente : undefined}
                caricamentoConfronto={confronti.isLoading}
              />
            </Sezione>
          )}

          {dati && conPagine && (
            <Sezione
              titolo="Il volantino"
              descrizione="Le pagine stampate con i box nelle posizioni reali: seleziona un box per la sua scheda e il viaggio del prodotto."
            >
              <VolantinoSfogliabile
                idKit={idKit}
                pdf={dati.pdf ?? null}
                box={dati.box ?? []}
                // Le pagine della sintesi (PDF in Olimpo, o fino all'ultimo box): le stesse delle card e dei confronti
                totalePagine={dati.sintesi?.pagine ?? dati.totalePagine}
                configurazione={configurazione.data}
                pagina={paginaVolantino}
                onCambiaPagina={setPaginaSfogliata}
                idBoxIniziale={boxIniziale?.id ?? null}
              />
            </Sezione>
          )}
        </>
      )}

      <Sezione
        titolo="Insight del volantino"
        descrizione="Pagine, reparti, meccaniche, prezzi e sconti, spazio e marche."
      >
        {insights.isLoading ? (
          <div aria-busy="true" className="space-y-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-80" />
          </div>
        ) : (
          <FlyerInsightsComponent
            insights={dati ?? null}
            paginaSelezionata={pagina}
            exportCodes={[EXPORT_DI_SISTEMA.VOL]}
          />
        )}
      </Sezione>

      {dati && (
        <Sezione
          titolo="Confronti"
          descrizione="Rispetto all'edizione precedente della stessa area e canale e alle altre varianti della promo."
        >
          <Suspense
            fallback={
              <div aria-busy="true" className="space-y-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
              </div>
            }
          >
            <div className="space-y-8">
              <ConfrontoEdizione
                confronto={confronti.data?.edizionePrecedente ?? null}
                caricamento={confronti.isLoading}
                errore={confronti.isError ? confronti.error?.message || "Non è stato possibile caricare i confronti del volantino." : null}
                onRiprova={() => confronti.refetch()}
              />
              {/* Senza confronti non si sa quali varianti esistono: l'errore lo dice già il blocco sopra */}
              {!confronti.isError && (
                <div className="border-t border-dashed border-slate-200 pt-6 dark:border-darkmode-400">
                  <DifferenzeVarianti
                    idKit={idKit}
                    insights={dati}
                    varianti={confronti.data?.varianti ?? []}
                    configurazione={configurazione.data}
                    caricamento={confronti.isLoading}
                  />
                </div>
              )}
            </div>
          </Suspense>
        </Sezione>
      )}

      {dati && referenzePerReparto.length > 0 && (
        <ReferenzeInVolantinoBox
          exportTypes={[EXPORT_DI_SISTEMA.VOL]}
          referenzePerReparto={referenzePerReparto}
          flyerInsights={dati}
          insightsConfig={configurazione.data}
          resolveColor={resolveColor}
          ricercaIniziale={referenza}
        />
      )}

      {!puoScaricare ? (
        <Alert variant="soft-info" icona="Eye">
          Gli insight sono disponibili in consultazione. Per scaricare i file serve il permesso di scaricare volantini e POP.
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
              {fileFiltrati.map((voce) => (
                <li key={voce.id} className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4">
                  <div className="h-36 overflow-hidden rounded-control border border-slate-200 bg-slate-100">
                    {voce.anteprima ? (
                      <img alt="" className="h-full w-full object-cover" src={voce.anteprima} loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Lucide icon="FileText" aria-hidden="true" className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium text-slate-800" title={voce.nome}>{voce.nome}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    className="self-start"
                    onClick={() => scarica(voce.id, voce.nome)}
                    disabled={Boolean(inCorso)}
                    loading={inCorso === voce.id}
                  >
                    {inCorso !== voce.id && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
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
}

export default withSessionCheck(TuttiIVolantini);
