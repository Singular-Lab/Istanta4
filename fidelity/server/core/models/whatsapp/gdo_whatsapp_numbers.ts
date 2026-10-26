import { DataTypes, Model, Optional, fn } from 'sequelize';
import { PROVIDER_WHATSAPP, STATO_GDO_WHATSAPP_NUMBER } from '../../../../lib/enums';
import { GDOWhatsappNumbersAttributes } from '../../../../lib/types';
import { sequelize } from '../../db/SequelizeConnector';

// -- Table: public.wa_numbers

// -- DROP TABLE IF EXISTS public.wa_numbers;

// CREATE TABLE IF NOT EXISTS public.wa_numbers
// (
//     id integer NOT NULL DEFAULT nextval('wa_numbers_id_seq'::regclass),
//     id_cliente integer NOT NULL,
//     phone_number_id character varying(64) COLLATE pg_catalog."default" NOT NULL,
//     wa_business_account_id character varying(64) COLLATE pg_catalog."default" NOT NULL,
//     display_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
//     business_phone_e164 character varying(32) COLLATE pg_catalog."default",
//     status wa_number_status NOT NULL DEFAULT 'pending'::wa_number_status,
//     provider wa_provider NOT NULL DEFAULT 'meta'::wa_provider,
//     created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
//     updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
//     CONSTRAINT wa_numbers_pkey PRIMARY KEY (id),
//     CONSTRAINT wa_numbers_id_cliente_key UNIQUE (id_cliente),
//     CONSTRAINT wa_numbers_phone_number_id_key UNIQUE (phone_number_id),
//     CONSTRAINT wa_numbers_id_cliente_fkey FOREIGN KEY (id_cliente)
//         REFERENCES public.clienti (id) MATCH SIMPLE
//         ON UPDATE NO ACTION
//         ON DELETE CASCADE
// )

// TABLESPACE pg_default;

// ALTER TABLE IF EXISTS public.wa_numbers
//     OWNER to postgres;
// -- Index: idx_wa_numbers_waba

// -- DROP INDEX IF EXISTS public.idx_wa_numbers_waba;

// CREATE INDEX IF NOT EXISTS idx_wa_numbers_waba
//     ON public.wa_numbers USING btree
//     (wa_business_account_id COLLATE pg_catalog."default" ASC NULLS LAST)
//     WITH (fillfactor=100, deduplicate_items=True)
//     TABLESPACE pg_default;

// -- Trigger: update_wa_numbers_updated_at

// -- DROP TRIGGER IF EXISTS update_wa_numbers_updated_at ON public.wa_numbers;

// CREATE OR REPLACE TRIGGER update_wa_numbers_updated_at
//     BEFORE UPDATE
//     ON public.wa_numbers
//     FOR EACH ROW
//     EXECUTE FUNCTION public.update_updated_at_column();
type GDOWhatsappNumbersAttributesType = Optional<GDOWhatsappNumbersAttributes, 'id_gdowhatsappnumbers'>;


class GDOWhatsappNumbersClass extends Model<GDOWhatsappNumbersAttributes, GDOWhatsappNumbersAttributesType> implements GDOWhatsappNumbersAttributes {
    declare id_gdowhatsappnumbers?: string | undefined;
    declare id_gdo_gdowhatsappnumbers: string;
    declare id_numero_whatsapp_gdowhatsappnumbers: string;
    declare display_name_gdowhatsappnumbers: string;
    declare stato_gdowhatsappnumbers: STATO_GDO_WHATSAPP_NUMBER;
    declare provider_gdowhatsappnumbers: PROVIDER_WHATSAPP;
    declare whatsapp_business_account_id_gdowhatsappnumbers: string;
    declare access_token_gdowhatsappnumbers: string | undefined;
    declare verify_token_gdowhatsappnumbers: string | undefined;
    declare createdat: Date | undefined;
    declare updatedat: Date | undefined;

}

const GDOWhatsappNumbers = GDOWhatsappNumbersClass.init(
    {
        id_gdowhatsappnumbers: {
            type: DataTypes.UUID,
            defaultValue: fn("uuid_generate_v4"),
            primaryKey: true,
        },
        id_gdo_gdowhatsappnumbers: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_numero_whatsapp_gdowhatsappnumbers: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        display_name_gdowhatsappnumbers: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        stato_gdowhatsappnumbers: {
            type: DataTypes.ENUM(...Object.values(STATO_GDO_WHATSAPP_NUMBER)),
            allowNull: false,
        },
        whatsapp_business_account_id_gdowhatsappnumbers: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        provider_gdowhatsappnumbers: {
            type: DataTypes.ENUM(...Object.values(PROVIDER_WHATSAPP)),
            allowNull: false,
        },
        access_token_gdowhatsappnumbers: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        verify_token_gdowhatsappnumbers: {
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
        sequelize: sequelize,
        tableName: 'gdo_whatsapp_numbers',
        timestamps: false,
        freezeTableName: true,
        indexes: [
            { name: 'gdo_wa_num_phone_num_uq', unique: true, fields: ['id_numero_whatsapp_gdowhatsappnumbers'] },
            { name: 'gdo_wa_num_waba_id_uq', unique: true, fields: ['whatsapp_business_account_id_gdowhatsappnumbers'] },
            { name: 'gdo_wa_num_access_token_uq', unique: true, fields: ['access_token_gdowhatsappnumbers'] },
            { name: 'gdo_wa_num_verify_token_uq', unique: true, fields: ['verify_token_gdowhatsappnumbers'] },
        ],
    }
);

export { GDOWhatsappNumbers };
