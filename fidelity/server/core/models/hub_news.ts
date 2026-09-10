import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db';

export interface HubNewsAttributes {
  id: string;
  titolo: string;
  contenuto: string;
  tipo: 'info' | 'warning' | 'success' | 'update';
  icona: string | null;
  url: string | null;
  in_evidenza: boolean;
  ruoli_destinatari: string[];
  attivo: boolean;
  data_pubblicazione: Date;
  data_scadenza: Date | null;
  autore_nome: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

type HubNewsCreationAttributes = Optional<
  HubNewsAttributes,
  'id' | 'tipo' | 'icona' | 'url' | 'in_evidenza' | 'ruoli_destinatari' | 'attivo' | 'data_pubblicazione' | 'data_scadenza' | 'autore_nome' | 'meta' | 'createdAt' | 'updatedAt'
>;

export class HubNews
  extends Model<HubNewsAttributes, HubNewsCreationAttributes>
  implements HubNewsAttributes {
  declare id: string;
  declare titolo: string;
  declare contenuto: string;
  declare tipo: 'info' | 'warning' | 'success' | 'update';
  declare icona: string | null;
  declare url: string | null;
  declare in_evidenza: boolean;
  declare ruoli_destinatari: string[];
  declare attivo: boolean;
  declare data_pubblicazione: Date;
  declare data_scadenza: Date | null;
  declare autore_nome: string | null;
  declare meta: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

HubNews.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    titolo: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Titolo della news',
    },
    contenuto: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Corpo della news (supporta HTML)',
    },
    tipo: {
      type: DataTypes.ENUM('info', 'warning', 'success', 'update'),
      allowNull: false,
      defaultValue: 'info',
      comment: 'Categoria visuale della news',
    },
    icona: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Icona: nome Lucide oppure data URI base64',
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Link opzionale "Leggi di più"',
    },
    in_evidenza: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Se la news è pinnata in alto',
    },
    ruoli_destinatari: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array di TIPO_UTENTI destinatari, vuoto = tutti',
    },
    attivo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Se la news è visibile',
    },
    data_pubblicazione: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Data da cui la news è visibile',
    },
    data_scadenza: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Data dopo la quale la news si nasconde automaticamente',
    },
    autore_nome: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nome autore denormalizzato',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Metadata extra',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'hub_news',
    timestamps: true,
    indexes: [
      { name: 'idx_hub_news_attivo', fields: ['attivo'] },
      { name: 'idx_hub_news_data_pub', fields: ['data_pubblicazione'] },
      { name: 'idx_hub_news_evidenza', fields: ['in_evidenza'] },
    ],
    comment: 'News e aggiornamenti visualizzati nella dashboard hub',
  }
);

export default HubNews;
