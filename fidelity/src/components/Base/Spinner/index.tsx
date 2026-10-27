import { Loader2 } from "lucide-react";
import { twMerge } from "@/utils/twMerge";

const MISURE = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
} as const;

interface SpinnerProps {
  size?: keyof typeof MISURE;
  /** Testo letto dagli screen reader; con `decorativo` lo spinner non annuncia nulla. */
  etichetta?: string;
  /** Spinner dentro un elemento che annuncia già il caricamento (per esempio un Button). */
  decorativo?: boolean;
  className?: string;
}

/** Indicatore di caricamento unico di Fidelity. */
function Spinner({ size = "md", etichetta = "Caricamento…", decorativo = false, className }: SpinnerProps) {
  const icona = (
    <Loader2
      aria-hidden="true"
      className={twMerge("animate-spin text-theme-1", MISURE[size], className)}
    />
  );

  if (decorativo) {
    return icona;
  }

  return (
    <span role="status" className="inline-flex items-center">
      {icona}
      <span className="sr-only">{etichetta}</span>
    </span>
  );
}

export default Spinner;
