// server/core/models/whatsapp/gdo_whatsapp_campagne.ts

import { DataTypes, Model, Optional, fn } from 'sequelize';
import { sequelize } from '../../db/SequelizeConnector';

import type { GDOWhatsappCampagneAttributes } from '../../../../lib/types';

export type GDOWhatsappCampagneCreationAttributes = Optional<
    GDOWhatsappCampagneAttributes,
    | 'id_whatsapp_campagna'
    | 'createdat'
    | 'updatedat'
>;

class GDOWhatsappCampagneClass extends Model<
    GDOWhatsappCampagneAttributes,
    GDOWhatsappCampagneCreationAttributes
> implements GDOWhatsappCampagneAttributes {
    declare id_whatsapp_campagna: string;
    declare titolo_whatsapp_campagna: string;
    declare template_id_whatsapp_campagna: string;
    declare createdat?: Date;
    declare updatedat?: Date;
}

const GDOWhatsappCampagne = GDOWhatsappCampagneClass.init(
    {
        id_whatsapp_campagna: {
            type: DataTypes.UUID,
            defaultValue: fn('uuid_generate_v4'),
            primaryKey: true,
        },

        titolo_whatsapp_campagna: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },

        template_id_whatsapp_campagna: {
            type: DataTypes.UUID,
            allowNull: false,
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
        tableName: 'gdo_whatsapp_campagne',
        modelName: 'GDOWhatsappCampagne',
        timestamps: false,

        indexes: [
            {
                name: 'idx_wa_campagne_template',
                fields: ['template_id_whatsapp_campagna'],
                using: 'BTREE',
            },
            {
                name: 'idx_wa_campagne_createdat',
                fields: ['createdat'],
                using: 'BTREE',
            },
        ],
    }
);

export { GDOWhatsappCampagne };
