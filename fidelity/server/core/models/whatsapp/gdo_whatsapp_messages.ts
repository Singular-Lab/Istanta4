import { DataTypes, Model, Optional, fn } from 'sequelize';
import { type GDOWhatsappMessageAttributes } from '../../../../lib/types';
import { sequelize } from '../../db/SequelizeConnector';


type GDOWhatsappMessageAttributesType = Optional<GDOWhatsappMessageAttributes, 'id_gdowhatsappmessage'>;

class GDOWhatsappMessageClass extends Model<GDOWhatsappMessageAttributesType, GDOWhatsappMessageAttributes> implements GDOWhatsappMessageAttributes {
    declare id_gdowhatsappmessage?: string | undefined;
    declare id_conversation_gdowhatsappmessage: string;
    declare direction_gdowhatsappmessage: 'in' | 'out';
    declare status_gdowhatsappmessage: 'sent' | 'delivered' | 'read' | 'failed';
    declare provider_msg_id_gdowhatsappmessage?: string | undefined;
    declare from_gdowhatsappmessage?: string | undefined;
    declare to_gdowhatsappmessage?: string | undefined;
    declare type_gdowhatsappmessage: 'text' | 'template' | 'image' | 'doc';
    declare template_name_gdowhatsappmessage?: string | undefined;
    declare template_preset_name_gdowhatsappmessage?: string | undefined;
    declare msg_lang_gdowhatsappmessage?: string | undefined;
    declare msg_text_gdowhatsappmessage?: string | undefined;
    declare media_url_gdowhatsappmessage?: string | undefined;
    declare media_mimetype_gdowhatsappmessage?: string | undefined;
    declare media_sha256_gdowhatsappmessage?: string | undefined;
    declare media_filename_gdowhatsappmessage?: string | undefined;
    declare payload_json_gdowhatsappmessage: string;
    declare tokens_gdowhatsappmessage?: number | undefined;
    declare error_code_gdowhatsappmessage?: string | undefined;
    declare error_msg_gdowhatsappmessage?: string | undefined;
    declare createdat?: Date | undefined;
    declare updatedat?: Date | undefined;
}

const GDOWhatsappMessage = GDOWhatsappMessageClass.init(
    {
        id_gdowhatsappmessage: {
            type: DataTypes.UUID,
            defaultValue: fn("uuid_generate_v4"),
            primaryKey: true,
        },
        id_conversation_gdowhatsappmessage: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        direction_gdowhatsappmessage: {
            type: DataTypes.ENUM('in', 'out'),
            allowNull: false,
        },
        status_gdowhatsappmessage: {
            type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
            allowNull: false,
        },
        provider_msg_id_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        from_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        to_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        type_gdowhatsappmessage: {
            type: DataTypes.ENUM('text', 'template', 'image', 'doc'),
            allowNull: false,
        },
        template_name_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        template_preset_name_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        msg_lang_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        msg_text_gdowhatsappmessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        media_url_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        media_mimetype_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        media_sha256_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        media_filename_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        payload_json_gdowhatsappmessage: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        tokens_gdowhatsappmessage: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        error_code_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        error_msg_gdowhatsappmessage: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        createdat: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'created_at',
        },
        updatedat: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated_at',
        },
    },
    {
        sequelize,
        tableName: 'gdo_whatsapp_messages',
        timestamps: false,
        indexes: [
            {
                name: 'idx_gdo_msg_conv',
                fields: ['id_conversation_gdowhatsappmessage'],
            },
            {
                name: 'idx_gdo_msg_status',
                fields: ['status_gdowhatsappmessage'],
            },
            {
                name: 'gdo_wa_msg_provider_id_uq',
                unique: true,
                fields: ['provider_msg_id_gdowhatsappmessage'],
            },
        ],
        hooks: {
            beforeUpdate: (instance: GDOWhatsappMessageClass) => {
                instance.updatedat = new Date();
            },
        },
    }
);

export { GDOWhatsappMessage };
