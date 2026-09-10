import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";

type Variant = "blue" | "green" | "amber" | "rose" | "slate";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: any;
  trend?: "up" | "down";
  trendValue?: string;
  subtitle?: string;
  variant?: Variant;
}

const variantMap: Record<Variant, { border: string; iconBg: string; iconColor: string }> = {
  blue: { border: "border-l-primary", iconBg: "bg-primary/10", iconColor: "text-primary" },
  green: { border: "border-l-success", iconBg: "bg-success/10", iconColor: "text-success" },
  amber: { border: "border-l-warning", iconBg: "bg-warning/10", iconColor: "text-warning" },
  rose: { border: "border-l-danger", iconBg: "bg-danger/10", iconColor: "text-danger" },
  slate: { border: "border-l-slate-300", iconBg: "bg-slate-100", iconColor: "text-slate-500" },
};

function StatCard({ title, value, icon, trend, trendValue, subtitle, variant = "blue" }: StatCardProps) {
  const vs = variantMap[variant];
  return (
    <div
      className={clsx(
        "box p-5 border-l-4 hover:shadow-md transition-shadow duration-200 cursor-default h-full",
        vs.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900 truncate leading-none">
            {value}
          </p>
          {(trendValue || subtitle) && (
            <div className="flex items-center gap-1 mt-2 text-xs">
              {trend && (
                <Lucide
                  icon={trend === "up" ? "TrendingUp" : "TrendingDown"}
                  className={clsx(
                    "w-3.5 h-3.5 flex-shrink-0",
                    trend === "up" ? "text-success" : "text-danger"
                  )}
                />
              )}
              <span className="text-slate-500 truncate">{trendValue || subtitle}</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              vs.iconBg
            )}
          >
            <Lucide icon={icon} className={clsx("w-5 h-5", vs.iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
