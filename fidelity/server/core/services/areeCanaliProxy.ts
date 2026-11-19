import { QueryTypes } from 'sequelize';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../lib/enums';
import type { AnagraficaAreeCanali, CombinazioneAnagrafica, VoceAnagraficaDTO } from '../../../lib/areeCanali/anagrafica';
import {
  chiaveCoppia, coppieMembro, idPezzo, NESSUN_PROXY, pezziDelDesign,
  type KitConfrontabile, type Pezzo, type ProxyNoti,
} from '../../../lib/areeCanali/proxy';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { sequelize } from '../db';

/**
 * Accesso ai dati per canali e aree proxy (lib/areeCanali/proxy.ts) e per la pagina Aree e canali.
 * Le tabelle sono piccole (decine di righe per GDO): si leggono direttamente, sempre aggiornate,
 * invece delle viste materializzate.
 */

/** Tutti i canali e le aree proxy, con i loro membri. */
export async function caricaProxy(): Promise<ProxyNoti> {
  const [canali, aree] = await Promise.all([
    sequelize.query<{ id: string; membri: string[] }>(
      'SELECT id_canali AS id, membri_canali::text[] AS membri FROM canali WHERE cardinality(membri_canali) >= 2',
      { type: QueryTypes.SELECT }
    ),
    sequelize.query<{ id: string; membri: string[] }>(
      'SELECT id_aree AS id, membri_aree::text[] AS membri FROM aree WHERE cardinality(membri_aree) >= 2',
      { type: QueryTypes.SELECT }
    ),
  ]);
  if (canali.length === 0 && aree.length === 0) return NESSUN_PROXY;
  return {
    canali: new Map(canali.map(c => [c.id, c.membri])),
    aree: new Map(aree.map(a => [a.id, a.membri])),
  };
}

/** La combinazione usa un canale o un'area proxy? */
export async function combinazioneConProxy(idCombinazione: string | null | undefined): Promise<boolean> {
  if (!idCombinazione) return false;
  const righe = await sequelize.query(
    `SELECT 1
       FROM combinazione_canale_area cca
       LEFT JOIN canali c ON c.id_canali = cca.id_canale_combinazione_canale_area
       LEFT JOIN aree a ON a.id_aree = cca.id_area_combinazione_canale_area
      WHERE cca.id_combinazione_canale_area = :id
        AND (cardinality(c.membri_canali) >= 2 OR cardinality(a.membri_aree) >= 2)`,
    { replacements: { id: idCombinazione }, type: QueryTypes.SELECT }
  );
  return righe.length > 0;
}

/**
 * I kit runtime di una promo ancora vivi, per vedere se Istanta ne unirebbe due: `pezzo` dice se il
 * kit e' nato da un pezzo, cioe' se il suo design sta su un canale o un'area proxy.
 */
export async function kitDellaPromo(idPromo: string): Promise<Array<KitConfrontabile & { guidIdDesign: string | null }>> {
  return sequelize.query<KitConfrontabile & { guidIdDesign: string | null }>(
    `SELECT r.id AS "guidId", r.id_design AS "guidIdDesign", r.titolo, r.id_raccoglitore AS "guidIdRaccoglitore",
            r.id_formato AS "guidFormato", r.id_canale AS "guidCanale", r.id_area AS "guidArea",
            (cardinality(c.membri_canali) >= 2 OR cardinality(a.membri_aree) >= 2) IS TRUE AS pezzo
       FROM runtime_kit r
       LEFT JOIN design_kit d ON d.id = r.id_design
       LEFT JOIN canali c ON c.id_canali = d.id_canale
       LEFT JOIN aree a ON a.id_aree = d.id_area
      WHERE r.id_promo = :idPromo AND r.stato_lavorazione <> :eliminato`,
    { replacements: { idPromo, eliminato: STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO }, type: QueryTypes.SELECT }
  );
}

/** Quello che serve per dividere i design proxy in pezzi: proxy, combinazioni attive, nomi e codici. */
export interface ContestoPezzi {
  proxy: ProxyNoti;
  /** Combinazioni attive, chiavi di chiaveCoppia(canale, area). */
  attive: ReadonlySet<string>;
  canali: ReadonlyMap<string, { codice: string; nome: string }>;
  aree: ReadonlyMap<string, { codice: string; nome: string }>;
}

export const NESSUN_PEZZO: ContestoPezzi = { proxy: NESSUN_PROXY, attive: new Set(), canali: new Map(), aree: new Map() };

/** Il contesto dei pezzi; senza proxy non legge altro. */
export async function contestoPezzi(): Promise<ContestoPezzi> {
  const proxy = await caricaProxy();
  if (proxy === NESSUN_PROXY) return NESSUN_PEZZO;
  const [attive, canali, aree] = await Promise.all([
    sequelize.query<{ id_canale: string; id_area: string }>(
      `SELECT id_canale_combinazione_canale_area AS id_canale, id_area_combinazione_canale_area AS id_area
         FROM combinazione_canale_area WHERE stato_combinazione_canale_area = 'ATTIVO'`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query<{ id: string; codice: string; nome: string }>(
      'SELECT id_canali AS id, codice_canali AS codice, nome_canali AS nome FROM canali',
      { type: QueryTypes.SELECT }
    ),
    sequelize.query<{ id: string; codice: string; nome: string }>(
      'SELECT id_aree AS id, codice_aree AS codice, nome_aree AS nome FROM aree',
      { type: QueryTypes.SELECT }
    ),
  ]);
  return {
    proxy,
    attive: new Set(attive.map(c => chiaveCoppia(c.id_canale, c.id_area))),
    canali: new Map(canali.map(v => [v.id, { codice: v.codice, nome: v.nome }])),
    aree: new Map(aree.map(v => [v.id, { codice: v.codice, nome: v.nome }])),
  };
}

type DesignDaDividere = { guidId: string; guidCanale?: string | null; guidArea?: string | null };

/**
 * I design come li riceve Istanta: quelli su un proxy divisi in pezzi (lib/areeCanali/proxy.ts), con
 * nome e codice del canale e dell'area del membro, anche nelle colonne grezze del design.
 */
export function pezziPerIstanta<T extends DesignDaDividere>(design: readonly T[], contesto: ContestoPezzi): Array<T | Pezzo<T>> {
  if (contesto.proxy === NESSUN_PROXY) return [...design];
  return design.flatMap(d => pezziDelDesign(d, contesto.proxy, contesto.attive).map(k => {
    if (!('pezzo' in k)) return k;
    const canale = contesto.canali.get(k.guidCanale);
    const area = contesto.aree.get(k.guidArea);
    return {
      ...k,
      ...('id_canale' in k ? { id_canale: k.guidCanale } : {}),
      ...('id_area' in k ? { id_area: k.guidArea } : {}),
      nomeCanale: canale?.nome, codiceCanale: canale?.codice,
      nomeArea: area?.nome, codiceArea: area?.codice,
    };
  }));
}

/** Il pezzo con questo id: design, canale e area del membro. Anche se la combinazione e' disattivata. */
export async function trovaPezzo(id: string | null | undefined): Promise<{ idDesign: string; idCanale: string; idArea: string } | null> {
  if (!id) return null;
  const proxy = await caricaProxy();
  if (proxy === NESSUN_PROXY) return null;
  const design = await sequelize.query<{ id: string; id_canale: string | null; id_area: string | null }>(
    `SELECT d.id, d.id_canale, d.id_area
       FROM design_kit d
       LEFT JOIN canali c ON c.id_canali = d.id_canale
       LEFT JOIN aree a ON a.id_aree = d.id_area
      WHERE cardinality(c.membri_canali) >= 2 OR cardinality(a.membri_aree) >= 2`,
    { type: QueryTypes.SELECT }
  );
  for (const d of design) {
    for (const [idCanale, idArea] of coppieMembro(d.id_canale ?? '', d.id_area ?? '', proxy)) {
      if (idPezzo(d.id, idCanale, idArea) === id) return { idDesign: d.id, idCanale, idArea };
    }
  }
  return null;
}

// I membri escono come text[]: il driver li legge sempre come elenco di stringhe
const filtroGdo = (ambito: AmbitoGdo, colonna: string) =>
  ambito === 'tutte' ? 'TRUE' : ambito === 'nessuna' ? 'FALSE' : `${colonna} = :idGdo`;

/**
 * Aree, canali e combinazioni della GDO, per la pagina Aree e canali e per chi ne usa i dati
 * (regole del menabò, filtri dello Storico volantini). `'tutte'` per chi opera su piu' GDO senza
 * averne scelta una.
 */
export async function anagraficaAreeCanali(ambito: AmbitoGdo): Promise<AnagraficaAreeCanali> {
  const replacements = typeof ambito === 'object' ? { idGdo: ambito.idGdo } : {};
  const [aree, canali, combinazioni] = await Promise.all([
    sequelize.query<VoceAnagraficaDTO>(
      `SELECT id_aree AS id, codice_aree AS codice, nome_aree AS nome, id_gdo_aree AS id_gdo, membri_aree::text[] AS membri,
              createdat, updatedat
         FROM aree WHERE ${filtroGdo(ambito, 'id_gdo_aree')}
        ORDER BY nome_aree, codice_aree`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<VoceAnagraficaDTO>(
      `SELECT id_canali AS id, codice_canali AS codice, nome_canali AS nome, id_gdo_canali AS id_gdo, membri_canali::text[] AS membri,
              createdat, updatedat
         FROM canali WHERE ${filtroGdo(ambito, 'id_gdo_canali')}
        ORDER BY nome_canali, codice_canali`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<CombinazioneAnagrafica>(
      `SELECT cca.id_combinazione_canale_area AS id,
              cca.id_gdo_combinazione_canale_area AS id_gdo,
              cca.id_canale_combinazione_canale_area AS id_canale,
              cca.id_area_combinazione_canale_area AS id_area,
              cca.stato_combinazione_canale_area AS stato,
              c.codice_canali AS canale_codice, c.nome_canali AS canale_nome,
              a.codice_aree AS area_codice, a.nome_aree AS area_nome,
              concat(c.codice_canali, '_', a.codice_aree) AS sigla,
              (cardinality(c.membri_canali) >= 2 OR cardinality(a.membri_aree) >= 2) IS TRUE AS proxy,
              cca.createdat, cca.updatedat
         FROM combinazione_canale_area cca
         LEFT JOIN canali c ON c.id_canali = cca.id_canale_combinazione_canale_area
         LEFT JOIN aree a ON a.id_aree = cca.id_area_combinazione_canale_area
        WHERE ${filtroGdo(ambito, 'cca.id_gdo_combinazione_canale_area')}
        ORDER BY c.nome_canali, a.nome_aree`,
      { replacements, type: QueryTypes.SELECT }
    ),
  ]);
  return { aree, canali, combinazioni };
}
