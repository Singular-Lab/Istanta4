import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import EmptyState from '@/components/EmptyState';
import FormInput from '@/components/Base/Form/FormInput';
import FormTextarea from '@/components/Base/Form/FormTextarea';
import { FileItemKit } from '../../../lib/types';
import Lucide from '../Base/Lucide';
import Table from '../Base/Table';

interface FileManagementProps {
    files: FileItemKit[];
    setFiles: React.Dispatch<React.SetStateAction<FileItemKit[]>>;
    setNameToPreview: React.Dispatch<React.SetStateAction<string[]>>;
}

const FileManagement: React.FC<FileManagementProps> = ({ files, setFiles, setNameToPreview }) => {
    
    const handleAddFile = () => {
        const defaultFileName = `file-${files.length + 1}.pdf`;
        const newFile: FileItemKit = {
            id: uuidv4(),
            nome: defaultFileName,
            direttive: "",
            isOptional: false,
            nome_originale: defaultFileName,
            id_runtime: '',
            tipo_export: '',
            tipo_export_codice: '',
            meta_olimpo_cloud: {}
        };
        setFiles((prev) => [...prev, newFile]);
        setNameToPreview((prev) => [...prev, defaultFileName]);
    };

    const handleFileNameChange = (index: number, fileName: string) => {
        setFiles((prev) =>
            prev.map((file, i) => (i === index ? { ...file, nome: fileName } : file))
        );
        setNameToPreview((prev) =>
            prev.map((name, i) => (i === index ? fileName : name))
        );
    };

    const handleDirectiveChange = (index: number, directive: string) => {
        setFiles((prev) =>
            prev.map((file, i) =>
                i === index ? { ...file, direttive: directive } : file
            )
        );
    };

    const handleDeleteFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setNameToPreview((prev) => prev.filter((_, i) => i !== index));
    };


    return (
        <div className="flex flex-col gap-4">
            <Alert variant="soft-primary" icona="Info">
                In questa sezione puoi aggiungere manualmente i file. Clicca sul bottone
                <span className="mx-1 font-semibold">&quot;Aggiungi file&quot;</span> per creare un nuovo file.
                Potrai poi modificare il nome e inserire eventuali direttive.
            </Alert>

            <div className="flex justify-end">
                <Button variant="outline-secondary" size="sm" onClick={handleAddFile}>
                    <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Aggiungi file
                </Button>
            </div>

            <div className="overflow-x-auto rounded-card border border-slate-200">
                <Table sm>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th className="w-1/3">Nome file</Table.Th>
                            <Table.Th className="w-2/3">Direttive</Table.Th>
                            <Table.Th className="text-right">
                                <span className="sr-only">Azioni</span>
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {files.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={3} className="p-0">
                                    <EmptyState
                                        compatta
                                        icon="FilePlus"
                                        title="Nessun file aggiunto"
                                        description="Aggiungi i file attesi dal kit con il pulsante Aggiungi file."
                                    />
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            files.map((file, index) => (
                                <Table.Tr key={index}>
                                    <Table.Td>
                                        <FormInput
                                            aria-label={`Nome del file ${index + 1}`}
                                            value={file.nome}
                                            onChange={(e) => handleFileNameChange(index, e.target.value)}
                                            placeholder="Inserisci il nome del file"
                                        />
                                    </Table.Td>
                                    <Table.Td>
                                        <FormTextarea
                                            aria-label={`Direttive del file ${index + 1}`}
                                            className="w-full p-2"
                                            placeholder="Inserisci direttive per questo file"
                                            value={file.direttive}
                                            onChange={(e) => handleDirectiveChange(index, e.target.value)}
                                        />
                                    </Table.Td>
                                    <Table.Td className="text-right">
                                        <Button
                                            variant="outline-danger"
                                            size="sm"
                                            onClick={() => handleDeleteFile(index)}
                                            aria-label={`Rimuovi ${file.nome}`}
                                        >
                                            <Lucide aria-hidden="true" icon="Trash2" className="h-3.5 w-3.5" />
                                        </Button>
                                    </Table.Td>
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </div>
        </div>
    );
};

export default FileManagement;