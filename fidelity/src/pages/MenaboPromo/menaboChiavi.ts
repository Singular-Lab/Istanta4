/**
 * Chiavi del menabò (spec fidelity/menabo-promo, "Menabò salvato ricollegato alle referenze della
 * promo"). Ogni gruppo e ogni referenza collocati sulle pagine sono identificati da una chiave che
 * dice da quale gruppo della sidebar vengono e in quale posizione: l'elenco dei gruppi la usa per
 * non riproporre le referenze già collocate.
 *
 * Le chiavi sono posizionali, quindi un menabò salvato va ricollegato alle referenze attuali quando
 * l'ordine delle referenze o dei gruppi cambia (per esempio con l'ordinamento merceologico): lo fa
 * ricollegaElementiSalvati, riconoscendo le referenze per i campi che la libreria agenzia del
 * cliente dichiara (campi_identita) o, se non ne dichiara, per la referenza intera.
 */

type Referenza = Record<string, string>;

interface GruppoSidebar {
    nome_campo: string;
    valore_campo: string;
    records: Referenza[];
}

interface DivisioneSidebar {
    id: string;
    raggruppamento: GruppoSidebar[];
}

/** Gruppo, sottogruppo o porzione collocata sulle pagine, come la salva il menabò. */
export interface ElementoCollocato {
    sourceKey: string;
    recordKeys: string[];
    records: Referenza[];
}

export function getGroupSourceKey(
    divisionId: string,
    item: { nome_campo: string; valore_campo: string },
    index: number,
) {
    return JSON.stringify([divisionId, item.nome_campo, item.valore_campo, index]);
}

export function getSubgroupSourceKey(groupSourceKey: string, nomeCampo: string, valoreCampo: string) {
    return JSON.stringify([groupSourceKey, "sub", nomeCampo, valoreCampo]);
}

export function getRecordKey(sourceKey: string, index: number) {
    return JSON.stringify([sourceKey, index]);
}

const normalizza = (valore: unknown) => String(valore ?? "").trim().toLowerCase();

/**
 * Identità di una referenza: il primo dei campi dichiarati che ha un valore, cercato senza
 * distinguere maiuscole e minuscole nel nome; se nessuno ha un valore, la referenza intera.
 */
export function identitaReferenza(record: Referenza, campiIdentita: readonly string[]): string {
    for (const campo of campiIdentita) {
        const nomeCampo = normalizza(campo);
        if (!nomeCampo) continue;
        const chiave = Object.keys(record).find(key => normalizza(key) === nomeCampo);
        const valore = chiave === undefined ? "" : normalizza(record[chiave]);
        if (valore) return JSON.stringify([nomeCampo, valore]);
    }
    const campi = Object.entries(record)
        .map(([key, value]) => [key.trim(), String(value ?? "")] as const)
        .filter(([key]) => key.length > 0)
        .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(campi);
}

const chiaveGruppo = (nomeCampo: unknown, valoreCampo: unknown) =>
    JSON.stringify([normalizza(nomeCampo), normalizza(valoreCampo)]);

/** Gruppo e, per un sottogruppo, campo e valore che la sourceKey salvata indicano. */
function leggiSourceKey(sourceKey: string): { gruppo: string; sottogruppo?: [string, string] } | null {
    try {
        const parti: unknown = JSON.parse(sourceKey);
        if (!Array.isArray(parti)) return null;
        if (parti.length === 4 && parti[1] === "sub" && typeof parti[0] === "string") {
            const gruppo = leggiSourceKey(parti[0]);
            return gruppo && !gruppo.sottogruppo
                ? { gruppo: gruppo.gruppo, sottogruppo: [String(parti[2] ?? ""), String(parti[3] ?? "")] }
                : null;
        }
        if (parti.length === 4) return { gruppo: chiaveGruppo(parti[1], parti[2]) };
        return null;
    } catch {
        return null;
    }
}

/**
 * Ricollega gli elementi di un menabò salvato alla divisione come arriva oggi: ricalcola sourceKey
 * e recordKeys così che indichino le stesse referenze anche se ordine o posizione dei gruppi sono
 * cambiati. Le referenze e le loro copie salvate restano quelle del salvataggio. Una referenza che
 * non si ritrova più resta collocata, con una chiave che non indica nessuna referenza attuale.
 */
export function ricollegaElementiSalvati<T extends ElementoCollocato>(
    elementi: readonly T[],
    divisione: DivisioneSidebar,
    campiIdentita: readonly string[] = [],
): T[] {
    const gruppiAttuali = new Map<string, string>();
    const identitaPerRecordKey = new Map<string, string>();
    const posizioniPerGruppo = new Map<string, Map<string, string[]>>();
    const posizioniNellaDivisione = new Map<string, string[]>();

    divisione.raggruppamento.forEach((item, idx) => {
        const sourceKeyGruppo = getGroupSourceKey(divisione.id, item, idx);
        const gruppo = chiaveGruppo(item.nome_campo, item.valore_campo);
        if (!gruppiAttuali.has(gruppo)) gruppiAttuali.set(gruppo, sourceKeyGruppo);
        const delGruppo = posizioniPerGruppo.get(gruppo) ?? new Map<string, string[]>();
        posizioniPerGruppo.set(gruppo, delGruppo);
        item.records.forEach((record, recordIdx) => {
            const identita = identitaReferenza(record, campiIdentita);
            const posizione = getRecordKey(sourceKeyGruppo, recordIdx);
            identitaPerRecordKey.set(posizione, identita);
            delGruppo.set(identita, [...(delGruppo.get(identita) ?? []), posizione]);
            posizioniNellaDivisione.set(identita, [...(posizioniNellaDivisione.get(identita) ?? []), posizione]);
        });
    });

    const lette = elementi.map(elemento => {
        const letta = leggiSourceKey(elemento.sourceKey);
        return {
            elemento,
            gruppo: letta?.gruppo,
            sottogruppo: letta?.sottogruppo,
            identita: elemento.records.map(record => identitaReferenza(record, campiIdentita)),
        };
    });

    const usate = new Set<string>();
    const nuoveChiavi: (string | undefined)[][] = lette.map(({ elemento }) => elemento.records.map(() => undefined));

    // Prima le chiavi salvate che indicano ancora la stessa referenza: un menabò già allineato non cambia
    lette.forEach(({ elemento, identita }, i) => {
        identita.forEach((id, r) => {
            const salvata = elemento.recordKeys[r];
            if (salvata && !usate.has(salvata) && identitaPerRecordKey.get(salvata) === id) {
                usate.add(salvata);
                nuoveChiavi[i][r] = salvata;
            }
        });
    });

    const prendiLibera = (posizioni: string[] | undefined) =>
        posizioni?.find(posizione => !usate.has(posizione));

    // Poi le altre, per identità: prima nel gruppo da cui venivano, poi nel resto della divisione
    lette.forEach(({ elemento, gruppo, identita }, i) => {
        identita.forEach((id, r) => {
            if (nuoveChiavi[i][r] !== undefined) return;
            const trovata = prendiLibera(gruppo ? posizioniPerGruppo.get(gruppo)?.get(id) : undefined)
                ?? prendiLibera(posizioniNellaDivisione.get(id));
            if (trovata) {
                usate.add(trovata);
                nuoveChiavi[i][r] = trovata;
                return;
            }
            // Non è più nella promo: resta in pagina, senza nascondere nessuna referenza attuale.
            // Una chiave salvata che non indica nessuna referenza di oggi si tiene com'è.
            const salvata = elemento.recordKeys[r];
            const chiave = salvata && !identitaPerRecordKey.has(salvata) && !usate.has(salvata)
                ? salvata
                : JSON.stringify(["non-collegata", divisione.id, salvata ?? `${i}:${r}`]);
            usate.add(chiave);
            nuoveChiavi[i][r] = chiave;
        });
    });

    return lette.map(({ elemento, gruppo, sottogruppo }, i) => {
        const sourceKeyGruppo = gruppo ? gruppiAttuali.get(gruppo) : undefined;
        const sourceKey = sourceKeyGruppo === undefined
            ? elemento.sourceKey
            : sottogruppo
                ? getSubgroupSourceKey(sourceKeyGruppo, sottogruppo[0], sottogruppo[1])
                : sourceKeyGruppo;
        return {
            ...elemento,
            sourceKey,
            recordKeys: nuoveChiavi[i].map((chiave, r) => chiave ?? elemento.recordKeys[r]),
        };
    });
}
