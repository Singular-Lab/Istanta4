import Button from "@/components/Base/Button";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  // Sottotitolo sotto il titolo; default "Azione irreversibile"
  subtitle?: string;
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
  subtitle = "Azione irreversibile",
  confirmLabel = "Conferma",
  confirmVariant = "danger",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} size="md" centered>
      <Dialog.Panel>
        {/* Il sottotitolo sta fuori da Dialog.Title: il nome della finestra è solo il titolo */}
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-3 dark:border-darkmode-400">
          <div
            data-testid="icona-conferma"
            aria-hidden="true"
            className={
              confirmVariant === "danger"
                ? "w-10 h-10 flex-none rounded-full bg-danger/10 text-danger flex items-center justify-center"
                : "w-10 h-10 flex-none rounded-full bg-primary/10 text-primary flex items-center justify-center"
            }
          >
            <Lucide icon={confirmVariant === "danger" ? "TriangleAlert" : "Info"} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <Dialog.Title className="border-0 p-0">{title}</Dialog.Title>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <Dialog.Description className="text-sm leading-relaxed text-slate-600">
          {description}
        </Dialog.Description>
        <Dialog.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={loading}>
            Annulla
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading} disabled={loading}>
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default ConfirmDialog;
