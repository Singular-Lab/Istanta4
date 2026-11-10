import type { Tinta } from "@/components/Grafici";
import { PuntoInsegna } from "@/pages/PuntiVenditaConsultazione/componenti";
import { twMerge } from "@/utils/twMerge";
import { createContext, useContext, useState, type CSSProperties } from "react";

/**
 * I loghi delle insegne della promozione (Impostazioni GDO, Loghi delle insegne), per id del canale:
 * li mette la pagina, li legge ogni LogoInsegna senza passarli di componente in componente.
 */
export const LoghiInsegneContext = createContext<Readonly<Record<string, string>>>({});

const MISURE = {
  /** Accanto ai nomi nelle tabelle e negli elenchi. */
  piccolo: "h-5 max-w-[3.25rem]",
  /** Sotto le miniature e nella banda. */
  medio: "h-7 max-w-[4.5rem]",
} as const;

export interface LogoInsegnaProps {
  idCanale: string;
  /** Il colore dell'insegna: bordo del logo, o il pallino quando il logo non c'è. */
  tinta: Tinta;
  misura?: keyof typeof MISURE;
  className?: string;
}

/**
 * Il logo dell'insegna su un riquadro bianco, con il bordo nel colore dell'insegna dei grafici e
 * della mappa; senza logo, o se non si carica, il pallino colorato. È decorativo: il nome
 * dell'insegna lo scrive chi lo usa.
 */
export function LogoInsegna({ idCanale, tinta, misura = "piccolo", className }: LogoInsegnaProps) {
  const loghi = useContext(LoghiInsegneContext);
  const logo = loghi[idCanale];
  // Il logo che non si è caricato: un logo diverso per la stessa insegna si riprova
  const [rotto, setRotto] = useState<string | null>(null);

  if (!logo || rotto === logo) return <PuntoInsegna tinta={tinta} />;

  const bordo: CSSProperties | undefined = tinta.colore ? { boxShadow: `0 0 0 1.5px ${tinta.colore}` } : undefined;
  return (
    <img
      src={logo}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setRotto(logo)}
      style={bordo}
      className={twMerge(
        "w-auto flex-none rounded-control bg-white object-contain p-0.5",
        !bordo && "ring-1 ring-slate-200 dark:ring-darkmode-300",
        MISURE[misura],
        className
      )}
    />
  );
}

export default LogoInsegna;
