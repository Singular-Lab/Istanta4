/**
 * Ordinamento merceologico delle referenze (spec integrazioni/ordinamento-merceologico).
 *
 * Istanta lo espone con FicoProcess/getOrdinamentoMerceologico leggendo il
 * SourceOrdinamentoLista.json del cliente. Qui lo si applica come fa Istanta in
 * Ordinamento.ordinaRecordsTracciato, così Fidelity e Istanta presentano le referenze
 * nello stesso ordine. Nessuna dipendenza da Node o React: lo usano server e client.
 */

export type LivelloMerceologico = 'area' | 'settore' | 'reparto' | 'categoria';

export const LIVELLI_MERCEOLOGICI: readonly LivelloMerceologico[] = ['area', 'settore', 'reparto', 'categoria'];

export interface VoceOrdinamentoMerceologico {
  area: string;
  settore: string;
  reparto: string;
  categoria: string;
  orderIndex: number;
}

export interface OrdinamentoMerceologico {
  /** false quando il cliente non ha un ordinamento universale: le referenze restano nell'ordine ricevuto. */
  universale: boolean;
  /** Per ogni livello, la chiave del record del tracciato da confrontare (vuota se il livello non si usa). */
  campi: Record<LivelloMerceologico, string>;
  /** Voci in ordine crescente di orderIndex. */
  voci: VoceOrdinamentoMerceologico[];
}

export const ORDINAMENTO_MERCEOLOGICO_VUOTO: OrdinamentoMerceologico = {
  universale: false,
  campi: { area: '', settore: '', reparto: '', categoria: '' },
  voci: [],
};

/** Indice assegnato ai record senza corrispondenza: vanno dopo quelli ordinati. */
export const INDICE_FUORI_ORDINAMENTO = Number.MAX_SAFE_INTEGER;

const CHIAVE_CODICE_GRUPPO = 'Scatto.CodiceGruppo';
const CHIAVE_CODICE_REFERENZA = 'Referenza.Codice';

const testo = (valore: unknown): string => (valore === null || valore === undefined ? '' : String(valore));

export function haOrdinamentoMerceologico(ordinamento: OrdinamentoMerceologico | null | undefined): ordinamento is OrdinamentoMerceologico {
  return !!ordinamento && ordinamento.universale && Array.isArray(ordinamento.voci) && ordinamento.voci.length > 0;
}

/**
 * Restituisce una funzione che calcola l'indice merceologico di un record.
 * Come in Istanta: un livello conta solo se ha un campo collegato e il record ha quel campo;
 * i valori si confrontano senza distinguere maiuscole e minuscole; il record di gruppo che
 * elenca più codici ("a,b") non si ordina.
 */
export function creaIndiceMerceologico(
  ordinamento: OrdinamentoMerceologico | null | undefined,
): (record: Record<string, unknown>) => number {
  if (!haOrdinamentoMerceologico(ordinamento)) return () => INDICE_FUORI_ORDINAMENTO;

  const livelliAttivi = LIVELLI_MERCEOLOGICI
    .map(livello => ({ livello, campo: ordinamento.campi?.[livello] ?? '' }))
    .filter(({ campo }) => campo !== '');
  const voci = ordinamento.voci
    .filter(voce => voce && voce.orderIndex >= 0)
    .map(voce => ({
      orderIndex: voce.orderIndex,
      valori: livelliAttivi.map(({ livello }) => testo(voce[livello]).toLowerCase()),
    }));

  return record => {
    if (!record || typeof record !== 'object') return INDICE_FUORI_ORDINAMENTO;

    const codiceGruppo = testo(record[CHIAVE_CODICE_GRUPPO]);
    if (codiceGruppo.includes(',') && codiceGruppo === testo(record[CHIAVE_CODICE_REFERENZA])) {
      return INDICE_FUORI_ORDINAMENTO;
    }

    const valoriRecord = livelliAttivi.map(({ campo }) =>
      Object.prototype.hasOwnProperty.call(record, campo) ? testo(record[campo]).toLowerCase() : null,
    );
    const voce = voci.find(v => v.valori.every((valore, i) => valoriRecord[i] === null || valoriRecord[i] === valore));
    return voce ? voce.orderIndex : INDICE_FUORI_ORDINAMENTO;
  };
}

/**
 * Restituisce una copia dei record in ordine merceologico. L'ordinamento è stabile: a parità di
 * indice, e per i record senza corrispondenza (in coda), resta l'ordine ricevuto. Senza
 * ordinamento la copia ha lo stesso ordine dell'originale.
 */
export function ordinaPerMerceologia<T extends Record<string, unknown>>(
  records: readonly T[],
  ordinamento: OrdinamentoMerceologico | null | undefined,
): T[] {
  if (!haOrdinamentoMerceologico(ordinamento)) return [...records];
  const indice = creaIndiceMerceologico(ordinamento);
  return records
    .map((record, posizione) => ({ record, posizione, indice: indice(record) }))
    .sort((a, b) => a.indice - b.indice || a.posizione - b.posizione)
    .map(({ record }) => record);
}
