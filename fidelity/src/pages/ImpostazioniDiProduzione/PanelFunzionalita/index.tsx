import Button from "@/components/Base/Button";
import { FormSwitch } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Spinner from "@/components/Base/Spinner";
import { useNotification } from "@/context/NotificationContext";
import { usePermissionContext } from "@/context/PermissionContext";
import { useFetchFunzionalita, useSaveFunzionalita } from "@/query/query";
import { useEffect, useState } from "react";
import type { Funzionalita } from "../../../../lib/types";

const VOCI: Array<{ chiave: keyof Funzionalita; titolo: string; descrizione: string }> = [
  {
    chiave: "momenti",
    titolo: "Gestione momenti",
    descrizione: "Mostra la sezione dei momenti di confronto nel dettaglio di una lavorazione in corso.",
  },
  {
    chiave: "menabo",
    titolo: "Gestisci Menabò",
    descrizione: "Mostra la sezione del menabò nel dettaglio di una lavorazione in corso.",
  },
];

/** Funzioni opzionali della GDO dell'utente, salvate nella sua configurazione. */
export default function PanelFunzionalita() {
  const { showNotification } = useNotification();
  const { hasPermission } = usePermissionContext();
  const puoModificare = hasPermission("impostazioni.modifica_generali");

  const { data, isLoading, isError, error, refetch } = useFetchFunzionalita();
  const { mutate: salva, isPending: isSaving } = useSaveFunzionalita();

  const [valori, setValori] = useState<Funzionalita>({ momenti: false, menabo: false });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data && !isDirty) setValori({ momenti: data.momenti === true, menabo: data.menabo === true });
  }, [data, isDirty]);

  const cambia = (chiave: keyof Funzionalita, attiva: boolean) => {
    setValori((prev) => ({ ...prev, [chiave]: attiva }));
    setIsDirty(true);
  };

  const handleSave = () => {
    salva(valori, {
      onSuccess: () => {
        showNotification("Funzionalità salvate", { variant: "success" });
        setIsDirty(false);
      },
      onError: (error: any) =>
        showNotification(error?.message || "Errore durante il salvataggio delle funzionalità", { variant: "error" }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner etichetta="Caricamento funzionalità…" />
      </div>
    );
  }

  if (isError) {
    return (
      <PageError
        compatta
        titolo="Funzionalità non caricate"
        motivo={(error as Error)?.message || "Impossibile caricare le funzionalità della GDO."}
        onRiprova={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {VOCI.map((voce) => (
        <div key={voce.chiave} className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-slate-700">{voce.titolo}</div>
            <p className="text-xs text-slate-400 mt-0.5">{voce.descrizione}</p>
          </div>
          <FormSwitch>
            <FormSwitch.Input
              type="checkbox"
              aria-label={voce.titolo}
              checked={valori[voce.chiave]}
              disabled={!puoModificare || isSaving}
              onChange={(e) => cambia(voce.chiave, e.target.checked)}
            />
          </FormSwitch>
        </div>
      ))}

      {puoModificare && (
        <div className="flex justify-end pt-2 border-t border-slate-200/80">
          <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={!isDirty} loading={isSaving}>
            {!isSaving && <Lucide icon="Save" aria-hidden="true" className="w-4 h-4 mr-1" />}
            Salva
          </Button>
        </div>
      )}
    </div>
  );
}
