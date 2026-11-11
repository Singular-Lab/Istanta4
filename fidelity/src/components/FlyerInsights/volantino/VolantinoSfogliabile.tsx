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
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { BoxInsight, PdfVolantino } from "../../../../lib/insightVolantino/tipi";
import { AnalisiPagina } from "./AnalisiPagina";
import { cercaBox, ordineLettura, risultatoVicino } from "./analisiPagina";
import { marcaFormato, trovaBoxIniziale } from "./box";
import { coloriReparti, gruppoBox, legendaModo, OPZIONI_COLORE, stileBox, TITOLI_LEGENDA, type GruppoBox, type ModoColore, type StileRiquadro } from "./colori";
import {
  aperturaDi,
  aperturaVicina,
  aperture,
  boxPerPagina,
  paginaRichiesta,
  pagineDaPreparare,
  pagineDaSfogliare,
  proporzioneApertura,
  proporzioneDelVolantino,
  proporzioneDellaPagina,
  riquadroBox,
  testoApertura,
  type Apertura,
} from "./geometria";
import { IndicePagine, misuraMiniatura, type VoceIndice } from "./IndicePagine";
import { InterrogaVolantino } from "./InterrogaVolantino";
import { condizioniAttive, INTERROGAZIONE_VUOTA, interroga, type Interrogazione } from "./interrogazione";
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
 * Ingrandimenti rispetto alle pagine adattate allo spazio del lettore (1). Le immagini di Olimpo
 * sono a 150 dpi: oltre il doppio sgranerebbero.
 */
export const LIVELLI_ZOOM: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ZOOM_ADATTA = LIVELLI_ZOOM.indexOf(1);
/**
 * Altezza del palco delle pagine nella pagina: due terzi dello schermo, perché sopra restino i
 * comandi e sotto l'indice senza scorrere.
 */
const ALTEZZA_LETTORE = "h-[min(66vh,44rem)] min-h-[24rem]";
/** A schermo intero il palco prende lo schermo, tolti titolo, comandi e indice. */
const ALTEZZA_SCHERMO_INTERO = "h-[calc(100vh-17rem)] min-h-[22rem]";
/** Da questa larghezza dello schermo le pagine si affiancano come nel volantino aperto. */
const MEDIA_DOPPIA_PAGINA = "(min-width: 768px)";
/** Durata del giro di un foglio, a pagine affiancate e a pagina singola, in ms. */
const DURATA_GIRO = 900;
const DURATA_GIRO_SINGOLA = 650;
/** Il foglio parte piano, accelera a metà e si posa piano, come la carta. */
const ANDATURA_GIRO = "cubic-bezier(0.45, 0.05, 0.25, 1)";
/** Trascinando oltre questi pixel si prende la pagina; sotto è un clic. */
const SOGLIA_TRASCINAMENTO = 6;
/** Lasciata oltre questa parte del giro, la pagina finisce di girare; prima, torna giù. */
const META_GIRO = 0.4;
/** Un colpo veloce gira la pagina anche se è stata alzata poco: px/ms. */
const VELOCITA_COLPO = 0.5;
/** Spessore massimo del volantino ai bordi, in px: cresce con le pagine da quella parte. */
const SPESSORE_MASSIMO = 6;
/** Una pagina senza box: lo stesso array per tutte, perché le pagine non si ridisegnino per nulla. */
const NESSUN_BOX: readonly BoxInsight[] = [];

/* ---------- Doppia pagina e animazioni ---------- */

const ascoltaDoppia = (avvisa: () => void): (() => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(MEDIA_DOPPIA_PAGINA);
  media.addEventListener?.("change", avvisa);
  return () => media.removeEventListener?.("change", avvisa);
};
const leggiDoppia = (): boolean => (typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia(MEDIA_DOPPIA_PAGINA).matches);

/** Pagine affiancate sugli schermi larghi, una alla volta su quelli stretti. */
const useDoppiaPagina = (): boolean => useSyncExternalStore(ascoltaDoppia, leggiDoppia, () => true);

/** Il giro animato si fa dove il browser sa animare e l'utente non chiede di ridurre le animazioni. */
const animazioniAttive = (): boolean =>
  typeof window !== "undefined" &&
  typeof Element !== "undefined" &&
  typeof Element.prototype.animate === "function" &&
  !(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

type Lato = "sinistra" | "destra" | "singola";

/**
 * Una pagina sul palco: ferma, oppure una faccia del foglio che gira. Il fronte è la pagina che si
 * alza, il retro quella che si posa dall'altra parte della piega: ruotano insieme, come un foglio
 * solo, e ciascuna si nasconde quando volta le spalle a chi guarda.
 */
interface Foglio {
  numero: number;
  lato: Lato;
  ruolo: "fermo" | "fronte" | "retro";
}

interface Giro {
  da: Apertura;
  a: Apertura;
  verso: 1 | -1;
  /** La pagina segue il puntatore: il giro avanza solo trascinando. */
  manuale?: boolean;
}

const singola = (aperta: Apertura): boolean => aperta.sinistra === null && aperta.destra === null;

const foglio = (numero: number | null, lato: Lato, ruolo: Foglio["ruolo"]): Foglio[] => (numero === null ? [] : [{ numero, lato, ruolo }]);

/** Le pagine dell'apertura, ferme. */
const fogliDi = (aperta: Apertura): Foglio[] =>
  singola(aperta) ? foglio(aperta.pagine[0], "singola", "fermo") : [...foglio(aperta.sinistra, "sinistra", "fermo"), ...foglio(aperta.destra, "destra", "fermo")];

/**
 * Le pagine durante il giro, come nel volantino: in avanti si alza la pagina destra e sul suo retro
 * c'è la sinistra dell'apertura nuova, mentre sotto compare la destra nuova; indietro il contrario.
 * A pagina singola la pagina si alza verso sinistra e scopre la successiva, o la precedente torna.
 */
function fogliDelGiro({ da, a, verso }: Giro): Foglio[] {
  if (singola(a)) {
    return verso === 1
      ? [...foglio(a.pagine[0], "singola", "fermo"), ...foglio(da.pagine[0], "singola", "fronte")]
      : [...foglio(da.pagine[0], "singola", "fermo"), ...foglio(a.pagine[0], "singola", "retro")];
  }
  return verso === 1
    ? [...foglio(da.sinistra, "sinistra", "fermo"), ...foglio(a.destra, "destra", "fermo"), ...foglio(a.sinistra, "sinistra", "retro"), ...foglio(da.destra, "destra", "fronte")]
    : [...foglio(a.sinistra, "sinistra", "fermo"), ...foglio(da.destra, "destra", "fermo"), ...foglio(a.destra, "destra", "retro"), ...foglio(da.sinistra, "sinistra", "fronte")];
}

/**
 * Di quanto ruota una pagina per arrivare dall'altra parte della piega: verso chi guarda. La pagina
 * sinistra ruota sul suo bordo destro (la piega), la destra e la singola sul bordo sinistro.
 */
const ribaltamento = (lato: Lato): number => (lato === "sinistra" ? 180 : -180);

/**
 * La rotazione di una faccia a una parte del giro (0-1): il fronte va da piatto a rovescio, il retro
 * da rovescio a piatto, tutti e due passando davanti a chi guarda, come le due facce di un foglio
 * solo. A metà il foglio sta in piedi sulla piega e la carta si incurva un poco: il bordo libero
 * cede verso il basso.
 */
function fotogrammiFaccia(voce: Foglio): Keyframe[] {
  const giro = ribaltamento(voce.lato);
  const cede = voce.lato === "sinistra" ? -1 : 1;
  const ruota = (angolo: number, piega = 0) => ({ transform: `rotateY(${angolo}deg) skewY(${piega}deg)` });
  return voce.ruolo === "fronte"
    ? [ruota(0), { ...ruota(giro * 0.25, 1.6 * cede), offset: 0.25 }, { ...ruota(giro * 0.5, 2.6 * cede), offset: 0.5 }, ruota(giro)]
    : [ruota(giro), { ...ruota(giro * 0.5, 2.6 * cede), offset: 0.5 }, { ...ruota(giro * 0.25, 1.6 * cede), offset: 0.75 }, ruota(0)];
}

/**
 * Luce sulle facce: il fronte si scurisce alzandosi (volta le spalle alla luce) con un riflesso
 * che lo attraversa; il retro arriva in ombra e si schiarisce posandosi.
 */
const fotogrammiOmbraFaccia = (ruolo: Foglio["ruolo"]): Keyframe[] =>
  ruolo === "fronte"
    ? [{ opacity: 0 }, { opacity: 0.12, offset: 0.2 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0.55 }]
    : [{ opacity: 0.5 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0.1, offset: 0.85 }, { opacity: 0 }];

const fotogrammiRiflesso = (ruolo: Foglio["ruolo"]): Keyframe[] =>
  ruolo === "fronte"
    ? [{ opacity: 0, backgroundPosition: "120% 0" }, { opacity: 0.55, backgroundPosition: "40% 0", offset: 0.3 }, { opacity: 0, backgroundPosition: "-20% 0", offset: 0.5 }, { opacity: 0 }]
    : [{ opacity: 0 }, { opacity: 0, backgroundPosition: "120% 0", offset: 0.5 }, { opacity: 0.4, backgroundPosition: "50% 0", offset: 0.72 }, { opacity: 0, backgroundPosition: "-20% 0" }];

/**
 * Ombre portate dal foglio sulle pagine sotto: su quella che si scopre l'ombra è forte appena il
 * foglio si alza e svanisce quando passa la piega; su quella che viene coperta cresce mentre il
 * foglio si posa.
 */
const fotogrammiOmbraScoperta: Keyframe[] = [{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0.45, offset: 0.42 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }];
const fotogrammiOmbraCoperta: Keyframe[] = [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 0.75, offset: 0.88 }, { opacity: 0.2 }];

/* ---------- Comandi ---------- */

interface NavigazioneProps {
  aperta: Apertura;
  totale: number;
  indietro: boolean;
  avanti: boolean;
  onGira: (passo: 1 | -1) => void;
  onVai: (pagina: number) => void;
}

/** Gira indietro, le pagine aperte sul totale, "Vai a" e gira avanti. */
function Navigazione({ aperta, totale, indietro, avanti, onGira, onVai }: NavigazioneProps) {
  const [testo, setTesto] = useState("");
  const conferma = () => {
    const numero = paginaRichiesta(testo, totale);
    setTesto("");
    if (numero !== null) onVai(numero);
  };
  const tasto = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Enter") conferma();
    if (evento.key === "Escape") setTesto("");
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" variant="outline-secondary" size="sm" aria-label="Gira indietro" title="Gira indietro" disabled={!indietro} onClick={() => onGira(-1)}>
        <Lucide icon="ChevronLeft" aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span data-testid="pagine-aperte" className="min-w-24 text-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {testoApertura(aperta.pagine)} <span className="font-normal text-slate-500 dark:text-slate-400">di {formatNumero(totale)}</span>
      </span>
      <Button type="button" variant="outline-secondary" size="sm" aria-label="Gira avanti" title="Gira avanti" disabled={!avanti} onClick={() => onGira(1)}>
        <Lucide icon="ChevronRight" aria-hidden="true" className="h-4 w-4" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Vai alla pagina"
        placeholder="Vai a…"
        value={testo}
        onChange={evento => setTesto(evento.target.value)}
        onBlur={() => testo && conferma()}
        onKeyDown={tasto}
        className="h-8 w-16 rounded-control border border-slate-200 bg-white text-center text-xs tabular-nums text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-100"
      />
    </div>
  );
}

/** Adatta allo spazio, riduci e ingrandisci, con la percentuale. */
function ControlliZoom({ zoom, onZoom }: { zoom: number; onZoom: (indice: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Adatta allo spazio"
        title="Adatta allo spazio"
        aria-pressed={zoom === ZOOM_ADATTA}
        onClick={() => onZoom(ZOOM_ADATTA)}
      >
        <Lucide icon="Expand" aria-hidden="true" className="h-4 w-4" />
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
  /** I box trovati da ricerca e condizioni, in ordine di lettura; null: nessuna ricerca né condizione. */
  risultati: readonly BoxInsight[] | null;
  /** Il risultato a cui si è arrivati con precedente e successivo; -1 nessuno. */
  attuale: number;
  onPassa: (passo: 1 | -1) => void;
}

/**
 * "Cerca prodotto, marca, EAN o codice": quanti box e in quante pagine (anche con le condizioni
 * dell'interrogazione), e i comandi per passare da un box trovato all'altro. Invio porta al
 * successivo, Maiusc+Invio al precedente, Esc cancella la ricerca.
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
  const cercato = testo.trim();
  const stato =
    risultati === null
      ? ""
      : quanti === 0
        ? cercato
          ? `Nessun box per «${cercato}»`
          : "Nessun box corrisponde"
        : trovato
          ? `${formatNumero(attuale + 1)} di ${formatNumero(quanti)} · pagina ${formatNumero(trovato.pagina ?? 0)}`
          : `${quanti === 1 ? "1 box" : `${formatNumero(quanti)} box`} in ${pagine === 1 ? "1 pagina" : `${formatNumero(pagine)} pagine`}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CampoRicerca
        etichetta="Cerca prodotto, marca, EAN o codice"
        placeholder="Prodotto, marca, EAN o codice…"
        value={testo}
        onChange={onTesto}
        onKeyDown={tasto}
        className="w-full sm:w-64"
      />
      {quanti > 0 && (
        <>
          <Button type="button" variant="outline-secondary" size="sm" aria-label="Box trovato precedente" title="Box trovato precedente" onClick={() => onPassa(-1)}>
            <Lucide icon="ArrowLeft" aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline-secondary" size="sm" aria-label="Box trovato successivo" title="Box trovato successivo" onClick={() => onPassa(1)}>
            <Lucide icon="ArrowRight" aria-hidden="true" className="h-4 w-4" />
          </Button>
        </>
      )}
      <span role="status" aria-live="polite" data-testid="esito-ricerca" className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {stato}
      </span>
    </div>
  );
}

/* ---------- Il palco delle pagine ---------- */

interface PalcoProps {
  aperta: Apertura;
  doppia: boolean;
  totale: number;
  /** Proporzione (larghezza/altezza) di una pagina. */
  proporzione: (pagina: number) => number;
  /** Le aperture prima e dopo quella davanti all'utente; null ai bordi del volantino. */
  precedente: Apertura | null;
  successiva: Apertura | null;
  onGira: (passo: 1 | -1) => void;
  onVai: (pagina: number) => void;
  zoom: number;
  onZoom: (indice: number) => void;
  /** Classi dell'altezza del palco. */
  altezza: string;
  pagina: (numero: number, lato: Lato) => ReactNode;
  /** Le immagini delle pagine vicine, da scaricare prima che servano. */
  daPreparare: readonly string[];
}

/** Lo spessore delle pagine da una parte del volantino aperto, in px: si vede ai bordi. */
const spessore = (pagine: number): number => (pagine <= 0 ? 0 : Math.min(SPESSORE_MASSIMO, 1 + Math.ceil(pagine / 4)));

/** Dove si è preso il palco: per seguire il foglio col puntatore e decidere al rilascio. */
interface Presa {
  x: number;
  y: number;
  sinistra: number;
  alto: number;
  mosso: boolean;
  tocco: boolean;
  /** Il foglio preso: si gira avanti (1) o indietro (-1); null se non si sta girando. */
  verso: 1 | -1 | null;
  /** La parte del giro sotto il puntatore quando si è preso il foglio: da lì si parte da zero. */
  partenza: number;
  /** Quanto è girato il foglio, 0-1. */
  progresso: number;
  ultimaX: number;
  ultimoTempo: number;
  /** Velocità orizzontale dell'ultimo tratto, px/ms. */
  velocita: number;
}

/** Sotto questi pixel in orizzontale, senza animazioni, il trascinamento non gira la pagina. */
const SOGLIA_GIRO = 60;

const tra = (valore: number, minimo: number, massimo: number): number => Math.min(massimo, Math.max(minimo, valore));

/**
 * Il palco: le pagine aperte come nel volantino stampato, adattate allo spazio, con la piega in
 * mezzo, le pagine che si incurvano verso la piega e lo spessore delle pagine ai bordi. Il foglio
 * gira come carta vera: ruota sulla piega con il fronte e il retro, cambia luce, getta l'ombra
 * sulle pagine sotto e il bordo libero cede un poco. Si gira con i comandi, con le frecce (anche ai
 * lati del palco), con un clic sull'angolo esterno, oppure prendendo la pagina e trascinandola:
 * il foglio segue il puntatore e, lasciato, finisce di girare o torna giù. Ingrandite, le pagine si
 * trascinano per muoversi. Senza animazioni (sistema che le chiede ridotte) la pagina cambia
 * subito. Da tastiera: frecce sinistra e destra (o Pagina su e giù) girano, Home e Fine portano
 * alla copertina e all'ultima, + e - ingrandiscono e riducono, 0 adatta.
 */
function Palco({ aperta, doppia, totale, proporzione, precedente, successiva, onGira, onVai, zoom, onZoom, altezza, pagina, daPreparare }: PalcoProps) {
  const palco = useRef<HTMLDivElement>(null);
  const libro = useRef<HTMLDivElement>(null);
  const fogliRef = useRef(new Map<number, HTMLDivElement>());
  const ombraScoperta = useRef<HTMLSpanElement>(null);
  const ombraCoperta = useRef<HTMLSpanElement>(null);
  const animazioni = useRef<Animation[]>([]);

  // Il giro parte quando cambia l'apertura (non quando cambia il modo, pagine affiancate o singole)
  const [mostrata, setMostrata] = useState({ chiave: aperta.chiave, aperta, doppia });
  const [giro, setGiro] = useState<Giro | null>(null);
  if (mostrata.chiave !== aperta.chiave || mostrata.doppia !== doppia) {
    setMostrata({ chiave: aperta.chiave, aperta, doppia });
    setGiro(
      mostrata.doppia === doppia && animazioniAttive()
        ? { da: giro ? giro.a : mostrata.aperta, a: aperta, verso: aperta.chiave > mostrata.chiave ? 1 : -1 }
        : null
    );
  }

  // Il giro: le due facce del foglio, le loro luci e le ombre portate, tutte sullo stesso tempo.
  // Preso col puntatore il giro resta fermo e lo muove il trascinamento; un giro nuovo prima della
  // fine annulla il precedente
  useEffect(() => {
    if (!giro) return;
    const tempi: KeyframeAnimationOptions = {
      duration: singola(giro.a) ? DURATA_GIRO_SINGOLA : DURATA_GIRO,
      easing: giro.manuale ? "linear" : ANDATURA_GIRO,
      fill: "both",
    };
    const elenco: Animation[] = [];
    const anima = (nodo: Element | null | undefined, fotogrammi: Keyframe[]) => {
      if (nodo && typeof nodo.animate === "function") elenco.push(nodo.animate(fotogrammi, tempi));
    };
    for (const voce of fogliDelGiro(giro)) {
      if (voce.ruolo === "fermo") continue;
      const nodo = fogliRef.current.get(voce.numero);
      anima(nodo, fotogrammiFaccia(voce));
      anima(nodo?.querySelector("[data-ombra]"), fotogrammiOmbraFaccia(voce.ruolo));
      anima(nodo?.querySelector("[data-riflesso]"), fotogrammiRiflesso(voce.ruolo));
    }
    anima(ombraScoperta.current, fotogrammiOmbraScoperta);
    anima(ombraCoperta.current, fotogrammiOmbraCoperta);
    animazioni.current = elenco;
    let attivo = true;
    if (giro.manuale) {
      for (const animazione of elenco) animazione.pause();
    } else {
      Promise.all(elenco.map(animazione => animazione.finished)).then(
        () => {
          if (attivo) setGiro(null);
        },
        () => {}
      );
    }
    return () => {
      attivo = false;
      animazioni.current = [];
      for (const animazione of elenco) animazione.cancel();
    };
  }, [giro]);

  // Cambiando zoom si resta al centro delle pagine
  const primoZoom = useRef(true);
  useEffect(() => {
    if (primoZoom.current) {
      primoZoom.current = false;
      return;
    }
    const nodo = palco.current;
    if (!nodo) return;
    nodo.scrollLeft = Math.max(0, (nodo.scrollWidth - nodo.clientWidth) / 2);
    nodo.scrollTop = Math.max(0, (nodo.scrollHeight - nodo.clientHeight) / 2);
  }, [zoom]);

  const destinazione = giro ? giro.a : aperta;
  const fogli = giro ? fogliDelGiro(giro) : fogliDi(aperta);
  const { totale: proporzioneLibro, sinistra } = proporzioneApertura(destinazione, proporzione);
  const piega = proporzioneLibro > 0 ? (sinistra / proporzioneLibro) * 100 : 50;
  const fattore = LIVELLI_ZOOM[zoom];
  const ingrandite = zoom > ZOOM_ADATTA;

  /**
   * Quanto è girato il foglio (0-1) con il bordo libero sotto il puntatore: il bordo di un foglio
   * girato di un angolo sta, visto di fronte, a larghezza × coseno dalla piega.
   */
  const progressoDi = (x: number, verso: 1 | -1): number => {
    const rettangolo = libro.current?.getBoundingClientRect();
    if (!rettangolo || rettangolo.width <= 0) return 0;
    if (singola(destinazione)) {
      const angolo = Math.acos(tra((x - rettangolo.left) / rettangolo.width, -1, 1)) / Math.PI;
      return verso === 1 ? angolo : 1 - angolo;
    }
    const xPiega = rettangolo.left + (rettangolo.width * piega) / 100;
    const larghezza = verso === 1 ? rettangolo.right - xPiega : xPiega - rettangolo.left;
    if (larghezza <= 0) return 0;
    return Math.acos(tra((verso === 1 ? x - xPiega : xPiega - x) / larghezza, -1, 1)) / Math.PI;
  };

  /** Il foglio lasciato: finisce di girare (e l'apertura nuova diventa quella mostrata) o torna giù. */
  const rilascia = (completa: boolean, preso: Giro) => {
    const elenco = animazioni.current;
    const fine = () => {
      if (completa) {
        // L'apertura nuova è già quella mostrata: cambiando, non riparte un altro giro
        setMostrata({ chiave: preso.a.chiave, aperta: preso.a, doppia });
        setGiro(null);
        onGira(preso.verso);
      } else {
        setGiro(null);
      }
    };
    if (elenco.length === 0) {
      fine();
      return;
    }
    for (const animazione of elenco) {
      animazione.playbackRate = completa ? 1.5 : -1.5;
      animazione.play();
    }
    Promise.all(elenco.map(animazione => animazione.finished)).then(fine, () => {});
  };

  // Trascinare: in orizzontale si prende il foglio e lo si gira; con le pagine ingrandite si sposta
  // la vista (col mouse: al tocco lo scorrimento è del browser). Dopo un trascinamento il clic non
  // apre un box
  const presa = useRef<Presa | null>(null);
  const ignoraClic = useRef(false);
  const giu = (evento: PointerEvent<HTMLDivElement>) => {
    ignoraClic.current = false;
    if (evento.button !== 0 || !palco.current || (giro && !giro.manuale)) return;
    presa.current = {
      x: evento.clientX,
      y: evento.clientY,
      sinistra: palco.current.scrollLeft,
      alto: palco.current.scrollTop,
      mosso: false,
      tocco: evento.pointerType === "touch",
      verso: null,
      partenza: 0,
      progresso: 0,
      ultimaX: evento.clientX,
      ultimoTempo: Date.now(),
      velocita: 0,
    };
  };
  const muovi = (evento: PointerEvent<HTMLDivElement>) => {
    const inizio = presa.current;
    const nodo = palco.current;
    if (!inizio || !nodo) return;
    const dx = evento.clientX - inizio.x;
    const dy = evento.clientY - inizio.y;
    const ora = Date.now();
    if (ora > inizio.ultimoTempo) {
      inizio.velocita = (evento.clientX - inizio.ultimaX) / (ora - inizio.ultimoTempo);
      inizio.ultimaX = evento.clientX;
      inizio.ultimoTempo = ora;
    }
    if (!inizio.mosso && Math.hypot(dx, dy) > SOGLIA_TRASCINAMENTO) {
      inizio.mosso = true;
      const verso: 1 | -1 = dx < 0 ? 1 : -1;
      const vicina = verso === 1 ? successiva : precedente;
      if (!ingrandite && Math.abs(dx) > Math.abs(dy) && vicina) {
        inizio.verso = verso;
        inizio.partenza = progressoDi(inizio.x, verso);
        // Il foglio resta in mano anche se il puntatore esce dal palco
        try {
          nodo.setPointerCapture?.(evento.pointerId);
        } catch {
          // Puntatore già rilasciato: si continua senza
        }
        if (animazioniAttive()) setGiro({ da: aperta, a: vicina, verso, manuale: true });
      }
    }
    if (!inizio.mosso) return;
    if (ingrandite && !inizio.tocco) {
      nodo.scrollLeft = inizio.sinistra - dx;
      nodo.scrollTop = inizio.alto - dy;
      return;
    }
    if (inizio.verso === null) return;
    inizio.progresso = tra((progressoDi(evento.clientX, inizio.verso) - inizio.partenza) / Math.max(0.05, 1 - inizio.partenza), 0, 1);
    const durata = singola(destinazione) ? DURATA_GIRO_SINGOLA : DURATA_GIRO;
    for (const animazione of animazioni.current) animazione.currentTime = inizio.progresso * durata;
  };
  const su = (evento: PointerEvent<HTMLDivElement>) => {
    const inizio = presa.current;
    presa.current = null;
    if (!inizio?.mosso) return;
    ignoraClic.current = true;
    if (inizio.verso === null) return;
    const dx = evento.clientX - inizio.x;
    const dy = evento.clientY - inizio.y;
    if (giro?.manuale) {
      const colpo = -inizio.velocita * inizio.verso > VELOCITA_COLPO;
      rilascia(inizio.progresso > META_GIRO || colpo, giro);
      return;
    }
    // Senza animazioni conta solo quanto si è trascinato
    if (Math.abs(dx) > SOGLIA_GIRO && Math.abs(dx) > Math.abs(dy) * 1.2) onGira(inizio.verso);
  };
  const lascia = () => {
    const inizio = presa.current;
    presa.current = null;
    if (inizio && inizio.verso !== null && giro?.manuale) rilascia(false, giro);
  };
  const clic = (evento: MouseEvent<HTMLDivElement>) => {
    if (!ignoraClic.current) return;
    ignoraClic.current = false;
    evento.preventDefault();
    evento.stopPropagation();
  };

  const tasto = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    // I tasti sui box (Invio, spazio) restano ai box
    const azioni: Record<string, () => void> = {
      ArrowLeft: () => onGira(-1),
      PageUp: () => onGira(-1),
      ArrowRight: () => onGira(1),
      PageDown: () => onGira(1),
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

  const indietro = precedente !== null;
  const avanti = successiva !== null;
  const posto = (lato: Lato): { left: string; width: string } =>
    lato === "singola" ? { left: "0%", width: "100%" } : lato === "sinistra" ? { left: "0%", width: `${piega}%` } : { left: `${piega}%`, width: `${100 - piega}%` };
  const affiancate = !singola(destinazione);
  const conPiega = affiancate && destinazione.sinistra !== null && destinazione.destra !== null;
  // L'angolo per girare indietro sta sulla pagina sinistra, se c'è (la copertina non ha una pagina a sinistra)
  const angoloIndietro = indietro && !giro && (!affiancate || destinazione.sinistra !== null);
  const angoloAvanti = avanti && !giro && (!affiancate || destinazione.destra !== null);
  // Lo spessore delle pagine prima e dopo quelle aperte, ai bordi del volantino
  const spessorePrima = affiancate && destinazione.sinistra !== null ? spessore(destinazione.pagine[0] - 1) : 0;
  const spessoreDopo = affiancate && destinazione.destra !== null ? spessore(totale - destinazione.pagine[destinazione.pagine.length - 1]) : 0;
  // Le ombre portate: sulla pagina che il foglio scopre e su quella che copre
  const latoScoperto: Lato = !giro || singola(giro.a) ? "singola" : giro.verso === 1 ? "destra" : "sinistra";
  const latoCoperto: Lato = !giro || singola(giro.a) ? "singola" : giro.verso === 1 ? "sinistra" : "destra";
  const sfumaturaDallaPiega = (lato: Lato, forza: number, fino: number) =>
    `linear-gradient(${lato === "sinistra" ? "to left" : "to right"}, rgba(15,23,42,${forza}), rgba(15,23,42,${forza / 3}) ${fino / 3}%, rgba(15,23,42,0) ${fino}%)`;

  return (
    <div className={twMerge("relative min-h-0 min-w-0", altezza)}>
      <div
        ref={palco}
        role="region"
        aria-label="Pagine del volantino"
        aria-roledescription="volantino da sfogliare"
        aria-keyshortcuts="ArrowLeft ArrowRight Home End + - 0"
        tabIndex={0}
        onKeyDown={tasto}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={lascia}
        onLostPointerCapture={lascia}
        onPointerLeave={() => {
          // Senza cattura (browser che non la offrono) uscire dal palco lascia il foglio
          if (presa.current && presa.current.verso === null) presa.current = null;
        }}
        onClickCapture={clic}
        data-testid="lettore-pagine"
        className={twMerge(
          "h-full w-full overflow-auto overscroll-contain rounded-control border border-slate-200 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-darkmode-400 dark:bg-darkmode-800",
          ingrandite ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        style={{ containerType: "size", touchAction: ingrandite ? "auto" : "pan-y pinch-zoom" }}
      >
        <div className="flex min-h-full min-w-full px-4 py-3 sm:px-12">
          <div
            ref={libro}
            data-testid="libro"
            data-zoom={fattore}
            data-pagine={destinazione.pagine.join("-")}
            data-giro={giro ? (giro.manuale ? "manuale" : "animato") : undefined}
            className={twMerge("relative m-auto flex-none select-none", giro && "[&_*]:pointer-events-none")}
            style={{
              aspectRatio: String(proporzioneLibro),
              width: `calc(min(100cqw - 6rem, (100cqh - 1.5rem) * ${Number(proporzioneLibro.toFixed(4))}) * ${fattore})`,
              perspective: "2200px",
            }}
          >
            {/* Lo spessore delle pagine già sfogliate e di quelle ancora da sfogliare */}
            {spessorePrima > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-[0.6%] right-full rounded-l-sm shadow-sm"
                style={{ width: spessorePrima, background: "repeating-linear-gradient(to left, rgba(148,163,184,0.7) 0 1px, rgba(248,250,252,0.95) 1px 2px)" }}
              />
            )}
            {spessoreDopo > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-[0.6%] left-full rounded-r-sm shadow-sm"
                style={{ width: spessoreDopo, background: "repeating-linear-gradient(to right, rgba(148,163,184,0.7) 0 1px, rgba(248,250,252,0.95) 1px 2px)" }}
              />
            )}
            {fogli.map(voce => {
              const faccia = voce.ruolo !== "fermo";
              return (
                <div
                  key={voce.numero}
                  data-foglio={voce.ruolo}
                  ref={elemento => {
                    if (elemento) fogliRef.current.set(voce.numero, elemento);
                    else fogliRef.current.delete(voce.numero);
                  }}
                  // Un blocco, non un flex: la pagina prende tutta la larghezza del suo posto e
                  // l'altezza dalla sua proporzione, cioè esattamente lo spazio della sua immagine
                  className="absolute inset-y-0 block"
                  style={{
                    ...posto(voce.lato),
                    zIndex: voce.ruolo === "fermo" ? 1 : voce.ruolo === "retro" ? 3 : 4,
                    transformOrigin: voce.lato === "sinistra" ? "right center" : "left center",
                    // Prima che il giro parta il retro sta rovesciato dall'altra parte: non si vede
                    transform: voce.ruolo === "retro" ? `rotateY(${ribaltamento(voce.lato)}deg)` : undefined,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    willChange: faccia ? "transform" : undefined,
                  }}
                >
                  {pagina(voce.numero, voce.lato)}
                  {/* La carta si incurva verso la piega: un'ombra leggera lungo il dorso */}
                  {voce.lato !== "singola" && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: sfumaturaDallaPiega(voce.lato, 0.2, 14) }} />
                  )}
                  {faccia && (
                    <>
                      <span
                        data-ombra=""
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-0"
                        style={{ background: sfumaturaDallaPiega(voce.lato === "singola" ? "destra" : voce.lato, 0.9, 100) }}
                      />
                      <span
                        data-riflesso=""
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-0"
                        style={{
                          backgroundImage: "linear-gradient(100deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 65%)",
                          backgroundSize: "250% 100%",
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })}
            {/* Le ombre che il foglio getta sulle pagine sotto */}
            {giro && (
              <>
                <span
                  ref={ombraScoperta}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 opacity-0"
                  style={{ ...posto(latoScoperto), zIndex: 2, background: sfumaturaDallaPiega(latoScoperto === "singola" ? "destra" : latoScoperto, 0.55, 70) }}
                />
                <span
                  ref={ombraCoperta}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 opacity-0"
                  style={{ ...posto(latoCoperto), zIndex: 2, background: sfumaturaDallaPiega(latoCoperto === "singola" ? "destra" : latoCoperto, 0.5, 80) }}
                />
              </>
            )}
            {/* La piega in mezzo alle pagine affiancate */}
            {conPiega && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-8 -translate-x-1/2 bg-[linear-gradient(to_right,rgba(15,23,42,0)_0%,rgba(15,23,42,0.12)_44%,rgba(15,23,42,0.28)_50%,rgba(15,23,42,0.12)_56%,rgba(15,23,42,0)_100%)]"
                style={{ left: `${piega}%`, zIndex: 2 }}
              />
            )}
            {/* Gli angoli esterni: un clic gira la pagina, come prenderla per l'angolo */}
            {angoloIndietro && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                data-testid="angolo-indietro"
                title="Gira indietro"
                onClick={() => onGira(-1)}
                className="group absolute bottom-0 left-0 z-[5] h-[11%] w-[9%] cursor-pointer"
              >
                <span className="absolute inset-0 rounded-bl-control bg-[linear-gradient(225deg,transparent_50%,rgba(15,23,42,0.18)_50%,rgba(255,255,255,0.97)_62%,rgba(226,232,240,0.95)_100%)] opacity-0 shadow-[2px_-2px_6px_-2px_rgba(15,23,42,0.35)] transition-opacity group-hover:opacity-100" />
              </button>
            )}
            {angoloAvanti && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                data-testid="angolo-avanti"
                title="Gira avanti"
                onClick={() => onGira(1)}
                className="group absolute bottom-0 right-0 z-[5] h-[11%] w-[9%] cursor-pointer"
              >
                <span className="absolute inset-0 rounded-br-control bg-[linear-gradient(135deg,transparent_50%,rgba(15,23,42,0.18)_50%,rgba(255,255,255,0.97)_62%,rgba(226,232,240,0.95)_100%)] opacity-0 shadow-[-2px_-2px_6px_-2px_rgba(15,23,42,0.35)] transition-opacity group-hover:opacity-100" />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Le frecce ai lati del palco, per il mouse: da tastiera ci sono i comandi e le frecce */}
      {indietro && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="freccia-indietro"
          onClick={() => onGira(-1)}
          className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900 sm:flex dark:border-darkmode-400 dark:bg-darkmode-700/90 dark:text-slate-300"
        >
          <Lucide icon="ChevronLeft" className="h-5 w-5" />
        </button>
      )}
      {avanti && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="freccia-avanti"
          onClick={() => onGira(1)}
          className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900 sm:flex dark:border-darkmode-400 dark:bg-darkmode-700/90 dark:text-slate-300"
        >
          <Lucide icon="ChevronRight" className="h-5 w-5" />
        </button>
      )}
      {/* Le immagini delle pagine vicine si scaricano prima, perché girando pagina siano pronte */}
      <div hidden data-testid="pagine-pronte">
        {daPreparare.map(url => (
          <img key={url} src={url} alt="" decoding="async" />
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {testoApertura(aperta.pagine)} di {totale}
      </p>
    </div>
  );
}

/* ---------- Il volantino ---------- */

/**
 * Il volantino negli insight, da sfogliare come quello stampato: le pagine aperte (la copertina da
 * sola, poi a due a due; una alla volta sugli schermi stretti) con le immagini di Olimpo e sopra i
 * riquadri dei box colorati per reparto, meccanica o sconto. Sotto l'indice delle pagine; a fianco
 * l'analisi delle pagine aperte e l'interrogazione dei box; sopra le pagine aperte, "Vai a", la
 * ricerca, lo zoom e lo schermo intero. Un clic (o Invio) su un riquadro apre la scheda del box, e
 * da lì il viaggio del prodotto. Senza PDF le pagine sono bianche.
 */
export function VolantinoSfogliabile(props: VolantinoSfogliabileProps) {
  // Un altro volantino riparte da capo: pagina, box scelto, scheda, zoom e interrogazione
  return <Sfogliabile key={props.idKit} {...props} />;
}

type Pannello = "pagine" | "interroga";

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
  const [interrogazione, setInterrogazione] = useState<Interrogazione>(INTERROGAZIONE_VUOTA);
  const [pannello, setPannello] = useState<Pannello>("pagine");
  /** Il risultato a cui si è arrivati, per la ricerca e le condizioni di quel momento. */
  const [passaggio, setPassaggio] = useState<{ firma: string; indice: number }>({ firma: "", indice: -1 });
  /** Il box su cui si passa negli elenchi del pannello. */
  const [rilievoElenco, setRilievoElenco] = useState<string | null>(null);
  const idPannello = useId();

  const doppia = useDoppiaPagina();
  const controllata = pagina !== undefined;
  const totale = pagineDaSfogliare(totalePagine, box);
  const limita = useCallback((numero: number) => Math.min(totale, Math.max(1, Math.floor(numero) || 1)), [totale]);
  const corrente = limita(controllata ? pagina : paginaInterna);
  const aperta = aperturaDi(corrente, totale, doppia);
  const elencoAperture = useMemo(() => aperture(totale, doppia), [totale, doppia]);
  const precedente = aperturaVicina(corrente, totale, doppia, -1);
  const successiva = aperturaVicina(corrente, totale, doppia, 1);

  const vaiAllaPagina = useCallback(
    (nuova: number) => {
      const numero = limita(nuova);
      if (!controllata) setPaginaInterna(numero);
      onCambiaPagina?.(numero);
    },
    [controllata, limita, onCambiaPagina]
  );
  const gira = (passo: 1 | -1) => {
    const vicina = passo === 1 ? successiva : precedente;
    if (vicina) vaiAllaPagina(vicina.pagine[0]);
  };
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
  const proporzione = useCallback((numero: number) => proporzioneDellaPagina(box, numero, proporzioneBase), [box, proporzioneBase]);
  const reparti = useMemo(() => coloriReparti(box, configurazione), [box, configurazione]);
  const senzaPosizione = useMemo(() => box.filter(voce => voce.pagina === null || !riquadroBox(voce.geometria)).length, [box]);

  const stile = useCallback((voce: BoxInsight): StileRiquadro => stileBox(voce, modo, reparti), [modo, reparti]);
  const voci = useMemo<VoceLegenda[]>(() => legendaModo(modo, box, reparti), [box, modo, reparti]);
  const gruppo = useCallback((voce: BoxInsight): GruppoBox => gruppoBox(voce, modo, reparti), [modo, reparti]);
  const perReparto = useCallback((voce: BoxInsight): GruppoBox => gruppoBox(voce, "reparto", reparti), [reparti]);
  const perMeccanica = useCallback((voce: BoxInsight): GruppoBox => gruppoBox(voce, "meccanica", reparti), [reparti]);

  // Ricerca e interrogazione insieme: i box trovati restano in evidenza e gli altri si attenuano;
  // senza risultati, o senza ricerca né condizioni, i riquadri restano come sono
  const testoCercato = useDeferredValue(ricerca);
  const domanda = useDeferredValue(interrogazione);
  const daTesto = useMemo(() => cercaBox(box, testoCercato), [box, testoCercato]);
  const daDomanda = useMemo(() => interroga(box, domanda), [box, domanda]);
  const risultati = useMemo(() => {
    if (daTesto === null) return daDomanda;
    if (daDomanda === null) return daTesto;
    const risposte = new Set(daDomanda.map(voce => voce.id));
    return daTesto.filter(voce => risposte.has(voce.id)).sort(ordineLettura);
  }, [daTesto, daDomanda]);
  const trovati = useMemo(() => (risultati && risultati.length > 0 ? new Set(risultati.map(voce => voce.id)) : null), [risultati]);
  const trovatiPerPagina = useMemo(() => {
    const conti = new Map<number, number>();
    for (const voce of risultati ?? []) {
      if (voce.pagina !== null) conti.set(voce.pagina, (conti.get(voce.pagina) ?? 0) + 1);
    }
    return conti;
  }, [risultati]);
  const firma = `${testoCercato}\u0000${JSON.stringify(domanda)}`;
  const attuale = risultati && passaggio.firma === firma && passaggio.indice < risultati.length ? passaggio.indice : -1;
  const passaAlRisultato = (passo: 1 | -1) => {
    if (!risultati || risultati.length === 0) return;
    const indice = risultatoVicino(risultati, attuale, passo, corrente);
    setPassaggio({ firma, indice });
    const voce = risultati[indice];
    if (voce.pagina !== null) vaiAllaPagina(voce.pagina);
  };

  // In rilievo il box su cui si passa negli elenchi, altrimenti il risultato raggiunto
  const rilievo = rilievoElenco ?? (attuale >= 0 && risultati ? risultati[attuale].id : null);
  const paginaDelBox = useMemo(() => new Map(box.map(voce => [voce.id, voce.pagina])), [box]);
  // Ogni pagina riceve solo ciò che la riguarda: le altre non si ridisegnano
  const diQuestaPagina = (id: string | null, numero: number): string | null => (id !== null && paginaDelBox.get(id) === numero ? id : null);

  // Le pagine oltre quelle del PDF restano bianche; pagine 0 vuol dire che Olimpo non le ha contate
  const conImmagine = (numero: number): string | null =>
    pdf && pdf.idOlimpoCloud && (pdf.pagine <= 0 || numero <= pdf.pagine) ? pdf.idOlimpoCloud : null;

  const boxScelto = selezionato ? (box.find(voce => voce.id === selezionato) ?? null) : null;

  const paginaDisegnata = (numero: number, lato: Lato) => {
    const idOlimpo = conImmagine(numero);
    return (
      <PaginaConImmagine
        numero={numero}
        lato={lato}
        proporzione={proporzione(numero)}
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

  const daPreparare = pagineDaPreparare(corrente, totale, doppia).flatMap(numero => {
    const idOlimpo = conImmagine(numero);
    return idOlimpo ? [urlPaginaMateriale(idOlimpo, numero)] : [];
  });

  // Le miniature dell'indice si chiedono a Olimpo già ridotte: pochi KB l'una
  const indice: VoceIndice[] = Array.from({ length: totale }, (_, posto) => {
    const numero = posto + 1;
    const suaProporzione = proporzione(numero);
    const idOlimpo = conImmagine(numero);
    return {
      numero,
      proporzione: suaProporzione,
      box: (perPagina.get(numero) ?? NESSUN_BOX).filter(voce => riquadroBox(voce.geometria)).length,
      immagine: idOlimpo ? urlPaginaMateriale(idOlimpo, numero, misuraMiniatura(suaProporzione)) : null,
      trovati: trovati ? (trovatiPerPagina.get(numero) ?? 0) : null,
    };
  });

  const boxAperti = useMemo(() => aperta.pagine.flatMap(numero => perPagina.get(numero) ?? NESSUN_BOX), [aperta.pagine, perPagina]);

  const apriDalPannello = (voce: BoxInsight) => {
    apriBox(voce);
    if (voce.pagina !== null) vaiAllaPagina(voce.pagina);
  };

  const condizioni = condizioniAttive(interrogazione);
  const schede: Array<{ valore: Pannello; etichetta: string }> = [
    { valore: "pagine", etichetta: "Pagine aperte" },
    { valore: "interroga", etichetta: "Interroga" },
  ];

  const laterale = (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Pannello del volantino" className="flex gap-1 rounded-control bg-slate-100 p-1 dark:bg-darkmode-800">
        {schede.map(scheda => {
          const scelta = scheda.valore === pannello;
          return (
            <button
              key={scheda.valore}
              type="button"
              role="tab"
              id={`${idPannello}-${scheda.valore}`}
              aria-selected={scelta}
              aria-controls={`${idPannello}-pannello`}
              onClick={() => setPannello(scheda.valore)}
              className={twMerge(
                "flex flex-1 items-center justify-center gap-1.5 rounded-control px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                scelta ? "bg-white text-slate-800 shadow-sm dark:bg-darkmode-600 dark:text-slate-100" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              {scheda.etichetta}
              {scheda.valore === "interroga" && condizioni > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-3xs tabular-nums text-white dark:bg-indigo-400 dark:text-darkmode-800">{formatNumero(condizioni)}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${idPannello}-pannello`} aria-labelledby={`${idPannello}-${pannello}`}>
        {pannello === "pagine" ? (
          <AnalisiPagina
            pagine={aperta.pagine}
            totale={totale}
            box={boxAperti}
            gruppo={gruppo}
            titoloRipartizione={TITOLI_LEGENDA[modo]}
            selezionato={selezionato}
            trovati={trovati}
            onRilievo={setRilievoElenco}
            onApri={apriBox}
          />
        ) : (
          <div className="rounded-control border border-slate-200 bg-white p-4 dark:border-darkmode-400 dark:bg-darkmode-700">
            <InterrogaVolantino
              box={box}
              base={daTesto ?? box}
              interrogazione={interrogazione}
              onCambia={setInterrogazione}
              risultati={risultati}
              perReparto={perReparto}
              perMeccanica={perMeccanica}
              gruppo={gruppo}
              selezionato={selezionato}
              onRilievo={setRilievoElenco}
              onApri={apriDalPannello}
            />
          </div>
        )}
      </div>
    </div>
  );

  const lettore = (inGrande: boolean) => (
    <div className="flex min-w-0 flex-col gap-3 xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Palco
          aperta={aperta}
          doppia={doppia}
          totale={totale}
          proporzione={proporzione}
          precedente={precedente}
          successiva={successiva}
          onGira={gira}
          onVai={vaiAllaPagina}
          zoom={zoom}
          onZoom={zoomTra}
          altezza={inGrande ? ALTEZZA_SCHERMO_INTERO : ALTEZZA_LETTORE}
          pagina={paginaDisegnata}
          daPreparare={daPreparare}
        />
        <IndicePagine voci={indice} aperture={elencoAperture} aperta={aperta} onVai={vaiAllaPagina} />
      </div>
      {/* Sugli schermi larghi il pannello è alto quanto palco e indice e scorre da solo; sotto, segue */}
      <div className="relative min-w-0 xl:w-96 xl:flex-none">
        <div className="max-h-[36rem] overflow-y-auto overscroll-contain xl:absolute xl:inset-0 xl:max-h-none">{laterale}</div>
      </div>
    </div>
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
        <Navigazione aperta={aperta} totale={totale} indietro={precedente !== null} avanti={successiva !== null} onGira={gira} onVai={vaiAllaPagina} />
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
