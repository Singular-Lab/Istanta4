import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import type { PuntoVenditaInElenco } from "@/components/PuntiVendita/elenco";
import { useCollegaRigaNonAbbinata } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import { filtraPuntiVendita } from "@/utils/puntoVendita";
import clsx from "clsx";
import { useMemo, useState } from "react";
import type { EsitoCollegamento, MotivoCandidato, RigaNonAbbinata } from "../../../lib/puntiVendita/analisi";
import { VolantiniRiga } from "./VolantiniRiga";

/** Risultati della ricerca mostrati al massimo: oltre, si affina il testo. */
const MASSIMO_RISULTATI = 8;
/** Caratteri minimi per cercare fra tutti i punti vendita. */
const MINIMO_RICERCA = 2;

export const ETICHETTA_MOTIVO: Readonly<Record<MotivoCandidato, string>> = {
  stesso_telefono: "Stesso telefono",
  stesso_indirizzo: "Stesso indirizzo",
  indirizzo_simile: "Indirizzo simile",
  nome_simile: "Nome o ragione sociale",
  stessa_localita: "Stessa località",
};

interface Opzione {
  id: string;
  nome: string;
  ragioneSociale: string | null;
  indirizzo: string | null;
  citta: string | null;
  motivo?: MotivoCandidato;
}

const normalizza = (valore: unknown) =>
  String(valore ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** La ricerca dell'elenco (nome, città, indirizzo, CAP, codici) più la ragione sociale. */
const cercaPuntiVendita = (puntiVendita: PuntoVenditaInElenco[], testo: string): PuntoVenditaInElenco[] => {
  const trovati = new Set(filtraPuntiVendita(puntiVendita, { testo }).map(pv => pv.id));
  const cercato = normalizza(testo);
  return puntiVendita.filter(pv => trovati.has(pv.id) || normalizza(pv.ragionesociale).includes(cercato));
};

interface CollegaRigaDialogProps {
  /** La riga da collegare; null a dialogo chiuso. */
  riga: RigaNonAbbinata | null;
  /** Il punto vendita già scelto all'apertura, per esempio quello con lo stesso telefono. */
  preselezionato?: string | null;
  /** Tutti i punti vendita della GDO, per la ricerca. */
  puntiVendita: PuntoVenditaInElenco[];
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
          <span className="block font-medium text-slate-800 dark:text-slate-100">{opzione.nome}</span>
          {opzione.ragioneSociale && opzione.ragioneSociale !== opzione.nome && (
            <span className="block break-words text-xs text-slate-600 dark:text-slate-300">{opzione.ragioneSociale}</span>
          )}
          {indirizzo && <span className="block break-words text-xs text-slate-500">{indirizzo}</span>}
        </span>
        {opzione.motivo && <StatusBadge tono="info" etichetta={ETICHETTA_MOTIVO[opzione.motivo]} />}
      </label>
    </li>
  );
}

/**
 * Collega una riga dei volantini non abbinata (con tutte le righe del suo gruppo) a un punto vendita
 * già in anagrafica: prima i suggeriti dal server (stesso telefono, stesso indirizzo, indirizzo
 * simile, nome o ragione sociale, stessa località), poi la ricerca fra tutti i punti vendita della
 * GDO, anche per ragione sociale. "In quali volantini" mostra dove è stata stampata. L'anagrafica
 * non cambia; il collegamento vale anche per i volantini sincronizzati di nuovo o futuri.
 */
export function CollegaRigaDialog({ riga, preselezionato = null, puntiVendita, onClose, onCollegata }: CollegaRigaDialogProps) {
  const collega = useCollegaRigaNonAbbinata();
  // Per un'altra riga il chiamante rimonta il dialogo (key): scelta e ricerca ripartono da qui
  const [scelto, setScelto] = useState<string | null>(preselezionato);
  const [ricerca, setRicerca] = useState("");
  const [volantiniAperti, setVolantiniAperti] = useState(false);

  const candidati = useMemo<Opzione[]>(
    () => (riga?.candidati ?? []).map(({ puntoVendita, motivo }) => ({ ...puntoVendita, motivo })),
    [riga]
  );
  const testo = ricerca.trim();
  const risultati = useMemo<Opzione[]>(() => {
    if (testo.length < MINIMO_RICERCA) return [];
    return cercaPuntiVendita(puntiVendita, testo).map(pv => ({
      id: pv.id,
      nome: pv.nome,
      ragioneSociale: pv.ragionesociale || null,
      indirizzo: pv.indirizzo || null,
      citta: pv.citta || null,
    }));
  }, [puntiVendita, testo]);
  const nomeDi = (id: string) =>
    candidati.find(opzione => opzione.id === id)?.nome ?? puntiVendita.find(pv => pv.id === id)?.nome ?? "";

  const chiudi = () => {
    if (collega.isPending) return;
    onClose();
  };

  const conferma = () => {
    if (!riga || !scelto) return;
    const puntoVendita = { id: scelto, nome: nomeDi(scelto) };
    collega.mutate(
      { chiave: riga.chiave, idPuntoVendita: scelto },
      { onSuccess: esito => onCollegata(esito, puntoVendita) }
    );
  };

  const altreVarianti = (riga?.varianti ?? []).filter(variante => variante !== riga?.riga);

  return (
    <Dialog size="lg" open={riga !== null} onClose={chiudi}>
      <Dialog.Panel>
        <Dialog.Title>Collega a un punto vendita</Dialog.Title>
        {riga && (
          <Dialog.Description>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs text-slate-500">Come era stampato</div>
                <div className="mt-1 break-words font-mono text-xs text-slate-700 dark:text-slate-300">{riga.riga}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {riga.volantini === 1 ? "1 volantino" : `${formatNumero(riga.volantini)} volantini`}, dal {formatData(riga.primoVolantino)} al{" "}
                  {formatData(riga.ultimoVolantino)}
                </div>
              </div>

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

              {altreVarianti.length > 0 && (
                <Alert variant="soft-warning" icona="TriangleAlert" className="px-3 py-2 text-sm">
                  <p>Con lo stesso telefono o indirizzo è stampato anche come:</p>
                  <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                    {altreVarianti.map(variante => (
                      <li key={variante} className="break-words">{variante}</li>
                    ))}
                  </ul>
                  <p className="mt-1">Verranno collegate tutte allo stesso punto vendita.</p>
                </Alert>
              )}

              <fieldset>
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Punti vendita suggeriti</legend>
                {candidati.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">Nessun punto vendita con lo stesso telefono, indirizzo o località: cercalo qui sotto.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2" aria-label="Punti vendita suggeriti">
                    {candidati.map(opzione => (
                      <VocePuntoVendita key={opzione.id} opzione={opzione} scelta={scelto === opzione.id} onScegli={setScelto} />
                    ))}
                  </ul>
                )}
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Oppure cerca fra tutti i punti vendita</legend>
                <CampoRicerca
                  className="mt-2 w-full sm:w-full"
                  value={ricerca}
                  onChange={setRicerca}
                  etichetta="Cerca il punto vendita da collegare"
                  placeholder="Nome, ragione sociale, città, indirizzo, CAP o codice"
                />
                {testo.length >= MINIMO_RICERCA && (
                  risultati.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Nessun punto vendita trovato.</p>
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
                L'anagrafica non cambia. Il collegamento vale anche per i volantini sincronizzati di nuovo e per quelli futuri, e si
                può annullare da «Collegate a mano».
              </p>

              {collega.isError && (
                <Alert variant="soft-danger" icona="CircleAlert" className="px-3 py-2 text-sm" role="alert">
                  Collegamento non riuscito: {(collega.error as Error)?.message || "errore del server"}
                </Alert>
              )}
            </div>
          </Dialog.Description>
        )}
        <Dialog.Footer>
          <Button variant="outline-secondary" className="mr-2" onClick={chiudi} disabled={collega.isPending}>
            Annulla
          </Button>
          <Button variant="primary" onClick={conferma} disabled={!scelto || collega.isPending} loading={collega.isPending}>
            <Lucide icon="Link" aria-hidden="true" className="mr-1 h-4 w-4" />
            Collega
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
}

export default CollegaRigaDialog;
