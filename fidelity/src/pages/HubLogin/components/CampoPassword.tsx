import { FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import { forwardRef, useState } from "react";
import { twMerge } from "@/utils/twMerge";

type CampoPasswordProps = Omit<React.ComponentPropsWithoutRef<"input">, "type">;

/**
 * Campo password con il pulsante per mostrarla. Riceve id e attributi aria sul campo,
 * quindi si può usare dentro FormField come un FormInput.
 */
const CampoPassword = forwardRef<HTMLInputElement, CampoPasswordProps>(({ className, ...props }, ref) => {
  const [visibile, setVisibile] = useState(false);

  return (
    <div className="relative">
      <FormInput
        {...props}
        ref={ref}
        type={visibile ? "text" : "password"}
        // pr-12 in fondo: un px-* passato dall'esterno non deve coprire lo spazio del pulsante
        className={twMerge(className, "pr-12")}
      />
      <button
        type="button"
        onClick={() => setVisibile((prev) => !prev)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
        aria-label={visibile ? "Nascondi password" : "Mostra password"}
      >
        <Lucide icon={visibile ? "EyeOff" : "Eye"} aria-hidden="true" className="w-5 h-5" />
      </button>
    </div>
  );
});

CampoPassword.displayName = "CampoPassword";

export default CampoPassword;
