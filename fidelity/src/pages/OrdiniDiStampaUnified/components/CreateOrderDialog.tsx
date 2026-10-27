import Lucide from "@/components/Base/Lucide";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatData } from "@/utils/format";
import React from "react";
import { PromoResponseDTO } from "../../../../server/core/dto";

interface CreateOrderDialogProps {
  open: boolean;
  selectedPromo: PromoResponseDTO | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

const CreateOrderDialog: React.FC<CreateOrderDialogProps> = ({
  open,
  selectedPromo,
  onClose,
  onConfirm,
  isPending
}) => {
  return (
    <ConfirmDialog
      open={open}
      // Durante la creazione la finestra non si chiude
      onClose={isPending ? () => {} : onClose}
      onConfirm={onConfirm}
      loading={isPending}
      title="Richiedi ordine di stampa"
      subtitle="Nuovo ordine di stampa"
      confirmLabel="Conferma"
      confirmVariant="primary"
      description={
        <div className="space-y-3">
          <p>Stai per creare un ordine di stampa per:</p>
          <div className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-medium text-slate-800">{selectedPromo?.nome}</p>
            <p className="mt-1 flex items-center gap-2 tabular-nums text-slate-600">
              <span>{selectedPromo && formatData(selectedPromo.validita_dal)}</span>
              <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              <span>{selectedPromo && formatData(selectedPromo.validita_al)}</span>
            </p>
          </div>
          <p className="text-slate-500">
            La richiesta verrà presa in carico e revisionata prima della pubblicazione alla tipografia.
          </p>
        </div>
      }
    />
  );
};

export default CreateOrderDialog;
