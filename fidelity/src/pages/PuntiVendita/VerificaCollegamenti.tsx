import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import type { PuntoVenditaInElenco } from "@/components/PuntiVendita/elenco";
import { PERMISSIONS } from "@/constants/permissions";
import { useFetchVerificaCollegamenti, useScollegaCollegamentoManuale } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import clsx from "clsx";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  type ConfrontoDato,
  type EsitoCollegamento,
  type EsitoVerifica,
  type GruppoCollegato,
  type MotivoVerifica,
  type TipoCollegamento,
} from "../../../lib/puntiVendita/analisi";
import type { TipoAbbinamento } from "../../../lib/puntiVendita/storia";
import { CollegaRigaDialog } from "./CollegaRigaDialog";
import {
  BadgeDistanza,
  CorreggiPosizione,
  DescrizionePosizione,
  EsitoDato,
  formattaDistanza,
  LinkMappe,
  nomeCombinazione,
} from "./ConfrontoPuntoVendita";
import { MappaConfronto, type PuntoSullaMappa } from "./MappaConfronto";
import { percentualeRicerca, usePosizioniRighe } from "./usePosizioniRighe";

const DIMENSIONI_PAGINA = [10, 25, 50];
const TITOLO = "Verifica dei collegamenti";
const DESCRIZIONE =
  "Le righe dei volantini collegate a un punto vendita, a mano o in automatico, messe a confronto con l'anagrafica: canale e area, distanza fra l'indirizzo stampato e il punto vendita, telefono, indirizzo e località. Correggi quelle incongruenti con «Cambia collegamento».";

type FiltroEsito = EsitoVerifica | "tutti";
type FiltroTipo = TipoCollegamento | "tutti";

const ESITO: Readonly<Record<EsitoVerifica, { etichetta: string; tono: "danger" | "warning" | "success"; icona: string }>> = {
  incongruente: { etichetta: "Incongruente", tono: "danger", icona: "OctagonAlert" },
  da_verificare: { etichetta: "Da verificare", tono: "warning", icona: "TriangleAlert" },
  coerente: { etichetta: "Coerente", tono: "success", icona: "CircleCheck" },
};

const ETICHETTA_ABBINAMENTO: Readonly<Record<TipoAbbinamento, string>> = {
  manuale: "A mano",
  telefono: "Per telefono",
  indirizzo: "Per indirizzo",
  probabile: "Probabile",
};

const ICONA_LIVELLO: Readonly<Record<MotivoVerifica["livello"], { icona: string; classe: string }>> = {
  incongruente: { icona: "OctagonAlert", classe: "text-danger" },
  da_verificare: { icona: "TriangleAlert", classe: "text-warning" },
  informazione: { icona: "Info", classe: "text-slate-400" },
};

const righe = (numero: number) => (numero === 1 ? "1 riga" : `${formatNumero(numero)} righe`);
const volantini = (numero: number) => (numero === 1 ? "1 volantino" : `${formatNumero(numero)} volantini`);

/** La ricerca delle posizioni delle righe: avvio, avanzamento in tempo reale, annullamento, riepilogo. */
function RicercaPosizioni({ daCercare, nonTrovate }: { daCercare: number; nonTrovate: number }) {
  const ricerca = usePosizioniRighe();
  const { stato } = ricerca;

  if (stato && ricerca.inCorso) {
    const percentuale = percentualeRicerca(stato);
    return (
      <div role="status" aria-label="Ricerca delle posizioni in corso" className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-darkmode-400">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Ricerca delle posizioni: {formatNumero(stato.esaminate)} di {formatNumero(stato.totale)}
          </span>
          <Button size="sm" variant="outline-secondary" onClick={() => void ricerca.annulla()} disabled={ricerca.annullamentoInCorso} loading={ricerca.annullamentoInCorso}>
            Annulla
          </Button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentuale}>
          <div className="h-full bg-primary transition-all" style={{ width: `${percentuale}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          {formatNumero(stato.trovate)} trovate ({formatNumero(stato.approssimate)} solo via o comune) · {formatNumero(stato.nonTrovate)} non trovate
          {stato.errori > 0 && <> · {formatNumero(stato.errori)} errori di OpenStreetMap</>}. Una richiesta ogni 1,2 secondi: puoi lasciare la pagina, la
          ricerca continua.
        </p>
      </div>
    );
  }

  const finita = stato && !ricerca.inCorso ? stato : null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-darkmode-400">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {daCercare > 0
            ? `${formatNumero(daCercare)} indirizzi stampati senza posizione: cercala per misurare le distanze.`
            : "Tutti gli indirizzi stampati hanno una posizione cercata."}
          {nonTrovate > 0 && ` ${formatNumero(nonTrovate)} non trovati da OpenStreetMap.`}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
            <Button size="sm" variant="primary" onClick={() => void ricerca.avvia()} disabled={daCercare === 0 || ricerca.avvioInCorso} loading={ricerca.avvioInCorso}>
              <Lucide icon="MapPin" aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              Cerca le posizioni
            </Button>
          </PermissionGate>
          {nonTrovate > 0 && (
            <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
              <Button size="sm" variant="outline-secondary" onClick={() => void ricerca.avvia({ nonTrovate: true })} disabled={ricerca.avvioInCorso}>
                Riprova le non trovate
              </Button>
            </PermissionGate>
          )}
        </span>
      </div>
      {finita && (
        <p role="status" className={clsx("text-xs", finita.stato === "completato" ? "text-slate-500" : "text-warning")}>
          {finita.stato === "completato" ? "Ultima ricerca completata" : finita.stato === "annullato" ? "Ultima ricerca annullata" : "Ultima ricerca interrotta"}
          : {formatNumero(finita.trovate)} trovate, {formatNumero(finita.nonTrovate)} non trovate
          {finita.errori > 0 && `, ${formatNumero(finita.errori)} errori`}
          {finita.stato === "errore" && finita.ultimoErrore ? `. ${finita.ultimoErrore}` : "."}
        </p>
      )}
      {ricerca.errore && (
        <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-xs" role="alert">
          {ricerca.errore}
        </Alert>
      )}
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Lucide icon="Info" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none" />
        La posizione viene da OpenStreetMap, che può non avere le vie e i civici più recenti: controlla con Google Maps o Street View e,
        se serve, correggila incollando le coordinate.
      </p>
    </div>
  );
}

/** Una riga del confronto fra stampato e anagrafica. */
function RigaConfronto({ dato, stampato, anagrafica, esito }: { dato: string; stampato: ReactNode; anagrafica: ReactNode; esito: ConfrontoDato | null }) {
  return (
    <tr className="border-t border-slate-100 align-top dark:border-darkmode-400">
      <th scope="row" className="py-1.5 pr-3 text-left text-xs font-medium text-slate-500">{dato}</th>
      <td className="py-1.5 pr-3 text-xs text-slate-700 dark:text-slate-300">{stampato || "-"}</td>
      <td className="py-1.5 pr-3 text-xs text-slate-700 dark:text-slate-300">{anagrafica || "-"}</td>
      <td className="py-1.5 text-xs">{esito && <EsitoDato dato={dato} esito={esito} />}</td>
    </tr>
  );
}

/** Il dettaglio di un gruppo: motivi, confronto, mappa, posizione, PV vicini e azioni. */
function DettaglioGruppo({ gruppo, onCambia, onScollegato }: {
  gruppo: GruppoCollegato;
  onCambia: (gruppo: GruppoCollegato, preselezionato: string | null) => void;
  onScollegato: (righe: number) => void;
}) {
  const scollega = useScollegaCollegamentoManuale();
  const [conferma, setConferma] = useState(false);
  const { puntoVendita, confronto } = gruppo;
  const indirizzoStampato = [gruppo.indirizzo, gruppo.localita].filter(Boolean).join(", ");
  const indirizzoPv = [puntoVendita.indirizzo, puntoVendita.citta].filter(Boolean).join(", ");
  const puntiSullaMappa = useMemo<PuntoSullaMappa[]>(
    () => [
      { id: puntoVendita.id, nome: puntoVendita.nome, lat: puntoVendita.lat, lon: puntoVendita.lon, principale: true },
      ...gruppo.vicini.map((vicino, indice) => ({ ...vicino.puntoVendita, numero: indice + 1 })),
    ],
    [puntoVendita, gruppo.vicini]
  );
  const stessaCombinazione: ConfrontoDato = confronto.stessaCombinazione ? "uguale" : "diverso";

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-4 dark:border-darkmode-400">
      {gruppo.motivi.length > 0 && (
        <ul aria-label="Motivi" className="flex flex-col gap-1">
          {gruppo.motivi.map(motivo => (
            <li key={`${motivo.tipo}-${motivo.testo}`} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Lucide icon={ICONA_LIVELLO[motivo.livello].icona} aria-hidden="true" className={clsx("mt-0.5 h-4 w-4 flex-none", ICONA_LIVELLO[motivo.livello].classe)} />
              <span>
                {motivo.testo}
                {motivo.puntoVendita && (
                  <Button size="sm" variant="outline-secondary" className="ml-2" onClick={() => onCambia(gruppo, motivo.puntoVendita?.id ?? null)}>
                    Collega a {motivo.puntoVendita.nome}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Stampato nei volantini e anagrafica">
            <thead>
              <tr>
                <th scope="col" className="pb-1 text-left text-2xs font-medium uppercase text-slate-400"><span className="sr-only">Dato</span></th>
                <th scope="col" className="pb-1 text-left text-2xs font-medium uppercase text-slate-400">Stampato nei volantini</th>
                <th scope="col" className="pb-1 text-left text-2xs font-medium uppercase text-slate-400">Punto vendita collegato</th>
                <th scope="col" className="pb-1 text-left text-2xs font-medium uppercase text-slate-400"><span className="sr-only">Confronto</span></th>
              </tr>
            </thead>
            <tbody>
              <RigaConfronto
                dato="Insegna e area"
                stampato={gruppo.combinazioni.map(nomeCombinazione).join(", ")}
                anagrafica={nomeCombinazione(puntoVendita.combinazione)}
                esito={stessaCombinazione}
              />
              <RigaConfronto dato="Indirizzo" stampato={gruppo.indirizzo} anagrafica={puntoVendita.indirizzo} esito={confronto.indirizzo} />
              <RigaConfronto dato="Località" stampato={gruppo.localita} anagrafica={puntoVendita.citta} esito={confronto.localita} />
              <RigaConfronto dato="Provincia" stampato={gruppo.provincia} anagrafica={puntoVendita.provincia} esito={confronto.provincia} />
              <RigaConfronto dato="Telefono" stampato={gruppo.telefono} anagrafica={puntoVendita.telefono} esito={confronto.telefono} />
              <RigaConfronto
                dato="Distanza"
                stampato={<DescrizionePosizione posizione={gruppo.posizione} />}
                anagrafica={puntoVendita.lat === null ? "Senza coordinate" : null}
                esito={null}
              />
            </tbody>
          </table>
          <div className="mt-3 flex flex-col gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Stampato:</span>
              <LinkMappe indirizzo={indirizzoStampato} punto={gruppo.posizione} cosa="l'indirizzo stampato" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Punto vendita:</span>
              <LinkMappe indirizzo={indirizzoPv} punto={puntoVendita} cosa={puntoVendita.nome} />
            </div>
            {gruppo.posizione && <CorreggiPosizione chiave={gruppo.posizione.chiave} />}
          </div>
        </div>

        <MappaConfronto
          posizione={gruppo.posizione}
          puntiVendita={puntiSullaMappa}
          distanzaPrincipale={confronto.distanzaMetri}
          etichetta={`Mappa di ${gruppo.riga} e di ${puntoVendita.nome}`}
        />
      </div>

      {gruppo.vicini.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">Altri punti vendita vicini, della stessa insegna e area</h4>
          <ul className="mt-2 flex flex-col gap-1" aria-label="Punti vendita vicini">
            {gruppo.vicini.map((vicino, indice) => (
              <li key={vicino.puntoVendita.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="tabular-nums text-slate-500">{indice + 1}.</span>
                <span className="font-medium">{vicino.puntoVendita.nome}</span>
                <span className="text-xs text-slate-500">{[vicino.puntoVendita.indirizzo, vicino.puntoVendita.citta].filter(Boolean).join(", ")}</span>
                <StatusBadge tono="info" icon="Ruler" etichetta={`a ${formattaDistanza(vicino.metri)}`} />
                <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
                  <Button size="sm" variant="outline-secondary" onClick={() => onCambia(gruppo, vicino.puntoVendita.id)} aria-label={`Collega a ${vicino.puntoVendita.nome}`}>
                    Collega qui
                  </Button>
                </PermissionGate>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
          <Button size="sm" variant="primary" onClick={() => onCambia(gruppo, null)} aria-label={`Cambia collegamento di ${gruppo.riga}`}>
            <Lucide icon="Link" aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            Cambia collegamento
          </Button>
        </PermissionGate>
        {gruppo.idCollegamento && !conferma && (
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
            <Button size="sm" variant="outline-secondary" onClick={() => setConferma(true)} aria-label={`Scollega ${gruppo.riga}`}>
              <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              Scollega
            </Button>
          </PermissionGate>
        )}
        {gruppo.idCollegamento && conferma && (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-300">Le righe tornano all'abbinamento automatico.</span>
            <Button
              size="sm"
              variant="danger"
              loading={scollega.isPending}
              disabled={scollega.isPending}
              onClick={() => scollega.mutate(gruppo.idCollegamento as string, { onSuccess: esito => onScollegato(esito.righe) })}
            >
              Conferma
            </Button>
            <Button size="sm" variant="outline-secondary" disabled={scollega.isPending} onClick={() => setConferma(false)}>
              Annulla
            </Button>
            {scollega.isError && (
              <span role="alert" className="text-xs text-danger">
                {(scollega.error as Error)?.message || "Non riuscito"}
              </span>
            )}
          </span>
        )}
        <Link
          to={`/gestione-interna/punti-vendita/${puntoVendita.id}`}
          className="text-xs text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
        >
          Apri il punto vendita
        </Link>
      </div>
    </div>
  );
}

/** Un gruppo collegato: in breve, e il dettaglio a richiesta. */
function VoceGruppo({ gruppo, aperto, onApri, onCambia, onScollegato }: {
  gruppo: GruppoCollegato;
  aperto: boolean;
  onApri: () => void;
  onCambia: (gruppo: GruppoCollegato, preselezionato: string | null) => void;
  onScollegato: (righe: number) => void;
}) {
  const esito = ESITO[gruppo.esito];
  const primoMotivo = gruppo.motivi.find(motivo => motivo.livello !== "informazione");
  const idDettaglio = `verifica-${gruppo.puntoVendita.id}-${gruppo.chiave}`;
  return (
    <li className="border-t border-slate-200 first:border-t-0 dark:border-darkmode-400">
      <button
        type="button"
        onClick={onApri}
        aria-expanded={aperto}
        aria-controls={idDettaglio}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-400/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tono={esito.tono} icon={esito.icona} etichetta={esito.etichetta} />
          <span className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{gruppo.riga}</span>
          <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5 flex-none text-slate-400" />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{gruppo.puntoVendita.nome}</span>
          {gruppo.confronto.distanzaMetri !== null && <BadgeDistanza metri={gruppo.confronto.distanzaMetri} />}
          {gruppo.abbinamenti.map(abbinamento => (
            <StatusBadge key={abbinamento} tono="neutral" etichetta={ETICHETTA_ABBINAMENTO[abbinamento]} />
          ))}
          <Lucide icon={aperto ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="ml-auto h-4 w-4 flex-none text-slate-400" />
        </span>
        <span className="text-xs text-slate-500">
          {gruppo.combinazioni.map(nomeCombinazione).join(", ")} · {volantini(gruppo.volantini)}, dal {formatData(gruppo.primoVolantino)} al{" "}
          {formatData(gruppo.ultimoVolantino)}
        </span>
        {primoMotivo && <span className="text-xs text-slate-600 dark:text-slate-300">{primoMotivo.testo}</span>}
      </button>
      {aperto && (
        <div id={idDettaglio}>
          <DettaglioGruppo gruppo={gruppo} onCambia={onCambia} onScollegato={onScollegato} />
        </div>
      )}
    </li>
  );
}

/**
 * La verifica dei collegamenti fra le righe dei volantini e i punti vendita (contratto in
 * lib/puntiVendita/analisi.ts, GruppoCollegato): per ogni gruppo di righe collegato, a mano o in
 * automatico, l'esito (incongruente, da verificare, coerente) e i motivi; nel dettaglio il confronto
 * fra stampato e anagrafica, la mappa con la posizione stampata e il PV, Google Maps e Street View,
 * i PV vicini della stessa insegna e area, il cambio del collegamento e, per quelli fatti a mano,
 * l'annullamento. La ricerca delle posizioni gira in background con l'avanzamento in tempo reale.
 */
export function VerificaCollegamenti({ puntiVendita }: { puntiVendita: PuntoVenditaInElenco[] }) {
  const [esito, setEsito] = useState<FiltroEsito>("incongruente");
  const [tipo, setTipo] = useState<FiltroTipo>("tutti");
  const [pagina, setPagina] = useState(1);
  const [dimensione, setDimensione] = useState(DIMENSIONI_PAGINA[0]);
  const [aperto, setAperto] = useState<string | null>(null);
  const [daCambiare, setDaCambiare] = useState<{ gruppo: GruppoCollegato; preselezionato: string | null } | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const query = useFetchVerificaCollegamenti({
    esito: esito === "tutti" ? null : esito,
    tipo: tipo === "tutti" ? null : tipo,
    pagina,
    dimensione,
  });
  const gruppi = query.data?.gruppi ?? [];
  const conteggi = query.data?.conteggi;
  const totaleTutti = conteggi ? conteggi.incongruente + conteggi.da_verificare + conteggi.coerente : undefined;

  const cambiaFiltro = <T,>(imposta: (valore: T) => void) => (valore: T) => {
    imposta(valore);
    setPagina(1);
    setAperto(null);
    setMessaggio(null);
  };
  const cambiato = (risultato: EsitoCollegamento, puntoVendita: { nome: string }) => {
    setDaCambiare(null);
    setAperto(null);
    setMessaggio(`${righe(risultato.righe)} dei volantini collegate a ${puntoVendita.nome}.`);
  };
  const scollegato = (numero: number) => {
    setAperto(null);
    setMessaggio(`Collegamento annullato: ${righe(numero)} tornano all'abbinamento automatico.`);
  };

  if (!query.isLoading && !query.isError && totaleTutti === 0 && tipo === "tutti") {
    return (
      <Sezione compatta aria-label={TITOLO} className="py-3">
        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Lucide icon="Link" aria-hidden="true" className="h-4 w-4 flex-none text-slate-400" />
          Nessuna riga dei volantini collegata a un punto vendita da verificare
        </p>
      </Sezione>
    );
  }

  let contenuto: ReactNode;
  if (query.isLoading) {
    contenuto = (
      <div aria-busy="true" aria-label="Caricamento della verifica" className="flex flex-col gap-3 border-t border-slate-200 p-5 dark:border-darkmode-400">
        {Array.from({ length: 3 }, (_, indice) => (
          <Skeleton key={indice} className="h-4" />
        ))}
      </div>
    );
  } else if (query.isError) {
    contenuto = (
      <div className="px-5 pb-5">
        <PageError
          compatta
          titolo="Verifica non caricata"
          motivo={(query.error as Error | null)?.message || "Errore durante la verifica dei collegamenti"}
          onRiprova={() => query.refetch()}
        />
      </div>
    );
  } else if (gruppi.length === 0) {
    contenuto = (
      <EmptyState
        compatta
        icon="ListChecks"
        title={esito === "incongruente" ? "Nessun collegamento incongruente" : "Nessun collegamento con questo filtro"}
        description={(query.data?.totale ?? 0) === 0 ? "Prova un altro filtro." : "I collegamenti sono nelle pagine precedenti."}
      />
    );
  } else {
    contenuto = (
      <ul aria-label="Collegamenti verificati" className="border-y border-slate-200 dark:border-darkmode-400">
        {gruppi.map(gruppo => {
          const chiave = `${gruppo.puntoVendita.id}|${gruppo.chiave}`;
          return (
            <VoceGruppo
              key={chiave}
              gruppo={gruppo}
              aperto={aperto === chiave}
              onApri={() => setAperto(attuale => (attuale === chiave ? null : chiave))}
              onCambia={(scelto, preselezionato) => {
                setMessaggio(null);
                setDaCambiare({ gruppo: scelto, preselezionato });
              }}
              onScollegato={scollegato}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <Sezione
      senzaPadding
      titolo={TITOLO}
      descrizione={DESCRIZIONE}
      azioni={
        <Segmenti<FiltroEsito>
          etichetta="Esito della verifica"
          valore={esito}
          onChange={cambiaFiltro(setEsito)}
          opzioni={[
            { valore: "incongruente", etichetta: "Incongruenti", conteggio: conteggi?.incongruente },
            { valore: "da_verificare", etichetta: "Da verificare", conteggio: conteggi?.da_verificare },
            { valore: "coerente", etichetta: "Coerenti", conteggio: conteggi?.coerente },
            { valore: "tutti", etichetta: "Tutti", conteggio: totaleTutti },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-3 px-5 pb-3">
        <Segmenti<FiltroTipo>
          etichetta="Tipo di collegamento"
          valore={tipo}
          onChange={cambiaFiltro(setTipo)}
          opzioni={[
            { valore: "tutti", etichetta: "Tutti" },
            { valore: "manuale", etichetta: "A mano" },
            { valore: "automatico", etichetta: "Automatici" },
          ]}
        />
        {query.data && <RicercaPosizioni daCercare={query.data.posizioniDaCercare} nonTrovate={query.data.posizioniNonTrovate} />}
        {messaggio && (
          <Alert variant="soft-success" icona="CircleCheck" className="px-3 py-2 text-sm" role="status">
            {messaggio}
          </Alert>
        )}
      </div>
      {contenuto}
      <PaginazioneTabella
        totale={query.data?.totale ?? 0}
        pagina={pagina}
        dimensionePagina={dimensione}
        opzioniDimensione={DIMENSIONI_PAGINA}
        onCambiaPagina={nuova => {
          setPagina(nuova);
          setAperto(null);
        }}
        onCambiaDimensione={nuova => {
          setDimensione(nuova);
          setPagina(1);
        }}
        unita="collegamenti"
      />
      <CollegaRigaDialog
        key={daCambiare ? `${daCambiare.gruppo.puntoVendita.id}|${daCambiare.gruppo.chiave}|${daCambiare.preselezionato ?? ""}` : "chiuso"}
        riga={daCambiare?.gruppo ?? null}
        preselezionato={daCambiare?.preselezionato ?? null}
        collegatoA={daCambiare ? { id: daCambiare.gruppo.puntoVendita.id, nome: daCambiare.gruppo.puntoVendita.nome } : null}
        puntiVendita={puntiVendita}
        onClose={() => setDaCambiare(null)}
        onCollegata={cambiato}
      />
    </Sezione>
  );
}

export default VerificaCollegamenti;
