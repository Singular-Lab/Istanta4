import React from 'react';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import LoadingIcon from '@/components/Base/LoadingIcon';
import { FileItemKit } from '../../../../lib/types';
import { FileUpload } from '../types';
import { UseMutationResult } from '@tanstack/react-query';

interface ActionFooterProps {
    groupedFiles: {
        pendingUpload: FileItemKit[];
    };
    mutationUploadMateriale: UseMutationResult<any, Error, { files: { id: string; nome: string; direttive: string; isOptional: boolean; file: File; tipo_export: string; }[]; }, unknown>;
    uploads: FileUpload[];
    isUpdating: boolean;
}

const ActionFooter = ({ groupedFiles, mutationUploadMateriale, uploads, isUpdating }: ActionFooterProps) => {
    const hasPendingUploads = groupedFiles.pendingUpload.length > 0;
    if (!hasPendingUploads) {
        return null;
    }
    return (
        <div className="mt-4 p-4 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center">
                <Lucide icon="CircleAlert" className="w-4 h-4 text-warning mr-2" />
                <span className="text-sm font-medium">{groupedFiles.pendingUpload.length} file in attesa di caricamento</span>
            </div>
            <Button
                variant="primary"
                size="sm"
                onClick={() =>
                    mutationUploadMateriale.mutate({
                        files: uploads.map((upload: FileUpload) => ({
                            id: upload.id,
                            nome: upload.expectedFileName,
                            direttive: upload.direttive,
                            isOptional: false,
                            file: upload.file,
                            tipo_export: upload.tipoExport,
                        })),
                    })
                }
                disabled={isUpdating}
            >
                {isUpdating ? (
                    <div className="flex items-center">
                        <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                        Caricamento...
                    </div>
                ) : (
                    <>
                        <Lucide icon="Upload" className="w-4 h-4 mr-2" />
                        Carica tutti
                    </>
                )}
            </Button>
        </div>
    );
};

export default ActionFooter; 