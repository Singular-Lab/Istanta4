import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { ServerCall } from "../../lib/server_call";
import type { AreaResponseDTO, CanaleResponseDTO, PromoResponseDTO } from "../../server/core/dto";

/*
 * Query lette da più pagine, o da una pagina e dal layout: chiave e richiesta stanno qui,
 * così chi le usa condivide la stessa cache e la stessa richiesta in volo.
 */

/** Promo per id: la legge il dettaglio della promo e il breadcrumb ne mostra il nome. */
export const opzioniPromo = (idPromo: string | null | undefined) => ({
  queryKey: ["promo", idPromo ?? null] as const,
  queryFn: () => ServerCall.get<PromoResponseDTO>(`/promo/${idPromo}`),
  enabled: !!idPromo,
});

/** Stesse chiavi di PolicyDiVisualizzazione: aree e canali della GDO sono una cache sola. */
export const CHIAVE_AREE_GDO = ["allAreeForGDO"] as const;
export const CHIAVE_CANALI_GDO = ["allCanaliForGDO"] as const;

// Promesse di un loader già lette da una query, o scadute: non si leggono una seconda volta
const promesseLette = new WeakSet<Promise<unknown>>();

type OpzioniConLoader<TDati, TSelezione> = Omit<UseQueryOptions<TDati, Error, TSelezione>, "queryFn"> & {
  queryFn: () => Promise<TDati>;
};

/**
 * useQuery che, nella navigazione in cui il loader della rotta ha già avviato la stessa richiesta,
 * ne usa la risposta invece di ripeterla. La promessa vale solo per il caricamento di quella
 * navigazione: passato il commit in cui compare scade, e i refetch successivi (Riprova,
 * invalidazioni) chiamano di nuovo il servizio. Senza promessa è una useQuery come le altre.
 */
export function useQueryConLoader<TDati, TSelezione = TDati>(
  opzioni: OpzioniConLoader<TDati, TSelezione>,
  promessa?: Promise<TDati> | null
) {
  const daLeggere = !!promessa && !promesseLette.has(promessa);
  const query = useQuery<TDati, Error, TSelezione>({
    ...opzioni,
    queryFn: () => {
      if (promessa && !promesseLette.has(promessa)) {
        promesseLette.add(promessa);
        return promessa;
      }
      return opzioni.queryFn();
    },
    // La risposta del loader è la più recente: con dati in cache ancora freschi la query si
    // aggiorna comunque, leggendo la promessa e senza una seconda richiesta
    ...(daLeggere ? { staleTime: 0 } : {}),
  });

  // Dichiarato dopo useQuery: gira dopo l'eventuale caricamento al montaggio o al cambio di chiave
  useEffect(() => {
    if (!promessa) {
      return;
    }
    promesseLette.add(promessa);
    // Una promessa scaduta senza essere letta non deve diventare un rifiuto non gestito
    promessa.catch(() => undefined);
  }, [promessa]);

  return query;
}

/** Aree della GDO, condivise fra le pagine; la promessa del loader, se c'è, evita la richiesta doppia. */
export const useAreeGdo = (promessaLoader?: Promise<AreaResponseDTO[]> | null) =>
  useQueryConLoader(
    { queryKey: CHIAVE_AREE_GDO, queryFn: () => ServerCall.get<AreaResponseDTO[]>("/allAreeForGDO") },
    promessaLoader
  );

/** Canali della GDO, condivisi fra le pagine; la promessa del loader, se c'è, evita la richiesta doppia. */
export const useCanaliGdo = (promessaLoader?: Promise<CanaleResponseDTO[]> | null) =>
  useQueryConLoader(
    { queryKey: CHIAVE_CANALI_GDO, queryFn: () => ServerCall.get<CanaleResponseDTO[]>("/allCanaliForGDO") },
    promessaLoader
  );
