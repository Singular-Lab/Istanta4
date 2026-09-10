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
  className?: string;
  iconColor?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  buttonText,
  onButtonClick,
  className = "",
  iconColor = "text-primary",
}) => {
  return (
    <div className={clsx(styleEmptyState["empty-state"], className)}>
      <div className={styleEmptyState["empty-state__icon"]}>
        <Lucide
          icon={icon}
          className={clsx(iconColor)}
        />
      </div>
      <h2 className={styleEmptyState["empty-state__title"]}>{title}</h2>
      <p className={styleEmptyState["empty-state__description"]}>
        {description}
      </p>
      {buttonText && (
        <Button 
          variant="outline-primary" 
          onClick={()=>{
            onButtonClick?.();
          }}
          className={styleEmptyState["empty-state__button"]}
        >
          <Lucide
            icon="RefreshCw"
            className={styleEmptyState["empty-state__button-icon"]}
          />
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
