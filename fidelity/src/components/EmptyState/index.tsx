// EmptyState.tsx
import React from "react";
import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { icons } from "lucide-react";
import clsx from "clsx";
import styleEmptyState from "./emptystate.module.scss";

interface EmptyStateProps {
  icon: keyof typeof icons;
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
  buttonIcon?: keyof typeof icons;
  className?: string;
  /** Classi dell'icona (colore, misura); predefinita grigia come la sua tessera. */
  iconColor?: string;
  /** Variante per sezioni e tabelle: meno spazio, icona più piccola e titolo h3 sotto l'h2 della sezione. */
  compatta?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  buttonText,
  onButtonClick,
  buttonIcon = "RefreshCw",
  className = "",
  iconColor,
  compatta = false,
}) => {
  const Titolo = compatta ? "h3" : "h2";

  return (
    <div
      className={clsx(
        styleEmptyState["empty-state"],
        compatta && styleEmptyState["empty-state--compatta"],
        className
      )}
    >
      <div className={styleEmptyState["empty-state__icon"]}>
        <Lucide
          icon={icon}
          aria-hidden="true"
          className={clsx(compatta ? "h-5 w-5" : "h-6 w-6", iconColor)}
        />
      </div>
      <Titolo className={clsx("title-section", styleEmptyState["empty-state__title"])}>{title}</Titolo>
      {description && (
        <p className={styleEmptyState["empty-state__description"]}>
          {description}
        </p>
      )}
      {buttonText && (
        <Button
          variant="outline-primary"
          size={compatta ? "sm" : undefined}
          onClick={()=>{
            onButtonClick?.();
          }}
          className={styleEmptyState["empty-state__button"]}
        >
          <Lucide
            icon={buttonIcon}
            aria-hidden="true"
            className={styleEmptyState["empty-state__button-icon"]}
          />
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
