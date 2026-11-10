import { DataTypes, Model, Optional } from 'sequelize';
import type { RepartoSalvato } from '../utils/repartiGdo';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Le impostazioni proprie di una GDO (spec impostazioni-gdo, contratto in lib/impostazioniGdo/tipi.ts)
 * che non stanno nella riga config letta da WebPliant: i reparti come li nomina il marketing (nome e
 * colore per codice) e la configurazione degli insight del volantino, che senza vale quella del file
 * dell'installazione (config/flyerInsightsConfig.json). Una riga per GDO, eliminata con la GDO.
 */

export interface ImpostazioniGdoAttributes {
  id_gdo: string;
  /** { codice, nomeDati, nomeMarketing, colore } per reparto. */
  reparti: RepartoSalvato[];
  /** La configurazione degli insight della GDO; null: quella del file dell'installazione. */
  insight_volantino: Record<string, unknown> | null;
  insight_aggiornato_il: Date | null;
  /** Nome dell'utente che ha salvato la configurazione degli insight. */
  insight_aggiornato_da: string | null;
  aggiornato_il: Date;
}

type ImpostazioniGdoCreationAttributes = Optional<
  ImpostazioniGdoAttributes,
  'reparti' | 'insight_volantino' | 'insight_aggiornato_il' | 'insight_aggiornato_da' | 'aggiornato_il'
>;

class ImpostazioniGdo extends Model<ImpostazioniGdoAttributes, ImpostazioniGdoCreationAttributes> implements ImpostazioniGdoAttributes {
  declare id_gdo: string;
  declare reparti: RepartoSalvato[];
  declare insight_volantino: Record<string, unknown> | null;
  declare insight_aggiornato_il: Date | null;
  declare insight_aggiornato_da: string | null;
  declare aggiornato_il: Date;
}

const ImpostazioniGdoDefine = sequelize.define<ImpostazioniGdo>('impostazioni_gdo', {
  // Eliminata la GDO, le sue impostazioni non servono piu'
  id_gdo: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    references: { model: 'gdo', key: 'id_gdo' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  reparti: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  insight_volantino: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  insight_aggiornato_il: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  insight_aggiornato_da: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  aggiornato_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'impostazioni_gdo',
  freezeTableName: true,
  timestamps: false,
});

export { ImpostazioniGdoDefine as ImpostazioniGdo };
