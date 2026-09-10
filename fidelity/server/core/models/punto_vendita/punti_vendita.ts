import { DataTypes, Model, Op, Optional } from 'sequelize';
import { PuntiVenditaAttributes } from '../../../../lib/types';
import { sequelize } from '../../db/SequelizeConnector';

type PuntiVenditaCreationAttributes = Optional<PuntiVenditaAttributes, 'id_puntivendita'>;

class PuntoVendita extends Model<PuntiVenditaAttributes, PuntiVenditaCreationAttributes> implements PuntiVenditaAttributes {
  declare id_puntivendita: string;
  declare nome_puntivendita: string;
  declare citta_puntivendita: string;
  declare cap_puntivendita: string;
  declare indirizzo_puntivendita: string;
  declare lat_puntivendita: number;
  declare lon_puntivendita: number;
  declare id_combinazione_canale_area_puntivendita: string;
  declare id_gdo_puntivendita: string;
  declare ragionesociale_puntivendita?: string;
  declare provincia_puntivendita?: string;
  declare regione_puntivendita?: string;
  declare telefono_puntivendita?: string | undefined;
  declare createdat?: Date;
  declare updatedat: Date;

  // Metodi di istanza
  public getIndirizzoCompleto(): string {
    const parti = [
      this.indirizzo_puntivendita,
      this.cap_puntivendita,
      this.citta_puntivendita,
      this.provincia_puntivendita
    ].filter(Boolean);
    return parti.join(', ');
  }

  public getCoordinate(): { lat: number; lon: number } | null {
    if (this.lat_puntivendita && this.lon_puntivendita) {
      return { lat: this.lat_puntivendita, lon: this.lon_puntivendita };
    }
    return null;
  }

  public hasCoordinate(): boolean {
    return !!(this.lat_puntivendita && this.lon_puntivendita);
  }

  public getNomeDisplay(): string {
    return this.ragionesociale_puntivendita || this.nome_puntivendita;
  }

  // Metodi statici
  public static async findByCitta(citta: string): Promise<PuntoVendita[]> {
    return await PuntoVendita.findAll({
      where: { citta_puntivendita: citta },
      order: [['nome_puntivendita', 'ASC']]
    });
  }

  public static async findByGDO(idGDO: string): Promise<PuntoVendita[]> {
    return await PuntoVendita.findAll({
      where: { id_gdo_puntivendita: idGDO },
      order: [['citta_puntivendita', 'ASC'], ['nome_puntivendita', 'ASC']]
    });
  }

  public static async findNearby(lat: number, lon: number, radiusKm: number = 10): Promise<PuntoVendita[]> {
    // Query per trovare punti vendita nel raggio specificato
    const query = `
            SELECT *,
                   (6371 * acos(cos(radians(?)) * cos(radians(lat_puntivendita)) *
                    cos(radians(lon_puntivendita) - radians(?)) +
                    sin(radians(?)) * sin(radians(lat_puntivendita))) AS distance
            FROM punti_vendita
            WHERE lat_puntivendita IS NOT NULL
              AND lon_puntivendita IS NOT NULL
            HAVING distance <= ?
            ORDER BY distance
        `;

    return await sequelize.query(query, {
      replacements: [lat, lon, lat, radiusKm],
      model: PuntoVendita,
      mapToModel: true
    });
  }

  public static async countByRegione(): Promise<Array<{ regione: string; count: number }>> {
    return await PuntoVendita.findAll({
      attributes: [
        'regione_puntivendita',
        [sequelize.fn('COUNT', sequelize.col('id_puntivendita')), 'count']
      ],
      where: {
        regione_puntivendita: { [Op.not]: null as any }
      },
      group: ['regione_puntivendita'],
      order: [[sequelize.fn('COUNT', sequelize.col('id_puntivendita')), 'DESC']]
    }) as any;
  }
}

PuntoVendita.init({
  id_puntivendita: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
    field: 'id_puntivendita'
  },
  nome_puntivendita: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 255]
    },
    field: 'nome_puntivendita'
  },
  citta_puntivendita: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    },
    field: 'citta_puntivendita'
  },
  cap_puntivendita: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      notEmpty: true,
      is: /^\d{5}$/
    },
    field: 'cap_puntivendita'
  },
  indirizzo_puntivendita: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [5, 255]
    },
    field: 'indirizzo_puntivendita'
  },
  lat_puntivendita: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    validate: {
      min: -90,
      max: 90
    },
    field: 'lat_puntivendita'
  },
  lon_puntivendita: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    validate: {
      min: -180,
      max: 180
    },
    field: 'lon_puntivendita'
  },
  id_combinazione_canale_area_puntivendita: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'id_combinazione_canale_area_puntivendita'
  },
  id_gdo_puntivendita: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'id_gdo_puntivendita'
  },
  ragionesociale_puntivendita: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'ragionesociale_puntivendita'
  },
  provincia_puntivendita: {
    type: DataTypes.STRING(10),
    allowNull: true,
    validate: {
      len: [2, 10]
    },
    field: 'provincia_puntivendita'
  },
  regione_puntivendita: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'regione_puntivendita'
  },
  telefono_puntivendita: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[\+]?[0-9\s\-\(\)]{8,20}$/
    },
    field: 'telefono_puntivendita'
  }
}, {
  sequelize,
  tableName: "punti_vendita",
  timestamps: true,
  createdAt: 'createdat',
  updatedAt: 'updatedat',
  indexes: [
    {
      fields: ['citta_puntivendita']
    },
    {
      fields: ['id_gdo_puntivendita']
    },
    {
      fields: ['regione_puntivendita']
    },
    {
      fields: ['lat_puntivendita', 'lon_puntivendita']
    },
    {
      fields: ['nome_puntivendita']
    }
  ],
  hooks: {
    beforeCreate: (puntoVendita: PuntoVendita) => {
      // Sanitizzazione dati
      if (puntoVendita.nome_puntivendita) {
        puntoVendita.nome_puntivendita = puntoVendita.nome_puntivendita.trim();
      }
      if (puntoVendita.citta_puntivendita) {
        puntoVendita.citta_puntivendita = puntoVendita.citta_puntivendita.trim();
      }
      if (puntoVendita.indirizzo_puntivendita) {
        puntoVendita.indirizzo_puntivendita = puntoVendita.indirizzo_puntivendita.trim();
      }
      if (puntoVendita.ragionesociale_puntivendita) {
        puntoVendita.ragionesociale_puntivendita = puntoVendita.ragionesociale_puntivendita.trim();
      }
    },
    beforeUpdate: (puntoVendita: PuntoVendita) => {
      // Validazione coordinate
      if (puntoVendita.changed('lat_puntivendita') || puntoVendita.changed('lon_puntivendita')) {
        if ((puntoVendita.lat_puntivendita && !puntoVendita.lon_puntivendita) ||
          (!puntoVendita.lat_puntivendita && puntoVendita.lon_puntivendita)) {
          throw new Error('Le coordinate devono essere entrambe presenti o entrambe assenti');
        }
      }
    },
    afterCreate: (puntoVendita: PuntoVendita) => {
      console.log(`Nuovo punto vendita creato: ${puntoVendita.getNomeDisplay()} a ${puntoVendita.citta_puntivendita}`);
    }
  }
});

export { PuntoVendita };
