import React from 'react';
import { FileItemKit, FileItemKitLog } from '../../../../lib/types';
import { LavorazioneType, FileUpload } from '../types';
import Lucide from '@/components/Base/Lucide';
import FileCard from './FileCard';
import { UseMutationResult } from '@tanstack/react-query';

// Props for FileCard that FilesGrid will pass through
interface FileCardPassthroughProps {
    selectedFile: FileItemKit | null;
    setSelectedFile: (file: FileItemKit | null) => void;
    downloadFile: (base64Data: string, customFileName: string, contentType?: string) => Promise<void>;
    handleUpdateFileTipoExport: (fileToUpdate: { nome: string; tipoExport: string }) => void;
    handleRemoveFile: (expectedFileName: string) => void;
    mutationEliminaFile: UseMutationResult<any, Error, string, unknown>;
    onShowHistory: (file: FileItemKit) => void;
}

interface FilesGridProps extends FileCardPassthroughProps {
    getFilesToDisplay: () => FileItemKit[];
    lavorazione: LavorazioneType;
    getUploadedFile: (expectedFileName: string) => FileUpload | undefined;
}

const FilesGrid = ({ getFilesToDisplay, lavorazione, getUploadedFile, ...fileCardProps }: FilesGridProps) => {
    const filesToDisplay = getFilesToDisplay();

    if (!lavorazione?.files?.length) {
        return (
            <div className="flex-grow bg-slate-50 rounded-md p-6 text-center border border-dashed border-slate-200 flex flex-col items-center justify-center">
                <Lucide icon="FileX" className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600 mt-4">
                    Nessun file disponibile
                </p>
            </div>
        );
    }

    if (!filesToDisplay?.length) {
        return (
            <div className="flex-grow bg-slate-50 rounded-md p-6 text-center border border-dashed border-slate-200 flex flex-col items-center justify-center">
                <Lucide icon="Search" className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-medium text-slate-600 mt-4">
                    Nessun risultato trovato
                </p>
                <p className="text-xs text-slate-400 mt-2">
                    Prova a modificare i criteri di ricerca
                </p>
            </div>
        );
    }

    const renderedCards = filesToDisplay
        .map((fileInfo, idx) => {
            const isPending = getUploadedFile(fileInfo.nome) !== undefined && !fileInfo.id_olimpo_cloud;
            if (fileInfo.id_olimpo_cloud !== undefined) {
                return (
                    <FileCard
                        key={fileInfo.id || idx}
                        fileInfo={fileInfo}
                        isPending={isPending}
                        lavorazione={lavorazione}
                        {...fileCardProps}
                    />
                );
            }
            return null;
        })
        .filter(Boolean);

    if (renderedCards.length > 0) {
        return (
            <div className="border rounded-md bg-white divide-y divide-slate-100 overflow-hidden">
                {renderedCards}
            </div>
        );
    }
    
    return null;
};

export default FilesGrid; 