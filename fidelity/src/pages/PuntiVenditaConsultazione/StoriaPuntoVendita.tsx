import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { TimelineVolantini, TINTA_PRINCIPALE } from "@/components/Grafici";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useFetchVolantiniStoriaPuntoVendita, useFetchVolantinoPuntoVendita } from "@/query/query";
import { formatNumero } from "@/utils/format";
import { testoValidita, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import type { AnalisiPuntoVendita, EdizioneTimeline, VolantinoAssente } from "../../../lib/puntiVendita/analisi";
import { DIMENSIONI_PAGINA_STORIA, type StoriaPuntoVendita, type VolantinoNellaStoria } from "../../../lib/puntiVendita/storia";
import { giorniAllaScadenza, testoScadenza } from "../VolantiniKit/scadenza";
import {
  assenzaDallUltimo,
  assenzeDellaStoria,
  assenzePerAnno,
  assenzeTimeline,
  barreTimeline,
  edizioneScelta,
  edizioniDelPeriodo,
  fasceInsegne,
  giornoBreve,
  intervalloPeriodo,
  PARAMETRO_VOLANTINO,
  periodoValidita,
  ULTIMI_12_MESI,
  strisciaCalendario,
  ULTIMI_3_MESI,
  type ContestoPeriodo,
  type StrisciaCalendario,
  type TrattoCalendario,
} from "./analisi";
import { RigaStampata, StatoBox, type QueryBox } from "./componenti";
import { nomePdfVolantino, testoSintesi, testoVolantini, urlPdfVolantino } from "./storia";

/**
 * Scala sotto la quale la timeline non scorre ma sta nella larghezza della scheda: cinque anni di
 * volantini si leggono in una volta.
 */
const PIXEL_GIORNO_SCHEDA = 0.5;

/** Il nome delle assenze in legenda e nel tooltip della timeline. */
const NOME_ASSENZE = "volantino della sua insegna e area senza il punto vendita";

/**
 * Il volantino scelto nella timeline: copertina, promo, validità, insegna e area, e il passaggio
 * agli altri. Nella Storia restano soltanto insegna e volantini (richiesta del 2026-11-19): niente
 * numeri, meccaniche, reparti né riga stampata; resta l'indicazione di un abbinamento probabile.
 */
function EdizioneSelezionata({
  idPv,
  edizione,
  precedente,
  successiva,
  onScegli,
}: {
  idPv: string;
  edizione: EdizioneTimeline;
  precedente: EdizioneTimeline | null;
  successiva: EdizioneTimeline | null;
  onScegli: (idKit: string) => void;
}) {
  const dettaglio = useFetchVolantinoPuntoVendita(idPv, edizione.idKit);
  // Il volantino si apre nella vista di consultazione, che chiede materiali.visualizza
  const puoConsultareVolantini = usePermission(PERMISSIONS.MATERIALI.VISUALIZZA);
  const dati = dettaglio.data;
  const anteprima = dati?.pdf ? urlAnteprimaMateriale(dati.pdf.idOlimpoCloud) : null;
  const giorni = edizione.attivo ? giorniAllaScadenza(edizione.al) : null;
  const stato = edizione.attivo ? `attivo${giorni !== null ? `, ${testoScadenza(giorni).toLowerCase()}` : ""}` : null;
  const abbinamento = dati?.rigaPuntoVendita?.abbinamento;

  return (
    <section
      aria-label="Volantino selezionato"
      className="mt-5 grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 rounded-card border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[6rem_minmax(0,1fr)] dark:border-darkmode-400 dark:bg-darkmode-700"
    >
      <div className="aspect-[210/297] overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
        {anteprima ? (
          <img src={anteprima} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Lucide icon="FileText" aria-hidden="true" className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0" aria-live="polite">
        <p className="title-eyebrow">Volantino selezionato</p>
        {/* I nomi delle promo sono codici senza spazi (PE2623_24_MIPREMIO_05-11-26): vanno a capo dove serve */}
        <h3 className="title-card text-base [overflow-wrap:anywhere] dark:text-slate-100">{edizione.promo.nome}</h3>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">{periodoValidita(edizione.dal, edizione.al)}</span>
          {stato && (
            <>
              <span aria-hidden="true">·</span>
              <span>{stato}</span>
            </>
          )}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="primary" size="sm">
            <Lucide icon="Store" aria-hidden="true" className="h-3 w-3" />
            {edizione.canale.nome}
          </Badge>
          <Badge variant="secondary" size="sm">
            <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3" />
            {edizione.area.nome}
          </Badge>
          {abbinamento === "probabile" && <StatusBadge tono="warning" etichetta="Abbinamento probabile" icon="Info" />}
          {abbinamento === "manuale" && <StatusBadge tono="info" etichetta="Collegato a mano" icon="Link" />}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline-secondary"
          aria-label="Volantino precedente"
          title="Volantino precedente"
          disabled={!precedente}
          onClick={() => precedente && onScegli(precedente.idKit)}
        >
          <Lucide icon="ChevronLeft" aria-hidden="true" className="h-4 w-4" />
        </Button>
        {puoConsultareVolantini && (
          <Button as={Link} to={percorsoDettaglioVolantino(edizione.idKit)} variant="primary">
            Apri volantino
          </Button>
        )}
        <Button
          type="button"
          variant="outline-secondary"
          aria-label="Volantino successivo"
          title="Volantino successivo"
          disabled={!successiva}
          onClick={() => successiva && onScegli(successiva.idKit)}
        >
          <Lucide icon="ChevronRight" aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

const testoVolantiniSu = (numero: number) => (numero === 1 ? "volantino" : "volantini");

/** Una riga dell'elenco delle assenze: la data, la promo con la validità e il link al volantino. */
function RigaAssenza({ assenza, puoAprire }: { assenza: VolantinoAssente; puoAprire: boolean }) {
  return (
    <li
      data-volantino-assente={assenza.idKit}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]"
    >
      <span className="col-span-2 text-xs font-semibold tabular-nums text-rose-700 sm:col-span-1 dark:text-rose-300">{giornoBreve(assenza.dal)}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{assenza.promo.nome}</p>
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{periodoValidita(assenza.dal, assenza.al)}</p>
      </div>
      {puoAprire && (
        <Link
          to={percorsoDettaglioVolantino(assenza.idKit)}
          aria-label={`Apri il volantino ${assenza.promo.nome}`}
          className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
        >
          Apri
          <Lucide icon="ChevronRight" aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      )}
    </li>
  );
}

/**
 * Le assenze per anno, dal più recente: una riga per anno con il numero, che si apre sulle assenze
 * di quell'anno. Aperto soltanto il più recente (`primoAperto`), così l'elenco resta corto anche con
 * anni di volantini.
 */
function AssenzePerAnno({
  assenze,
  puoAprire,
  primoAperto,
  etichetta,
}: {
  assenze: readonly VolantinoAssente[];
  puoAprire: boolean;
  primoAperto: boolean;
  etichetta: string;
}) {
  const anni = assenzePerAnno(assenze);
  const [aperti, setAperti] = useState<ReadonlySet<number>>(() => new Set(primoAperto && anni[0] ? [anni[0].anno] : []));
  const cambia = (anno: number) =>
    setAperti(attuali => {
      const nuovi = new Set(attuali);
      if (nuovi.has(anno)) nuovi.delete(anno);
      else nuovi.add(anno);
      return nuovi;
    });
  return (
    <div role="group" aria-label={etichetta} className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
      {anni.map(({ anno, assenze: dellAnno }) => {
        const aperto = aperti.has(anno);
        return (
          <div key={anno}>
            <button
              type="button"
              aria-expanded={aperto}
              onClick={() => cambia(anno)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-400/40"
            >
              <Lucide icon="ChevronRight" aria-hidden="true" className={twMerge("h-4 w-4 text-slate-500 transition-transform", aperto && "rotate-90")} />
              <strong className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{anno}</strong>{" "}
              <span className="text-xs tabular-nums text-slate-500">{dellAnno.length === 1 ? "1 assenza" : `${formatNumero(dellAnno.length)} assenze`}</span>
            </button>
            {aperto && (
              <ul aria-label={`Assenze del ${anno}`} className="divide-y divide-dashed divide-slate-200 pb-1 pl-6 dark:divide-darkmode-400">
                {dellAnno.map(assenza => (
                  <RigaAssenza key={assenza.idKit} assenza={assenza} puoAprire={puoAprire} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Le assenze dopo il primo volantino in cui c'è, per anno: aperto il più recente. */
function AssenzeFraISuoi({ assenze, puoAprire }: { assenze: readonly VolantinoAssente[]; puoAprire: boolean }) {
  if (assenze.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        Fra i suoi volantini{" "}
        <span className="text-xs font-normal tabular-nums text-slate-500">{formatNumero(assenze.length)}</span>
      </h4>
      {/* Cambiando periodo si riparte con aperto solo l'anno più recente */}
      <AssenzePerAnno key={`${assenze.length}-${assenze[0].idKit}`} assenze={assenze} puoAprire={puoAprire} primoAperto etichetta="Assenze fra i suoi volantini" />
    </div>
  );
}

/** Le assenze prima del primo volantino in cui c'è: chiuse, con il numero; aperte, per anno e tutte chiuse. */
function AssenzePrimaDelPrimo({ assenze, puoAprire }: { assenze: readonly VolantinoAssente[]; puoAprire: boolean }) {
  const [aperte, setAperte] = useState(false);
  if (assenze.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        aria-expanded={aperte}
        onClick={() => setAperte(attuale => !attuale)}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-slate-100"
      >
        <Lucide icon="ChevronRight" aria-hidden="true" className={twMerge("h-4 w-4 text-slate-500 transition-transform", aperte && "rotate-90")} />
        Prima del suo primo volantino{" "}
        <span className="text-xs font-normal tabular-nums text-slate-500">{formatNumero(assenze.length)}</span>
      </button>
      {aperte && (
        <div className="ml-5 mt-1">
          <p className="mb-1.5 text-xs text-slate-500">Volantini della sua insegna e area usciti prima che comparisse: spesso il negozio non era ancora aperto.</p>
          <AssenzePerAnno assenze={assenze} puoAprire={puoAprire} primoAperto={false} etichetta="Assenze prima del suo primo volantino" />
        </div>
      )}
    </div>
  );
}

const SFONDO_ASSENZA =
  "bg-[repeating-linear-gradient(135deg,theme(colors.rose.500)_0_3px,theme(colors.rose.100)_3px_6px)] ring-1 ring-inset ring-rose-500 dark:bg-[repeating-linear-gradient(135deg,theme(colors.rose.400)_0_3px,transparent_3px_6px)] dark:ring-rose-400";
const SFONDO_PRESENZA = "bg-slate-400/60 dark:bg-slate-400/50";
const SFONDO_VUOTO = "bg-slate-100 dark:bg-darkmode-400/60";

const statoTratto = (tratto: TrattoCalendario) => (tratto.volantini === 0 ? "vuoto" : tratto.mancanti > 0 ? "assente" : "presente");

const descriviTratto = (tratto: TrattoCalendario) =>
  tratto.volantini === 0
    ? `${tratto.etichetta} · nessun volantino`
    : tratto.mancanti === 0
      ? `${tratto.etichetta} · c'era in ${tratto.volantini === 1 ? "1 volantino" : `tutti i ${formatNumero(tratto.volantini)} volantini`}`
      : `${tratto.etichetta} · ${formatNumero(tratto.mancanti)} su ${formatNumero(tratto.volantini)} senza il punto vendita`;

/**
 * La striscia del calendario del periodo: un riquadro per mese (o per settimana nei periodi brevi),
 * grigio se c'era in tutti i volantini, rosa tratteggiato se ne mancava almeno uno, chiaro senza
 * volantini. Tre stati, nessuna intensità; larga quanto la Storia qualunque sia il numero dei volantini.
 */
function StrisciaCalendarioPresenze({ striscia }: { striscia: StrisciaCalendario }) {
  const { tratti, passo } = striscia;
  const gruppi: Array<{ gruppo: string; tratti: number }> = [];
  for (const tratto of tratti) {
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo?.gruppo === tratto.gruppo) ultimo.tratti += 1;
    else gruppi.push({ gruppo: tratto.gruppo, tratti: 1 });
  }
  const conAssenze = tratti.filter(t => t.mancanti > 0).length;
  const unita = passo === "mese" ? ["mese", "mesi"] : ["settimana", "settimane"];
  return (
    <div className="grid gap-1.5">
      <div
        role="img"
        aria-label={`${formatNumero(tratti.length)} ${tratti.length === 1 ? unita[0] : unita[1]} del periodo, ${formatNumero(conAssenze)} con almeno un volantino senza il punto vendita`}
        data-passo={passo}
        className={twMerge("flex h-4", tratti.length > 80 ? "gap-px" : "gap-0.5")}
      >
        {tratti.map(tratto => {
          const stato = statoTratto(tratto);
          return (
            <span
              key={tratto.inizio}
              data-tratto={stato}
              title={descriviTratto(tratto)}
              className={twMerge("min-w-0 flex-1 rounded-sm", stato === "assente" ? SFONDO_ASSENZA : stato === "presente" ? SFONDO_PRESENZA : SFONDO_VUOTO)}
            />
          );
        })}
      </div>
      {/* Gli anni (o i mesi) sotto i loro riquadri; il nome solo dove c'è posto */}
      <div aria-hidden="true" className="flex text-2xs tabular-nums text-slate-500">
        {gruppi.map(g => (
          <span key={g.gruppo} style={{ flexGrow: g.tratti, flexBasis: 0 }} className="min-w-0 truncate border-l border-slate-200 pl-1 dark:border-darkmode-400">
            {g.tratti >= 2 || gruppi.length <= 6 ? g.gruppo : ""}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={twMerge("h-2.5 w-3 rounded-sm", SFONDO_PRESENZA)} />
          c'era in tutti i volantini {passo === "mese" ? "del mese" : "della settimana"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={twMerge("h-2.5 w-3 rounded-sm", SFONDO_ASSENZA)} />
          mancava da almeno uno
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={twMerge("h-2.5 w-3 rounded-sm ring-1 ring-inset ring-slate-200 dark:ring-darkmode-400", SFONDO_VUOTO)} />
          nessun volantino
        </span>
      </div>
    </div>
  );
}

/** L'avviso: il volantino più recente della sua insegna e area non lo stampa. */
function AvvisoUltimoVolantino({ assenza }: { assenza: VolantinoAssente }) {
  return (
    <p role="note" className="flex gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-slate-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-slate-200">
      <Lucide icon="TriangleAlert" aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-rose-600 dark:text-rose-400" />
      <span>
        <strong className="font-semibold">Non c'è nell'ultimo volantino</strong> ({assenza.promo.nome}, {periodoValidita(assenza.dal, assenza.al)}). Controlla se il punto
        vendita è ancora aperto o se la lista del volantino è incompleta.
      </span>
    </p>
  );
}

/**
 * "Quando non c'era": i volantini del periodo della sua insegna e area, con la lista dei punti
 * vendita registrata, in cui il punto vendita non compare. In alto quanti su quanti e la striscia
 * del calendario; l'avviso se manca dall'ultimo volantino (`ultimaAssente`, su tutta la storia);
 * poi le assenze fra i suoi volantini per anno, aperto il più recente, e quelle prima del suo
 * primo volantino, chiuse. Nulla cresce con il numero dei volantini: la striscia va per mese o
 * settimana, gli elenchi per anno. Senza assenze né avviso non c'è (spec anagrafica-punti-vendita,
 * "Assenze in evidenza nella Storia del punto vendita").
 */
export function AssenzeDelPeriodo({
  assenze,
  edizioni,
  primoDelPv,
  ultimaAssente = null,
  intervallo,
}: {
  assenze: readonly VolantinoAssente[];
  edizioni: readonly Pick<EdizioneTimeline, "dal">[];
  /** Il primo volantino in cui c'è, di tutta la storia. */
  primoDelPv: string | null;
  ultimaAssente?: VolantinoAssente | null;
  /** I giorni del periodo scelto; senza, dal primo all'ultimo volantino. */
  intervallo?: { dal: string; al: string };
}) {
  const puoConsultareVolantini = usePermission(PERMISSIONS.MATERIALI.VISUALIZZA);
  if (assenze.length === 0 && !ultimaAssente) return null;
  if (assenze.length === 0 && ultimaAssente) {
    return (
      <div className="mt-5">
        <AvvisoUltimoVolantino assenza={ultimaAssente} />
      </div>
    );
  }
  const { fraISuoi, primaDelPrimo, volantini } = assenzeDellaStoria(edizioni, assenze, primoDelPv);
  return (
    <section aria-label="Quando non c'era" className="mt-5 grid gap-4 rounded-card border border-slate-200 p-4 dark:border-darkmode-400">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Lucide icon="CalendarX" aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          Quando non c'era
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong className="text-2xl font-semibold tabular-nums text-rose-700 dark:text-rose-300">{formatNumero(assenze.length)}</strong>{" "}
          {testoVolantiniSu(assenze.length)} su {formatNumero(volantini)} della sua insegna e area senza il punto vendita
        </p>
      </div>
      <StrisciaCalendarioPresenze striscia={strisciaCalendario(edizioni, assenze, intervallo)} />
      {ultimaAssente && <AvvisoUltimoVolantino assenza={ultimaAssente} />}
      <AssenzeFraISuoi assenze={fraISuoi} puoAprire={puoConsultareVolantini} />
      <AssenzePrimaDelPrimo assenze={primaDelPrimo} puoAprire={puoConsultareVolantini} />
    </section>
  );
}

/** Timeline del periodo con insegna e volantini, la scheda del volantino scelto e le assenze. */
function TimelineStoria({
  idPv,
  analisi,
  contesto,
  richiesta,
  onScegli,
}: {
  idPv: string;
  analisi: AnalisiPuntoVendita;
  contesto: ContestoPeriodo;
  richiesta: string | null;
  onScegli: (idKit: string) => void;
}) {
  const edizioni = edizioniDelPeriodo(analisi.timeline, contesto.giorni);
  const assenze = edizioniDelPeriodo(analisi.assenze, contesto.giorni);
  const scelta = edizioneScelta(edizioni, richiesta);
  const indice = scelta ? edizioni.indexOf(scelta) : -1;
  const canali = new Map(analisi.timeline.map(e => [e.canale.id, e.canale]));
  const gruppi = [...canali.values()].map(canale => ({ id: canale.id, etichetta: canale.nome, tinta: TINTA_PRINCIPALE }));

  return (
    <>
      <TimelineVolantini
        barre={barreTimeline(edizioni)}
        gruppi={gruppi}
        fasce={fasceInsegne(edizioni)}
        assenze={assenzeTimeline(assenze)}
        nomeAssenze={NOME_ASSENZE}
        pixelGiornoMinimi={PIXEL_GIORNO_SCHEDA}
        intervallo={intervalloPeriodo(contesto.periodo, edizioni, contesto.oggi)}
        oggi={contesto.oggi}
        selezionata={scelta?.idKit ?? null}
        onSeleziona={onScegli}
        titolo={`Timeline: ${testoVolantini(edizioni.length)} del punto vendita`}
        descrizioneGruppo="Insegna"
      />
      {scelta ? (
        <EdizioneSelezionata
          idPv={idPv}
          edizione={scelta}
          precedente={edizioni[indice - 1] ?? null}
          successiva={edizioni[indice + 1] ?? null}
          onScegli={onScegli}
        />
      ) : contesto.periodo === ULTIMI_3_MESI || contesto.periodo === ULTIMI_12_MESI ? (
        <EmptyState compatta icon="CalendarX" title={`Nessun volantino ${contesto.nome}`} description="Scegli un periodo più lungo." />
      ) : (
        <EmptyState compatta icon="CalendarX" title="Nessun volantino in questo anno" description="Scegli un altro anno o tutto il periodo." />
      )}
      <AssenzeDelPeriodo
        assenze={assenze}
        edizioni={edizioni}
        primoDelPv={analisi.timeline[0]?.dal ?? null}
        ultimaAssente={assenzaDallUltimo(analisi.timeline, analisi.assenze)}
        intervallo={intervalloPeriodo(contesto.periodo, edizioni, contesto.oggi)}
      />
    </>
  );
}

/**
 * Riquadro "Storia" della scheda: la timeline a calendario dei volantini del periodo in cui compare
 * il punto vendita, con l'insegna e le assenze; poi il volantino scelto e quando non c'era. Solo
 * insegna e volantini (spec anagrafica-punti-vendita, "Storia del punto vendita"): niente corsie di
 * numeri, recapiti stampati o eventi. Il periodo lo sceglie la scheda; il volantino sta
 * nell'indirizzo, così tornando dal volantino la scheda resta dov'era.
 * Senza volantini è l'unico riquadro della storia: dice che cos'è e come arriva, e a chi gestisce
 * i punti vendita offre l'import degli export (`onImporta`).
 */
export function BoxStoria({
  idPv,
  analisi,
  storia,
  contesto,
  onImporta,
}: {
  idPv: string;
  analisi: QueryBox<AnalisiPuntoVendita>;
  storia: StoriaPuntoVendita | undefined;
  contesto: ContestoPeriodo;
  onImporta?: () => void;
}) {
  const [parametri, setParametri] = useSearchParams();

  const scegli = (idKit: string) =>
    setParametri(
      attuali => {
        const nuovi = new URLSearchParams(attuali);
        nuovi.set(PARAMETRO_VOLANTINO, idKit);
        return nuovi;
      },
      { replace: true }
    );

  // Senza volantini la guida alla lettura della timeline non serve: parla lo stato vuoto.
  // Altrimenti una frase breve; la guida completa si apre a richiesta
  const senzaVolantini = analisi.data !== undefined && analisi.data.timeline.length === 0;
  const descrizione = senzaVolantini ? undefined : (
    <>
      <p>{[storia?.sintesi ? `${testoSintesi(storia.sintesi)}.` : null, "Scegli un volantino per vederlo qui sotto."].filter(Boolean).join(" ")}</p>
      <details className="group/guida mt-1">
        <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-xs font-medium text-primary">
          <Lucide icon="ChevronRight" aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open/guida:rotate-90" />
          Come si legge
        </summary>
        <p className="mt-1 max-w-3xl text-xs">
          Ogni barra è un volantino in cui compare, dal primo all'ultimo giorno di validità, raggruppato per insegna. I riquadri rossi tratteggiati sono i volantini della sua insegna e area in cui non c'era, elencati sotto in "Quando non c'era". Passa su un volantino per nome, validità e insegna.
        </p>
      </details>
    </>
  );

  return (
    <Sezione titolo="Storia" descrizione={descrizione}>
      <StatoBox
        query={analisi}
        titoloErrore="Storia non caricata"
        scheletro={<Skeleton className="h-64" />}
        vuoto={dati =>
          dati.timeline.length === 0 ? (
            <EmptyState
              compatta
              icon="FileSearch"
              title="Non compare in nessun volantino importato"
              description={`La storia raccoglie i volantini nella cui lista dei punti vendita è stampato, con insegna, recapiti, prodotti e sconti nel tempo. Arriva quando il Plugin InDesign invia i volantini o quando si importano i loro export JSON${onImporta ? "." : ": può farlo chi gestisce i punti vendita."}`}
              buttonText={onImporta ? "Importa la storia dai volantini" : undefined}
              buttonIcon="Upload"
              onButtonClick={onImporta}
            />
          ) : null
        }
      >
        {dati => (
          <TimelineStoria
            idPv={idPv}
            analisi={dati}
            contesto={contesto}
            richiesta={parametri.get(PARAMETRO_VOLANTINO)}
            onScegli={scegli}
          />
        )}
      </StatoBox>
    </Sezione>
  );
}

function VoceVolantino({ volantino }: { volantino: VolantinoNellaStoria }) {
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);
  const puoConsultareVolantini = usePermission(PERMISSIONS.MATERIALI.VISUALIZZA);
  const { promo, pdf } = volantino;
  const validita = testoValidita(promo.validitaDal, promo.validitaAl);
  const anteprima = pdf ? urlAnteprimaMateriale(pdf.idOlimpoCloud) : null;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:gap-4">
      <div className="flex-none">
        {anteprima ? (
          <button
            type="button"
            aria-label={`Anteprima del volantino ${promo.nome}`}
            className="h-24 w-20 overflow-hidden rounded-control border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
            onClick={() => setAnteprimaAperta(true)}
          >
            <img src={anteprima} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
          </button>
        ) : (
          <div className="flex h-24 w-20 items-center justify-center rounded-control border border-dashed border-slate-300 bg-slate-50">
            <Lucide icon="FileText" aria-hidden="true" className="h-5 w-5 text-slate-400" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="title-card [overflow-wrap:anywhere] dark:text-slate-100">{promo.nome}</h4>
        {/* Il titolo del kit è un codice tecnico (VOLANTINO_SSCNCY_CYTO_VOL): bastano promo, validità, insegna e area */}
        {validita && <div className="text-xs tabular-nums text-slate-500">{validita}</div>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="primary" size="sm">
            <Lucide icon="Store" aria-hidden="true" className="h-3 w-3" />
            {volantino.canale.nome}
          </Badge>
          <Badge variant="secondary" size="sm">
            <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3" />
            {volantino.area.nome}
          </Badge>
          {volantino.abbinamento === "probabile" && (
            <StatusBadge tono="warning" etichetta="Abbinamento probabile" icon="Info" />
          )}
          {volantino.abbinamento === "manuale" && (
            <StatusBadge tono="info" etichetta="Collegato a mano" icon="Link" />
          )}
        </div>
        <p className="mt-2">
          <span className="sr-only">Riga stampata: </span>
          <RigaStampata>{volantino.rigaStampata}</RigaStampata>
        </p>
        {volantino.numeroReferenze !== null && (
          <div className="mt-1 text-xs text-slate-500">{formatNumero(volantino.numeroReferenze)} referenze</div>
        )}
      </div>
      {/* Le azioni su una riga da desktop, non in una colonna né spezzate su due righe */}
      <div className="flex flex-none flex-wrap content-start items-start gap-2 sm:flex-nowrap sm:justify-end">
        {puoConsultareVolantini && (
          <Button as={Link} to={percorsoDettaglioVolantino(volantino.idKit)} size="sm" variant="outline-secondary">
            <Lucide icon="BookOpen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Apri volantino
          </Button>
        )}
        {pdf && (
          <>
            <Button type="button" size="sm" variant="outline-secondary" onClick={() => setAnteprimaAperta(true)}>
              <Lucide icon="Focus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Anteprima
            </Button>
            <Button
              as="a"
              href={urlPdfVolantino(pdf.idOlimpoCloud)}
              download={nomePdfVolantino(pdf.nome, promo.nome)}
              size="sm"
              variant="outline-secondary"
            >
              <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </Button>
          </>
        )}
      </div>
      {anteprimaAperta && anteprima && (
        <PreviewImmaginePdf imageUrl={anteprima} totalPages={pdf?.pagine ?? 1} onClose={() => setAnteprimaAperta(false)} />
      )}
    </li>
  );
}

/**
 * Tutti i volantini in cui compare il punto vendita, dal più recente, paginati dal server, con la
 * riga com'era stampata, l'anteprima e il PDF. Si chiede al server solo se la storia c'è.
 */
export function TuttiIVolantini({ idPv }: { idPv: string }) {
  const [pagina, setPagina] = useState(1);
  const [dimensione, setDimensione] = useState(DIMENSIONI_PAGINA_STORIA[0]);
  const query = useFetchVolantiniStoriaPuntoVendita(idPv, pagina, dimensione);
  const dati = query.data;

  return (
    <Sezione senzaPadding titolo="Tutti i volantini" descrizione="Ogni volantino in cui compare, dal più recente, con la riga com'era stampata.">
      {query.isLoading ? (
        <div className="flex flex-col gap-3 px-5 pb-5" role="status" aria-label="Caricamento volantini della storia">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : query.isError ? (
        <div className="px-5 pb-5">
          <PageError
            compatta
            titolo="Volantini non caricati"
            motivo={(query.error as Error)?.message || "Errore durante il recupero dei volantini della storia"}
            onRiprova={() => query.refetch()}
          />
        </div>
      ) : !dati || dati.volantini.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState compatta icon="FileSearch" title="Nessun volantino" description="Nessun volantino in questa pagina." />
        </div>
      ) : (
        <>
          <ul
            aria-label="Volantini della storia"
            aria-busy={query.isPlaceholderData || undefined}
            className={twMerge("divide-y divide-slate-100 border-t border-dashed border-slate-200 transition-opacity dark:divide-darkmode-400 dark:border-darkmode-400", query.isPlaceholderData && "opacity-60")}
          >
            {dati.volantini.map(volantino => (
              <VoceVolantino key={`${volantino.idKit}-${volantino.rigaStampata}`} volantino={volantino} />
            ))}
          </ul>
          <PaginazioneTabella
            totale={dati.totale}
            pagina={pagina}
            dimensionePagina={dimensione}
            opzioniDimensione={[...DIMENSIONI_PAGINA_STORIA]}
            onCambiaPagina={setPagina}
            onCambiaDimensione={nuova => {
              setDimensione(nuova);
              setPagina(1);
            }}
          />
        </>
      )}
    </Sezione>
  );
}
