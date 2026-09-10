import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Modello ApprofondimentoVino per gestione approfondimenti sui vini
 * Basato sulla struttura MongoDB fornita dall'utente
 */

export interface ApprofondimentoVinoAttributes {
  id: string;
  cantina: string;
  nome: string;
  codice: string;
  anno?: number;
  vino?: string;
  data_creazione?: string;
  data_pubblicazione?: string;
  provenienza?: string;
  colore?: string;
  profumo?: string;
  gusto?: string;
  tasso_alcolico?: string;
  temperatura_di_servizio?: string;
  abbinamenti?: string;
  dettagli_cantina?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ApprofondimentoVinoCreationAttributes extends Optional<ApprofondimentoVinoAttributes, "id" | "createdAt" | "updatedAt"> { }

class ApprofondimentoVino extends Model<ApprofondimentoVinoAttributes, ApprofondimentoVinoCreationAttributes> implements ApprofondimentoVinoAttributes {
  declare id: string;
  declare cantina: string;
  declare nome: string;
  declare codice: string;
  declare anno?: number;
  declare vino?: string;
  declare data_creazione?: string;
  declare data_pubblicazione?: string;
  declare provenienza?: string;
  declare colore?: string;
  declare profumo?: string;
  declare gusto?: string;
  declare tasso_alcolico?: string;
  declare temperatura_di_servizio?: string;
  declare abbinamenti?: string;
  declare dettagli_cantina?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

const ApprofondimentoVinoDefine = sequelize.define<ApprofondimentoVino>("approfondimento_vino", {
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
  cantina: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo cantina non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo cantina non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo cantina deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo nome non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo nome non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo nome deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  codice: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Il campo codice non può essere vuoto'
      },
      notNull: {
        msg: 'Il campo codice non può essere null'
      },
      len: {
        args: [1, 255],
        msg: 'Il campo codice deve essere compreso tra 1 e 255 caratteri'
      }
    }
  },
  anno: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      isInt: {
        msg: 'Il campo anno deve essere un numero intero'
      },
      min: {
        args: [1800],
        msg: 'Il campo anno deve essere maggiore di 1800'
      },
      max: {
        args: [new Date().getFullYear() + 10],
        msg: 'Il campo anno deve essere ragionevole'
      }
    }
  },
  vino: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo vino deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  data_creazione: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo data_creazione deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  data_pubblicazione: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo data_pubblicazione deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  provenienza: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo provenienza deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  colore: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo colore deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  profumo: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 5000],
        msg: 'Il campo profumo deve essere compreso tra 0 e 5000 caratteri'
      }
    }
  },
  gusto: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 5000],
        msg: 'Il campo gusto deve essere compreso tra 0 e 5000 caratteri'
      }
    }
  },
  tasso_alcolico: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo tasso_alcolico deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  temperatura_di_servizio: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Il campo temperatura_di_servizio deve essere compreso tra 0 e 255 caratteri'
      }
    }
  },
  abbinamenti: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 5000],
        msg: 'Il campo abbinamenti deve essere compreso tra 0 e 5000 caratteri'
      }
    }
  },
  dettagli_cantina: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 5000],
        msg: 'Il campo dettagli_cantina deve essere compreso tra 0 e 5000 caratteri'
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
  tableName: "approfondimento_vino",
  freezeTableName: true,
  indexes: [
    {
      fields: ['cantina']
    },
    {
      fields: ['nome']
    },
    {
      fields: ['codice']
    },
    {
      fields: ['anno']
    },
    {
      fields: ['vino']
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
      // Validazione che la cantina non sia vuota
      if (!this.cantina || (typeof this.cantina === 'string' && this.cantina.trim().length === 0)) {
        throw new Error('La cantina non può essere vuota');
      }

      // Validazione che il nome non sia vuoto
      if (!this.nome || (typeof this.nome === 'string' && this.nome.trim().length === 0)) {
        throw new Error('Il nome non può essere vuoto');
      }

      // Validazione che il codice non sia vuoto
      if (!this.codice || (typeof this.codice === 'string' && this.codice.trim().length === 0)) {
        throw new Error('Il codice non può essere vuoto');
      }

      // Validazione che l'anno sia ragionevole se presente
      if (this.anno !== undefined && this.anno !== null) {
        if (typeof this.anno === 'number' && (this.anno < 1800 || this.anno > new Date().getFullYear() + 10)) {
          throw new Error('L\'anno deve essere ragionevole');
        }
      }
    }
  }
});

// Hook per gestire errori durante la creazione
ApprofondimentoVinoDefine.addHook('beforeCreate', (approfondimentoVino: ApprofondimentoVino) => {
  if (!approfondimentoVino.cantina || approfondimentoVino.cantina.trim().length === 0) {
    throw new Error('Il campo cantina è obbligatorio e non può essere vuoto');
  }

  if (!approfondimentoVino.nome || approfondimentoVino.nome.trim().length === 0) {
    throw new Error('Il campo nome è obbligatorio e non può essere vuoto');
  }

  if (!approfondimentoVino.codice || approfondimentoVino.codice.trim().length === 0) {
    throw new Error('Il campo codice è obbligatorio e non può essere vuoto');
  }
});

// Hook per gestire errori durante l'aggiornamento
ApprofondimentoVinoDefine.addHook('beforeUpdate', (approfondimentoVino: ApprofondimentoVino) => {
  if (approfondimentoVino.cantina !== undefined && (!approfondimentoVino.cantina || approfondimentoVino.cantina.trim().length === 0)) {
    throw new Error('Il campo cantina non può essere vuoto');
  }

  if (approfondimentoVino.nome !== undefined && (!approfondimentoVino.nome || approfondimentoVino.nome.trim().length === 0)) {
    throw new Error('Il campo nome non può essere vuoto');
  }

  if (approfondimentoVino.codice !== undefined && (!approfondimentoVino.codice || approfondimentoVino.codice.trim().length === 0)) {
    throw new Error('Il campo codice non può essere vuoto');
  }
});

export { ApprofondimentoVinoDefine as ApprofondimentoVino };
