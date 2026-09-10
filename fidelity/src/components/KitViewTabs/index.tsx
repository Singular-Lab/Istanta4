import clsx from "clsx";
import { Eye, Settings } from "lucide-react";
import React from "react";
import { TIPO_KIT_DESIGN } from "../../../lib/enums";
import Badge from "../Base/Badge";

type TabType = "scheda" | "lavorazione";

interface KitViewTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  tipoKit: TIPO_KIT_DESIGN;
  className?: string;
}

const KitViewTabs: React.FC<KitViewTabsProps> = ({
  activeTab,
  onTabChange,
  tipoKit,
  className,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "scheda",
      label: "Scheda",
      icon: <Eye className="h-4 w-4" />,
    },
    {
      id: "lavorazione",
      label: "Lavorazione",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const getTipoKitBadge = () => {
    switch (tipoKit) {
      case TIPO_KIT_DESIGN.MANUALE:
        return (
          <Badge variant="secondary" size="sm">
            Manuale
          </Badge>
        );
      case TIPO_KIT_DESIGN.AUTOMATICO:
        return (
          <Badge variant="info" size="sm">
            Automatico
          </Badge>
        );
      case TIPO_KIT_DESIGN.SEMI_AUTOMATICO:
        return (
          <Badge variant="warning" size="sm">
            Semi-Automatico
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={clsx(
        "flex items-center justify-between border-b border-slate-200 mb-5",
        className
      )}
    >
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-theme-1 text-theme-1"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pb-2">{getTipoKitBadge()}</div>
    </div>
  );
};

export default KitViewTabs;
