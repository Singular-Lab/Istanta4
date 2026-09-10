import React, { useState, useRef } from 'react';
import { FileItemKit, TipiDiExportAttributes } from '../../../../lib/types';
import { FileUpload, LavorazioneType } from '../types';
import Lucide from '@/components/Base/Lucide';
import Button from '@/components/Base/Button';
import Badge from '@/components/Base/Badge';
import { FormSelect } from '@/components/Base/Form';
import clsx from 'clsx';

interface FileUploaderProps {
    managedFiles: FileItemKit[];
    uploads: FileUpload[];
    handleAddFile: (file: File, expectedFileName: string, direttive: string, tipoExportValue: string) => void;
    lavorazione: LavorazioneType;
}

const FileUploader = ({ managedFiles, uploads, handleAddFile, lavorazione }: FileUploaderProps) => {
    const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
    const [exportTypes, setExportTypes] = useState<{ [key: string]: string }>({});
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    const filesToUpload = managedFiles.filter(
        (file: FileItemKit) => !file.id_olimpo_cloud && !uploads.some((u: FileUpload) => u.expectedFileName === file.nome)
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, expectedFileName: string) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        setSelectedFiles(prev => ({ ...prev, [expectedFileName]: file }));
    };

    const handleRemoveSelectedFile = (expectedFileName: string) => {
        setSelectedFiles(prev => {
            const newState = { ...prev };
            delete newState[expectedFileName];
            return newState;
        });
        if (fileInputRefs.current[expectedFileName]) {
            fileInputRefs.current[expectedFileName]!.value = "";
        }
    };

    const handleExportTypeChange = (expectedFileName: string, exportTypeId: string) => {
        setExportTypes(prev => ({ ...prev, [expectedFileName]: exportTypeId }));
    };

    const handleAddAllSelectedFiles = () => {
        Object.entries(selectedFiles).forEach(([fileName, file]) => {
            const fileInfo = managedFiles.find((f: FileItemKit) => f.nome === fileName);
            if (fileInfo) {
                const defaultExportId = lavorazione.tipiExport?.[0]?.id_tipiexport;
                const exportType = exportTypes[fileName] || (lavorazione.tipiExport?.length === 1 && defaultExportId ? defaultExportId : '');
                handleAddFile(file, fileName, fileInfo.direttive, exportType);
            }
        });
        setSelectedFiles({});
        setExportTypes({});
        Object.values(fileInputRefs.current).forEach(input => {
            if (input) input.value = "";
        });
    };

    if (filesToUpload.length === 0) {
        return null;
    }

    return (
        <div className="mb-6">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                 <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                            <Lucide icon="Upload" className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-800">Carica i file richiesti</h3>
                            <p className="text-sm text-slate-600 mt-0.5">
                                Allega i file uno per uno come richiesto dal sistema.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="p-4 sm:p-6 space-y-4">
                    {filesToUpload.map((fileInfo: FileItemKit) => {
                        const expectedFileName = fileInfo.nome;
                        const selectedFile = selectedFiles[expectedFileName];
                        const hasExportTypes = lavorazione.tipiExport?.length > 1;

                        return (
                            <div key={expectedFileName} className={clsx("bg-slate-50/80 rounded-lg p-4 border transition-colors", { 'border-primary/50 bg-primary/5': selectedFile, 'border-slate-200/80': !selectedFile })}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                    <div className="flex-1 mb-4 md:mb-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-slate-800">{expectedFileName}</h4>
                                            <Badge variant={fileInfo.isOptional ? "warning" : "primary"} size="sm">{fileInfo.isOptional ? 'Opzionale' : 'Obbligatorio'}</Badge>
                                        </div>
                                        {fileInfo.direttive && <p className="text-xs text-slate-500 mt-1">{fileInfo.direttive}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {hasExportTypes && (
                                            <FormSelect
                                                formSelectSize="sm"
                                                className="w-40"
                                                value={exportTypes[expectedFileName] || ''}
                                                onChange={(e) => handleExportTypeChange(expectedFileName, e.target.value)}
                                                disabled={!selectedFile}
                                            >
                                                <option value="">Tipo export...</option>
                                                {lavorazione.tipiExport.map((tipo: TipiDiExportAttributes) => (
                                                    <option key={tipo.id_tipiexport} value={tipo.id_tipiexport}>{tipo.nome_tipiexport}</option>
                                                ))}
                                            </FormSelect>
                                        )}
                                        <label className="inline-flex items-center justify-center rounded-md border border-primary bg-transparent px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer">
                                            <Lucide icon="Paperclip" className="w-4 h-4 mr-2" />
                                            {selectedFile ? 'Cambia File' : 'Allega File'}
                                            <input
                                                type="file"
                                                className="sr-only"
                                                ref={(el) => { fileInputRefs.current[expectedFileName] = el; }}
                                                onChange={(e) => handleFileChange(e, expectedFileName)}
                                            />
                                        </label>
                                    </div>
                                </div>
                                {selectedFile && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <div className="flex items-center justify-between bg-primary/5 p-2 rounded-md">
                                            <div className="flex items-center gap-3">
                                                <Lucide icon="FileCheck2" className="w-4 h-4 text-primary" />
                                                <div className="text-sm">
                                                    <span className="font-medium text-primary">{selectedFile.name}</span>
                                                    <span className="text-slate-500 ml-2">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                                                </div>
                                            </div>
                                            <Button variant="soft-danger" size="sm" className="p-1 h-auto" onClick={() => handleRemoveSelectedFile(expectedFileName)}>
                                                <Lucide icon="X" className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {Object.keys(selectedFiles).length > 0 && (
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                <span className="font-medium">{Object.keys(selectedFiles).length}</span> file pronti per essere aggiunti.
                            </div>
                            <Button variant="primary" onClick={handleAddAllSelectedFiles}>
                                <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                                Aggiungi alla Coda di Caricamento
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUploader; 