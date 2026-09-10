import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Conferma",
  confirmVariant = "danger",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} size="md" centered>
      <Dialog.Panel>
        <Dialog.Title className="gap-3">
          <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
            <Lucide icon="TriangleAlert" className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-800">{title}</div>
            <div className="text-sm font-normal text-slate-500">Azione irreversibile</div>
          </div>
        </Dialog.Title>
        <Dialog.Description className="text-sm leading-relaxed text-slate-600">
          {description}
        </Dialog.Description>
        <Dialog.Footer className="flex justify-end gap-3">
          <Button variant="outline-secondary" onClick={onClose} disabled={loading}>
            Annulla
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default ConfirmDialog;
