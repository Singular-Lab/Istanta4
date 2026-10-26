import { FormLabel } from "@/components/Base/Form";
import MultiSelect, { type Option } from "@/components/Base/Form/MultiSelect";
import clsx from "clsx";
import { useMemo } from "react";
import type { VisibilitaPromo } from "../../../lib/types";
import { useFetchAree, useFetchCanali, useFetchVisibilitaOpzioni } from "../../query/query";

type Props = {
  value?: VisibilitaPromo | null;
  onChange: (visibilita: VisibilitaPromo) => void;
  className?: string;
};

const idScelti = (sel: Option[] | Option | null) =>
  (Array.isArray(sel) ? sel : sel ? [sel] : []).map((o) => String(o.id).toLowerCase());

/**
 * Canali e/o aree visibili nella promo: report e timone mostrano solo quelli (I20-958).
 * Compare solo per le dimensioni che il cliente abilita.
 */
export default function VisibilitaPromoFields({ value, onChange, className }: Props) {
  const { data: dimensioni = [] } = useFetchVisibilitaOpzioni();
  const { data: canali } = useFetchCanali();
  const { data: aree } = useFetchAree();
  // Stessi oggetti fra options e value: il Combobox confronta per riferimento
  const opzioniCanali = useMemo(
    () => (canali ?? []).map((c) => ({ id: c.id.toLowerCase(), name: `${c.codice} - ${c.nome}` })),
    [canali]
  );
  const opzioniAree = useMemo(
    () => (aree ?? []).map((a) => ({ id: a.id.toLowerCase(), name: `${a.codice} - ${a.nome}` })),
    [aree]
  );

  if (dimensioni.length === 0) return null;

  const visibilita: VisibilitaPromo = { canali: value?.canali ?? [], aree: value?.aree ?? [] };

  return (
    <div className={clsx("border rounded-[0.6rem] dark:border-darkmode-400 relative border-slate-200/80", className)}>
      <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white text-slate-500">
        <div className="-mt-px">Visibilità canali e aree</div>
      </div>
      <div className="px-5 py-4 mt-2 flex flex-col gap-3.5">
        {dimensioni.includes("canale") && (
          <div>
            <FormLabel className="text-sm font-medium">Canali</FormLabel>
            <MultiSelect
              multiple
              options={opzioniCanali}
              value={opzioniCanali.filter((o) => visibilita.canali.includes(o.id))}
              onChangefunc={(sel) => onChange({ ...visibilita, canali: idScelti(sel) })}
            />
          </div>
        )}
        {dimensioni.includes("area") && (
          <div>
            <FormLabel className="text-sm font-medium">Aree</FormLabel>
            <MultiSelect
              multiple
              options={opzioniAree}
              value={opzioniAree.filter((o) => visibilita.aree.includes(o.id))}
              onChangefunc={(sel) => onChange({ ...visibilita, aree: idScelti(sel) })}
            />
          </div>
        )}
        <p className="text-xs text-slate-500">
          Report e timone mostrano solo i canali e le aree scelti; senza scelta si vede tutto.
          Cambiando la scelta, i momenti già calcolati vanno ricalcolati.
        </p>
      </div>
    </div>
  );
}
