import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog, Slideover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import { Legenda, type VoceLegenda } from "@/components/Grafici";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { formatNumero } from "@/utils/format";
import { urlPaginaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { BoxInsight, PdfVolantino } from "../../../../lib/insightVolantino/tipi";
import { AnalisiPagina } from "./AnalisiPagina";
import { cercaBox, risultatoVicino } from "./analisiPagina";
import { marcaFormato, trovaBoxIniziale } from "./box";
import { coloriReparti, gruppoBox, legendaModo, OPZIONI_COLORE, stileBox, TITOLI_LEGENDA, type GruppoBox, type ModoColore, type StileRiquadro } from "./colori";
import {
  boxPerPagina,
  paginaRichiesta,
  pagineDaSfogliare,
  pagineInVista,
  proporzioneDelVolantino,
  proporzioneDellaPagina,
  riquadroBox,
} from "./geometria";
import { IndicePagine, misuraMiniatura, type VoceIndice } from "./IndicePagine";
import { PaginaConImmagine } from "./PaginaConImmagine";
import { SchedaBox } from "./SchedaBox";
import { ViaggioProdotto } from "./ViaggioProdotto";

export interface VolantinoSfogliabileProps {
  idKit: string;
  pdf: PdfVolantino | null;
  box: BoxInsight[];
  totalePagine: number;
  configurazione?: FlyerInsightsConfig;
  /** Pagina controllata (opzionale): la decide la pagina, per esempio dalla distribuzione nelle pagine. */
  pagina?: number;
  onCambiaPagina?: (pagina: number) => void;
  /** Box da evidenziare e scheda aperta all'avvio, es. da ?referenza=. Si apre una volta sola. */
  idBoxIniziale?: string | null;
  /**
   * Box da aprire da fuori, per esempio dall'elenco delle referenze: a ogni nuovo `volta` si va alla
   * sua pagina e si apre la sua scheda, anche se è lo stesso box di prima.
   */
  apriBox?: { id: string; volta: number } | null;
  titolo?: string;
}

/**
 * Ingrandimenti rispetto alle pagine adattate alla larghezza del lettore (1). Le immagini di Olimpo
 * sono a 150 dpi: oltre il doppio sgranerebbero.
 */
export const LIVELLI_ZOOM: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ZOOM_ADATTA = LIVELLI_ZOOM.indexOf(1);
/** Le pagine adattate non vanno oltre questa larghezza: una pagina verticale deve restare leggibile intera. */
const LARGHEZZA_ADATTA_REM = 56;
/** Altezza del lettore nella pagina: quasi tutto lo schermo, perché le pagine si leggano in grande. */
const ALTEZZA_LETTORE = "h-[min(92vh,64rem)] min-h-[36rem]";
/** A schermo intero il lettore prende lo schermo, tolti titolo e comandi. */
const ALTEZZA_SCHERMO_INTERO = "h-[calc(100vh-11rem)]";
/** Spazio sopra la pagina raggiunta con "Vai a", perché non si incolli al bordo del lettore. */
const MARGINE_SALTO = 12;
/** Dopo un salto lo scorrimento non sposta la pagina corrente: l'ultima pagina non arriva in cima. */
const PAUSA_DOPO_SALTO_MS = 250;
/** Le immagini delle pagine si chiedono quando lo scorrimento si ferma per questo tempo: non a ogni pagina che passa. */
const ATTESA_SCORRIMENTO_FERMO_MS = 150;
/** Una pagina senza box: lo stesso array per tutte, perché le pagine non si ridisegnino per nulla. */
const NESSUN_BOX: readonly BoxInsight[] = [];

/** Al prossimo fotogramma; dove non c'è requestAnimationFrame (test, server), poco dopo. */
const alProssimoFotogramma = (funzione: () => void): (() => void) => {
  if (typeof requestAnimationFrame === "function") {
    const fotogramma = requestAnimationFrame(funzione);
    return () => cancelAnimationFrame(fotogramma);
  }
  const attesa = setTimeout(funzione, 16);
  return () => clearTimeout(attesa);
};

/** Dove stanno le pagine nello scorrimento del lettore, in ordine. */
const posizioniDi = (pagine: ReadonlyMap<number, HTMLElement>) =>
  [...pagine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numero, elemento]) => ({ numero, inizio: elemento.offsetTop, fine: elemento.offsetTop + elemento.offsetHeight }));

const stessiNumeri = (a: ReadonlySet<number> | null, b: ReadonlySet<number> | null): boolean =>
  a === b || (a !== null && b !== null && a.size === b.size && [...a].every(numero => b.has(numero)));

/** Pagina N di M, precedente e successiva: il numero si può scrivere. */
function Navigazione({ corrente, totale, onVai }: { corrente: number; totale: number; onVai: (pagina: number) => void }) {
  const [testo, setTesto] = useState<string | null>(null);
  const conferma = () => {
    if (testo === null) return;
    const numero = paginaRichiesta(testo, totale);
    setTesto(null);
    if (numero !== null) onVai(numero);
  };
  const tasto = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Enter") conferma();
    if (evento.key === "Escape") setTesto(null);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Pagina precedente"
        title="Pagina precedente"
        disabled={corrente <= 1}
        onClick={() => onVai(corrente - 1)}
      >
        <Lucide icon="ChevronUp" aria-hidden="true" className="h-4 w-4" />
      </Button>
      <label className="flex items-center gap-1.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
        <span>Pagina</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Vai alla pagina"
          value={testo ?? String(corrente)}
          onChange={evento => setTesto(evento.target.value)}
          onFocus={evento => evento.target.select()}
          onBlur={conferma}
          onKeyDown={tasto}
          className="h-8 w-11 rounded-control border border-slate-200 bg-white text-center text-xs font-semibold tabular-nums text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-100"
        />
        <span>di {formatNumero(totale)}</span>
      </label>
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Pagina successiva"
        title="Pagina successiva"
        disabled={corrente >= totale}
        onClick={() => onVai(corrente + 1)}
      >
        <Lucide icon="ChevronDown" aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Adatta alla larghezza, riduci e ingrandisci, con la percentuale. */
function ControlliZoom({ zoom, onZoom }: { zoom: number; onZoom: (indice: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Adatta alla larghezza"
        title="Adatta alla larghezza"
        aria-pressed={zoom === ZOOM_ADATTA}
        onClick={() => onZoom(ZOOM_ADATTA)}
      >
        <Lucide icon="MoveHorizontal" aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline-secondary" size="sm" aria-label="Riduci" title="Riduci" disabled={zoom <= 0} onClick={() => onZoom(zoom - 1)}>
        <Lucide icon="Minus" aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span aria-live="polite" className="min-w-11 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">
        {formatNumero(LIVELLI_ZOOM[zoom] * 100)}%
      </span>
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Ingrandisci"
        title="Ingrandisci"
        disabled={zoom >= LIVELLI_ZOOM.length - 1}
        onClick={() => onZoom(zoom + 1)}
      >
        <Lucide icon="Plus" aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface RicercaNelVolantinoProps {
  testo: string;
  onTesto: (testo: string) => void;
  /** I box trovati, in ordine di lettura; null: testo troppo corto, nessuna ricerca. */
  risultati: readonly BoxInsight[] | null;
  /** Il risultato a cui si è arrivati con precedente e successivo; -1 nessuno. */
  attuale: number;
  onPassa: (passo: 1 | -1) => void;
}

/**
 * "Cerca prodotto o marca": quanti box e in quante pagine, e i comandi per passare da un box trovato
 * all'altro. Invio porta al successivo, Maiusc+Invio al precedente, Esc cancella la ricerca.
 */
function RicercaNelVolantino({ testo, onTesto, risultati, attuale, onPassa }: RicercaNelVolantinoProps) {
  const quanti = risultati?.length ?? 0;
  const pagine = risultati ? new Set(risultati.map(voce => voce.pagina)).size : 0;
  const tasto = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Enter" && quanti > 0) {
      evento.preventDefault();
      onPassa(evento.shiftKey ? -1 : 1);
    }
    if (evento.key === "Escape" && testo) {
      evento.preventDefault();
      onTesto("");
    }
  };
  const trovato = attuale >= 0 ? risultati?.[attuale] : undefined;
  const stato =
    risultati === null
      ? ""
      : quanti === 0
        ? `Nessun box per «${testo.trim()}»`
        : trovato
          ? `${formatNumero(attuale + 1)} di ${formatNumero(quanti)} · pagina ${formatNumero(trovato.pagina ?? 0)}`
          : `${quanti === 1 ? "1 box" : `${formatNumero(quanti)} box`} in ${pagine === 1 ? "1 pagina" : `${formatNumero(pagine)} pagine`}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CampoRicerca
        etichetta="Cerca prodotto o marca"
        placeholder="Cerca prodotto o marca…"
        value={testo}
        onChange={onTesto}
        onKeyDown={tasto}
        className="w-full sm:w-56"
      />
      {quanti > 0 && (
        <>
          <Button type="button" variant="outline-secondary" size="sm" aria-label="Box trovato precedente" title="Box trovato precedente" onClick={() => onPassa(-1)}>
            <Lucide icon="ArrowUp" aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline-secondary" size="sm" aria-label="Box trovato successivo" title="Box trovato successivo" onClick={() => onPassa(1)}>
            <Lucide icon="ArrowDown" aria-hidden="true" className="h-4 w-4" />
          </Button>
        </>
      )}
      <span role="status" aria-live="polite" data-testid="esito-ricerca" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {stato}
      </span>
    </div>
  );
}

interface LettoreProps {
  totale: number;
  corrente: number;
  /** La pagina che arriva a un terzo dall'alto scorrendo. */
  onScorrimento: (pagina: number) => void;
  onVai: (pagina: number) => void;
  zoom: number;
  onZoom: (indice: number) => void;
  indice: readonly VoceIndice[];
  /** Classi dell'altezza del lettore: le pagine scorrono al suo interno. */
  altezza: string;
  pagina: (numero: number, attiva: boolean) => ReactNode;
  /** L'analisi della pagina guardata: a destra delle pagine sugli schermi larghi, sotto sugli altri. */
  laterale: ReactNode;
}

/**
 * Il lettore: le pagine una sotto l'altra in un riquadro che scorre, con l'indice a fianco.
 *
 * Con volantini di molte pagine conta cosa si scarica e quando:
 * - lo spazio di ogni pagina c'è da subito, con i riquadri: niente salti mentre le pagine arrivano;
 * - si chiedono solo le immagini delle pagine vicine alla parte visibile, e solo a scorrimento fermo:
 *   scorrendo veloce non partono richieste che sarebbero subito superate (la pagina corrente si
 *   aggiorna lo stesso);
 * - cambiando zoom resta sotto gli occhi lo stesso punto della stessa pagina.
 * Quando la pagina corrente cambia da fuori (indice, Vai a, la distribuzione nelle pagine) ci va.
 * Da tastiera: Home e Fine portano alla prima e all'ultima pagina, + e - ingrandiscono e riducono,
 * 0 adatta alla larghezza; le frecce e Pagina su/giù scorrono come sempre.
 */
function Lettore({ totale, corrente, onScorrimento, onVai, zoom, onZoom, indice, altezza, pagina, laterale }: LettoreProps) {
  const contenitore = useRef<HTMLDivElement>(null);
  const pagine = useRef(new Map<number, HTMLDivElement>());
  /**
   * Le pagine di cui chiedere l'immagine. undefined: lettore non ancora misurato, nessuna (al primo
   * fotogramma partirebbero tutte insieme); null: misure non disponibili, tutte.
   */
  const [vicine, setVicine] = useState<ReadonlySet<number> | null | undefined>(undefined);
  /** L'ultima pagina vista scorrendo: se la corrente è diversa, è arrivata da fuori e ci si va. */
  const vista = useRef<number | null>(null);
  const pausaFino = useRef(0);
  /** Il punto guardato: la pagina corrente e quanto se n'è scorso, per ritrovarlo dopo uno zoom. */
  const ancora = useRef<{ numero: number; frazione: number } | null>(null);

  /** Pagina corrente e punto guardato: a ogni fotogramma dello scorrimento. */
  const misuraCorrente = useCallback(() => {
    const nodo = contenitore.current;
    if (!nodo) return;
    const { corrente: nuova } = pagineInVista(posizioniDi(pagine.current), nodo.scrollTop, nodo.clientHeight);
    if (nuova === null) return;
    const elemento = pagine.current.get(nuova);
    if (elemento && elemento.offsetHeight > 0) {
      ancora.current = { numero: nuova, frazione: (nodo.scrollTop - elemento.offsetTop) / elemento.offsetHeight };
    }
    if (Date.now() < pausaFino.current || nuova === vista.current) return;
    vista.current = nuova;
    onScorrimento(nuova);
  }, [onScorrimento]);

  /** Pagine di cui chiedere l'immagine: a scorrimento fermo. */
  const misuraVicine = useCallback(() => {
    const nodo = contenitore.current;
    if (!nodo) return;
    const { vicine: nuove } = pagineInVista(posizioniDi(pagine.current), nodo.scrollTop, nodo.clientHeight);
    setVicine(precedenti => (precedenti !== undefined && stessiNumeri(precedenti, nuove) ? precedenti : nuove));
  }, []);

  // La pagina corrente arrivata da fuori: ci si va subito, senza animazione
  useEffect(() => {
    if (corrente === vista.current) return;
    const nodo = contenitore.current;
    const elemento = pagine.current.get(corrente);
    vista.current = corrente;
    if (!nodo || !elemento) return;
    pausaFino.current = Date.now() + PAUSA_DOPO_SALTO_MS;
    nodo.scrollTop = Math.max(0, elemento.offsetTop - MARGINE_SALTO);
    ancora.current = { numero: corrente, frazione: 0 };
    misuraVicine();
  }, [corrente, misuraVicine]);

  // Cambiando zoom le pagine cambiano altezza: si torna allo stesso punto della stessa pagina, al centro
  const primoZoom = useRef(true);
  useEffect(() => {
    if (primoZoom.current) {
      primoZoom.current = false;
      return;
    }
    const nodo = contenitore.current;
    const punto = ancora.current;
    const elemento = punto ? pagine.current.get(punto.numero) : undefined;
    if (!nodo || !punto || !elemento) return;
    pausaFino.current = Date.now() + PAUSA_DOPO_SALTO_MS;
    nodo.scrollTop = Math.max(0, elemento.offsetTop + punto.frazione * elemento.offsetHeight);
    nodo.scrollLeft = Math.max(0, (nodo.scrollWidth - nodo.clientWidth) / 2);
    misuraVicine();
  }, [zoom, misuraVicine]);

  // Scorrimento e ridimensionamento: la pagina corrente al fotogramma successivo, le immagini a scorrimento fermo
  useEffect(() => {
    const nodo = contenitore.current;
    if (!nodo) return;
    let annullaFotogramma = () => {};
    let fermo: ReturnType<typeof setTimeout> | undefined;
    const programma = () => {
      annullaFotogramma();
      annullaFotogramma = alProssimoFotogramma(misuraCorrente);
      clearTimeout(fermo);
      fermo = setTimeout(misuraVicine, ATTESA_SCORRIMENTO_FERMO_MS);
    };
    misuraCorrente();
    misuraVicine();
    nodo.addEventListener("scroll", programma, { passive: true });
    const osservatore = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(programma);
    osservatore?.observe(nodo);
    return () => {
      annullaFotogramma();
      clearTimeout(fermo);
      nodo.removeEventListener("scroll", programma);
      osservatore?.disconnect();
    };
  }, [misuraCorrente, misuraVicine]);

  const tasto = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    const azioni: Record<string, () => void> = {
      Home: () => onVai(1),
      End: () => onVai(totale),
      "+": () => onZoom(zoom + 1),
      "=": () => onZoom(zoom + 1),
      "-": () => onZoom(zoom - 1),
      "0": () => onZoom(ZOOM_ADATTA),
    };
    const azione = azioni[evento.key];
    if (!azione) return;
    evento.preventDefault();
    azione();
  };

  const numeri = Array.from({ length: totale }, (_, posto) => posto + 1);

  return (
    <div className="flex min-w-0 flex-col gap-3 xl:flex-row">
      <div className={twMerge("flex min-h-0 min-w-0 flex-1 gap-3", altezza)}>
        <div className="hidden w-24 flex-none sm:block">
          <IndicePagine voci={indice} corrente={corrente} onVai={onVai} />
        </div>
        <div
          ref={contenitore}
          role="region"
          aria-label="Pagine del volantino"
          aria-keyshortcuts="Home End + - 0"
          tabIndex={0}
          onKeyDown={tasto}
          data-testid="lettore-pagine"
          className="relative min-w-0 flex-1 overflow-auto overscroll-contain rounded-control border border-slate-200 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-darkmode-400 dark:bg-darkmode-800"
        >
          <div
            data-testid="colonna-pagine"
            className="mx-auto flex flex-col gap-4 p-4"
            style={{ width: `calc(min(100%, ${LARGHEZZA_ADATTA_REM}rem) * ${LIVELLI_ZOOM[zoom]})` }}
          >
            {numeri.map(numero => (
              <div
                key={numero}
                data-pagina={numero}
                ref={elemento => {
                  if (elemento) pagine.current.set(numero, elemento);
                  else pagine.current.delete(numero);
                }}
              >
                {pagina(numero, vicine === null || (vicine !== undefined && vicine.has(numero)))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Sugli schermi larghi l'analisi è alta quanto il lettore e scorre da sola; sotto, segue la pagina */}
      <div className="relative min-w-0 xl:w-80 xl:flex-none">
        <div className="max-h-[32rem] overflow-y-auto overscroll-contain xl:absolute xl:inset-0 xl:max-h-none">{laterale}</div>
      </div>
      {/* La pagina corrente per chi usa un lettore di schermo */}
      <p aria-live="polite" className="sr-only">
        Pagina {corrente} di {totale}
      </p>
    </div>
  );
}

/**
 * Il volantino negli insight, come un lettore: tutte le pagine una sotto l'altra, con le immagini
 * delle pagine date da Olimpo e sopra i riquadri dei box colorati per reparto, meccanica o sconto. A
 * fianco l'indice delle pagine e l'analisi della pagina guardata; sopra la pagina corrente, "Vai a",
 * la ricerca dei box, lo zoom e lo schermo intero. Un clic (o Invio) su un riquadro apre la scheda
 * del box, e da lì il viaggio del prodotto. Senza PDF le pagine sono bianche.
 */
export function VolantinoSfogliabile(props: VolantinoSfogliabileProps) {
  // Un altro volantino riparte da capo: pagina, box scelto, scheda e zoom
  return <Sfogliabile key={props.idKit} {...props} />;
}

function Sfogliabile({
  idKit,
  pdf,
  box,
  totalePagine,
  configurazione,
  pagina,
  onCambiaPagina,
  idBoxIniziale,
  apriBox: daAprire,
  titolo = "Il volantino",
}: VolantinoSfogliabileProps) {
  const [paginaInterna, setPaginaInterna] = useState(1);
  const [modo, setModo] = useState<ModoColore>("reparto");
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [schedaAperta, setSchedaAperta] = useState(false);
  const [viaggioAperto, setViaggioAperto] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_ADATTA);
  const [schermoIntero, setSchermoIntero] = useState(false);
  const [ricerca, setRicerca] = useState("");
  /** Il risultato della ricerca a cui si è arrivati, per il testo cercato in quel momento. */
  const [passaggio, setPassaggio] = useState<{ testo: string; indice: number }>({ testo: "", indice: -1 });
  /** Il box su cui si passa nell'elenco dell'analisi della pagina. */
  const [rilievoElenco, setRilievoElenco] = useState<string | null>(null);

  const controllata = pagina !== undefined;
  const totale = pagineDaSfogliare(totalePagine, box);
  const limita = useCallback((numero: number) => Math.min(totale, Math.max(1, Math.floor(numero) || 1)), [totale]);
  const corrente = limita(controllata ? pagina : paginaInterna);

  const vaiAllaPagina = useCallback(
    (nuova: number) => {
      const numero = limita(nuova);
      if (!controllata) setPaginaInterna(numero);
      onCambiaPagina?.(numero);
    },
    [controllata, limita, onCambiaPagina]
  );
  const zoomTra = (indice: number) => setZoom(Math.max(0, Math.min(LIVELLI_ZOOM.length - 1, indice)));

  const apriBox = useCallback((voce: BoxInsight) => {
    setSelezionato(voce.id);
    setSchedaAperta(true);
    setViaggioAperto(false);
  }, []);

  // Il box indicato dall'indirizzo: si apre la sua scheda e si va alla sua pagina, una volta sola
  const inizialeAperto = useRef<string | null>(null);
  useEffect(() => {
    if (!idBoxIniziale || inizialeAperto.current === idBoxIniziale) return;
    const trovato = trovaBoxIniziale(box, idBoxIniziale);
    if (!trovato) return;
    inizialeAperto.current = idBoxIniziale;
    apriBox(trovato);
    if (trovato.pagina !== null) vaiAllaPagina(trovato.pagina);
  }, [idBoxIniziale, box, apriBox, vaiAllaPagina]);

  // Il box chiesto da fuori (l'elenco delle referenze): a ogni richiesta, anche dello stesso box
  const voltaAperta = useRef<number | null>(null);
  const idDaAprire = daAprire?.id;
  const voltaDaAprire = daAprire?.volta;
  useEffect(() => {
    if (idDaAprire === undefined || voltaDaAprire === undefined || voltaAperta.current === voltaDaAprire) return;
    voltaAperta.current = voltaDaAprire;
    const trovato = box.find(voce => voce.id === idDaAprire);
    if (!trovato) return;
    apriBox(trovato);
    if (trovato.pagina !== null) vaiAllaPagina(trovato.pagina);
  }, [idDaAprire, voltaDaAprire, box, apriBox, vaiAllaPagina]);

  const perPagina = useMemo(() => boxPerPagina(box), [box]);
  const proporzioneBase = useMemo(() => proporzioneDelVolantino(box), [box]);
  const reparti = useMemo(() => coloriReparti(box, configurazione), [box, configurazione]);
  const senzaPosizione = useMemo(() => box.filter(voce => voce.pagina === null || !riquadroBox(voce.geometria)).length, [box]);

  const stile = useCallback((voce: BoxInsight): StileRiquadro => stileBox(voce, modo, reparti), [modo, reparti]);
  const voci = useMemo<VoceLegenda[]>(() => legendaModo(modo, box, reparti), [box, modo, reparti]);

  const gruppo = useCallback((voce: BoxInsight): GruppoBox => gruppoBox(voce, modo, reparti), [modo, reparti]);

  // La ricerca dei box: i trovati restano in evidenza e gli altri si attenuano; senza risultati,
  // o con un testo troppo corto, i riquadri restano come sono
  const testoCercato = useDeferredValue(ricerca);
  const risultati = useMemo(() => cercaBox(box, testoCercato), [box, testoCercato]);
  const trovati = useMemo(() => (risultati && risultati.length > 0 ? new Set(risultati.map(voce => voce.id)) : null), [risultati]);
  const trovatiPerPagina = useMemo(() => {
    const conti = new Map<number, number>();
    for (const voce of risultati ?? []) {
      if (voce.pagina !== null) conti.set(voce.pagina, (conti.get(voce.pagina) ?? 0) + 1);
    }
    return conti;
  }, [risultati]);
  const attuale = risultati && passaggio.testo === testoCercato && passaggio.indice < risultati.length ? passaggio.indice : -1;
  const passaAlRisultato = (passo: 1 | -1) => {
    if (!risultati || risultati.length === 0) return;
    const indice = risultatoVicino(risultati, attuale, passo, corrente);
    setPassaggio({ testo: testoCercato, indice });
    const voce = risultati[indice];
    if (voce.pagina !== null) vaiAllaPagina(voce.pagina);
  };

  // In rilievo il box su cui si passa nell'elenco, altrimenti il risultato raggiunto con la ricerca
  const rilievo = rilievoElenco ?? (attuale >= 0 && risultati ? risultati[attuale].id : null);
  const paginaDelBox = useMemo(() => new Map(box.map(voce => [voce.id, voce.pagina])), [box]);
  // Ogni pagina riceve solo ciò che la riguarda: le altre non si ridisegnano
  const diQuestaPagina = (id: string | null, numero: number): string | null => (id !== null && paginaDelBox.get(id) === numero ? id : null);

  // Le pagine oltre quelle del PDF restano bianche; pagine 0 vuol dire che Olimpo non le ha contate
  const conImmagine = (numero: number): string | null =>
    pdf && pdf.idOlimpoCloud && (pdf.pagine <= 0 || numero <= pdf.pagine) ? pdf.idOlimpoCloud : null;

  const boxScelto = selezionato ? (box.find(voce => voce.id === selezionato) ?? null) : null;

  const paginaDisegnata = (numero: number, attiva: boolean) => {
    const idOlimpo = conImmagine(numero);
    return (
      <PaginaConImmagine
        numero={numero}
        attiva={attiva}
        proporzione={proporzioneDellaPagina(box, numero, proporzioneBase)}
        immagine={idOlimpo ? urlPaginaMateriale(idOlimpo, numero) : null}
        box={perPagina.get(numero) ?? NESSUN_BOX}
        stile={stile}
        selezionato={diQuestaPagina(selezionato, numero)}
        onSeleziona={apriBox}
        trovati={trovati}
        rilievo={diQuestaPagina(rilievo, numero)}
      />
    );
  };

  // Le miniature dell'indice si chiedono a Olimpo già ridotte: pochi KB l'una
  const indice: VoceIndice[] = Array.from({ length: totale }, (_, posto) => {
    const numero = posto + 1;
    const proporzione = proporzioneDellaPagina(box, numero, proporzioneBase);
    const idOlimpo = conImmagine(numero);
    return {
      numero,
      proporzione,
      box: (perPagina.get(numero) ?? NESSUN_BOX).filter(voce => riquadroBox(voce.geometria)).length,
      immagine: idOlimpo ? urlPaginaMateriale(idOlimpo, numero, misuraMiniatura(proporzione)) : null,
      trovati: trovati ? (trovatiPerPagina.get(numero) ?? 0) : null,
    };
  });

  const analisi = (
    <AnalisiPagina
      numero={corrente}
      totale={totale}
      box={perPagina.get(corrente) ?? NESSUN_BOX}
      gruppo={gruppo}
      titoloRipartizione={TITOLI_LEGENDA[modo]}
      selezionato={selezionato}
      trovati={trovati}
      onRilievo={setRilievoElenco}
      onApri={apriBox}
    />
  );

  const lettore = (inGrande: boolean) => (
    <Lettore
      totale={totale}
      corrente={corrente}
      onScorrimento={vaiAllaPagina}
      onVai={vaiAllaPagina}
      zoom={zoom}
      onZoom={zoomTra}
      indice={indice}
      altezza={inGrande ? ALTEZZA_SCHERMO_INTERO : ALTEZZA_LETTORE}
      pagina={paginaDisegnata}
      laterale={analisi}
    />
  );

  const chiudiScheda = () => {
    setSchedaAperta(false);
    setViaggioAperto(false);
  };

  // La scheda si apre sopra lo schermo intero quando c'è: dentro il suo albero, come dialog annidato
  const scheda = (
    <Slideover open={schedaAperta && boxScelto !== null} onClose={chiudiScheda} size="lg">
      <Slideover.Panel>
        {boxScelto && (
          <>
            <Slideover.Title className="py-4">
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="title-section [overflow-wrap:anywhere]">{viaggioAperto ? "Viaggio del prodotto" : boxScelto.nome || "Box senza nome"}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {viaggioAperto ? boxScelto.nome : [marcaFormato(boxScelto), boxScelto.pagina !== null ? `pagina ${formatNumero(boxScelto.pagina)}` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button type="button" variant="outline-secondary" size="sm" aria-label="Chiudi la scheda" title="Chiudi" onClick={chiudiScheda}>
                  <Lucide icon="X" aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </Slideover.Title>
            <div className="flex-1 overflow-y-auto p-5">
              {viaggioAperto ? (
                <ViaggioProdotto idKit={idKit} chiave={boxScelto.chiave} onIndietro={() => setViaggioAperto(false)} />
              ) : (
                <SchedaBox box={boxScelto} totalePagine={totale} onViaggio={() => setViaggioAperto(true)} />
              )}
            </div>
          </>
        )}
      </Slideover.Panel>
    </Slideover>
  );

  const legenda = <Legenda voci={voci} titolo={TITOLI_LEGENDA[modo]} />;

  const barra = (
    <div
      role="toolbar"
      aria-label="Comandi del lettore"
      className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-slate-200 bg-white px-3 py-2 dark:border-darkmode-400 dark:bg-darkmode-700"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Navigazione corrente={corrente} totale={totale} onVai={vaiAllaPagina} />
        <RicercaNelVolantino testo={ricerca} onTesto={setRicerca} risultati={risultati} attuale={attuale} onPassa={passaAlRisultato} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ControlliZoom zoom={zoom} onZoom={zoomTra} />
        {!schermoIntero && (
          <Button type="button" variant="outline-secondary" size="sm" aria-label="Schermo intero" title="Schermo intero" onClick={() => setSchermoIntero(true)}>
            <Lucide icon="Maximize2" aria-hidden="true" className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <section aria-label={titolo} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="title-card">{titolo}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatNumero(totale)} {totale === 1 ? "pagina" : "pagine"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">
            Colora per
          </span>
          <Segmenti<ModoColore> etichetta="Colora per" opzioni={OPZIONI_COLORE} valore={modo} onChange={setModo} />
        </div>
      </div>

      {!schermoIntero && (
        <>
          {barra}
          {lettore(false)}
        </>
      )}

      {legenda}

      {(!pdf || senzaPosizione > 0) && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {!pdf && "Il PDF del volantino non è disponibile: i box sono disegnati su pagine bianche. "}
          {senzaPosizione > 0 &&
            (senzaPosizione === 1 ? "1 box non ha la posizione nella pagina e non è disegnato." : `${formatNumero(senzaPosizione)} box non hanno la posizione nella pagina e non sono disegnati.`)}
        </p>
      )}

      {!schermoIntero && scheda}

      <Dialog open={schermoIntero} onClose={() => setSchermoIntero(false)} size="2xl">
        <Dialog.Panel className="w-[96vw] sm:w-[96vw] lg:w-[96vw] xl:w-[96vw]">
          <Dialog.Title>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 [overflow-wrap:anywhere]">{titolo}</span>
              <Button type="button" variant="outline-secondary" size="sm" aria-label="Esci dallo schermo intero" title="Esci" onClick={() => setSchermoIntero(false)}>
                <Lucide icon="Minimize2" aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </Dialog.Title>
          <div data-testid="volantino-schermo-intero" className="flex flex-col gap-3 p-4">
            {schermoIntero && (
              <>
                {barra}
                {lettore(true)}
              </>
            )}
          </div>
          <div className="border-t border-slate-200/60 px-5 py-3 dark:border-darkmode-400">{legenda}</div>
          {schermoIntero && scheda}
        </Dialog.Panel>
      </Dialog>
    </section>
  );
}

export default VolantinoSfogliabile;
