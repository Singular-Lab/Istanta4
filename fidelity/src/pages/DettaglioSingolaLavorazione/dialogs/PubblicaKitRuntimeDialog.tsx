import React from 'react';
import { useMutation } from '@tanstack/react-query';
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
                <div className="flex items-center">
                    <Lucide icon="FileCheck" className="w-5 h-5 text-info mr-2" />
                    <h2 className="text-lg font-semibold text-slate-800 text-center">Pubblica Kit Runtime</h2>
                </div>
            </Dialog.Title>
            <Dialog.Description className="text-center p-2">
                <div className="bg-info/5 p-3 rounded-lg border border-info/10 mb-3">
                    <p className="text-sm text-slate-700">
                        Stai per pubblicare il kit runtime per:
                    </p>
                    <div className="font-semibold text-info mt-1">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </div>
                <p className="text-sm text-slate-500">
                    Questa azione non può essere annullata una volta confermata.
                </p>
            </Dialog.Description>
            <Dialog.Footer className="flex justify-end gap-4">
                <Button
                    variant="secondary"
                    onClick={() => setDialogOpen(false)}
                >
                    Annulla
                </Button>
                <Button
                    variant="soft-primary"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationPubblicaKitRuntime.mutate(lavorazione.guidId);
                    }}
                >
                    <Lucide icon="FileCheck" className="w-4 h-4 mr-2" />
                    Pubblica
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default PubblicaKitRuntimeDialog; 