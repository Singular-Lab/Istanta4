import type { Tinta } from "@/components/Grafici";
import { twMerge } from "@/utils/twMerge";
import { createContext, useContext, useState, type CSSProperties } from "react";

/**
 * I loghi delle insegne della promozione (Impostazioni GDO, Loghi delle insegne), per id del canale:
 * li mette la pagina, li legge ogni LogoInsegna senza passarli di componente in componente.
 */
export const LoghiInsegneContext = createContext<Readonly<Record<string, string>>>({});

const MISURE = {
  /** Accanto ai nomi nelle tabelle, nei numeri chiave e nella mappa: 48 × 28 px. */
  piccolo: { riquadro: "h-7 w-12", iniziali: "text-[0.6875rem]" },
  /** Sotto le miniature e nella banda: 76 × 42 px. */
  medio: { riquadro: "h-[2.625rem] w-[4.75rem]", iniziali: "text-sm" },
} as const;

export interface LogoInsegnaProps {
  idCanale: string;
  /** Nome dell'insegna: le sue iniziali quando il logo non c'è. */
  nome: string;
  /** Il colore dell'insegna dei grafici: la barretta sotto il logo, o il fondo delle iniziali. */
  tinta: Tinta;
  misura?: keyof typeof MISURE;
  className?: string;
}

/** "Superstore" → "SU", "Conad City" → "CC". */
export const inizialiInsegna = (nome: string): string => {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return "?";
  const iniziali = parole.length === 1 ? (parole[0] ?? "").slice(0, 2) : parole.slice(0, 2).map(p => p.slice(0, 1)).join("");
  return iniziali.toLocaleUpperCase("it");
};

/**
 * Il logo dell'insegna in un riquadro di misura fissa, uguale per tutte le insegne, così i nomi accanto
 * restano allineati: fondo bianco anche nel tema scuro, logo intero e centrato, e una barretta del colore
 * dell'insegna sotto. Senza logo, o se non si carica, le iniziali dell'insegna sul suo colore. È
 * decorativo: il nome dell'insegna lo scrive chi lo usa.
 */
export function LogoInsegna({ idCanale, nome, tinta, misura = "piccolo", className }: LogoInsegnaProps) {
  const loghi = useContext(LoghiInsegneContext);
  const logo = loghi[idCanale];
  // Il logo che non si è caricato: un logo diverso per la stessa insegna si riprova
  const [rotto, setRotto] = useState<string | null>(null);
  const misure = MISURE[misura];
  const conLogo = Boolean(logo) && rotto !== logo;
  const colore: CSSProperties | undefined = tinta.colore ? { backgroundColor: tinta.colore } : undefined;

  return (
    <span
      aria-hidden="true"
      data-logo-insegna={conLogo ? "logo" : "iniziali"}
      className={twMerge(
        "relative inline-flex flex-none items-center justify-center overflow-hidden rounded-md",
        conLogo ? "border border-slate-200 bg-white dark:border-white/20" : !colore && "bg-slate-500",
        misure.riquadro,
        className
      )}
      style={conLogo ? undefined : colore}
    >
      {conLogo ? (
        <>
          <img src={logo} alt="" loading="lazy" onError={() => setRotto(logo ?? null)} className="h-full w-full object-contain px-1 pb-1.5 pt-1" />
          <span className={twMerge("absolute inset-x-0 bottom-0 h-[3px]", !colore && "bg-slate-400")} style={colore} />
        </>
      ) : (
        // Le iniziali stanno nel ::before: decorative, non entrano nel testo della riga che il nome già dice
        <span
          data-iniziali={inizialiInsegna(nome)}
          className={twMerge("font-extrabold tracking-wide before:content-[attr(data-iniziali)]", misure.iniziali, tinta.classeTesto || "text-white")}
        />
      )}
    </span>
  );
}

export default LogoInsegna;
