import { DataTypes, Model, Optional } from 'sequelize';
import { CATEGORIA_ATTIVITA, PRIORITA_ATTIVITA, TIPO_ATTIVITA } from '../../../lib/enums';
import { AttivitaAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Mapping automatico da TIPO_ATTIVITA a CATEGORIA_ATTIVITA
 */
export const TIPO_TO_CATEGORIA: Record<TIPO_ATTIVITA, CATEGORIA_ATTIVITA> = {
  [TIPO_ATTIVITA.CREAZIONE_UTENTE]: CATEGORIA_ATTIVITA.ACCOUNT,
  [TIPO_ATTIVITA.ELIMINAZIONE_UTENTE]: CATEGORIA_ATTIVITA.ACCOUNT,
  [TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_MANUALE]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.UPLOAD_FILE_MANUALE]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.MODIFICA_WORKSPACE_WEBPLIANT]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.CREAZIONE_DESIGN_KIT]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.IMPORT_TRACCIATO]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE]: CATEGORIA_ATTIVITA.PRODUZIONE,
  [TIPO_ATTIVITA.PUBBLICAZIONE_WEBPLIANT]: CATEGORIA_ATTIVITA.PUBBLICAZIONE,
  [TIPO_ATTIVITA.RICHIESTA_WEBPLIANT]: CATEGORIA_ATTIVITA.PUBBLICAZIONE,
  [TIPO_ATTIVITA.CREAZIONE_ORDINE_DI_STAMPA]: CATEGORIA_ATTIVITA.STAMPA,
  [TIPO_ATTIVITA.INVIO_FILES_FTP]: CATEGORIA_ATTIVITA.STAMPA,
  [TIPO_ATTIVITA.INVIO_FILE_CORREGGO]: CATEGORIA_ATTIVITA.INTEGRAZIONI,
  [TIPO_ATTIVITA.PUBBLICAZIONE_FILE_CORREGGO]: CATEGORIA_ATTIVITA.INTEGRAZIONI,
};

/**
 * Mapping automatico da TIPO_ATTIVITA a PRIORITA_ATTIVITA
 */
export const TIPO_TO_PRIORITA: Record<TIPO_ATTIVITA, PRIORITA_ATTIVITA> = {
  [TIPO_ATTIVITA.CREAZIONE_UTENTE]: PRIORITA_ATTIVITA.BASSA,
  [TIPO_ATTIVITA.ELIMINAZIONE_UTENTE]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_MANUALE]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.UPLOAD_FILE_MANUALE]: PRIORITA_ATTIVITA.BASSA,
  [TIPO_ATTIVITA.MODIFICA_WORKSPACE_WEBPLIANT]: PRIORITA_ATTIVITA.BASSA,
  [TIPO_ATTIVITA.CREAZIONE_DESIGN_KIT]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.IMPORT_TRACCIATO]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.PUBBLICAZIONE_WEBPLIANT]: PRIORITA_ATTIVITA.ALTA,
  [TIPO_ATTIVITA.RICHIESTA_WEBPLIANT]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.CREAZIONE_ORDINE_DI_STAMPA]: PRIORITA_ATTIVITA.ALTA,
  [TIPO_ATTIVITA.INVIO_FILES_FTP]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.INVIO_FILE_CORREGGO]: PRIORITA_ATTIVITA.MEDIA,
  [TIPO_ATTIVITA.PUBBLICAZIONE_FILE_CORREGGO]: PRIORITA_ATTIVITA.MEDIA,
};

/**
 * Calcola la data di scadenza basata sulla priorità
 */
export function calcolaExpiresAt(priorita: PRIORITA_ATTIVITA): Date {
  const now = new Date();
  switch (priorita) {
    case PRIORITA_ATTIVITA.ALTA:
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 giorni
    case PRIORITA_ATTIVITA.MEDIA:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 giorni
    case PRIORITA_ATTIVITA.BASSA:
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 giorni
  }
}

type AttivitaCreationAttributes = Optional<AttivitaAttributes, 'id_attivita'>;


class AttivitaModel extends Model<AttivitaAttributes, AttivitaCreationAttributes> implements AttivitaAttributes {
  declare id_attivita: string;
  declare idutente_attivita: string | null;
  declare tipo_attivita: TIPO_ATTIVITA;
  declare meta_attivita: any;
  declare categoria_attivita?: CATEGORIA_ATTIVITA;
  declare priorita_attivita?: PRIORITA_ATTIVITA;
  declare expires_at?: Date;
  declare createdat?: Date;
  declare updatedat?: Date;
}


const Attivita = sequelize.define<AttivitaModel>("attivita", {
  id_attivita: {
    type: DataTypes.UUID,
    defaultValue: sequelize.fn("uuid_generate_v4"),
    primaryKey: true,
  },
  idutente_attivita: {
    type: DataTypes.UUID,
    allowNull: true
  },
  tipo_attivita: {
    type: DataTypes.ENUM(...Object.values(TIPO_ATTIVITA))
  },
  meta_attivita: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  categoria_attivita: {
    type: DataTypes.ENUM(...Object.values(CATEGORIA_ATTIVITA)),
    allowNull: true
  },
  priorita_attivita: {
    type: DataTypes.ENUM(...Object.values(PRIORITA_ATTIVITA)),
    allowNull: true,
    defaultValue: PRIORITA_ATTIVITA.MEDIA
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdat: {
    type: DataTypes.DATE,
    allowNull: true
  },
  updatedat: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: "attivita",
  freezeTableName: true,
  hooks: {
    beforeCreate: (attivita: AttivitaModel) => {
      // Auto-assegna categoria e priorità se non specificate
      if (!attivita.categoria_attivita && attivita.tipo_attivita) {
        attivita.categoria_attivita = TIPO_TO_CATEGORIA[attivita.tipo_attivita];
      }
      if (!attivita.priorita_attivita && attivita.tipo_attivita) {
        attivita.priorita_attivita = TIPO_TO_PRIORITA[attivita.tipo_attivita];
      }
      // Calcola expires_at basata sulla priorità
      if (!attivita.expires_at && attivita.priorita_attivita) {
        attivita.expires_at = calcolaExpiresAt(attivita.priorita_attivita);
      }
    }
  }
});



export { Attivita };
