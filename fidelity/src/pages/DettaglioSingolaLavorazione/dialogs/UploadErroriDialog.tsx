import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRevalidator } from 'react-router-dom';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { Dialog } from '@/components/Base/Headless';
import LoadingIcon from '@/components/Base/LoadingIcon';
import Badge from '@/components/Base/Badge';
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
    mutationRiportaInLavorazione: ReturnType<typeof useMutation>;
    stagedFiles?: StagedFile[];
}

const UploadErroriDialog = ({
    dialogOpen,
    setDialogOpen,
    lavorazione,
    filesRejected,
    mutationRiportaInLavorazione,
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
                    await mutationRiportaInLavorazione.mutateAsync({});
                }
            } else {
                await mutationRiportaInLavorazione.mutateAsync({});
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
                    <div className="flex items-center">
                        <Lucide icon="Upload" className="w-5 h-5 text-primary mr-2" />
                        <h2 className="text-lg font-semibold text-slate-800">Carica File Corretti</h2>
                    </div>
                </Dialog.Title>
                <Dialog.Description>
                    <div className="space-y-4">
                        <div className="bg-warning/5 p-4 rounded-lg border border-warning/10">
                            <div className="flex items-center space-x-2 mb-2">
                                <Lucide icon="TriangleAlert" className="w-5 h-5 text-warning" />
                                <h3 className="font-medium text-warning">File con Errori da Correggere</h3>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                                Carica i file corretti per sostituire quelli rifiutati. Dopo l'upload, il kit verrà automaticamente riportato in lavorazione.
                            </p>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {filesRejected.map((file: any) => {
                                const isStagedInComponent = stagedFiles.some((sf: StagedFile) => sf.originalFile.id === file.id);
                                const stagedFileFromComponent = stagedFiles.find((sf: StagedFile) => sf.originalFile.id === file.id);

                                return (
                                    <div key={file.id} className={`border rounded-lg p-4 bg-white ${isStagedInComponent ? 'border-primary/20 bg-primary/5' : 'border-slate-200'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className={`p-2 rounded-lg ${isStagedInComponent ? 'bg-primary/10' : 'bg-danger/10'
                                                    }`}>
                                                    <Lucide
                                                        icon={isStagedInComponent ? "Clock" : "FileX"}
                                                        className={`w-4 h-4 ${isStagedInComponent ? 'text-primary' : 'text-danger'
                                                            }`}
                                                    />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-slate-800">{file.nome}</h4>
                                                    <p className="text-xs text-slate-500">
                                                        {file.rejectionReason || 'File rifiutato'}
                                                    </p>
                                                    {isStagedInComponent && (
                                                        <p className="text-xs text-primary mt-1">
                                                            <Lucide icon="Clock" className="w-3 h-3 mr-1 inline" />
                                                            File in staging: {stagedFileFromComponent?.newFile.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Badge
                                                    variant={isStagedInComponent ? "warning" : "error"}
                                                    size="sm"
                                                >
                                                    {isStagedInComponent ? "In Staging" : "Da Correggere"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {stagedFiles.length > 0 && (
                            <div className="bg-info/5 p-4 rounded-lg border border-info/10">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Lucide icon="Info" className="w-5 h-5 text-info" />
                                    <h3 className="font-medium text-info">Prossimo Passo</h3>
                                </div>
                                <p className="text-sm text-slate-600">
                                    Hai {stagedFiles.length} file pronti per il caricamento. 
                                    Dopo aver completato l'upload, il kit verrà automaticamente riportato in lavorazione per una nuova revisione.
                                </p>
                            </div>
                        )}
                    </div>
                </Dialog.Description>
                <Dialog.Footer className="flex justify-between">
                    <Button
                        variant="secondary"
                        onClick={() => setDialogOpen(false)}
                        disabled={isProcessing}
                    >
                        Annulla
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleProcessAll}
                        disabled={!totalFilesReady || isProcessing}
                    >
                        {isProcessing ? (
                            <div className="flex items-center">
                                <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                                Processando...
                            </div>
                        ) : (
                            <>
                                <Lucide icon="Send" className="w-4 h-4 mr-2" />
                                {totalFilesReady ? 'Carica e Riporta in Lavorazione' : 'Riporta in Lavorazione'}
                                ({stagedFiles.length})
                            </>
                        )}
                    </Button>
                </Dialog.Footer>
            </Dialog.Panel>
        </Dialog>
    );
};

export default UploadErroriDialog; 