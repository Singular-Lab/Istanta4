import Button from "@/components/Base/Button";
import FormSelect from "@/components/Base/Form/FormSelect";
import { Dialog, Slideover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import { Legenda, type ContenutoTooltip, type VoceLegenda } from "@/components/Grafici";
import { periodoValidita } from "@/pages/PuntiVenditaConsultazione/analisi";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { formatNumero } from "@/utils/format";
import { urlPaginaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { MISURE_CALORE, misureDisponibili, type DatiMisure, type MisuraCalore } from "../../../../lib/insightVolantino/calore";
import type { PrevisioneVolantino, RendimentoVolantino } from "../../../../lib/insightVolantino/rendimento";
import {
  PESI_VISIBILITA,
  type BoxInsight,
  type PdfVolantino,
  type PesiVisibilita,
  type StatoDifferenza,
} from "../../../../lib/insightVolantino/tipi";
import { ETICHETTE_AFFIDABILITA, testoCasi } from "../analisi/affidabilita";
import { pesiStandard } from "../analisi/comuni";
import { marcaFormato, tooltipBox, trovaBoxIniziale } from "./box";
import {
  coloriReparti,
  legendaDifferenze,
  legendaModo,
  OPZIONI_COLORE,
  stileBox,
  stileDifferenza,
  TITOLI_LEGENDA,
  type ModoColore,
  type StileRiquadro,
} from "./colori";
import {
  boxPerPagina,
  destinazioneDoppia,
  doppiaDellaPagina,
  etichettaDoppia,
  numeriDoppia,
  pagineDaSfogliare,
  pagineDellaDoppia,
  proporzioneDelVolantino,
  proporzioneDellaPagina,
  riquadroBox,
  totaleDoppie,
  type DoppiaPagina,
} from "./geometria";
import { LegendaCalore } from "./LegendaCalore";
import { creaCalcolatoreMappe, misuraEffettiva, OPZIONI_VISTA, rigaMisura, testoValoreMisura, type VistaVolantino } from "./mappaCalore";
import { PaginaConImmagine } from "./PaginaConImmagine";
import { SchedaBox } from "./SchedaBox";
import { ViaggioProdotto } from "./ViaggioProdotto";

export interface VolantinoSfogliabileProps {
  idKit: string;
  pdf: PdfVolantino | null;
  box: BoxInsight[];
  totalePagine: number;
  configurazione?: FlyerInsightsConfig;
  /** Colora per differenza fra varianti e nasconde "Colora per" e la mappa di calore. */
  statoBox?: Record<string, StatoDifferenza>;
  /** Rendimento dalle vendite importate: aggiunge le misure Vendite e Vendite per spazio e i dati nella scheda. */
  rendimento?: RendimentoVolantino | null;
  /** Previsione per box: aggiunge la misura Previsione e la previsione nella scheda. */
  previsione?: PrevisioneVolantino | null;
  /** Pesi della visibilità usati dal server (zoneCalde.pesi): la pagina li dichiara. */
  pesi?: PesiVisibilita;
  /** Pagina controllata (opzionale): due visualizzatori affiancati restano sulla stessa doppia pagina. */
  pagina?: number;
  onCambiaPagina?: (pagina: number) => void;
  /** Box da evidenziare e scheda aperta all'avvio, es. da ?referenza=. */
  idBoxIniziale?: string | null;
  compatto?: boolean;
  titolo?: string;
}

/** Livelli dell'ingrandimento a tutto schermo. */
export const LIVELLI_ZOOM: readonly number[] = [1, 1.5, 2, 3];

/** La stima della visibilità con i pesi come si leggono ("0,8"): quelli usati dal server. */
export const spiegazionePesi = (pesi: PesiVisibilita = PESI_VISIBILITA): string => {
  const peso = (chiave: keyof PesiVisibilita) => formatNumero(pesi[chiave]);
  const origine = pesiStandard(pesi) ? "uguale per tutti i volantini" : "con i pesi del cliente";
  return (
    `Visibilità stimata, ${origine}: spazio del box × peso della pagina (copertina ${peso("copertina")}, ultima ${peso("ultima")}, ` +
    `pagine 2-3 ${peso("primaDoppia")}, altre ${peso("altre")}) × posizione (da ${peso("alto")} in cima a ${peso("basso")} in fondo). ` +
    "100 è il box più visibile di questo volantino."
  );
};

/** La frase sotto la legenda del calore: periodo delle vendite o come è fatta la previsione. */
const notaMisura = (misura: MisuraCalore, dati: DatiMisure): string | null => {
  if ((misura === "vendite" || misura === "venditePerSpazio") && dati.rendimento) {
    const { periodo, puntiVendita } = dati.rendimento;
    return `Vendite ${periodoValidita(periodo.dal, periodo.al)} in ${formatNumero(puntiVendita)} ${puntiVendita === 1 ? "punto vendita" : "punti vendita"} della stessa area e canale.`;
  }
  if (misura === "previsione" && dati.previsione) return dati.previsione.nota;
  return null;
};

/** Precedente e successiva, con la posizione nel volantino. */
function Navigazione({ doppia, doppie, onVai }: { doppia: DoppiaPagina; doppie: number; onVai: (indice: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Doppia pagina precedente"
        title="Doppia pagina precedente"
        disabled={doppia.indice <= 0}
        onClick={() => onVai(doppia.indice - 1)}
      >
        <Lucide icon="ChevronLeft" aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span className="min-w-14 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">
        {formatNumero(doppia.indice + 1)} / {formatNumero(doppie)}
      </span>
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        aria-label="Doppia pagina successiva"
        title="Doppia pagina successiva"
        disabled={doppia.indice >= doppie - 1}
        onClick={() => onVai(doppia.indice + 1)}
      >
        <Lucide icon="ChevronRight" aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Il volantino sfogliabile: le pagine vere del PDF da Olimpo (copertina da sola, poi le doppie
 * pagine) con sopra i riquadri dei box, colorati per reparto, meccanica, sconto o visibilità, o per
 * differenza con un'altra variante. Un clic (o Invio) su un riquadro apre la scheda del box, e da lì
 * il viaggio del prodotto nei volantini della GDO. Senza PDF le pagine sono bianche.
 *
 * Due viste, una alla volta: "Colori dei box" (con "Colora per") e "Mappa di calore", dove i
 * riquadri restano contorni sottili e sotto si dipinge, continuo, il calore della misura scelta fra
 * quelle disponibili (le vendite e la previsione solo quando ci sono).
 */
export function VolantinoSfogliabile(props: VolantinoSfogliabileProps) {
  // Un altro volantino riparte da capo: pagina, box scelto, scheda e ingrandimento
  return <Sfogliabile key={props.idKit} {...props} />;
}

function Sfogliabile({
  idKit,
  pdf,
  box,
  totalePagine,
  configurazione,
  statoBox,
  rendimento = null,
  previsione = null,
  pesi = PESI_VISIBILITA,
  pagina,
  onCambiaPagina,
  idBoxIniziale,
  compatto = false,
  titolo = "Il volantino",
}: VolantinoSfogliabileProps) {
  const [paginaInterna, setPaginaInterna] = useState(1);
  const [modo, setModo] = useState<ModoColore>("reparto");
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [schedaAperta, setSchedaAperta] = useState(false);
  const [viaggioAperto, setViaggioAperto] = useState(false);
  /** Indice in LIVELLI_ZOOM; null a ingrandimento chiuso. */
  const [zoom, setZoom] = useState<number | null>(null);
  const [vista, setVista] = useState<VistaVolantino>("box");
  /** La misura scelta dall'utente; finché non sceglie vale la predefinita (le vendite, se ci sono). */
  const [misuraScelta, setMisuraScelta] = useState<MisuraCalore | null>(null);
  const idMisura = useId();

  const controllata = pagina !== undefined;
  const totale = pagineDaSfogliare(totalePagine, box);
  const paginaCorrente = Math.min(totale, Math.max(1, Math.floor((controllata ? pagina : paginaInterna) || 1)));
  const doppia = pagineDellaDoppia(doppiaDellaPagina(paginaCorrente), totale);
  const doppie = totaleDoppie(totale);

  const vaiAllaPagina = useCallback(
    (nuova: number) => {
      if (!controllata) setPaginaInterna(nuova);
      onCambiaPagina?.(nuova);
    },
    [controllata, onCambiaPagina]
  );
  const vaiAllaDoppia = (indice: number) => {
    const destinazione = pagineDellaDoppia(Math.max(0, Math.min(doppie - 1, indice)), totale);
    vaiAllaPagina(destinazione.sinistra ?? destinazione.destra ?? 1);
  };

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

  const perPagina = useMemo(() => boxPerPagina(box), [box]);
  const proporzioneBase = useMemo(() => proporzioneDelVolantino(box), [box]);
  const reparti = useMemo(() => coloriReparti(box, configurazione), [box, configurazione]);
  const senzaPosizione = useMemo(() => box.filter(voce => voce.pagina === null || !riquadroBox(voce.geometria)).length, [box]);

  const confronto = statoBox !== undefined;
  const datiMisure = useMemo<DatiMisure>(() => ({ rendimento, previsione }), [rendimento, previsione]);
  // Nel confronto fra varianti i colori dicono le differenze: niente mappa di calore
  const disponibili = useMemo(() => (confronto ? [] : misureDisponibili(box, datiMisure)), [confronto, box, datiMisure]);
  const misura = misuraEffettiva(misuraScelta, disponibili);
  const conCalore = !confronto && vista === "calore" && misura !== null;
  // Densità di tutte le pagine (normalizzate sul volantino), calcolate una volta per misura
  const calcolaMappa = useMemo(() => creaCalcolatoreMappe(box, datiMisure, proporzioneBase), [box, datiMisure, proporzioneBase]);
  const mappa = useMemo(() => (conCalore && misura ? calcolaMappa(misura) : null), [conCalore, misura, calcolaMappa]);

  const stile = useCallback(
    (voce: BoxInsight): StileRiquadro => (statoBox ? stileDifferenza(statoBox[voce.id]) : stileBox(voce, modo, reparti)),
    [statoBox, modo, reparti]
  );
  const voci = useMemo<VoceLegenda[]>(
    () => (statoBox ? legendaDifferenze(box, statoBox) : legendaModo(modo, box, reparti)),
    [statoBox, box, modo, reparti]
  );

  const venditePerBox = useMemo(() => new Map((rendimento?.perBox ?? []).map(voce => [voce.idBox, voce])), [rendimento]);
  const previstiPerBox = useMemo(() => new Map((previsione?.perBox ?? []).map(voce => [voce.idBox, voce])), [previsione]);

  // Con la mappa accesa il tooltip dice anche il valore della misura (e per la previsione quanto è affidabile)
  const tooltip = useCallback(
    (voce: BoxInsight): ContenutoTooltip => {
      const base = tooltipBox(voce);
      if (!mappa) return base;
      const valore = rigaMisura(mappa, voce.id);
      // La misura in testa; una riga omonima del tooltip di sempre (es. "Sconto") non si ripete
      const righe = [valore, ...(base.righe ?? []).filter(riga => riga.etichetta !== valore.etichetta)];
      const previsto = mappa.misura === "previsione" ? previstiPerBox.get(voce.id) : undefined;
      if (previsto) righe.splice(1, 0, { etichetta: "Affidabilità", valore: `${ETICHETTE_AFFIDABILITA[previsto.affidabilita]}, ${testoCasi(previsto.casiStorici)}` });
      return { ...base, righe };
    },
    [mappa, previstiPerBox]
  );

  // Le pagine oltre quelle del PDF restano bianche; pagine 0 vuol dire che Olimpo non le ha contate
  const immagine = (numero: number): string | null =>
    pdf && pdf.idOlimpoCloud && (pdf.pagine <= 0 || numero <= pdf.pagine) ? urlPaginaMateriale(pdf.idOlimpoCloud, numero) : null;

  const boxScelto = selezionato ? (box.find(voce => voce.id === selezionato) ?? null) : null;

  const paginaDisegnata = (numero: number, lato: "sinistra" | "destra" | "singola") => (
    <PaginaConImmagine
      key={numero}
      numero={numero}
      lato={lato}
      proporzione={proporzioneDellaPagina(box, numero, proporzioneBase)}
      immagine={immagine(numero)}
      box={perPagina.get(numero) ?? []}
      stile={stile}
      selezionato={selezionato}
      onSeleziona={apriBox}
      densita={mappa?.densita.get(numero) ?? null}
      soloContorni={mappa !== null}
      tooltip={tooltip}
    />
  );

  /** Lo spazio di una pagina mancante (l'ultima, da sola a sinistra): la doppia resta in squadra. */
  const vuota = (lato: "sinistra" | "destra") => (
    <div
      aria-hidden="true"
      className={twMerge(
        "min-w-0 border border-dashed border-slate-200 bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-800",
        lato === "sinistra" ? "rounded-l-control border-r-0" : "rounded-r-control"
      )}
      style={{ aspectRatio: String(proporzioneBase), flex: `${proporzioneBase} 1 0%` }}
    />
  );

  const pagineDoppia: ReactNode =
    doppia.indice === 0 ? (
      <div className="flex justify-center">
        <div className="flex w-1/2">{paginaDisegnata(1, "singola")}</div>
      </div>
    ) : (
      <div className="flex">
        {doppia.sinistra !== null ? paginaDisegnata(doppia.sinistra, "sinistra") : vuota("sinistra")}
        {doppia.destra !== null ? paginaDisegnata(doppia.destra, "destra") : vuota("destra")}
      </div>
    );

  /** Proporzione della doppia pagina intera, per farla stare nell'altezza dello schermo. */
  const proporzioneDoppia = doppia.indice === 0 ? proporzioneBase : proporzioneBase * 2;
  const livello = zoom === null ? 1 : LIVELLI_ZOOM[zoom];

  const chiudiScheda = () => {
    setSchedaAperta(false);
    setViaggioAperto(false);
  };

  // La scheda si apre sopra l'ingrandimento quando c'è: dentro il suo albero, come dialog annidato
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
                <SchedaBox
                  box={boxScelto}
                  totalePagine={totale}
                  onViaggio={() => setViaggioAperto(true)}
                  vendite={rendimento && venditePerBox.has(boxScelto.id) ? { box: venditePerBox.get(boxScelto.id)!, misura: rendimento.misura } : null}
                  previsione={
                    previsione && previstiPerBox.has(boxScelto.id)
                      ? { box: previstiPerBox.get(boxScelto.id)!, tipo: previsione.tipo, unita: previsione.unita }
                      : null
                  }
                  misuraCalore={mappa ? { etichetta: MISURE_CALORE[mappa.misura].etichetta, testo: testoValoreMisura(mappa, boxScelto.id) } : null}
                />
              )}
            </div>
          </>
        )}
      </Slideover.Panel>
    </Slideover>
  );

  const legenda = mappa ? (
    <LegendaCalore misura={mappa.misura} unita={mappa.unita} massimo={mappa.massimo} nota={notaMisura(mappa.misura, datiMisure)} />
  ) : (
    <Legenda voci={voci} titolo={confronto ? "Differenze" : TITOLI_LEGENDA[modo]} />
  );
  const conVisibilita = !confronto && (mappa ? mappa.misura === "visibilita" : modo === "visibilita");

  return (
    <section aria-label={titolo} className={twMerge("flex min-w-0 flex-col gap-4", compatto && "gap-3")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="title-card">{titolo}</h3>
          <p aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
            {etichettaDoppia(doppia)} · {formatNumero(totale)} {totale === 1 ? "pagina" : "pagine"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Navigazione doppia={doppia} doppie={doppie} onVai={vaiAllaDoppia} />
          <Button type="button" variant="outline-secondary" size="sm" aria-label="Ingrandisci il volantino" title="Ingrandisci" onClick={() => setZoom(0)}>
            <Lucide icon="Maximize2" aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!confronto && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {disponibili.length > 0 && (
            <Segmenti<VistaVolantino> etichetta="Vista del volantino" opzioni={OPZIONI_VISTA} valore={vista} onChange={setVista} />
          )}
          {mappa ? (
            <div className="flex items-center gap-2">
              <label htmlFor={idMisura} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Lucide icon="Layers" aria-hidden="true" className="h-3.5 w-3.5" />
                Misura<span className="sr-only"> della mappa di calore</span>
              </label>
              <FormSelect
                id={idMisura}
                // Nome esplicito: lo span nascosto perderebbe lo spazio dopo "Misura" nel nome accessibile
                aria-label="Misura della mappa di calore"
                formSelectSize="sm"
                className="w-auto min-w-48"
                value={mappa.misura}
                onChange={evento => setMisuraScelta(evento.target.value as MisuraCalore)}
              >
                {disponibili.map(voce => (
                  <option key={voce} value={voce}>
                    {MISURE_CALORE[voce].etichetta}
                  </option>
                ))}
              </FormSelect>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-xs text-slate-500 dark:text-slate-400">
                Colora per
              </span>
              <Segmenti<ModoColore> etichetta="Colora per" opzioni={OPZIONI_COLORE} valore={modo} onChange={setModo} />
            </div>
          )}
        </div>
      )}

      <div className={twMerge("mx-auto w-full", compatto ? "max-w-xl" : "max-w-3xl")}>{pagineDoppia}</div>

      {legenda}

      {conVisibilita && <p className="text-xs text-slate-500 dark:text-slate-400">{spiegazionePesi(pesi)}</p>}
      {(!pdf || senzaPosizione > 0) && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {!pdf && "Il PDF del volantino non è disponibile: i box sono disegnati su pagine bianche. "}
          {senzaPosizione > 0 &&
            (senzaPosizione === 1 ? "1 box non ha la posizione nella pagina e non è disegnato." : `${formatNumero(senzaPosizione)} box non hanno la posizione nella pagina e non sono disegnati.`)}
        </p>
      )}

      {!compatto && doppie > 1 && (
        <nav aria-label="Pagine del volantino" className="flex flex-wrap items-center gap-1">
          {Array.from({ length: doppie }, (_, indice) => {
            const voce = pagineDellaDoppia(indice, totale);
            const corrente = indice === doppia.indice;
            return (
              <button
                key={indice}
                type="button"
                aria-label={destinazioneDoppia(voce)}
                aria-current={corrente ? "true" : undefined}
                onClick={() => vaiAllaDoppia(indice)}
                className={twMerge(
                  "h-7 min-w-7 rounded-control px-1.5 text-3xs font-semibold tabular-nums transition-colors",
                  corrente
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-300"
                )}
              >
                {numeriDoppia(voce)}
              </button>
            );
          })}
        </nav>
      )}

      {zoom === null && scheda}

      <Dialog open={zoom !== null} onClose={() => setZoom(null)} size="2xl">
        <Dialog.Panel className="w-[96vw] sm:w-[96vw] lg:w-[96vw] xl:w-[96vw]">
          <Dialog.Title>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {titolo} · {etichettaDoppia(doppia)}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-sm font-normal">
                <Navigazione doppia={doppia} doppie={doppie} onVai={vaiAllaDoppia} />
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    aria-label="Riduci lo zoom"
                    title="Riduci"
                    disabled={zoom === null || zoom <= 0}
                    onClick={() => setZoom(attuale => Math.max(0, (attuale ?? 0) - 1))}
                  >
                    <Lucide icon="Minus" aria-hidden="true" className="h-4 w-4" />
                  </Button>
                  <span aria-live="polite" className="min-w-12 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    {formatNumero(livello * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    aria-label="Aumenta lo zoom"
                    title="Aumenta"
                    disabled={zoom === null || zoom >= LIVELLI_ZOOM.length - 1}
                    onClick={() => setZoom(attuale => Math.min(LIVELLI_ZOOM.length - 1, (attuale ?? 0) + 1))}
                  >
                    <Lucide icon="Plus" aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="button" variant="outline-secondary" size="sm" aria-label="Chiudi l'ingrandimento" title="Chiudi" onClick={() => setZoom(null)}>
                  <Lucide icon="X" aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Dialog.Title>
          <div data-testid="volantino-ingrandito" className="max-h-[78vh] overflow-auto p-4">
            {/* A 100% la doppia pagina sta nell'altezza dello schermo; gli altri livelli la ingrandiscono */}
            <div className="mx-auto" style={{ width: `calc(min(100%, ${(72 * proporzioneDoppia).toFixed(2)}vh) * ${livello})` }}>
              {zoom !== null && pagineDoppia}
            </div>
          </div>
          <div className="border-t border-slate-200/60 px-5 py-3 dark:border-darkmode-400">{legenda}</div>
          {zoom !== null && scheda}
        </Dialog.Panel>
      </Dialog>
    </section>
  );
}

export default VolantinoSfogliabile;
