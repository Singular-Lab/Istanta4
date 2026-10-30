import { DataTypes, Model, Optional } from 'sequelize';
import type { TipoAbbinamento } from '../../../../lib/puntiVendita/storia';
import { sequelize } from '../../db/SequelizeConnector';

/**
 * I punti vendita stampati nelle liste dei volantini: una riga per voce della lista di un kit
 * runtime, come la manda il Plugin InDesign o come arriva da un suo export JSON. E' la fonte della
 * storia del punto vendita (lib/puntiVendita/storia.ts): l'anagrafica non si tocca, la riga si
 * collega al PV con id_punto_vendita quando lo si riconosce (abbinamento) e resta senza altrimenti.
 * Un nuovo invio dello stesso kit sostituisce tutte le sue righe.
 */

export const TIPI_ABBINAMENTO: readonly TipoAbbinamento[] = ['telefono', 'indirizzo', 'probabile'];

export interface PuntoVenditaVolantinoAttributes {
  id: string;
  id_gdo: string;
  id_kit_runtime: string;
  /** Come runtime_kit.id_promo e promo.id_promo: testo, non UUID. */
  id_promo: string;
  id_canale: string | null;
  id_area: string | null;
  nome_file: string | null;
  /** Ordine nella lista del volantino, da 1. */
  posizione: number;
  /** La riga come era stampata. */
  riga: string;
  regione: string | null;
  provincia: string | null;
  gruppo: string | null;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiave_indirizzo: string | null;
  chiave_telefono: string | null;
  id_punto_vendita: string | null;
  abbinamento: TipoAbbinamento | null;
  createdat?: Date;
}

type PuntoVenditaVolantinoCreationAttributes = Optional<
  PuntoVenditaVolantinoAttributes,
  'id' | 'id_canale' | 'id_area' | 'nome_file' | 'regione' | 'provincia' | 'gruppo' | 'localita' | 'indirizzo' | 'telefono'
  | 'chiave_indirizzo' | 'chiave_telefono' | 'id_punto_vendita' | 'abbinamento'
>;

class PuntoVenditaVolantino
  extends Model<PuntoVenditaVolantinoAttributes, PuntoVenditaVolantinoCreationAttributes>
  implements PuntoVenditaVolantinoAttributes {
  declare id: string;
  declare id_gdo: string;
  declare id_kit_runtime: string;
  declare id_promo: string;
  declare id_canale: string | null;
  declare id_area: string | null;
  declare nome_file: string | null;
  declare posizione: number;
  declare riga: string;
  declare regione: string | null;
  declare provincia: string | null;
  declare gruppo: string | null;
  declare localita: string | null;
  declare indirizzo: string | null;
  declare telefono: string | null;
  declare chiave_indirizzo: string | null;
  declare chiave_telefono: string | null;
  declare id_punto_vendita: string | null;
  declare abbinamento: TipoAbbinamento | null;
  declare createdat?: Date;
}

// Un oggetto nuovo per colonna: Sequelize scrive nella definizione di ogni attributo
const testoFacoltativo = () => ({ type: DataTypes.TEXT, allowNull: true });

const PuntoVenditaVolantinoDefine = sequelize.define<PuntoVenditaVolantino>('punti_vendita_volantino', {
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
  // Eliminato il kit, le sue righe non hanno piu' senso
  id_kit_runtime: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'runtime_kit', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  id_promo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  id_canale: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  id_area: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  nome_file: testoFacoltativo(),
  posizione: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  riga: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  regione: testoFacoltativo(),
  provincia: testoFacoltativo(),
  gruppo: testoFacoltativo(),
  localita: testoFacoltativo(),
  indirizzo: testoFacoltativo(),
  telefono: testoFacoltativo(),
  chiave_indirizzo: testoFacoltativo(),
  chiave_telefono: testoFacoltativo(),
  // Eliminato il PV la riga resta, senza abbinamento: il riabbinamento la puo' collegare a un altro
  id_punto_vendita: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'punti_vendita', key: 'id_puntivendita' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  // Stringa e non ENUM: un tipo di abbinamento nuovo non richiede di alterare la colonna
  abbinamento: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: { isIn: [[...TIPI_ABBINAMENTO]] },
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'punti_vendita_volantino',
  freezeTableName: true,
  timestamps: false,
  indexes: [
    // La storia di un PV
    { name: 'idx_punti_vendita_volantino_id_punto_vendita', fields: ['id_punto_vendita'] },
    // Le righe di un kit: sostituzione al nuovo invio, conteggi
    { name: 'idx_punti_vendita_volantino_id_kit_runtime', fields: ['id_kit_runtime'] },
    { name: 'idx_punti_vendita_volantino_gdo_telefono', fields: ['id_gdo', 'chiave_telefono'] },
    { name: 'idx_punti_vendita_volantino_gdo_indirizzo', fields: ['id_gdo', 'chiave_indirizzo'] },
    // Le righe da riabbinare di una GDO
    { name: 'idx_punti_vendita_volantino_gdo_non_abbinate', fields: ['id_gdo'], where: { id_punto_vendita: null } },
  ],
});

export { PuntoVenditaVolantinoDefine as PuntoVenditaVolantino };
