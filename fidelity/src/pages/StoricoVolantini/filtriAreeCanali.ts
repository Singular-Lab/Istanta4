import type { CombinazioneCanaleAreaResponseDTO } from "../../../server/core/dto";

/** Una voce dei filtri Area e Canale dello storico. */
export interface OpzioneFiltro {
    id: string;
    nome: string;
}

/**
 * Riga di GET /get_all_combinazioni_canale_area: oltre ai campi del DTO la vista materializzata
 * restituisce codice e nome dell'area e del canale.
 */
export type CombinazioneConNomi = CombinazioneCanaleAreaResponseDTO & {
    area_codice?: string;
    area_nome?: string;
    canale_codice?: string;
    canale_nome?: string;
};

const perNome = (a: OpzioneFiltro, b: OpzioneFiltro) => a.nome.localeCompare(b.nome, "it");

/**
 * Aree e canali distinti presenti nelle combinazioni, ordinati per nome. Senza nome si mostra il
 * codice e, in mancanza anche di quello, l'id. Restano anche le combinazioni disattivate: lo
 * storico contiene volantini di combinazioni che oggi possono non essere piu' attive.
 */
export const areeECanaliDaCombinazioni = (
    combinazioni: CombinazioneConNomi[]
): { aree: OpzioneFiltro[]; canali: OpzioneFiltro[] } => {
    const aree = new Map<string, OpzioneFiltro>();
    const canali = new Map<string, OpzioneFiltro>();
    for (const combinazione of combinazioni) {
        if (combinazione.id_area && !aree.has(combinazione.id_area)) {
            aree.set(combinazione.id_area, {
                id: combinazione.id_area,
                nome: combinazione.area_nome || combinazione.area_codice || combinazione.id_area,
            });
        }
        if (combinazione.id_canale && !canali.has(combinazione.id_canale)) {
            canali.set(combinazione.id_canale, {
                id: combinazione.id_canale,
                nome: combinazione.canale_nome || combinazione.canale_codice || combinazione.id_canale,
            });
        }
    }
    return { aree: [...aree.values()].sort(perNome), canali: [...canali.values()].sort(perNome) };
};
