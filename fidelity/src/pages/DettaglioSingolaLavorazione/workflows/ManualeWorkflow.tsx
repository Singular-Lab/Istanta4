/**
 * @deprecated Questo componente è deprecato.
 * Usare invece il nuovo KitOverviewLayout in src/components/KitOverview
 * che gestisce tutti gli stati del kit in un'unica vista unificata.
 *
 * La nuova pagina DettaglioKit in src/pages/DettaglioKit utilizza
 * il layout unificato KitOverviewLayout.
 */
import React from 'react';
import { LavorazioneType, FileUpload } from '../types';
import { RUNTIME_KIT_MONGO } from '../../../../lib/types';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';
import SearchAndFilters from '../components/SearchAndFilters';
import TabButtons from '../components/TabButtons';
import FileUploader from '../components/FileUploader';
import FilesGrid from '../components/FilesGrid';
import ActionFooter from '../components/ActionFooter';
import LavorazioneInLavorazioneConErroreManuale from '../components/LavorazioneInLavorazioneConErroreManuale';
import LavorazioneInRevisione from '../components/LavorazioneInRevisioneManuale';
import Lucide from '@/components/Base/Lucide';
import Button from '@/components/Base/Button';
import { useLavorazione } from '../context/LavorazioneContext';

// Definisci qui le props necessarie dal componente genitore
interface ManualeWorkflowProps {
    lavorazione: LavorazioneType;
    manuale: any; // Tipizzare meglio in base al ritorno di useManualeLogic
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    activeTab: number;
    setActiveTab: (tab: number) => void;
    managedFiles: any[];
    uploads: FileUpload[];
    selectedFile: any;
    setSelectedFile: (file: any) => void;
    isUpdating: boolean;
    handleShowHistory: (file: any) => void;
}

const ManualeWorkflow: React.FC<ManualeWorkflowProps> = ({
    lavorazione,
    manuale,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    managedFiles,
    uploads,
    selectedFile,
    setSelectedFile,
    isUpdating,
    handleShowHistory,
}) => {
    const { state } = useLavorazione();
    if (!manuale) return null;
    const statoLavorazione = (lavorazione as RUNTIME_KIT_MONGO).stato_lavorazione;

    switch (statoLavorazione) {
        case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE:
            return (
                <>
                    <SearchAndFilters searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    <TabButtons activeTab={activeTab} setActiveTab={setActiveTab} filteredFiles={manuale.filteredFiles} groupedFiles={manuale.groupedFiles} />
                    <FileUploader managedFiles={managedFiles} uploads={uploads} handleAddFile={manuale.handleAddFile} lavorazione={lavorazione} />
                    <FilesGrid
                        getFilesToDisplay={() => {
                            switch (activeTab) {
                                case 1: return manuale.groupedFiles.uploaded;
                                case 2: return manuale.groupedFiles.pendingUpload;
                                case 3: return manuale.groupedFiles.notUploaded;
                                default: return manuale.filteredFiles;
                            }
                        }}
                        lavorazione={lavorazione}
                        getUploadedFile={manuale.getUploadedFile}
                        selectedFile={selectedFile}
                        setSelectedFile={setSelectedFile}
                        downloadFile={manuale.downloadFile}
                        handleUpdateFileTipoExport={manuale.handleUpdateFileTipoExport}
                        handleRemoveFile={manuale.handleRemoveFile}
                        mutationEliminaFile={manuale.mutationEliminaFile}
                        onShowHistory={handleShowHistory}
                    />
                    <ActionFooter groupedFiles={manuale.groupedFiles} mutationUploadMateriale={manuale.mutationUploadMateriale} uploads={uploads} isUpdating={isUpdating} />
                </>
            );
        case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI:
            return (
                <LavorazioneInLavorazioneConErroreManuale
                    managedFiles={managedFiles}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    filteredFiles={manuale.filteredFiles}
                    groupedFiles={manuale.groupedFiles}
                    uploads={uploads}
                    handleAddFile={manuale.handleAddFile}
                    lavorazione={lavorazione}
                    getUploadedFile={manuale.getUploadedFile}
                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}
                    downloadFile={manuale.downloadFile}
                    handleUpdateFileTipoExport={manuale.handleUpdateFileTipoExport}
                    handleRemoveFile={manuale.handleRemoveFile}
                    mutationEliminaFile={manuale.mutationEliminaFile}
                    onShowHistory={handleShowHistory}
                    mutationUploadMateriale={manuale.mutationUploadMateriale}
                    isUpdating={isUpdating}
                />
            );
        case STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE:
            return (
                <LavorazioneInRevisione
                    managedFiles={manuale.groupedFiles.uploaded}
                    selectedFile={selectedFile}
                    onFileRework={() => { }}
                    setSelectedFile={setSelectedFile}
                />
            );
        case STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO:
            {
                const allFilesCount = managedFiles?.length || 0;
                const uploadedFilesCount = manuale.groupedFiles?.uploaded?.length || 0;

                return (
                    <div className="box box--stacked">
                        {/* Success banner */}
                        <div className="flex flex-col items-center justify-center py-16 px-4 border-b border-slate-200">
                            <div className="bg-success/10 p-8 rounded-full mb-6">
                                <Lucide icon="FileCheck" className="w-24 h-24 text-success" />
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800 mb-3">
                                Kit Manuale Pubblicato
                            </h3>
                            <p className="text-base text-slate-600 text-center max-w-md leading-relaxed mb-6">
                                Il kit manuale è stato pubblicato con successo. Tutti i file sono ora disponibili.
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-8 mb-8">
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-success mb-1">{uploadedFilesCount}</p>
                                    <p className="text-sm text-slate-600">File caricati</p>
                                </div>
                                <div className="h-12 w-px bg-slate-200" />
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-info mb-1">{allFilesCount}</p>
                                    <p className="text-sm text-slate-600">File totali</p>
                                </div>
                            </div>

                            {/* Date */}
                            <div className="flex items-center gap-2 text-slate-500 mb-8">
                                <Lucide icon="Calendar" className="w-4 h-4" />
                                <span className="text-sm">
                                    Pubblicato il {new Date((lavorazione as RUNTIME_KIT_MONGO).updatedAt || '').toLocaleDateString('it-IT', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        // TODO: Implement download all logic
                                    }}
                                >
                                    <Lucide icon="Download" className="w-4 h-4 mr-2" />
                                    Scarica Tutto (ZIP)
                                </Button>
                                <Button
                                    variant="outline-primary"
                                    onClick={() => {
                                        // TODO: Implement show details logic
                                    }}
                                >
                                    <Lucide icon="FileText" className="w-4 h-4 mr-2" />
                                    Visualizza Dettagli
                                </Button>
                            </div>
                        </div>

                        {/* File list (collapsible) */}
                        <div className="p-6">
                            <details className="group">
                                <summary className="cursor-pointer list-none flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                                    <span className="text-sm font-semibold text-slate-700">Mostra file pubblicati</span>
                                    <Lucide icon="ChevronDown" className="w-4 h-4 text-slate-400 group-open:rotate-180 transition" />
                                </summary>
                                <div className="mt-4 space-y-3">
                                    {manuale.groupedFiles?.uploaded?.map((file: any, index: number) => (
                                        <div key={index} className="p-4 border border-slate-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-success/10 p-2 rounded">
                                                        <Lucide icon="FileCheck" className="w-4 h-4 text-success" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{file.nome}</p>
                                                        {file.direttive && <p className="text-xs text-slate-600">{file.direttive}</p>}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => {
                                                        // TODO: Implement download specific file
                                                    }}
                                                >
                                                    <Lucide icon="Download" className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    </div>
                );
            }
        default:
            return null;
    }
};

export default ManualeWorkflow; 