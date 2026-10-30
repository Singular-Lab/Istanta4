import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';
import type { DatiAnalisiKit, DescrizioniKit } from '../utils/analisiKit';

/**
 * Riepilogo di un kit runtime per le pagine dei punti vendita (lib/puntiVendita/analisi.ts),
 * calcolato dalle sue referenze (utils/analisiKit.ts): in dati conteggi, sconti, meccaniche,
 * reparti e, in forma compatta, marche e prodotti; in descrizioni nome, marca, formato e foto dei
 * prodotti, che la scheda del PV legge solo per i pochi da mostrare.
 * E' una cache: si calcola alla prima lettura e si ricalcola se
 * la formula cambia (versione), se le referenze del kit vengono sostituite (la riga si elimina in
 * ReferenzeService.sostituisciReferenzeKit) o se una referenza e' stata modificata dopo
 * referenze_al.
 */

export interface AnalisiKitAttributes {
  id_kit_runtime: string;
  /** VERSIONE_ANALISI_KIT con cui e' stato calcolato. */
  versione: number;
  dati: DatiAnalisiKit;
  descrizioni: DescrizioniKit;
  aggiornato_il: Date;
  /** L'ultima modifica (updatedAt) fra le referenze lette per il calcolo; null se il kit non ne aveva. */
  referenze_al: Date | null;
}

type AnalisiKitCreationAttributes = Optional<AnalisiKitAttributes, 'aggiornato_il' | 'referenze_al'>;

class AnalisiKit extends Model<AnalisiKitAttributes, AnalisiKitCreationAttributes> implements AnalisiKitAttributes {
  declare id_kit_runtime: string;
  declare versione: number;
  declare dati: DatiAnalisiKit;
  declare descrizioni: DescrizioniKit;
  declare aggiornato_il: Date;
  declare referenze_al: Date | null;
}

const AnalisiKitDefine = sequelize.define<AnalisiKit>('analisi_kit', {
  // Eliminato il kit, il suo riepilogo non serve piu'
  id_kit_runtime: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    references: { model: 'runtime_kit', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  versione: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  dati: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  descrizioni: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  aggiornato_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  referenze_al: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'analisi_kit',
  freezeTableName: true,
  timestamps: false,
});

export { AnalisiKitDefine as AnalisiKit };
