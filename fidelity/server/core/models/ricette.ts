import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello Ricette per gestione ricette AI
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface RicetteAttributes {
  id: string;
  titolo: string;
  ingredienti: Array<{
    nome_prodotto: string;
    ean?: string;
    quantita_necessaria?: number;
    peso?: number;
    unita_misura_peso: string;
    costo_ingrediente_euro?: number;
    costo_per_unita_misura?: number;
    incluso_nel_volantino?: any;
  }>;
  procedimento?: string;
  tempo_in_secondi?: string;
  costo_in_euro?: string;
  tipo: string;
  stato: string;
  abbinamento_vino?: {
    vini_abbinati?: string[];
    motivazione?: string;
  };
  foto_ricetta: Array<{
    id: string;
    main: boolean;
    id_olimpo_cloud: string;
    url: string;
    meta?: any;
    prompt?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface RicetteCreationAttributes extends Optional<RicetteAttributes, "id" | "createdAt" | "updatedAt"> { }

class Ricette extends Model<RicetteAttributes, RicetteCreationAttributes> implements RicetteAttributes {
  declare id: string;
  declare titolo: string;
  declare ingredienti: Array<{
    nome_prodotto: string;
    ean?: string;
    quantita_necessaria?: number;
    peso?: number;
    unita_misura_peso: string;
    costo_ingrediente_euro?: number;
    costo_per_unita_misura?: number;
    incluso_nel_volantino?: any;
  }>;
  declare procedimento?: string;
  declare tempo_in_secondi?: string;
  declare costo_in_euro?: string;
  declare tipo: string;
  declare stato: string;
  declare abbinamento_vino?: {
    vini_abbinati?: string[];
    motivazione?: string;
  };
  declare foto_ricetta: Array<{
    id: string;
    main: boolean;
    id_olimpo_cloud: string;
    url: string;
    meta?: any;
    prompt?: string;
  }>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const RicetteDefine = sequelize.define<Ricette>("ricette", {
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
  ingredienti: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo ingredienti non può essere null'
      },
      isValidIngredienti(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo ingredienti deve essere un array');
        }
        for (const ingrediente of value) {
          if (!ingrediente || typeof ingrediente !== 'object') {
            throw new Error('Ogni ingrediente deve essere un oggetto');
          }
          if (!ingrediente.nome_prodotto) {
            throw new Error('Ogni ingrediente deve avere un nome_prodotto');
          }
          if (!ingrediente.unita_misura_peso) {
            throw new Error('Ogni ingrediente deve avere un unita_misura_peso');
          }
          if (ingrediente.quantita_necessaria !== undefined && typeof ingrediente.quantita_necessaria !== 'number') {
            throw new Error('Il campo quantita_necessaria deve essere un numero');
          }
          if (ingrediente.peso !== undefined && typeof ingrediente.peso !== 'number') {
            throw new Error('Il campo peso deve essere un numero');
          }
          if (ingrediente.costo_ingrediente_euro !== undefined && typeof ingrediente.costo_ingrediente_euro !== 'number') {
            throw new Error('Il campo costo_ingrediente_euro deve essere un numero');
          }
          if (ingrediente.costo_per_unita_misura !== undefined && typeof ingrediente.costo_per_unita_misura !== 'number') {
            throw new Error('Il campo costo_per_unita_misura deve essere un numero');
          }
        }
      }
    }
  },
  procedimento: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 10000],
        msg: 'Il campo procedimento deve essere compreso tra 0 e 10000 caratteri'
      }
    }
  },
  tempo_in_secondi: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo tempo_in_secondi deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  costo_in_euro: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo costo_in_euro deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo tipo non può essere null'
      },
      notEmpty: {
        msg: 'Il campo tipo non può essere vuoto'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo tipo deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  stato: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Il campo stato non può essere null'
      },
      notEmpty: {
        msg: 'Il campo stato non può essere vuoto'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo stato deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  abbinamento_vino: {
    type: DataTypes.JSONB,
    allowNull: true,
    validate: {
      isValidAbbinamentoVino(value: any) {
        if (value && typeof value !== 'object') {
          throw new Error('Il campo abbinamento_vino deve essere un oggetto valido');
        }
        if (value && value.vini_abbinati && !Array.isArray(value.vini_abbinati)) {
          throw new Error('Il campo vini_abbinati deve essere un array');
        }
        if (value && value.motivazione && typeof value.motivazione !== 'string') {
          throw new Error('Il campo motivazione deve essere una stringa');
        }
      }
    }
  },
  foto_ricetta: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    validate: {
      notNull: {
        msg: 'Il campo foto_ricetta non può essere null'
      },
      isValidFotoRicetta(value: any[]) {
        if (!Array.isArray(value)) {
          throw new Error('Il campo foto_ricetta deve essere un array');
        }
        for (const foto of value) {
          if (!foto || typeof foto !== 'object') {
            throw new Error('Ogni foto deve essere un oggetto');
          }
          if (!foto.id) {
            throw new Error('Ogni foto deve avere un id');
          }
          if (typeof foto.main !== 'boolean') {
            throw new Error('Il campo main deve essere un boolean');
          }
          if (!foto.id_olimpo_cloud) {
            throw new Error('Ogni foto deve avere un id_olimpo_cloud');
          }
          if (!foto.url) {
            throw new Error('Ogni foto deve avere un url');
          }
        }
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
  tableName: "ricette",
  freezeTableName: true,
  indexes: [
    {
      fields: ['titolo']
    },
    {
      fields: ['tipo']
    },
    {
      fields: ['stato']
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
      // Validazione che il titolo non sia vuoto
      if (!this.titolo || (typeof this.titolo === 'string' && this.titolo.trim().length === 0)) {
        throw new Error('Il titolo non può essere vuoto');
      }

      // Validazione che il tipo non sia vuoto
      if (!this.tipo || (typeof this.tipo === 'string' && this.tipo.trim().length === 0)) {
        throw new Error('Il tipo non può essere vuoto');
      }

      // Validazione che lo stato non sia vuoto
      if (!this.stato || (typeof this.stato === 'string' && this.stato.trim().length === 0)) {
        throw new Error('Lo stato non può essere vuoto');
      }
    }
  }
});

// Hook per gestire errori durante la creazione
RicetteDefine.addHook('beforeCreate', (ricette: Ricette) => {
  if (!ricette.id || ricette.id.trim().length === 0) {
    throw new Error('Il campo guid_id è obbligatorio e non può essere vuoto');
  }

  if (!ricette.titolo || ricette.titolo.trim().length === 0) {
    throw new Error('Il campo titolo è obbligatorio e non può essere vuoto');
  }

  if (!ricette.tipo || ricette.tipo.trim().length === 0) {
    throw new Error('Il campo tipo è obbligatorio e non può essere vuoto');
  }

  if (!ricette.stato || ricette.stato.trim().length === 0) {
    throw new Error('Il campo stato è obbligatorio e non può essere vuoto');
  }
});

// Hook per gestire errori durante l'aggiornamento
RicetteDefine.addHook('beforeUpdate', (ricette: Ricette) => {
  if (ricette.id !== undefined && (!ricette.id || ricette.id.trim().length === 0)) {
    throw new Error('Il campo guid_id non può essere vuoto');
  }

  if (ricette.titolo !== undefined && (!ricette.titolo || ricette.titolo.trim().length === 0)) {
    throw new Error('Il campo titolo non può essere vuoto');
  }

  if (ricette.tipo !== undefined && (!ricette.tipo || ricette.tipo.trim().length === 0)) {
    throw new Error('Il campo tipo non può essere vuoto');
  }

  if (ricette.stato !== undefined && (!ricette.stato || ricette.stato.trim().length === 0)) {
    throw new Error('Il campo stato non può essere vuoto');
  }
});

export { RicetteDefine as Ricette };
