import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import { SegnoLegenda } from "@/components/Grafici";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { normalizzaRicerca, ripartizionePagina } from "./analisiPagina";
import { marcaFormato } from "./box";
import type { GruppoBox } from "./colori";
import {
  alternaValore,
  condizioniDisponibili,
  conIntervallo,
  elencoCondizioniAttive,
  INTERROGAZIONE_VUOTA,
  intervalliDisponibili,
  OPZIONI_ORDINE,
  ordinaRisultati,
  sintesiRisultati,
  togliIntervallo,
  togliScelta,
  type Condizione,
  type CondizioneAttiva,
  type Interrogazione,
  type IntervalloDisponibile,
  type OrdineRisultati,
} from "./interrogazione";

export interface InterrogaVolantinoProps {
  /** Tutti i box del volantino. */
  box: readonly BoxInsight[];
  /** I box già ristretti dalla ricerca (tutti senza ricerca): i conteggi delle condizioni vengono da qui. */
  base: readonly BoxInsight[];
  interrogazione: Interrogazione;
  onCambia: (interrogazione: Interrogazione) => void;
  /** I box trovati da ricerca e condizioni insieme; null: nessuna ricerca né condizione. */
  risultati: readonly BoxInsight[] | null;
  /** Reparto e meccanica di un box, con le tinte dei riquadri: per la ripartizione dei risultati. */
  perReparto: (box: BoxInsight) => GruppoBox;
  perMeccanica: (box: BoxInsight) => GruppoBox;
  /** Il gruppo secondo "Colora per": il segno colorato di ogni risultato. */
  gruppo: (box: BoxInsight) => GruppoBox;
  selezionato: string | null;
  onRilievo: (id: string | null) => void;
  onApri: (box: BoxInsight) => void;
}

/** Oltre questi valori una condizione offre il campo per filtrarli. */
const VALORI_CON_FILTRO = 8;
/** I risultati mostrati subito: gli altri con "Mostra tutti". */
const RISULTATI_SUBITO = 60;
/** I gruppi della ripartizione dei risultati mostrati per reparto e per meccanica. */
const GRUPPI_RIPARTIZIONE = 6;

const percento = (valore: number | null): string => (valore === null ? VALORE_ASSENTE : formatPercentuale(Math.round(valore)));
const euro = (valore: number | null): string => (valore === null ? VALORE_ASSENTE : formatEuro(valore));

/** Un numero scritto all'italiana ("1,5") o vuoto; undefined se non si legge. */
const numeroScritto = (testo: string): number | null | undefined => {
  const pulito = testo.trim().replace(/\s/g, "").replace(",", ".");
  if (pulito === "") return null;
  const valore = Number(pulito);
  return Number.isFinite(valore) ? valore : undefined;
};
const testoNumero = (valore: number | null): string => (valore === null ? "" : String(valore).replace(".", ","));

/** Un limite di un intervallo: si scrive come testo, vale quando si legge un numero o è vuoto. */
function CampoLimite({ etichetta, valore, segnaposto, onValore }: { etichetta: string; valore: number | null; segnaposto: string; onValore: (valore: number | null) => void }) {
  const [testo, setTesto] = useState(testoNumero(valore));
  // Il limite cambiato da fuori (tolto, scambiato con l'altro) si riscrive nel campo
  const [ultimo, setUltimo] = useState(valore);
  if (valore !== ultimo) {
    setUltimo(valore);
    if (numeroScritto(testo) !== valore) setTesto(testoNumero(valore));
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={etichetta}
      placeholder={segnaposto}
      value={testo}
      onChange={evento => {
        setTesto(evento.target.value);
        const letto = numeroScritto(evento.target.value);
        if (letto !== undefined) onValore(letto);
      }}
      className="h-8 w-full min-w-0 rounded-control border border-slate-200 bg-white px-2 text-xs tabular-nums text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-100"
    />
  );
}

const formatoLimite = (intervallo: Pick<IntervalloDisponibile, "unita">, valore: number): string =>
  intervallo.unita === "€" ? formatEuro(valore) : intervallo.unita ? `${formatNumero(Math.round(valore))}%` : formatNumero(valore);

/** Testo di una condizione attiva: "Reparto: Carni, Ortofrutta", "Sconto: da 30% a 50%". */
export const testoCondizione = (condizione: CondizioneAttiva): string => {
  if (condizione.tipo === "scelta") return `${condizione.etichetta}: ${condizione.valori.join(", ")}`;
  const { da, a } = condizione.intervallo;
  const parti = [da !== null ? `da ${formatoLimite(condizione, da)}` : null, a !== null ? `a ${formatoLimite(condizione, a)}` : null].filter(Boolean);
  return `${condizione.etichetta}: ${parti.join(" ")}`;
};

/** Una condizione a scelta: i valori presenti nel volantino, con quanti box ha ciascuno. */
function SceltaValori({ condizione, onAlterna }: { condizione: Condizione; onAlterna: (chiave: string) => void }) {
  const [filtro, setFiltro] = useState("");
  const scelti = condizione.valori.filter(valore => valore.scelto).length;
  const cercato = normalizzaRicerca(filtro);
  const visibili = cercato ? condizione.valori.filter(valore => valore.scelto || normalizzaRicerca(valore.etichetta).includes(cercato)) : condizione.valori;

  return (
    <details data-testid={`condizione-${condizione.id}`} className="group/condizione border-b border-slate-100 py-1.5 last:border-b-0 dark:border-darkmode-400">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-control px-1 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-darkmode-600 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <Lucide icon="ChevronRight" aria-hidden="true" className="h-3.5 w-3.5 text-slate-400 transition-transform group-open/condizione:rotate-90" />
          {condizione.etichetta}
        </span>
        {scelti > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-3xs font-semibold tabular-nums text-white dark:bg-indigo-400 dark:text-darkmode-800">{formatNumero(scelti)}</span>
        )}
      </summary>
      <div className="flex flex-col gap-1.5 px-1 pb-1 pt-1.5">
        {condizione.valori.length > VALORI_CON_FILTRO && (
          <CampoRicerca etichetta={`Filtra ${condizione.etichetta.toLocaleLowerCase("it")}`} placeholder="Filtra i valori…" value={filtro} onChange={setFiltro} className="w-full" />
        )}
        <ul role="group" aria-label={condizione.etichetta} className="flex max-h-56 flex-col overflow-y-auto overscroll-contain">
          {visibili.map(valore => {
            const vuoto = valore.box === 0 && !valore.scelto;
            return (
              <li key={valore.chiave}>
                <label
                  className={twMerge(
                    "flex cursor-pointer items-center gap-2 rounded-control px-1.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-darkmode-600",
                    vuoto && "cursor-default opacity-45 hover:bg-transparent"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={valore.scelto}
                    disabled={vuoto}
                    onChange={() => onAlterna(valore.chiave)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/30 dark:border-darkmode-400 dark:bg-darkmode-800"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={valore.etichetta}>
                    {valore.etichetta}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">{formatNumero(valore.box)}</span>
                </label>
              </li>
            );
          })}
          {visibili.length === 0 && <li className="px-1.5 py-1 text-xs text-slate-500 dark:text-slate-400">Nessun valore per «{filtro.trim()}»</li>}
        </ul>
      </div>
    </details>
  );
}

/** Prezzo, sconto, spazio, pagine e prodotti del box: da e a, con il minimo e il massimo del volantino. */
function Intervalli({ intervalli, interrogazione, onCambia }: { intervalli: readonly IntervalloDisponibile[]; interrogazione: Interrogazione; onCambia: (interrogazione: Interrogazione) => void }) {
  if (intervalli.length === 0) return null;
  const attivi = intervalli.filter(intervallo => {
    const valore = interrogazione.intervalli[intervallo.id];
    return valore !== undefined && (valore.da !== null || valore.a !== null);
  }).length;
  return (
    <details data-testid="condizione-intervalli" className="group/condizione border-b border-slate-100 py-1.5 dark:border-darkmode-400">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-control px-1 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-darkmode-600 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <Lucide icon="ChevronRight" aria-hidden="true" className="h-3.5 w-3.5 text-slate-400 transition-transform group-open/condizione:rotate-90" />
          Prezzo, sconto e spazio
        </span>
        {attivi > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-3xs font-semibold tabular-nums text-white dark:bg-indigo-400 dark:text-darkmode-800">{formatNumero(attivi)}</span>
        )}
      </summary>
      <div className="flex flex-col gap-2.5 px-1 pb-1 pt-2">
        {intervalli.map(intervallo => {
          const valore = interrogazione.intervalli[intervallo.id] ?? { da: null, a: null };
          const unita = intervallo.unita ? ` (${intervallo.unita})` : "";
          return (
            <div key={intervallo.id} role="group" aria-label={intervallo.etichetta} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
              <span className="truncate text-xs text-slate-600 dark:text-slate-300" title={`${intervallo.etichetta}${unita}`}>
                {intervallo.etichetta}
                {intervallo.unita && <span className="text-3xs text-slate-400"> {intervallo.unita === "% della pagina" ? "%" : intervallo.unita}</span>}
              </span>
              <CampoLimite
                etichetta={`${intervallo.etichetta} da`}
                valore={valore.da}
                segnaposto={`da ${formatNumero(intervallo.minimo)}`}
                onValore={da => onCambia(conIntervallo(interrogazione, intervallo.id, { ...valore, da }))}
              />
              <CampoLimite
                etichetta={`${intervallo.etichetta} a`}
                valore={valore.a}
                segnaposto={`a ${formatNumero(intervallo.massimo)}`}
                onValore={a => onCambia(conIntervallo(interrogazione, intervallo.id, { ...valore, a }))}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Numero({ etichetta, valore, titolo }: { etichetta: string; valore: string; titolo?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={titolo}>
      <dt className="truncate text-3xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{etichetta}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{valore}</dd>
    </div>
  );
}

/** I gruppi dei risultati per reparto o per meccanica: quanti box ciascuno, dal più numeroso. */
function Ripartizione({ titolo, risultati, gruppo }: { titolo: string; risultati: readonly BoxInsight[]; gruppo: (box: BoxInsight) => GruppoBox }) {
  const gruppi = useMemo(() => [...ripartizionePagina(risultati, gruppo)].sort((a, b) => b.box - a.box || a.etichetta.localeCompare(b.etichetta, "it")), [risultati, gruppo]);
  if (gruppi.length === 0) return null;
  const massimo = Math.max(...gruppi.map(voce => voce.box));
  const mostrati = gruppi.slice(0, GRUPPI_RIPARTIZIONE);
  const altri = gruppi.length - mostrati.length;
  return (
    <section aria-label={titolo} className="flex flex-col gap-1.5">
      <h5 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titolo}</h5>
      <ul className="flex flex-col gap-1">
        {mostrati.map(voce => (
          <li key={voce.id} data-testid={`risultati-${voce.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_4rem_auto] items-center gap-2 text-xs">
            <SegnoLegenda forma="quadrato" tinta={voce.tinta} />
            <span className="truncate text-slate-700 dark:text-slate-200" title={voce.etichetta}>
              {voce.etichetta}
            </span>
            {/* Le tinte sono classi fill-* o colori per SVG, come nel resto dei grafici */}
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full">
              <rect width="100" height="4" className="fill-slate-100 dark:fill-darkmode-500" />
              <rect width={(voce.box / massimo) * 100} height="4" fill={voce.tinta.colore} className={voce.tinta.classe} />
            </svg>
            <span className="text-right tabular-nums text-slate-600 dark:text-slate-300">{formatNumero(voce.box)}</span>
          </li>
        ))}
      </ul>
      {altri > 0 && <p className="text-3xs text-slate-500 dark:text-slate-400">e altri {formatNumero(altri)}</p>}
    </section>
  );
}

/**
 * L'interrogazione dei box del volantino: si combinano condizioni su reparto, settore, segmento,
 * tema, ruolo, marca, linea, bolli, meccanica, sottocosto, punti, EAN e origine, e intervalli su
 * prezzo, sconto, spazio, pagine e prodotti del box, insieme alla ricerca. Accanto a ogni valore
 * quanti box lo hanno con le altre condizioni. I box trovati sono evidenziati sulle pagine (lo fa il
 * lettore); qui la sintesi dei risultati e l'elenco, da cui si apre la pagina e la scheda del box.
 * Niente vendite, previsioni, calore o visibilità stimata.
 */
export function InterrogaVolantino({
  box,
  base,
  interrogazione,
  onCambia,
  risultati,
  perReparto,
  perMeccanica,
  gruppo,
  selezionato,
  onRilievo,
  onApri,
}: InterrogaVolantinoProps) {
  const [ordine, setOrdine] = useState<OrdineRisultati>("pagina");
  const [tutti, setTutti] = useState(false);
  const condizioni = useMemo(() => condizioniDisponibili(box, base, interrogazione), [box, base, interrogazione]);
  const intervalli = useMemo(() => intervalliDisponibili(box), [box]);
  const attive = elencoCondizioniAttive(interrogazione, condizioni);
  const sintesi = useMemo(() => (risultati ? sintesiRisultati(risultati, box) : null), [risultati, box]);
  const ordinati = useMemo(() => (risultati ? ordinaRisultati(risultati, ordine) : []), [risultati, ordine]);
  const mostrati = tutti ? ordinati : ordinati.slice(0, RISULTATI_SUBITO);

  const togli = (condizione: CondizioneAttiva) =>
    onCambia(condizione.tipo === "scelta" ? togliScelta(interrogazione, condizione.id) : togliIntervallo(interrogazione, condizione.id));

  const tastoRiga = (evento: KeyboardEvent<HTMLButtonElement>) => {
    if (evento.key === "Escape") onRilievo(null);
  };

  return (
    <div data-testid="interroga-volantino" className="flex flex-col gap-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Combina le condizioni: i valori della stessa condizione valgono in alternativa, condizioni diverse tutte insieme, anche con la ricerca.
      </p>

      {attive.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Condizioni attive" role="list">
          {attive.map(condizione => (
            <span
              key={`${condizione.tipo}-${condizione.id}`}
              role="listitem"
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/5 py-0.5 pl-2 pr-0.5 text-xs text-slate-700 dark:border-indigo-300/30 dark:bg-indigo-300/10 dark:text-slate-200"
            >
              <span className="truncate">{testoCondizione(condizione)}</span>
              <button
                type="button"
                aria-label={`Togli ${testoCondizione(condizione)}`}
                title="Togli"
                onClick={() => togli(condizione)}
                className="rounded-full p-0.5 text-slate-500 hover:bg-primary/10 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:text-slate-100"
              >
                <Lucide icon="X" aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button type="button" variant="outline-secondary" size="sm" onClick={() => onCambia(INTERROGAZIONE_VUOTA)}>
            Togli tutte
          </Button>
        </div>
      )}

      {sintesi && risultati && (
        <section aria-label="Sintesi dei risultati" data-testid="sintesi-risultati" className="flex flex-col gap-3 rounded-control bg-slate-50 p-3 dark:bg-darkmode-600">
          {sintesi.box === 0 ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">Nessun box corrisponde: togli una condizione o cambia la ricerca.</p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
                <Numero etichetta="Box" valore={formatNumero(sintesi.box)} />
                <Numero etichetta="Referenze" valore={formatNumero(sintesi.referenze)} />
                <Numero etichetta="Pagine" valore={formatNumero(sintesi.pagine)} />
                <Numero etichetta="Spazio" valore={percento(sintesi.quotaSpazio)} titolo="Quota dello spazio di tutti i box del volantino" />
                <Numero etichetta="Sconto medio" valore={percento(sintesi.scontoMedio)} />
                <Numero etichetta="Prezzo medio" valore={euro(sintesi.prezzoMedio)} />
              </dl>
              {sintesi.prezzoMinimo !== null && sintesi.prezzoMassimo !== null && (
                <p className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  Prezzi da <strong className="text-slate-800 dark:text-slate-100">{euro(sintesi.prezzoMinimo)}</strong> a{" "}
                  <strong className="text-slate-800 dark:text-slate-100">{euro(sintesi.prezzoMassimo)}</strong>
                </p>
              )}
              <Ripartizione titolo="Per reparto" risultati={risultati} gruppo={perReparto} />
              <Ripartizione titolo="Per meccanica" risultati={risultati} gruppo={perMeccanica} />
            </>
          )}
        </section>
      )}

      <section aria-label="Condizioni" className="flex flex-col">
        <h5 className="pb-1 text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Condizioni</h5>
        {condizioni.map(condizione => (
          <SceltaValori key={condizione.id} condizione={condizione} onAlterna={chiave => onCambia(alternaValore(interrogazione, condizione.id, chiave))} />
        ))}
        <Intervalli intervalli={intervalli} interrogazione={interrogazione} onCambia={onCambia} />
      </section>

      {risultati && risultati.length > 0 && (
        <section aria-label="Box trovati" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {risultati.length === 1 ? "1 box trovato" : `${formatNumero(risultati.length)} box trovati`}
            </h5>
            <Segmenti<OrdineRisultati> etichetta="Ordina i box trovati" opzioni={OPZIONI_ORDINE} valore={ordine} onChange={setOrdine} />
          </div>
          <ul className="-mx-2 flex flex-col">
            {mostrati.map(voce => {
              const dettagli = [voce.pagina !== null ? `pag. ${formatNumero(voce.pagina)}` : null, marcaFormato(voce)].filter(Boolean).join(" · ");
              return (
                <li key={voce.id}>
                  <button
                    type="button"
                    data-testid={`risultato-${voce.id}`}
                    aria-current={voce.id === selezionato ? "true" : undefined}
                    onMouseEnter={() => onRilievo(voce.id)}
                    onMouseLeave={() => onRilievo(null)}
                    onFocus={() => onRilievo(voce.id)}
                    onBlur={() => onRilievo(null)}
                    onKeyDown={tastoRiga}
                    onClick={() => onApri(voce)}
                    className={twMerge(
                      "flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-darkmode-600",
                      voce.id === selezionato && "bg-primary/10 ring-1 ring-primary/40 dark:bg-indigo-300/15"
                    )}
                  >
                    <span className="pt-0.5">
                      <SegnoLegenda forma="quadrato" tinta={gruppo(voce).tinta} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{voce.nome || "Box senza nome"}</span>
                      {dettagli && <span className="truncate text-3xs text-slate-500 dark:text-slate-400">{dettagli}</span>}
                    </span>
                    <span className="flex flex-none flex-col items-end text-3xs tabular-nums text-slate-500 dark:text-slate-400">
                      {voce.prezzo !== null && <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{formatEuro(voce.prezzo)}</span>}
                      <span>
                        {voce.sconto !== null ? `−${percento(voce.sconto)} · ` : ""}
                        {percento(voce.geometria ? voce.spazio : null)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!tutti && ordinati.length > mostrati.length && (
            <Button type="button" variant="outline-secondary" size="sm" onClick={() => setTutti(true)}>
              Mostra tutti i {formatNumero(ordinati.length)} box
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

export default InterrogaVolantino;
