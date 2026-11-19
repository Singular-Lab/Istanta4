/**
 * Contratto della pagina Aree e canali: GET /api/get_all_aree_canali_combinazioni
 * ("gdo.gestisci_aree_canali") restituisce aree, canali e combinazioni della GDO di chi chiede
 * (o di quella indicata con ?idGdo= da chi opera per piu' GDO), letti dalle tabelle.
 */

export interface VoceAnagraficaDTO {
  id: string;
  codice: string;
  nome: string;
  id_gdo: string;
  /** Membri se la voce e' un proxy (lib/areeCanali/proxy.ts), vuoto altrimenti; il primo e' quello delle liste. */
  membri: string[];
  createdat?: string | Date | null;
  updatedat?: string | Date | null;
}

export interface CombinazioneAnagrafica {
  id: string;
  id_gdo: string;
  id_canale: string;
  id_area: string;
  stato: 'ATTIVO' | 'DISATTIVO';
  /** CODICECANALE_CODICEAREA, come la scrive l'import dei punti vendita. */
  sigla: string;
  canale_codice: string | null;
  canale_nome: string | null;
  area_codice: string | null;
  area_nome: string | null;
  /** Il canale o l'area e' un proxy: la combinazione esiste solo in Fidelity e non ha punti vendita. */
  proxy: boolean;
  createdat?: string | Date | null;
  updatedat?: string | Date | null;
}

export interface AnagraficaAreeCanali {
  aree: VoceAnagraficaDTO[];
  canali: VoceAnagraficaDTO[];
  combinazioni: CombinazioneAnagrafica[];
}
