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
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { usePromozioniVolantiniConsultazione } from "@/query/consultazione";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useId, useMemo } from "react";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type {
  PaginaPromozioniVolantiniConsultazione,
  PromozioneVolantiniConsultazione,
  RiepilogoPeriodoVolantiniConsultazione,
} from "../../../lib/consultazione/tipi";
import { DIMENSIONI_PAGINA_PROMOZIONI_VOLANTINI } from "../../../lib/materiali/tipi";
import CardPromozioneVolantini from "./CardPromozioneVolantini";
import { POSTI_COLLAGE } from "./collage";
import { meseDiInizio, plurale } from "./testi";
import VetrinaPromozione from "./VetrinaPromozione";

const PERIODO_VUOTO: Readonly<Record<PeriodoConsultazione, { titolo: string; descrizione: string }>> = {
  attivi: {
    titolo: "Nessun volantino pubblicato nelle promozioni valide",
    descrizione: "Le promozioni compaiono qui quando un loro kit volantino viene pubblicato.",
  },
  prossimi: {
    titolo: "Nessun volantino pubblicato nelle prossime promozioni",
    descrizione:
      "Le promozioni non ancora valide compaiono qui quando un loro kit volantino viene pubblicato. La lavorazione dei kit non si vede da questa pagina.",
  },
  storico: {
    titolo: "Nessun volantino nelle promozioni concluse",
    descrizione: "Le promozioni con volantini pubblicati compaiono qui quando vengono archiviate.",
  },
};

const DIMENSIONI_PAGINA = [...DIMENSIONI_PAGINA_PROMOZIONI_VOLANTINI];
const DIMENSIONE_PREDEFINITA = DIMENSIONI_PAGINA[0];

const PARAMETRI_FILTRO = ["cerca", "promo", "area", "canale", "anno"] as const;

/** Schede in colonne di almeno 17rem, quante ne stanno: due su tablet, tre o quattro su schermi larghi. */
const CLASSI_GRIGLIA = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4 sm:gap-5";

const SKELETON_SCURO = "dark:bg-darkmode-400 dark:from-darkmode-400 dark:via-darkmode-300 dark:to-darkmode-400";

/** Anno scritto nell'indirizzo, se è un anno plausibile. */
const annoDa = (valore: string | null): number | undefined => {
  const anno = Number(valore);
  return valore && Number.isInteger(anno) && anno >= 1900 && anno <= 2999 ? anno : undefined;
};

/** Schede segnaposto con la forma della scheda vera: scrivania con tre fogli, nome, periodo e numeri. */
function SchedeInCaricamento() {
  return (
    <ul aria-busy="true" aria-label="Caricamento delle promozioni" className={twMerge(CLASSI_GRIGLIA, "p-5")}>
      {Array.from({ length: 6 }, (_, indice) => (
        <li
          key={indice}
          className="overflow-hidden rounded-card border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-darkmode-700">
            {POSTI_COLLAGE[3].map(([x, y, rotazione]) => (
              <span
                key={x}
                className="absolute top-[10%] aspect-[5/7] h-[80%] overflow-hidden rounded-sm"
                style={{ left: `${x}%`, transform: `translateX(-50%) translateY(${y}%) rotate(${rotazione}deg)` }}
              >
                <Skeleton className={twMerge("h-full rounded-none", SKELETON_SCURO)} />
              </span>
            ))}
          </div>
          <div className="space-y-2 p-4">
            <Skeleton className={twMerge("h-3 w-1/3", SKELETON_SCURO)} />
            <Skeleton className={twMerge("h-6 w-2/3", SKELETON_SCURO)} />
            <Skeleton className={twMerge("h-3 w-1/2", SKELETON_SCURO)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "12 promozioni · 48 volantini · 1.234 punti vendita", del periodo senza filtri: punti vendita diversi. */
function RiepilogoPeriodo({ riepilogo }: { riepilogo: RiepilogoPeriodoVolantiniConsultazione }) {
  const voci: [numero: number, singolare: string, plurale: string][] = [
    [riepilogo.promozioni, "promozione", "promozioni"],
    [riepilogo.kit, "volantino", "volantini"],
  ];
  // 0: le liste dei punti vendita non sono arrivate, non che i volantini non ne abbiano
  if (riepilogo.puntiVendita > 0) {
    voci.push([riepilogo.puntiVendita, "punto vendita", "punti vendita"]);
  }
  return (
    <ul aria-label="Il periodo in numeri" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm tabular-nums">
      {voci.map(([numero, singolare, nomePlurale], indice) => (
        <li
          key={singolare}
          // Il separatore è un pallino disegnato, senza testo: le tecnologie assistive leggono solo i numeri
          className={twMerge(
            "inline-flex items-center",
            indice > 0 && "before:mr-2 before:h-1 before:w-1 before:rounded-full before:bg-current before:opacity-60 before:content-['']"
          )}
        >
          <span>
            <strong className="font-semibold text-slate-700 group-[.mode--light]:text-white dark:text-slate-200">
              {formatNumero(numero)}
            </strong>{" "}
            {numero === 1 ? singolare : nomePlurale}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Nome della promo filtrata con ?promo=: dalle opzioni, dai risultati, o un nome generico. */
const nomePromoFiltrata = (dati: PaginaPromozioniVolantiniConsultazione | undefined, idPromo: string): string =>
  dati?.opzioni.promozioni.find((promo) => promo.id === idPromo)?.nome ??
  dati?.promozioni.find((promozione) => promozione.promo.id === idPromo)?.promo.nome ??
  (dati?.vetrina?.promozione.promo.id === idPromo ? dati.vetrina.promozione.promo.nome : undefined) ??
  "Promozione selezionata";

/**
 * Promozioni dello Storico per mese di inizio della validità ("ottobre 2026"), nell'ordine del
 * server. Una mappa e non solo i vicini: se l'ordine non seguisse l'inizio, un mese non si ripete.
 */
const perMeseDiInizio = (promozioni: readonly PromozioneVolantiniConsultazione[]) => {
  const gruppi = new Map<string, { etichetta: string; promozioni: PromozioneVolantiniConsultazione[] }>();
  for (const promozione of promozioni) {
    const { chiave, etichetta } = meseDiInizio(promozione.promo.validitaDal);
    const gruppo = gruppi.get(chiave);
    if (gruppo) gruppo.promozioni.push(promozione);
    else gruppi.set(chiave, { etichetta, promozioni: [promozione] });
  }
  return [...gruppi].map(([chiave, gruppo]) => ({ chiave, ...gruppo }));
};

function ElencoSchede({
  promozioni,
  periodo,
  inAttesa,
}: {
  promozioni: readonly PromozioneVolantiniConsultazione[];
  periodo: PeriodoConsultazione;
  /** Arrivano le promozioni di un altro filtro o pagina: restano quelle di prima, attenuate. */
  inAttesa: boolean;
}) {
  const idMesi = useId();
  const classiAttesa = twMerge("p-5 transition-opacity", inAttesa && "opacity-60");

  if (periodo !== "storico") {
    return (
      <ul
        aria-label="Promozioni con volantini"
        aria-busy={inAttesa || undefined}
        className={twMerge(CLASSI_GRIGLIA, classiAttesa)}
      >
        {promozioni.map((promozione) => (
          <li key={promozione.promo.id}>
            <CardPromozioneVolantini promozione={promozione} periodo={periodo} />
          </li>
        ))}
      </ul>
    );
  }

  // Nello Storico, anni di promozioni: le schede della pagina si raggruppano per mese
  return (
    <div aria-busy={inAttesa || undefined} className={twMerge("flex flex-col gap-7", classiAttesa)}>
      {perMeseDiInizio(promozioni).map((gruppo) => {
        const idTitolo = `${idMesi}-${gruppo.chiave}`;
        return (
          <div key={gruppo.chiave}>
            <h3
              id={idTitolo}
              className="title-eyebrow mb-3 flex items-center gap-3 text-xs after:h-px after:flex-1 after:bg-slate-200 after:content-[''] dark:text-slate-400 dark:after:bg-darkmode-400"
            >
              {gruppo.etichetta}
            </h3>
            <ul aria-labelledby={idTitolo} className={CLASSI_GRIGLIA}>
              {gruppo.promozioni.map((promozione) => (
                <li key={promozione.promo.id}>
                  <CardPromozioneVolantini promozione={promozione} periodo={periodo} livelloTitolo={4} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export interface VolantiniPerPromozioneProps {
  periodo: PeriodoConsultazione;
  titolo: string;
  descrizione: string;
}

/**
 * Volantini pubblicati di un periodo, solo come promozioni: in testa la promozione in vetrina, poi
 * una scheda-collage per promozione, dalla più recente. Ogni scheda apre il dettaglio di
 * consultazione della promozione; nessuno stato di lavorazione, nessun collegamento alla
 * produzione. Si cerca, si filtra per area e canale (nello Storico anche per anno); la promozione
 * arriva solo dall'indirizzo (?promo=) e si vede come filtro removibile.
 */
function VolantiniPerPromozione({ periodo, titolo, descrizione }: VolantiniPerPromozioneProps) {
  const [parametri, aggiorna] = useParametriUrl();

  const idPromo = parametri.get("promo") ?? "";
  const idArea = parametri.get("area") ?? "";
  const idCanale = parametri.get("canale") ?? "";
  const cerca = parametri.get("cerca") ?? "";
  // L'anno filtra solo lo Storico: le promo attive e prossime sono quelle di adesso
  const conFiltroAnno = periodo === "storico";
  const anno = conFiltroAnno ? annoDa(parametri.get("anno")) : undefined;
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

  const query = usePromozioniVolantiniConsultazione({
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
  // La vetrina è del periodo senza filtri: con un filtro non si mostra, neppure mentre arrivano i dati filtrati
  const vetrina = conFiltri ? null : (dati?.vetrina ?? null);

  // Una pagina oltre l'ultima (indirizzo vecchio, promo archiviate nel frattempo) torna alla prima
  useEffect(() => {
    if (dati && !query.isPlaceholderData && dati.promozioni.length === 0 && dati.totale > 0 && pagina > 1) {
      aggiorna({ pagina: null });
    }
  }, [dati, query.isPlaceholderData, pagina, aggiorna]);

  const opzioniAnno = useMemo(() => {
    const anni = dati?.opzioni.anni ?? [];
    return anno !== undefined && !anni.includes(anno) ? [...anni, anno].sort((a, b) => b - a) : anni;
  }, [dati?.opzioni.anni, anno]);

  const conElenco = Boolean(dati && !query.isError && dati.totale > 0);

  const conteggio = (() => {
    if (!dati) return query.isError ? null : "Caricamento delle promozioni…";
    if (dati.totale === 0) {
      // Solo la promo in vetrina: non c'è un elenco da contare
      if (vetrina) return null;
      return conFiltri && dati.totaleSenzaFiltri > 0 ? "0 promozioni con i filtri attivi" : "0 promozioni";
    }
    const promozioni = plurale(dati.totale, "promozione", "promozioni");
    return conFiltri ? `${promozioni} con i filtri attivi` : promozioni;
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
      return <EmptyState compatta icon="Newspaper" title={vuoto.titolo} description={vuoto.descrizione} />;
    }
    if (dati.totale === 0) {
      // La vetrina è l'unica promozione del periodo: niente sezione vuota sotto
      if (vetrina) return null;
      return (
        <EmptyState
          compatta
          icon="SearchX"
          title="Nessuna promozione corrisponde ai filtri"
          description={
            conFiltroAnno
              ? "Prova a cambiare anno, area o canale, oppure azzera la ricerca."
              : "Prova a cambiare area o canale, oppure azzera la ricerca."
          }
          buttonText="Azzera filtri"
          buttonIcon="X"
          onButtonClick={azzeraFiltri}
        />
      );
    }
    return <ElencoSchede promozioni={dati.promozioni} periodo={periodo} inAttesa={query.isPlaceholderData} />;
  })();

  // Il riepilogo è del periodo senza filtri; con il periodo vuoto lo dice già lo stato vuoto.
  // Il ?. tiene in piedi la pagina con un server non ancora aggiornato al contratto
  const riepilogo = query.isError ? undefined : dati?.riepilogo;
  const intestazione = (
    <>
      <p>{descrizione}</p>
      {riepilogo && riepilogo.promozioni > 0 && <RiepilogoPeriodo riepilogo={riepilogo} />}
    </>
  );

  return (
    <Pagina titolo={titolo} descrizione={intestazione}>
      <Sezione senzaPadding aria-label="Volantini per promozione">
        {vetrina && (
          <div className="px-5 pt-5">
            <VetrinaPromozione vetrina={vetrina} periodo={periodo} />
          </div>
        )}

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
          {/* La promo arriva solo da un collegamento (?promo=), in ogni periodo: si vede e si toglie */}
          {idPromo && (
            <span className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-theme-1/10 py-1 pl-3 pr-1 text-xs text-theme-1 sm:self-auto dark:bg-indigo-300/15 dark:text-indigo-200">
              <span className="truncate">Promozione: {nomePromoFiltrata(dati, idPromo)}</span>
              <button
                type="button"
                aria-label="Togli il filtro sulla promozione"
                className="rounded-full p-0.5 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:bg-indigo-300/20"
                onClick={() => filtra("promo", "")}
              >
                <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </BarraFiltri>

        <div
          className={twMerge(
            "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5",
            (conElenco || conteggio) && "pt-5"
          )}
        >
          {conElenco && (
            <h2 className="title-section dark:text-slate-100">{vetrina ? "Le altre promozioni" : "Promozioni"}</h2>
          )}
          <p aria-live="polite" className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {conteggio}
          </p>
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
            className="border-t border-dashed border-slate-200 dark:border-darkmode-400"
          />
        )}
      </Sezione>
    </Pagina>
  );
}

export default VolantiniPerPromozione;
