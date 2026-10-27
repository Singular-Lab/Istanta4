import React from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import { LavorazioneType } from '../types';

interface StartRevisionDialogProps {
    mutationAvvioRevisione: ReturnType<typeof useMutation>;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    lavorazione: LavorazioneType;
}

const StartRevisionDialog = ({ mutationAvvioRevisione, dialogOpen, setDialogOpen, lavorazione }: StartRevisionDialogProps) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Dialog.Panel>
            <Dialog.Title>
                <Lucide icon="FileCheck" aria-hidden="true" className="h-5 w-5 text-info" />
                Sottoponi a revisione
            </Dialog.Title>
            <Dialog.Description className="flex flex-col gap-3 text-sm text-slate-600">
                <Alert variant="soft-info">
                    Stai per avviare la revisione per:
                    <div className="mt-1 font-semibold">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </Alert>
                <p>Questa azione non può essere annullata una volta confermata.</p>
                <p className="text-xs text-slate-500">
                    La revisione permetterà di verificare e approvare i file caricati.
                </p>
            </Dialog.Description>
            <Dialog.Footer>
                <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>
                    Annulla
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationAvvioRevisione.mutate(lavorazione.guidId);
                    }}
                >
                    <Lucide icon="FileCheck" aria-hidden="true" className="mr-2 h-4 w-4" />
                    Sottoponi a revisione
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default StartRevisionDialog; 