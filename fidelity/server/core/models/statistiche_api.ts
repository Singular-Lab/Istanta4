import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db';

// Interfaccia per gli attributi del modello
interface StatisticheApiAttributes {
  id_statistiche_api: number;
  endpoint: string;
  metodo: string;
  codice_risposta: number;
  tempo_risposta_ms: number;
  dimensione_risposta_bytes: number;
  ip_richiedente: string;
  user_agent: string;
  ruolo_utente: string;
  api_key_utilizzata: string;
  parametri_richiesta: string; // JSON string
  timestamp_richiesta: Date;
  timestamp_risposta: Date;
  errore: string | null;
  stack_trace: string | null;
  created_at: Date;
  updated_at: Date;
}

// Interfaccia per i parametri di creazione (opzionali)
interface StatisticheApiCreationAttributes extends Optional<StatisticheApiAttributes, 'id_statistiche_api' | 'created_at' | 'updated_at'> { }

// Classe del modello
export class StatisticheApi extends Model<StatisticheApiAttributes, StatisticheApiCreationAttributes> implements StatisticheApiAttributes {
  declare id_statistiche_api: number;
  declare endpoint: string;
  declare metodo: string;
  declare codice_risposta: number;
  declare tempo_risposta_ms: number;
  declare dimensione_risposta_bytes: number;
  declare ip_richiedente: string;
  declare user_agent: string;
  declare ruolo_utente: string;
  declare api_key_utilizzata: string;
  declare parametri_richiesta: string;
  declare timestamp_richiesta: Date;
  declare timestamp_risposta: Date;
  declare errore: string | null;
  declare stack_trace: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Metodi di istanza
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Definizione del modello
StatisticheApi.init(
  {
    id_statistiche_api: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    endpoint: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'Endpoint API chiamato'
    },
    metodo: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'Metodo HTTP utilizzato (GET, POST, PUT, DELETE)'
    },
    codice_risposta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Codice di stato HTTP della risposta'
    },
    tempo_risposta_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Tempo di risposta in millisecondi'
    },
    dimensione_risposta_bytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Dimensione della risposta in bytes'
    },
    ip_richiedente: {
      type: DataTypes.STRING(45),
      allowNull: false,
      comment: 'Indirizzo IP del richiedente'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User Agent del browser/client'
    },
    ruolo_utente: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Ruolo dell\'utente che ha effettuato la richiesta'
    },
    api_key_utilizzata: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Hash dell\'API key utilizzata (non la chiave completa per sicurezza)'
    },
    parametri_richiesta: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Parametri della richiesta in formato JSON'
    },
    timestamp_richiesta: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Timestamp di quando è stata ricevuta la richiesta'
    },
    timestamp_risposta: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Timestamp di quando è stata inviata la risposta'
    },
    errore: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Messaggio di errore se presente'
    },
    stack_trace: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Stack trace dell\'errore se presente'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'statistiche_api',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_statistiche_api_endpoint',
        fields: ['endpoint']
      },
      {
        name: 'idx_statistiche_api_timestamp',
        fields: ['timestamp_richiesta']
      },
      {
        name: 'idx_statistiche_api_codice_risposta',
        fields: ['codice_risposta']
      },
      {
        name: 'idx_statistiche_api_ruolo',
        fields: ['ruolo_utente']
      },
      {
        name: 'idx_statistiche_api_metodo',
        fields: ['metodo']
      },
      {
        name: 'idx_statistiche_api_composite',
        fields: ['endpoint', 'metodo', 'timestamp_richiesta']
      }
    ],
    comment: 'Tabella per il tracking delle statistiche delle API esterne'
  }
);

export default StatisticheApi;
