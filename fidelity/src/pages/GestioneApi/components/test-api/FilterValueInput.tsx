import { FormInput, FormSelect } from "@/components/Base/Form";
import { useFetchRefsFieldValues, useFetchFilesFieldValues } from "../../../../query/query";

interface FilterValueInputProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
  templateId?: string[];
  mode: 'refs' | 'files';
}

function FilterValueInput({
  field,
  value,
  onChange,
  templateId,
  mode
}: FilterValueInputProps) {
  const { data: refsValues = [], isLoading: isLoadingRefs } = useFetchRefsFieldValues(
    field,
    templateId,
    mode === 'refs' && !!field
  );

  const { data: filesValues = [], isLoading: isLoadingFiles } = useFetchFilesFieldValues(
    field,
    mode === 'files' && !!field
  );

  const values = mode === 'refs' ? refsValues : filesValues;
  const isLoading = mode === 'refs' ? isLoadingRefs : isLoadingFiles;

  // Se il campo non è selezionato o non ci sono valori, mostra input di testo
  if (!field || values.length === 0) {
    return (
      <FormInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Valore"
        className="text-sm"
        disabled={isLoading}
      />
    );
  }

  // Altrimenti mostra select con valori dinamici
  return (
    <FormSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm"
      disabled={isLoading}
    >
      <option value="">Seleziona valore</option>
      {values.map((val, i) => (
        <option key={i} value={val}>
          {val}
        </option>
      ))}
    </FormSelect>
  );
}

export default FilterValueInput;
