import clsx from "clsx";
import { AlertTriangle, Check, Info, XCircle } from "lucide-react";
import React from "react";

// Tipi per i badge
interface BadgeProps {
  variant?: "primary" | "success" | "warning" | "error" | "info" | "secondary";
  children: React.ReactNode;
  className?: string;
  withIcon?: boolean;
  border?: boolean;
  size?: "sm" | "md" | "lg";
  opacity?: "0" | "10" | "20" | "30" | "40" | "50" | "60" | "70" | "80" | "90" | "100";
}

// Badge component
const Badge: React.FC<BadgeProps> = ({ variant = "info", children, className, withIcon, border, size = "md", opacity = "100" }) => {
  const iconMap = {
    success: <Check className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    error: <XCircle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
    secondary: <Info className="h-4 w-4" />,
    primary: null
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md font-medium",
        {
          "bg-green-100 text-green-800": variant === "success",
          "bg-yellow-100 text-yellow-800": variant === "warning",
          "bg-red-100 text-red-800": variant === "error",
          "bg-blue-100 text-blue-800": variant === "info",
          "bg-gray-100 text-gray-800": variant === "secondary",
          "bg-primary/20 text-primary": variant === "primary",
        },
        {
          "border border-blue-300": border && variant === "info",
          "border border-green-300": border && variant === "success",
          "border border-yellow-300": border && variant === "warning",
          "border border-red-300": border && variant === "error",
          "border border-gray-300": border && variant === "secondary",
          "border border-primary": border && variant === "primary",
        },
        {
          "text-xs px-2 py-1": size === "sm",
          "text-sm px-3 py-1.5": size === "md",
          "text-base px-4 py-2": size === "lg",
        },
        {
          [`opacity-${opacity}`]: opacity,
        },
        className
      )}
    >
      {withIcon ? iconMap[variant] : null}
      {children}
    </span>
  );
};

export default Badge;
