import Button from '@/components/Base/Button';
import FormInput from '@/components/Base/Form/FormInput';
import FormSelect from '@/components/Base/Form/FormSelect';
import Lucide from '@/components/Base/Lucide';
import Table from '@/components/Base/Table';
import React, { useEffect, useState } from 'react';
import { Control, FieldErrors, UseFormRegister, useFieldArray } from 'react-hook-form';

interface CondizioniAddestramentiFormProps {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  filtroIndex: number;
  declinazioneIndex?: number;
  namePrefix: string;
  dataAddestramenti?: any[];
}

const CondizioniAddestramentiForm = ({
  control,
  register,
  errors,
  filtroIndex,
  declinazioneIndex,
  namePrefix,
  dataAddestramenti
}: CondizioniAddestramentiFormProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: namePrefix,
  });
  const [selectedAddestramenti, setSelectedAddestramenti] = useState<{ [key: number]: string | number | null }>({});
  const [selectedColonna, setSelectedColonna] = useState<{ [key: number]: string | null }>({});

  const shallowEqualSelections = (first: Record<number, string | number | null>, second: Record<number, string | number | null>) => {
    const firstKeys = Object.keys(first);
    const secondKeys = Object.keys(second);
    if (firstKeys.length !== secondKeys.length) {
      return false;
    }
    return firstKeys.every((key) => first[Number(key)] === second[Number(key)]);
  };

  const addCondition = () => {
    append({
      nome_field: '',
      operatore: '=',
      valore: '',
    });
  };

  useEffect(() => {
    // Pre-compilazione condizioni, se presente
    if (fields.length === 0) {
      setSelectedAddestramenti((prev) => (Object.keys(prev).length ? {} : prev));
      setSelectedColonna((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }

    const initialSelectedAddestramenti: Record<number, string | number | null> = {};
    const initialSelectedColonne: Record<number, string | null> = {};

    fields.forEach((field: any, index) => {
      initialSelectedAddestramenti[index] = field.idAddestramento ? Number(field.idAddestramento) : null;
      initialSelectedColonne[index] = field.nome_field || null;
    });

    setSelectedAddestramenti((prev) =>
      shallowEqualSelections(prev, initialSelectedAddestramenti) ? prev : initialSelectedAddestramenti
    );
    setSelectedColonna((prev) =>
      shallowEqualSelections(prev, initialSelectedColonne) ? prev : initialSelectedColonne
    );
  }, [fields]);

  const handleAddestramentoChange = (e: React.ChangeEvent<HTMLSelectElement>, condizioneIndex: number) => {
    const selectedId = e.target.value;
    setSelectedAddestramenti((prev) => ({
      ...prev,
      [condizioneIndex]: selectedId ? Number(selectedId) : null,
    }));
    register(`${namePrefix}.${condizioneIndex}.idAddestramento`).onChange(e);
    // Reset the selected column when the training changes
    setSelectedColonna((prev) => ({
      ...prev,
      [condizioneIndex]: '',
    }));
  };

  const handleColonnaChange = (e: React.ChangeEvent<HTMLSelectElement>, condizioneIndex: number) => {
    const selectedCol = e.target.value;
    setSelectedColonna((prev) => ({
      ...prev,
      [condizioneIndex]: selectedCol,
    }));
    register(`${namePrefix}.${condizioneIndex}.nome_field`).onChange(e);
  };

  return (
    <div className="space-y-4">
      <Table sm className="w-full border bg-slate-50 dark:bg-darkmode-700">
        <Table.Thead>
          <Table.Tr>
            <Table.Th className='w-1/4'>Addestramento</Table.Th>
            <Table.Th className='w-1/4'>Colonna</Table.Th>
            <Table.Th>Operatore</Table.Th>
            <Table.Th>Valore</Table.Th>
            <Table.Th>Azioni</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fields.map((condizione, condizioneIndex) => (
            <Table.Tr key={condizione.id}>
              <Table.Td className="w-full sm:w-auto">
                <FormSelect
                  {...register(`${namePrefix}.${condizioneIndex}.idAddestramento`, {
                    required: "L'addestramento è obbligatorio"
                  })}
                  className="border-gray-300 rounded-md w-full"
                  onChange={(e) => handleAddestramentoChange(e, condizioneIndex)}
                  value={selectedAddestramenti[condizioneIndex] ?? ''}
                >
                  <option value="">Addestramento</option>
                  {dataAddestramenti?.map((item: any) => (
                    <option key={item.id || item.titolo} value={item.id || item.titolo}>
                      {item.titolo || item.nome}
                    </option>
                  ))}
                </FormSelect>
                {errors && (errors[namePrefix] as any)?.[condizioneIndex]?.idAddestramento && (
                  <span className="text-red-500">
                    {(errors[namePrefix] as any)?.[condizioneIndex]?.idAddestramento?.message}
                  </span>
                )}
              </Table.Td>
              <Table.Td className="w-full sm:w-auto">
                <FormSelect
                  {...register(`${namePrefix}.${condizioneIndex}.nome_field`, {
                    required: "Il nome del campo è obbligatorio",
                  })}
                  className="border-gray-300 rounded-md w-full"
                  onChange={(e) => handleColonnaChange(e, condizioneIndex)}
                  value={selectedColonna[condizioneIndex] || ''}
                >
                  <option value="">Colonna</option>
                  {dataAddestramenti
                    ?.find((item: any) => item.id === selectedAddestramenti[condizioneIndex] || item.titolo === selectedAddestramenti[condizioneIndex])
                    ?.fields?.map((colonna: { idCampo: string; nomeColonnaOriginale: string, nomeColonna: string }) => (
                      <option key={colonna.idCampo} value={colonna.nomeColonna}>
                        {colonna.nomeColonnaOriginale}
                      </option>
                    ))}
                </FormSelect>
                {errors && (errors[namePrefix] as any)?.[condizioneIndex]?.nome_field && (
                  <span className="text-red-500">
                    {(errors[namePrefix] as any)?.[condizioneIndex].nome_field.message}
                  </span>
                )}
              </Table.Td>
              <Table.Td className="w-full sm:w-auto">
                <FormSelect
                  {...register(`${namePrefix}.${condizioneIndex}.operatore`)}
                  className="border-gray-300 rounded-md w-full"
                  defaultValue={(condizione as any).operatore || '='}
                >
                  <option value="=">Uguale</option>
                  <option value="!=">Diverso da</option>
                  <option value=">">Maggiore di</option>
                  <option value="<">Minore di</option>
                  <option value="Contain">Contiene</option>
                  <option value="NoContain">Non contiene</option>
                </FormSelect>
              </Table.Td>
              <Table.Td className="w-full sm:w-auto">
                <FormInput
                  {...register(`${namePrefix}.${condizioneIndex}.valore`, {
                    required: "Il valore è obbligatorio",
                  })}
                  placeholder="Valore"
                  className="border-gray-300 rounded-md w-full"
                  defaultValue={(condizione as any).valore || ''}
                />
                {errors && (errors[namePrefix] as any)?.[condizioneIndex]?.valore && (
                  <span className="text-danger">
                    {(errors[namePrefix] as any)?.[condizioneIndex].valore.message}
                  </span>
                )}
              </Table.Td>
              <Table.Td className="w-full sm:w-auto text-center">
                <Button
                  type="button"
                  variant="outline-danger"
                  size='sm'
                  onClick={() => remove(condizioneIndex)}
                >
                  <Lucide icon="Trash2" className="w-4 h-4" />
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <div className="flex justify-end mt-4">
        <Button
          type="button"
          variant="outline-primary"
          onClick={addCondition}
        >
          <Lucide icon="Plus" className="w-4 h-4 mr-1" />
          Aggiungi Condizione
        </Button>
      </div>
    </div>
  );
};

export default CondizioniAddestramentiForm;
