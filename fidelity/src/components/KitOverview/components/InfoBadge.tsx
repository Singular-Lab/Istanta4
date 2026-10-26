import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { FC } from "react";
import { INFO_BADGE_VARIANTS } from "../config/stateConfig";
import { InfoBadgeProps, InfoBadgeVariant } from "../types";

/**
 * Componente InfoBadge per visualizzare informazioni con icona e label.
 */
const InfoBadge: FC<InfoBadgeProps> = ({
  icon,
  label,
  value,
  variant = "default"
}) => {
  const variantClasses = INFO_BADGE_VARIANTS[variant as InfoBadgeVariant] || INFO_BADGE_VARIANTS.default;

  return (
    <div className={clsx(
      "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
      variantClasses
    )}>
      <Lucide icon={icon as any} className="h-4 w-4 opacity-70" />
      <div>
        <p className="text-[10px] uppercase tracking-wider opacity-60">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
};

export default InfoBadge;
