import Alert from "@/components/Base/Alert";
import Lucide from "@/components/Base/Lucide";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useNotification } from "@/context/NotificationContext";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { STATO_PROMO } from "../../../lib/enums";
import { ServerCall, type CustomError } from "../../../lib/server_call";
import { PromoResponseDTO } from "../../../server/core/dto";

// Istanta non elimina definitivamente una promo con importazioni, tracciati o lavorazioni (I20-1052)
const RIFIUTI_ELIMINAZIONE_DEFINITIVA = [
  "importazioni_esistenti_per_questa_promo",
  "tracciati_esistenti_per_questa_promo",
  "lavorazioni_esistenti_per_questa_promo",
];

type StatoDialogo = { show: boolean; idPromo: string; stato?: string; isDeletable?: boolean; numero_kit_collegati?: number; motivoRifiuto?: string };

/**
 * Eliminazione (definitiva o non definitiva) e ripristino di una promo, con la modale di conferma:
 * la usano l'elenco delle promo in corso e lo storico. `onCompletata` ricarica l'elenco.
 */
export function useEliminazionePromo(onCompletata: () => void) {
  const [showDialogEliminazione, setShowDialogEliminazione] = useState<StatoDialogo>();
  const [loadingEliminazione, setLoadingEliminazione] = useState(false);
  const { showNotification } = useNotification();

  const deleteLavorazione = useMutation({
    mutationFn: async ({ id, stato, isDeletable }: { id: string; stato: string; isDeletable?: boolean }) => {
      let result;

      if (isDeletable) {
        result = await ServerCall.delete(`/promo/${id}`);
      } else {
        result = await ServerCall.delete(`/promo/${id}/stato/${stato}`);
      }

      if (result) {
        if (stato !== STATO_PROMO.ELIMINATA) {
          if (isDeletable) {
            showNotification(
              <div className="flex flex-row items-center">
                <Lucide icon="Check" className="text-success w-10 h-10" />
                <div className="ml-4 mr-4">
                  <div className="font-bold">Lavorazione eliminata definitivamente</div>
                  <div className="text-sm text-slate-500">La lavorazione è stata rimossa dal sistema</div>
                </div>
              </div>
            );
          } else {
            showNotification(
              <div className="flex flex-row items-center">
                <Lucide icon="Check" className="text-success w-10 h-10" />
                <div className="ml-4 mr-4">
                  <div className="font-bold">Lavorazione eliminata</div>
                  <div className="text-sm text-slate-500">La lavorazione è stata spostata nella sezione "Eliminate"</div>
                </div>
              </div>
            );
          }
        } else {
          showNotification(
            <div className="flex flex-row items-center">
              <Lucide icon="Check" className="text-success w-10 h-10" />
              <div className="ml-4 mr-4">
                <div className="font-bold">Lavorazione ripristinata</div>
                <div className="text-sm text-slate-500">La lavorazione è stata riportata in lavorazione</div>
              </div>
            </div>
          );
        }
      }
      return result;
    },
    mutationKey: ["deleteLavorazione"],
    onMutate: async () => {
      setLoadingEliminazione(true);
    },
    onSuccess: async () => {
      setLoadingEliminazione(false);
      setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 });
      onCompletata();
    },
    onError(error: CustomError, variables) {
      // Istanta rifiuta l'eliminazione definitiva: la modale resta aperta e propone quella non definitiva
      if (variables.isDeletable && RIFIUTI_ELIMINAZIONE_DEFINITIVA.includes(error?.details?.codice as string)) {
        setLoadingEliminazione(false);
        setShowDialogEliminazione((prev) => prev && { ...prev, isDeletable: false, motivoRifiuto: error.message });
        return;
      }
      if (error.httpStatus == 403) {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleX" className="text-danger w-10 h-10" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Eliminazione negata</div>
              <div className="text-sm text-slate-500">Non hai i permessi per svolgere questa azione</div>
            </div>
          </div>
        );
      } else {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleX" className="text-danger w-10 h-10" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Errore durante l&apos;eliminazione</div>
              <div className="text-sm text-slate-500">{error?.message || "Si è verificato un errore. Riprova o contatta il supporto."}</div>
            </div>
          </div>
        );
      }
      setLoadingEliminazione(false);
      setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 });
    }
  });

  const chiudiDialogEliminazione = () => setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 });

  const confermaDialogEliminazione = () => {
    setLoadingEliminazione(true);
    if (showDialogEliminazione) {
      deleteLavorazione.mutate({
        id: showDialogEliminazione.idPromo,
        stato: showDialogEliminazione.stato as string,
        isDeletable: showDialogEliminazione.isDeletable,
      });
    }
  };

  const apriDialogEliminazione = (promo: PromoResponseDTO) =>
    setShowDialogEliminazione({
      show: true,
      idPromo: promo.id,
      stato: promo.stato,
      isDeletable: promo.is_deletable,
      numero_kit_collegati: promo.numero_kit_collegati,
    });

  const dialog = showDialogEliminazione;
  const kitCollegati = dialog?.numero_kit_collegati ?? 0;
  const ripristino = dialog?.stato === STATO_PROMO.ELIMINATA;

  const dialogoEliminazione = (
    <ConfirmDialog
      open={Boolean(dialog?.show)}
      onClose={chiudiDialogEliminazione}
      onConfirm={confermaDialogEliminazione}
      loading={loadingEliminazione}
      confirmVariant={ripristino ? "primary" : "danger"}
      title={ripristino ? "Ripristina lavorazione" : dialog?.isDeletable ? "Eliminazione definitiva" : "Elimina lavorazione"}
      subtitle={ripristino ? "Torna in lavorazione" : dialog?.isDeletable ? "Azione irreversibile" : "Si potrà ripristinare"}
      confirmLabel={ripristino ? "Ripristina" : dialog?.isDeletable ? "Elimina definitivamente" : "Elimina"}
      description={
        ripristino ? (
          <p>Questa lavorazione è attualmente eliminata. Vuoi ripristinarla e riportarla in lavorazione?</p>
        ) : dialog?.isDeletable ? (
          <div className="flex flex-col gap-3">
            <p>
              Stai per eliminare definitivamente questa lavorazione.{" "}
              <span className="font-medium text-danger">Questa azione non può essere annullata.</span>
            </p>
            {kitCollegati > 0 && (
              <Alert variant="soft-danger" icona="CircleAlert" titolo={`${kitCollegati} kit collegati`}>
                Questa lavorazione ha {kitCollegati} kit associati che verranno eliminati definitivamente insieme alla lavorazione.
              </Alert>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dialog?.motivoRifiuto && (
              <Alert variant="soft-danger" icona="CircleAlert" titolo="Eliminazione definitiva non possibile">
                {dialog.motivoRifiuto}
              </Alert>
            )}
            <p>
              Sei sicuro di voler eliminare questa lavorazione? La lavorazione verrà spostata nella sezione
              &quot;Eliminate&quot; e potrà essere ripristinata.
            </p>
            {kitCollegati > 0 && (
              <Alert variant="soft-warning" icona="Package" titolo={`${kitCollegati} kit collegati`}>
                Questa lavorazione ha {kitCollegati} kit associati che potrebbero essere influenzati dall&apos;eliminazione.
              </Alert>
            )}
          </div>
        )
      }
    />
  );

  return { apriDialogEliminazione, dialogoEliminazione };
}
