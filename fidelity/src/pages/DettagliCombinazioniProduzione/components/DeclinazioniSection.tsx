import Button from '@/components/Base/Button';
import { FormInput, FormLabel } from '@/components/Base/Form';
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import ProprietaForm from '@/components/Base/FormFiltriDesign/ProprietaForm';
import { Disclosure } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import EmptyState from '@/components/EmptyState';
import { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';

interface DeclinazioniSectionProps<T extends FieldValues> {
    fields: Array<Record<"id", string> & any>;
    append: (value: any) => void;
    remove: (index: number) => void;
    control: Control<T>;
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    dataDeclinazioni: any;
    dataAddestramenti: any[];
    handleRemoveDeclinazione: (index: number) => void;
}

const DeclinazioniSection = <T extends FieldValues>({
    fields,
    append,
    remove,
    control: controlForm,
    register,
    errors,
    dataDeclinazioni,
    dataAddestramenti,
    handleRemoveDeclinazione,
}: DeclinazioniSectionProps<T>) => {
    // react-hook-form: Control<T> non e' assegnabile a Control<any>; i campi usano percorsi dinamici, quindi qui il form e' non tipizzato
    const control = controlForm as Control<any>;
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                    {fields.length === 0
                        ? 'Nessuna declinazione presente'
                        : `${fields.length} ${fields.length === 1 ? 'declinazione' : 'declinazioni'}`}
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline-secondary"
                    onClick={() =>
                        append({
                            titolo: '',
                            proprieta: [{ idChiave: 0, valore: '' }],
                            filtri: [],
                        })
                    }
                >
                    <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Aggiungi declinazione
                </Button>
            </div>

            {/* Empty State */}
            {fields.length === 0 && (
                <EmptyState
                    compatta
                    icon="FileX"
                    title="Nessuna declinazione presente"
                    description='Usa "Aggiungi declinazione" per iniziare.'
                    className="border border-dashed border-slate-200"
                />
            )}

            {/* Declinazioni List */}
            {fields.map((field, index) => (
                <div key={field.id} className="overflow-hidden rounded-card border border-slate-200 bg-white">
                    {/* Intestazione della singola declinazione */}
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-control bg-slate-100 text-slate-600">
                                <Lucide icon="FileText" className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <h3 className="title-card">Declinazione {index + 1}</h3>
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
                            aria-label="Rimuovi declinazione"
                        >
                            <Lucide aria-hidden="true" icon="Trash2" className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Contenuto */}
                    <div className="p-5 space-y-5">
                        {/* Titolo Declinazione */}
                        <div>
                            <FormLabel htmlFor={`titolo-declinazione-${index}`}>
                                Titolo della declinazione
                            </FormLabel>
                            <FormInput
                                id={`titolo-declinazione-${index}`}
                                {...register(`declinazioni.${index}.titolo`, {
                                    required: 'Il titolo della declinazione è obbligatorio',
                                })}
                                placeholder="Es. 'Banner per Social Media'"
                            />
                            {(errors as any).declinazioni?.[index]?.titolo?.message && (
                                <p className="mt-1.5 text-xs text-danger">
                                    {(errors as any).declinazioni[index]?.titolo?.message}
                                </p>
                            )}
                        </div>

                        {/* Disclosure Groups per Proprietà e Filtri */}
                        <Disclosure.Group as="div" selectedIndex={0} variant="boxed" className="space-y-3">
                            <Disclosure defaultOpen={false}>
                                <Disclosure.Button>
                                    <div className="flex items-center gap-2">
                                        <Lucide icon="Settings" aria-hidden="true" className="w-4 h-4" />
                                        <span className="font-medium">Proprietà</span>
                                    </div>
                                </Disclosure.Button>
                                <Disclosure.Panel className="p-4 bg-slate-50">
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
                                        <Lucide icon="Filter" aria-hidden="true" className="w-4 h-4" />
                                        <span className="font-medium">Filtri</span>
                                    </div>
                                </Disclosure.Button>
                                <Disclosure.Panel className="p-4 bg-slate-50">
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
