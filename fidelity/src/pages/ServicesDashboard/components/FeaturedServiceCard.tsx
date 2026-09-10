import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import type { HubServiceDTO } from "../../../../lib/types";

interface FeaturedServiceCardProps {
  service: HubServiceDTO;
  index: number;
  isLoading?: boolean;
  disableInteractions?: boolean;
  onClick: () => void;
}

const colorMap: Record<string, { gradient: string; text: string; iconBg: string; button: string }> = {
  primary: { gradient: "from-theme-1 to-theme-2", text: "text-white", iconBg: "bg-white/20", button: "bg-white/20 hover:bg-white/30" },
  info: { gradient: "from-cyan-500 to-blue-600", text: "text-white", iconBg: "bg-white/20", button: "bg-white/20 hover:bg-white/30" },
  success: { gradient: "from-emerald-500 to-teal-600", text: "text-white", iconBg: "bg-white/20", button: "bg-white/20 hover:bg-white/30" },
  warning: { gradient: "from-amber-500 to-orange-600", text: "text-white", iconBg: "bg-white/20", button: "bg-white/20 hover:bg-white/30" },
  danger: { gradient: "from-red-500 to-rose-600", text: "text-white", iconBg: "bg-white/20", button: "bg-white/20 hover:bg-white/30" },
};

function isBase64Icon(icona: string): boolean {
  return icona?.startsWith("data:");
}

const FeaturedServiceCard: React.FC<FeaturedServiceCardProps> = ({
  service,
  index,
  isLoading = false,
  disableInteractions = false,
  onClick,
}) => {
  const isUnavailable = !service.attivo || service.in_manutenzione;
  const colors = !service.attivo
    ? {
        gradient: "from-slate-500 to-slate-600",
        text: "text-white",
        iconBg: "bg-white/15",
        button: "bg-white/10",
      }
    : service.in_manutenzione
      ? {
          gradient: "from-amber-500 to-orange-600",
          text: "text-white",
          iconBg: "bg-white/20",
          button: "bg-white/15",
        }
      : colorMap[service.colore] || colorMap.primary;
  const isDisabled = isUnavailable || disableInteractions;
  const statusLabel = !service.attivo
    ? "Disattivo"
    : service.in_manutenzione
      ? "In manutenzione"
      : null;
  const footerLabel = !service.attivo
    ? "Servizio disattivato"
    : service.in_manutenzione
      ? "Temporaneamente non disponibile"
      : (service.tipo_url === "external" || service.tipo_url === "external_fico")
        ? "Apri servizio"
        : "Accedi ora";
  const footerIcon = !service.attivo
    ? "CircleOff"
    : service.in_manutenzione
      ? "Wrench"
      : (service.tipo_url === "external" || service.tipo_url === "external_fico")
        ? "ExternalLink"
        : "ArrowRight";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={clsx(
        "w-full text-left rounded-2xl p-6 sm:p-8 relative overflow-hidden",
        "bg-gradient-to-br", colors.gradient,
        "shadow-lg transition-all duration-300",
        !isDisabled && "hover:shadow-2xl hover:scale-[1.01] hover:-translate-y-0.5",
        isLoading && "ring-2 ring-white/45",
        isDisabled && "opacity-70 cursor-not-allowed",
        "focus:outline-none focus:ring-2 focus:ring-white/40",
        "animate-fade-in-up"
      )}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/3" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={clsx("w-16 h-16 rounded-2xl flex items-center justify-center", colors.iconBg)}>
            {isBase64Icon(service.icona) ? (
              <img
                src={service.icona}
                alt={service.nome}
                className={clsx(
                  "w-9 h-9 object-contain brightness-0 invert",
                  isUnavailable && "opacity-80"
                )}
              />
            ) : (
              <Lucide
                icon={service.icona as any}
                className={clsx("w-8 h-8 text-white", isUnavailable && "opacity-90")}
              />
            )}
          </div>

          {statusLabel && (
            <span className="px-3 py-1 text-xs font-semibold bg-white/20 text-white rounded-full backdrop-blur-sm">
              {statusLabel}
            </span>
          )}
        </div>

        <h3 className="font-space-grotesk font-bold text-xl sm:text-2xl text-white mb-2">
          {service.nome}
        </h3>
        <p className="text-white/80 text-sm leading-relaxed mb-5 line-clamp-2">
          {service.descrizione}
        </p>

        {isLoading ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-white/20">
            <Lucide icon="Loader2" className="w-4 h-4 animate-spin" />
            Apertura servizio...
          </div>
        ) : (
          <div className={clsx(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors",
            colors.button
          )}>
            {footerLabel}
            <Lucide
              icon={footerIcon as any}
              className="w-4 h-4"
            />
          </div>
        )}
      </div>
    </button>
  );
};

export default FeaturedServiceCard;
