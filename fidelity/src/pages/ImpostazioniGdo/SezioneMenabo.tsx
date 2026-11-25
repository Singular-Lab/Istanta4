import Button from "@/components/Base/Button";
import { FormCheck, FormInput } from "@/components/Base/Form";
import FormSelect from "@/components/Base/Form/FormSelect";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import Segmenti from "@/components/Base/Segmenti";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import {
  useCaricaValoriMenabo,
  useProvaRegoleMenabo,
  useSalvaRegoleMenabo,
  useSuggerimentiCampiMenabo,
  useSuggerimentiValoriMenabo,
  useVolantiniPerProvaMenabo,
} from "@/query/impostazioniGdo";
import { createContext, useContext, useId, useRef, useState, type ChangeEvent } from "react";
import {
  CAMPI_DERIVATI_MENABO,
  OPERATORI_REGOLA_MENABO,
  TRASFORMAZIONI_NOME_MENABO,
  type CondizioneRegolaMenabo,
  type EsitoProvaMenabo,
  type GruppoRegolaMenabo,
  type NodoRegolaMenabo,
  type OperatoreRegolaMenabo,
  type RegolaMenabo,
} from "../../../lib/impostazioniGdo/tipi";
import { leggiFileComeTesto, scaricaTesto } from "./file";
import { regoleDaValori } from "./regoleDaValori";
import { useBozza } from "./useBozza";

/** Come si leggono gli operatori nell'editor. */
export const ETICHETTE_OPERATORI: Record<OperatoreRegolaMenabo, string> = {
  uguale: "è uguale a",
  diverso: "è diverso da",
  contiene: "contiene",
  non_contiene: "non contiene",
  inizia: "inizia con",
  finisce: "finisce con",
  uno_di: "è uno di",
  vuoto: "è vuoto",
  non_vuoto: "non è vuoto",
  regex: "corrisponde all'espressione",
  maggiore: "maggiore di",
  minore: "minore di",
  tra: "tra",
};

const ETICHETTE_LOGICA: Record<GruppoRegolaMenabo["logica"], string> = {
  tutte: "tutte queste condizioni",
  una: "almeno una di queste condizioni",
  nessuna: "nessuna di queste condizioni",
};

/** Campi della referenza che si propongono per primi; si può scrivere qualunque altro campo. */
const CAMPI_COMUNI = ["mastro", "tema", "reparto", "ruolo", "codice_referenza", ...CAMPI_DERIVATI_MENABO];

/** I campi che la regola può usare: i veri delle referenze (con quante ne hanno) e i comuni. */
interface CampoProposto { campo: string; referenze: number | null }
const CampiProposti = createContext<CampoProposto[]>(CAMPI_COMUNI.map((campo) => ({ campo, referenze: null })));

const ALTRO_CAMPO = "__altro__";

/** Il campo si sceglie da un elenco; «Altro campo…» lascia scrivere un nome libero (anche `tema/mastro`). */
function SelettoreCampo({ valore, onChange, etichetta, segnaposto, className }: { valore: string; onChange: (campo: string) => void; etichetta: string; segnaposto?: string; className?: string }) {
  const proposti = useContext(CampiProposti);
  const [libero, setLibero] = useState(() => !proposti.some((p) => p.campo === valore));
  return (
    <>
      <FormSelect
        formSelectSize="sm"
        aria-label={etichetta}
        value={libero ? ALTRO_CAMPO : valore}
        onChange={(e) => {
          if (e.target.value === ALTRO_CAMPO) setLibero(true);
          else {
            setLibero(false);
            onChange(e.target.value);
          }
        }}
        className={className}
      >
        {proposti.map(({ campo, referenze }) => (
          <option key={campo} value={campo}>{referenze === null ? campo : `${campo} (${referenze} referenze)`}</option>
        ))}
        <option value={ALTRO_CAMPO}>Altro campo…</option>
      </FormSelect>
      {libero && (
        <FormInput
          type="text"
          formInputSize="sm"
          aria-label={`${etichetta}, nome libero`}
          placeholder={segnaposto ?? "Nome del campo"}
          value={valore}
          onChange={(e) => onChange(e.target.value)}
          className="w-48"
        />
      )}
    </>
  );
}

const SENZA_VALORE: readonly OperatoreRegolaMenabo[] = ["vuoto", "non_vuoto"];

/** Il nome della sezione che rinvia a un altro campo: un solo segnaposto, `{tema/mastro|senza-sigla|titolo}`. */
const RINVIO_A_CAMPO = /^\{([^{}|]*)((?:\|[^{}|]*)*)\}$/;

export const leggiRinvio = (sezione: string | null): { campi: string; trasformazioni: string[] } | null => {
  const trovato = sezione === null ? null : RINVIO_A_CAMPO.exec(sezione.trim());
  if (!trovato) return null;
  return { campi: trovato[1].trim(), trasformazioni: trovato[2].split("|").map((t) => t.trim()).filter(Boolean) };
};

export const scriviRinvio = (campi: string, trasformazioni: readonly string[]): string =>
  `{${[campi.trim(), ...trasformazioni].join("|")}}`;

const nuovoId = () => `regola-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const condizioneVuota = (): CondizioneRegolaMenabo => ({ tipo: "condizione", campo: "mastro", operatore: "contiene", valore: "", valori: [] });

export const regolaVuota = (): RegolaMenabo => ({
  id: nuovoId(),
  titolo: null,
  livello: "box",
  sezione: "",
  colore: null,
  condizione: { tipo: "gruppo", logica: "tutte", figli: [condizioneVuota()] },
});

/** Una regola si legge in una frase, per la lista chiusa e per chi non vede i campi. */
export const riassuntoCondizione = (nodo: NodoRegolaMenabo): string => {
  if (nodo.tipo === "condizione") {
    const operatore = ETICHETTE_OPERATORI[nodo.operatore];
    if (SENZA_VALORE.includes(nodo.operatore)) return `${nodo.campo} ${operatore}`;
    if (nodo.operatore === "uno_di") return `${nodo.campo} ${operatore} ${nodo.valori.join(", ")}`;
    if (nodo.operatore === "tra") return `${nodo.campo} ${operatore} ${nodo.valori.join(" e ")}`;
    return `${nodo.campo} ${operatore} «${nodo.valore}»`;
  }
  const parti = nodo.figli.map(riassuntoCondizione);
  const unione = nodo.logica === "una" ? " o " : " e ";
  const dentro = parti.join(unione);
  return nodo.logica === "nessuna" ? `non (${dentro})` : parti.length > 1 ? `(${dentro})` : dentro;
};

const aggiornaFiglio = (gruppo: GruppoRegolaMenabo, indice: number, nodo: NodoRegolaMenabo | null): GruppoRegolaMenabo => ({
  ...gruppo,
  figli: nodo === null ? gruppo.figli.filter((_, i) => i !== indice) : gruppo.figli.map((figlio, i) => (i === indice ? nodo : figlio)),
});

function CondizioneEditor({ condizione, onChange, onElimina }: { condizione: CondizioneRegolaMenabo; onChange: (c: CondizioneRegolaMenabo) => void; onElimina: () => void }) {
  const senzaValore = SENZA_VALORE.includes(condizione.operatore);
  const elenco = condizione.operatore === "uno_di";
  const tra = condizione.operatore === "tra";
  // I valori veri del campo si leggono quando l'utente entra nel valore: lo stesso campo si legge una volta sola
  const [vistoIlValore, setVistoIlValore] = useState(false);
  const valoriSuggeriti = useSuggerimentiValoriMenabo(condizione.campo, vistoIlValore && !senzaValore && !tra);
  const suggeriti = valoriSuggeriti.data?.valori ?? [];
  const idElenco = useId();
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="condizione">
      <SelettoreCampo etichetta="Campo" valore={condizione.campo} onChange={(campo) => onChange({ ...condizione, campo })} className="w-48" />
      <FormSelect
        formSelectSize="sm"
        aria-label="Operatore"
        value={condizione.operatore}
        onChange={(e) => onChange({ ...condizione, operatore: e.target.value as OperatoreRegolaMenabo })}
        className="w-52"
      >
        {OPERATORI_REGOLA_MENABO.map((operatore) => (
          <option key={operatore} value={operatore}>{ETICHETTE_OPERATORI[operatore]}</option>
        ))}
      </FormSelect>
      {!senzaValore && !elenco && !tra && (
        <FormInput
          type="text"
          formInputSize="sm"
          aria-label="Valore"
          placeholder={condizione.operatore === "regex" ? "Espressione, es. ^PUL-" : "Valore"}
          value={condizione.valore}
          list={condizione.operatore === "regex" ? undefined : idElenco}
          onFocus={() => setVistoIlValore(true)}
          onChange={(e) => onChange({ ...condizione, valore: e.target.value })}
          className="min-w-40 flex-1"
        />
      )}
      {!senzaValore && !elenco && !tra && condizione.operatore !== "regex" && (
        <datalist id={idElenco} data-testid="valori-suggeriti">
          {suggeriti.map((voce) => (
            <option key={voce.valore} value={voce.valore}>{`${voce.valore} (${voce.referenze} referenze)`}</option>
          ))}
        </datalist>
      )}
      {elenco && (
        <FormInput
          type="text"
          formInputSize="sm"
          aria-label="Valori alternativi, separati da virgola"
          placeholder="Valori separati da virgola"
          value={condizione.valori.join(", ")}
          onChange={(e) => onChange({ ...condizione, valori: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
          className="min-w-40 flex-1"
        />
      )}
      {elenco && (
        <FormSelect
          formSelectSize="sm"
          aria-label="Aggiungi un valore trovato nei volantini"
          value=""
          onFocus={() => setVistoIlValore(true)}
          onChange={(e) => e.target.value && onChange({ ...condizione, valori: [...condizione.valori, e.target.value] })}
          className="w-56"
        >
          <option value="">{valoriSuggeriti.isFetching ? "Caricamento…" : "Aggiungi un valore…"}</option>
          {suggeriti
            .filter((voce) => !condizione.valori.some((v) => v.toLowerCase() === voce.valore.toLowerCase()))
            .map((voce) => (
              <option key={voce.valore} value={voce.valore}>{`${voce.valore} (${voce.referenze})`}</option>
            ))}
        </FormSelect>
      )}
      {tra && (
        <>
          <FormInput
            type="text"
            formInputSize="sm"
            inputMode="decimal"
            aria-label="Minimo"
            placeholder="Da"
            value={condizione.valori[0] ?? ""}
            onChange={(e) => onChange({ ...condizione, valori: [e.target.value, condizione.valori[1] ?? ""] })}
            className="w-24"
          />
          <span className="text-xs text-slate-500">e</span>
          <FormInput
            type="text"
            formInputSize="sm"
            inputMode="decimal"
            aria-label="Massimo"
            placeholder="A"
            value={condizione.valori[1] ?? ""}
            onChange={(e) => onChange({ ...condizione, valori: [condizione.valori[0] ?? "", e.target.value] })}
            className="w-24"
          />
        </>
      )}
      <Button variant="outline-secondary" size="sm" aria-label="Togli la condizione" onClick={onElimina}>
        <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function GruppoEditor({ gruppo, onChange, onElimina, profondita = 0 }: { gruppo: GruppoRegolaMenabo; onChange: (g: GruppoRegolaMenabo) => void; onElimina?: () => void; profondita?: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-control border border-slate-200 bg-slate-50/60 p-3 dark:border-darkmode-400 dark:bg-darkmode-700/40" data-testid="gruppo">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Vale se valgono</span>
        <FormSelect
          formSelectSize="sm"
          aria-label="Logica del gruppo"
          value={gruppo.logica}
          onChange={(e) => onChange({ ...gruppo, logica: e.target.value as GruppoRegolaMenabo["logica"] })}
          className="w-64"
        >
          {(Object.keys(ETICHETTE_LOGICA) as Array<GruppoRegolaMenabo["logica"]>).map((logica) => (
            <option key={logica} value={logica}>{ETICHETTE_LOGICA[logica]}</option>
          ))}
        </FormSelect>
        {onElimina && (
          <Button variant="outline-secondary" size="sm" aria-label="Togli il gruppo" onClick={onElimina} className="ml-auto">
            <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {gruppo.figli.map((figlio, indice) =>
        figlio.tipo === "gruppo" ? (
          <GruppoEditor
            key={indice}
            gruppo={figlio}
            profondita={profondita + 1}
            onChange={(g) => onChange(aggiornaFiglio(gruppo, indice, g))}
            onElimina={() => onChange(aggiornaFiglio(gruppo, indice, null))}
          />
        ) : (
          <CondizioneEditor
            key={indice}
            condizione={figlio}
            onChange={(c) => onChange(aggiornaFiglio(gruppo, indice, c))}
            onElimina={() => onChange(aggiornaFiglio(gruppo, indice, null))}
          />
        )
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline-secondary" size="sm" onClick={() => onChange({ ...gruppo, figli: [...gruppo.figli, condizioneVuota()] })}>
          <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
          Condizione
        </Button>
        {profondita < 4 && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => onChange({ ...gruppo, figli: [...gruppo.figli, { tipo: "gruppo", logica: "una", figli: [condizioneVuota()] }] })}
          >
            <Lucide icon="FolderPlus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Gruppo
          </Button>
        )}
      </div>
    </div>
  );
}

const PARTI_VALORE = TRASFORMAZIONI_NOME_MENABO.filter((t) => t.startsWith("parte-"));
const ALTRE_TRASFORMAZIONI = TRASFORMAZIONI_NOME_MENABO.filter((t) => !t.startsWith("parte-"));

/** Il nome della sezione in una riga, per la regola chiusa. */
const nomeInRiga = (regola: RegolaMenabo): string => {
  if (regola.sezione === null) return "non è una sezione";
  if (regola.sezione.trim() === "") return "senza nome";
  return regola.sezione;
};

function RegolaEditor({
  regola,
  indice,
  totale,
  onChange,
  onElimina,
  onSposta,
}: {
  regola: RegolaMenabo;
  indice: number;
  totale: number;
  onChange: (r: RegolaMenabo) => void;
  onElimina: () => void;
  onSposta: (verso: -1 | 1) => void;
}) {
  const nonSezione = regola.sezione === null;
  // La sezione che è un solo segnaposto rinvia a un altro campo: si scrive scegliendo campo e trasformazioni
  const rinvio = leggiRinvio(regola.sezione);
  const idTrasformazioni = useId();
  // Una regola appena aggiunta (senza nome) si apre da sola; le salvate restano in una riga
  const [aperta, setAperta] = useState(() => regola.sezione === "" && !regola.titolo);
  const parte = rinvio?.trasformazioni.find((t) => t.startsWith("parte-")) ?? "";
  const scriviTrasformazioni = (nuova: { parte: string; altre: readonly string[] }) =>
    scriviRinvio(rinvio?.campi ?? "", [...(nuova.parte ? [nuova.parte] : []), ...ALTRE_TRASFORMAZIONI.filter((t) => nuova.altre.includes(t))]);
  const altreAttive = rinvio?.trasformazioni.filter((t) => !t.startsWith("parte-")) ?? [];
  return (
    <li className="rounded-card border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600" data-testid="regola">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-theme-1/10 text-xs font-bold tabular-nums text-primary">{indice + 1}</span>
        <button
          type="button"
          aria-expanded={aperta}
          aria-label={`${aperta ? "Chiudi" : "Apri"} la regola ${indice + 1}`}
          onClick={() => setAperta(!aperta)}
          className="flex min-w-48 flex-1 items-center gap-2 text-left"
        >
          <Lucide icon={aperta ? "ChevronDown" : "ChevronRight"} aria-hidden="true" className="h-4 w-4 flex-none text-slate-500" />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-medium">{regola.titolo || riassuntoCondizione(regola.condizione)}</span>
            <span className="text-slate-500"> → {nomeInRiga(regola)}</span>
          </span>
          <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-darkmode-700">{regola.livello === "box" ? "box" : "pagina"}</span>
          {regola.colore && <span aria-hidden="true" className="h-4 w-4 flex-none rounded-full border border-slate-200" style={{ backgroundColor: regola.colore }} />}
        </button>
        <Button variant="outline-secondary" size="sm" aria-label={`Sposta su la regola ${indice + 1}`} disabled={indice === 0} onClick={() => onSposta(-1)}>
          <Lucide icon="ArrowUp" aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline-secondary" size="sm" aria-label={`Sposta giù la regola ${indice + 1}`} disabled={indice === totale - 1} onClick={() => onSposta(1)}>
          <Lucide icon="ArrowDown" aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline-secondary" size="sm" aria-label={`Elimina la regola ${indice + 1}`} onClick={onElimina}>
          <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      </div>
      {aperta && (
        <div className="flex flex-col gap-3 border-t border-dashed border-slate-200 p-3 dark:border-darkmode-400">
          <div className="flex flex-wrap items-center gap-2">
            <FormInput
              type="text"
              formInputSize="sm"
              aria-label={`Titolo della regola ${indice + 1}`}
              placeholder="Titolo (facoltativo, compare nel motivo delle pagine)"
              value={regola.titolo ?? ""}
              onChange={(e) => onChange({ ...regola, titolo: e.target.value || null })}
              className="min-w-48 flex-1"
            />
            <FormSelect
              formSelectSize="sm"
              aria-label={`Livello della regola ${indice + 1}`}
              value={regola.livello}
              onChange={(e) => onChange({ ...regola, livello: e.target.value as RegolaMenabo["livello"] })}
              className="w-44"
              title={
                regola.livello === "box"
                  ? "Per box: vale per il box con una referenza che soddisfa la condizione."
                  : "Per pagina: vale se la condizione è soddisfatta da almeno un box della pagina, e decide la sezione di tutta la pagina."
              }
            >
              <option value="box">Per box</option>
              <option value="pagina">Per pagina</option>
            </FormSelect>
          </div>
          <GruppoEditor gruppo={regola.condizione} onChange={(condizione) => onChange({ ...regola, condizione })} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Allora</span>
            <FormSelect
              formSelectSize="sm"
              aria-label={`Esito della regola ${indice + 1}`}
              value={nonSezione ? "no" : rinvio ? "campo" : "si"}
              onChange={(e) =>
                onChange({
                  ...regola,
                  sezione: e.target.value === "no" ? null : e.target.value === "campo" ? scriviRinvio("mastro", ["senza-sigla", "spazi", "titolo"]) : "",
                })
              }
              className="w-72"
            >
              <option value="si">la sezione è il testo scritto</option>
              <option value="campo">la sezione è il valore di un altro campo</option>
              <option value="no">non è una sezione</option>
            </FormSelect>
            {!nonSezione && !rinvio && (
              <FormInput
                type="text"
                formInputSize="sm"
                aria-label={`Nome della sezione della regola ${indice + 1}`}
                placeholder="Nome, o modello come {mastro|senza-sigla|titolo}"
                value={regola.sezione ?? ""}
                onChange={(e) => onChange({ ...regola, sezione: e.target.value })}
                className="min-w-56 flex-1"
              />
            )}
            {!nonSezione && (
              <>
                <input
                  type="color"
                  aria-label={`Colore della sezione della regola ${indice + 1}`}
                  value={regola.colore ?? "#94a3b8"}
                  onChange={(e) => onChange({ ...regola, colore: e.target.value.toLowerCase() })}
                  className="h-8 w-10 cursor-pointer rounded-control border border-slate-200 bg-white p-0.5"
                />
                {regola.colore ? (
                  <Button variant="outline-secondary" size="sm" aria-label={`Togli il colore della regola ${indice + 1}`} onClick={() => onChange({ ...regola, colore: null })}>
                    <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <span className="text-xs text-slate-500">colore automatico</span>
                )}
              </>
            )}
          </div>
          {rinvio && (
            <div className="flex flex-col gap-2 rounded-control border border-slate-200 bg-slate-50/60 p-3 dark:border-darkmode-400 dark:bg-darkmode-700/40" data-testid="rinvio-campo">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Campo</span>
                <SelettoreCampo
                  etichetta={`Campo da cui prendere la sezione della regola ${indice + 1}`}
                  segnaposto="es. tema/mastro (il primo che ha un valore)"
                  valore={rinvio.campi}
                  onChange={(campi) => onChange({ ...regola, sezione: scriviRinvio(campi, rinvio.trasformazioni) })}
                  className="w-56"
                />
                <span className="text-xs font-medium text-slate-500">Parte</span>
                <FormSelect
                  formSelectSize="sm"
                  aria-label={`Parte del valore della regola ${indice + 1}`}
                  value={parte}
                  onChange={(e) => onChange({ ...regola, sezione: scriviTrasformazioni({ parte: e.target.value, altre: altreAttive }) })}
                  className="w-56"
                >
                  <option value="">tutto il valore</option>
                  {PARTI_VALORE.map((voce) => (
                    <option key={voce} value={voce}>{`${voce.slice(-1)}ª parte (separata da « - »)`}</option>
                  ))}
                </FormSelect>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="group" aria-label={`Trasformazioni del valore della regola ${indice + 1}`}>
                <span className="text-xs font-medium text-slate-500">Poi</span>
                {ALTRE_TRASFORMAZIONI.map((trasformazione) => (
                  <FormCheck key={trasformazione} className="text-xs text-slate-600">
                    <FormCheck.Input
                      id={`${idTrasformazioni}-${trasformazione}`}
                      type="checkbox"
                      checked={altreAttive.includes(trasformazione)}
                      onChange={(e) =>
                        onChange({
                          ...regola,
                          sezione: scriviTrasformazioni({
                            parte,
                            altre: e.target.checked ? [...altreAttive, trasformazione] : altreAttive.filter((t) => t !== trasformazione),
                          }),
                        })
                      }
                    />
                    <FormCheck.Label htmlFor={`${idTrasformazioni}-${trasformazione}`}>{trasformazione}</FormCheck.Label>
                  </FormCheck>
                ))}
              </div>
              <p className="text-xs text-slate-500">Modello: <code>{regola.sezione}</code> — se il campo o la parte è vuoto la regola non decide e si passa alla successiva.</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Prova delle regole su un volantino reale: menabò di prima e di dopo, pagine che cambiano e regola che decide. */
function ProvaRegole({ regole }: { regole: RegolaMenabo[] }) {
  const { showNotification } = useNotification();
  const volantini = useVolantiniPerProvaMenabo();
  const prova = useProvaRegoleMenabo();
  const [idKit, setIdKit] = useState("");
  const [esito, setEsito] = useState<EsitoProvaMenabo | null>(null);
  const scelto = idKit || volantini.data?.[0]?.idKit || "";

  const provaOra = () => {
    if (!scelto) return;
    prova.mutate(
      { idKit: scelto, regole },
      {
        onSuccess: setEsito,
        onError: (errore) => {
          setEsito(null);
          showNotification(`Prova non riuscita: ${errore.message}`, { variant: "error" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 dark:border-darkmode-400 dark:bg-darkmode-600" aria-label="Prova delle regole">
      <h3 className="title-card flex items-center gap-2">
        <Lucide icon="FlaskConical" aria-hidden="true" className="h-4 w-4" />
        Prova su un volantino
      </h3>
      <p className="text-sm text-slate-500">Vedi il menabò di prima e quello con le regole di questa bozza, senza salvare niente.</p>
      {volantini.isPending ? (
        <Spinner size="sm" etichetta="Caricamento dei volantini…" />
      ) : (volantini.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nessun volantino della GDO su cui provare.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <FormSelect formSelectSize="sm" aria-label="Volantino da provare" value={scelto} onChange={(e) => { setIdKit(e.target.value); setEsito(null); }} className="min-w-64 flex-1">
            {(volantini.data ?? []).map((volantino) => (
              <option key={volantino.idKit} value={volantino.idKit}>
                {[volantino.nomePromo, volantino.titolo].filter(Boolean).join(" · ") || volantino.idKit}
              </option>
            ))}
          </FormSelect>
          <Button variant="primary" size="sm" onClick={provaOra} loading={prova.isPending} disabled={prova.isPending || regole.length === 0}>
            <Lucide icon="Play" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Prova le regole
          </Button>
        </div>
      )}
      {esito && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-sm">
            <StatusBadge
              tono={esito.cambiate > 0 ? "info" : "success"}
              etichetta={esito.cambiate === 0 ? "Nessuna pagina cambia" : esito.cambiate === 1 ? "1 pagina cambia" : `${esito.cambiate} pagine cambiano`}
            />
          </p>
          <div className="max-h-96 overflow-auto rounded-control border border-slate-200 dark:border-darkmode-400">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-darkmode-700">
                <tr>
                  <th className="px-3 py-2">Pagina</th>
                  <th className="px-3 py-2">Reparto</th>
                  <th className="px-3 py-2">Prima</th>
                  <th className="px-3 py-2">Con le regole</th>
                  <th className="px-3 py-2">Regola</th>
                </tr>
              </thead>
              <tbody>
                {esito.pagine.map((pagina) => (
                  <tr key={pagina.pagina} data-cambia={pagina.cambia ? "si" : "no"} className={pagina.cambia ? "bg-amber-50/70 dark:bg-amber-400/10" : undefined}>
                    <td className="px-3 py-1.5 tabular-nums">{pagina.pagina}</td>
                    <td className="px-3 py-1.5 text-slate-600">{pagina.reparto ?? "—"}</td>
                    <td className="px-3 py-1.5 text-slate-600">{pagina.prima ?? "—"}</td>
                    <td className="px-3 py-1.5 font-medium">{pagina.dopo ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{pagina.regola ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Regole delle sezioni del menabò degli insight (spec impostazioni-gdo, "Regole delle sezioni del menabò
 * del volantino"): regole ordinate per box o per pagina, con condizioni annidate, nome da modello e colore;
 * prova su un volantino reale, scaricamento e caricamento come file JSON. Senza regole vale la mastro.
 */
function SezioneMenabo({ regole }: { regole: RegolaMenabo[] }) {
  const { showNotification } = useNotification();
  const salva = useSalvaRegoleMenabo();
  const { bozza, setBozza, modificata, annulla } = useBozza(regole);
  const inputFile = useRef<HTMLInputElement>(null);
  const [errori, setErrori] = useState<string | null>(null);
  const [scheda, setScheda] = useState<"regole" | "prova">("regole");
  const campiSuggeriti = useSuggerimentiCampiMenabo();
  const caricaValori = useCaricaValoriMenabo();
  const campoMenabo = campiSuggeriti.data?.campoMenabo ?? null;
  // I campi veri delle referenze, dal più usato; quelli comuni e della pagina restano sempre proposti
  const campiVeri = campiSuggeriti.data?.campi ?? [];
  const campiProposti: CampoProposto[] = [
    ...campiVeri.map((c) => ({ campo: c.campo, referenze: c.referenze })),
    ...CAMPI_COMUNI.filter((campo) => !campiVeri.some((c) => c.campo === campo)).map((campo) => ({ campo, referenze: null })),
  ];

  const generaDalCampo = () => {
    if (!campoMenabo) return;
    caricaValori.mutate(campoMenabo, {
      onSuccess: ({ valori }) => {
        const { regole: nuove, saltate } = regoleDaValori(campoMenabo, valori, bozza, nuovoId);
        if (nuove.length === 0) {
          showNotification(
            valori.length === 0 ? `Nessun valore di ${campoMenabo} nei volantini della GDO.` : "Le regole per questi valori ci sono già.",
            { variant: "info" }
          );
          return;
        }
        setBozza([...bozza, ...nuove]);
        showNotification(
          `${nuove.length} ${nuove.length === 1 ? "regola creata" : "regole create"} dai valori di ${campoMenabo}${saltate > 0 ? ` (${saltate} già presenti)` : ""}: correggile e salva.`,
          { variant: "success" }
        );
      },
      onError: (errore) => showNotification(`Valori non letti: ${errore.message}`, { variant: "error" }),
    });
  };

  const aggiorna = (indice: number, regola: RegolaMenabo) => setBozza(bozza.map((r, i) => (i === indice ? regola : r)));
  const sposta = (indice: number, verso: -1 | 1) => {
    const nuove = [...bozza];
    [nuove[indice], nuove[indice + verso]] = [nuove[indice + verso], nuove[indice]];
    setBozza(nuove);
  };

  const salvaRegole = () => {
    setErrori(null);
    salva.mutate(
      { regole: bozza },
      {
        onSuccess: () => showNotification("Regole del menabò salvate", { variant: "success" }),
        onError: (errore) => setErrori(errore.message),
      }
    );
  };

  const scarica = () => scaricaTesto(JSON.stringify({ regole: bozza }, null, 2), "regole-menabo.json");

  const carica = async (evento: ChangeEvent<HTMLInputElement>) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    try {
      const letto: unknown = JSON.parse(await leggiFileComeTesto(file));
      const elenco = Array.isArray(letto) ? letto : (letto as { regole?: unknown } | null)?.regole;
      if (!Array.isArray(elenco)) throw new Error("manca l'elenco «regole»");
      setBozza(elenco as RegolaMenabo[]);
      setErrori(null);
      showNotification(`${file.name} caricato: controlla le regole e salva.`, { variant: "info" });
    } catch (errore) {
      showNotification(`${file.name}: ${errore instanceof Error ? errore.message : "file non valido"}`, { variant: "warning" });
    }
  };

  return (
    <Sezione
      id="menabo-volantino"
      className="scroll-mt-24"
      icona="LayoutGrid"
      titolo="Menabò del volantino"
      descrizione={
        <>
          Regole che dicono a quale sezione appartiene un box, o una pagina, nel menabò degli insight. Vale la prima regola
          che soddisfa la condizione; senza regola vale la sezione di prima (per Conad CNO la mastro). Il nome può essere un
          testo o un modello come <code>{"{tema|parte-2|titolo}"}</code>.
        </>
      }
      azioni={
        <>
          <Button variant="outline-secondary" size="sm" onClick={annulla} disabled={!modificata || salva.isPending}>
            Annulla modifiche
          </Button>
          <Button variant="primary" size="sm" onClick={salvaRegole} loading={salva.isPending} disabled={!modificata || salva.isPending}>
            Salva regole
          </Button>
        </>
      }
    >
      <CampiProposti.Provider value={campiProposti}>
      <div className="flex flex-col gap-4">
        <Segmenti
          etichetta="Parte del menabò"
          valore={scheda}
          onChange={setScheda}
          opzioni={[
            { valore: "regole", etichetta: "Regole", conteggio: bozza.length },
            { valore: "prova", etichetta: "Prova su un volantino" },
          ]}
        />

        {errori && (
          <div role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {errori}
          </div>
        )}

        <div hidden={scheda !== "regole"} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline-secondary" size="sm" onClick={() => setBozza([...bozza, regolaVuota()])}>
              <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Nuova regola
            </Button>
            {campoMenabo && (
              <Button variant="outline-secondary" size="sm" onClick={generaDalCampo} loading={caricaValori.isPending} disabled={caricaValori.isPending}>
                <Lucide icon="Wand2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                {`Genera dalle ${campoMenabo}`}
              </Button>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline-secondary" size="sm" onClick={scarica} disabled={bozza.length === 0}>
                <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Scarica JSON
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={() => inputFile.current?.click()}>
                <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Carica JSON
              </Button>
            </span>
            <input ref={inputFile} type="file" accept=".json,application/json" aria-label="File JSON delle regole del menabò" className="hidden" onChange={carica} />
          </div>

          {bozza.length === 0 ? (
            <EmptyState
              compatta
              icon="LayoutGrid"
              title="Nessuna regola"
              description="Il menabò usa la sezione ricavata dai dati del cliente. Aggiungi una regola per correggere le pagine che non coincidono."
            />
          ) : (
            <ol className="flex flex-col gap-2" aria-label="Regole del menabò, in ordine di priorità">
              {bozza.map((regola, indice) => (
                <RegolaEditor
                  key={regola.id}
                  regola={regola}
                  indice={indice}
                  totale={bozza.length}
                  onChange={(r) => aggiorna(indice, r)}
                  onElimina={() => setBozza(bozza.filter((_, i) => i !== indice))}
                  onSposta={(verso) => sposta(indice, verso)}
                />
              ))}
            </ol>
          )}
          <p className="text-xs text-slate-500">
            Parti del valore: {PARTI_VALORE.join(", ")}. Trasformazioni: {ALTRE_TRASFORMAZIONI.join(", ")}. Campi derivati: {CAMPI_DERIVATI_MENABO.join(", ")} (@reparto_nome è il nome del reparto come nelle Impostazioni GDO, uguale in ogni volantino).
          </p>
        </div>

        <div hidden={scheda !== "prova"}>
          <ProvaRegole regole={bozza} />
        </div>
      </div>
      </CampiProposti.Provider>
    </Sezione>
  );
}

export default SezioneMenabo;
