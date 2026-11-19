import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Richieste di accesso SAML in attesa della risposta dell'identity provider (services/SamlService.ts).
 * Stanno nel database e non nella memoria del processo: con piu' worker la risposta dell'IdP arriva a
 * un worker qualsiasi, spesso diverso da quello che ha avviato l'accesso (spec gestione-metodi-accesso,
 * "Accesso tramite fornitore SAML"). Una riga per richiesta, tolta alla prima risposta o alla scadenza.
 */

export interface RichiestaSamlInAttesaAttributes {
  /** ID della AuthnRequest (InResponseTo nella risposta dell'IdP). */
  chiave: string;
  valore: string;
  creata_il: Date;
}

type RichiestaSamlInAttesaCreationAttributes = Optional<RichiestaSamlInAttesaAttributes, 'creata_il'>;

class RichiestaSamlInAttesa
  extends Model<RichiestaSamlInAttesaAttributes, RichiestaSamlInAttesaCreationAttributes>
  implements RichiestaSamlInAttesaAttributes {
  declare chiave: string;
  declare valore: string;
  declare creata_il: Date;
}

const RichiestaSamlInAttesaDefine = sequelize.define<RichiestaSamlInAttesa>('saml_richieste_in_attesa', {
  chiave: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
  },
  valore: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  creata_il: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'saml_richieste_in_attesa',
  freezeTableName: true,
  timestamps: false,
});

export { RichiestaSamlInAttesaDefine as RichiestaSamlInAttesa };
