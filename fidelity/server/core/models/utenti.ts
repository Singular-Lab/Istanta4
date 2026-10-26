import { DataTypes, Model, Optional, } from 'sequelize';
import { STATO_UTENTI, TIPO_UTENTI, UTENTE_GENERE } from '../../../lib/enums';
import { ValidationError } from '../../../lib/errors';
import { UtenteAttributes, UtentiMeta } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';
type UtenteCreationAttributes = Optional<UtenteAttributes, 'id_utenti'>;

class Utente extends Model<UtenteAttributes, UtenteCreationAttributes> implements UtenteAttributes {
  declare id_utenti: string;
  declare outsider_utenti: boolean;
  declare nome_utenti: string;
  declare cognome_utenti: string;
  declare email_utenti: string;
  declare password_utenti?: string;
  declare datadinascita_utenti: Date;
  declare residenza_utenti: string;
  declare tipo_utenti: TIPO_UTENTI;
  declare stato_utenti: STATO_UTENTI;
  declare sesso_utenti: UTENTE_GENERE;
  declare privatekey_utenti: string;
  declare telefono_utenti: string;
  declare lat_utenti?: number;
  declare lon_utenti?: number
  declare geom_utenti?: any;
  declare createdat?: Date;
  declare updatedat: Date;
  declare meta_utenti: UtentiMeta | null;

  // Metodi di istanza
  public getNomeCompleto(): string {
    return `${this.nome_utenti} ${this.cognome_utenti}`;
  }

  public isAttivo(): boolean {
    return this.stato_utenti === STATO_UTENTI.ATTIVO;
  }

  public isAdmin(): boolean {
    return this.tipo_utenti === TIPO_UTENTI.SUPERADMIN;
  }

  public getEta(): number {
    if (!this.datadinascita_utenti) return 0;
    const oggi = new Date();
    const nascita = new Date(this.datadinascita_utenti);
    return oggi.getFullYear() - nascita.getFullYear();
  }

  // Metodi statici
  public static async findByEmail(email: string): Promise<Utente | null> {
    return await Utente.findOne({ where: { email_utenti: email } });
  }

  public static async findAttivi(): Promise<Utente[]> {
    return await Utente.findAll({
      where: { stato_utenti: STATO_UTENTI.ATTIVO },
      order: [['nome_utenti', 'ASC']]
    });
  }

  public static async countByTipo(tipo: TIPO_UTENTI): Promise<number> {
    return await Utente.count({ where: { tipo_utenti: tipo } });
  }
}

Utente.init({
  id_utenti: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
    field: 'id_utenti'
  },
  outsider_utenti: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'outsider_utenti'
  },
  nome_utenti: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    },
    field: 'nome_utenti'
  },
  cognome_utenti: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    },
    field: 'cognome_utenti'
  },
  email_utenti: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true
    },
    field: 'email_utenti'
  },
  password_utenti: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [6, 255]
    },
    field: 'password_utenti'
  },
  datadinascita_utenti: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: true,
      isPast(value: Date) {
        if (value && new Date(value) >= new Date()) {
          throw new Error('La data di nascita deve essere nel passato');
        }
      }
    },
    field: 'datadinascita_utenti'
  },
  residenza_utenti: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'residenza_utenti'
  },
  tipo_utenti: {
    type: DataTypes.ENUM(...Object.values(TIPO_UTENTI)),
    allowNull: false,
    field: 'tipo_utenti'
  },
  stato_utenti: {
    type: DataTypes.ENUM(...Object.values(STATO_UTENTI)),
    allowNull: false,
    defaultValue: STATO_UTENTI.ATTIVO,
    field: 'stato_utenti'
  },
  privatekey_utenti: {
    type: DataTypes.STRING(512),
    allowNull: true,
    field: 'privatekey_utenti'
  },
  telefono_utenti: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[\+]?[0-9\s\-\(\)]{8,20}$/
    },
    field: 'telefono_utenti'
  },
  meta_utenti: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'meta_utenti'
  },
  sesso_utenti: {
    type: DataTypes.ENUM(...Object.values(UTENTE_GENERE)),
    allowNull: true,
    field: 'sesso_utenti'
  },
  lat_utenti: {
    type: DataTypes.DOUBLE,
    allowNull: true,
    field: 'lat_utenti'
  },
  lon_utenti: {
    type: DataTypes.DOUBLE,
    allowNull: true,
    field: 'lon_utenti'
  },
  geom_utenti: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    allowNull: true,
    field: 'geom_utenti'
  },

}, {
  sequelize,
  tableName: "utenti",
  timestamps: true,
  createdAt: 'createdat',
  updatedAt: 'updatedat',
  indexes: [
    {
      unique: true,
      fields: ['email_utenti']
    },
    {
      fields: ['tipo_utenti']
    },
    {
      fields: ['stato_utenti']
    },
    {
      fields: ['nome_utenti', 'cognome_utenti']
    },
    {
      fields: ['meta_utenti']
    }
  ],
  hooks: {

    beforeCreate: async (utente: Utente) => {
      // Sanitizzazione dati
      if (utente.nome_utenti) {
        utente.nome_utenti = utente.nome_utenti.trim();
      }
      if (utente.cognome_utenti) {
        utente.cognome_utenti = utente.cognome_utenti.trim();
      }
      if (utente.email_utenti) {
        utente.email_utenti = utente.email_utenti.toLowerCase().trim();
      }
      // Controllo se esiste già un utente con lo stesso email
      const utenteEsistente = await Utente.findOne({ where: { email_utenti: utente.email_utenti } });
      if (utenteEsistente) {
        throw new ValidationError({
          message: 'L\'email è già in uso',
          field: 'email_utenti'
        });
      }
      if (utente.lat_utenti && utente.lon_utenti) {
        utente.geom_utenti = {
          type: 'Point',
          coordinates: [utente.lon_utenti, utente.lat_utenti]
        };
      }
    },
    afterCreate: (utente: Utente) => {
      console.log(`Nuovo utente creato: ${utente.getNomeCompleto()} (${utente.email_utenti})`);
    },
    beforeUpdate: async (utente: Utente) => {
      // Sincronizza geom quando cambiano lat/lon
      if (utente.changed('lat_utenti') || utente.changed('lon_utenti')) {
        if (utente.lat_utenti && utente.lon_utenti) {
          utente.geom_utenti = {
            type: 'Point',
            coordinates: [utente.lon_utenti, utente.lat_utenti]
          };
        } else {
          utente.geom_utenti = null;
        }
      }
    }
  }
});

export { Utente };
