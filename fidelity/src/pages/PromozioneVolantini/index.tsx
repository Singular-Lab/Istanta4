import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { StrisciaNumeri } from "@/components/Grafici";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useDettaglioPromozioneVolantini } from "@/query/consultazione";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ETICHETTA_PERIODO_CONSULTAZIONE, percorsoVolantini, type PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type { CustomError } from "../../../lib/server_call";
import { tinteCanaliPromozione } from "./analisi";
import { Assortimento } from "./Assortimento";
import { Banda } from "./Banda";
import { ConfrontoKit } from "./ConfrontoKit";
import { DoveArriva } from "./DoveArriva";
import { MatriceKit } from "./MatriceKit";
import { NumeriPromozione, TITOLO_NUMERI } from "./Numeri";

const titoloVista = (periodo: PeriodoConsultazione) => `Volantini ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo]}`;

const indietro = (periodo: PeriodoConsultazione) => ({ to: percorsoVolantini(periodo), etichetta: `Torna a ${titoloVista(periodo)}` });

// Prima che arrivi la promo il periodo non si conosce: si torna alla vista delle promozioni valide
const INDIETRO_PREDEFINITO = indietro("attivi");

const TITOLO_PREDEFINITO = "Promozione";

function Caricamento() {
  return (
    <Pagina titolo={TITOLO_PREDEFINITO} indietro={INDIETRO_PREDEFINITO}>
      <div role="status" aria-label="Caricamento della promozione" className="flex flex-col gap-6">
        <Skeleton className="h-80 rounded-2xl" />
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
 * vendita che raggiungono. Banda con le copertine, numeri, griglia canali × aree, dove arriva,
 * assortimento e confronto fra i kit; ogni kit apre i suoi insight. Solo materiali pubblicati della
 * GDO, dalle API di consultazione: niente stato di lavorazione né collegamenti alla produzione, e
 * nessun dato di vendita, previsione, calore o visibilità.
 */
function PromozioneVolantini() {
  const { idPromo = "" } = useParams();
  const navigate = useNavigate();
  const query = useDettaglioPromozioneVolantini(idPromo);
  // La scheda del punto vendita è delle pagine dei punti vendita, con il loro permesso
  const conScheda = usePermission(PERMISSIONS.GDO.VISUALIZZA);
  const dettaglio = query.data;
  const kit = dettaglio?.kit;
  const tinta = useMemo(() => tinteCanaliPromozione(kit ?? []), [kit]);

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

  return (
    <Pagina
      titolo={dettaglio.promo.nome}
      descrizione="I volantini pubblicati della promozione e i punti vendita che raggiungono."
      indietro={indietro(dettaglio.periodo)}
    >
      <Banda dettaglio={dettaglio} />
      <NumeriPromozione numeri={dettaglio.numeri} />
      <MatriceKit kit={dettaglio.kit} puntiVendita={dettaglio.puntiVendita} tinta={tinta} />
      <DoveArriva dettaglio={dettaglio} tinta={tinta} conScheda={conScheda} />
      <Assortimento assortimento={dettaglio.assortimento} numeroKit={dettaglio.kit.length} />
      <ConfrontoKit kit={dettaglio.kit} tinta={tinta} />
    </Pagina>
  );
}

export default withSessionCheck(PromozioneVolantini);
