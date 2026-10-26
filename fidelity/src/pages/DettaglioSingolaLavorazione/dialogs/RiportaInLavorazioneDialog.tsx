import React from 'react';
import { useMutation } from '@tanstack/react-query';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import { FileItemKit } from '../../../../lib/types';
import { LavorazioneType } from '../types';

interface RiportaInLavorazioneDialogProps {
    mutationRiportaInLavorazione: ReturnType<typeof useMutation>;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    filesAccepted: FileItemKit[];
    filesRejected: FileItemKit[];
    lavorazione: LavorazioneType;
}

const RiportaInLavorazioneDialog = ({ mutationRiportaInLavorazione, dialogOpen, setDialogOpen, filesAccepted, filesRejected, lavorazione }: RiportaInLavorazioneDialogProps) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Dialog.Panel>
            <Dialog.Title>
                <div className="flex items-center">
                    <Lucide icon="FileCheck" className="w-5 h-5 text-info mr-2" />
                    <h2 className="text-lg font-semibold text-slate-800 text-center">Riporta in Lavorazione</h2>
                </div>
            </Dialog.Title>
            <Dialog.Description className="text-center p-2">
                <div className="bg-info/5 p-3 rounded-lg border border-info/10 mb-3">
                    <p className="text-sm text-slate-700">
                        Stai per riportare la lavorazione in fase di lavorazione con {filesRejected.length} file da rifiutare e {filesAccepted.length} file da accettare.
                    </p>
                </div>
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
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        setDialogOpen(false);
                        mutationRiportaInLavorazione.mutate(lavorazione?.guidId);
                    }}
                >
                    <Lucide icon="FileCheck" className="w-4 h-4 mr-2" />
                    Riporta
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default RiportaInLavorazioneDialog; 