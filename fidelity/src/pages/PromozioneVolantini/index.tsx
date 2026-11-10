import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { StrisciaNumeri } from "@/components/Grafici";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useDettaglioPromozioneVolantini } from "@/query/consultazione";
import { twMerge } from "@/utils/twMerge";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ETICHETTA_PERIODO_CONSULTAZIONE, percorsoVolantini, type PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type { OpzioniDettaglioPromozioneVolantini } from "../../../lib/consultazione/tipi";
import type { CustomError } from "../../../lib/server_call";
import { idFiltro, tinteCanaliPromozione } from "./analisi";
import { Assortimento } from "./Assortimento";
import { Banda } from "./Banda";
import { ConfrontoKit } from "./ConfrontoKit";
import { DoveArriva } from "./DoveArriva";
import { FiltriPromozione } from "./FiltriPromozione";
import { GrigliaVolantini } from "./GrigliaVolantini";
import { LoghiInsegneContext } from "./LogoInsegna";
import { NumeriPromozione, TITOLO_NUMERI } from "./Numeri";

const titoloVista = (periodo: PeriodoConsultazione) => `Volantini ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo]}`;

const indietro = (periodo: PeriodoConsultazione) => ({ to: percorsoVolantini(periodo), etichetta: `Torna a ${titoloVista(periodo)}` });

// Prima che arrivi la promo il periodo non si conosce: si torna alla vista delle promozioni valide
const INDIETRO_PREDEFINITO = indietro("attivi");

const TITOLO_PREDEFINITO = "Promozione";

const OPZIONI_VUOTE: OpzioniDettaglioPromozioneVolantini = { insegne: [], aree: [] };

function Caricamento() {
  return (
    <Pagina titolo={TITOLO_PREDEFINITO} indietro={INDIETRO_PREDEFINITO}>
      <div role="status" aria-label="Caricamento della promozione" className="flex flex-col gap-6">
        <Skeleton className="h-56 rounded-2xl" />
        <StrisciaNumeri titolo={TITOLO_NUMERI} voci={[]} loading vociAttese={5} />
        <Sezione>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </Sezione>
      </div>
    </Pagina>
  );
}

/**
 * Consultazione di una promozione (/volantini/promozioni/:idPromo, "materiali.visualizza"), dalle
 * schede delle viste Volantini: un'infografica di tutti i suoi volantini pubblicati e dei punti
 * vendita che raggiungono. Banda con validità e insegne, filtri per insegna e area, griglia delle
 * miniature, numeri, dove arriva, assortimento e confronto fra i kit; ogni
 * kit apre i suoi insight. I filtri stanno nell'indirizzo (?canale=&area=) e il server ricalcola
 * tutto sui soli kit filtrati. Solo materiali pubblicati della GDO, dalle API di consultazione:
 * niente stato di lavorazione né collegamenti alla produzione, e nessun dato di vendita,
 * previsione, calore o visibilità.
 */
function PromozioneVolantini() {
  const { idPromo = "" } = useParams();
  const navigate = useNavigate();
  const [parametri, aggiorna] = useParametriUrl();
  // Solo UUID: un valore storpiato nell'indirizzo non arriva al server, la tendina lo mostra da togliere
  const idCanale = idFiltro(parametri.get("canale"));
  const idArea = idFiltro(parametri.get("area"));
  const query = useDettaglioPromozioneVolantini(idPromo, { idCanale, idArea });
  // La scheda del punto vendita è delle pagine dei punti vendita, con il loro permesso
  const conScheda = usePermission(PERMISSIONS.GDO.VISUALIZZA);
  const dettaglio = query.data;
  // I colori di tutte le insegne della promo: un filtro non li cambia. Il ?. tiene in piedi la
  // pagina con un server non ancora aggiornato al contratto: allora valgono le insegne dei kit
  const insegne = dettaglio?.insegne;
  const kit = dettaglio?.kit;
  const tinta = useMemo(() => tinteCanaliPromozione(insegne ?? (kit ?? []).map(k => k.canale)), [insegne, kit]);

  if (query.isLoading) return <Caricamento />;

  if (query.isError || !dettaglio) {
    // Promo di un'altra GDO, eliminata o senza volantini pubblicati: non è un errore del servizio
    const nonDisponibile = (query.error as CustomError | null)?.httpStatus === 404;
    return (
      <Pagina titolo={TITOLO_PREDEFINITO} indietro={INDIETRO_PREDEFINITO}>
        <Sezione>
          {nonDisponibile ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Promozione non disponibile"
              description="La promozione non esiste, non è della tua GDO, è stata eliminata oppure non ha volantini pubblicati."
              buttonText={`Torna a ${titoloVista("attivi")}`}
              buttonIcon="ArrowLeft"
              onButtonClick={() => navigate(percorsoVolantini("attivi"))}
            />
          ) : (
            <PageError
              compatta
              titolo="Promozione non caricata"
              motivo={(query.error as Error | null)?.message || "Il servizio non ha restituito la promozione."}
              onRiprova={() => query.refetch()}
            />
          )}
        </Sezione>
      </Pagina>
    );
  }

  const inAttesa = query.isPlaceholderData;
  const cambiaInsegna = (id: string) => aggiorna({ canale: id || null });
  const cambiaArea = (id: string) => aggiorna({ area: id || null });
  const azzera = () => aggiorna({ canale: null, area: null });
  // Dalla banda: la stessa insegna una seconda volta toglie il filtro
  const scegliInsegna = (id: string) => cambiaInsegna(idCanale?.toLowerCase() === id.toLowerCase() ? "" : id);
  const conKit = dettaglio.kit.length > 0;
  const opzioni = dettaglio.opzioni ?? OPZIONI_VUOTE;

  return (
    <LoghiInsegneContext.Provider value={dettaglio.loghiInsegne ?? {}}>
      <Pagina
        titolo={dettaglio.promo.nome}
        descrizione="I volantini pubblicati della promozione e i punti vendita che raggiungono."
        indietro={indietro(dettaglio.periodo)}
      >
        <Banda dettaglio={dettaglio} insegne={opzioni.insegne} tinta={tinta} idCanale={idCanale} onScegliInsegna={scegliInsegna} />
        <FiltriPromozione
          opzioni={opzioni}
          idCanale={idCanale ?? parametri.get("canale") ?? undefined}
          idArea={idArea ?? parametri.get("area") ?? undefined}
          onCambiaInsegna={cambiaInsegna}
          onCambiaArea={cambiaArea}
          onAzzera={azzera}
          mostrati={dettaglio.kit.length}
          totale={dettaglio.numeroKitTotale ?? dettaglio.kit.length}
          inAttesa={inAttesa}
        />
        {/* Mentre arriva il dettaglio dei filtri nuovi resta quello di prima, attenuato */}
        <div aria-busy={inAttesa || undefined} className={twMerge("flex flex-col gap-6 transition-opacity", inAttesa && "opacity-60")}>
          {conKit ? (
            <>
              <GrigliaVolantini kit={dettaglio.kit} tinta={tinta} />
              <NumeriPromozione numeri={dettaglio.numeri} />
              <DoveArriva dettaglio={dettaglio} tinta={tinta} conScheda={conScheda} />
              <Assortimento assortimento={dettaglio.assortimento} numeroKit={dettaglio.kit.length} />
              <ConfrontoKit kit={dettaglio.kit} tinta={tinta} />
            </>
          ) : (
            <Sezione>
              <EmptyState
                compatta
                icon="SearchX"
                title="Nessun volantino con questi filtri"
                description="L'insegna e l'area scelte non hanno insieme volantini in questa promozione. Cambia insegna o area, oppure azzera i filtri."
                buttonText="Azzera filtri"
                buttonIcon="X"
                onButtonClick={azzera}
              />
            </Sezione>
          )}
        </div>
      </Pagina>
    </LoghiInsegneContext.Provider>
  );
}

export default withSessionCheck(PromozioneVolantini);
