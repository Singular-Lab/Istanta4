import { DataTypes, Model, Optional } from 'sequelize';
import { STATO_PROMO } from '../../../lib/enums';
import type { MenaboLayoutSalvato } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello Promo con validazioni robuste per prevenire errori "Cannot convert undefined or null to object"
 *
 * Modifiche implementate:
 * - Validazione esplicita dei valori enum per evitare errori di inizializzazione
 * - Validazioni a livello di campo per tutti i campi obbligatori
 * - Hook di validazione per creazione e aggiornamento
 * - Validazione della coerenza delle date
 * - Gestione robusta dei valori null/undefined
 */

export interface PromoAttributes {
  id_promo: string;
  nome_promo: string;
  data_registrazione: Date;
  validita_dal: Date;
  validita_al: Date;
  data_scadenza: Date | null;
  offset_visibilita: number;
  stato: STATO_PROMO;
  context: object;
  menabo_layout?: MenaboLayoutSalvato | null;
  gdo: string;
  createdat?: Date;
  updatedat?: Date;
}

interface PromoCreationAttributes extends Optional<PromoAttributes, "id_promo"> { }

class Promo extends Model<PromoAttributes, PromoCreationAttributes> implements PromoAttributes {
  declare id_promo: string;
  declare nome_promo: string;
  declare data_registrazione: Date;
  declare validita_dal: Date;
  declare validita_al: Date;
  declare data_scadenza: Date | null;
  declare offset_visibilita: number;
  declare stato: STATO_PROMO;
  declare context: object;
  declare menabo_layout?: MenaboLayoutSalvato | null;
  declare gdo: string;
  declare createdat?: Date;
  declare updatedat?: Date;

}

// Validazione dei valori enum per evitare errori di inizializzazione
const STATO_PROMO_VALUES = Object.values(STATO_PROMO);
if (!STATO_PROMO_VALUES || STATO_PROMO_VALUES.length === 0) {
  throw new Error('STATO_PROMO enum non è stato inizializzato correttamente');
}

const PromoDefine = sequelize.define<Promo>("promo", {
  id_promo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
    validate: {
      notEmpty: {
        msg: 'Il campo id_promo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_promo non può essere null'
      }
    }
  },
  nome_promo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo nome_promo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo nome_promo non può essere null'
      }
    }
  },
  data_registrazione: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo data_registrazione non può essere null'
      },
      isDate: {
        msg: 'Il campo data_registrazione deve essere una data valida',
        args: true
      }
    }
  },
  validita_dal: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo validita_dal non può essere null'
      },
      isDate: {
        msg: 'Il campo validita_dal deve essere una data valida',
        args: true
      }
    }
  },
  validita_al: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo validita_al non può essere null'
      },
      isDate: {
        msg: 'Il campo validita_al deve essere una data valida',
        args: true
      }
    }
  },
  data_scadenza: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Il campo data_scadenza deve essere una data valida',
        args: true
      }
    }
  },
  offset_visibilita: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo offset_visibilita non può essere null'
      },
      isInt: {
        msg: 'Il campo offset_visibilita deve essere un numero intero'
      },
      min: {
        args: [0],
        msg: 'Il campo offset_visibilita deve essere maggiore o uguale a 0'
      }
    }
  },
  stato: {
    type: DataTypes.ENUM(...STATO_PROMO_VALUES as string[]),
    allowNull: false,
    validate: {
      isIn: {
        args: [STATO_PROMO_VALUES],
        msg: 'Il campo stato deve corrispondere a un valore valido di STATO_PROMO'
      }
    }
  },
  context: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    validate: {
      notNull: {
        msg: 'Il campo context non può essere null'
      },
      isValidContext(value: any) {
        if (value === null || value === undefined) {
          throw new Error('Il campo context non può essere null o undefined');
        }
      }
    }
  },
  menabo_layout: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null,
  },
  gdo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo gdo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo gdo non può essere null'
      }
    }
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Il campo createdat deve essere una data valida',
        args: true
      }
    }
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'Il campo updatedat deve essere una data valida',
        args: true
      }
    }
  }
}, {
  timestamps: false,
  tableName: "promo",
  freezeTableName: true,
  validate: {
    validitaDateCoerenti() {
      if (this.validita_dal && this.validita_al && this.validita_dal >= this.validita_al) {
        throw new Error('La data di inizio validità deve essere precedente alla data di fine validità');
      }
    },
    scadenzaPrimaDellaValidita() {
      if (this.data_scadenza && this.validita_dal && this.data_scadenza >= this.validita_dal) {
        throw new Error('La data di scadenza deve essere precedente alla data di inizio validità');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
PromoDefine.addHook('beforeCreate', (promo: Promo) => {
  // Validazione aggiuntiva per il campo context
  if (!promo.context || typeof promo.context !== 'object') {
    throw new Error('Il campo context deve essere un oggetto valido');
  }
});

// Hook per gestire errori durante l'aggiornamento
PromoDefine.addHook('beforeUpdate', (promo: Promo) => {
  // Validazione aggiuntiva per il campo context
  if (promo.context !== undefined && (!promo.context || typeof promo.context !== 'object')) {
    throw new Error('Il campo context deve essere un oggetto valido');
  }

  // Validazione per il campo stato
  if (promo.stato !== undefined) {
    if (!STATO_PROMO_VALUES.includes(promo.stato)) {
      throw new Error(`Stato non valido: ${promo.stato}. Stati validi: ${STATO_PROMO_VALUES.join(', ')}`);
    }
  }
});

export { PromoDefine as Promo };
