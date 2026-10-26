import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from '@/components/Base/Button';
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
        <div className="space-y-6">
            <div className="p-4 bg-primary/10 rounded-lg shadow">
                <p className="text-gray-800 dark:text-white">
                    In questa sezione puoi aggiungere manualmente i file. Clicca sul bottone
                    <span className="font-bold mx-1">"Aggiungi file"</span> per creare un nuovo file.
                    Potrai poi modificare il nome e inserire eventuali direttive.
                </p>
            </div>

            <div className="flex justify-end">
                <Button variant="outline-primary" onClick={handleAddFile}>
                    <Lucide icon="Plus" className="w-4 h-4 mr-1" />
                    Aggiungi file
                </Button>
            </div>

            <Table sm bordered className="w-full border bg-slate-50 dark:bg-darkmode-700">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th className='w-1/3'>Nome File</Table.Th>
                        <Table.Th className='w-2/3'>Direttive</Table.Th>
                        <Table.Th>Azioni</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                {files.length === 0 ? (
                    <Table.Tr>
                        <Table.Td colSpan={3} className='text-center'>
                            Nessun file aggiunto.
                        </Table.Td>
                    </Table.Tr>
                    ) : (
                        files.map((file, index) => (
                            <Table.Tr key={index}>
                                <Table.Td>
                                    <FormInput
                                            value={file.nome}
                                            onChange={(e) =>
                                                handleFileNameChange(index, e.target.value)
                                            }
                                            placeholder="Inserisci il nome del file"
                                        />
                                </Table.Td>
                                <Table.Td>
                                <FormTextarea
                                    className="w-full p-2"
                                    placeholder="Inserisci direttive per questo file"
                                    value={file.direttive}
                                    onChange={(e) => handleDirectiveChange(index, e.target.value)}
                                />
                                </Table.Td>
                                <Table.Td className='text-center'>
                                <Button
                                            variant="outline-danger"
                                            size="sm"
                                            onClick={() => handleDeleteFile(index)}
                                        >
                                            <Lucide icon="Trash2" className="w-4 h-4" />
                                        </Button>
                                </Table.Td>
                            </Table.Tr>
                        ))
                    )}
                </Table.Tbody>
            </Table>
        </div>
    );
};

export default FileManagement;