import { cloneElement, isValidElement, ReactElement, ReactNode, useId } from "react";
import { twMerge } from "@/utils/twMerge";
import FormLabel from "../FormLabel";

type AttributiCampo = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

interface FormFieldProps {
  etichetta: ReactNode;
  /** Il campo: FormInput, FormSelect, FormTextarea o un altro controllo che accetta id e attributi aria. */
  children: ReactElement<AttributiCampo>;
  obbligatorio?: boolean;
  aiuto?: ReactNode;
  /** Messaggio di errore del campo; se presente il campo è segnato come non valido. */
  errore?: ReactNode;
  className?: string;
}

/** Etichetta, campo, aiuto ed errore collegati fra loro, con lo stesso aspetto in tutti i form. */
function FormField({ etichetta, children, obbligatorio = false, aiuto, errore, className }: FormFieldProps) {
  const generato = useId();
  const campo = isValidElement(children) ? children : null;
  const id = campo?.props.id ?? generato;
  const idAiuto = aiuto ? `${id}-aiuto` : undefined;
  const idErrore = errore ? `${id}-errore` : undefined;
  const descrittori = [campo?.props["aria-describedby"], idAiuto, idErrore].filter(Boolean).join(" ") || undefined;

  return (
    <div className={twMerge("flex flex-col", className)}>
      <FormLabel htmlFor={id}>
        {etichetta}
        {obbligatorio && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-danger">*</span>
            {/* Spazio fuori dallo span: dentro, il nome accessibile diventerebbe "Nome(obbligatorio)" */}
            {" "}
            <span className="sr-only">(obbligatorio)</span>
          </>
        )}
      </FormLabel>
      {campo &&
        cloneElement(campo, {
          id,
          "aria-invalid": errore ? true : campo.props["aria-invalid"],
          "aria-describedby": descrittori,
          "aria-required": obbligatorio || campo.props["aria-required"],
        })}
      {aiuto && (
        <p id={idAiuto} className="mt-1.5 text-xs text-slate-500">
          {aiuto}
        </p>
      )}
      {errore && (
        <p id={idErrore} className="mt-1.5 text-xs text-danger">
          {errore}
        </p>
      )}
    </div>
  );
}

export default FormField;
