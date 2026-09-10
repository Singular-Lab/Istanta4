import { ClassicEditor } from "@/components/Base/Ckeditor";
import React, { FC, Fragment, useEffect, useState } from "react";
import { ContenutoAggiuntivoReferenza, ReferenzeIstanta } from "../../../../lib/types";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/Base/Button";
import { FormInline, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ServerCall } from "../../../../lib/server_call";
import { Disclosure } from "@/components/Base/Headless";
import { v4 as uuidv4 } from 'uuid';
import { useFetchConfig } from "@/query/query";

interface TabContenutiAggiuntiviProps {
    referenza: ReferenzeIstanta | undefined;
}

const TabContenutiAggiuntivi: FC<TabContenutiAggiuntiviProps> = ({ referenza }) => {
    const [contenutoAggiuntivoReferenza, setContenutoAggiuntivoReferenza] = useState<Array<ContenutoAggiuntivoReferenza>>([]);
    const config = useFetchConfig();
    // Fetch existing additional contents
    const { data: initialContents, isLoading, error } = useQuery({
        queryKey: ['contenutiAggiuntivi', referenza?.id],
        queryFn: async () => {
            if (!referenza?.id) return [];
            const response = await ServerCall.put<ContenutoAggiuntivoReferenza[]>(`/getContenutiAggiuntiviReferenza`,referenza);
            return response || [];
        },
        enabled: !!referenza?.id
    });

    // Mutation for saving additional contents
    const saveMutation = useMutation({
        mutationFn: (data: ContenutoAggiuntivoReferenza[]) => {
            if (!data || data.length === 0) {
                return Promise.reject('Nessun contenuto da salvare');
            }
            return ServerCall.post(`/creaContenutiAggiuntiviReferenza`, data);
        },
        onSuccess: () => {
            // Optionally handle success (e.g., show a toast notification)
        },
        onError: (error) => {
            console.error('Errore nel salvataggio:', error);
            // Optionally handle error (e.g., show error message)
        }
    });

    // Update state when initial data is loaded
    useEffect(() => {
        if (initialContents) {
            setContenutoAggiuntivoReferenza(initialContents);
        }
    }, [initialContents]);

    // Helper function to create a new additional content
    const createNewContenutoAggiuntivo = () => ({
        guidId: uuidv4(),
        guidIdReferenza: referenza?.id || '',
        contenuto: {
            descrizione: ''
        },
        regole: [
            {
                field: 'codice_referenza',
                operator: 'equal' as const,
                value: String(referenza?.dataFields?.codice_referenza || '')
            }
        ]
    });

    // Handler for adding a new additional content
    const handleAddContenutoAggiuntivo = () => {
        setContenutoAggiuntivoReferenza(prev => [...prev, createNewContenutoAggiuntivo()]);
    };

    // Handler for updating content description
    const handleContentDescriptionChange = (guidId: string, newDescription: string) => {
        setContenutoAggiuntivoReferenza(prev =>
            prev.map(item =>
                item.guidId === guidId
                    ? { ...item, contenuto: { descrizione: newDescription } }
                    : item
            )
        );
    };

    // Handler for adding a new rule to a specific additional content
    const handleAddRegola = (guidId: string) => {
        setContenutoAggiuntivoReferenza(prev =>
            prev.map(item =>
                item.guidId === guidId
                    ? {
                        ...item,
                        regole: [
                            ...item.regole,
                            { field: '', operator: "equal", value: '' }
                        ]
                    }
                    : item
            )
        );
    };

    // Handler for updating a specific rule
    const handleUpdateRegola = (guidId: string, ruleIndex: number, field: keyof ContenutoAggiuntivoReferenza['regole'][number], value: string) => {
        setContenutoAggiuntivoReferenza(prev =>
            prev.map(item =>
                item.guidId === guidId
                    ? {
                        ...item,
                        regole: item.regole.map((rule, index) =>
                            index === ruleIndex
                                ? { ...rule, [field]: value }
                                : rule
                        )
                    }
                    : item
            )
        );
    };

    // Handler for removing a rule
    const handleRemoveRegola = (guidId: string, ruleIndex: number) => {
        setContenutoAggiuntivoReferenza(prev =>
            prev.map(item =>
                item.guidId === guidId
                    ? {
                        ...item,
                        regole: item.regole.filter((_, index) => index !== ruleIndex)
                    }
                    : item
            )
        );
    };

    // Render loading state
    if (isLoading) return <div>Caricamento...</div>;

    // Render error state
    if (error) return <div>Errore nel caricamento dei contenuti</div>;

    return (
        <Fragment>
            <h3 className="text-lg font-medium text-gray-900">Contenuti Aggiuntivi</h3>

            {contenutoAggiuntivoReferenza.length === 0 && (
                <EmptyState
                    title="Nessun contenuto aggiuntivo"
                    description="Non sono presenti contenuti aggiuntivi per questa referenza"
                    icon="X"
                    buttonText='Aggiungi contenuto aggiuntivo'
                    onButtonClick={handleAddContenutoAggiuntivo}
                />
            )}

            <Disclosure.Group variant="boxed" as="div" className="mt-6">
                {contenutoAggiuntivoReferenza.map((contenuto, index) => (
                    <Disclosure key={index}>
                        <Disclosure.Button actions={
                            <Fragment>
                                <Button
                                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setContenutoAggiuntivoReferenza(prev => prev.filter(item => item.guidId !== contenuto.guidId));

                                    }}
                                    variant="soft-danger"
                                    size='sm'
                                >
                                    <Lucide icon='X' />
                                </Button>
                            </Fragment>}>
                            Regola {index + 1}
                        </Disclosure.Button>
                        <Disclosure.Panel>
                            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <ClassicEditor
                                        disabled={false}
                                        value={contenuto.contenuto.descrizione || ""}
                                        className="mb-4"
                                        onChange={(newDescription) => {
                                            handleContentDescriptionChange(contenuto.guidId, newDescription)
                                        }}
                                    />
        
                                    <React.Fragment>
                                        {contenuto.regole.length === 0 ? (
                                            <EmptyState
                                                title="Nessuna regola"
                                                description="Non sono presenti regole per questo contenuto aggiuntivo"
                                                icon="X"
                                                buttonText='Aggiungi regola'
                                                onButtonClick={() => handleAddRegola(contenuto.guidId)}
                                            />
                                        ) : (
                                            <div className="border overflow-hidden sm:rounded-md">
                                                <div className='p-4'>
                                                    <Button
                                                        onClick={() => handleAddRegola(contenuto.guidId)}
                                                        variant="soft-primary"
                                                        size='sm'
                                                    >
                                                        Aggiungi regola
                                                    </Button>
                                                </div>
                                                <ul className="w-full divide-y divide-gray-200">
                                                    {contenuto.regole.map((regola, ruleIndex) => (
                                                        <li key={ruleIndex} className="px-4 py-4 sm:px-6">
                                                            <FormLabel>Regola {ruleIndex + 1}</FormLabel>
                                                            <FormInline className='gap-2'>
                                                                <FormSelect

                                                                    value={regola.field}
                                                                    onChange={(e) =>
                                                                        handleUpdateRegola(
                                                                            contenuto.guidId,
                                                                            ruleIndex,
                                                                            'field',
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                >
                                                                    <option value=''>Seleziona campo</option>
                                                                    {config?.data?.webpliant?.data_fields_refs?.map((field: { expected_output: string }) => (
                                                                        <option key={field.expected_output} value={field.expected_output}>{field.expected_output}</option>
                                                                    ))}
                                                                </FormSelect>
                                                                <FormSelect
                                                                    value={regola.operator}
                                                                    onChange={(e) =>
                                                                        handleUpdateRegola(
                                                                            contenuto.guidId,
                                                                            ruleIndex,
                                                                            'operator',
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                >
                                                                    <option value=''>Seleziona operatore</option>
                                                                    <option value='equal'>Uguale a</option>
                                                                    <option value='not-equal'>Diverso da</option>
                                                                    <option value='greater-than'>Maggiore di</option>
                                                                    <option value='less-than'>Minore di</option>
                                                                </FormSelect>
                                                                <FormInput
                                                                    placeholder='Value'
                                                                    value={regola.value}
                                                                    onChange={(e) =>
                                                                        handleUpdateRegola(
                                                                            contenuto.guidId,
                                                                            ruleIndex,
                                                                            'value',
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                                <Button
                                                                    onClick={() =>
                                                                        handleRemoveRegola(
                                                                            contenuto.guidId,
                                                                            ruleIndex
                                                                        )
                                                                    }
                                                                    variant="soft-danger"
                                                                    size='sm'
                                                                >
                                                                    <Lucide icon='X' />
                                                                </Button>
                                                            </FormInline>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className='mt-4 flex justify-end'>
                                            <Button
                                                onClick={() => saveMutation.mutate(contenutoAggiuntivoReferenza)}
                                                variant="primary"
                                                disabled={saveMutation.isPending}
                                            >
                                                {saveMutation.isPending ? 'Salvataggio...' : 'Salva'}
                                                <Lucide icon='Save' />
                                            </Button>
                                        </div>
                                    </React.Fragment>
                                </div>
                            </div>
                        </Disclosure.Panel>
                    </Disclosure>
                ))}
            </Disclosure.Group>

            {contenutoAggiuntivoReferenza.length > 0 && (
                <div className="mt-6">
                    <Button
                        onClick={handleAddContenutoAggiuntivo}
                        variant="primary"
                    >
                        Aggiungi contenuto aggiuntivo
                    </Button>
                </div>
            )}
        </Fragment>
    );
};

export default TabContenutiAggiuntivi;