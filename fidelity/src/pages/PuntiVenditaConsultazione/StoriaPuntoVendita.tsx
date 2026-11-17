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
import { formatData, formatNumero } from "@/utils/format";
import { testoValidita, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import { ETICHETTA_MECCANICA, MECCANICHE, type AnalisiPuntoVendita, type EdizioneTimeline } from "../../../lib/puntiVendita/analisi";
import { DIMENSIONI_PAGINA_STORIA, type StoriaPuntoVendita, type VolantinoNellaStoria } from "../../../lib/puntiVendita/storia";
import { giorniAllaScadenza, testoScadenza } from "../VolantiniKit/scadenza";
import {
  assenzeTimeline,
  barreTimeline,
  edizioneScelta,
  edizioniDelPeriodo,
  eventiTimeline,
  fasceInsegne,
  formatDifferenza,
  formatDifferenzaPunti,
  formatPercentuale,
  intervalloPeriodo,
  NOMI_EVENTI,
  PARAMETRO_VOLANTINO,
  periodoValidita,
  quoteMeccaniche,
  sintesiPeriodo,
  tintaMeccanica,
  tracceStoria,
  ULTIMI_12_MESI,
  ULTIMI_3_MESI,
  type ContestoPeriodo,
  type SintesiPeriodo,
} from "./analisi";
import { RigaStampata, StatoBox, type QueryBox } from "./componenti";
import {
  chiaveEvento,
  descriviEvento,
  nomePdfVolantino,
  periodoMesi,
  testoRecapito,
  testoSintesi,
  testoVolantini,
  urlPdfVolantino,
} from "./storia";

/**
 * Scala sotto la quale la timeline non scorre ma sta nella larghezza della scheda: cinque anni di
 * volantini si leggono in una volta, e le corsie sotto ne mostrano l'andamento.
 */
const PIXEL_GIORNO_SCHEDA = 0.5;

/** Una barra al 100% delle meccaniche, senza testo: i numeri sono nella legenda accanto. */
function BarraMeccaniche({ quote, etichetta }: { quote: ReadonlyMap<string, number>; etichetta: string }) {
  const voci = MECCANICHE.filter(m => (quote.get(m) ?? 0) > 0);
  return (
    <div
      role="img"
      aria-label={`${etichetta}: ${voci.map(m => `${ETICHETTA_MECCANICA[m]} ${formatPercentuale(Math.round(quote.get(m) ?? 0))}`).join(", ")}`}
      className="flex h-3 w-full gap-0.5 overflow-hidden rounded-sm bg-slate-100 dark:bg-darkmode-400"
    >
      {voci.map(m => {
        const tinta = tintaMeccanica(m);
        return <span key={m} className="h-full" style={{ width: `${quote.get(m)}%`, backgroundColor: tinta.colore }} />;
      })}
    </div>
  );
}

/** Un numero del volantino scelto, con il confronto con la media del periodo sotto. */
function NumeroVolantino({ valore, etichetta, confronto }: { valore: ReactNode; etichetta: string; confronto?: string }) {
  return (
    <li className="flex flex-col">
      <span>
        <b className="text-base font-semibold text-slate-800 dark:text-slate-100">{valore}</b> <span className="text-slate-600 dark:text-slate-300">{etichetta}</span>
      </span>
      {confronto && <span className="text-slate-500 dark:text-slate-400">{confronto}</span>}
    </li>
  );
}

/**
 * Il volantino scelto nella timeline: copertina, date, numeri confrontati con la media del periodo,
 * meccaniche accanto a quelle del periodo, reparti con più spazio, riga stampata e passaggio agli altri.
 */
function EdizioneSelezionata({
  idPv,
  edizione,
  periodo,
  precedente,
  successiva,
  onScegli,
}: {
  idPv: string;
  edizione: EdizioneTimeline;
  periodo: SintesiPeriodo;
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
  const conMedia = periodo.volantini > 1;
  const reparti = edizione.reparti.slice(0, 4);
  const spazioReparti = edizione.reparti.reduce((somma, r) => somma + r.spazio, 0);
  const quote = quoteMeccaniche(edizione.meccaniche);

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
          <span aria-hidden="true">·</span>
          <span>{edizione.canale.nome}</span>
          <span aria-hidden="true">·</span>
          <span>{edizione.area.nome}</span>
          {stato && (
            <>
              <span aria-hidden="true">·</span>
              <span>{stato}</span>
            </>
          )}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul aria-label="Il volantino in numeri" className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums">
            <NumeroVolantino
              valore={formatNumero(edizione.numeroReferenze)}
              etichetta="referenze"
              confronto={conMedia && periodo.mediaReferenze !== null ? `${formatDifferenza(edizione.numeroReferenze - periodo.mediaReferenze)} sulla media del periodo` : undefined}
            />
            {edizione.scontoMedio !== null && (
              <NumeroVolantino
                valore={formatPercentuale(edizione.scontoMedio)}
                etichetta="sconto medio"
                confronto={conMedia && periodo.scontoMedio !== null ? `${formatDifferenzaPunti(edizione.scontoMedio - periodo.scontoMedio)} sulla media del periodo` : undefined}
              />
            )}
            {dettaglio.isLoading ? (
              <li className="col-span-2">
                <Skeleton className="h-4 w-3/4" />
              </li>
            ) : dati ? (
              <>
                <NumeroVolantino valore={formatNumero(dati.numeri.pagine)} etichetta="pagine" />
                <NumeroVolantino valore={formatNumero(dati.numeri.puntiVenditaInLista)} etichetta="punti vendita nella lista" />
              </>
            ) : (
              <li className="col-span-2 text-slate-500">I dettagli del volantino non sono arrivati.</li>
            )}
          </ul>
          {quote.size > 0 && (
            <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
                <span>Questo volantino</span>
                <BarraMeccaniche quote={quote} etichetta="Meccaniche di questo volantino" />
              </div>
              {conMedia && (
                <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
                  <span>Media del periodo</span>
                  <BarraMeccaniche quote={periodo.meccaniche} etichetta="Meccaniche del periodo" />
                </div>
              )}
              {reparti.length > 0 && spazioReparti > 0 && (
                <ul aria-label="Reparti con più spazio" className="mt-1 flex flex-wrap gap-1.5">
                  {reparti.map(r => (
                    <li key={r.reparto} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 tabular-nums dark:border-darkmode-400 dark:bg-darkmode-600">
                      {r.reparto} {formatPercentuale(Math.round((r.spazio / spazioReparti) * 100))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {dati?.rigaPuntoVendita && (
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="sr-only">Riga stampata: </span>
            <RigaStampata>{dati.rigaPuntoVendita.riga}</RigaStampata>
            {dati.rigaPuntoVendita.abbinamento === "probabile" && <StatusBadge tono="warning" etichetta="Abbinamento probabile" icon="Info" />}
            {dati.rigaPuntoVendita.abbinamento === "manuale" && <StatusBadge tono="info" etichetta="Collegato a mano" icon="Link" />}
          </p>
        )}
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

/** Timeline del periodo con le corsie dei numeri di ogni volantino, e la scheda del volantino scelto. */
function TimelineStoria({
  idPv,
  analisi,
  storia,
  contesto,
  richiesta,
  onScegli,
}: {
  idPv: string;
  analisi: AnalisiPuntoVendita;
  storia: StoriaPuntoVendita | undefined;
  contesto: ContestoPeriodo;
  richiesta: string | null;
  onScegli: (idKit: string) => void;
}) {
  const edizioni = edizioniDelPeriodo(analisi.timeline, contesto.giorni);
  const scelta = edizioneScelta(edizioni, richiesta);
  const indice = scelta ? edizioni.indexOf(scelta) : -1;
  const canali = new Map(analisi.timeline.map(e => [e.canale.id, e.canale]));
  // La storia ha i soli volantini della sua insegna e area: le barre prendono il colore del tema, non
  // quello dell'insegna, che nella palette coincide con quello di una meccanica nelle corsie sotto
  const gruppi = [...canali.values()].map(canale => ({ id: canale.id, etichetta: canale.nome, tinta: TINTA_PRINCIPALE }));

  return (
    <>
      <TimelineVolantini
        barre={barreTimeline(edizioni)}
        gruppi={gruppi}
        fasce={fasceInsegne(edizioni)}
        eventi={eventiTimeline(storia?.eventi ?? [])}
        nomiEventi={NOMI_EVENTI}
        tracce={tracceStoria(edizioni, storia?.recapiti)}
        assenze={assenzeTimeline(edizioniDelPeriodo(analisi.assenze, contesto.giorni))}
        nomeAssenze="volantino della sua insegna e area senza il punto vendita"
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
          periodo={sintesiPeriodo(edizioni)}
          precedente={edizioni[indice - 1] ?? null}
          successiva={edizioni[indice + 1] ?? null}
          onScegli={onScegli}
        />
      ) : contesto.periodo === ULTIMI_3_MESI || contesto.periodo === ULTIMI_12_MESI ? (
        <EmptyState compatta icon="CalendarX" title={`Nessun volantino ${contesto.nome}`} description="Scegli un periodo più lungo." />
      ) : (
        <EmptyState compatta icon="CalendarX" title="Nessun volantino in questo anno" description="Scegli un altro anno o tutto il periodo." />
      )}
    </>
  );
}

/**
 * Riquadro "Storia" della scheda: la timeline a calendario dei volantini del periodo in cui compare
 * il punto vendita, con l'insegna, gli eventi e le assenze, e sotto, sullo stesso asse, referenze,
 * sconto medio, meccaniche e recapiti stampati di ogni volantino; poi il volantino scelto. Il
 * periodo lo sceglie la scheda; il volantino sta nell'indirizzo, così tornando dal volantino la
 * scheda resta dov'era.
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

  // Senza volantini la guida alla lettura della timeline non serve: parla lo stato vuoto
  const senzaVolantini = analisi.data !== undefined && analisi.data.timeline.length === 0;
  const descrizione = senzaVolantini
    ? undefined
    : [
        storia?.sintesi ? `${testoSintesi(storia.sintesi)}.` : null,
        "Ogni barra è un volantino in cui compare, dal primo all'ultimo giorno di validità; sotto, sullo stesso asse, le sue referenze, il suo sconto medio, le sue meccaniche e l'indirizzo e il telefono stampati. Passa su un volantino per i suoi numeri, sceglilo per vederlo qui sotto.",
      ]
        .filter(Boolean)
        .join(" ");

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
            storia={storia}
            contesto={contesto}
            richiesta={parametri.get(PARAMETRO_VOLANTINO)}
            onScegli={scegli}
          />
        )}
      </StatoBox>
    </Sezione>
  );
}

interface VoceCambiamento {
  chiave: string;
  /** Per ordinare, dal più recente (ISO). */
  ordine: string;
  icona: string;
  titolo: string;
  quando: string;
  dettaglio: string;
  diverso?: boolean;
}

/**
 * "Cambiamenti": gli eventi della storia e i periodi dell'indirizzo e del telefono stampati, dal
 * più recente, con il primo volantino registrato in fondo. Vale per tutta la storia, non per il periodo.
 */
export function Cambiamenti({ storia, primo }: { storia: QueryBox<StoriaPuntoVendita>; primo: EdizioneTimeline | null }) {
  return (
    <Sezione titolo="Cambiamenti" descrizione="Eventi e recapiti stampati nei volantini, dal più recente.">
      <StatoBox
        query={storia}
        titoloErrore="Cambiamenti non caricati"
        vuoto={dati =>
          dati.eventi.length === 0 && dati.recapiti.length === 0 && !primo ? (
            <EmptyState compatta icon="Clock" title="Nessun cambiamento" description="Nei volantini importati insegna, area, indirizzo e telefono sono sempre gli stessi." />
          ) : null
        }
      >
        {dati => {
          const voci: VoceCambiamento[] = [
            ...dati.eventi.map((evento, i) => {
              const descritto = descriviEvento(evento);
              return {
                chiave: chiaveEvento(evento, i),
                ordine: evento.tipo === "assente" ? evento.dal : evento.data,
                icona: descritto.icona,
                titolo: descritto.titolo,
                quando: descritto.data,
                dettaglio: descritto.dettaglio,
              };
            }),
            ...dati.recapiti.map(recapito => ({
              chiave: `recapito-${recapito.dal}-${recapito.al}-${recapito.indirizzo ?? ""}-${recapito.telefono ?? ""}`,
              ordine: recapito.dal,
              icona: "MapPin",
              titolo: recapito.diversoDallAttuale ? "Stampato diverso dall'anagrafica" : "Stampato come in anagrafica",
              quando: `${periodoMesi(recapito.dal, recapito.al)} · ${testoVolantini(recapito.volantini)}`,
              dettaglio: testoRecapito(recapito),
              diverso: recapito.diversoDallAttuale,
            })),
          ].sort((a, b) => b.ordine.localeCompare(a.ordine));
          return (
            <ul aria-label="Cambiamenti" className="flex flex-col gap-3">
              {voci.map(voce => (
                <li key={voce.chiave} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-darkmode-400 dark:text-slate-300">
                    <Lucide icon={voce.icona} aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium">{voce.titolo}</span>
                      <span className="text-xs tabular-nums text-slate-500">{voce.quando}</span>
                      {voce.diverso && <StatusBadge tono="warning" etichetta="Diverso dall'attuale" icon="TriangleAlert" />}
                    </div>
                    <p className="text-sm text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">{voce.dettaglio}</p>
                  </div>
                </li>
              ))}
              {primo && (
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-darkmode-400 dark:text-slate-300">
                    <Lucide icon="Flag" aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">Primo volantino registrato</span>{" "}
                      <span className="text-xs tabular-nums text-slate-500">{formatData(primo.dal)}</span>
                    </div>
                    <p className="text-sm text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
                      {primo.promo.nome} · {primo.canale.nome} · {primo.area.nome}
                    </p>
                  </div>
                </li>
              )}
            </ul>
          );
        }}
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
        <div className="text-xs text-slate-500 [overflow-wrap:anywhere]">
          {[validita, volantino.titoloKit].filter(Boolean).join(" · ")}
        </div>
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
        <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-400">
          <span className="sr-only">Riga stampata: </span>«{volantino.rigaStampata}»
        </p>
        {volantino.numeroReferenze !== null && (
          <div className="mt-1 text-xs text-slate-500">{formatNumero(volantino.numeroReferenze)} referenze</div>
        )}
      </div>
      {/* Le azioni in riga (due righe al massimo da desktop), non in una colonna alta quanto quattro pulsanti */}
      <div className="flex flex-none flex-wrap content-start items-start gap-2 sm:max-w-[17rem] sm:justify-end">
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
