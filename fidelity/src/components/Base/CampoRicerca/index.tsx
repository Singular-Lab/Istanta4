import FormInput from "@/components/Base/Form/FormInput";
import Lucide from "@/components/Base/Lucide";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { twMerge } from "@/utils/twMerge";

export interface CampoRicercaProps
  extends Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type" | "className" | "placeholder"> {
  value: string;
  onChange: (valore: string) => void;
  /** Nome del campo per le tecnologie assistive, per esempio "Cerca ordini". */
  etichetta: string;
  placeholder?: string;
  /** Classi del contenitore; la larghezza predefinita è w-full sm:w-72. */
  className?: string;
}

/** Campo di ricerca con la lente: da mettere nella BarraFiltri della sezione che filtra. */
const CampoRicerca = forwardRef<HTMLInputElement, CampoRicercaProps>(
  ({ value, onChange, etichetta, placeholder = "Cerca…", className, ...props }, ref) => (
    <div className={twMerge("relative w-full sm:w-72", className)}>
      <Lucide
        icon="Search"
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400"
      />
      <FormInput
        {...props}
        ref={ref}
        type="search"
        aria-label={etichetta}
        placeholder={placeholder}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="pl-9"
      />
    </div>
  )
);

CampoRicerca.displayName = "CampoRicerca";

export default CampoRicerca;
