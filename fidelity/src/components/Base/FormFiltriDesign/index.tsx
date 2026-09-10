import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useFieldArray, Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import Button from '@/components/Base/Button';
import FormInput from '@/components/Base/Form/FormInput';
import Lucide from '@/components/Base/Lucide';
import CondizioniBaseForm from './CondizioniFormFiltriDesign';
import { Tab } from '@/components/Base/Headless';

interface FilterFormProps {
    control: Control<any>;
    register: UseFormRegister<any>;
    errors: FieldErrors<any>;
    dataFiltri?: any;
    dataAddestramenti?: any[];
    declinazioneIndex?: number;
    namePrefix: string;
}

const FilterForm = ({
    control,
    register,
    errors,
    dataFiltri,
    dataAddestramenti,
    declinazioneIndex,
    namePrefix,
}: FilterFormProps) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: namePrefix,
    });
    const [selectedTab, setSelectedTab] = React.useState(0);

    useEffect(() => {
        if (!dataFiltri) return;
        if (fields.length === 0 && dataFiltri.length > 0) {
            // Rimuove i campi vuoti prima di aggiungere quelli nuovi
            remove();
            dataFiltri.forEach((filtro: any) => append(filtro, { shouldFocus: false }));
        }
    }, [dataFiltri, fields.length]);

    const handleAddFilter = () => {
        append({
            titoloFiltro: '',
            condizioni: [{ nome_field: '', operatore: '=', valore: '' }],
        });
        setSelectedTab(fields.length);
    }
    const handleRemoveFilter = (index:number) => {
        remove(index);
        if (selectedTab >= index) {
            setSelectedTab(Math.max(0, selectedTab - 1));
        }
    }

    return (
        <div className="space-y-6">
            {fields.length === 0 && (
                <div className="text-center text-slate-500 py-10 border-2 border-dashed rounded-md">
                    Nessun filtro presente.
                    <br />
                    Clicca sul pulsante "Aggiungi Filtro" per iniziare.
                    <Lucide icon="FilterX" className="w-10 h-10 mx-auto mt-4 text-slate-400" />
                </div>
            )}
            <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                {fields.length > 0 &&
                    <div className="flex justify-between items-center mb-4">
                        <Tab.List
                            variant="boxed-tabs"
                            className="flex-col sm:flex-row sm:w-auto mr-auto bg-white dark:bg-darkmode-600 box rounded-[0.6rem] border-slate-200"
                        >
                            {fields.map((field, index) => (
                                <Tab key={index}>
                                    <Tab.Button
                                        type="button"
                                        className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]"
                                        as="button"
                                    >
                                        {`Filtro ${index + 1}`}
                                    </Tab.Button>
                                </Tab>
                            ))}
                        </Tab.List>
                        <Button
                            size='sm'
                            disabled={fields.length === 0}
                            type="button"
                            variant="outline-danger"
                            onClick={() => handleRemoveFilter(selectedTab)}
                            className="ml-auto"
                        >
                            <Lucide icon="Trash2" className="w-5 h-5 mr-1" />
                            Rimuovi Filtro
                        </Button>
                    </div>
                }
                <Tab.Panels className="mt-2">

                    {fields.map((filtro, filtroIndex) => (
                        <Tab.Panel
                            key={filtro.id}
                            className="bg-white dark:bg-darkmode-600 p-5 rounded-md border"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col w-full md:col-span-9">
                                    <FormInput
                                        {...register(`${namePrefix}.${filtroIndex}.titoloFiltro`, {
                                            required: 'Il titolo del filtro è obbligatorio'
                                        })}
                                        placeholder="Titolo Filtro"
                                        className="w-full"
                                    />
                                    {errors && (errors[namePrefix] as any)?.[filtroIndex]?.titoloFiltro && (
                                        <span className="text-danger mt-2">
                                            {(errors[namePrefix] as any)?.[filtroIndex].titoloFiltro.message}
                                        </span>
                                    )}
                                </div>
                               
                            </div>
                            <CondizioniBaseForm
                                control={control}
                                register={register}
                                errors={errors}
                                filtroIndex={filtroIndex}
                                declinazioneIndex={declinazioneIndex}
                                namePrefix={`${namePrefix}.${filtroIndex}.condizioni`}
                                dataAddestramenti={dataAddestramenti || []}
                            />
                        </Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>
            <div className="flex justify-end mt-4 gap-x-3">
                
                <Button
                    size='sm'
                    type="button"
                    variant="soft-primary"
                    onClick={handleAddFilter}
                >
                    <Lucide icon="Plus" className="w-5 h-5 mr-1" />
                    Aggiungi Filtro
                </Button>
            </div>
        </div>
    );
};

export default FilterForm;