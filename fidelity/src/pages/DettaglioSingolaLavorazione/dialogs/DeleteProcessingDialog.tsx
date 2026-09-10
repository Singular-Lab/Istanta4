import React from 'react';
import { useMutation } from '@tanstack/react-query';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import LoadingIcon from '@/components/Base/LoadingIcon';
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
                <div className="flex items-center">
                    <Lucide icon="Trash2" className="w-5 h-5 text-danger mr-2" />
                    <h2 className="mr-auto text-base font-medium ">Elimina lavorazione da promo</h2>
                </div>
            </Dialog.Title>
            <Dialog.Description className="text-center p-2">
                <div className="bg-danger/5 p-3 rounded-lg border border-danger/10 mb-3">
                    <p className="text-sm text-danger">
                        Stai per eliminare la lavorazione da promo per:
                    </p>
                    <div className="font-semibold text-danger mt-1">
                        {lavorazione.nomeArea} - {lavorazione.nomeCanale}
                    </div>
                </div>
                <p className="text-sm text-slate-500">
                    Questa azione non può essere annullata una volta confermata.
                </p>
                <p className="text-xs text-slate-500">
                    Questo kit non verrà eliminato definitivamente, ma verrà messo in stato di eliminazione.
                    Se si intende elimarlo definitivamente, cliccare "Rilavora".
                </p>
            </Dialog.Description>
            <Dialog.Footer className="flex justify-end gap-4">
                <Button
                    variant="danger"
                    onClick={() => {
                        setDialogOpen(false);
                        mutationEliminaLavorazione.mutate(lavorazione.guidId);
                    }}
                    disabled={mutationEliminaLavorazione.isPending}
                >
                    {mutationEliminaLavorazione.isPending ? (
                        <div className="flex items-center">
                            <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                            Eliminazione...
                        </div>
                    ) : (
                        <>
                            <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                            Elimina
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

export default DeleteProcessingDialog; 