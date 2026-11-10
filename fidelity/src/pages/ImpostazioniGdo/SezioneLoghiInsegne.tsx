import Button from "@/components/Base/Button";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { usePermissionContext } from "@/context/PermissionContext";
import { usePuntiVenditaPerLoghi, useSalvaSitoWeb } from "@/query/impostazioniGdo";
import { useFetchAree, useFetchCanali } from "@/query/query";
import { useRef, useState, type ChangeEvent } from "react";
import { PERMESSI } from "../../../lib/accessi/catalogo";
import type { LoghiInsegne } from "../../../lib/types";
import { leggiFileComeBase64, sorgenteImmagine } from "./file";
import { useBozza } from "./useBozza";

const LOGO_VUOTO: LoghiInsegne = { url: "", base64: "", idCanale: "", idArea: "", idPv: "" };

/** Immagine del logo: quella caricata (base64) o l'indirizzo salvato. */
const sorgenteLogo = (logo: LoghiInsegne) => (logo.base64 ? sorgenteImmagine(logo.base64) : logo.url);

/** Loghi in testata al sito web, per canale, area o punto vendita (logo_header). */
function SezioneLoghiInsegne({ loghi }: { loghi: LoghiInsegne[] }) {
  const { showNotification } = useNotification();
  const { hasPermission } = usePermissionContext();
  const salva = useSalvaSitoWeb();
  const { bozza, setBozza, modificata } = useBozza(loghi);
  const aree = useFetchAree();
  const canali = useFetchCanali();
  const puntiVendita = usePuntiVenditaPerLoghi(hasPermission(PERMESSI.GDO.GESTISCI_PUNTI_VENDITA));
  const inputNuovo = useRef<HTMLInputElement>(null);
  const inputSostituisci = useRef<HTMLInputElement>(null);
  const [daSostituire, setDaSostituire] = useState<number | null>(null);

  const aggiorna = (indice: number, modifiche: Partial<LoghiInsegne>) =>
    setBozza(bozza.map((logo, i) => (i === indice ? { ...logo, ...modifiche } : logo)));

  const leggiImmagine = async (evento: ChangeEvent<HTMLInputElement>): Promise<string | null> => {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return null;
    if (!file.type.startsWith("image/")) {
      showNotification("Il logo deve essere un'immagine.", { variant: "warning" });
      return null;
    }
    return leggiFileComeBase64(file);
  };

  const aggiungi = async (evento: ChangeEvent<HTMLInputElement>) => {
    const base64 = await leggiImmagine(evento);
    if (base64) setBozza([...bozza, { ...LOGO_VUOTO, base64 }]);
  };

  const sostituisci = async (evento: ChangeEvent<HTMLInputElement>) => {
    const indice = daSostituire;
    const base64 = await leggiImmagine(evento);
    // Si toglie anche l'indirizzo salvato, che altrimenti continuerebbe a vincere sull'immagine nuova
    if (base64 && indice !== null) aggiorna(indice, { base64, url: "" });
    setDaSostituire(null);
  };

  const salvaLoghi = () =>
    salva.mutate(
      { logo_header: bozza },
      {
        onSuccess: () => showNotification("Loghi delle insegne salvati", { variant: "success" }),
        onError: (errore) => showNotification(`Loghi non salvati: ${errore.message}`, { variant: "error" }),
      }
    );

  const ambito = (logo: LoghiInsegne) => {
    const parti = [
      canali.data?.find((c) => c.id === logo.idCanale)?.nome,
      aree.data?.find((a) => a.id === logo.idArea)?.nome,
      puntiVendita.data?.find((pv) => pv.id === logo.idPv)?.nome,
    ].filter(Boolean);
    return parti.length > 0 ? parti.join(" · ") : "Vale ovunque";
  };

  return (
    <Sezione
      id="loghi-insegne"
      className="scroll-mt-24"
      icona="Image"
      titolo="Loghi delle insegne"
      descrizione="Il logo in testata al sito web dei volantini. Un logo vale per il canale, l'area o il punto vendita scelti; senza scelta vale ovunque."
      azioni={
        <>
          <Button variant="outline-secondary" size="sm" onClick={() => inputNuovo.current?.click()}>
            <Lucide icon="ImagePlus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Aggiungi logo
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={salvaLoghi}
            loading={salva.isPending}
            disabled={!modificata || salva.isPending}
          >
            Salva loghi
          </Button>
        </>
      }
    >
      <input ref={inputNuovo} type="file" accept="image/*" aria-label="File del nuovo logo" className="hidden" onChange={aggiungi} />
      <input
        ref={inputSostituisci}
        type="file"
        accept="image/*"
        aria-label="File del logo sostitutivo"
        className="hidden"
        onChange={sostituisci}
      />
      {bozza.length === 0 ? (
        <EmptyState
          compatta
          icon="Image"
          title="Nessun logo"
          description="Il sito web non mostra loghi in testata. Aggiungi il logo di un'insegna."
          buttonText="Aggiungi logo"
          buttonIcon="ImagePlus"
          onButtonClick={() => inputNuovo.current?.click()}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {bozza.map((logo, indice) => {
            const nome = `logo ${indice + 1}`;
            return (
              <li key={indice} className="flex flex-col gap-2 rounded-card border border-slate-200 bg-white p-3">
                <div className="flex h-32 items-center justify-center rounded-control bg-slate-50 p-2">
                  {sorgenteLogo(logo) ? (
                    <img src={sorgenteLogo(logo)} alt={`Logo ${indice + 1}`} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Lucide icon="Image" aria-hidden="true" className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <p className="truncate text-xs text-slate-500">{ambito(logo)}</p>
                <FormSelect
                  formSelectSize="sm"
                  aria-label={`Canale del ${nome}`}
                  value={logo.idCanale}
                  onChange={(e) => aggiorna(indice, { idCanale: e.target.value })}
                >
                  <option value="">Tutti i canali</option>
                  {canali.data?.map((canale) => (
                    <option key={canale.id} value={canale.id}>
                      {canale.nome}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  formSelectSize="sm"
                  aria-label={`Area del ${nome}`}
                  value={logo.idArea}
                  onChange={(e) => aggiorna(indice, { idArea: e.target.value })}
                >
                  <option value="">Tutte le aree</option>
                  {aree.data?.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nome}
                    </option>
                  ))}
                </FormSelect>
                {(puntiVendita.data?.length ?? 0) > 0 && (
                  <FormSelect
                    formSelectSize="sm"
                    aria-label={`Punto vendita del ${nome}`}
                    value={logo.idPv ?? ""}
                    onChange={(e) => aggiorna(indice, { idPv: e.target.value })}
                  >
                    <option value="">Tutti i punti vendita</option>
                    {puntiVendita.data?.map((pv) => (
                      <option key={pv.id} value={pv.id}>
                        {pv.nome}
                        {pv.citta ? ` - ${pv.citta}` : ""}
                      </option>
                    ))}
                  </FormSelect>
                )}
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    aria-label={`Sostituisci il ${nome}`}
                    onClick={() => {
                      setDaSostituire(indice);
                      inputSostituisci.current?.click();
                    }}
                  >
                    <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Sostituisci
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    aria-label={`Rimuovi il ${nome}`}
                    onClick={() => setBozza(bozza.filter((_, i) => i !== indice))}
                  >
                    <Lucide icon="Trash2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Rimuovi
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sezione>
  );
}

export default SezioneLoghiInsegne;
