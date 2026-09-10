import React, { useEffect } from 'react';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { FileItemKit, FileItemKitLog } from '../../../../lib/types';
import { LavorazioneType } from '../types';
import { STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN } from '../../../../lib/enums';
import { useLavorazione } from '../context/LavorazioneContext';

interface ComponentFooterProps {
    lavorazioneStarted: boolean;
    lavorazione: LavorazioneType;
    filesData?: FileItemKit[];
    groupedFiles?: {
        uploaded: any[];
        pendingUpload: any[];
        notUploaded: any[];
        allFilesUploaded: boolean;
    };
    correggoFile?: FileItemKit;
    // Dialog handlers
    setDialogOpenAvvioRevisione?: (open: boolean) => void;
    setDialogOpenRevisioneConErrori?: (open:boolean) => void;
    setDialogOpenEliminaLavorazione?: (open: boolean) => void;
    setDialogOpenPubblicaKitRuntime?: (open: boolean) => void;
    setDialogOpenRiportaInLavorazione?: (open: boolean) => void;
    setDialogOpenRilavora?: (open: boolean) => void;
}

const ComponentFooter = ({
    lavorazioneStarted,
    lavorazione,
    filesData,
    groupedFiles,
    setDialogOpenAvvioRevisione,
    setDialogOpenRevisioneConErrori,
    setDialogOpenEliminaLavorazione,
    setDialogOpenPubblicaKitRuntime,
    setDialogOpenRiportaInLavorazione,
    setDialogOpenRilavora,
    correggoFile
}: ComponentFooterProps) => {
    const { state } = useLavorazione();
    const { accepted: filesAccepted, rejected: filesRejected } = state;

    const isManuale = lavorazione.tipo === TIPO_KIT_DESIGN.MANUALE;
    const statoLavorazione = (lavorazione as any).stato_lavorazione;

    // Se la lavorazione non è iniziata, non mostrare i pulsanti
   
    useEffect(() => {
        console.log(correggoFile);
    }, [correggoFile]);
    if (!lavorazioneStarted) {
        return null;
    }
    const renderManualeWorkflowButtons = () => {
        switch (statoLavorazione) {
            case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE:
                const hasUploads = groupedFiles?.uploaded && groupedFiles.uploaded.length > 0;
                const hasAllFiles = groupedFiles?.allFilesUploaded;
                
                return (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            {hasUploads && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setDialogOpenAvvioRevisione?.(true)}
                                >
                                    <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                                    Sottoponi a revisione
                                </Button>
                            )}
                            <Button
                                variant="outline-danger"
                                size="sm"
                                className={hasUploads ? "flex-shrink-0" : "flex-1"}
                                onClick={() => setDialogOpenEliminaLavorazione?.(true)}
                            >
                                <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                                Elimina Lavorazione
                            </Button>
                        </div>
                        {hasAllFiles && (
                            <div className="text-xs text-center text-success bg-success/10 py-2 rounded">
                                <Lucide icon="CircleCheck" className="w-3 h-3 mr-1 inline" />
                                Tutti i file sono stati caricati. Puoi procedere con la revisione.
                            </div>
                        )}
                    </div>
                );

            case STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE:
                const hasAccepted = filesAccepted.length > 0;
                const hasRejected = filesRejected.length > 0;
                
                return (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            {hasAccepted && (
                                <Button
                                    variant="success"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setDialogOpenPubblicaKitRuntime?.(true)}
                                >
                                    <Lucide icon="FileCheck" className="w-4 h-4 mr-2" />
                                    Pubblica Kit
                                </Button>
                            )}
                            {hasRejected && (
                                <Button
                                    variant="warning"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setDialogOpenRiportaInLavorazione?.(true)}
                                >
                                    <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
                                    Riporta in Lavorazione
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline-secondary"
                                size="xs"
                                className="flex-1"
                                onClick={() => setDialogOpenEliminaLavorazione?.(true)}
                            >
                                <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
                                Elimina
                            </Button>
                            <Button
                                variant="outline-warning"
                                size="xs"
                                className="flex-1"
                                onClick={() => setDialogOpenRilavora?.(true)}
                            >
                                <Lucide icon="RotateCcw" className="w-3 h-3 mr-1" />
                                Rilavora
                            </Button>
                        </div>
                        <div className="text-xs text-center text-slate-500 bg-slate-50 py-2 rounded">
                            <span className="font-medium text-success">{filesAccepted.length}</span> approvati • 
                            <span className="font-medium text-danger ml-1">{filesRejected.length}</span> rifiutati
                        </div>
                    </div>
                );

            case STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO:
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center bg-success/10 py-3 rounded-lg">
                            <Lucide icon="CircleCheck" className="w-5 h-5 mx-auto text-success mb-2" />
                            <p className="text-sm font-medium text-success">Kit Pubblicato</p>
                            <p className="text-xs text-slate-600">Il kit è ora disponibile per l'utilizzo</p>
                        </div>
                        <Button
                            variant="outline-warning"
                            size="sm"
                            className="w-full"
                            onClick={() => setDialogOpenRilavora?.(true)}
                        >
                            <Lucide icon="RotateCcw" className="w-4 h-4 mr-2" />
                            Rilavora Kit
                        </Button>
                    </div>
                );
            case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI:
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center bg-danger/10 py-3 rounded-lg">
                            <Lucide icon="CircleX" className="w-5 h-5 mx-auto text-danger mb-2" />
                            <p className="text-sm font-medium text-danger">Kit con Errori</p>
                            <p className="text-xs text-slate-600">Il kit ha errori e non può essere pubblicato</p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const renderAutomaticoWorkflowButtons = () => {
        switch (statoLavorazione) {
            case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE:
                const hasFiles = filesData && filesData.length > 0;
                const hasCorreggoFile = correggoFile != undefined;
                return (
                    <div className="flex flex-col gap-3">
                        <Button
                            variant="primary"
                            size="sm"
                            className="w-full"
                            onClick={() => setDialogOpenAvvioRevisione?.(true)}
                            disabled={!hasFiles || hasCorreggoFile}
                        >
                            <Lucide icon="Send" className="w-4 h-4 mr-2" />
                            Sottoponi a revisione
                        </Button>
                        <div className="text-xs text-center text-info bg-info/10 py-2 rounded">
                            <Lucide icon="Info" className="w-3 h-3 mr-1 inline" />
                            Genera tutti i file necessari prima di procedere con la revisione
                        </div>
                    </div>
                );
            case STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE:
                const hasRejectedAuto = filesRejected.length > 0;
                const hasAcceptedAuto = filesAccepted.length > 0;
                const totalFiles = filesData?.length || 0;
                
                return (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            {hasAcceptedAuto && (
                                <Button
                                    variant="success"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setDialogOpenPubblicaKitRuntime?.(true)}
                                >
                                    <Lucide icon="FileCheck" className="w-4 h-4 mr-2" />
                                    Pubblica Kit
                                </Button>
                            )}
                            {hasRejectedAuto && (
                                <Button
                                    variant="warning"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setDialogOpenRiportaInLavorazione?.(true)}
                                >
                                    <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
                                    Riporta in Lavorazione
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline-secondary"
                                size="xs"
                                className="flex-1"
                                onClick={() => setDialogOpenEliminaLavorazione?.(true)}
                            >
                                <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
                                Elimina
                            </Button>
                            <Button
                                variant="outline-warning"
                                size="xs"
                                className="flex-1"
                                onClick={() => setDialogOpenRilavora?.(true)}
                            >
                                <Lucide icon="RotateCcw" className="w-3 h-3 mr-1" />
                                Rilavora
                            </Button>
                        </div>
                        <div className="text-xs text-center text-slate-500 bg-slate-50 py-2 rounded">
                            <span className="font-medium text-success">{filesAccepted.length}</span> approvati • 
                            <span className="font-medium text-danger ml-1">{filesRejected.length}</span> rifiutati
                        </div>
                    </div>
                );
            case STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO:
                return (
                    <div className="flex flex-col gap-3">
                        <div className="text-center bg-success/10 py-3 rounded-lg">
                            <Lucide icon="CircleCheck" className="w-5 h-5 mx-auto text-success mb-2" />
                            <p className="text-sm font-medium text-success">Kit Automatico Pubblicato</p>
                            <p className="text-xs text-slate-600">Tutti i file sono pronti per l'utilizzo</p>
                        </div>
                    </div>
                );
            case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI:
                return (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <Button
                                variant="primary"
                                size="sm"
                                className="flex-1"
                                onClick={() => setDialogOpenRevisioneConErrori?.(true)}
                            >
                                <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                                Carica i file e manda in revisione
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline-secondary"
                                size="xs"
                                className="flex-1"
                                onClick={() => setDialogOpenEliminaLavorazione?.(true)}
                            >
                                <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
                                Elimina
                            </Button>
                            <Button
                                variant="outline-warning"
                                size="xs"
                                className="flex-1"
                                onClick={() => setDialogOpenAvvioRevisione?.(true)}
                            >
                                <Lucide icon="RotateCcw" className="w-3 h-3 mr-1" />
                                Rilavora
                            </Button>
                        </div>
                        <div className="text-xs text-center text-slate-500 bg-slate-50 py-2 rounded">
                            <span className="font-medium text-success">{filesAccepted.length}</span> approvati • 
                            <span className="font-medium text-danger ml-1">{filesRejected.length}</span> rifiutati
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="box my-5 mb-10">
            <div className="pt-5 p-4 mt-auto">
                {isManuale ? renderManualeWorkflowButtons() : renderAutomaticoWorkflowButtons()}
            </div>
        </div>
    );
};

export default ComponentFooter; 