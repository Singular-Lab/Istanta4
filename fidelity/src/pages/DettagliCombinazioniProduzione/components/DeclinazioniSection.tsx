import Button from '@/components/Base/Button';
import { FormInput } from '@/components/Base/Form';
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import ProprietaForm from '@/components/Base/FormFiltriDesign/ProprietaForm';
import { Disclosure } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import React from 'react';
import { Control, FieldErrors, UseFormRegister } from 'react-hook-form';

interface DeclinazioniSectionProps {
    fields: Array<Record<"id", string> & any>;
    append: (value: any) => void;
    remove: (index: number) => void;
    control: Control<any>;
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    dataDeclinazioni: any;
    dataAddestramenti: any[];
    handleRemoveDeclinazione: (index: number) => void;
}

const DeclinazioniSection: React.FC<DeclinazioniSectionProps> = ({
    fields,
    append,
    remove,
    control,
    register,
    errors,
    dataDeclinazioni,
    dataAddestramenti,
    handleRemoveDeclinazione,
}) => {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                    {fields.length === 0
                        ? 'Nessuna declinazione presente'
                        : `${fields.length} declinazione${fields.length > 1 ? 'i' : ''}`}
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="soft-primary"
                    onClick={() =>
                        append({
                            titolo: '',
                            proprieta: [{ idChiave: 0, valore: '' }],
                            filtri: [],
                        })
                    }
                >
                    <Lucide icon="Plus" className="w-5 h-5 mr-1" />
                    Aggiungi Declinazione
                </Button>
            </div>

            {/* Empty State */}
            {fields.length === 0 && (
                <div className="text-center text-slate-500 py-10 border-2 border-dashed rounded-md">
                    Nessuna declinazione presente.
                    <br />
                    Clicca sul pulsante "Aggiungi Declinazione" per iniziare.
                    <Lucide icon="FileX" className="w-10 h-10 mx-auto mt-4 text-slate-400" />
                </div>
            )}

            {/* Declinazioni List */}
            {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg">
                    {/* Header della singola declinazione */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10">
                                <Lucide icon="FileText" className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-slate-800">Declinazione {index + 1}</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {field.titolo || 'Senza titolo'}
                                </div>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            type="button"
                            variant="outline-danger"
                            onClick={() => handleRemoveDeclinazione(index)}
                        >
                            <Lucide icon="Trash2" className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Contenuto */}
                    <div className="p-5 space-y-5">
                        {/* Titolo Declinazione */}
                        <div>
                            <label htmlFor={`titolo-declinazione-${index}`} className="block text-sm font-medium text-slate-700 mb-2">
                                Titolo Declinazione
                            </label>
                            <FormInput
                                id={`titolo-declinazione-${index}`}
                                {...register(`declinazioni.${index}.titolo`, {
                                    required: 'Il titolo della declinazione è obbligatorio',
                                })}
                                placeholder="Es. 'Banner per Social Media'"
                            />
                            {(errors as any).declinazioni?.[index]?.titolo?.message && (
                                <span className="text-danger text-sm mt-1 block">
                                    {(errors as any).declinazioni[index]?.titolo?.message}
                                </span>
                            )}
                        </div>

                        {/* Disclosure Groups per Proprietà e Filtri */}
                        <Disclosure.Group as="div" selectedIndex={0} variant="boxed" className="space-y-3">
                            <Disclosure defaultOpen={false}>
                                <Disclosure.Button>
                                    <div className="flex items-center gap-2">
                                        <Lucide icon="Settings" className="w-4 h-4" />
                                        <span className="font-medium">Proprietà</span>
                                    </div>
                                </Disclosure.Button>
                                <Disclosure.Panel className="p-4 bg-slate-50/50">
                                    <ProprietaForm
                                        data={dataDeclinazioni?.data}
                                        control={control}
                                        register={register}
                                        errors={errors}
                                        declinazioneIndex={index}
                                    />
                                </Disclosure.Panel>
                            </Disclosure>

                            <Disclosure defaultOpen={false}>
                                <Disclosure.Button>
                                    <div className="flex items-center gap-2">
                                        <Lucide icon="Filter" className="w-4 h-4" />
                                        <span className="font-medium">Filtri</span>
                                    </div>
                                </Disclosure.Button>
                                <Disclosure.Panel className="p-4 bg-slate-50/50">
                                    <FilterBaseForm
                                        control={control}
                                        register={register}
                                        errors={errors}
                                        dataFiltri={field.filtri}
                                        dataAddestramenti={dataAddestramenti ?? []}
                                        declinazioneIndex={index}
                                        namePrefix={`declinazioni.${index}.filtri`}
                                    />
                                </Disclosure.Panel>
                            </Disclosure>
                        </Disclosure.Group>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DeclinazioniSection;
