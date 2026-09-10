import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello ReferenzeGruppo per gestione gruppi foto referenze
 * Basato sulla struttura MongoDB FotoGruppoReferenze
 */

export interface ReferenzeGruppoAttributes {
  id: string;
  guid_id_olympo: string;
  codice_referenza: string;
  id_area?: string;
  id_canale?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReferenzeGruppoCreationAttributes extends Optional<ReferenzeGruppoAttributes, "id" | "createdAt" | "updatedAt"> { }

class ReferenzeGruppo extends Model<ReferenzeGruppoAttributes, ReferenzeGruppoCreationAttributes> implements ReferenzeGruppoAttributes {
  declare id: string;
  declare guid_id_olympo: string;
  declare codice_referenza: string;
  declare id_area?: string;
  declare id_canale?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const ReferenzeGruppoDefine = sequelize.define<ReferenzeGruppo>("referenze_gruppo", {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    validate: {
      notEmpty: {
        msg: 'Il campo id non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id non può essere null'
      }
    }
  },
  guid_id_olympo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo guid_id_olympo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo guid_id_olympo non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo guid_id_olympo deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  codice_referenza: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo codice_referenza non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo codice_referenza non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo codice_referenza deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  id_area: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo id_area deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  id_canale: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo id_canale deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      notNull: {
        msg: 'Il campo createdAt non può essere null'
      },
      isDate: {
        msg: 'Il campo createdAt deve essere una data valida',
        args: true
      }
    }
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      notNull: {
        msg: 'Il campo updatedAt non può essere null'
      },
      isDate: {
        msg: 'Il campo updatedAt deve essere una data valida',
        args: true
      }
    }
  }
}, {
  timestamps: true,
  tableName: "referenze_gruppo",
  freezeTableName: true,
  indexes: [
    {
      fields: ['guid_id_olympo']
    },
    {
      fields: ['codice_referenza']
    },
    {
      fields: ['id_area']
    },
    {
      fields: ['id_canale']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    }
  ]
});

// Hook per gestire errori durante la creazione
ReferenzeGruppoDefine.addHook('beforeCreate', (gruppo: ReferenzeGruppo) => {
  if (!gruppo.guid_id_olympo || gruppo.guid_id_olympo.trim().length === 0) {
    throw new Error('Il campo guid_id_olympo è obbligatorio e non può essere vuoto');
  }
  if (!gruppo.codice_referenza || gruppo.codice_referenza.trim().length === 0) {
    throw new Error('Il campo codice_referenza è obbligatorio e non può essere vuoto');
  }
});

// Hook per gestire errori durante l'aggiornamento
ReferenzeGruppoDefine.addHook('beforeUpdate', (gruppo: ReferenzeGruppo) => {
  if (gruppo.guid_id_olympo !== undefined && (!gruppo.guid_id_olympo || gruppo.guid_id_olympo.trim().length === 0)) {
    throw new Error('Il campo guid_id_olympo non può essere vuoto');
  }
  if (gruppo.codice_referenza !== undefined && (!gruppo.codice_referenza || gruppo.codice_referenza.trim().length === 0)) {
    throw new Error('Il campo codice_referenza non può essere vuoto');
  }
});

export { ReferenzeGruppoDefine as ReferenzeGruppo };
