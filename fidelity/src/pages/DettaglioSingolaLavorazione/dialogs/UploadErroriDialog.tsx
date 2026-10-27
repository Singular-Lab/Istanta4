import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRevalidator } from 'react-router-dom';
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import StatusBadge from '@/components/Base/StatusBadge';
import { LavorazioneType, StagedFile } from '../types';
import { FileItemKit } from '../../../../lib/types';
import { useNotification } from '@/context/NotificationContext';
import { ServerCall } from '../../../../lib/server_call';

interface UploadErroriDialogProps {
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    lavorazione: LavorazioneType;
    filesRejected: FileItemKit[];
    rejectionReasons?: Record<string, string>;
    // Dopo la sostituzione il kit va in revisione con i file corretti
    mutationAvvioRevisione: ReturnType<typeof useMutation>;
    stagedFiles?: StagedFile[];
}

const UploadErroriDialog = ({
    dialogOpen,
    setDialogOpen,
    lavorazione,
    filesRejected,
    mutationAvvioRevisione,
    stagedFiles = [],
}: UploadErroriDialogProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { showNotification } = useNotification();
    const revalidator = useRevalidator();
    const queryClient = useQueryClient();

    const handleProcessAll = async () => {
        setIsProcessing(true);
        try {
            if (stagedFiles.length > 0) {
                const uploadPromises = stagedFiles.map((sf: StagedFile) => {
                    const formData = new FormData();
                    formData.append('file', sf.newFile);
                    
                    return ServerCall.post(`/replaceFileKitRuntime/${sf.originalFile.id}`, formData);
                });

                const results = await Promise.allSettled(uploadPromises);

                const successCount = results.filter(r => r.status === 'fulfilled').length;
                const failCount = results.length - successCount;

                if (successCount > 0) {
                    showNotification(<div className="flex items-center gap-2">
                        <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                        <span>{successCount} file sostituiti con successo</span>
                    </div>, { variant: "success" });
                }
                if (failCount > 0) {
                    showNotification(<div className="flex items-center gap-2">
                        <Lucide icon="CircleX" className="w-4 h-4 text-danger" />
                        <span>{failCount} file non sono stati sostituiti</span>
                    </div>, { variant: "error" });
                }

                if (successCount > 0) {
                    await mutationAvvioRevisione.mutateAsync(undefined);
                }
            } else {
                await mutationAvvioRevisione.mutateAsync(undefined);
            }
            setDialogOpen(false);
            revalidator.revalidate();
            queryClient.invalidateQueries({ queryKey: ["getFilesPerGestioneLavorazione", lavorazione.guidId] });
        } catch (error) {
            console.error('Errore durante il processo:', error);
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="CircleX" className="w-4 h-4 text-danger" />
                <span>Errore durante il processo di sostituzione.</span>
            </div>, { variant: "error" });
        } finally {
            setIsProcessing(false);
        }
    };

    const totalFilesReady = stagedFiles.length > 0;

    return (
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} size="xl">
            <Dialog.Panel>
                <Dialog.Title>
                    <Lucide icon="Upload" aria-hidden="true" className="h-5 w-5 text-primary" />
                    Carica file corretti
                </Dialog.Title>
                <Dialog.Description>
                    <div className="space-y-4">
                        <Alert variant="soft-warning" icona="TriangleAlert" titolo="File con errori da correggere">
                            Carica i file corretti per sostituire quelli rifiutati. Dopo l&apos;upload, il kit verrà mandato in revisione.
                        </Alert>

                        <ul className="max-h-96 space-y-3 overflow-y-auto">
                            {filesRejected.map((file: any) => {
                                const isStagedInComponent = stagedFiles.some((sf: StagedFile) => sf.originalFile.id === file.id);
                                const stagedFileFromComponent = stagedFiles.find((sf: StagedFile) => sf.originalFile.id === file.id);

                                return (
                                    <li
                                        key={file.id}
                                        className={`rounded-card border p-4 ${isStagedInComponent ? 'border-primary/20 bg-primary/5' : 'border-slate-200 bg-white'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className={`rounded-control p-2 ${isStagedInComponent ? 'bg-primary/10' : 'bg-danger/10'}`}>
                                                    <Lucide
                                                        icon={isStagedInComponent ? "Clock" : "FileX"}
                                                        aria-hidden="true"
                                                        className={`h-4 w-4 ${isStagedInComponent ? 'text-primary' : 'text-danger'}`}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="title-card truncate">{file.nome}</h3>
                                                    <p className="text-xs text-slate-500">
                                                        {file.rejectionReason || 'File rifiutato'}
                                                    </p>
                                                    {isStagedInComponent && (
                                                        <p className="mt-1 text-xs text-primary">
                                                            <Lucide icon="Clock" aria-hidden="true" className="mr-1 inline h-3 w-3" />
                                                            File in staging: {stagedFileFromComponent?.newFile.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <StatusBadge
                                                tono={isStagedInComponent ? "warning" : "danger"}
                                                etichetta={isStagedInComponent ? "In staging" : "Da correggere"}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {stagedFiles.length > 0 && (
                            <Alert variant="soft-info" icona="Info" titolo="Prossimo passo">
                                Hai {stagedFiles.length} file pronti per il caricamento.
                                Dopo aver completato l&apos;upload, il kit verrà mandato in revisione.
                            </Alert>
                        )}
                    </div>
                </Dialog.Description>
                <Dialog.Footer>
                    <Button
                        variant="outline-secondary"
                        onClick={() => setDialogOpen(false)}
                        disabled={isProcessing}
                    >
                        Annulla
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleProcessAll}
                        disabled={!totalFilesReady}
                        loading={isProcessing}
                    >
                        {isProcessing ? (
                            'Elaborazione…'
                        ) : (
                            <>
                                <Lucide icon="Send" aria-hidden="true" className="mr-2 h-4 w-4" />
                                {totalFilesReady ? 'Carica e manda in revisione' : 'Manda in revisione'}
                                {` (${stagedFiles.length})`}
                            </>
                        )}
                    </Button>
                </Dialog.Footer>
            </Dialog.Panel>
        </Dialog>
    );
};

export default UploadErroriDialog; 