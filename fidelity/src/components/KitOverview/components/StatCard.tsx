import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { FC } from "react";
import { StatCardProps } from "../types";

/**
 * Componente StatCard per visualizzare una statistica singola.
 * Usato nella griglia statistiche del KitOverview.
 */
const StatCard: FC<StatCardProps> = ({
  icon,
  iconColor,
  iconBg,
  value,
  label,
  sublabel,
  isLive
}) => (
  <div className={clsx(
    "flex items-center gap-3 p-4 rounded-xl border bg-white",
    isLive ? "border-theme-1/30 ring-2 ring-theme-1/10" : "border-slate-200"
  )}>
    <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", iconBg)}>
      <Lucide icon={icon as any} className={clsx("h-6 w-6", iconColor)} />
    </div>
    <div className="min-w-0">
      <p className={clsx(
        "text-2xl font-bold truncate",
        isLive ? "text-theme-1" : "text-slate-800"
      )}>{value}</p>
      <p className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {isLive && (
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-1 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-theme-1"></span>
          </span>
        )}
      </p>
      {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
  </div>
);

export default StatCard;
