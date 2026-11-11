import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import IntestazioneOrdinabile, { ARIA_SORT } from "@/pages/shared/IntestazioneOrdinabile";
import type { ReferenzaPosizione } from "@/types/flyerInsights";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import type { BoxInsight, LineeDistributore } from "../../../../lib/insightVolantino/tipi";
import { ETICHETTA_MECCANICA, MECCANICHE } from "../../../../lib/puntiVendita/analisi";
import { marcaFormato } from "../volantino/box";
import { tintaMeccanica } from "../volantino/colori";
import {
  contaRapidi,
  DIREZIONE_INIZIALE,
  FILTRI_VUOTI,
  filtraRighe,
  ordinaRighe,
  ORDINAMENTO_PREDEFINITO,
  ricercaUtile,
  righeReferenze,
  SENZA,
  TUTTI,
  type ColonnaOrdinabile,
  type FiltriReferenze,
  type FiltroRapido,
  type Ordinamento,
  type RigaReferenza,
} from "./tabella";

export interface ReferenzeVolantinoProps {
  box: readonly BoxInsight[];
  /** Le referenze di sempre, per i prodotti dei box che ne hanno più di uno. */
  referenze?: readonly ReferenzaPosizione[];
  /** Le linee del distributore: aggiungono la colonna Linea e il filtro; null o assenti, niente colonna. */
  lineeDistributore?: LineeDistributore | null;
  /** Le referenze del volantino, per il titolo; predefinita la somma dei prodotti dei box. */
  totaleReferenze?: number;
  /** Ricerca di partenza (?referenza= dell'indirizzo): vale solo se trova qualcosa. */
  ricercaIniziale?: string;
  /** Apre il box nel volantino sfogliabile. */
  onApriBox: (box: BoxInsight) => void;
}

/** Righe mostrate all'inizio e a ogni "Mostra altre". */
export const RIGHE_PER_VOLTA = 50;

const VUOTO = "—";

const contaBox = (numero: number): string => (numero === 1 ? "1 box" : `${formatNumero(numero)} box`);

/** La foto piccola del prodotto pilota; se manca o non si carica, un'icona. */
function Miniatura({ url }: { url: string | undefined }) {
  const [rotta, setRotta] = useState(false);
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-700">
      {url && !rotta ? (
        <img src={url} alt="" loading="lazy" onError={() => setRotta(true)} className="h-full w-full object-contain" />
      ) : (
        <Lucide icon="Image" aria-hidden="true" className="h-4 w-4 text-slate-400" />
      )}
    </span>
  );
}

/** Una pastiglia con il pallino colorato: linea, meccanica. */
function Pastiglia({ colore, classeColore, children }: { colore?: string | null; classeColore?: string; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700 dark:bg-darkmode-400 dark:text-slate-200">
      <span
        aria-hidden="true"
        className={twMerge("h-2 w-2 flex-none rounded-full", !colore && (classeColore ?? "bg-slate-400"))}
        style={colore ? { backgroundColor: colore } : undefined}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

function Intestazione({
  colonna,
  ordinamento,
  onOrdina,
  children,
  className,
}: {
  colonna: ColonnaOrdinabile;
  ordinamento: Ordinamento;
  onOrdina: (colonna: ColonnaOrdinabile) => void;
  children: ReactNode;
  className?: string;
}) {
  const direzione = ordinamento.colonna === colonna ? ordinamento.direzione : undefined;
  return (
    <th scope="col" aria-sort={direzione ? ARIA_SORT[direzione] : undefined} className={className}>
      <IntestazioneOrdinabile direzione={direzione} onClick={() => onOrdina(colonna)}>
        {children}
      </IntestazioneOrdinabile>
    </th>
  );
}

/** Classi delle intestazioni: ferme in cima mentre la tabella scorre, su fondo pieno anche nel tema scuro. */
const CLASSI_TH =
  "sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-slate-500 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-400";
const CLASSI_TD = "border-b border-slate-100 px-3 py-2 align-middle dark:border-darkmode-400";

/**
 * "Referenze in volantino": una tabella con un box per riga (prodotto pilota, linea del distributore,
 * reparto, meccanica, prezzo, sconto, spazio e pagina), con ricerca, filtri rapidi e a tendina e
 * colonne ordinabili. "p. N" apre il box nel volantino sfogliabile; un box con più prodotti si apre
 * per elencarli. Dalle prime 50 righe si va avanti con "Mostra altre".
 */
export function ReferenzeVolantino({ box, referenze, lineeDistributore, totaleReferenze, ricercaIniziale = "", onApriBox }: ReferenzeVolantinoProps) {
  const righe = useMemo(() => righeReferenze(box, referenze), [box, referenze]);
  const [filtri, setFiltri] = useState<FiltriReferenze>(() => ({ ...FILTRI_VUOTI, testo: ricercaUtile(righe, ricercaIniziale) }));
  const [ordinamento, setOrdinamento] = useState<Ordinamento>(ORDINAMENTO_PREDEFINITO);
  const [limite, setLimite] = useState(RIGHE_PER_VOLTA);
  const [aperti, setAperti] = useState<ReadonlySet<string>>(new Set());
  const idTabella = useId();

  const conLinee = Boolean(lineeDistributore);
  const coloriLinee = useMemo(() => new Map((lineeDistributore?.linee ?? []).map(linea => [linea.sigla, linea.colore])), [lineeDistributore]);

  const filtrate = useMemo(() => filtraRighe(righe, filtri), [righe, filtri]);
  const ordinate = useMemo(() => ordinaRighe(filtrate, ordinamento), [filtrate, ordinamento]);
  const conti = useMemo(() => contaRapidi(righe, filtri), [righe, filtri]);
  const visibili = ordinate.slice(0, limite);

  // Le opzioni dei filtri a tendina: solo quelle che ci sono nel volantino
  const opzioniReparto = useMemo(() => {
    const reparti = new Map<string, string>();
    for (const voce of box) if (voce.reparto) reparti.set(voce.reparto.codice, voce.reparto.descrizione || voce.reparto.codice);
    return [...reparti].sort((a, b) => a[1].localeCompare(b[1], "it"));
  }, [box]);
  const senzaReparto = box.some(voce => !voce.reparto);
  const meccanichePresenti = useMemo(() => MECCANICHE.filter(meccanica => box.some(voce => voce.meccanica === meccanica)), [box]);
  const senzaMeccanica = box.some(voce => !voce.meccanica);
  const pagine = useMemo(() => [...new Set(box.flatMap(voce => (voce.pagina !== null ? [voce.pagina] : [])))].sort((a, b) => a - b), [box]);

  // Cambiando filtri si riparte dalle prime righe
  const cambia = (parziale: Partial<FiltriReferenze>) => {
    setFiltri(attuali => ({ ...attuali, ...parziale }));
    setLimite(RIGHE_PER_VOLTA);
  };
  const ordina = (colonna: ColonnaOrdinabile) =>
    setOrdinamento(attuale =>
      attuale.colonna === colonna ? { colonna, direzione: attuale.direzione === "asc" ? "desc" : "asc" } : { colonna, direzione: DIREZIONE_INIZIALE[colonna] }
    );
  const apriChiudi = (id: string) =>
    setAperti(attuali => {
      const nuovi = new Set(attuali);
      if (nuovi.has(id)) nuovi.delete(id);
      else nuovi.add(id);
      return nuovi;
    });

  const filtriAttivi = filtri.testo.trim() !== "" || filtri.rapido !== "tutte" || filtri.reparto !== TUTTI || filtri.meccanica !== TUTTI || filtri.pagina !== TUTTI;
  const numeroReferenze = totaleReferenze ?? box.reduce((somma, voce) => somma + Math.max(1, voce.prodotti), 0);
  const colonne = conLinee ? 9 : 8;

  const opzioniRapide: Array<{ valore: FiltroRapido; etichetta: string; conteggio: number }> = [
    { valore: "tutte", etichetta: "Tutte", conteggio: conti.tutte },
    ...(conLinee ? [{ valore: "distributore" as const, etichetta: "Linee del distributore", conteggio: conti.distributore }] : []),
    { valore: "fidelity", etichetta: "Prezzo Fidelity", conteggio: conti.fidelity },
    { valore: "sottocosto", etichetta: "Sottocosto", conteggio: conti.sottocosto },
  ];

  const riga = ({ box: voce, prodotti }: RigaReferenza) => {
    const sottotitolo = marcaFormato(voce);
    const aperto = aperti.has(voce.id);
    const idAltri = `${idTabella}-${voce.id}`;
    const altri = prodotti.filter(prodotto => prodotto.id !== voce.idReferenze[0]);
    const tinta = voce.meccanica ? tintaMeccanica(voce.meccanica) : null;
    return (
      <Fragment key={voce.id}>
        <tr data-box={voce.id} className="[&:hover>td]:bg-slate-50 dark:[&:hover>td]:bg-darkmode-400/40">
          <td className={twMerge(CLASSI_TD, "w-12 pl-5")}>
            <Miniatura key={voce.foto[0] ?? ""} url={voce.foto[0]} />
          </td>
          <th scope="row" className={twMerge(CLASSI_TD, "min-w-56 text-left font-normal")}>
            <span className="block font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{voce.nome || "Box senza nome"}</span>
            {sottotitolo && <span className="block text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{sottotitolo}</span>}
            {voce.prodotti > 1 && (
              <button
                type="button"
                aria-expanded={aperto}
                aria-controls={aperto ? idAltri : undefined}
                onClick={() => apriChiudi(voce.id)}
                className="mt-0.5 inline-flex items-center gap-1 rounded-control text-xs font-medium text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-300"
              >
                <Lucide icon={aperto ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="h-3.5 w-3.5" />
                {formatNumero(voce.prodotti)} prodotti
              </button>
            )}
          </th>
          {conLinee && (
            <td className={twMerge(CLASSI_TD, "whitespace-nowrap")}>
              {voce.linea ? (
                <Pastiglia colore={coloriLinee.get(voce.linea.sigla)} classeColore="bg-theme-1 dark:bg-indigo-300">
                  {voce.linea.nome || voce.linea.sigla}
                </Pastiglia>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">{voce.marca ? "Industria" : VUOTO}</span>
              )}
            </td>
          )}
          <td className={twMerge(CLASSI_TD, "min-w-28 text-xs text-slate-700 dark:text-slate-200")}>{voce.reparto?.descrizione || voce.reparto?.codice || VUOTO}</td>
          <td className={twMerge(CLASSI_TD, "whitespace-nowrap")}>
            {voce.meccanica ? (
              <Pastiglia colore={tinta?.colore} classeColore="bg-slate-400">
                {ETICHETTA_MECCANICA[voce.meccanica]}
              </Pastiglia>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500">{VUOTO}</span>
            )}
          </td>
          <td className={twMerge(CLASSI_TD, "whitespace-nowrap text-right tabular-nums")}>
            <span className="block font-semibold text-slate-800 dark:text-slate-100">{voce.prezzo !== null ? formatEuro(voce.prezzo) : VUOTO}</span>
            {voce.barrato !== null && (
              <span className="block text-2xs text-slate-500 dark:text-slate-400">
                <span className="sr-only">invece di </span>
                <s>{formatEuro(voce.barrato)}</s>
              </span>
            )}
            {voce.sottocosto && <span className="block text-2xs font-medium text-amber-700 dark:text-amber-400">Sottocosto</span>}
          </td>
          <td className={twMerge(CLASSI_TD, "whitespace-nowrap text-right tabular-nums text-slate-700 dark:text-slate-200")}>
            {voce.sconto !== null ? `−${formatPercentuale(Math.round(voce.sconto))}` : VUOTO}
          </td>
          <td className={twMerge(CLASSI_TD, "whitespace-nowrap text-right tabular-nums text-slate-700 dark:text-slate-200")}>
            {voce.geometria ? formatPercentuale(voce.spazio) : VUOTO}
          </td>
          <td className={twMerge(CLASSI_TD, "whitespace-nowrap pr-5 text-right")}>
            {voce.pagina !== null ? (
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                aria-label={`Apri nel volantino ${voce.nome || "il box"}, pagina ${voce.pagina}`}
                title="Apri nel volantino"
                onClick={() => onApriBox(voce)}
                className="tabular-nums"
              >
                p. {formatNumero(voce.pagina)}
                <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500">{VUOTO}</span>
            )}
          </td>
        </tr>
        {aperto && (
          <tr id={idAltri}>
            <td colSpan={colonne} className={twMerge(CLASSI_TD, "bg-slate-50/70 pl-[4.75rem] dark:bg-darkmode-700/40")}>
              {altri.length > 0 ? (
                <ul aria-label={`Altri prodotti di ${voce.nome || "questo box"}`} className="space-y-1 text-xs">
                  {altri.map(prodotto => (
                    <li key={prodotto.id} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-medium text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">{prodotto.nome || "Prodotto senza descrizione"}</span>
                      {prodotto.codice && <span className="font-mono text-3xs text-slate-500 dark:text-slate-400">{prodotto.codice}</span>}
                      {prodotto.prezzo !== null && <span className="tabular-nums text-slate-600 dark:text-slate-300">{formatEuro(prodotto.prezzo)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">I dettagli degli altri prodotti del box non sono disponibili.</p>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <Sezione
      senzaPadding
      icona="Package"
      titolo={`Referenze in volantino · ${formatNumero(numeroReferenze)}`}
      descrizione={`${contaBox(box.length)}, uno per riga: la pagina apre il box nel volantino.`}
    >
      <BarraFiltri>
        <CampoRicerca
          etichetta="Cerca referenza"
          placeholder="Nome, marca, formato o codice…"
          value={filtri.testo}
          onChange={testo => cambia({ testo })}
        />
        <Segmenti<FiltroRapido> etichetta="Mostra" opzioni={opzioniRapide} valore={filtri.rapido} onChange={rapido => cambia({ rapido })} />
        <FormSelect formSelectSize="sm" aria-label="Reparto" className="sm:w-44" value={filtri.reparto} onChange={evento => cambia({ reparto: evento.target.value })}>
          <option value={TUTTI}>Tutti i reparti</option>
          {opzioniReparto.map(([codice, nome]) => (
            <option key={codice} value={codice}>
              {nome}
            </option>
          ))}
          {senzaReparto && <option value={SENZA}>Reparto non noto</option>}
        </FormSelect>
        <FormSelect
          formSelectSize="sm"
          aria-label="Meccanica"
          className="sm:w-44"
          value={filtri.meccanica}
          onChange={evento => cambia({ meccanica: evento.target.value as FiltriReferenze["meccanica"] })}
        >
          <option value={TUTTI}>Tutte le meccaniche</option>
          {meccanichePresenti.map(meccanica => (
            <option key={meccanica} value={meccanica}>
              {ETICHETTA_MECCANICA[meccanica]}
            </option>
          ))}
          {senzaMeccanica && <option value={SENZA}>Non riconosciuta</option>}
        </FormSelect>
        <FormSelect formSelectSize="sm" aria-label="Pagina" className="sm:w-32" value={filtri.pagina} onChange={evento => cambia({ pagina: evento.target.value })}>
          <option value={TUTTI}>Tutte le pagine</option>
          {pagine.map(numero => (
            <option key={numero} value={String(numero)}>
              Pagina {numero}
            </option>
          ))}
        </FormSelect>
      </BarraFiltri>

      {ordinate.length === 0 ? (
        <div className="p-5">
          {filtriAttivi ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Nessun risultato"
              description="Nessun box corrisponde alla ricerca o ai filtri scelti."
              buttonText="Azzera filtri"
              buttonIcon="RotateCcw"
              onButtonClick={() => cambia(FILTRI_VUOTI)}
            />
          ) : (
            <EmptyState compatta icon="Package" title="Nessun box" description="Il volantino non ha box con referenze." />
          )}
        </div>
      ) : (
        <>
          {/* Scorre da sola: le intestazioni restano ferme in cima. Posizionata, così il testo
              nascosto delle righe (sr-only è assoluto) resta dentro e non allunga la pagina */}
          <div className="relative max-h-[70vh] overflow-auto overscroll-contain" data-testid="scorrimento-referenze">
            <table id={idTabella} className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-sm">
              <caption className="sr-only">Referenze in volantino</caption>
              <thead>
                <tr>
                  <th scope="col" className={twMerge(CLASSI_TH, "pl-5")}>
                    <span className="sr-only">Foto</span>
                  </th>
                  <th scope="col" className={CLASSI_TH}>
                    Prodotto
                  </th>
                  {conLinee && (
                    <th scope="col" className={CLASSI_TH}>
                      Linea
                    </th>
                  )}
                  <th scope="col" className={CLASSI_TH}>
                    Reparto
                  </th>
                  <th scope="col" className={CLASSI_TH}>
                    Meccanica
                  </th>
                  <Intestazione colonna="prezzo" ordinamento={ordinamento} onOrdina={ordina} className={twMerge(CLASSI_TH, "text-right")}>
                    Prezzo
                  </Intestazione>
                  <Intestazione colonna="sconto" ordinamento={ordinamento} onOrdina={ordina} className={twMerge(CLASSI_TH, "text-right")}>
                    Sconto
                  </Intestazione>
                  <Intestazione colonna="spazio" ordinamento={ordinamento} onOrdina={ordina} className={twMerge(CLASSI_TH, "text-right")}>
                    Spazio
                  </Intestazione>
                  <Intestazione colonna="pagina" ordinamento={ordinamento} onOrdina={ordina} className={twMerge(CLASSI_TH, "pr-5 text-right")}>
                    Pagina
                  </Intestazione>
                </tr>
              </thead>
              <tbody>{visibili.map(riga)}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p role="status" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {visibili.length === ordinate.length
                ? `${contaBox(ordinate.length)}${filtriAttivi ? ` su ${formatNumero(righe.length)}` : ""}`
                : `${formatNumero(visibili.length)} di ${contaBox(ordinate.length)}`}
            </p>
            {visibili.length < ordinate.length && (
              <Button type="button" size="sm" variant="outline-secondary" aria-controls={idTabella} onClick={() => setLimite(attuale => attuale + RIGHE_PER_VOLTA)}>
                <Lucide icon="ChevronDown" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Mostra altre {formatNumero(Math.min(RIGHE_PER_VOLTA, ordinate.length - visibili.length))}
              </Button>
            )}
          </div>
        </>
      )}
    </Sezione>
  );
}

export default ReferenzeVolantino;
