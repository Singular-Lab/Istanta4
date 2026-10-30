import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { useFetchPromozioniVolantini } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { PROMOZIONI_DEL_PERIODO } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DIMENSIONI_PAGINA_PROMOZIONI_VOLANTINI,
  type PaginaPromozioniVolantini,
} from "../../../lib/materiali/tipi";
import CardPromozioneVolantini from "./CardPromozioneVolantini";

export type PeriodoPerPromozione = "attivi" | "storico";

const PERIODO_VUOTO: Readonly<Record<PeriodoPerPromozione, { titolo: string; descrizione: string }>> = {
  attivi: {
    titolo: "Nessun volantino pubblicato nelle promozioni valide",
    descrizione: "Le promozioni compaiono qui quando un loro kit volantino viene pubblicato.",
  },
  storico: {
    titolo: "Nessun volantino nelle promozioni concluse",
    descrizione: "Le promozioni con volantini pubblicati compaiono qui quando vengono archiviate.",
  },
};

const DIMENSIONI_PAGINA = [...DIMENSIONI_PAGINA_PROMOZIONI_VOLANTINI];
const DIMENSIONE_PREDEFINITA = DIMENSIONI_PAGINA[0];

const PARAMETRI_FILTRO = ["cerca", "promo", "area", "canale", "anno"] as const;

const plurale = (numero: number, singolare: string, plurale: string) =>
  `${formatNumero(numero)} ${numero === 1 ? singolare : plurale}`;

/** Anno scritto nell'indirizzo, se è un anno plausibile. */
const annoDa = (valore: string | null): number | undefined => {
  const anno = Number(valore);
  return valore && Number.isInteger(anno) && anno >= 1900 && anno <= 2999 ? anno : undefined;
};

function SchedeInCaricamento() {
  return (
    <ul aria-busy="true" aria-label="Caricamento delle promozioni" className="grid grid-cols-1 gap-3 p-5 xl:grid-cols-2">
      {Array.from({ length: 4 }, (_, indice) => (
        <li key={indice} className="rounded-card border border-slate-200 bg-white p-4">
          <div className="flex gap-4">
            <Skeleton className="h-24 w-20 flex-none rounded-control" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Nome della promo filtrata con ?promo=: dalle tendine, dai risultati, o un nome generico. */
const nomePromoFiltrata = (dati: PaginaPromozioniVolantini | undefined, idPromo: string): string =>
  dati?.opzioni.promozioni.find((promo) => promo.id === idPromo)?.nome ??
  dati?.promozioni.find((promozione) => promozione.promo.id === idPromo)?.promo.nome ??
  "Promozione selezionata";

/**
 * Volantini di Attivi e Storico: una card per promozione, dalla più recente, con i kit pubblicati
 * come varianti. Nello Storico, con anni di promozioni, si cerca per nome e si filtra per anno.
 */
function VolantiniPerPromozione({ periodo }: { periodo: PeriodoPerPromozione }) {
  const navigate = useNavigate();
  const puoAprirePromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
  const [parametri, aggiorna] = useParametriUrl();

  const idPromo = parametri.get("promo") ?? "";
  const idArea = parametri.get("area") ?? "";
  const idCanale = parametri.get("canale") ?? "";
  const cerca = parametri.get("cerca") ?? "";
  // L'anno filtra solo lo Storico: le promo attive sono quelle valide adesso
  const conFiltroAnno = periodo === "storico";
  const anno = conFiltroAnno ? annoDa(parametri.get("anno")) : undefined;
  // Le promo attive sono poche e si scelgono da una tendina; nello Storico si cercano
  const conTendinaPromo = periodo === "attivi";
  const pagina = Math.max(1, Math.trunc(Number(parametri.get("pagina"))) || 1);
  const dimensioneLetta = Number(parametri.get("dimensione"));
  const dimensione = DIMENSIONI_PAGINA.includes(dimensioneLetta) ? dimensioneLetta : DIMENSIONE_PREDEFINITA;

  const conFiltri = Boolean(cerca || idPromo || idArea || idCanale || anno);

  // Ogni filtro nuovo riparte dalla prima pagina
  const filtra = (chiave: (typeof PARAMETRI_FILTRO)[number], valore: string) => aggiorna({ [chiave]: valore, pagina: null });
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(cerca, (testo) => filtra("cerca", testo));

  const azzeraFiltri = () => {
    setTestoRicerca("");
    aggiorna({ ...Object.fromEntries(PARAMETRI_FILTRO.map((chiave) => [chiave, null])), pagina: null });
  };

  const query = useFetchPromozioniVolantini({
    periodo,
    cerca: cerca || undefined,
    idPromo: idPromo || undefined,
    idArea: idArea || undefined,
    idCanale: idCanale || undefined,
    anno,
    pagina,
    dimensione,
  });
  const dati = query.data;

  // Una pagina oltre l'ultima (indirizzo vecchio, promo archiviate nel frattempo) torna alla prima
  useEffect(() => {
    if (dati && !query.isPlaceholderData && dati.promozioni.length === 0 && dati.totale > 0 && pagina > 1) {
      aggiorna({ pagina: null });
    }
  }, [dati, query.isPlaceholderData, pagina, aggiorna]);

  const opzioniPromo = useMemo(() => {
    const promozioni = dati?.opzioni.promozioni ?? [];
    // Una promo arrivata dal link ?promo= ma senza volantini nel periodo resta selezionabile e visibile
    return idPromo && !promozioni.some((promo) => promo.id === idPromo)
      ? [...promozioni, { id: idPromo, nome: "Promozione selezionata" }]
      : promozioni;
  }, [dati?.opzioni.promozioni, idPromo]);

  const opzioniAnno = useMemo(() => {
    const anni = dati?.opzioni.anni ?? [];
    return anno !== undefined && !anni.includes(anno) ? [...anni, anno].sort((a, b) => b - a) : anni;
  }, [dati?.opzioni.anni, anno]);

  const promozioniDelPeriodo = PROMOZIONI_DEL_PERIODO[periodo];

  const conteggio = (() => {
    if (!dati) return query.isError ? null : "Caricamento delle promozioni…";
    if (dati.totale === 0) {
      return conFiltri && dati.totaleSenzaFiltri > 0 ? "0 promozioni con i filtri attivi" : "0 promozioni";
    }
    return `${plurale(dati.totale, "promozione", "promozioni")} · ${plurale(dati.totaleKit, "kit", "kit")}`;
  })();

  const contenuto = (() => {
    if (query.isError) {
      return (
        <div className="p-5">
          <PageError
            compatta
            titolo="Volantini non caricati"
            motivo={query.error?.message || "Il servizio non ha restituito i volantini."}
            onRiprova={() => query.refetch()}
          />
        </div>
      );
    }
    if (!dati) return <SchedeInCaricamento />;
    if (dati.totaleSenzaFiltri === 0) {
      const vuoto = PERIODO_VUOTO[periodo];
      return (
        <EmptyState
          compatta
          icon="Newspaper"
          title={vuoto.titolo}
          description={vuoto.descrizione}
          buttonText={puoAprirePromo ? promozioniDelPeriodo.etichetta : undefined}
          buttonIcon="ArrowRight"
          onButtonClick={() => navigate(promozioniDelPeriodo.percorso)}
        />
      );
    }
    if (dati.totale === 0) {
      return (
        <EmptyState
          compatta
          icon="SearchX"
          title="Nessuna promozione corrisponde ai filtri"
          description={
            conFiltroAnno
              ? "Prova a cambiare anno, area o canale, oppure azzera la ricerca."
              : "Prova a cambiare promozione, area o canale, oppure azzera la ricerca."
          }
          buttonText="Azzera filtri"
          buttonIcon="X"
          onButtonClick={azzeraFiltri}
        />
      );
    }
    return (
      <ul
        aria-label="Promozioni con volantini"
        aria-busy={query.isPlaceholderData || undefined}
        className={twMerge(
          "grid grid-cols-1 gap-3 p-5 transition-opacity xl:grid-cols-2",
          query.isPlaceholderData && "opacity-60"
        )}
      >
        {dati.promozioni.map((promozione) => (
          <li key={promozione.promo.id}>
            <CardPromozioneVolantini
              className="h-full"
              promozione={promozione}
              conScadenza={periodo === "attivi"}
              conCollegamenti={puoAprirePromo}
            />
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <Sezione senzaPadding aria-label="Volantini per promozione">
      <BarraFiltri
        destra={
          conFiltri ? (
            <Button type="button" variant="outline-secondary" size="sm" onClick={azzeraFiltri}>
              <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Azzera filtri
            </Button>
          ) : undefined
        }
      >
        <CampoRicerca
          etichetta="Cerca"
          placeholder="Nome promozione o kit…"
          value={testoRicerca}
          onChange={setTestoRicerca}
        />
        {conTendinaPromo && (
          <FormSelect
            formSelectSize="sm"
            aria-label="Promozione"
            className="sm:w-52"
            value={idPromo}
            onChange={(evento) => filtra("promo", evento.target.value)}
          >
            <option value="">Tutte le promozioni</option>
            {opzioniPromo.map((promo) => (
              <option key={promo.id} value={promo.id}>
                {promo.nome}
              </option>
            ))}
          </FormSelect>
        )}
        {conFiltroAnno && (
          <FormSelect
            formSelectSize="sm"
            aria-label="Anno"
            className="sm:w-32"
            value={anno === undefined ? "" : String(anno)}
            onChange={(evento) => filtra("anno", evento.target.value)}
          >
            <option value="">Tutti gli anni</option>
            {opzioniAnno.map((valore) => (
              <option key={valore} value={valore}>
                {valore}
              </option>
            ))}
          </FormSelect>
        )}
        <FormSelect
          formSelectSize="sm"
          aria-label="Area"
          className="sm:w-40"
          value={idArea}
          onChange={(evento) => filtra("area", evento.target.value)}
        >
          <option value="">Tutte le aree</option>
          {dati?.opzioni.aree.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          formSelectSize="sm"
          aria-label="Canale"
          className="sm:w-40"
          value={idCanale}
          onChange={(evento) => filtra("canale", evento.target.value)}
        >
          <option value="">Tutti i canali</option>
          {dati?.opzioni.canali.map((canale) => (
            <option key={canale.id} value={canale.id}>
              {canale.nome}
            </option>
          ))}
        </FormSelect>
        {/* Nello Storico la promo arriva solo dal link ?promo= del suo dettaglio: si vede e si toglie */}
        {!conTendinaPromo && idPromo && (
          <span className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-theme-1/10 py-1 pl-3 pr-1 text-xs text-theme-1 sm:self-auto">
            <span className="truncate">Promozione: {nomePromoFiltrata(dati, idPromo)}</span>
            <button
              type="button"
              aria-label="Togli il filtro sulla promozione"
              className="rounded-full p-0.5 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
              onClick={() => filtra("promo", "")}
            >
              <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </BarraFiltri>

      <p aria-live="polite" className="px-5 pt-4 text-sm tabular-nums text-slate-500">
        {conteggio}
      </p>

      {contenuto}

      {dati && !query.isError && (
        <PaginazioneTabella
          totale={dati.totale}
          pagina={pagina}
          dimensionePagina={dimensione}
          onCambiaPagina={(nuova) => aggiorna({ pagina: nuova === 1 ? null : nuova })}
          onCambiaDimensione={(nuova) =>
            aggiorna({ dimensione: nuova === DIMENSIONE_PREDEFINITA ? null : nuova, pagina: null })
          }
          opzioniDimensione={DIMENSIONI_PAGINA}
          className="border-t border-dashed border-slate-200"
        />
      )}
    </Sezione>
  );
}

export default VolantiniPerPromozione;
