import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';
import type { StatoImportVendite } from '../../../lib/vendite/tipi';

/**
 * Gli import delle vendite di una GDO (lib/vendite/tipi.ts): uno solo 'in_corso' per GDO alla volta.
 * Stato, avanzamento e annullamento stanno qui e non nella memoria del processo, cosi' funzionano
 * da qualunque worker: il lavoro aggiorna battito_il mentre scrive e legge annullato fra un blocco e
 * l'altro. Un import 'in_corso' senza battito da MINUTI_IMPORT_INTERROTTO minuti si e' fermato con il
 * server: risulta 'interrotto' e non blocca il successivo. Letture e scritture passano da
 * VenditeRepository in SQL; il modello descrive lo schema.
 */

export interface ImportazioneVenditeAttributes {
  id: string;
  id_gdo: string;
  stato: StatoImportVendite;
  nome_file: string;
  /** Righe del file, scartate comprese. */
  righe: number;
  /** Righe gia' esaminate: le scartate subito, le altre a mano a mano che si scrivono. */
  elaborate: number;
  scritte: number;
  scartate: number;
  errore: string | null;
  avviato_da: string | null;
  avviato_il: Date;
  terminato_il: Date | null;
  /** Ultimo segno di vita del lavoro. */
  battito_il: Date;
  /** Annullamento richiesto: il lavoro si ferma al blocco successivo. */
  annullato: boolean;
}

type ImportazioneVenditeCreationAttributes = Optional<
  ImportazioneVenditeAttributes,
  'righe' | 'elaborate' | 'scritte' | 'scartate' | 'errore' | 'avviato_da' | 'avviato_il' | 'terminato_il' | 'battito_il' | 'annullato'
>;

class ImportazioneVendite
  extends Model<ImportazioneVenditeAttributes, ImportazioneVenditeCreationAttributes>
  implements ImportazioneVenditeAttributes {
  declare id: string;
  declare id_gdo: string;
  declare stato: StatoImportVendite;
  declare nome_file: string;
  declare righe: number;
  declare elaborate: number;
  declare scritte: number;
  declare scartate: number;
  declare errore: string | null;
  declare avviato_da: string | null;
  declare avviato_il: Date;
  declare terminato_il: Date | null;
  declare battito_il: Date;
  declare annullato: boolean;
}

const ImportazioneVenditeDefine = sequelize.define<ImportazioneVendite>('importazioni_vendite', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  id_gdo: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // in_corso, completato, annullato, fallito, interrotto (StatoImportVendite)
  stato: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  nome_file: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  righe: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  elaborate: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  scritte: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  scartate: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  errore: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  avviato_da: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  avviato_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  terminato_il: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  battito_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  annullato: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'importazioni_vendite',
  freezeTableName: true,
  timestamps: false,
  indexes: [
    // L'ultimo import della GDO e quello in corso
    { name: 'idx_importazioni_vendite_id_gdo_avviato_il', fields: ['id_gdo', 'avviato_il'] },
  ],
});

export { ImportazioneVenditeDefine as ImportazioneVendite };
