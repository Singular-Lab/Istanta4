import React, { useEffect, useRef } from 'react';
import { useFieldArray, Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import Button from '@/components/Base/Button';
import FormInput from '@/components/Base/Form/FormInput';
import Lucide from '@/components/Base/Lucide';
import { Tab } from '@/components/Base/Headless';

interface SchemiFormProps {
    control: Control<any>;
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    retriviedDataFiltriContesto: any;
    dataSchemi: {
        titolo: string;
        ficoContextFields: {
            nome_field: string;
            valore: {
                titolo: string;
                valore: string;
            }[];
        }[];
    }[];
    namePrefix: string;
}

const SchemiForm = ({
    control,
    register,
    errors,
    dataSchemi,
    retriviedDataFiltriContesto,
    namePrefix,
}: SchemiFormProps) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: namePrefix,
    });

    useEffect(() => {
        if (retriviedDataFiltriContesto.length > 0) {
            retriviedDataFiltriContesto.forEach((schema: any) => {
                append(schema);
            });
        }
    }, [dataSchemi]);

    const refCondizioni = useRef<any>(null);

    return (
        <div className="space-y-6">
            <Tab.Group>
                <div className="flex flex-col sm:flex-row sm:items-center gap-y-3">
                    <Tab.List className="flex flex-col sm:flex-row sm:w-auto mr-auto bg-white box rounded-[0.6rem] border-slate-200">
                        {fields.map((field, index) => (
                            <Tab key={index}>
                                <Tab.Button
                                    type="button"
                                    className="w-full sm:w-auto py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                    as="button"
                                >
                                    {`Schema ${index + 1}`}
                                </Tab.Button>
                            </Tab>
                        ))}
                    </Tab.List>
                </div>
                <Tab.Panels className="mt-2">
                    {fields.map((schema: any, schemaIndex) => (
                        <Tab.Panel
                            key={schema.id}
                            className="bg-white p-3 rounded-md border"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <FormInput
                                    {...register(`${namePrefix}.${schemaIndex}.titolo`, {
                                        required: 'Il titolo dello schema è obbligatorio',
                                    })}
                                    placeholder="Titolo Schema"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 bg-white"
                                />
                                <Button
                                    variant="soft-danger"
                                    className="ml-4 p-2"
                                    onClick={() => remove(schemaIndex)}
                                >
                                    Elimina Schema
                                    <Lucide icon="Trash2" className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="space-y-4">
                                {schema.ficoContextFields.map((field : any, fieldIndex : number) => (
                                    <div key={fieldIndex} className="flex flex-col sm:flex-row justify-between items-center mb-4">
                                        <FormInput
                                            {...register(`${namePrefix}.${schemaIndex}.ficoContextFields.${fieldIndex}.nome_field`, {
                                                required: 'Il nome del campo è obbligatorio',
                                            })}
                                            placeholder="Nome Campo"
                                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400 bg-white"
                                        />
                                        <Button
                                            variant="soft-danger"
                                            className="ml-4 p-2"
                                            onClick={() => remove(fieldIndex)}
                                        >
                                            Elimina Campo
                                            <Lucide icon="Trash2" className="w-5 h-5" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="soft-primary"
                                    onClick={() =>
                                        append({
                                            nome_field: '',
                                            valore: [{ titolo: '', valore: '' }],
                                        })
                                    }
                                    className="mt-4"
                                >
                                    <Lucide icon="Plus" className="w-5 h-5 mr-1" />
                                    Aggiungi Campo
                                </Button>
                            </div>
                        </Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>
            <Button
                type="button"
                variant="soft-primary"
                onClick={() =>
                    append({
                        titolo: '',
                        ficoContextFields: [{ nome_field: '', valore: [{ titolo: '', valore: '' }] }],
                    })
                }
                className="ml-2"
            >
                <Lucide icon="Plus" className="w-5 h-5 mr-1" />
                Aggiungi Schema
            </Button>
        </div>
    );
};

export default SchemiForm;