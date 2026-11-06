import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

/**
 * I collegamenti fatti a mano dalla gestione dei punti vendita fra le righe dei volantini non
 * abbinate e un punto vendita dell'anagrafica. Ogni collegamento è una regola della GDO: le chiavi
 * delle righe collegate (utils/chiaviRigheVolantino.ts: telefono, località e indirizzo, testo) e il
 * PV a cui vanno. Il riabbinamento la applica prima delle regole automatiche, così vale anche per i
 * volantini sincronizzati di nuovo (che riscrivono le righe del kit) e per quelli futuri.
 * L'anagrafica non si tocca. Eliminato il PV, i suoi collegamenti se ne vanno.
 */

export interface AbbinamentoManualePvVolantinoAttributes {
  id: string;
  id_gdo: string;
  id_punto_vendita: string;
  /** Chiavi delle righe collegate: "tel:...", "ind:<località>|<indirizzo>", "riga:...". */
  chiavi: string[];
  /** La riga com'era stampata quando è stata collegata. */
  riga: string;
  /** L'utente che l'ha collegata. */
  creato_da: string | null;
  creato_il: Date;
}

type AbbinamentoManualePvVolantinoCreationAttributes = Optional<AbbinamentoManualePvVolantinoAttributes, 'id' | 'creato_da' | 'creato_il'>;

class AbbinamentoManualePvVolantino
  extends Model<AbbinamentoManualePvVolantinoAttributes, AbbinamentoManualePvVolantinoCreationAttributes>
  implements AbbinamentoManualePvVolantinoAttributes {
  declare id: string;
  declare id_gdo: string;
  declare id_punto_vendita: string;
  declare chiavi: string[];
  declare riga: string;
  declare creato_da: string | null;
  declare creato_il: Date;
}

const AbbinamentoManualePvVolantinoDefine = sequelize.define<AbbinamentoManualePvVolantino>('abbinamenti_manuali_pv_volantino', {
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
  // Eliminato il PV, il collegamento non ha piu' senso
  id_punto_vendita: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'punti_vendita', key: 'id_puntivendita' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  chiavi: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: false,
  },
  riga: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  creato_da: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  creato_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'abbinamenti_manuali_pv_volantino',
  freezeTableName: true,
  timestamps: false,
  indexes: [
    // I collegamenti di una GDO: riabbinamento ed elenco della gestione
    { name: 'idx_abbinamenti_manuali_pv_volantino_id_gdo', fields: ['id_gdo'] },
    { name: 'idx_abbinamenti_manuali_pv_volantino_id_punto_vendita', fields: ['id_punto_vendita'] },
  ],
});

export { AbbinamentoManualePvVolantinoDefine as AbbinamentoManualePvVolantino };
