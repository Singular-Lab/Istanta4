import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
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
    <Dialog open={open} onClose={isPending ? () => {} : onClose}>
      <Dialog.Panel>
        <Dialog.Title>
          <div className="flex items-center">
            <Lucide icon="Printer" aria-hidden="true" className="w-5 h-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">Richiedi ordine di stampa</h2>
          </div>
        </Dialog.Title>

        <Dialog.Description className="text-center p-2">
          <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 mb-3">
            <p className="text-sm text-slate-700">
              Stai per creare un ordine di stampa per:
            </p>
            <div className="font-semibold text-primary mt-1">
              {selectedPromo?.nome}
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 mt-2">
              <span>{selectedPromo && formatData(selectedPromo.validita_dal)}</span>
              <Lucide icon="ArrowRight" aria-hidden="true" className="w-4 h-4" />
              <span>{selectedPromo && formatData(selectedPromo.validita_al)}</span>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            La richiesta verrà presa in carico e revisionata prima della pubblicazione alla tipografia.
          </p>
        </Dialog.Description>

        <Dialog.Footer className="flex justify-end gap-4">
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={isPending}
            loading={isPending}
          >
            {!isPending && <Lucide icon="Check" aria-hidden="true" className="w-4 h-4 mr-2" />}
            Conferma
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Annulla
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default CreateOrderDialog;
