import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import type { HubServiceDTO } from "../../../../lib/types";

interface ServiceCardProps {
  service: HubServiceDTO;
  index: number;
  isLoading?: boolean;
  disableInteractions?: boolean;
  onClick: () => void;
  onInfoClick: () => void;
}

function isBase64Icon(icona: string): boolean {
  return typeof icona === "string" && icona.startsWith("data:");
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  index,
  isLoading = false,
  disableInteractions = false,
  onClick,
  onInfoClick,
}) => {
  const hasImage = isBase64Icon(service.icona);
  const isUnavailable = !service.attivo || service.in_manutenzione;
  const canOpenService = !isUnavailable && !disableInteractions;
  const isInfoDisabled = disableInteractions || isLoading;
  const status = !service.attivo
    ? {
      label: "Disattivo",
      badgeClassName: "bg-slate-100 text-slate-600",
      dotClassName: "bg-slate-400",
      footerIcon: "CircleOff",
      footerLabel: "Servizio disattivato",
    }
    : service.in_manutenzione
      ? {
        label: "Manutenzione",
        badgeClassName: "bg-amber-50 text-amber-700",
        dotClassName: "bg-amber-500",
        footerIcon: "Wrench",
        footerLabel: "Temporaneamente non disponibile",
      }
      : {
        label: "Attivo",
        badgeClassName: "bg-emerald-50 text-emerald-700",
        dotClassName: "bg-emerald-500",
        footerIcon: (service.tipo_url === "external" || service.tipo_url === "external_fico") ? "ExternalLink" : "ArrowRight",
        footerLabel: (service.tipo_url === "external" || service.tipo_url === "external_fico") ? "Apri" : "Accedi",
      };

  return (
    <div
      role={canOpenService ? "button" : undefined}
      tabIndex={canOpenService ? 0 : -1}
      onClick={canOpenService ? onClick : undefined}
      onKeyDown={canOpenService ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      aria-busy={isLoading}
      className={clsx(
        "w-full text-left rounded-xl border border-slate-200",
        "transition-all duration-300 p-5 shadow-sm",
        isUnavailable ? "bg-slate-50/90" : "bg-white",
        canOpenService && [
          "cursor-pointer",
          "hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300",
        ],
        isLoading && "ring-2 ring-theme-1/20",
        "focus:outline-none focus:ring-2 focus:ring-slate-300",
        isUnavailable && "opacity-60",
        disableInteractions &&
        "cursor-not-allowed hover:translate-y-0 hover:shadow-sm hover:border-slate-200",
        "animate-fade-in-up"
      )}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      {hasImage ? (
        <div className={clsx(
          "mb-4 h-28 rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-center",
          isUnavailable ? "bg-slate-100/80" : "bg-slate-50"
        )}>
          <img
            src={service.icona}
            alt={service.nome}
            className={clsx(
              "w-full h-full object-contain",
              isUnavailable && "grayscale opacity-75"
            )}
          />
        </div>
      ) : (
        <div className="mb-4">
          <div className={clsx(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            isUnavailable ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-700"
          )}>
            <Lucide icon={service.icona as any} className="w-6 h-6" />
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-space-grotesk font-semibold text-lg text-slate-800 leading-tight">
          {service.nome}
        </h3>
        <div
          className={clsx(
            "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            status.badgeClassName
          )}
        >
          <div
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              status.dotClassName
            )}
          />
          {status.label}
        </div>
      </div>

      <p className={clsx(
        "text-sm leading-relaxed line-clamp-2 min-h-[2.6rem]",
        isUnavailable ? "text-slate-400" : "text-slate-500"
      )}>
        {service.descrizione}
      </p>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!canOpenService) return;
            onClick();
          }}
          disabled={!canOpenService}
          className={clsx(
            "group inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed",
            isUnavailable ? "text-slate-500" : "text-slate-700 hover:text-slate-900"
          )}
          aria-label={isUnavailable ? status.footerLabel : `${status.footerLabel} ${service.nome}`}
        >
          {isLoading ? (
            <>
              <Lucide icon="Loader2" className="w-3.5 h-3.5 animate-spin" />
              <span>Apertura servizio...</span>
            </>
          ) : isUnavailable ? (
            <>
              <Lucide icon={status.footerIcon as any} className="w-3.5 h-3.5" />
              <span>{status.footerLabel}</span>
            </>
          ) : (
            <>
              <span>{status.footerLabel}</span>
              <Lucide
                icon={status.footerIcon as any}
                className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </>
          )}
        </button>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onInfoClick();
            }}
            disabled={isInfoDisabled}
            className={clsx(
              "ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
              "text-xs font-medium",
              "bg-theme-1/10 text-theme-1 border border-theme-1/20",
              "hover:bg-theme-1/20 hover:border-theme-1/30",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-theme-1/30",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            aria-label={`Mostra info su ${service.nome}`}
          >
            <Lucide icon="Info" className="w-3 h-3" />
            <span>Info</span>
          </button>
        )}
      </div>

    </div>
  );
};

export default ServiceCard;
