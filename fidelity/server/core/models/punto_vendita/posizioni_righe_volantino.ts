import { DataTypes, Model, Optional } from 'sequelize';
import type { FontePosizione, PrecisionePosizione } from '../../../../lib/puntiVendita/analisi';
import { sequelize } from '../../db/SequelizeConnector';

/**
 * La posizione delle righe stampate nelle liste dei volantini, per verificare a quale punto vendita
 * sono collegate e per suggerire i PV vicini. Una riga per GDO e chiave della posizione
 * (utils/posizioniRighe.ts: "ind:<località>|<indirizzo>" o "loc:<località>"), così ogni indirizzo
 * si cerca una volta sola anche se è stampato in centinaia di volantini e anche quando un kit viene
 * risincronizzato (che riscrive le sue righe in punti_vendita_volantino).
 *
 * La posizione viene da Nominatim (OpenStreetMap), con la precisione trovata, oppure da una
 * correzione a mano (coordinate di Google Maps), che una ricerca successiva non sovrascrive.
 * L'anagrafica dei punti vendita non si tocca.
 */

export const PRECISIONI_POSIZIONE: readonly PrecisionePosizione[] = ['civico', 'via', 'comune', 'non_trovata'];
export const FONTI_POSIZIONE: readonly FontePosizione[] = ['nominatim', 'manuale'];

export interface PosizioneRigaVolantinoAttributes {
  id_gdo: string;
  chiave: string;
  /** Il testo cercato in Nominatim, per capire un risultato strano. */
  ricerca: string | null;
  lat: number | null;
  lon: number | null;
  precisione: PrecisionePosizione;
  fonte: FontePosizione;
  /** L'ultimo errore di Nominatim; con precisione non_trovata la ricerca si ripete solo su richiesta. */
  errore: string | null;
  aggiornata_il: Date;
  /** L'utente che l'ha corretta a mano, o che ha avviato la ricerca. */
  aggiornata_da: string | null;
}

type PosizioneRigaVolantinoCreationAttributes = Optional<
  PosizioneRigaVolantinoAttributes,
  'ricerca' | 'lat' | 'lon' | 'fonte' | 'errore' | 'aggiornata_il' | 'aggiornata_da'
>;

class PosizioneRigaVolantino
  extends Model<PosizioneRigaVolantinoAttributes, PosizioneRigaVolantinoCreationAttributes>
  implements PosizioneRigaVolantinoAttributes {
  declare id_gdo: string;
  declare chiave: string;
  declare ricerca: string | null;
  declare lat: number | null;
  declare lon: number | null;
  declare precisione: PrecisionePosizione;
  declare fonte: FontePosizione;
  declare errore: string | null;
  declare aggiornata_il: Date;
  declare aggiornata_da: string | null;
}

const PosizioneRigaVolantinoDefine = sequelize.define<PosizioneRigaVolantino>('posizioni_righe_volantino', {
  id_gdo: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
  },
  chiave: {
    type: DataTypes.TEXT,
    primaryKey: true,
    allowNull: false,
  },
  ricerca: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Come le coordinate dei punti vendita
  lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  lon: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  precisione: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fonte: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'nominatim',
  },
  errore: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  aggiornata_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  aggiornata_da: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'posizioni_righe_volantino',
  freezeTableName: true,
  timestamps: false,
});

export { PosizioneRigaVolantinoDefine as PosizioneRigaVolantino };
