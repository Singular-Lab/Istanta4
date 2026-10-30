import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { FasceNelTempo, TimelineVolantini, type Tinta } from "@/components/Grafici";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { useFetchVolantiniStoriaPuntoVendita, useFetchVolantinoPuntoVendita } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import { testoValidita, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { percorsoKit } from "../../../lib/materiali/periodi";
import type { AnalisiPuntoVendita, EdizioneTimeline } from "../../../lib/puntiVendita/analisi";
import { DIMENSIONI_PAGINA_STORIA, type EventoStoria, type StoriaPuntoVendita, type VolantinoNellaStoria } from "../../../lib/puntiVendita/storia";
import { giorniAllaScadenza, testoScadenza } from "../VolantiniKit/scadenza";
import {
  colonneTimeline,
  edizioneScelta,
  edizioniDelPeriodo,
  eventiTimeline,
  fasceInsegne,
  formatPercentuale,
  NOMI_EVENTI,
  NOMI_TONI_RECAPITI,
  PARAMETRO_ANNO,
  PARAMETRO_VOLANTINO,
  percorsoVolantino,
  periodoValidita,
  righeRecapiti,
} from "./analisi";
import { PuntoInsegna, RigaStampata, StatoBox, type QueryBox } from "./componenti";
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

/** Il volantino scelto nella timeline: copertina, date, numeri, riga stampata e passaggio agli altri. */
function EdizioneSelezionata({
  idPv,
  edizione,
  precedente,
  successiva,
  tinta,
  onScegli,
}: {
  idPv: string;
  edizione: EdizioneTimeline;
  precedente: EdizioneTimeline | null;
  successiva: EdizioneTimeline | null;
  tinta: Tinta;
  onScegli: (idKit: string) => void;
}) {
  const dettaglio = useFetchVolantinoPuntoVendita(idPv, edizione.idKit);
  const dati = dettaglio.data;
  const anteprima = dati?.pdf ? urlAnteprimaMateriale(dati.pdf.idOlimpoCloud) : null;
  const giorni = edizione.attivo ? giorniAllaScadenza(edizione.al) : null;
  const stato = edizione.attivo ? `attivo${giorni !== null ? `, ${testoScadenza(giorni).toLowerCase()}` : ""}` : null;

  return (
    <section
      aria-label="Volantino selezionato"
      className="mt-5 grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-card border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] dark:border-darkmode-400 dark:bg-darkmode-700"
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
          <span className="inline-flex items-center gap-1">
            <PuntoInsegna tinta={tinta} />
            {edizione.canale.nome}
          </span>
          <span aria-hidden="true">·</span>
          <span>{edizione.area.nome}</span>
          {stato && (
            <>
              <span aria-hidden="true">·</span>
              <span>{stato}</span>
            </>
          )}
        </p>
        {dettaglio.isLoading ? (
          <Skeleton className="mt-2 h-4 w-3/4" />
        ) : dati ? (
          <>
            <ul aria-label="Il volantino in numeri" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-slate-600 dark:text-slate-300">
              <li><b className="text-slate-800 dark:text-slate-100">{formatNumero(dati.numeri.pagine)}</b> pagine</li>
              <li><b className="text-slate-800 dark:text-slate-100">{formatNumero(dati.numeri.referenze)}</b> referenze</li>
              {dati.numeri.scontoMedio !== null && (
                <li>sconto medio <b className="text-slate-800 dark:text-slate-100">{formatPercentuale(dati.numeri.scontoMedio)}</b></li>
              )}
              <li><b className="text-slate-800 dark:text-slate-100">{formatNumero(dati.numeri.puntiVenditaInLista)}</b> punti vendita nella lista</li>
            </ul>
            {dati.rigaPuntoVendita && (
              <p className="mt-2">
                <span className="sr-only">Riga stampata: </span>
                <RigaStampata>{dati.rigaPuntoVendita.riga}</RigaStampata>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {edizione.numeroReferenze} referenze · i dettagli del volantino non sono arrivati.
          </p>
        )}
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:flex-nowrap">
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
        <Button as={Link} to={percorsoVolantino(idPv, edizione.idKit)} variant="primary">
          Apri volantino
        </Button>
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

/** Timeline del periodo scelto e scheda del volantino selezionato. */
function TimelineStoria({
  idPv,
  analisi,
  eventi,
  anno,
  richiesta,
  tinta,
  onScegli,
}: {
  idPv: string;
  analisi: AnalisiPuntoVendita;
  eventi: readonly EventoStoria[];
  anno: number | null;
  richiesta: string | null;
  tinta: (idCanale: string) => Tinta;
  onScegli: (idKit: string) => void;
}) {
  const edizioni = edizioniDelPeriodo(analisi.timeline, anno);
  const scelta = edizioneScelta(edizioni, richiesta);
  const indice = scelta ? edizioni.indexOf(scelta) : -1;
  const canali = new Map(analisi.timeline.map(e => [e.canale.id, e.canale]));
  const gruppi = [...canali.values()].map(canale => ({ id: canale.id, etichetta: canale.nome, tinta: tinta(canale.id) }));

  return (
    <>
      <TimelineVolantini
        colonne={colonneTimeline(edizioni)}
        gruppi={gruppi}
        fasce={fasceInsegne(analisi.timeline)}
        eventi={eventiTimeline(eventi)}
        nomiEventi={NOMI_EVENTI}
        intervallo={anno ? { dal: `${anno}-01-01`, al: `${anno}-12-31` } : undefined}
        selezionata={scelta?.idKit ?? null}
        onSeleziona={onScegli}
        titolo={`Timeline: ${testoVolantini(edizioni.length)} del punto vendita`}
        descrizioneValore="Referenze"
        descrizioneGruppo="Insegna"
      />
      {scelta ? (
        <EdizioneSelezionata
          idPv={idPv}
          edizione={scelta}
          precedente={edizioni[indice - 1] ?? null}
          successiva={edizioni[indice + 1] ?? null}
          tinta={tinta(scelta.canale.id)}
          onScegli={onScegli}
        />
      ) : (
        <EmptyState compatta icon="CalendarX" title="Nessun volantino in questo anno" description="Scegli un altro anno o tutti gli anni." />
      )}
    </>
  );
}

/**
 * Riquadro "Storia" della scheda: la timeline dei volantini in cui compare il punto vendita, con
 * l'insegna e gli eventi, il periodo (tutti gli anni o uno) e il volantino scelto. Anno e
 * volantino stanno nell'indirizzo, così tornando dal volantino la scheda resta dov'era.
 * Senza volantini è l'unico riquadro della storia: dice che cos'è e come arriva, e a chi gestisce
 * i punti vendita offre l'import degli export (`onImporta`).
 */
export function BoxStoria({
  idPv,
  analisi,
  storia,
  tinta,
  onImporta,
}: {
  idPv: string;
  analisi: QueryBox<AnalisiPuntoVendita>;
  storia: StoriaPuntoVendita | undefined;
  tinta: (idCanale: string) => Tinta;
  onImporta?: () => void;
}) {
  const [parametri, setParametri] = useSearchParams();
  const anni = [...(analisi.data?.anni ?? [])].sort((a, b) => b - a);
  const annoRichiesto = Number(parametri.get(PARAMETRO_ANNO));
  const anno = anni.includes(annoRichiesto) ? annoRichiesto : null;

  const aggiorna = (valori: Record<string, string | null>) =>
    setParametri(
      attuali => {
        const nuovi = new URLSearchParams(attuali);
        for (const [chiave, valore] of Object.entries(valori)) {
          if (valore === null) nuovi.delete(chiave);
          else nuovi.set(chiave, valore);
        }
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
        "Ogni colonna è un volantino in cui compare, alta quanto le sue referenze; sotto, l'insegna e gli eventi. Scegli un volantino per vederlo qui sotto.",
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <Sezione
      titolo="Storia"
      descrizione={descrizione}
      azioni={
        anni.length > 1 ? (
          <Segmenti
            etichetta="Periodo"
            opzioni={[{ valore: "tutti", etichetta: "Tutti gli anni" }, ...anni.map(a => ({ valore: String(a), etichetta: String(a) }))]}
            valore={anno === null ? "tutti" : String(anno)}
            onChange={valore => aggiorna({ [PARAMETRO_ANNO]: valore === "tutti" ? null : valore, [PARAMETRO_VOLANTINO]: null })}
          />
        ) : undefined
      }
    >
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
            eventi={storia?.eventi ?? []}
            anno={anno}
            richiesta={parametri.get(PARAMETRO_VOLANTINO)}
            tinta={tinta}
            onScegli={idKit => aggiorna({ [PARAMETRO_VOLANTINO]: idKit })}
          />
        )}
      </StatoBox>
    </Sezione>
  );
}

/** Gli eventi della storia, dal più recente, con il primo volantino registrato in fondo. */
export function EventiStoria({ storia, primo }: { storia: QueryBox<StoriaPuntoVendita>; primo: EdizioneTimeline | null }) {
  return (
    <Sezione titolo="Eventi" descrizione="Cambi di insegna, area, indirizzo e telefono, dal più recente.">
      <StatoBox
        query={storia}
        titoloErrore="Eventi non caricati"
        vuoto={dati =>
          dati.eventi.length === 0 && !primo ? (
            <EmptyState compatta icon="Clock" title="Nessun cambiamento" description="Nei volantini importati insegna, area, indirizzo e telefono sono sempre gli stessi." />
          ) : null
        }
      >
        {dati => (
          <ul aria-label="Eventi" className="flex flex-col gap-3">
            {dati.eventi.map((evento, i) => {
              const descritto = descriviEvento(evento);
              return (
                <li key={chiaveEvento(evento, i)} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-darkmode-400 dark:text-slate-300">
                    <Lucide icon={descritto.icona} aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{descritto.titolo}</span>{" "}
                      <span className="text-xs tabular-nums text-slate-500">{descritto.data}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{descritto.dettaglio}</p>
                  </div>
                </li>
              );
            })}
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
        )}
      </StatoBox>
    </Sezione>
  );
}

/** Indirizzo e telefono come li hanno stampati i volantini nel tempo, segnalando quelli diversi dall'anagrafica. */
export function RecapitiStampati({ storia }: { storia: QueryBox<StoriaPuntoVendita> }) {
  return (
    <Sezione titolo="Indirizzo e telefono stampati" descrizione="Come i volantini hanno scritto il punto vendita nel tempo.">
      <StatoBox
        query={storia}
        titoloErrore="Recapiti non caricati"
        vuoto={dati =>
          righeRecapiti(dati.recapiti).length === 0 ? (
            <EmptyState compatta icon="MapPinOff" title="Nessun recapito stampato" description="Le righe dei volantini di questo punto vendita non hanno indirizzo né telefono." />
          ) : null
        }
      >
        {dati => (
          <>
            <FasceNelTempo righe={righeRecapiti(dati.recapiti)} titolo="Indirizzo e telefono stampati nel tempo" nomiToni={NOMI_TONI_RECAPITI} />
            <ul aria-label="Recapiti stampati" className="mt-4 flex flex-col divide-y divide-slate-100 text-sm dark:divide-darkmode-400">
              {[...dati.recapiti].sort((a, b) => b.dal.localeCompare(a.dal)).map(recapito => (
                <li
                  key={`${recapito.dal}-${recapito.al}-${recapito.indirizzo ?? ""}-${recapito.telefono ?? ""}`}
                  className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div>{testoRecapito(recapito)}</div>
                    <div className="text-xs text-slate-500">
                      {periodoMesi(recapito.dal, recapito.al)} · {testoVolantini(recapito.volantini)}
                    </div>
                  </div>
                  {recapito.diversoDallAttuale && <StatusBadge tono="warning" etichetta="Diverso dall'attuale" icon="TriangleAlert" />}
                </li>
              ))}
            </ul>
          </>
        )}
      </StatoBox>
    </Sezione>
  );
}

function VoceVolantino({ idPv, volantino, puoAprirePromo }: { idPv: string; volantino: VolantinoNellaStoria; puoAprirePromo: boolean }) {
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);
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
        <Button as={Link} to={percorsoVolantino(idPv, volantino.idKit)} size="sm" variant="outline-secondary">
          <Lucide icon="BookOpen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
          Apri volantino
        </Button>
        {puoAprirePromo && (
          <Button as={Link} to={percorsoKit(promo.id, promo.stato, volantino.idKit)} size="sm" variant="outline-secondary">
            <Lucide icon="ExternalLink" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Apri kit
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
export function TuttiIVolantini({ idPv, puoAprirePromo }: { idPv: string; puoAprirePromo: boolean }) {
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
              <VoceVolantino key={`${volantino.idKit}-${volantino.rigaStampata}`} idPv={idPv} volantino={volantino} puoAprirePromo={puoAprirePromo} />
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
