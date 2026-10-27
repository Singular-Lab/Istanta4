import { useMutation } from '@tanstack/react-query';
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import { LavorazioneType } from '../types';

interface DeleteProcessingDialogProps {
    mutationEliminaLavorazione: ReturnType<typeof useMutation>;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    lavorazione: LavorazioneType;
}

const DeleteProcessingDialog = ({ mutationEliminaLavorazione, dialogOpen, setDialogOpen, lavorazione }: DeleteProcessingDialogProps) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Dialog.Panel>
            <Dialog.Title>
                <Lucide icon="Trash2" aria-hidden="true" className="h-5 w-5 text-danger" />
                Elimina lavorazione da promo
            </Dialog.Title>
            <Dialog.Description className="flex flex-col gap-3 text-sm text-slate-600">
                <Alert variant="soft-danger">
                    Stai per eliminare la lavorazione da promo per:
                    <div className="mt-1 font-semibold">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </Alert>
                <p>Questa azione non può essere annullata una volta confermata.</p>
                <p className="text-xs text-slate-500">
                    Questo kit non verrà eliminato definitivamente, ma verrà messo in stato di eliminazione.
                    Se si intende eliminarlo definitivamente, cliccare &quot;Rilavora&quot;.
                </p>
            </Dialog.Description>
            <Dialog.Footer>
                <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>
                    Annulla
                </Button>
                <Button
                    variant="danger"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationEliminaLavorazione.mutate(lavorazione.guidId);
                    }}
                    loading={mutationEliminaLavorazione.isPending}
                >
                    {!mutationEliminaLavorazione.isPending && <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />}
                    {mutationEliminaLavorazione.isPending ? 'Eliminazione…' : 'Elimina'}
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default DeleteProcessingDialog;
