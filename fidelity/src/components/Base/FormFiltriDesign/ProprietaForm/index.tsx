import { Control, UseFormRegister, FieldErrors, useFieldArray,Controller } from "react-hook-form";
import Card from "../../Card";
import Button from "../../Button";
import Lucide from "../../Lucide";
import FormInput from "../../Form/FormInput";
import FormSelect from "../../Form/FormSelect";

interface Declinazione {
    titolo: string;
    proprieta: { idChiave: number; valore: string; }[];
    filtri: any[];
}

interface FormValues {
    declinazioni: Declinazione[];
}

interface ProprietaFormProps {
    control: Control<FormValues>;
    register: UseFormRegister<FormValues>;
    errors: FieldErrors<FormValues>;
    declinazioneIndex: number;
    data: {
        id: number;
        nome: string;
        codice: string;
        descrizione: string;
    }[] | undefined;    
}

const ProprietaForm = ({ control, register, errors, declinazioneIndex, data }: ProprietaFormProps) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `declinazioni.${declinazioneIndex}.proprieta`,
    });

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field, index) => (
                    <Card key={field.id} title={`Proprietà ${index + 1}`} className="relative p-4" options={{ bordered: true }}>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline-danger"
                            className="absolute top-2 right-2"
                            onClick={() => remove(index)}
                        >
                            <Lucide icon="X" className="w-4 h-4" />
                        </Button>
                        <div className="flex flex-col gap-y-3 mt-4">
                            <Controller
                                control={control}
                                name={`declinazioni.${declinazioneIndex}.proprieta.${index}.idChiave`}
                                rules={{
                                    required: "La chiave è obbligatoria",
                                    validate: value => value !== 0 || "Seleziona una chiave valida"
                                }}
                                render={({ field }) => (
                                    <FormSelect
                                        {...field}
                                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                                    >
                                        <option value={0}>Seleziona Chiave Proprietà</option>
                                        {data?.map((item, idx) => (
                                            <option key={idx} value={item.id}>
                                                {item.nome}
                                            </option>
                                        ))}
                                    </FormSelect>
                                )}
                            />
                            {errors.declinazioni?.[declinazioneIndex]?.proprieta?.[index]?.idChiave && (
                                <div className="text-danger mt-2">
                                    {errors.declinazioni?.[declinazioneIndex]?.proprieta?.[index]?.idChiave?.message}
                                </div>
                            )}

                            <FormInput
                                {...register(`declinazioni.${declinazioneIndex}.proprieta.${index}.valore`, {
                                    required: "Il valore è obbligatorio"
                                })}
                                placeholder="Valore Proprietà"
                            />
                            {errors.declinazioni?.[declinazioneIndex]?.proprieta?.[index]?.valore && (
                                <div className="text-danger mt-2">
                                    {errors.declinazioni?.[declinazioneIndex]?.proprieta?.[index]?.valore?.message}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
            <div className="flex justify-end mt-4">
                <Button
                    type="button"
                    variant="outline-primary"
                    onClick={() => append({ idChiave: 0, valore: '' })}
                >
                    <Lucide icon="Plus" className="w-5 h-5 mr-1" />
                    Aggiungi Proprietà
                </Button>
            </div>
        </div>
    );
};

export default ProprietaForm;