import type { MenaboSottogruppoChiave } from "../../../lib/types";
import { getSubgroupSourceKey } from "./menaboChiavi";

export interface RecordConChiave {
    record: Record<string, string>;
    recordKey: string;
}

/**
 * Un sottogruppo del menabò. Con più chiavi di sottogruppo (CAMPIONI DEL RISPARMIO: fascia di sconto, poi
 * sconto preciso) i sottogruppi della prima chiave contengono in `figli` quelli della seconda.
 */
export interface SubgroupEntry {
    nomeCampo: string;
    valoreCampo: string;
    label: string;
    sourceKey: string;
    availableRecords: RecordConChiave[];
    figli?: SubgroupEntry[];
}

/** Raggruppa i record per il valore della prima chiave, e ogni sottogruppo per la seconda, e così via. */
export function computeSubgroups(
    chiavi: readonly MenaboSottogruppoChiave[],
    groupSourceKey: string,
    availableRecords: RecordConChiave[],
): SubgroupEntry[] {
    const [chiave, ...altre] = chiavi;
    if (!chiave) return [];
    const subMap = new Map<string, RecordConChiave[]>();

    for (const entry of availableRecords) {
        const val = String(entry.record[chiave.nome_campo] ?? "").trim() || "—";
        const arr = subMap.get(val) ?? [];
        arr.push(entry);
        subMap.set(val, arr);
    }
    return Array.from(subMap.entries()).map(([val, recs]) => {
        const figli = altre.length > 0 ? computeSubgroups(altre, groupSourceKey, recs) : [];
        return {
            nomeCampo: chiave.nome_campo,
            valoreCampo: val,
            label: chiave.label,
            sourceKey: getSubgroupSourceKey(groupSourceKey, chiave.nome_campo, val),
            availableRecords: recs,
            ...(figli.length > 0 ? { figli } : {}),
        };
    });
}

/** Applica a ogni sottogruppo, figli compresi, il filtro delle referenze ancora disponibili. */
export function filtraSottogruppi(
    sottogruppi: readonly SubgroupEntry[],
    tieni: (entry: RecordConChiave) => boolean,
): SubgroupEntry[] {
    return sottogruppi.map(sub => ({
        ...sub,
        availableRecords: sub.availableRecords.filter(tieni),
        ...(sub.figli ? { figli: filtraSottogruppi(sub.figli, tieni) } : {}),
    }));
}

/** Il testo mostrato per un sottogruppo: le fasce e gli sconti di CAMPIONI DEL RISPARMIO portano il «%». */
export function etichettaSottogruppo(nomeCampo: string, valore: string): string {
    if (nomeCampo === "fascia_sconto") return /^\d/.test(valore) ? `Sconto ${valore}%` : valore;
    if (nomeCampo === "txt_sconto") return /^\d/.test(valore.trim()) ? `${valore.trim().replace(/%$/, "")}%` : valore;
    return valore;
}
