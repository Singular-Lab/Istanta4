import { createContext, ReactNode, useContext } from "react";
import { useWebpliantParamsManager } from "@/hooks/useWebpliantParamsManager";

/**
 * useWebpliantParamsManager sincronizza URL e store, crea sessione e wishlist: basta un'istanza
 * per pagina. Prima ogni card del volantino ne montava una (effetti, timer, useLocation per card).
 * Questo contesto dice ai componenti sotto il layout che il gestore c'e gia.
 */
const GestoreParametriContext = createContext(false);

/** Avvolge un sottoalbero che ha gia il suo gestore dei parametri (il layout del volantino). */
export function GestoreParametriPresente({ children }: { children: ReactNode }) {
  return <GestoreParametriContext.Provider value={true}>{children}</GestoreParametriContext.Provider>;
}

function GestoreParametri({ children }: { children: ReactNode }) {
  useWebpliantParamsManager();
  return <GestoreParametriPresente>{children}</GestoreParametriPresente>;
}

/**
 * Garantisce un gestore dei parametri senza duplicarlo: sotto il layout del volantino non fa
 * niente; fuori (anteprima dell'editor, lettore di codici a barre) ne monta uno solo per il
 * sottoalbero, come prima faceva ogni card.
 */
export function ConGestoreParametriWebpliant({ children }: { children: ReactNode }) {
  const presente = useContext(GestoreParametriContext);
  return presente ? <>{children}</> : <GestoreParametri>{children}</GestoreParametri>;
}
