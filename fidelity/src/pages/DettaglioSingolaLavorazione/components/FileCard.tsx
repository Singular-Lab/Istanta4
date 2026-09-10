import React from 'react';
import { FileItemKit, FileItemKitLog, TipiDiExportAttributes } from '../../../../lib/types';
import { LavorazioneType } from '../types';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import Badge from '@/components/Base/Badge';
import { FormSelect } from '@/components/Base/Form';
import { UseMutationResult } from '@tanstack/react-query';
import { PreviewImmaginePdf } from '@/components/PreviewImmaginePdf';

interface FileCardProps {
    fileInfo: FileItemKit | any;
    isPending?: boolean;
    selectedFile: FileItemKit | null;
    setSelectedFile: (file: FileItemKit | null) => void;
    downloadFile: (base64Data: string, customFileName: string, contentType?: string) => Promise<void>;
    handleUpdateFileTipoExport: (fileToUpdate: { nome: string; tipoExport: string }) => void;
    handleRemoveFile: (expectedFileName: string) => void;
    mutationEliminaFile: UseMutationResult<any, Error, string, unknown>;
    lavorazione: LavorazioneType;
        onShowHistory: (file: FileItemKit) => void;
}

const FileCard = ({
    fileInfo,
    isPending = false,
    selectedFile,
    setSelectedFile,
    downloadFile,
    handleUpdateFileTipoExport,
    handleRemoveFile,
    mutationEliminaFile,
    lavorazione,
    onShowHistory
}: FileCardProps) => {
    const isServerFile = fileInfo.id_olimpo_cloud !== undefined;
    const fileType = (() => {
        const extension = fileInfo.nome.split('.').pop()?.toLowerCase();
        if (!extension) return "File";
        if (["pdf"].includes(extension)) return "FileText";
        if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension)) return "Image";
        if (["doc", "docx"].includes(extension)) return "FileText";
        if (["xls", "xlsx"].includes(extension)) return "FileSpreadsheet";
        if (["zip", "rar", "7z"].includes(extension)) return "Package";
        return "File";
    })();

    const latestVersion = fileInfo.logs && fileInfo.logs.length > 0
        ? Math.max(...fileInfo.logs.map((l: any) => l.versione))
        : null;

    return (
        <>
            {selectedFile?.id === fileInfo.id && (
                <PreviewImmaginePdf
                    imageUrl={selectedFile?.url || ''}
                    onClose={() => setSelectedFile(null)}
                    totalPages={selectedFile?.pages || 0}
                />
            )}
            <div className="flex items-center p-3 border-b border-slate-100 hover:bg-slate-50">
                <div className="flex items-center flex-1">
                    <div className="mr-4 bg-slate-100 p-2 rounded-md">
                        <Lucide icon={fileType} className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm text-slate-700">{fileInfo.nome}</span>
                        {fileInfo.direttive && (
                            <span className="text-xs text-slate-500 mt-1">{fileInfo.direttive}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                    {latestVersion && (
                        <Badge variant="secondary" className="px-2 py-1 text-xs">
                            v{latestVersion}
                        </Badge>
                    )}
                    {fileInfo.tipo_export && (
                        <Badge variant="primary" className="px-2 py-1">
                            {lavorazione.tipiExport?.find((t: TipiDiExportAttributes) => t.id_tipiexport === fileInfo.tipo_export)?.nome_tipiexport || fileInfo.tipo_export}
                        </Badge>
                    )}

                    {!isServerFile && lavorazione.tipiExport?.length > 0 && (
                        <FormSelect
                            formSelectSize="sm"
                            className="w-28 text-xs border-slate-200"
                            value={fileInfo.tipo_export || ''}
                            onChange={(e) => {
                                handleUpdateFileTipoExport({
                                    nome: fileInfo.nome,
                                    tipoExport: e.target.value
                                });
                            }}
                        >
                            <option value="">Tipo export</option>
                            {lavorazione.tipiExport?.map((tipoExport: TipiDiExportAttributes) => (
                                <option key={tipoExport?.id_tipiexport} value={tipoExport?.id_tipiexport}>
                                    {tipoExport?.nome_tipiexport}
                                </option>
                            ))}
                        </FormSelect>
                    )}
                    {isServerFile && fileInfo.blob && (
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="p-1.5"
                            onClick={() => downloadFile(fileInfo.blob, fileInfo.nome)}
                        >
                            <Lucide icon="Download" className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">Download</span>
                        </Button>
                    )}
                    {isServerFile && fileInfo.url && (
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="p-1.5"
                            onClick={() => setSelectedFile(fileInfo)}
                        >
                            <Lucide icon="Eye" className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">Visualizza</span>
                        </Button>
                    )}

                    {fileInfo.logs && fileInfo.logs.length > 0 && isServerFile && (
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            className="p-1.5"
                            onClick={() => onShowHistory(fileInfo)}
                            aria-label="Mostra storico versioni"
                        >
                            <Lucide icon="History" className="w-3.5 h-3.5" />
                        </Button>
                    )}

                    {!isServerFile ? (
                        <Button
                            variant="outline-danger"
                            size="sm"
                            className="p-1.5"
                            onClick={() => handleRemoveFile(fileInfo.nome)}
                        >
                            <Lucide icon="Trash2" className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">Rimuovi</span>
                        </Button>
                    ) : (
                        <Button
                            variant="outline-danger"
                            size="sm"
                            className="p-1.5"
                            onClick={() => mutationEliminaFile.mutate(fileInfo.id)}
                        >
                            <Lucide icon="Trash2" className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">{mutationEliminaFile.isPending ? 'Elimina...' : 'Elimina'}</span>
                        </Button>
                    )}

                </div>
            </div>
        </>
    );
};

export default FileCard; 