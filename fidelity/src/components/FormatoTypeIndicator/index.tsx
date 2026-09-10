import clsx from "clsx";
import { FileText, Package } from "lucide-react";
import React from "react";
import { TIPO_LAVORAZIONE } from "../../../lib/enums";

interface FormatoTypeIndicatorProps {
  tipoLavorazione: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const FormatoTypeIndicator: React.FC<FormatoTypeIndicatorProps> = ({
  tipoLavorazione,
  size = "md",
  showLabel = true,
  className,
}) => {
  const isVolantino = tipoLavorazione === TIPO_LAVORAZIONE.VOLANTINO;
  const isPop = tipoLavorazione === TIPO_LAVORAZIONE.POP;

  const label = isVolantino ? "Volantino" : isPop ? "POP" : "Altro";
  const Icon = isVolantino ? FileText : Package;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md font-medium",
        sizeClasses[size],
        {
          "bg-theme-1/10 text-theme-1": isVolantino,
          "bg-amber-100 text-amber-700": isPop,
          "bg-slate-100 text-slate-600": !isVolantino && !isPop,
        },
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && label}
    </span>
  );
};

export default FormatoTypeIndicator;
