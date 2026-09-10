import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";

// ── Tipi ────────────────────────────────────────────────────────────────────

export type ComboBoxField = {
  tipo_field: "cmb";
  valore: Array<{ titolo: string; valore: string }>;
  /** Se definito, testo dell'opzione vuota; se assente usa titolo_field */
  defaultTitleNull?: string;
};

export type RadioButtonField = {
  tipo_field: "radio";
  valore: Array<{ titolo: string; valore: string }>;
};

export type CheckButtonField = {
  tipo_field: "check";
  valore: Array<{ titolo: string; valore: string }>;
};

export type TextFieldDef = {
  tipo_field: "text";
  valore: string;
};

export type ContestoField = {
  nome_field: string;
  titolo_field: string;
  dipendenze?: { nome_field: string; valore: string }[];
  /**
   * true  → campo opzionale (mostra opzione vuota nel cmb)
   * false → campo obbligatorio (nessuna opzione vuota nel cmb)
   * undefined → trattato come false (nessuna opzione vuota)
   */
  nullable?: boolean;
  user_value?: any;
} & (ComboBoxField | RadioButtonField | TextFieldDef | CheckButtonField);

// ── Props ────────────────────────────────────────────────────────────────────

export type ContestoLavorazioneFieldsProps = {
  /** Array dei campi con i valori correnti (user_value già popolato) */
  context: ContestoField[];
  /** Mappa fieldName→valore corrente, usata per dependency check e valori cmb/select */
  fieldValues: { [key: string]: any };
  /** Valore del campo etichetta personalizzata (caso idLabel === "lblpers") */
  customLabelValue: string;
  /** Errori di validazione per campo */
  errors: { [fieldName: string]: string };
  /** Numero massimo di caratteri per l'etichetta personalizzata */
  maxCharCustomLabel: number;
  /** Callback chiamata su qualsiasi cambio di campo */
  onChange: (fieldName: string, value: any) => void;
  /** Callback chiamata quando cambia l'etichetta personalizzata */
  onCustomLabelChange: (value: string) => void;
  /**
   * Prefisso per gli attributi id/name degli input (evita collisioni
   * se il componente è usato più volte nella stessa pagina).
   */
  idPrefix?: string;
};

// ── Helper ───────────────────────────────────────────────────────────────────

const areDependenciesMet = (
  dipendenze: any[] | undefined,
  allFieldValues: any
) => {
  if (!dipendenze || dipendenze.length === 0) return true;
  return dipendenze.every((dependency: any) =>
    (allFieldValues[dependency.nome_field] ?? "") === dependency.valore
  );
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function ContestoLavorazioneFields({
  context,
  fieldValues,
  customLabelValue,
  errors,
  maxCharCustomLabel,
  onChange,
  onCustomLabelChange,
  idPrefix = "",
}: ContestoLavorazioneFieldsProps) {
  if (!context || context.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nessun campo di contesto disponibile.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {context.map((contesto, idx) => {
        if (!areDependenciesMet(contesto.dipendenze, fieldValues)) return null;

        const fieldId = `${idPrefix}${contesto.nome_field}`;
        const errorMessage = errors[contesto.nome_field];

        // ── ComboBox ─────────────────────────────────────────────────────────
        if (contesto.tipo_field === "cmb") {
          const valori = Array.isArray(contesto.valore) ? contesto.valore : [];
          return (
            <div key={idx} className="space-y-1">
              <FormLabel htmlFor={fieldId} className="text-sm font-medium">
                {contesto.titolo_field}
              </FormLabel>
              <FormSelect
                id={fieldId}
                value={fieldValues[contesto.nome_field] || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange(contesto.nome_field, value);
                  if (contesto.nome_field === "idLabel" && value !== "lblpers") {
                    onCustomLabelChange("");
                  }
                }}
                className="w-full text-sm"
              >
                {contesto.nullable === true && (
                  <option value="">
                    {contesto.defaultTitleNull ?? contesto.titolo_field}
                  </option>
                )}
                {valori.map((valore, idxVal) => (
                  <option key={idxVal} value={valore.valore}>
                    {valore.titolo}
                  </option>
                ))}
              </FormSelect>

              {fieldValues[contesto.nome_field] === "lblpers" && (
                <>
                  <FormInput
                    id={`${fieldId}_custom`}
                    placeholder="Inserisci la tua etichetta personalizzata"
                    value={customLabelValue}
                    onChange={(e) =>
                      onCustomLabelChange(
                        e.target.value.slice(0, maxCharCustomLabel)
                      )
                    }
                    className="w-full text-sm mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-0.5">
                    {customLabelValue.length}/{maxCharCustomLabel} caratteri
                  </p>
                </>
              )}

              {errorMessage && (
                <p className="mt-1 text-xs text-danger">{errorMessage}</p>
              )}
            </div>
          );
        }

        // ── Radio ─────────────────────────────────────────────────────────────
        if (contesto.tipo_field === "radio") {
          const valori = Array.isArray(contesto.valore) ? contesto.valore : [];
          return (
            <div key={idx} className="space-y-2">
              <FormLabel className="text-sm font-medium">
                {contesto.titolo_field}
              </FormLabel>
              <div className="space-y-1">
                {valori.map((valore, idxVal) => (
                  <label
                    key={idxVal}
                    className="flex items-center space-x-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      id={`${fieldId}_${valore.valore}`}
                      name={fieldId}
                      value={valore.valore}
                      checked={
                        (fieldValues[contesto.nome_field] ?? "") === valore.valore
                      }
                      onChange={(e) => onChange(contesto.nome_field, e.target.value)}
                      className="text-primary"
                    />
                    <span>{valore.titolo}</span>
                  </label>
                ))}
              </div>
              {errorMessage && (
                <p className="mt-1 text-xs text-danger">{errorMessage}</p>
              )}
            </div>
          );
        }

        // ── Text ──────────────────────────────────────────────────────────────
        if (contesto.tipo_field === "text") {
          return (
            <div key={idx} className="space-y-1">
              <FormLabel htmlFor={fieldId} className="text-sm font-medium">
                {contesto.titolo_field}
              </FormLabel>
              <FormInput
                id={fieldId}
                value={fieldValues[contesto.nome_field] ?? ""}
                onChange={(e) => onChange(contesto.nome_field, e.target.value)}
                className="w-full text-sm"
              />
              {errorMessage && (
                <p className="mt-1 text-xs text-danger">{errorMessage}</p>
              )}
            </div>
          );
        }

        // ── Check ─────────────────────────────────────────────────────────────
        if (contesto.tipo_field === "check") {
          const valori = Array.isArray(contesto.valore) ? contesto.valore : [];
          const currentValue = fieldValues[contesto.nome_field] ?? "";
          const currentValues = String(currentValue).split(",").filter(Boolean);
          return (
            <div key={idx} className="space-y-2">
              <FormLabel className="text-sm font-medium">
                {contesto.titolo_field}
              </FormLabel>
              <div className="flex flex-col gap-2">
                {valori.map((valore, idxVal) => {
                  const isChecked = currentValues.includes(valore.valore);
                  return (
                    <FormCheck
                      key={idxVal}
                      className="inline-flex items-center cursor-pointer gap-2"
                    >
                      <FormCheck.Input
                        type="checkbox"
                        id={`${fieldId}_${valore.valore}`}
                        checked={isChecked}
                        onChange={() => {
                          const updated = isChecked
                            ? currentValues.filter((v) => v !== valore.valore)
                            : [...currentValues, valore.valore];
                          onChange(contesto.nome_field, updated.join(","));
                        }}
                        className="text-primary"
                      />
                      <FormCheck.Label
                        htmlFor={`${fieldId}_${valore.valore}`}
                        className="text-sm"
                      >
                        {valore.titolo}
                      </FormCheck.Label>
                    </FormCheck>
                  );
                })}
              </div>
              {errorMessage && (
                <p className="mt-1 text-xs text-danger">{errorMessage}</p>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
