import { QueryTypes } from 'sequelize';
import type { PosizioneRiga, PrecisionePosizione } from '../../../lib/puntiVendita/analisi';
import { sequelize } from '../db';

/**
 * Le posizioni delle righe dei volantini (tabella posizioni_righe_volantino), per GDO e chiave della
 * posizione (confrontoPuntiVendita.chiavePosizione). Una ricerca di Nominatim non sovrascrive mai
 * una posizione corretta a mano.
 */

/** L'esito di una ricerca di Nominatim per una chiave. */
export interface EsitoRicercaPosizione {
  ricerca: string | null;
  lat: number | null;
  lon: number | null;
  precisione: PrecisionePosizione;
  errore: string | null;
}

export interface IPosizioniRigheRepository {
  /** Tutte le posizioni della GDO, per chiave. */
  posizioni(idGdo: string): Promise<Map<string, PosizioneRiga>>;
  /** Salva l'esito di una ricerca, salvo che la posizione sia stata corretta a mano. */
  salvaRicerca(idGdo: string, chiave: string, esito: EsitoRicercaPosizione, idUtente: string | null): Promise<void>;
  /** Salva la posizione corretta a mano e la restituisce. */
  correggi(idGdo: string, chiave: string, coordinate: { lat: number; lon: number }, idUtente: string | null): Promise<PosizioneRiga>;
}

interface RigaPosizione {
  chiave: string;
  lat: string | number | null;
  lon: string | number | null;
  precisione: PrecisionePosizione;
  fonte: 'nominatim' | 'manuale';
  errore: string | null;
  aggiornata_il: Date | string;
}

const numero = (valore: string | number | null): number | null => {
  if (valore === null || valore === undefined) return null;
  const convertito = Number(valore);
  return Number.isFinite(convertito) ? convertito : null;
};

const posizioneDa = (riga: RigaPosizione): PosizioneRiga => ({
  chiave: riga.chiave,
  lat: numero(riga.lat),
  lon: numero(riga.lon),
  precisione: riga.precisione,
  fonte: riga.fonte,
  errore: riga.errore,
  aggiornataIl: new Date(riga.aggiornata_il).toISOString(),
});

const COLONNE = 'chiave, lat, lon, precisione, fonte, errore, aggiornata_il';

export class PosizioniRigheRepository implements IPosizioniRigheRepository {
  async posizioni(idGdo: string): Promise<Map<string, PosizioneRiga>> {
    const righe = await sequelize.query<RigaPosizione>(
      `SELECT ${COLONNE} FROM posizioni_righe_volantino WHERE id_gdo = :idGdo`,
      { replacements: { idGdo }, type: QueryTypes.SELECT }
    );
    return new Map(righe.map(riga => [riga.chiave, posizioneDa(riga)]));
  }

  async salvaRicerca(idGdo: string, chiave: string, esito: EsitoRicercaPosizione, idUtente: string | null): Promise<void> {
    await sequelize.query(
      `INSERT INTO posizioni_righe_volantino (id_gdo, chiave, ricerca, lat, lon, precisione, fonte, errore, aggiornata_il, aggiornata_da)
       VALUES (:idGdo, :chiave, :ricerca, :lat, :lon, :precisione, 'nominatim', :errore, NOW(), :idUtente)
       ON CONFLICT (id_gdo, chiave) DO UPDATE
         SET ricerca = EXCLUDED.ricerca, lat = EXCLUDED.lat, lon = EXCLUDED.lon, precisione = EXCLUDED.precisione,
             fonte = 'nominatim', errore = EXCLUDED.errore, aggiornata_il = NOW(), aggiornata_da = EXCLUDED.aggiornata_da
         WHERE posizioni_righe_volantino.fonte <> 'manuale'`,
      {
        replacements: {
          idGdo,
          chiave,
          ricerca: esito.ricerca,
          lat: esito.lat,
          lon: esito.lon,
          precisione: esito.precisione,
          errore: esito.errore,
          idUtente,
        },
        type: QueryTypes.INSERT,
      }
    );
  }

  async correggi(idGdo: string, chiave: string, coordinate: { lat: number; lon: number }, idUtente: string | null): Promise<PosizioneRiga> {
    const [righe] = await sequelize.query(
      `INSERT INTO posizioni_righe_volantino (id_gdo, chiave, lat, lon, precisione, fonte, errore, aggiornata_il, aggiornata_da)
       VALUES (:idGdo, :chiave, :lat, :lon, 'civico', 'manuale', NULL, NOW(), :idUtente)
       ON CONFLICT (id_gdo, chiave) DO UPDATE
         SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, precisione = 'civico', fonte = 'manuale', errore = NULL,
             aggiornata_il = NOW(), aggiornata_da = EXCLUDED.aggiornata_da
       RETURNING ${COLONNE}`,
      { replacements: { idGdo, chiave, lat: coordinate.lat, lon: coordinate.lon, idUtente } }
    );
    return posizioneDa((righe as RigaPosizione[])[0]);
  }
}
