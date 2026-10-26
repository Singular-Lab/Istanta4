import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { FC } from "react";
import { Link } from "react-router-dom";
import { STATO_PROMO } from "../../../../lib/enums";
import { getStateConfig } from "../config/stateConfig";
import { HeroBannerProps } from "../types";

dayjs.locale("it");

/**
 * HeroBanner - Banner principale del kit che cambia colore in base allo stato.
 *
 * Stati supportati:
 * - PIANIFICATA / IN_LAVORAZIONE: Blu/Primary
 * - IN_SCADENZA / IN_RITARDO: Arancione/Warning
 * - VALIDA / VALIDA_CON_ERRORI: Verde/Success
 * - ARCHIVIATA / ELIMINATA: Toni neutri
 */
const HeroBanner: FC<HeroBannerProps> = ({
  lavorazione,
  stato,
  productionDuration,
  isTimerLive,
  primaryAction,
  secondaryActions
}) => {
  const config = getStateConfig(stato);
  const { hero } = config;

  const isPromoFinalState = (promoState?: STATO_PROMO | null) =>
    promoState === STATO_PROMO.VALIDA ||
    promoState === STATO_PROMO.VALIDA_CON_ERRORI ||
    promoState === STATO_PROMO.ARCHIVIATA;

  // Pattern SVG per sfondo
  const bgPattern =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIj48cGF0aCBkPSJNLTE1IDE1TDQ1IDc1TTYwIDBMMCA2MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTAgMEw2MCA2MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==";

  return (
    <div className={clsx(
      "relative overflow-hidden rounded-2xl p-8",
      `bg-gradient-to-br ${hero.gradient}`
    )}>
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: `url('${bgPattern}')` }}
      />

      {/* Content */}
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left Side - Icon and Info */}
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Lucide icon={hero.icon} className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {lavorazione.titolo}
              </h2>
              <p className="text-white/80 text-sm">
                {hero.subtitle}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                  <Lucide icon="Calendar" className="h-3 w-3" />
                  {dayjs(lavorazione.updatedAt || lavorazione.createdAt).format("DD MMMM YYYY, HH:mm")}
                </span>
                {productionDuration && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                    <Lucide icon="Clock" className="h-3 w-3" />
                    Tempo: {productionDuration}
                    {isTimerLive && (
                      <span className="relative flex h-2 w-2 ml-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Link to Promozione */}
            {lavorazione.idPromo && (
              <Link to={`/${isPromoFinalState(lavorazione.promo?.stato) ? 'promozioni/storico' : 'promozioni/in-corso'}/dettagli/${lavorazione.idPromo}`}>
                <Button
                  variant="outline-secondary"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Lucide icon="ArrowLeft" className="h-4 w-4 mr-2" />
                  Vai alla Promozione
                </Button>
              </Link>
            )}

            {/* Secondary Actions */}
            {secondaryActions?.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant === "danger" ? "danger" : "outline-secondary"}
                className={clsx(
                  action.variant !== "danger" && "bg-white/10 border-white/30 text-white hover:bg-white/20"
                )}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
              >
                {action.loading ? (
                  <Lucide icon="Loader" className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lucide icon={action.icon as any} className="h-4 w-4 mr-2" />
                )}
                {action.label}
              </Button>
            ))}

            {/* Primary Action */}
            {primaryAction && (
              <Button
                variant="primary"
                className="bg-white text-slate-800 hover:bg-white/90 shadow-lg"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.loading}
              >
                {primaryAction.loading ? (
                  <Lucide icon="Loader" className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lucide icon={primaryAction.icon as any} className="h-4 w-4 mr-2" />
                )}
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
