import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import type { AuthProviderDTO } from "../../../../lib/types";

const isImageIcon = (icona: string) =>
  icona.startsWith("data:image/") || icona.startsWith("http://") || icona.startsWith("https://");

interface ProviderCardProps {
  provider: AuthProviderDTO;
  isExpanded: boolean;
  isLoading?: boolean;
  onClick: () => void;
  index: number;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, isExpanded, isLoading, onClick, index }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={clsx(
        "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 text-left",
        "border border-slate-200/50 hover:border-theme-1/30",
        "hover:bg-theme-1/5 hover:shadow-lg hover:-translate-y-0.5",
        isExpanded && "bg-theme-1/5 border-theme-1/30 shadow-md",
        isLoading && "opacity-70 cursor-not-allowed",
        "animate-fade-in-up"
      )}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-theme-1/10 text-theme-1 shrink-0">
        {isLoading ? (
          <Lucide icon="Loader" className="w-5 h-5 animate-spin" />
        ) : isImageIcon(provider.icona) ? (
          <img src={provider.icona} alt={provider.nome} className="w-5 h-5 object-contain" />
        ) : (
          <Lucide icon={provider.icona as any} className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800 text-sm">{provider.nome}</div>
        {isLoading ? (
          <div className="text-xs text-theme-1">Connessione in corso...</div>
        ) : provider.descrizione ? (
          <div className="text-xs text-slate-500 truncate">{provider.descrizione}</div>
        ) : null}
      </div>
      {!isLoading && (
        <Lucide
          icon={isExpanded ? "ChevronDown" : "ChevronRight"}
          className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200"
        />
      )}
    </button>
  );
};

export default ProviderCard;
