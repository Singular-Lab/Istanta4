import { toRGB } from "./helper";

type AppColorKey =
  | "theme.1"
  | "theme.2"
  | "primary"
  | "secondary"
  | "success"
  | "info"
  | "warning"
  | "pending"
  | "danger"
  | "light"
  | "dark"
  | "darkmode.50"
  | "darkmode.100"
  | "darkmode.200"
  | "darkmode.300"
  | "darkmode.400"
  | "darkmode.500"
  | "darkmode.600"
  | "darkmode.700"
  | "darkmode.800"
  | "darkmode.900"
  | "white"
  | "slate.50"
  | "slate.100"
  | "slate.200"
  | "slate.300"
  | "slate.400"
  | "slate.500"
  | "slate.600";

const CSS_COLOR_VARIABLES: Partial<Record<AppColorKey, string>> = {
  "theme.1": "--color-theme-1",
  "theme.2": "--color-theme-2",
  primary: "--color-primary",
  secondary: "--color-secondary",
  success: "--color-success",
  info: "--color-info",
  warning: "--color-warning",
  pending: "--color-pending",
  danger: "--color-danger",
  light: "--color-light",
  dark: "--color-dark",
  "darkmode.50": "--color-darkmode-50",
  "darkmode.100": "--color-darkmode-100",
  "darkmode.200": "--color-darkmode-200",
  "darkmode.300": "--color-darkmode-300",
  "darkmode.400": "--color-darkmode-400",
  "darkmode.500": "--color-darkmode-500",
  "darkmode.600": "--color-darkmode-600",
  "darkmode.700": "--color-darkmode-700",
  "darkmode.800": "--color-darkmode-800",
  "darkmode.900": "--color-darkmode-900",
};

const STATIC_COLORS: Partial<Record<AppColorKey, string>> = {
  white: "#ffffff",
  "slate.50": "#f8fafc",
  "slate.100": "#f1f5f9",
  "slate.200": "#e2e8f0",
  "slate.300": "#cbd5e1",
  "slate.400": "#94a3b8",
  "slate.500": "#64748b",
  "slate.600": "#475569",
};

const getColor = (colorKey: AppColorKey, opacity: number = 1) => {
  const cssVariableName = CSS_COLOR_VARIABLES[colorKey];
  if (cssVariableName) {
    const cssValue = getComputedStyle(document.body)
      .getPropertyValue(cssVariableName)
      .trim();
    if (cssValue) {
      return `rgb(${cssValue} / ${opacity})`;
    }
  }

  const staticColor = STATIC_COLORS[colorKey];
  if (staticColor) {
    return `rgb(${toRGB(staticColor)} / ${opacity})`;
  }

  return `rgb(0 0 0 / ${opacity})`;
};

export { getColor };
