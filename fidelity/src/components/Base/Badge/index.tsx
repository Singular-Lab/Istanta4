import type { TonoStato } from "@/constants/stati";
import { AlertTriangle, Check, Info, XCircle } from "lucide-react";
import React from "react";
import { twMerge } from "@/utils/twMerge";

type Variante = "primary" | "success" | "warning" | "error" | "info" | "secondary";
type Opacita = "0" | "10" | "20" | "30" | "40" | "50" | "60" | "70" | "80" | "90" | "100";

interface BadgeProps {
  variant?: Variante;
  children: React.ReactNode;
  className?: string;
  withIcon?: boolean;
  border?: boolean;
  size?: "sm" | "md" | "lg";
  /** @deprecated Per uno stato attenuato usa StatusBadge con tono neutral. */
  opacity?: Opacita;
}

// Stessi toni di StatusBadge: un'etichetta ha lo stesso aspetto in tutte le pagine
const TONO_VARIANTE: Record<Variante, TonoStato> = {
  primary: "brand",
  success: "success",
  warning: "warning",
  error: "danger",
  info: "info",
  secondary: "neutral",
};

const CLASSI_TONO: Record<TonoStato, { pastiglia: string; bordo: string }> = {
  neutral: { pastiglia: "bg-slate-100 text-slate-700", bordo: "border-slate-300" },
  info: { pastiglia: "bg-sky-100 text-sky-800", bordo: "border-sky-200" },
  brand: { pastiglia: "bg-theme-1/10 text-theme-1", bordo: "border-theme-1/30" },
  success: { pastiglia: "bg-teal-100 text-teal-800", bordo: "border-teal-200" },
  warning: { pastiglia: "bg-amber-100 text-amber-800", bordo: "border-amber-200" },
  danger: { pastiglia: "bg-red-100 text-red-700", bordo: "border-red-200" },
};

const MISURE = {
  sm: { pastiglia: "gap-1 px-2 py-0.5 text-2xs", icona: "h-3 w-3" },
  md: { pastiglia: "gap-1.5 px-2.5 py-0.5 text-xs", icona: "h-3.5 w-3.5" },
  lg: { pastiglia: "gap-1.5 px-3 py-1 text-sm", icona: "h-4 w-4" },
} as const;

// Classi scritte per intero: Tailwind non genera quelle composte a runtime
const OPACITA: Record<Opacita, string> = {
  "0": "opacity-0",
  "10": "opacity-10",
  "20": "opacity-20",
  "30": "opacity-30",
  "40": "opacity-40",
  "50": "opacity-50",
  "60": "opacity-60",
  "70": "opacity-70",
  "80": "opacity-80",
  "90": "opacity-90",
  "100": "",
};

const ICONE: Record<Variante, typeof Info | null> = {
  success: Check,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  secondary: Info,
  primary: null,
};

/** Etichetta a pillola con i toni di StatusBadge; per lo stato di un oggetto usa StatusBadge. */
const Badge: React.FC<BadgeProps> = ({ variant = "info", children, className, withIcon, border, size = "md", opacity = "100" }) => {
  const tono = TONO_VARIANTE[variant];
  const misura = MISURE[size];
  const Icona = withIcon ? ICONE[variant] : null;

  return (
    <span
      data-tono={tono}
      className={twMerge(
        "inline-flex max-w-full items-center whitespace-nowrap rounded-full font-medium",
        CLASSI_TONO[tono].pastiglia,
        misura.pastiglia,
        border && ["border", CLASSI_TONO[tono].bordo],
        OPACITA[opacity],
        className
      )}
    >
      {Icona && <Icona aria-hidden="true" className={twMerge("flex-none", misura.icona)} />}
      {children}
    </span>
  );
};

export default Badge;
