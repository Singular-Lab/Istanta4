import Button from '@/components/Base/Button';
import FormInput from '@/components/Base/Form/FormInput';
import FormSelect from '@/components/Base/Form/FormSelect';
import Lucide from '@/components/Base/Lucide';
import Table from '@/components/Base/Table';
import React, { forwardRef, useImperativeHandle } from 'react';
import { Control, FieldErrors, UseFormRegister, UseFormSetValue, useFieldArray, useWatch } from 'react-hook-form';

interface CondizioniSchemaFormProps {
    control: Control<any>;
    register: UseFormRegister<any>;
    setValue: UseFormSetValue<any>;
    errors: FieldErrors<any>;
    filtroIndex: number;
    declinazioneIndex?: number;
    namePrefix: string;
    dataPerContesto?: any;
    retriviedDataFiltriContesto: any;
}

const CondizioniSchemaForm = forwardRef(({
    control,
    register,
    setValue,
    errors,
    filtroIndex,
    declinazioneIndex,
    namePrefix,
    dataPerContesto,
    retriviedDataFiltriContesto
}: CondizioniSchemaFormProps, ref) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: namePrefix,
    });

    const watchedCondizioni: any[] = useWatch({ control, name: namePrefix, defaultValue: [] });

    useImperativeHandle(ref, () => ({
        addCondition: () => {
            append({
                schemaScelto: '',
                colonna: '',
                valore: '',
                operatore: ''
            });
        }
    }));

    const schemi = Array.isArray(dataPerContesto?.schemi) ? dataPerContesto.schemi : dataPerContesto;

    return (
        <div className="space-y-4">
            <Table sm className="w-full border bg-blue-50">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Schema</Table.Th>
                        <Table.Th>Colonna</Table.Th>
                        <Table.Th>Operatore</Table.Th>
                        <Table.Th>Valore</Table.Th>
                        <Table.Th>Azioni</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {fields.map((condition, conditionIndex) => {
                        const cond = watchedCondizioni?.[conditionIndex] ?? {};
                        const currentSchema = cond.schemaScelto ?? '';
                        const currentColumn = cond.colonna ?? '';
                        const currentValue = cond.valore ?? '';
                        const currentOperatore = cond.operatore ?? '';

                        const schemaItem = schemi?.find(
                            (item: any) => item.id === currentSchema || item.titolo === currentSchema
                        );
                        const selectedField = schemaItem?.ficoContextFields?.find(
                            (f: any) => f.nome_field === currentColumn
                        );

                        return (
                            <Table.Tr key={condition.id}>
                                <Table.Td className="w-full sm:w-auto">
                                    <FormSelect
                                        {...register(`${namePrefix}.${conditionIndex}.schemaScelto`, {
                                            required: "Lo schema è obbligatorio"
                                        })}
                                        className="border-gray-300 rounded-md w-full"
                                        value={currentSchema}
                                        onChange={(e) => {
                                            setValue(`${namePrefix}.${conditionIndex}.schemaScelto`, e.target.value, { shouldValidate: true });
                                            setValue(`${namePrefix}.${conditionIndex}.colonna`, '');
                                            setValue(`${namePrefix}.${conditionIndex}.valore`, '');
                                        }}
                                    >
                                        <option value="">Scegli chiave di contesto</option>
                                        {schemi
                                            ?.filter((item: any) => Array.isArray(item.ficoContextFields) && item.ficoContextFields.length > 0)
                                            .map((item: any, idx: number) => (
                                                <option key={item.id || item.titolo || idx} value={item.id || item.titolo}>
                                                    {item.titolo || item.nome}
                                                </option>
                                            ))}
                                    </FormSelect>
                                    {errors && (errors[namePrefix] as any)?.[conditionIndex]?.schemaScelto && (
                                        <span className="text-red-500">
                                            {(errors[namePrefix] as any)?.[conditionIndex]?.schemaScelto?.message}
                                        </span>
                                    )}
                                </Table.Td>
                                <Table.Td className="w-full sm:w-auto">
                                    {schemaItem?.ficoContextFields?.length > 0 ? (
                                        <FormSelect
                                            {...register(`${namePrefix}.${conditionIndex}.colonna`, {
                                                required: "Il nome del campo è obbligatorio",
                                            })}
                                            className="border-gray-300 rounded-md w-full"
                                            value={currentColumn}
                                            onChange={(e) => {
                                                setValue(`${namePrefix}.${conditionIndex}.colonna`, e.target.value, { shouldValidate: true });
                                                setValue(`${namePrefix}.${conditionIndex}.valore`, '');
                                            }}
                                        >
                                            <option value="">Colonna</option>
                                            {schemaItem.ficoContextFields.map((colonna: { nome_field: string }) => (
                                                <option key={colonna.nome_field} value={colonna.nome_field}>
                                                    {colonna.nome_field}
                                                </option>
                                            ))}
                                        </FormSelect>
                                    ) : (
                                        <span className="text-gray-500">Nessuna colonna disponibile</span>
                                    )}
                                    {errors && (errors[namePrefix] as any)?.[conditionIndex]?.colonna && (
                                        <span className="text-red-500">
                                            {(errors[namePrefix] as any)?.[conditionIndex]?.colonna?.message}
                                        </span>
                                    )}
                                </Table.Td>
                                <Table.Td className="w-full sm:w-auto">
                                    <FormSelect
                                        {...register(`${namePrefix}.${conditionIndex}.operatore`, {
                                            required: "L'operatore è obbligatorio"
                                        })}
                                        className="border-gray-300 rounded-md w-full"
                                        value={currentOperatore}
                                        onChange={(e) => setValue(`${namePrefix}.${conditionIndex}.operatore`, e.target.value, { shouldValidate: true })}
                                    >
                                        <option value="">Operatore</option>
                                        <option value="=">Uguale</option>
                                        <option value="!=">Diverso da</option>
                                        <option value=">">Maggiore di</option>
                                        <option value="<">Minore di</option>
                                        <option value="Contain">Contiene</option>
                                        <option value="NoContain">Non contiene</option>
                                    </FormSelect>
                                    {errors && (errors[namePrefix] as any)?.[conditionIndex]?.operatore && (
                                        <span className="text-red-500">
                                            {(errors[namePrefix] as any)?.[conditionIndex]?.operatore?.message}
                                        </span>
                                    )}
                                </Table.Td>
                                <Table.Td className="w-full sm:w-auto">
                                    {selectedField?.valore && Array.isArray(selectedField.valore) && selectedField.valore.length > 0 ? (
                                        <FormSelect
                                            {...register(`${namePrefix}.${conditionIndex}.valore`, {
                                                required: "Il nome del campo è obbligatorio",
                                            })}
                                            className="border-gray-300 rounded-md w-full"
                                            value={currentValue}
                                            onChange={(e) => setValue(`${namePrefix}.${conditionIndex}.valore`, e.target.value, { shouldValidate: true })}
                                        >
                                            <option value="">Vuoto</option>
                                            {selectedField.valore.map((val: { titolo: string, valore: string }) => (
                                                <option key={val.valore} value={val.valore}>
                                                    {val.titolo}
                                                </option>
                                            ))}
                                        </FormSelect>
                                    ) : (
                                        <FormInput
                                            {...register(`${namePrefix}.${conditionIndex}.valore`, {
                                                required: "Il nome del campo è obbligatorio",
                                            })}
                                            placeholder="Valore"
                                            className="border-gray-300 rounded-md w-full"
                                        />
                                    )}
                                    {errors && (errors[namePrefix] as any)?.[conditionIndex]?.valore && (
                                        <span className="text-red-500">
                                            {(errors[namePrefix] as any)?.[conditionIndex].valore.message}
                                        </span>
                                    )}
                                </Table.Td>
                                <Table.Td className="w-full sm:w-auto">
                                    <Button
                                        type="button"
                                        variant="soft-danger"
                                        onClick={() => remove(conditionIndex)}
                                        className="md:col-span-1 w-full sm:w-auto"
                                    >
                                        Elimina Condizione
                                        <Lucide icon="Trash2" className="w-5 h-5" />
                                    </Button>
                                </Table.Td>
                            </Table.Tr>
                        );
                    })}
                </Table.Tbody>
            </Table>
        </div>
    );
});

export default CondizioniSchemaForm;
