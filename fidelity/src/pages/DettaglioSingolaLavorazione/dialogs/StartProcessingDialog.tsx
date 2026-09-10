import Button from '@/components/Base/Button';
import { Dialog } from '@/components/Base/Headless';
import LoadingIcon from '@/components/Base/LoadingIcon';
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
                <div className="flex items-center">
                    <Lucide icon="Zap" className="w-5 h-5 text-primary mr-2" />
                    <h2 className="text-lg font-semibold text-slate-800 text-center">Avvia Lavorazione</h2>
                </div>
            </Dialog.Title>
            <Dialog.Description className="text-center p-2">
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 mb-3">
                    <p className="text-sm text-slate-700">
                        Stai per avviare la lavorazione {isManuale ? 'manuale' : 'automatica'} per:
                    </p>
                    <div className="font-semibold text-primary mt-1">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </div>
                <p className="text-sm text-slate-500">
                    Questa azione non può essere annullata una volta confermata.
                </p>
                {!isManuale && (<p className="text-xs text-slate-500">
                    Il kit predefinito non verrà eliminato.
                    Se si intende eliminare anche il kit design, è necessario farlo dalle impostazioni POP.
                </p>)}
            </Dialog.Description>
            <Dialog.Footer className="flex justify-end gap-4">
                <Button
                    variant="success"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationStartLavorazione.mutate({ idPromo } || "");
                    }}
                    disabled={mutationStartLavorazione.isPending}
                >
                    {mutationStartLavorazione.isPending ? (
                        <div className="flex items-center">
                            <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                            Avvio...
                        </div>
                    ) : (
                        <>
                            <Lucide icon="Play" className="w-4 h-4 mr-2" />
                            Avvia
                        </>
                    )}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => setDialogOpen(false)}
                >
                    Annulla
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default StartProcessingDialog;
