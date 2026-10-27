import React from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import { LavorazioneType } from '../types';

interface RilavoraDialogProps {
    mutationRilavora: ReturnType<typeof useMutation>;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    lavorazione: LavorazioneType;
}

const RilavoraDialog = ({ mutationRilavora, dialogOpen, setDialogOpen, lavorazione }: RilavoraDialogProps) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Dialog.Panel>
            <Dialog.Title>
                <Lucide icon="TriangleAlert" aria-hidden="true" className="h-5 w-5 text-danger" />
                Rilavora
            </Dialog.Title>
            <Dialog.Description className="flex flex-col gap-3 text-sm text-slate-600">
                <Alert variant="soft-danger">
                    Stai per eliminare completamente la lavorazione corrente e crearne una nuova per:
                    <div className="mt-1 font-semibold">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </Alert>
                <p className="font-medium text-danger">
                    Questa azione eliminerà definitivamente tutti i file e i dati della lavorazione corrente.
                    Non sarà possibile recuperare i dati eliminati.
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
                        mutationRilavora.mutate(lavorazione.guidId);
                    }}
                >
                    <Lucide icon="TriangleAlert" aria-hidden="true" className="mr-2 h-4 w-4" />
                    Elimina e Rilavora
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default RilavoraDialog; 