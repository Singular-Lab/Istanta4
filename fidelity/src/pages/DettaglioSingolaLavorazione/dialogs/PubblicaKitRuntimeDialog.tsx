import React from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import { LavorazioneType } from '../types';

interface PubblicaKitRuntimeDialogProps {
    mutationPubblicaKitRuntime: ReturnType<typeof useMutation>;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    lavorazione: LavorazioneType;
}

const PubblicaKitRuntimeDialog = ({ mutationPubblicaKitRuntime, dialogOpen, setDialogOpen, lavorazione }: PubblicaKitRuntimeDialogProps) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Dialog.Panel>
            <Dialog.Title>
                <Lucide icon="FileCheck" aria-hidden="true" className="h-5 w-5 text-info" />
                Pubblica kit runtime
            </Dialog.Title>
            <Dialog.Description className="flex flex-col gap-3 text-sm text-slate-600">
                <Alert variant="soft-info">
                    Stai per pubblicare il kit runtime per:
                    <div className="mt-1 font-semibold">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </Alert>
                <p>Questa azione non può essere annullata una volta confermata.</p>
            </Dialog.Description>
            <Dialog.Footer>
                <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>
                    Annulla
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationPubblicaKitRuntime.mutate(lavorazione.guidId);
                    }}
                >
                    <Lucide icon="FileCheck" aria-hidden="true" className="mr-2 h-4 w-4" />
                    Pubblica
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default PubblicaKitRuntimeDialog; 