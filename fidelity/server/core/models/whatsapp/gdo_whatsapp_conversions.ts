//NOTE questo modello serve per gestire dinamicamente i dati del template whatsapp in base ai preset definiti dall'utente
import { DataTypes, Model, Optional, fn } from 'sequelize';
import { type GDOWhatsappConversationAttributes } from '../../../../lib/types';
import { sequelize } from '../../db/SequelizeConnector';

type GDOWhatsappConversationAttributesType = Optional<GDOWhatsappConversationAttributes, 'id_gdowhatsappconversation'>;


class GDOWhatsappConversationClass extends Model<GDOWhatsappConversationAttributesType, GDOWhatsappConversationAttributes> implements GDOWhatsappConversationAttributes {
    declare id_gdowhatsappconversation?: string;
    declare id_gdo_gdowhatsappconversation: string;
    declare id_utente_gdowhatsappconversation: string;
    declare finestra_aperta_gdowhatsappconversation: Date;
    declare finestra_scadenza_gdowhatsappconversation: Date;
    declare last_direction_gdowhatsappconversation: 'in' | 'out';
    declare is_open_gdowhatsappconversation: boolean;
    declare createdat?: Date | undefined;
    declare updatedat?: Date | undefined;

}

const GDOWhatsappConversation = GDOWhatsappConversationClass.init(
    {
        id_gdowhatsappconversation: {
            type: DataTypes.UUID,
            defaultValue: fn("uuid_generate_v4"),
            primaryKey: true,
        },
        id_gdo_gdowhatsappconversation: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_utente_gdowhatsappconversation: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        finestra_aperta_gdowhatsappconversation: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        finestra_scadenza_gdowhatsappconversation: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        last_direction_gdowhatsappconversation: {
            type: DataTypes.ENUM('in', 'out'),
            allowNull: false,
        },
        is_open_gdowhatsappconversation: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        createdat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
        },
        updatedat: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: fn('NOW'),
        },
    },
    {
        sequelize,
        tableName: 'gdo_whatsapp_conversations',
        modelName: 'GDOWhatsappConversation',
        timestamps: false,
        indexes: [
            {
                name: 'idx_wa_conv_scoping',
                fields: ['id_gdo_gdowhatsappconversation', 'id_utente_gdowhatsappconversation', 'is_open_gdowhatsappconversation'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_conv_updated',
                fields: ['updatedat'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_conv_utente',
                fields: ['id_utente_gdowhatsappconversation'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_conv_window',
                fields: ['finestra_scadenza_gdowhatsappconversation'],
                using: 'BTREE',
            },
        ],
    }
);

export { GDOWhatsappConversation };
