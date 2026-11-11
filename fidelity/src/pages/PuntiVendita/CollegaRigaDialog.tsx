import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import type { PuntoVenditaInElenco } from "@/components/PuntiVendita/elenco";
import { useCambiaCollegamento, useCollegaRigaNonAbbinata } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import { filtraPuntiVendita } from "@/utils/puntoVendita";
import clsx from "clsx";
import { useMemo, useState } from "react";
import type {
  CandidatoCollegamento,
  CombinazioneRiga,
  ConfrontoConPuntoVendita,
  EsitoCollegamento,
  MotivoCandidato,
  PosizioneRiga,
} from "../../../lib/puntiVendita/analisi";
import { BadgeConfronto, CorreggiPosizione, DescrizionePosizione, LinkMappe, nomeCombinazione } from "./ConfrontoPuntoVendita";
import { MappaConfronto, type PuntoSullaMappa } from "./MappaConfronto";
import { VolantiniRiga } from "./VolantiniRiga";

/** Risultati della ricerca mostrati al massimo: oltre, si affina il testo. */
const MASSIMO_RISULTATI = 8;
/** Caratteri minimi per cercare fra tutti i punti vendita. */
const MINIMO_RICERCA = 2;

export const ETICHETTA_MOTIVO: Readonly<Record<MotivoCandidato, string>> = {
  stesso_telefono: "Stesso telefono",
  stesso_indirizzo: "Stesso indirizzo",
  indirizzo_simile: "Indirizzo simile",
  vicino: "Vicino",
  nome_simile: "Nome o ragione sociale",
  stessa_localita: "Stessa località",
};

/**
 * Le righe da collegare: una riga non abbinata (RigaNonAbbinata) o, per cambiare collegamento, un
 * gruppo già collegato (GruppoCollegato).
 */
export interface RigheDaCollegare {
  chiave: string;
  riga: string;
  varianti: string[];
  volantini: number;
  primoVolantino: string;
  ultimoVolantino: string;
  localita: string | null;
  indirizzo: string | null;
  combinazioni: CombinazioneRiga[];
  posizione: PosizioneRiga | null;
  candidati: CandidatoCollegamento[];
}

interface Opzione {
  id: string;
  nome: string;
  ragioneSociale: string | null;
  indirizzo: string | null;
  citta: string | null;
  combinazione: string | null;
  lat: number | null;
  lon: number | null;
  motivo?: MotivoCandidato;
  confronto?: ConfrontoConPuntoVendita;
  numero?: number;
}

const normalizza = (valore: unknown) =>
  String(valore ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const chiaveCombinazione = (idCanale: string | null | undefined, idArea: string | null | undefined) =>
  idCanale && idArea ? `${idCanale}|${idArea}`.toLowerCase() : null;

/** La ricerca dell'elenco (nome, città, indirizzo, CAP, codici) più la ragione sociale. */
const cercaPuntiVendita = (puntiVendita: PuntoVenditaInElenco[], testo: string): PuntoVenditaInElenco[] => {
  const trovati = new Set(filtraPuntiVendita(puntiVendita, { testo }).map(pv => pv.id));
  const cercato = normalizza(testo);
  return puntiVendita.filter(pv => trovati.has(pv.id) || normalizza(pv.ragionesociale).includes(cercato));
};

interface CollegaRigaDialogProps {
  /** Le righe da collegare; null a dialogo chiuso. */
  riga: RigheDaCollegare | null;
  /** Il punto vendita già scelto all'apertura, per esempio quello con lo stesso telefono. */
  preselezionato?: string | null;
  /** Tutti i punti vendita della GDO, per la ricerca. */
  puntiVendita: PuntoVenditaInElenco[];
  /** Per cambiare collegamento: il PV a cui il gruppo è collegato oggi. */
  collegatoA?: { id: string; nome: string } | null;
  onClose: () => void;
  onCollegata: (esito: EsitoCollegamento, puntoVendita: { id: string; nome: string }) => void;
}

function VocePuntoVendita({ opzione, scelta, onScegli }: { opzione: Opzione; scelta: boolean; onScegli: (id: string) => void }) {
  const indirizzo = [opzione.indirizzo, opzione.citta].filter(Boolean).join(", ");
  return (
    <li>
      <label
        className={clsx(
          "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-theme-1/40",
          scelta
            ? "border-theme-1 bg-theme-1/5 dark:border-theme-1"
            : "border-slate-200 hover:bg-slate-50 dark:border-darkmode-400 dark:hover:bg-darkmode-400/40"
        )}
      >
        <input
          type="radio"
          name="punto-vendita-da-collegare"
          className="mt-1 h-4 w-4 flex-none"
          value={opzione.id}
          checked={scelta}
          onChange={() => onScegli(opzione.id)}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-800 dark:text-slate-100">
            {opzione.numero && <span className="mr-1 tabular-nums text-slate-500">{opzione.numero}.</span>}
            {opzione.nome}
          </span>
          {opzione.ragioneSociale && opzione.ragioneSociale !== opzione.nome && (
            <span className="block break-words text-xs text-slate-600 dark:text-slate-300">{opzione.ragioneSociale}</span>
          )}
          {indirizzo && <span className="block break-words text-xs text-slate-500">{indirizzo}</span>}
          {opzione.combinazione && <span className="block text-xs text-slate-500">{opzione.combinazione}</span>}
          {opzione.confronto && (
            <span className="mt-1 block">
              <BadgeConfronto confronto={opzione.confronto} />
            </span>
          )}
          <span className="mt-1 block">
            <LinkMappe indirizzo={indirizzo} punto={opzione} cosa={opzione.nome} />
          </span>
        </span>
        {opzione.motivo && <StatusBadge tono="info" etichetta={ETICHETTA_MOTIVO[opzione.motivo]} />}
      </label>
    </li>
  );
}

/**
 * Collega le righe dei volantini (con tutte le righe del loro gruppo) a un punto vendita già in
 * anagrafica, solo dello stesso canale e della stessa area dei volantini in cui sono stampate:
 * prima i suggeriti dal server (stesso telefono, stesso indirizzo, indirizzo simile, vicini alla
 * posizione stampata, nome o ragione sociale, stessa località), ognuno col confronto e la distanza,
 * poi la ricerca fra i punti vendita della GDO con quel canale e quell'area. La mappa mostra la
 * posizione stampata e i suggeriti; Google Maps e Street View servono a controllare dove OpenStreetMap
 * non è aggiornato. Con `collegatoA` cambia il collegamento di un gruppo già collegato.
 * L'anagrafica non cambia; il collegamento vale anche per i volantini sincronizzati di nuovo o futuri.
 */
export function CollegaRigaDialog({ riga, preselezionato = null, puntiVendita, collegatoA = null, onClose, onCollegata }: CollegaRigaDialogProps) {
  const collega = useCollegaRigaNonAbbinata();
  const cambia = useCambiaCollegamento();
  const mutazione = collegatoA ? cambia : collega;
  // Per un'altra riga il chiamante rimonta il dialogo (key): scelta e ricerca ripartono da qui
  const [scelto, setScelto] = useState<string | null>(preselezionato);
  const [ricerca, setRicerca] = useState("");
  const [volantiniAperti, setVolantiniAperti] = useState(false);

  const combinazioniRiga = useMemo(
    () => new Set((riga?.combinazioni ?? []).map(c => chiaveCombinazione(c.canale?.id, c.area?.id)).filter((c): c is string => c !== null)),
    [riga]
  );
  // Solo i PV dello stesso canale e della stessa area dei volantini della riga
  const ammessi = useMemo(
    () => puntiVendita.filter(pv => combinazioniRiga.size === 0 || combinazioniRiga.has(chiaveCombinazione(pv.id_canale, pv.id_area) ?? "")),
    [puntiVendita, combinazioniRiga]
  );

  const candidati = useMemo<Opzione[]>(
    () => (riga?.candidati ?? []).map(({ puntoVendita, motivo, confronto }, indice) => ({
      id: puntoVendita.id,
      nome: puntoVendita.nome,
      ragioneSociale: puntoVendita.ragioneSociale,
      indirizzo: puntoVendita.indirizzo,
      citta: puntoVendita.citta,
      combinazione: puntoVendita.combinazione ? nomeCombinazione(puntoVendita.combinazione) : null,
      lat: puntoVendita.lat,
      lon: puntoVendita.lon,
      motivo,
      confronto,
      numero: indice + 1,
    })),
    [riga]
  );
  const testo = ricerca.trim();
  const risultati = useMemo<Opzione[]>(() => {
    if (testo.length < MINIMO_RICERCA) return [];
    return cercaPuntiVendita(ammessi, testo)
      .filter(pv => pv.id !== collegatoA?.id)
      .map(pv => ({
        id: pv.id,
        nome: pv.nome,
        ragioneSociale: pv.ragionesociale || null,
        indirizzo: pv.indirizzo || null,
        citta: pv.citta || null,
        combinazione: pv.nome_canale || pv.nome_area ? `${pv.nome_canale ?? ""} · ${pv.nome_area ?? ""}` : null,
        lat: pv.coordinate?.lat ?? null,
        lon: pv.coordinate?.lon ?? null,
      }));
  }, [ammessi, testo, collegatoA]);
  const opzioneDi = (id: string) => candidati.find(opzione => opzione.id === id) ?? risultati.find(opzione => opzione.id === id);
  const nomeDi = (id: string) => opzioneDi(id)?.nome ?? puntiVendita.find(pv => pv.id === id)?.nome ?? "";

  const puntiSullaMappa = useMemo<PuntoSullaMappa[]>(() => {
    const punti: PuntoSullaMappa[] = candidati.map(opzione => ({ ...opzione, principale: opzione.id === scelto }));
    const sceltoFraRisultati = risultati.find(opzione => opzione.id === scelto && !candidati.some(candidato => candidato.id === opzione.id));
    if (sceltoFraRisultati) punti.push({ ...sceltoFraRisultati, principale: true });
    return punti;
  }, [candidati, risultati, scelto]);

  const chiudi = () => {
    if (mutazione.isPending) return;
    onClose();
  };

  const conferma = () => {
    if (!riga || !scelto) return;
    const puntoVendita = { id: scelto, nome: nomeDi(scelto) };
    const fatto = { onSuccess: (esito: EsitoCollegamento) => onCollegata(esito, puntoVendita) };
    if (collegatoA) cambia.mutate({ chiave: riga.chiave, idPuntoVenditaAttuale: collegatoA.id, idPuntoVendita: scelto }, fatto);
    else collega.mutate({ chiave: riga.chiave, idPuntoVendita: scelto }, fatto);
  };

  const altreVarianti = (riga?.varianti ?? []).filter(variante => variante !== riga?.riga);
  const indirizzoStampato = riga ? [riga.indirizzo, riga.localita].filter(Boolean).join(", ") : "";
  const nomiCombinazioni = (riga?.combinazioni ?? []).map(nomeCombinazione).join(", ");

  return (
    <Dialog size="xl" open={riga !== null} onClose={chiudi}>
      <Dialog.Panel>
        <Dialog.Title>{collegatoA ? "Cambia collegamento" : "Collega a un punto vendita"}</Dialog.Title>
        {riga && (
          <Dialog.Description>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs text-slate-500">Come era stampato</div>
                <div className="mt-1 break-words font-mono text-xs text-slate-700 dark:text-slate-300">{riga.riga}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {riga.volantini === 1 ? "1 volantino" : `${formatNumero(riga.volantini)} volantini`}, dal {formatData(riga.primoVolantino)} al{" "}
                  {formatData(riga.ultimoVolantino)}
                  {nomiCombinazioni && <> · {nomiCombinazioni}</>}
                </div>
                {collegatoA && <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Oggi collegato a {collegatoA.nome}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <DescrizionePosizione posizione={riga.posizione} />
                  <LinkMappe indirizzo={indirizzoStampato} punto={riga.posizione} cosa="l'indirizzo stampato" />
                </div>
                {riga.posizione && (
                  <div className="mt-2">
                    <CorreggiPosizione chiave={riga.posizione.chiave} />
                  </div>
                )}
              </div>

              {!collegatoA && (
                <div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    aria-expanded={volantiniAperti}
                    onClick={() => setVolantiniAperti(aperti => !aperti)}
                  >
                    <Lucide icon={volantiniAperti ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                    In quali volantini
                  </Button>
                  {volantiniAperti && (
                    <div className="mt-2">
                      <VolantiniRiga chiave={riga.chiave} />
                    </div>
                  )}
                </div>
              )}

              {altreVarianti.length > 0 && (
                <Alert variant="soft-warning" icona="TriangleAlert" className="px-3 py-2 text-sm">
                  <p>Con lo stesso telefono o indirizzo è stampato anche come:</p>
                  <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                    {altreVarianti.map(variante => (
                      <li key={variante} className="break-words">{variante}</li>
                    ))}
                  </ul>
                  <p className="mt-1">Verranno collegate tutte allo stesso punto vendita, se stampate nel suo canale e nella sua area.</p>
                </Alert>
              )}

              <MappaConfronto
                posizione={riga.posizione}
                puntiVendita={puntiSullaMappa}
                distanzaPrincipale={opzioneDi(scelto ?? "")?.confronto?.distanzaMetri ?? null}
                etichetta="Mappa della posizione stampata e dei punti vendita suggeriti"
              />

              <fieldset>
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Punti vendita suggeriti</legend>
                {candidati.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Nessun punto vendita {nomiCombinazioni ? `di ${nomiCombinazioni} ` : ""}con lo stesso telefono, indirizzo o località, né vicino: cercalo qui sotto.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2" aria-label="Punti vendita suggeriti">
                    {candidati.map(opzione => (
                      <VocePuntoVendita key={opzione.id} opzione={opzione} scelta={scelto === opzione.id} onScegli={setScelto} />
                    ))}
                  </ul>
                )}
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Oppure cerca fra i punti vendita {nomiCombinazioni ? `di ${nomiCombinazioni}` : "della GDO"}
                </legend>
                <CampoRicerca
                  className="mt-2 w-full sm:w-full"
                  value={ricerca}
                  onChange={setRicerca}
                  etichetta="Cerca il punto vendita da collegare"
                  placeholder="Nome, ragione sociale, città, indirizzo, CAP o codice"
                />
                {testo.length >= MINIMO_RICERCA && (
                  risultati.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Nessun punto vendita trovato{nomiCombinazioni ? ` di ${nomiCombinazioni}` : ""}.
                    </p>
                  ) : (
                    <>
                      <ul className="mt-2 flex flex-col gap-2" aria-label="Punti vendita trovati">
                        {risultati.slice(0, MASSIMO_RISULTATI).map(opzione => (
                          <VocePuntoVendita key={opzione.id} opzione={opzione} scelta={scelto === opzione.id} onScegli={setScelto} />
                        ))}
                      </ul>
                      {risultati.length > MASSIMO_RISULTATI && (
                        <p className="mt-2 text-xs text-slate-500">
                          Altri {formatNumero(risultati.length - MASSIMO_RISULTATI)} punti vendita: affina la ricerca.
                        </p>
                      )}
                    </>
                  )
                )}
              </fieldset>

              <p className="flex items-start gap-2 text-xs text-slate-500">
                <Lucide icon="Info" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none" />
                Si collega solo a un punto vendita dello stesso canale e della stessa area dei volantini. L'anagrafica non cambia. Il
                collegamento vale anche per i volantini sincronizzati di nuovo e per quelli futuri, e si può annullare da «Collegate a
                mano».
              </p>

              {mutazione.isError && (
                <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-sm" role="alert">
                  {collegatoA ? "Cambio non riuscito" : "Collegamento non riuscito"}: {(mutazione.error as Error)?.message || "errore del server"}
                </Alert>
              )}
            </div>
          </Dialog.Description>
        )}
        <Dialog.Footer>
          <Button variant="outline-secondary" className="mr-2" onClick={chiudi} disabled={mutazione.isPending}>
            Annulla
          </Button>
          <Button variant="primary" onClick={conferma} disabled={!scelto || mutazione.isPending} loading={mutazione.isPending}>
            <Lucide icon="Link" aria-hidden="true" className="mr-1 h-4 w-4" />
            {collegatoA ? "Cambia" : "Collega"}
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
}

export default CollegaRigaDialog;
