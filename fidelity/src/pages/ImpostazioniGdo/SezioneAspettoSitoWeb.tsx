import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { FormField, FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import { useNotification } from "@/context/NotificationContext";
import { useSalvaSitoWeb } from "@/query/impostazioniGdo";
import beautify from "js-beautify";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ImpostazioniGdo, SitoWebDaSalvare } from "../../../lib/impostazioniGdo/tipi";
import type { StileBoxReferenza } from "../../../lib/types";
import EditorCodice from "./EditorCodice";
import EditorStiliReferenza from "./EditorStiliReferenza";
import { leggiFileComeBase64, sorgenteImmagine } from "./file";
import { useBozza } from "./useBozza";

type Scheda = "visuale" | "json" | "css";

type Aspetto = {
  icona_pagina: string;
  stili: StileBoxReferenza[];
  css_text: string;
  meta_volantino: { title: string; description: string };
};

const aspettoDa = (sitoWeb: ImpostazioniGdo["sitoWeb"]): Aspetto => ({
  icona_pagina: sitoWeb.icona_pagina ?? "",
  stili: sitoWeb.stili ?? [],
  // Il CSS si mostra già formattato: è la base del confronto, così formattarlo non è una modifica
  css_text: sitoWeb.css_text ? beautify.css(sitoWeb.css_text, { indent_size: 2 }) : "",
  meta_volantino: { title: sitoWeb.meta_volantino?.title ?? "", description: sitoWeb.meta_volantino?.description ?? "" },
});

const uguali = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Gli stili in JSON: modifica gli stessi stili dell'editor visuale. Finché il testo non è un elenco
 * JSON valido gli stili restano quelli di prima e il salvataggio è bloccato.
 */
function EditorStiliJson({
  stili,
  onChange,
  onErrore,
}: {
  stili: StileBoxReferenza[];
  onChange: (stili: StileBoxReferenza[]) => void;
  onErrore: (errore: string | null) => void;
}) {
  // Il testo nasce dagli stili quando si apre la scheda; poi è il testo a cambiare gli stili
  const [testo, setTesto] = useState(() => JSON.stringify(stili, null, 2));

  const scrivi = (nuovo: string) => {
    setTesto(nuovo);
    try {
      const valore: unknown = JSON.parse(nuovo);
      if (!Array.isArray(valore)) {
        onErrore("Gli stili devono essere un elenco JSON, tra parentesi quadre.");
        return;
      }
      onErrore(null);
      onChange(valore as StileBoxReferenza[]);
    } catch (errore) {
      onErrore(`JSON non valido: ${errore instanceof Error ? errore.message : String(errore)}`);
    }
  };

  return <EditorCodice etichetta="Stili dei box (JSON)" linguaggio="json" valore={testo} onChange={scrivi} />;
}

/** Icona della pagina, titolo e descrizione, stili dei box e CSS del sito web dei volantini. */
function SezioneAspettoSitoWeb({ sitoWeb }: { sitoWeb: ImpostazioniGdo["sitoWeb"] }) {
  const { showNotification } = useNotification();
  const salva = useSalvaSitoWeb();
  const salvato = useMemo(() => aspettoDa(sitoWeb), [sitoWeb]);
  const { bozza, setBozza, modificata } = useBozza(salvato);
  const [scheda, setScheda] = useState<Scheda>("visuale");
  const [erroreJson, setErroreJson] = useState<string | null>(null);
  const inputIcona = useRef<HTMLInputElement>(null);

  const aggiorna = (modifiche: Partial<Aspetto>) => setBozza({ ...bozza, ...modifiche });

  const scegliIcona = async (evento: ChangeEvent<HTMLInputElement>) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showNotification("L'icona della pagina deve essere un'immagine.", { variant: "warning" });
      return;
    }
    aggiorna({ icona_pagina: await leggiFileComeBase64(file) });
  };

  const cambiaScheda = (nuova: Scheda) => {
    // Uscendo dal JSON con un errore restano gli ultimi stili validi
    setErroreJson(null);
    setScheda(nuova);
  };

  const salvaAspetto = () => {
    // Solo i campi cambiati: gli altri restano come sono salvati (anche l'icona letta da Olimpo)
    const modifiche: SitoWebDaSalvare = {};
    if (bozza.icona_pagina !== salvato.icona_pagina) modifiche.icona_pagina = bozza.icona_pagina;
    if (!uguali(bozza.stili, salvato.stili)) modifiche.stili = bozza.stili;
    if (bozza.css_text !== salvato.css_text) modifiche.css_text = bozza.css_text;
    if (!uguali(bozza.meta_volantino, salvato.meta_volantino)) modifiche.meta_volantino = bozza.meta_volantino;
    salva.mutate(modifiche, {
      onSuccess: () => showNotification("Aspetto del sito web salvato", { variant: "success" }),
      onError: (errore) => showNotification(`Aspetto non salvato: ${errore.message}`, { variant: "error" }),
    });
  };

  return (
    <Sezione
      id="aspetto-sito-web"
      className="scroll-mt-24"
      icona="Palette"
      titolo="Aspetto del sito web"
      descrizione="L'icona e il titolo della pagina, gli stili dei box referenza e il CSS del sito web dei volantini."
      azioni={
        <Button
          variant="primary"
          size="sm"
          onClick={salvaAspetto}
          loading={salva.isPending}
          disabled={!modificata || !!erroreJson || salva.isPending}
        >
          Salva aspetto
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col">
            <span className="mb-2 inline-block">Icona della pagina</span>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-control border border-slate-200 bg-white p-1.5">
                {bozza.icona_pagina ? (
                  <img src={sorgenteImmagine(bozza.icona_pagina)} alt="Icona della pagina" className="max-h-full max-w-full object-contain" />
                ) : (
                  <Lucide icon="Image" aria-hidden="true" className="h-6 w-6 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline-secondary" size="sm" onClick={() => inputIcona.current?.click()}>
                  <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  {bozza.icona_pagina ? "Sostituisci" : "Carica immagine"}
                </Button>
                {bozza.icona_pagina && (
                  <Button variant="outline-danger" size="sm" onClick={() => aggiorna({ icona_pagina: "" })}>
                    <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Rimuovi
                  </Button>
                )}
              </div>
              <input
                ref={inputIcona}
                type="file"
                accept="image/*"
                aria-label="File dell'icona della pagina"
                className="hidden"
                onChange={scegliIcona}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">L'icona della scheda del browser (favicon).</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField etichetta="Titolo della pagina" aiuto="Il titolo della scheda del browser; senza, «WebPliant».">
              <FormInput
                type="text"
                value={bozza.meta_volantino.title}
                onChange={(e) => aggiorna({ meta_volantino: { ...bozza.meta_volantino, title: e.target.value } })}
              />
            </FormField>
            <FormField etichetta="Descrizione della pagina" aiuto="La descrizione per i motori di ricerca e le anteprime dei link.">
              <FormInput
                type="text"
                value={bozza.meta_volantino.description}
                onChange={(e) => aggiorna({ meta_volantino: { ...bozza.meta_volantino, description: e.target.value } })}
              />
            </FormField>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Segmenti<Scheda>
            etichetta="Cosa modificare"
            valore={scheda}
            onChange={cambiaScheda}
            opzioni={[
              { valore: "visuale", etichetta: "Stili dei box" },
              { valore: "json", etichetta: "Stili in JSON" },
              { valore: "css", etichetta: "CSS personalizzato" },
            ]}
          />
          {scheda === "visuale" && <EditorStiliReferenza stili={bozza.stili} onChange={(stili) => aggiorna({ stili })} />}
          {scheda === "json" && (
            <>
              {erroreJson && (
                <Alert variant="soft-danger" icona="CircleAlert">
                  {erroreJson} Gli stili restano gli ultimi validi finché non correggi il testo.
                </Alert>
              )}
              <EditorStiliJson stili={bozza.stili} onChange={(stili) => aggiorna({ stili })} onErrore={setErroreJson} />
            </>
          )}
          {scheda === "css" && (
            <EditorCodice
              etichetta="CSS personalizzato del sito web"
              linguaggio="css"
              valore={bozza.css_text}
              onChange={(css_text) => aggiorna({ css_text })}
            />
          )}
        </div>
      </div>
    </Sezione>
  );
}

export default SezioneAspettoSitoWeb;
