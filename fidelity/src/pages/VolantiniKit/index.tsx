import Alert from "@/components/Base/Alert";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { descriviStato } from "@/constants/stati";
import { usePermission } from "@/context/PermissionContext";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { useFetchKitVolantini } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { PROMOZIONI_DEL_PERIODO, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useMemo } from "react";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import {
  ETICHETTA_PERIODO,
  isPeriodoMateriali,
  percorsoKit,
  percorsoPop,
  percorsoPromo,
  type PeriodoMateriali,
} from "../../../lib/materiali/periodi";
import {
  STATI_KIT_MATERIALI,
  type AvvisoNonAvviati,
  type PaginaKitVolantini,
  type SchedaKitVolantino,
  type StatoKitMateriali,
} from "../../../lib/materiali/tipi";
import CardVolantino from "../shared/CardVolantino";

export interface VolantiniKitLoaderData {
  periodo: PeriodoMateriali;
}

const DESCRIZIONE: Readonly<Record<PeriodoMateriali, string>> = {
  "in-corso": "Kit volantino in lavorazione nelle promozioni in corso. Il dettaglio e la lavorazione sono quelli di ogni kit.",
  attivi: "Kit volantino pubblicati nelle promozioni ancora valide. Il dettaglio e la lavorazione sono quelli di ogni kit.",
  storico: "Kit volantino pubblicati nelle promozioni concluse. Il dettaglio e la lavorazione sono quelli di ogni kit.",
};

const PERIODO_VUOTO: Readonly<Record<PeriodoMateriali, { titolo: string; descrizione: string }>> = {
  "in-corso": {
    titolo: "Nessun kit volantino in lavorazione",
    descrizione:
      "I kit compaiono qui quando una promozione in corso ne crea almeno uno. Puoi crearli dal dettaglio della promozione.",
  },
  attivi: {
    titolo: "Nessun kit volantino pubblicato nelle promozioni valide",
    descrizione: "I kit compaiono qui quando vengono pubblicati in una promozione ancora valida.",
  },
  storico: {
    titolo: "Nessun kit volantino nelle promozioni concluse",
    descrizione: "I kit pubblicati compaiono qui quando la loro promozione viene archiviata.",
  },
};

// Le card sono alte: poche per pagina, multipli di 2 e 3 per riempire le righe della griglia
const DIMENSIONI_PAGINA = [12, 24, 48, 96];
const DIMENSIONE_PREDEFINITA = 24;

const PARAMETRI_FILTRO = ["cerca", "promo", "area", "canale", "stato"] as const;

const plurale = (numero: number, singolare: string, plurale: string) =>
  `${formatNumero(numero)} ${numero === 1 ? singolare : plurale}`;

const isStatoKit = (valore: string): valore is StatoKitMateriali =>
  (STATI_KIT_MATERIALI as readonly string[]).includes(valore);

/** Kit di una pagina come chiave stabile: i non avviati non hanno id del runtime. */
const chiaveKit = (kit: SchedaKitVolantino, indice: number) =>
  kit.id ?? `${kit.promo.id}-${kit.idDesign ?? indice}-${kit.area.id}-${kit.canale.id}`;

/**
 * Promozioni dei kit trovati, quando si possono contare davvero: con il filtro sulla promo è una,
 * con tutti i kit in una pagina si contano, senza filtri sono quelle del periodo. Altrimenti il
 * server non lo dice e il conteggio non si mostra.
 */
const contaPromozioni = (dati: PaginaKitVolantini, conFiltri: boolean, conFiltroPromo: boolean): number | null => {
  if (dati.totale === 0) return 0;
  if (conFiltroPromo) return 1;
  if (dati.kit.length >= dati.totale) return new Set(dati.kit.map((kit) => kit.promo.id)).size;
  if (!conFiltri) return dati.opzioni.promozioni.length;
  return null;
};

function AvvisiNonAvviati({ avvisi }: { avvisi: AvvisoNonAvviati[] }) {
  if (avvisi.length === 0) return null;
  return (
    <Alert variant="soft-warning" icona="TriangleAlert" titolo="Elenco incompleto">
      <ul className="space-y-0.5 text-sm">
        {avvisi.map((avviso) => (
          <li key={avviso.promo.id}>
            I kit non ancora avviati di <span className="font-medium">{avviso.promo.nome}</span> non sono
            disponibili: {avviso.motivo}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function SchedeInCaricamento() {
  return (
    <ul aria-busy="true" aria-label="Caricamento dei kit" className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, indice) => (
        <li key={indice} className="flex gap-4 rounded-card border border-slate-200 bg-white p-4">
          <Skeleton className="h-24 w-20 flex-none rounded-control" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ContenutoVolantini({ periodo }: { periodo: PeriodoMateriali }) {
  const navigate = useNavigate();
  const puoAprirePromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
  const [parametri, aggiorna] = useParametriUrl();

  const idPromo = parametri.get("promo") ?? "";
  const idArea = parametri.get("area") ?? "";
  const idCanale = parametri.get("canale") ?? "";
  const cerca = parametri.get("cerca") ?? "";
  // Il filtro per stato c'è solo In corso: negli altri periodi i kit sono tutti pubblicati
  const conFiltroStato = periodo === "in-corso";
  const statoLetto = parametri.get("stato") ?? "";
  const stato = conFiltroStato && isStatoKit(statoLetto) ? statoLetto : undefined;
  const pagina = Math.max(1, Math.trunc(Number(parametri.get("pagina"))) || 1);
  const dimensioneLetta = Number(parametri.get("dimensione"));
  const dimensione = DIMENSIONI_PAGINA.includes(dimensioneLetta) ? dimensioneLetta : DIMENSIONE_PREDEFINITA;

  const conFiltri = Boolean(cerca || idPromo || idArea || idCanale || stato);

  // Ogni filtro nuovo riparte dalla prima pagina
  const filtra = (chiave: (typeof PARAMETRI_FILTRO)[number], valore: string) => aggiorna({ [chiave]: valore, pagina: null });
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(cerca, (testo) => filtra("cerca", testo));

  const azzeraFiltri = () => {
    setTestoRicerca("");
    aggiorna({ ...Object.fromEntries(PARAMETRI_FILTRO.map((chiave) => [chiave, null])), pagina: null });
  };

  const query = useFetchKitVolantini({
    periodo,
    cerca: cerca || undefined,
    idPromo: idPromo || undefined,
    idArea: idArea || undefined,
    idCanale: idCanale || undefined,
    stato,
    pagina,
    dimensione,
  });
  const dati = query.data;

  // Una pagina oltre l'ultima (indirizzo vecchio, kit spariti nel frattempo) torna alla prima
  useEffect(() => {
    if (dati && !query.isPlaceholderData && dati.kit.length === 0 && dati.totale > 0 && pagina > 1) {
      aggiorna({ pagina: null });
    }
  }, [dati, query.isPlaceholderData, pagina, aggiorna]);

  const opzioniPromo = useMemo(() => {
    const promozioni = dati?.opzioni.promozioni ?? [];
    // Una promo arrivata dal link ?promo= ma senza kit nel periodo resta selezionabile e visibile
    return idPromo && !promozioni.some((promo) => promo.id === idPromo)
      ? [...promozioni, { id: idPromo, nome: "Promozione selezionata" }]
      : promozioni;
  }, [dati?.opzioni.promozioni, idPromo]);

  const etichettaPeriodo = ETICHETTA_PERIODO[periodo];
  const promozioniDelPeriodo = PROMOZIONI_DEL_PERIODO[periodo];
  const numeroPromozioni = dati ? contaPromozioni(dati, conFiltri, Boolean(idPromo)) : null;

  const conteggio = (() => {
    if (!dati) return query.isError ? null : "Caricamento dei kit…";
    if (dati.totale === 0) return conFiltri && dati.totaleSenzaFiltri > 0 ? "0 kit con i filtri attivi" : "0 kit";
    const kit = plurale(dati.totale, "kit", "kit");
    return numeroPromozioni === null ? kit : `${kit} · ${plurale(numeroPromozioni, "promozione", "promozioni")}`;
  })();

  const contenuto = (() => {
    if (query.isError) {
      return (
        <div className="p-5">
          <PageError
            compatta
            titolo="Kit non caricati"
            motivo={query.error?.message || "Il servizio non ha restituito i kit volantino."}
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
          title="Nessun kit corrisponde ai filtri"
          description="Prova a cambiare promozione, area o canale, oppure azzera la ricerca."
          buttonText="Azzera filtri"
          buttonIcon="X"
          onButtonClick={azzeraFiltri}
        />
      );
    }
    return (
      <ul
        aria-label="Kit volantino"
        aria-busy={query.isPlaceholderData || undefined}
        className={twMerge(
          "grid grid-cols-1 gap-3 p-5 transition-opacity lg:grid-cols-2 2xl:grid-cols-3",
          query.isPlaceholderData && "opacity-60"
        )}
      >
        {dati.kit.map((kit, indice) => (
          <li key={chiaveKit(kit, indice)}>
            <CardVolantino
              className="h-full"
              titolo={kit.titolo}
              stato={kit.stato}
              nomeArea={kit.area.nome}
              nomeCanale={kit.canale.nome}
              numeroFile={kit.numeroFile}
              file={
                kit.copertina
                  ? {
                      nome: kit.copertina.nome,
                      anteprima: urlAnteprimaMateriale(kit.copertina.idOlimpoCloud),
                      idOlimpoCloud: kit.copertina.idOlimpoCloud,
                      mime: kit.copertina.mime ?? undefined,
                      pagine: kit.copertina.pagine ?? undefined,
                    }
                  : undefined
              }
              validitaDal={kit.promo.validitaDal ?? undefined}
              validitaAl={kit.promo.validitaAl ?? undefined}
              // Un kit non avviato non ha scheda: si apre dai kit della promo
              collegamento={puoAprirePromo ? percorsoKit(kit.promo.id, kit.promo.stato, kit.id) : undefined}
              promo={{
                nome: kit.promo.nome,
                collegamento: puoAprirePromo ? percorsoPromo(kit.promo.id, kit.promo.stato) : undefined,
              }}
            />
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <Pagina titolo={`Volantini · ${etichettaPeriodo}`} descrizione={DESCRIZIONE[periodo]}>
      {dati && <AvvisiNonAvviati avvisi={dati.avvisi} />}

      <Sezione senzaPadding aria-label="Kit volantino">
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
            placeholder="Nome kit o promozione…"
            value={testoRicerca}
            onChange={setTestoRicerca}
          />
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
          {conFiltroStato && (
            <FormSelect
              formSelectSize="sm"
              aria-label="Stato"
              className="sm:w-48"
              value={stato ?? ""}
              onChange={(evento) => filtra("stato", evento.target.value)}
            >
              <option value="">Tutti gli stati</option>
              {STATI_KIT_MATERIALI.map((valore) => (
                <option key={valore} value={valore}>
                  {descriviStato("kitRuntime", valore).etichetta}
                </option>
              ))}
            </FormSelect>
          )}
        </BarraFiltri>

        <div className="flex flex-col gap-2 px-5 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="tabular-nums text-slate-500">
            {conteggio}
          </p>
          <Link
            to={percorsoPop(periodo, idPromo || undefined)}
            className="inline-flex items-center gap-1 font-medium text-theme-1 hover:underline"
          >
            Vai a POP · {etichettaPeriodo.toLowerCase()}
            <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>

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
    </Pagina>
  );
}

/** Kit volantino di un periodo (in corso, attivi, storico): il periodo arriva dal loader della rotta. */
function VolantiniKit() {
  const letto = (useLoaderData() as Partial<VolantiniKitLoaderData> | undefined)?.periodo;
  const periodo = isPeriodoMateriali(letto) ? letto : "in-corso";
  // Cambiando periodo la pagina riparte da zero: stesso componente, rotte diverse
  return <ContenutoVolantini key={periodo} periodo={periodo} />;
}

export default withSessionCheck(VolantiniKit);
