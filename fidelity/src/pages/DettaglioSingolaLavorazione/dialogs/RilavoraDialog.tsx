import React from 'react';
import { useMutation } from '@tanstack/react-query';
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
                <div className="flex items-center">
                    <Lucide icon="TriangleAlert" className="w-5 h-5 text-danger mr-2" />
                    <h2 className="text-lg font-semibold text-slate-800 text-center">Rilavora</h2>
                </div>
            </Dialog.Title>
            <Dialog.Description className="text-center p-2">
                <div className="bg-danger/5 p-3 rounded-lg border border-danger/10 mb-3">
                    <p className="text-sm text-slate-700">
                        ATTENZIONE: Stai per eliminare completamente la lavorazione corrente e crearne una nuova per:
                    </p>
                    <div className="font-semibold text-danger mt-1">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </div>
                <p className="text-sm text-danger font-medium">
                    Questa azione eliminerà definitivamente tutti i file e i dati della lavorazione corrente.
                    Non sarà possibile recuperare i dati eliminati.
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
                    variant="danger"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationRilavora.mutate(lavorazione.guidId);
                    }}
                >
                    <Lucide icon="TriangleAlert" className="w-4 h-4 mr-2" />
                    Elimina e Rilavora
                </Button>
            </Dialog.Footer>
        </Dialog.Panel>
    </Dialog>
);

export default RilavoraDialog; 