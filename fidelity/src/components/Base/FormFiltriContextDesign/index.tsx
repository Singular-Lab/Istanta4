import Button from '@/components/Base/Button';
import FormInput from '@/components/Base/Form/FormInput';
import { Tab } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useEffect, useRef } from 'react';
import { Control, FieldErrors, UseFormRegister, UseFormSetValue, useFieldArray } from 'react-hook-form';
import CondizioniFiltroContext from './CondizioniFiltriContextDesign';

interface ContextFilterFormProps {
    control: Control<any>;
    register: UseFormRegister<any>;
    setValue: UseFormSetValue<any>;
    errors: FieldErrors<any>;
    dataFiltri?: any;
    namePrefix: string;
    dataPerContesto?: any;
    retriviedDataFiltriContesto?: any;
}

const ContextFilterForm = ({
    control,
    register,
    setValue,
    errors,
    dataFiltri,
    namePrefix,
    dataPerContesto,
    retriviedDataFiltriContesto,
}: ContextFilterFormProps) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: namePrefix,
    });

    const refsCondizioni = useRef<Record<number, any>>({});

    useEffect(() => {
        if (retriviedDataFiltriContesto === undefined) return;
        if (retriviedDataFiltriContesto.length > 0 && fields.length === 0) {
            retriviedDataFiltriContesto.forEach((filtro: any) => {
                append(filtro);
            });
        }
    }, [retriviedDataFiltriContesto]);

    return (
        <div className="space-y-6">
            {fields.length === 0 && (
                <div className="text-center text-slate-500 py-10 border-2 border-dashed rounded-md">
                    Nessun filtro di contesto presente.
                    <br />
                    Clicca sul pulsante "Aggiungi Filtro" per iniziare.
                    <Lucide icon="FilterX" className="w-10 h-10 mx-auto mt-4 text-slate-400" />
                </div>
            )}
            <Tab.Group>
                <div className="flex sm:flex-row xs:flex-col xs:items-end 2xl:items-center gap-y-3">
                    <Tab.List
                        variant="boxed-tabs"
                        className="flex-col sm:flex-row sm:w-auto mr-auto bg-white box rounded-[0.6rem] border-slate-200"
                    >
                        {fields.map((field, index) => (
                            <Tab key={field.id}>
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
                </div>
                <Tab.Panels className="mt-2">
                    {fields.map((filtro, filtroIndex) => (
                        <Tab.Panel
                            key={filtro.id}
                            className="bg-white p-3 rounded-md border"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-full flex flex-col col-span-10 md:col-span-9">
                                    <FormInput
                                        {...register(`${namePrefix}.${filtroIndex}.titoloFiltro`)}
                                        placeholder="Titolo Filtro"
                                        className="w-full p-3"
                                    />
                                    {errors && (errors[namePrefix] as any)?.[filtroIndex]?.titoloFiltro && (
                                        <span className="text-red-500">
                                            {(errors[namePrefix] as any)?.[filtroIndex].titoloFiltro.message}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="soft-primary"
                                    className="ml-4"
                                    onClick={() => refsCondizioni.current[filtroIndex]?.addCondition()}
                                >
                                    Aggiungi Condizione
                                    <Lucide icon="Plus" className="w-5 h-5" />
                                </Button>
                            </div>
                            <CondizioniFiltroContext
                                ref={(el) => { refsCondizioni.current[filtroIndex] = el; }}
                                control={control}
                                register={register}
                                setValue={setValue}
                                errors={errors}
                                filtroIndex={filtroIndex}
                                namePrefix={`${namePrefix}.${filtroIndex}.condizioni`}
                                dataPerContesto={dataPerContesto}
                                retriviedDataFiltriContesto={retriviedDataFiltriContesto}
                            />
                        </Tab.Panel>
                    ))}
                </Tab.Panels>
            </Tab.Group>
            <div className="flex justify-between mt-4">
                <Button
                    disabled={fields.length === 0}
                    type="button"
                    variant="soft-danger"
                    onClick={() => remove(fields.length - 1)}
                >
                    <Lucide icon="Trash2" className="w-5 h-5 mr-1" />
                    Rimuovi Filtro
                </Button>
                <Button
                    type="button"
                    variant="soft-primary"
                    onClick={() =>
                        append({
                            titoloFiltro: '',
                            condizioni: [{ schemaScelto: '', colonna: '', valore: '', operatore: '' }],
                        })
                    }
                >
                    <Lucide icon="Plus" className="w-5 h-5 mr-1" />
                    Aggiungi Filtro
                </Button>
            </div>
        </div>
    );
};

export default ContextFilterForm;
