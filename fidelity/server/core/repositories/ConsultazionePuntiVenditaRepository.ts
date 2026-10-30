import { QueryTypes } from 'sequelize';
import { sequelize } from '../db';
import { DATA_EDIZIONE, KIT_VALIDI, SOSTITUZIONI_FISSE } from './PuntiVenditaVolantinoRepository';

/**
 * Letture dei punti vendita per le pagine di consultazione (/api/punti-vendita), sempre
 * dentro una GDO: un punto vendita di un'altra GDO non esce mai. Una query sola, con canale e
 * area della combinazione; nessuna colonna dei dispositivi o dei contesti display.
 * Per l'elenco, una seconda query riassume i volantini dei PV anno per anno (storiaInElenco).
 */

/** Una riga di punti_vendita con canale e area della sua combinazione (null se mancano). */
export interface RigaPuntoVenditaConsultazione {
  id: string;
  nome: string;
  ragione_sociale: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  regione: string | null;
  telefono: string | null;
  meta: Record<string, unknown> | null;
  /** Le colonne numeriche arrivano da pg anche come testo. */
  lat: number | string | null;
  lon: number | string | null;
  id_canale: string | null;
  nome_canale: string | null;
  codice_canale: string | null;
  id_area: string | null;
  nome_area: string | null;
  codice_area: string | null;
}

/** I volantini di un PV in un anno con un canale (stessi kit validi e stessa data della storia del PV). */
export interface RigaStoriaInElenco {
  id_punto_vendita: string;
  anno: number;
  id_canale: string | null;
  nome_canale: string;
  volantini: number;
}

export interface IConsultazionePuntiVenditaRepository {
  /** Punti vendita della GDO, per nome. */
  elencaDellaGdo(idGdo: string): Promise<RigaPuntoVenditaConsultazione[]>;
  /** Il punto vendita, solo se e' della GDO; altrimenti null. */
  trovaDellaGdo(idGdo: string, idPuntoVendita: string): Promise<RigaPuntoVenditaConsultazione | null>;
  /** Per ogni PV della GDO con una storia: volantini per anno e canale. */
  storiaInElenco(idGdo: string): Promise<RigaStoriaInElenco[]>;
}

const SELEZIONE = `
  SELECT pv.id_puntivendita AS id,
         pv.nome_puntivendita AS nome,
         pv.ragionesociale_puntivendita AS ragione_sociale,
         pv.indirizzo_puntivendita AS indirizzo,
         pv.cap_puntivendita AS cap,
         pv.citta_puntivendita AS citta,
         pv.provincia_puntivendita AS provincia,
         pv.regione_puntivendita AS regione,
         pv.telefono_puntivendita AS telefono,
         pv.meta_puntivendita AS meta,
         pv.lat_puntivendita AS lat,
         pv.lon_puntivendita AS lon,
         c.id_canali AS id_canale,
         c.nome_canali AS nome_canale,
         c.codice_canali AS codice_canale,
         a.id_aree AS id_area,
         a.nome_aree AS nome_area,
         a.codice_aree AS codice_area
    FROM punti_vendita pv
    LEFT JOIN combinazione_canale_area cca ON cca.id_combinazione_canale_area = pv.id_combinazione_canale_area_puntivendita
    LEFT JOIN canali c ON c.id_canali = cca.id_canale_combinazione_canale_area
    LEFT JOIN aree a ON a.id_aree = cca.id_area_combinazione_canale_area
   WHERE pv.id_gdo_puntivendita = :idGdo`;

export class ConsultazionePuntiVenditaRepository implements IConsultazionePuntiVenditaRepository {
  async elencaDellaGdo(idGdo: string): Promise<RigaPuntoVenditaConsultazione[]> {
    return sequelize.query<RigaPuntoVenditaConsultazione>(
      `${SELEZIONE} ORDER BY pv.nome_puntivendita, pv.id_puntivendita`,
      { replacements: { idGdo }, type: QueryTypes.SELECT }
    );
  }

  async trovaDellaGdo(idGdo: string, idPuntoVendita: string): Promise<RigaPuntoVenditaConsultazione | null> {
    const righe = await sequelize.query<RigaPuntoVenditaConsultazione>(
      `${SELEZIONE} AND pv.id_puntivendita = :idPuntoVendita`,
      { replacements: { idGdo, idPuntoVendita }, type: QueryTypes.SELECT }
    );
    return righe[0] ?? null;
  }

  async storiaInElenco(idGdo: string): Promise<RigaStoriaInElenco[]> {
    // Un volantino conta una volta per PV anche se il PV compare due volte nella stessa lista
    const righe = await sequelize.query<RigaStoriaInElenco>(
      `SELECT ap.id_punto_vendita, ap.anno, ap.id_canale, MAX(ap.nome_canale) AS nome_canale, COUNT(*)::int AS volantini
         FROM (
           SELECT DISTINCT r.id_punto_vendita::text AS id_punto_vendita, r.id_kit_runtime,
                  substr(${DATA_EDIZIONE}, 1, 4)::int AS anno,
                  k.id_canale::text AS id_canale, COALESCE(c.nome_canali, k.nome_canale, '') AS nome_canale
             FROM punti_vendita_volantino r
             JOIN runtime_kit k ON k.id = r.id_kit_runtime
             JOIN promo p ON p.id_promo = k.id_promo
             LEFT JOIN canali c ON c.id_canali = k.id_canale
            WHERE r.id_gdo = :idGdo AND r.id_punto_vendita IS NOT NULL AND ${KIT_VALIDI}
         ) ap
        GROUP BY ap.id_punto_vendita, ap.anno, ap.id_canale`,
      { replacements: { ...SOSTITUZIONI_FISSE, idGdo }, type: QueryTypes.SELECT }
    );
    return righe.map(riga => ({ ...riga, anno: Number(riga.anno), volantini: Number(riga.volantini) }));
  }
}
