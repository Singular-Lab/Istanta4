import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useNotification } from "@/context/NotificationContext";
import {
  erroriConfigurazioneDa,
  useRipristinaConfigurazioneInsight,
  useSalvaConfigurazioneInsight,
  useVerificaConfigurazioneInsight,
} from "@/query/impostazioniGdo";
import { formatDataOraEstesa } from "@/utils/format";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ConfigurazioneInsightGdo, EsitoVerificaConfigurazione } from "../../../lib/impostazioniGdo/tipi";
import EditorCodice from "./EditorCodice";
import { leggiFileComeTesto, scaricaTesto } from "./file";
import { useBozza } from "./useBozza";

/** Pausa dopo l'ultima modifica prima di chiedere la verifica al server. */
export const RITARDO_VERIFICA_MS = 600;
const NOME_FILE = "flyerInsightsConfig.json";

type Analisi = { valore: Record<string, unknown>; errore?: undefined } | { valore?: undefined; errore: string | null };

/** Il testo dell'editor come oggetto JSON; errore null se il testo è vuoto. */
const analizza = (testo: string): Analisi => {
  if (!testo.trim()) return { errore: null };
  try {
    const valore: unknown = JSON.parse(testo);
    if (typeof valore !== "object" || valore === null || Array.isArray(valore)) {
      return { errore: "La configurazione deve essere un oggetto JSON, tra parentesi graffe." };
    }
    return { valore: valore as Record<string, unknown> };
  } catch (errore) {
    return { errore: `JSON non valido: ${errore instanceof Error ? errore.message : String(errore)}` };
  }
};

const formatta = (valore: unknown) => JSON.stringify(valore, null, 2);

function OrigineConfigurazione({ insight }: { insight: ConfigurazioneInsightGdo }) {
  if (insight.origine === "gdo") {
    const quando = insight.aggiornatoIl ? ` il ${formatDataOraEstesa(insight.aggiornatoIl)}` : "";
    const chi = insight.aggiornatoDa ? ` da ${insight.aggiornatoDa}` : "";
    return <StatusBadge tono="success" icon="Save" etichetta={`Salvata per la GDO${quando}${chi}`} />;
  }
  if (insight.origine === "file") return <StatusBadge tono="info" icon="FileJson" etichetta="Dal file dell'installazione" />;
  return <StatusBadge tono="neutral" etichetta="Nessuna configurazione" />;
}

/** Configurazione degli insight del volantino (flyerInsightsConfig) salvata per la GDO. */
function SezioneInsightVolantino({ insight }: { insight: ConfigurazioneInsightGdo }) {
  const { showNotification } = useNotification();
  const { mutate: verifica, isPending: inVerifica } = useVerificaConfigurazioneInsight();
  const salva = useSalvaConfigurazioneInsight();
  const ripristina = useRipristinaConfigurazioneInsight();
  const testoSalvato = insight.configurazione ? formatta(insight.configurazione) : "";
  const { bozza: testo, setBozza: setTesto, modificata } = useBozza(testoSalvato);
  const analisi = useMemo(() => analizza(testo), [testo]);
  const [esito, setEsito] = useState<EsitoVerificaConfigurazione | null>(null);
  const [conferma, setConferma] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);
  // Testo dell'ultima verifica chiesta: le risposte di quelle precedenti non contano più
  const testoVerificato = useRef<string | null>(null);

  const verificaTesto = useCallback(
    (testoDaVerificare: string, valore: Record<string, unknown>) => {
      testoVerificato.current = testoDaVerificare;
      verifica(valore, {
        onSuccess: (risposta) => {
          if (testoVerificato.current === testoDaVerificare) setEsito(risposta);
        },
        onError: (errore) => {
          if (testoVerificato.current === testoDaVerificare) {
            setEsito(null);
            showNotification(`Verifica non riuscita: ${errore.message}`, { variant: "error" });
          }
        },
      });
    },
    [verifica, showNotification]
  );

  // Verifica dal vivo: poco dopo l'ultima modifica, se il testo è un JSON e non è già stato verificato
  useEffect(() => {
    if (!analisi.valore) {
      testoVerificato.current = null;
      setEsito(null);
      return;
    }
    if (testoVerificato.current === testo) return;
    // L'esito del testo di prima non vale per questo
    setEsito(null);
    const valore = analisi.valore;
    const timer = window.setTimeout(() => {
      // Nel frattempo il testo può essere stato verificato dal caricamento o dal salvataggio
      if (testoVerificato.current !== testo) verificaTesto(testo, valore);
    }, RITARDO_VERIFICA_MS);
    return () => window.clearTimeout(timer);
  }, [analisi, testo, verificaTesto]);

  const caricaFile = async (evento: ChangeEvent<HTMLInputElement>) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    let contenuto: string;
    try {
      contenuto = await leggiFileComeTesto(file);
    } catch {
      showNotification(`Il file ${file.name} non si può leggere.`, { variant: "error" });
      return;
    }
    const letto = analizza(contenuto);
    if (!letto.valore) {
      // Nell'editor comunque, così si vede dov'è l'errore e lo si corregge
      setTesto(contenuto);
      showNotification(`${file.name}: ${letto.errore ?? "il file è vuoto"}`, { variant: "warning" });
      return;
    }
    const nuovo = formatta(letto.valore);
    setTesto(nuovo);
    verificaTesto(nuovo, letto.valore);
    showNotification(`${file.name} caricato nell'editor: controlla la verifica e salva.`, { variant: "info" });
  };

  const salvaConfigurazione = () => {
    const valore = analisi.valore;
    if (!valore) return;
    salva.mutate(valore, {
      onSuccess: () => {
        testoVerificato.current = null;
        showNotification("Configurazione degli insight salvata per la GDO", { variant: "success" });
      },
      onError: (errore) => {
        const errori = erroriConfigurazioneDa(errore);
        if (errori) {
          // La risposta del salvataggio vale come verifica di questo testo
          testoVerificato.current = testo;
          setEsito({ valida: false, errori, sezioni: [] });
          showNotification("Configurazione non salvata: correggi gli errori indicati.", { variant: "error" });
        } else if ((errore as { httpStatus?: number }).httpStatus === 400) {
          // Configurazione rifiutata ma senza gli errori nella risposta: li dà la verifica
          verificaTesto(testo, valore);
          showNotification("Configurazione non salvata: non è valida, gli errori sono nella verifica.", { variant: "error" });
        } else {
          showNotification(`Configurazione non salvata: ${errore.message}`, { variant: "error" });
        }
      },
    });
  };

  const tornaAlFile = () =>
    ripristina.mutate(undefined, {
      onSuccess: () => {
        setConferma(false);
        testoVerificato.current = null;
        showNotification("La GDO usa di nuovo la configurazione del file dell'installazione", { variant: "success" });
      },
      onError: (errore) => {
        setConferma(false);
        showNotification(`Configurazione non ripristinata: ${errore.message}`, { variant: "error" });
      },
    });

  return (
    <Sezione
      id="insight-volantino"
      className="scroll-mt-24"
      icona="FileJson"
      titolo="Insight del volantino"
      descrizione={
        <span className="flex flex-col items-start gap-1.5">
          <span>Come gli insight leggono le referenze: campi, reparti, meccaniche, pagine, mappa e marche.</span>
          <OrigineConfigurazione insight={insight} />
        </span>
      }
      azioni={
        <>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => scaricaTesto(testo, NOME_FILE)}
            disabled={!testo.trim()}
          >
            <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Scarica JSON
          </Button>
          {insight.origine === "gdo" && (
            <Button variant="outline-danger" size="sm" onClick={() => setConferma(true)} disabled={ripristina.isPending}>
              <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Torna al file dell'installazione
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={salvaConfigurazione}
            loading={salva.isPending}
            disabled={!analisi.valore || (!modificata && insight.origine === "gdo") || salva.isPending}
          >
            Salva configurazione
          </Button>
        </>
      }
    >
      <ConfirmDialog
        open={conferma}
        title="Tornare al file dell'installazione?"
        description="La configurazione salvata per la GDO viene tolta: gli insight useranno quella del file dell'installazione, se c'è. Scaricala prima se vuoi conservarla."
        confirmLabel="Torna al file"
        loading={ripristina.isPending}
        onClose={() => setConferma(false)}
        onConfirm={tornaAlFile}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <EditorCodice
          etichetta="Configurazione degli insight (JSON)"
          linguaggio="json"
          valore={testo}
          onChange={setTesto}
          altezza="60vh"
        />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <Lucide icon="FileUp" aria-hidden="true" className="h-7 w-7 text-slate-400" />
            <p className="text-sm text-slate-600">Carica un file JSON: va nell'editor e si verifica subito. Si salva solo con «Salva configurazione».</p>
            <Button variant="outline-secondary" size="sm" onClick={() => inputFile.current?.click()}>
              <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Carica JSON
            </Button>
            <input
              ref={inputFile}
              type="file"
              accept=".json,application/json"
              aria-label="File JSON della configurazione degli insight"
              className="hidden"
              onChange={caricaFile}
            />
          </div>

          <div aria-live="polite" className="rounded-card border border-slate-200 bg-white p-4">
            <h3 className="title-card mb-3 flex items-center gap-2">
              Verifica
              {inVerifica && <Spinner size="sm" etichetta="Verifica in corso…" />}
            </h3>
            {analisi.errore ? (
              <div className="flex flex-col items-start gap-2">
                <StatusBadge tono="danger" icon="CircleAlert" etichetta="JSON non valido" />
                <p className="text-sm text-slate-600">{analisi.errore}</p>
              </div>
            ) : !analisi.valore ? (
              <p className="text-sm text-slate-500">Nessuna configurazione: scrivila nell'editor o carica un file JSON.</p>
            ) : esito?.valida ? (
              <div className="flex flex-col items-start gap-2">
                <StatusBadge tono="success" icon="CircleCheck" etichetta="Configurazione valida" />
                {esito.sezioni.length > 0 && (
                  <>
                    <p className="text-sm text-slate-600">Sezioni riconosciute:</p>
                    <ul aria-label="Sezioni riconosciute" className="flex flex-wrap gap-1.5">
                      {esito.sezioni.map((sezione) => (
                        <li key={sezione}>
                          <code className="rounded-control bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{sezione}</code>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : esito ? (
              <div className="flex flex-col items-start gap-2">
                <StatusBadge
                  tono="danger"
                  icon="CircleAlert"
                  etichetta={esito.errori.length === 1 ? "1 errore" : `${esito.errori.length} errori`}
                />
                <ul aria-label="Errori della configurazione" className="flex w-full flex-col gap-1.5">
                  {esito.errori.map((errore, indice) => (
                    <li key={`${errore.percorso}-${indice}`} className="rounded-control bg-danger/5 px-3 py-2 text-sm">
                      <code className="text-xs text-danger">{errore.percorso || "(radice)"}</code>
                      <span className="block text-slate-700">{errore.messaggio}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">La verifica parte da sola mentre scrivi.</p>
            )}
          </div>

          <p className="text-xs text-slate-500">
            La configurazione si salva per la GDO. Il file dell'installazione resta solo come valore iniziale per chi non l'ha ancora salvata.
          </p>
        </div>
      </div>
    </Sezione>
  );
}

export default SezioneInsightVolantino;
