import Button from "@/components/Base/Button";
import { FormField, FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import PermissionGate from "@/components/PermissionGate";
import { useNotification } from "@/context/NotificationContext";
import { indirizzoIconaGdo, useCaricaIconaGdo, useSalvaIdentitaGdo } from "@/query/impostazioniGdo";
import { useRef, useState, type ChangeEvent } from "react";
import { PERMESSI } from "../../../lib/accessi/catalogo";
import type { ImpostazioniGdo } from "../../../lib/impostazioniGdo/tipi";
import { monogramma } from "./file";
import { useBozza } from "./useBozza";

const ESADECIMALE = /^#[0-9a-f]{6}$/i;
/** Colore mostrato dal selettore quando la GDO non ne ha uno: il selettore non conosce il "nessuno". */
const COLORE_NEUTRO = "#64748b";

interface SezioneIdentitaProps {
  gdo: ImpostazioniGdo["gdo"];
  identita: ImpostazioniGdo["identita"];
}

/** Nome (sola lettura), colore e icona SVG della GDO. */
function SezioneIdentita({ gdo, identita }: SezioneIdentitaProps) {
  const { showNotification } = useNotification();
  const salva = useSalvaIdentitaGdo();
  const caricaIcona = useCaricaIconaGdo();
  const { bozza, setBozza, modificata } = useBozza(identita);
  // Testo del colore mentre lo si scrive: finché non è un #rrggbb valido la bozza resta com'era
  const [testoColore, setTestoColore] = useState<string | null>(null);
  const [versioneIcona, setVersioneIcona] = useState(0);
  const inputIcona = useRef<HTMLInputElement>(null);

  const coloreScritto = testoColore ?? bozza.colore ?? "";
  const erroreColore =
    testoColore !== null && testoColore.trim() !== "" && !ESADECIMALE.test(testoColore.trim())
      ? "Scrivi il colore come #rrggbb, per esempio #c62828."
      : undefined;

  const scriviColore = (testo: string) => {
    setTestoColore(testo);
    const pulito = testo.trim();
    if (pulito === "") setBozza({ colore: null });
    else if (ESADECIMALE.test(pulito)) setBozza({ colore: pulito.toLowerCase() });
  };

  const salvaIdentita = () =>
    salva.mutate(
      { colore: bozza.colore },
      {
        onSuccess: () => {
          setTestoColore(null);
          showNotification("Identità della GDO salvata", { variant: "success" });
        },
        onError: (errore) => showNotification(`Identità non salvata: ${errore.message}`, { variant: "error" }),
      }
    );

  const scegliIcona = (evento: ChangeEvent<HTMLInputElement>) => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    if (file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
      showNotification("L'icona della GDO deve essere un file SVG.", { variant: "warning" });
      return;
    }
    caricaIcona.mutate(file, {
      onSuccess: () => {
        setVersioneIcona((v) => v + 1);
        showNotification("Icona della GDO aggiornata: la barra in alto la mostra dal prossimo caricamento della pagina.", {
          variant: "success",
        });
      },
      onError: (errore) => showNotification(`Icona non caricata: ${errore.message}`, { variant: "error" }),
    });
  };

  return (
    <Sezione
      id="identita"
      className="scroll-mt-24"
      icona="Fingerprint"
      titolo="Identità della GDO"
      descrizione="Il nome, il colore e l'icona con cui Fidelity presenta la GDO."
      azioni={
        <Button
          variant="primary"
          size="sm"
          onClick={salvaIdentita}
          loading={salva.isPending}
          disabled={!modificata || !!erroreColore || salva.isPending}
        >
          Salva identità
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <FormField etichetta="Nome" aiuto="Sola lettura: è il nome della GDO nell'anagrafica.">
          <FormInput type="text" value={gdo.nome} readOnly />
        </FormField>

        <div className="flex items-start gap-2">
          <input
            type="color"
            aria-label="Scegli il colore della GDO"
            value={bozza.colore ?? COLORE_NEUTRO}
            onChange={(e) => {
              setTestoColore(null);
              setBozza({ colore: e.target.value.toLowerCase() });
            }}
            className="mt-6 h-9 w-12 flex-none cursor-pointer rounded-control border border-slate-200 bg-white p-1"
          />
          <FormField
            etichetta="Colore della GDO"
            errore={erroreColore}
            aiuto={bozza.colore ? undefined : "Nessun colore: Fidelity usa quello predefinito."}
            className="min-w-0 flex-1"
          >
            <FormInput
              type="text"
              placeholder="#rrggbb"
              value={coloreScritto}
              onChange={(e) => scriviColore(e.target.value)}
              onBlur={() => !erroreColore && setTestoColore(null)}
              className="font-mono"
            />
          </FormField>
          {bozza.colore && (
            <Button
              variant="outline-secondary"
              size="sm"
              className="mt-6"
              aria-label="Togli il colore della GDO"
              onClick={() => {
                setTestoColore(null);
                setBozza({ colore: null });
              }}
            >
              <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex flex-col">
          <span className="mb-2 inline-block">Icona</span>
          <div className="flex items-center gap-3">
            {gdo.haIcona ? (
              <img
                src={`${indirizzoIconaGdo()}?v=${versioneIcona}`}
                alt={`Icona di ${gdo.nome}`}
                className="h-12 w-12 flex-none rounded-control border border-slate-200 bg-white object-contain p-1"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-12 w-12 flex-none items-center justify-center rounded-control text-sm font-semibold text-white"
                style={{ backgroundColor: bozza.colore ?? COLORE_NEUTRO }}
              >
                {monogramma(gdo.nome)}
              </span>
            )}
            <PermissionGate permission={PERMESSI.GDO.UPLOAD_ICONA} mode="disable">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => inputIcona.current?.click()}
                loading={caricaIcona.isPending}
                disabled={caricaIcona.isPending}
              >
                <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Carica SVG
              </Button>
            </PermissionGate>
            <input
              ref={inputIcona}
              type="file"
              accept=".svg,image/svg+xml"
              aria-label="File SVG dell'icona della GDO"
              className="hidden"
              onChange={scegliIcona}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {gdo.haIcona ? "Compare nella barra in alto." : "Nessuna icona caricata."} SVG, si salva appena la carichi.
          </p>
        </div>
      </div>
    </Sezione>
  );
}

export default SezioneIdentita;
