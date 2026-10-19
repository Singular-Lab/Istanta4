import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TIPO_UTENTI } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import { EVENTO_PERMESSI_AGGIORNATI } from '../../context/PermissionContext';
import type { ConfigurazioneServer } from './bozzaPermessi';

export type Ambito = { tipo: TIPO_UTENTI; idRuoloGdo: string | null; idGdo: string | null };

export type RuoliGestibili = {
  tipi: TIPO_UTENTI[];
  ruoliGdo: Array<{ id: string; nome: string }>;
  gdo: Array<{ id: string; nome: string }>;
};

export type ConfrontoRuoli = {
  colonne: Array<{ chiave: string; tipo: TIPO_UTENTI; idRuoloGdo: string | null; etichetta: string; permessi: string[] }>;
};

const parametri = (ambito: Ambito) => {
  const p = new URLSearchParams({ tipo: ambito.tipo });
  if (ambito.idRuoloGdo) p.set('ruoloGdo', ambito.idRuoloGdo);
  if (ambito.idGdo) p.set('gdo', ambito.idGdo);
  return p.toString();
};

const CHIAVE = 'gestione-accessi';

export const useRuoliGestibili = () =>
  useQuery({
    queryKey: [CHIAVE, 'ruoli'],
    queryFn: () => ServerCall.get<RuoliGestibili>('/permessi/ruoli'),
    staleTime: 5 * 60 * 1000,
  });

export const useConfigurazione = (ambito: Ambito) =>
  useQuery({
    queryKey: [CHIAVE, 'configurazione', ambito.tipo, ambito.idRuoloGdo, ambito.idGdo],
    queryFn: () => ServerCall.get<ConfigurazioneServer>(`/permessi/configurazione?${parametri(ambito)}`),
  });

export const useConfronto = (idGdo: string | null) =>
  useQuery({
    queryKey: [CHIAVE, 'confronto', idGdo],
    queryFn: () => ServerCall.get<ConfrontoRuoli>(`/permessi/confronto${idGdo ? `?gdo=${encodeURIComponent(idGdo)}` : ''}`),
  });

/** Dopo un salvataggio: ricarica i dati della pagina e i permessi dell'utente collegato. */
const dopoModifica = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: [CHIAVE] });
  window.dispatchEvent(new Event(EVENTO_PERMESSI_AGGIORNATI));
};

export const useSalvaConfigurazione = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dati: { ambito: Ambito; modifiche: Array<{ codice: string; abilitato: boolean | null }> }) =>
      ServerCall.put<ConfigurazioneServer>('/permessi/configurazione', {
        tipo: dati.ambito.tipo,
        ruoloGdo: dati.ambito.idRuoloGdo,
        gdo: dati.ambito.idGdo,
        modifiche: dati.modifiche,
      }),
    onSuccess: () => dopoModifica(queryClient),
  });
};

export const useRipristinaOverride = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ambito: Ambito) => ServerCall.delete<{ rimossi: number }>(`/permessi/override?${parametri(ambito)}`),
    onSuccess: () => dopoModifica(queryClient),
  });
};
