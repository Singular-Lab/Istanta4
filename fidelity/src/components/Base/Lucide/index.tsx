import { icons } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface LucideProps extends React.ComponentPropsWithoutRef<"svg"> {
  icon: keyof typeof icons | string;
  title?: string;
  is_color_theme?: boolean;
}

function Lucide(props: LucideProps) {
  const { icon, className, is_color_theme, ...computedProps } = props;
  const Component = (icons as Record<string, typeof icons[keyof typeof icons]>)[String(icon)];

  // Classe oggetto per lo stile richiesto
  const baseStyle = {
    flex: "none",
    opacity: 0.8,
    stroke: "rgb(var(--color-theme-1) / 1)",
    fill: "rgb(var(--color-theme-1) / 10%)",
  };

  return Component ? (
    <Component
      strokeWidth={1.3}
      {...computedProps}
      style={is_color_theme ? baseStyle : { ...props.style }}
      className={twMerge(["w-5 h-5", className])}
      absoluteStrokeWidth={true}
    />
  ) : null;
}

export default Lucide;
