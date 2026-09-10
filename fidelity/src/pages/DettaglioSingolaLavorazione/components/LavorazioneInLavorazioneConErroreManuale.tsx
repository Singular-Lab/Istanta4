import React from 'react';
import Lucide from '@/components/Base/Lucide';
import clsx from 'clsx';
import { FileItemKit, FileItemKitLog } from '../../../../lib/types';
import SearchAndFilters from './SearchAndFilters';
import TabButtons from './TabButtons';
import FileUploader from './FileUploader';
import FilesGrid from './FilesGrid';
import ActionFooter from './ActionFooter';

interface LavorazioneInLavorazioneConErroreManualeProps {
    managedFiles: any[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    activeTab: number;
    setActiveTab: (tab: number) => void;
    filteredFiles: any[];
    groupedFiles: any;
    uploads: any[];
    handleAddFile: (file: File, expectedFileName: string, direttive: string, tipoExportValue: string) => void;
    lavorazione: any;
    getUploadedFile: (name: string) => any;
    selectedFile: any;
    setSelectedFile: (file: any) => void;
    downloadFile: (base64Data: string, customFileName: string, contentType?: string) => Promise<void>;
    handleUpdateFileTipoExport: (update: { nome: string; tipoExport: string }) => void;
    handleRemoveFile: (name: string) => void;
    mutationEliminaFile: any;
    onShowHistory: (file: any) => void;
    mutationUploadMateriale: any;
    isUpdating: boolean;
}

const StatCard = ({ icon, iconBg, iconColor, value, label }: {
    icon: string; iconBg: string; iconColor: string; value: string | number; label: string;
}) => (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", iconBg)}>
            <Lucide icon={icon as any} className={clsx("h-6 w-6", iconColor)} />
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    </div>
);

const TimelineItem = ({ icon, iconBg, iconColor, title, description, timestamp, isLast }: {
    icon: string; iconBg: string; iconColor: string; title: string; description?: string; timestamp?: string; isLast?: boolean;
}) => (
    <div className="flex gap-3">
        <div className="flex flex-col items-center">
            <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", iconBg)}>
                <Lucide icon={icon as any} className={clsx("h-4 w-4", iconColor)} />
            </div>
            {!isLast && <div className="w-px h-full bg-slate-200 my-1" />}
        </div>
        <div className={clsx("pb-4", isLast && "pb-0")}>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {description && <p className="text-xs text-slate-600 mt-0.5">{description}</p>}
            {timestamp && <p className="text-[10px] text-slate-400 mt-1">{timestamp}</p>}
        </div>
    </div>
);

const LavorazioneInLavorazioneConErroreManuale: React.FC<LavorazioneInLavorazioneConErroreManualeProps> = ({
    managedFiles,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    filteredFiles,
    groupedFiles,
    uploads,
    handleAddFile,
    lavorazione,
    getUploadedFile,
    selectedFile,
    setSelectedFile,
    downloadFile,
    handleUpdateFileTipoExport,
    handleRemoveFile,
    mutationEliminaFile,
    onShowHistory,
    mutationUploadMateriale,
    isUpdating,
}) => {
    const rejectedFiles = managedFiles.filter(file =>
        file.log && file.log.logs.some((log: any) => log.action === 'Rifiutato')
    );
    const rejectedFilesCount = rejectedFiles.length;
    const totalFilesCount = managedFiles.length;
    const errorPercentage = totalFilesCount > 0 ? Math.round((rejectedFilesCount / totalFilesCount) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-danger via-danger/90 to-warning/80 p-8">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYtMmgtNHY2aDR2MmgtNHY0aDJ2LTJoNHYtMmgtMnYtMnptMC0xNmgtMnYtNGgydi0yaC00djZoNHYyaC00djRoMnYtMmg0di0yaC0ydi0yem0tMTYgMGgtMnYtNGgyVjBoLTR2Nmg0djJoLTR2NGgyVjhoNFY2aC0yVjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                            <Lucide icon="TriangleAlert" className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">File con Errori da Correggere</h2>
                            <p className="text-sm text-white/80 mt-1">
                                La revisione ha identificato {rejectedFilesCount} {rejectedFilesCount === 1 ? 'file che necessita' : 'file che necessitano'} di correzioni
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard icon="FileText" iconBg="bg-info/10" iconColor="text-info" value={totalFilesCount} label="File totali" />
                <StatCard icon="CircleX" iconBg="bg-danger/10" iconColor="text-danger" value={rejectedFilesCount} label="Rifiutati" />
                <StatCard icon="Percent" iconBg="bg-warning/10" iconColor="text-warning" value={`${errorPercentage}%`} label="Percentuale errori" />
            </div>

            {/* Quick Actions */}
            <div className="box box--stacked p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-gradient-to-br from-danger/10 to-danger/5 rounded-xl">
                        <Lucide icon="Zap" className="w-5 h-5 text-danger" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800">Azioni disponibili</h3>
                        <p className="text-xs text-slate-500">Scegli come procedere per correggere i file</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-theme-1 hover:bg-theme-1/5 transition text-left"
                        onClick={() => {
                            const uploader = document.querySelector('[data-component="file-uploader"]');
                            uploader?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-theme-1/10 shrink-0">
                            <Lucide icon="Upload" className="w-6 h-6 text-theme-1" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 mb-0.5">Carica file corretti</p>
                            <p className="text-xs text-slate-500">Vai alla sezione upload per sostituire i file</p>
                        </div>
                    </button>

                    <button
                        className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-warning hover:bg-warning/5 transition text-left"
                        onClick={() => {
                            // TODO: Download rejected files as ZIP
                        }}
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 shrink-0">
                            <Lucide icon="Download" className="w-6 h-6 text-warning" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 mb-0.5">Scarica file rifiutati</p>
                            <p className="text-xs text-slate-500">Per revisione offline</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Rejected Files Detail */}
            {rejectedFiles.length > 0 && (
                <div className="box box--stacked p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-gradient-to-br from-danger/10 to-danger/5 rounded-xl">
                            <Lucide icon="FileX" className="w-5 h-5 text-danger" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-800">File Rifiutati</h3>
                            <p className="text-xs text-slate-500">{rejectedFilesCount} file da correggere</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rejectedFiles.map((file: any, index: number) => {
                            const lastRejectionLog = file.log.logs
                                .filter((log: any) => log.action === 'Rifiutato')
                                .sort((a: FileItemKitLog, b: FileItemKitLog) => new Date(b.data_registrazione).getTime() - new Date(a.data_registrazione).getTime())[0];

                            return (
                                <div key={index} className="rounded-xl border border-danger/20 bg-white overflow-hidden">
                                    <div className="p-5 flex items-start gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/10 shrink-0">
                                            <Lucide icon="FileX" className="w-6 h-6 text-danger" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-semibold text-slate-800">{file.nome}</h4>
                                            {file.direttive && (
                                                <p className="text-xs text-slate-500 mt-0.5">{file.direttive}</p>
                                            )}
                                        </div>
                                    </div>
                                    {lastRejectionLog && (
                                        <div className="px-5 pb-5">
                                            <div className="bg-danger/5 rounded-xl p-4 border border-danger/10">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Lucide icon="MessageSquare" className="w-4 h-4 text-danger" />
                                                    <span className="text-xs font-semibold text-danger">Motivo del rifiuto</span>
                                                </div>
                                                <p className="text-sm text-slate-700">
                                                    {lastRejectionLog.log?.messaggio || 'Nessun motivo specificato'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                                    <Lucide icon="Clock" className="w-3 h-3" />
                                                    {new Date(lastRejectionLog.data_registrazione).toLocaleDateString()} alle {new Date(lastRejectionLog.data_registrazione).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className="box box--stacked p-6">
                <div className="flex items-start gap-4 p-4 bg-info/5 rounded-xl border border-info/10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 shrink-0">
                        <Lucide icon="Info" className="w-5 h-5 text-info" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-info mb-1">Cosa fare ora?</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Correggi i file secondo le indicazioni fornite e ricaricali utilizzando la funzione di upload.
                            Una volta corretti tutti i file, potrai procedere nuovamente alla revisione.
                        </p>
                    </div>
                </div>
            </div>

            <SearchAndFilters searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            <TabButtons activeTab={activeTab} setActiveTab={setActiveTab} filteredFiles={filteredFiles} groupedFiles={groupedFiles} />
            <FileUploader managedFiles={managedFiles} uploads={uploads} handleAddFile={handleAddFile} lavorazione={lavorazione} />
            <FilesGrid
                getFilesToDisplay={() => {
                    switch (activeTab) {
                        case 1: return groupedFiles.uploaded;
                        case 2: return groupedFiles.pendingUpload;
                        case 3: return groupedFiles.notUploaded;
                        default: return filteredFiles;
                    }
                }}
                lavorazione={lavorazione}
                getUploadedFile={getUploadedFile}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                downloadFile={downloadFile}
                handleUpdateFileTipoExport={handleUpdateFileTipoExport}
                handleRemoveFile={handleRemoveFile}
                mutationEliminaFile={mutationEliminaFile}
                onShowHistory={onShowHistory}
            />
            <ActionFooter groupedFiles={groupedFiles} mutationUploadMateriale={mutationUploadMateriale} uploads={uploads} isUpdating={isUpdating} />
        </div>
    );
};

export default LavorazioneInLavorazioneConErroreManuale;
