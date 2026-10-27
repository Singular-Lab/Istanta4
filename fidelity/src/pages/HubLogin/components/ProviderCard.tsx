import Lucide from "@/components/Base/Lucide";
import Spinner from "@/components/Base/Spinner";
import clsx from "clsx";
import type { AuthProviderDTO } from "../../../../lib/types";

const isImageIcon = (icona: string) =>
  icona.startsWith("data:image/") || icona.startsWith("http://") || icona.startsWith("https://");

interface ProviderCardProps {
  provider: AuthProviderDTO;
  onClick: () => void;
  /** Posizione nell'elenco: ritarda l'animazione d'ingresso. */
  index: number;
  /** Testo principale; predefinito il nome del provider. */
  titolo?: string;
  /** Riga secondaria; predefinita la descrizione del provider. */
  descrizione?: string;
  isExpanded?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  /** Icona a destra: freccia di espansione (predefinita), collegamento esterno o nessuna. */
  indicatore?: "espandi" | "esterno" | "nessuno";
}

/** Tessera di un metodo di accesso, usata dal login e dal recupero della password. */
const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onClick,
  index,
  titolo = provider.nome,
  descrizione = provider.descrizione,
  isExpanded = false,
  isLoading = false,
  disabled = false,
  indicatore = "espandi",
}) => {
  const attiva = !isLoading && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!attiva}
      aria-busy={isLoading || undefined}
      className={clsx(
        "flex w-full items-center gap-4 rounded-card border border-slate-200/50 p-4 text-left transition-all duration-300",
        attiva && "cursor-pointer hover:-translate-y-0.5 hover:border-theme-1/30 hover:bg-theme-1/5 hover:shadow-lg",
        isExpanded && "border-theme-1/30 bg-theme-1/5 shadow-md",
        isLoading && "cursor-not-allowed opacity-70",
        disabled && !isLoading && "cursor-not-allowed opacity-60",
        "animate-fade-in-up"
      )}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-theme-1/10 text-theme-1">
        {isLoading ? (
          <Spinner size="sm" decorativo />
        ) : isImageIcon(provider.icona) ? (
          <img src={provider.icona} alt={provider.nome} className="h-5 w-5 object-contain" />
        ) : (
          <Lucide icon={provider.icona} aria-hidden="true" className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800">{titolo}</div>
        {isLoading ? (
          <div className="text-xs text-theme-1">Connessione in corso...</div>
        ) : descrizione ? (
          <div className="truncate text-xs text-slate-500">{descrizione}</div>
        ) : null}
      </div>
      {!isLoading && indicatore !== "nessuno" && (
        <Lucide
          icon={indicatore === "esterno" ? "ExternalLink" : isExpanded ? "ChevronDown" : "ChevronRight"}
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200"
        />
      )}
    </button>
  );
};

export default ProviderCard;
