import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

// Interfaccia per gli attributi di AttivitaUtente
export interface AttivitaUtenteAttributes {
  id_attivita_utente?: string;
  id_utente_attivita_utente: string;
  id_attivita_attivita_utente: string;
  letto_attivita_utente: boolean;
  data_lettura_attivita_utente?: Date;
  createdat?: Date;
  updatedat?: Date;
}

type AttivitaUtenteCreationAttributes = Optional<AttivitaUtenteAttributes, 'id_attivita_utente'>;

class AttivitaUtenteModel extends Model<AttivitaUtenteAttributes, AttivitaUtenteCreationAttributes> implements AttivitaUtenteAttributes {
  declare id_attivita_utente: string;
  declare id_utente_attivita_utente: string;
  declare id_attivita_attivita_utente: string;
  declare letto_attivita_utente: boolean;
  declare data_lettura_attivita_utente?: Date;
  declare createdat?: Date;
  declare updatedat?: Date;

  // Metodi di istanza
  public markAsRead(): void {
    this.letto_attivita_utente = true;
    this.data_lettura_attivita_utente = new Date();
  }

  public markAsUnread(): void {
    this.letto_attivita_utente = false;
    this.data_lettura_attivita_utente = undefined;
  }

  public isRead(): boolean {
    return this.letto_attivita_utente;
  }


}

const AttivitaUtente = sequelize.define<AttivitaUtenteModel>("attivita_utente", {
  id_attivita_utente: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
    field: 'id_attivita_utente'
  },
  id_utente_attivita_utente: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'id_utente_attivita_utente'
  },
  id_attivita_attivita_utente: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'id_attivita_attivita_utente'
  },
  letto_attivita_utente: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'letto_attivita_utente'
  },
  data_lettura_attivita_utente: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'data_lettura_attivita_utente'
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'createdat'
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'updatedat'
  }
}, {
  tableName: "attivita_utente",
  timestamps: true,
  createdAt: 'createdat',
  updatedAt: 'updatedat',
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['id_utente_attivita_utente', 'id_attivita_attivita_utente']
    },
    {
      fields: ['id_utente_attivita_utente']
    },
    {
      fields: ['letto_attivita_utente']
    },
    {
      fields: ['data_lettura_attivita_utente']
    }
  ],
  hooks: {
    beforeCreate: (attivitaUtente: AttivitaUtenteModel) => {
      // Imposta la data di creazione se non specificata
      if (!attivitaUtente.createdat) {
        attivitaUtente.createdat = new Date();
      }
    },
    beforeUpdate: (attivitaUtente: AttivitaUtenteModel) => {
      // Aggiorna la data di lettura quando viene marcato come letto
      if (attivitaUtente.changed('letto_attivita_utente') && attivitaUtente.letto_attivita_utente) {
        attivitaUtente.data_lettura_attivita_utente = new Date();
      }
    }
  }
});

// Le relazioni sono ora gestite centralmente in relazioni.ts

export { AttivitaUtente };
