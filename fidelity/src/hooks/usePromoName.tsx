import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { opzioniPromo } from "@/query/condivise";
import { isUUID } from "@/utils/validation";

const SEZIONI_PROMO = ["in-corso", "storico"];

/**
 * Id della promo nel percorso. Tutte le rotte della promo sono
 * /promozioni/{in-corso|storico}/dettagli/:idPromo/...: l'id segue "dettagli". Gli altri UUID
 * del percorso (kit, tracciati, confronti) non sono promo e non si chiedono a /promo/:id.
 */
export const idPromoDalPercorso = (segmenti: string[]): string | null => {
  const [radice, sezione, dettagli, id] = segmenti;
  if (radice !== "promozioni" || !SEZIONI_PROMO.includes(sezione) || dettagli !== "dettagli") {
    return null;
  }
  return isUUID(id) ? id : null;
};

// Il nome resta in sessionStorage come prima: lo usa anche il report di confronto dei tracciati
const chiaveSessione = (idPromo: string) => `promo_${idPromo}`;

const leggiNomeSalvato = (idPromo: string | null): string | null => {
  if (!idPromo) {
    return null;
  }
  try {
    return sessionStorage.getItem(chiaveSessione(idPromo));
  } catch {
    return null;
  }
};

/**
 * Nome della promo per il breadcrumb. Usa la stessa query del dettaglio promo (chiave ["promo", id]):
 * con la pagina aperta la richiesta è una sola. Se il nome è già in sessione non si chiede nulla,
 * ma un dato più recente in cache (per esempio dopo una modifica della promo) ha la precedenza.
 */
export const useNomePromo = (idPromo: string | null) => {
  const nomeSalvato = leggiNomeSalvato(idPromo);
  const query = useQuery({
    ...opzioniPromo(idPromo),
    enabled: !!idPromo && !nomeSalvato,
    select: (promo) => promo?.nome || null,
  });
  const nomeLetto = query.data ?? null;

  useEffect(() => {
    if (!idPromo || !nomeLetto) {
      return;
    }
    try {
      sessionStorage.setItem(chiaveSessione(idPromo), nomeLetto);
    } catch {
      // sessionStorage non disponibile: il nome resta nella cache di React Query
    }
  }, [idPromo, nomeLetto]);

  return { nome: nomeLetto ?? nomeSalvato, isLoading: query.isLoading };
};
