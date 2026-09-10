import { DataTypes, Model, Optional } from 'sequelize';
import { TIPO_KIT_DESIGN } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello Volantino per gestione promozioni e volantini
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface RaccoglitoreKitAttributes {
  id: string;
  id_aree: string[];
  id_canali: string[];
  id_formato: string;
  id_pv: string[];
  titolo: string;
  filtro: any[];
  declinazioni: any[];
  tipi_di_export_in_kit: Array<{
    tipo_di_export_guid_id: string | null;
    filtro: any[] | null;
  }>;
  quantita: number;
  tipo: TIPO_KIT_DESIGN;
  files: any[];
  filtro_contesto: Array<{
    titoloFiltro: string;
    condizioni: { valore: string, schemaScelto: string }[];
  }>;
  tags: Array<string>;
  createdAt: Date;
  updatedAt: Date;
}

interface RaccoglitoreKitCreationAttributes extends Optional<RaccoglitoreKitAttributes, "id" | "createdAt" | "updatedAt"> { }

class RaccoglitoreKit extends Model<RaccoglitoreKitAttributes, RaccoglitoreKitCreationAttributes> implements RaccoglitoreKitAttributes {
  declare id: string;
  declare id_aree: string[];
  declare id_canali: string[];
  declare id_formato: string;
  declare id_pv: string[];
  declare titolo: string;
  declare filtro: any[];
  declare declinazioni: any[];
  declare tipi_di_export_in_kit: Array<{
    tipo_di_export_guid_id: string | null;
    filtro: any[] | null;
  }>;
  declare quantita: number;
  declare tipo: TIPO_KIT_DESIGN;
  declare files: any[];
  declare filtro_contesto: any[];
  declare tags: Array<string>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const RaccoglitoreKitDefine = sequelize.define<RaccoglitoreKit>("raccoglitore_kit", {
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
  id_aree: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo id_aree non può essere null'
      },
      isValidGuidArray(value: string[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo id_aree deve essere un array');
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const guid of value) {
          if (guid && !uuidRegex.test(guid)) {
            throw new Error(`GUID non valido nell'array id_aree: ${guid}`);
          }
        }
      }
    }
  },
  id_canali: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo id_canali non può essere null'
      },
      isValidGuidArray(value: string[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo id_canali deve essere un array');
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const guid of value) {
          if (guid && !uuidRegex.test(guid)) {
            throw new Error(`GUID non valido nell'array id_canali: ${guid}`);
          }
        }
      }
    }
  },
  id_formato: {
    type: DataTypes.UUID,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo id_formato non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo id_formato non può essere null'
      }
    }
  },
  id_pv: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo id_pv non può essere null'
      },
      isValidGuidArray(value: string[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo id_pv deve essere un array');
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const guid of value) {
          if (guid && !uuidRegex.test(guid)) {
            throw new Error(`GUID non valido nell'array id_pv: ${guid}`);
          }
        }
      }
    }
  },
  titolo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo titolo non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo titolo non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo titolo deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  filtro: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo filtro non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo filtro deve essere un array');
        }
      }
    }
  },
  declinazioni: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo declinazioni non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo declinazioni deve essere un array');
        }
      }
    }
  },
  tipi_di_export_in_kit: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo tipi_di_export_in_kit non può essere null'
      },
      isValidExportTypes(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo tipi_di_export_in_kit deve essere un array');
        }
        for (const item of value) {
          if (!item || typeof item !== 'object') {
            throw new Error('Ogni elemento di tipi_di_export_in_kit deve essere un oggetto');
          }
          if (item.tipo_di_export_guid_id !== null && (!item.tipo_di_export_guid_id || typeof item.tipo_di_export_guid_id !== 'string')) {
            throw new Error('Ogni elemento di tipi_di_export_in_kit deve avere un tipo_di_export_guid_id valido o null');
          }
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (item.tipo_di_export_guid_id && item.tipo_di_export_guid_id !== null && !uuidRegex.test(item.tipo_di_export_guid_id)) {
            throw new Error(`GUID non valido in tipi_di_export_in_kit: ${item.tipo_di_export_guid_id}`);
          }
          if (item.filtro !== null && item.filtro !== undefined && !Array.isArray(item.filtro)) {
            throw new Error('Il campo filtro in tipi_di_export_in_kit deve essere null o un array');
          }
        }
      }
    }
  },
  quantita: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      notNull: {
        msg: 'Il campo quantita non può essere null'
      },
      isInt: {
        msg: 'Il campo quantita deve essere un numero intero'
      },
      min: {
        args: [1],
        msg: 'Il campo quantita deve essere maggiore di 0'
      }
    }
  },
  tipo: {
    type: DataTypes.ENUM(TIPO_KIT_DESIGN.AUTOMATICO, TIPO_KIT_DESIGN.MANUALE, TIPO_KIT_DESIGN.SEMI_AUTOMATICO),
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo tipo non può essere null'
      },
      isIn: {
        args: [[TIPO_KIT_DESIGN.AUTOMATICO, TIPO_KIT_DESIGN.MANUALE, TIPO_KIT_DESIGN.SEMI_AUTOMATICO]],
        msg: 'Il campo tipo deve essere AUTOMATICO o MANUALE'
      }
    }
  },
  files: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo files non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo files deve essere un array');
        }
      }
    }
  },
  filtro_contesto: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo filtro_contesto non può essere null'
      },
      isValidArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo filtro_contesto deve essere un array');
        }
      }
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: "I tags non possono essere null"
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
  tableName: "raccoglitore_kit",
  freezeTableName: true,
  indexes: [
    {
      fields: ['tipo']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    }
  ],
  validate: {
    validazioneCoerenza() {
      // Validazione che almeno un'area sia selezionata
      if (!this.id_aree || !Array.isArray(this.id_aree) || this.id_aree.length === 0) {
        throw new Error('Deve essere selezionata almeno un\'area');
      }
      // Validazione che almeno un canale sia selezionato
      if (!this.id_canali || !Array.isArray(this.id_canali) || this.id_canali.length === 0) {
        throw new Error('Deve essere selezionato almeno un canale');
      }
      // Validazione che almeno un tipo di export sia configurato
      if (!this.tipi_di_export_in_kit || !Array.isArray(this.tipi_di_export_in_kit) || this.tipi_di_export_in_kit.length === 0) {
        throw new Error('Deve essere configurato almeno un tipo di export');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
RaccoglitoreKitDefine.addHook('beforeCreate', (raccoglitoreKit: RaccoglitoreKit) => {
  // Validazione aggiuntiva per i campi obbligatori
  if (!raccoglitoreKit.id) {
    throw new Error('Il campo id è obbligatorio');
  }

  if (!raccoglitoreKit.titolo || raccoglitoreKit.titolo.trim().length === 0) {
    throw new Error('Il campo titolo è obbligatorio e non può essere vuoto');
  }

  if (!raccoglitoreKit.id_formato) {
    throw new Error('Il campo id_formato è obbligatorio');
  }
});

// Hook per gestire errori durante l'aggiornamento
RaccoglitoreKitDefine.addHook('beforeUpdate', (raccoglitoreKit: RaccoglitoreKit) => {
  // Validazione per i campi che non possono essere vuoti
  if (raccoglitoreKit.titolo !== undefined && (!raccoglitoreKit.titolo || raccoglitoreKit.titolo.trim().length === 0)) {
    throw new Error('Il campo titolo non può essere vuoto');
  }

  if (raccoglitoreKit.id_formato !== undefined && !raccoglitoreKit.id_formato) {
    throw new Error('Il campo id_formato non può essere vuoto');
  }
});

export { RaccoglitoreKitDefine as RaccoglitoreKit };
