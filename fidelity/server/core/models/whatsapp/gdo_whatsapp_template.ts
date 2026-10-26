import { DataTypes, Model, Optional, fn } from 'sequelize';
import { CATEGORIA_TEMPLATE_WHATSAPP, STATO_GDO_WHATSAPP_TEMPLATE } from '../../../../lib/enums';
import { GDOWhatsappTemplateAttributes, type WhatsAppTemplate } from '../../../../lib/types';
import { sequelize } from '../../db';


type GDOWhatsappTemplateAttributesType = Optional<GDOWhatsappTemplateAttributes, 'id_gdowhatsapptemplate'>;

class GDOWhatsappTemplateClass extends Model<GDOWhatsappTemplateAttributes, GDOWhatsappTemplateAttributesType> implements GDOWhatsappTemplateAttributes {
    declare id_gdowhatsapptemplate?: string | undefined;
    declare id_gdo_gdowhatsapptemplate: string;
    declare nome_template_gdowhatsapptemplate: string;
    declare lingua_template_gdowhatsapptemplate: string;
    declare stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE;
    declare categoria_template_gdowhatsapptemplate: CATEGORIA_TEMPLATE_WHATSAPP;
    declare json_meta_gdowhatsapptemplate: WhatsAppTemplate;
    declare createdat: Date | undefined;
    declare updatedat: Date | undefined;
}

const GDOWhatsappTemplate = GDOWhatsappTemplateClass.init(
    {
        id_gdowhatsapptemplate: {
            type: DataTypes.UUID,
            defaultValue: fn("uuid_generate_v4"),
            primaryKey: true,
        },
        id_gdo_gdowhatsapptemplate: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        nome_template_gdowhatsapptemplate: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        lingua_template_gdowhatsapptemplate: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        stato_meta_gdowhatsapptemplate: {
            type: DataTypes.ENUM(...Object.values(STATO_GDO_WHATSAPP_TEMPLATE)),
            allowNull: false,
        },
        json_meta_gdowhatsapptemplate: {
            type: DataTypes.JSONB,
            allowNull: false,
        },
        categoria_template_gdowhatsapptemplate: {
            type: DataTypes.ENUM(...Object.values(CATEGORIA_TEMPLATE_WHATSAPP)),
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
        sequelize: sequelize,
        tableName: 'gdo_whatsapp_template',
        timestamps: false,
        underscored: true,
    }
);

export { GDOWhatsappTemplate };
