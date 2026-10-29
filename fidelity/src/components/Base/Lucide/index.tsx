import type { icons } from "lucide-react";
import { useEffect, useState } from "react";
import { twMerge } from "@/utils/twMerge";
import {
  caricaMappaCompleta,
  mappaCompletaCaricata,
  risolviIconaLucide,
  type IconaLucide,
} from "./risolviIconaLucide";

interface LucideProps extends React.ComponentPropsWithoutRef<"svg"> {
  icon: keyof typeof icons | string;
  title?: string;
  is_color_theme?: boolean;
}

// I nomi delle icone sono in PascalCase: per "", "undefined" o "shopping-cart" la mappa completa non
// troverebbe nulla, e non si scarica.
const FORMA_NOME_ICONA = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Componente dell'icona `nome`. Le icone nominate nel codice si risolvono subito; per un nome
 * sconosciuto (es. dal menu del DB) carica la mappa completa di lucide-react e ridisegna quando è
 * pronta: l'icona può comparire con un piccolo ritardo. Un nome inesistente resta senza icona.
 */
function useIconaLucide(nome: string): IconaLucide | undefined {
  const [, setMappaPronta] = useState(mappaCompletaCaricata);
  const icona = risolviIconaLucide(nome);
  const serveMappa = !icona && FORMA_NOME_ICONA.test(nome) && !mappaCompletaCaricata();

  useEffect(() => {
    if (!serveMappa) return;
    let attivo = true;
    caricaMappaCompleta().then(
      () => {
        if (attivo) setMappaPronta(true);
      },
      () => {
        // Chunk non scaricato (es. rete assente): l'icona resta vuota, si ritenta al prossimo nome
      }
    );
    return () => {
      attivo = false;
    };
  }, [serveMappa]);

  return icona;
}

function Lucide(props: LucideProps) {
  const { icon, className, is_color_theme, ...computedProps } = props;
  const Component = useIconaLucide(String(icon));

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
