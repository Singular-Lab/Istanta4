import { useQuery } from "@tanstack/react-query";
import { ServerCall } from "../../lib/server_call";
import { IPromo } from "../../lib/types";
import type { PromoResponseDTO } from "../../server/core/dto";

interface UsePromoNameOptions {
  promoId: string;
  enabled?: boolean;
}

export const usePromoName = ({ promoId, enabled = true }: UsePromoNameOptions) => {
  return useQuery({
    queryKey: ['promo-name', promoId],
    queryFn: async (): Promise<string> => {
      // Prima controlla la cache locale
      const cached = sessionStorage.getItem(`promo_${promoId}`);
      if (cached) {
        return cached;
      }

      // Se non è in cache, recupera dal server
      const promo = await ServerCall.get<IPromo>(`/promo/${promoId}`);
      if (promo && promo.nomePromo) {
        // Salva in cache
        sessionStorage.setItem(`promo_${promoId}`, promo.nomePromo);
        return promo.nomePromo;
      }

      throw new Error('Nome promo non trovato');
    },
    enabled: enabled && !!promoId,
    staleTime: 10 * 60 * 1000, // 10 minuti
    retry: 2,
  });
};

export const usePromoNames = (promoIds: string[]) => {
  return useQuery({
    queryKey: ['promo-names', promoIds],
    queryFn: async (): Promise<{ [key: string]: string }> => {
      const promoDetails: { [key: string]: string } = {};

      for (const id of promoIds) {
        try {
          // Prima controlla la cache locale
          const cached = sessionStorage.getItem(`promo_${id}`);
          if (cached) {
            promoDetails[id] = cached;
            continue;
          }

          // Se non è in cache, recupera dal server
          const promo = await ServerCall.get<PromoResponseDTO>(`/promo/${id}`);
          if (promo && promo.nome) {
            promoDetails[id] = promo.nome;
            sessionStorage.setItem(`promo_${id}`, promo.nome);
          }
        } catch (error) {
          console.error(`Errore nel recupero della promo ${id}:`, error);
        }
      }

      return promoDetails;
    },
    enabled: promoIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minuti
    retry: 2,
  });
};
