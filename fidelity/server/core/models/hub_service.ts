import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db';

export interface HubServiceAttributes {
  id: string;
  codice: string;
  nome: string;
  descrizione: string | null;
  icona: string;
  colore: string;
  url: string;
  tipo_url: 'internal' | 'external' | 'external_fico';
  attivo: boolean;
  in_manutenzione: boolean;
  in_evidenza: boolean;
  ordine: number;
  tipo_utente: string;
  ruolo_gdo: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

type HubServiceCreationAttributes = Optional<
  HubServiceAttributes,
  'id' | 'descrizione' | 'icona' | 'colore' | 'attivo' | 'in_manutenzione' | 'in_evidenza' | 'ordine' | 'ruolo_gdo' | 'meta' | 'createdAt' | 'updatedAt'
>;

export class HubService
  extends Model<HubServiceAttributes, HubServiceCreationAttributes>
  implements HubServiceAttributes {
  declare id: string;
  declare codice: string;
  declare nome: string;
  declare descrizione: string | null;
  declare icona: string;
  declare colore: string;
  declare url: string;
  declare tipo_url: 'internal' | 'external' | 'external_fico';
  declare attivo: boolean;
  declare in_manutenzione: boolean;
  declare in_evidenza: boolean;
  declare ordine: number;
  declare tipo_utente: string;
  declare ruolo_gdo: string | null;
  declare meta: Record<string, unknown> | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

HubService.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    codice: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Codice del servizio (fidelity_promotion, istanta, ecc.) — unicità garantita da indice composito codice+tipo_utente+ruolo_gdo',
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nome visualizzato del servizio',
    },
    descrizione: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descrizione del servizio per questo tipo utente',
    },
    icona: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Box',
      comment: 'Icona: nome Lucide oppure data URI base64 (data:image/...;base64,...)',
    },
    colore: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'primary',
      comment: 'Colore tema (classe Tailwind o hex)',
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'URL destinazione del servizio',
    },
    tipo_url: {
      type: DataTypes.ENUM('internal', 'external', 'external_fico'),
      allowNull: false,
      defaultValue: 'internal',
      comment: 'Tipo di redirect (internal = React Router, external = nuova finestra)',
    },
    attivo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Se il servizio è abilitato',
    },
    in_manutenzione: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Se il servizio è in manutenzione',
    },
    in_evidenza: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Se il servizio appare nella sezione in evidenza',
    },
    ordine: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Ordine di visualizzazione',
    },
    tipo_utente: {
      type: DataTypes.STRING(30),
      allowNull: false,
      comment: 'Tipo utente a cui è destinato il servizio (TIPO_UTENTI)',
    },
    ruolo_gdo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Ruolo GDO specifico (solo quando tipo_utente=GDO). NULL = tutti i ruoli GDO',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Metadata extra (badges, tags, ecc.)',
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
    tableName: 'hub_services',
    timestamps: true,
    indexes: [
      { name: 'idx_hub_service_codice_tipo_ruolo', unique: true, fields: ['codice', 'tipo_utente', 'ruolo_gdo'] },
      { name: 'idx_hub_service_tipo_utente', fields: ['tipo_utente'] },
      { name: 'idx_hub_service_attivo', fields: ['attivo'] },
      { name: 'idx_hub_service_ordine', fields: ['ordine'] },
    ],
    comment: 'Servizi/applicazioni disponibili nella dashboard hub post-login',
  }
);

export default HubService;
