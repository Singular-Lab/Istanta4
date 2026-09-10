import { CompiledField, DataFields } from "../../../lib/types";


export class TraduttoreReferenze {
    /**
     *
     * @param data_fields_referenza
     * @param data_fields_translation_map
     * @returns new_data_fields
     */
    static traduci_data_fields(
        data_fields_referenza: DataFields,
        data_fields_translation_map: {
            expected_input: string,
            expected_output: string,
        }[]
    ): DataFields {
        const data_fields_output: DataFields = {};
        for (const [key, value] of Object.entries(data_fields_referenza)) {
            //gestiamo il caso in cui il valore sia, vuoto, se lo è allora dobbiamo lasciare il nome del datafields originale
            const data_field_output = data_fields_translation_map.find(
                (data_field_translation) => data_field_translation.expected_input === key
            );
            if (data_field_output && data_field_output.expected_output) {
                data_fields_output[data_field_output.expected_output] = value;
            } else {
                data_fields_output[key] = value;
            }
        }
        return data_fields_output;
    }

    static traduci_compiled_fields(
        compiled_fields_referenza: CompiledField[],
        compiled_fields_translation_map: {
            expected_input: string,
            expected_output: string,
        }[]
    ): CompiledField[] {
        const compiled_fields_output: CompiledField[] = [];
        for (const compiled_field of compiled_fields_referenza) {
            const compiled_field_output = compiled_fields_translation_map.find(
                (compiled_field_translation) => compiled_field_translation.expected_input === compiled_field.labelName
            );
            if (compiled_field_output && compiled_field_output.expected_output) {
                compiled_fields_output.push({
                    ...compiled_field,
                    labelName: compiled_field_output.expected_output,
                });
            } else {
                compiled_fields_output.push(compiled_field);
            }
        }

        console.log("Output compiled_fields:", compiled_fields_output);
        return compiled_fields_output;
    }


    static traduci_deleted_fields(
        deleted_fields_referenza: string[],
        deleted_fields_translation_map: {
            expected_input: string,
            expected_output: string,
        }[]
    ): string[] {
        const deleted_fields_output: string[] = [];
        for (const deleted_field of deleted_fields_referenza) {
            const deleted_field_output = deleted_fields_translation_map.find(
                (deleted_field_translation) => deleted_field_translation.expected_input === deleted_field
            );
            if (deleted_field_output && deleted_field_output.expected_output) {
                deleted_fields_output.push(deleted_field_output.expected_output);
            } else {
                deleted_fields_output.push(deleted_field);
            }
        }
        return deleted_fields_output;
    }
}
