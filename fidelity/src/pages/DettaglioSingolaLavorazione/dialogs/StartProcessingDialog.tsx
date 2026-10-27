import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useMutation } from '@tanstack/react-query';
import { LavorazioneType } from '../types';

interface StartProcessingDialogProps {
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    lavorazione: LavorazioneType;
    mutationStartLavorazione: ReturnType<typeof useMutation>;
    idPromo: string;
    isManuale: boolean;
}

const StartProcessingDialog = ({ dialogOpen, setDialogOpen, lavorazione, mutationStartLavorazione, idPromo, isManuale }: StartProcessingDialogProps) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Dialog.Panel>
            <Dialog.Title>
                <Lucide icon="Zap" aria-hidden="true" className="h-5 w-5 text-primary" />
                Avvia lavorazione
            </Dialog.Title>
            <Dialog.Description className="flex flex-col gap-3 text-sm text-slate-600">
                <Alert variant="soft-primary">
                    Stai per avviare la lavorazione {isManuale ? 'manuale' : 'automatica'} per:
                    <div className="mt-1 font-semibold">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </Alert>
                <p>Questa azione non può essere annullata una volta confermata.</p>
                {!isManuale && (
                    <p className="text-xs text-slate-500">
                        Il kit predefinito non verrà eliminato.
                        Se si intende eliminare anche il kit design, è necessario farlo dalle impostazioni POP.
                    </p>
                )}
            </Dialog.Description>
            <Dialog.Footer>
                <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>
                    Annulla
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationStartLavorazione.mutate({ idPromo });
                    }}
                    loading={mutationStartLavorazione.isPending}
                >
                    {!mutationStartLavorazione.isPending && <Lucide icon="Play" aria-hidden="true" className="mr-2 h-4 w-4" />}
                    {mutationStartLavorazione.isPending ? 'Avvio…' : 'Avvia'}
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default StartProcessingDialog;
