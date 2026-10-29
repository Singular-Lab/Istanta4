//NOTE questo modello serve per gestire dinamicamente i dati del template whatsapp in base ai preset definiti dall'utente
import { DataTypes, Model, Optional, fn } from 'sequelize';
import { type GDOWhatsappPresetAttributes } from '../../../../lib/types';
import { sequelize } from '../../db/SequelizeConnector';


type GDOWhatsappPresetAttributesType = Optional<GDOWhatsappPresetAttributes, 'id_gdowhatsappreset'>;

//class GDOWhatsappNumbersClass extends Model<GDOWhatsappNumbersAttributes, GDOWhatsappNumbersAttributesType> implements GDOWhatsappNumbersAttributes {

class GDOWhatsappPreset extends Model<GDOWhatsappPresetAttributesType, GDOWhatsappPresetAttributes> implements GDOWhatsappPresetAttributes {
    declare id_gdowhatsappreset?: string | undefined;
    declare id_template_gdowhatsappreset: string;
    declare nome_preset_gdowhatsappreset: string;
    declare is_default_gdowhatsappreset: boolean;
    declare hash_gdowhatsappreset: string;
    declare json_meta_gdowhatsappreset: any;
    declare createdat?: Date | undefined;
    declare updatedat?: Date | undefined;

    // La risposta di get_all_presets_template_whatsapp aveva anche createdAt/updatedAt, le colonne
    // doppie che la migrazione 0013 ha tolto: restano come copia di createdat/updatedat, cosi' la
    // forma della risposta non cambia. Il client legge createdat/updatedat (lib/types).
    toJSON<T extends GDOWhatsappPresetAttributesType>(): T {
        const valori = super.toJSON<T>();
        return { ...valori, createdAt: valori.createdat, updatedAt: valori.updatedat };
    }
}

GDOWhatsappPreset.init(
    {
        // Define your model attributes here, e.g.:
        id_gdowhatsappreset: {
            type: DataTypes.UUID,
            defaultValue: fn("uuid_generate_v4"),
            primaryKey: true,
        },
        id_template_gdowhatsappreset: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        nome_preset_gdowhatsappreset: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        is_default_gdowhatsappreset: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        json_meta_gdowhatsappreset: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        hash_gdowhatsappreset: {
            type: DataTypes.STRING,
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
        modelName: 'GDOWhatsappPreset',
        tableName: 'gdo_whatsapp_presets',
        // Un solo paio di date, createdat/updatedat: Sequelize le valorizza alla creazione e
        // aggiorna updatedat a ogni modifica. Senza questi nomi aggiungeva anche createdAt/updatedAt
        // (tolte dalla migrazione 0013) e updatedat restava la data di creazione.
        timestamps: true,
        createdAt: 'createdat',
        updatedAt: 'updatedat',
    }
);

export { GDOWhatsappPreset };
