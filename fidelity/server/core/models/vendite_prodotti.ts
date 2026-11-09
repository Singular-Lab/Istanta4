import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Le vendite di un prodotto in un punto vendita della GDO in un periodo, importate dal file del
 * cliente (lib/vendite/tipi.ts, server/core/vendite): la base del rendimento dei box e della
 * previsione degli insight del volantino. Una riga per prodotto, punto vendita e periodo: reimportare
 * la stessa vendita la sostituisce, non la somma. Eliminato il PV, le sue vendite se ne vanno.
 * Letture e scritture passano da VenditeRepository in SQL; il modello descrive lo schema.
 */

export interface VenditaProdottoAttributes {
  id: string;
  id_gdo: string;
  /** Gia' nella forma di normalizzaCodiceProdotto, come le referenze del volantino. */
  codice_prodotto: string;
  id_punto_vendita: string;
  /** YYYY-MM-DD, inclusi. */
  dal: string;
  al: string;
  pezzi: number;
  /** Euro; null se il file del cliente non lo porta. */
  valore: number | null;
  /** L'import che ha scritto la riga l'ultima volta. */
  id_import: string | null;
  aggiornato_il: Date;
}

type VenditaProdottoCreationAttributes = Optional<VenditaProdottoAttributes, 'id' | 'valore' | 'id_import' | 'aggiornato_il'>;

class VenditaProdotto extends Model<VenditaProdottoAttributes, VenditaProdottoCreationAttributes> implements VenditaProdottoAttributes {
  declare id: string;
  declare id_gdo: string;
  declare codice_prodotto: string;
  declare id_punto_vendita: string;
  declare dal: string;
  declare al: string;
  declare pezzi: number;
  declare valore: number | null;
  declare id_import: string | null;
  declare aggiornato_il: Date;
}

const VenditaProdottoDefine = sequelize.define<VenditaProdotto>('vendite_prodotti', {
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
  codice_prodotto: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // Eliminato il PV, le sue vendite non servono piu'
  id_punto_vendita: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'punti_vendita', key: 'id_puntivendita' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  dal: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  al: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  pezzi: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
  },
  valore: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true,
  },
  id_import: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  aggiornato_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'vendite_prodotti',
  freezeTableName: true,
  timestamps: false,
  indexes: [
    // Una vendita per prodotto, punto vendita e periodo: l'upsert dell'import la sostituisce
    { name: 'vendite_prodotti_prodotto_pv_periodo_uq', unique: true, fields: ['id_gdo', 'codice_prodotto', 'id_punto_vendita', 'dal', 'al'] },
    // Le vendite di un prodotto in un periodo: rendimento e previsione del volantino
    { name: 'idx_vendite_prodotti_id_gdo_codice_prodotto_dal_al', fields: ['id_gdo', 'codice_prodotto', 'dal', 'al'] },
    // Le vendite di un PV: eliminazione a cascata
    { name: 'idx_vendite_prodotti_id_punto_vendita', fields: ['id_punto_vendita'] },
  ],
});

export { VenditaProdottoDefine as VenditaProdotto };
