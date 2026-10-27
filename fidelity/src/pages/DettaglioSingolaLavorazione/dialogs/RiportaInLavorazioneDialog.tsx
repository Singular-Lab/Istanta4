import React from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@/components/Base/Alert';
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
                <Lucide icon="FileCheck" aria-hidden="true" className="h-5 w-5 text-info" />
                Riporta in lavorazione
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-600">
                <Alert variant="soft-info">
                    Stai per riportare la lavorazione in fase di lavorazione con {filesRejected.length} file da rifiutare e {filesAccepted.length} file da accettare.
                </Alert>
            </Dialog.Description>
            <Dialog.Footer>
                <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>
                    Annulla
                </Button>
                <Button
                    variant="primary"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        setDialogOpen(false);
                        mutationRiportaInLavorazione.mutate(lavorazione?.guidId);
                    }}
                >
                    <Lucide icon="FileCheck" aria-hidden="true" className="mr-2 h-4 w-4" />
                    Riporta
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default RiportaInLavorazioneDialog; 