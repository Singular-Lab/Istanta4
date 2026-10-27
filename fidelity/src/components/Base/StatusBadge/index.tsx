import Lucide from "@/components/Base/Lucide";
import { descriviStato, DominioStato, TonoStato } from "@/constants/stati";
import { twMerge } from "@/utils/twMerge";

const CLASSI_TONO: Record<TonoStato, { pastiglia: string; pallino: string }> = {
  neutral: { pastiglia: "bg-slate-100 text-slate-700", pallino: "bg-slate-400" },
  info: { pastiglia: "bg-sky-100 text-sky-800", pallino: "bg-sky-500" },
  brand: { pastiglia: "bg-theme-1/10 text-theme-1", pallino: "bg-theme-1" },
  success: { pastiglia: "bg-teal-100 text-teal-800", pallino: "bg-teal-500" },
  warning: { pastiglia: "bg-amber-100 text-amber-800", pallino: "bg-amber-500" },
  danger: { pastiglia: "bg-red-100 text-red-700", pallino: "bg-red-500" },
};

type StatusBadgeProps = {
  className?: string;
  /** Icona Lucide al posto del pallino. */
  icon?: string;
} & (
  | { dominio: DominioStato; stato: string | null | undefined; tono?: never; etichetta?: never }
  | { tono: TonoStato; etichetta: string; dominio?: never; stato?: never }
);

/** Pastiglia con pallino ed etichetta per lo stato di una promo, un kit, un ordine, un utente... */
function StatusBadge(props: StatusBadgeProps) {
  const { tono, etichetta } = props.dominio ? descriviStato(props.dominio, props.stato) : props;
  const classi = CLASSI_TONO[tono];

  return (
    <span
      title={etichetta}
      data-tono={tono}
      className={twMerge(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-medium",
        classi.pastiglia,
        props.className
      )}
    >
      {props.icon ? (
        <Lucide icon={props.icon} aria-hidden="true" className="h-3 w-3 stroke-current" />
      ) : (
        <span aria-hidden="true" className={twMerge("h-1.5 w-1.5 flex-none rounded-full", classi.pallino)} />
      )}
      <span className="truncate">{etichetta}</span>
    </span>
  );
}

export default StatusBadge;
