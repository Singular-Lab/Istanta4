import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../db/SequelizeConnector";
import { FilterCondition } from "../filter_template";

/* ======================================================
 * TYPES
 * ====================================================== */

export type DisplayContextEndpointType = "files";
export type DisplayContextRenderType = "carousel" | "grid";

/* ======================================================
 * ATTRIBUTES
 * ====================================================== */

export interface DisplayContextPuntoVenditaAttributes {
    id_display_context: string;

    nome_display_context: string;
    descrizione_display_context?: string;

    /** Filtri in formato FilterCondition[][] (OR tra gruppi, AND nel gruppo) */
    filters_display_context: FilterCondition[][];

    endpoint_type_display_context: DisplayContextEndpointType;

    /** Opzioni di visualizzazione */
    auto_scroll_display_context: boolean;
    scroll_speed_display_context: number;
    show_indicators_display_context: boolean;
    show_nav_buttons_display_context: boolean;
    render_type_display_context?: DisplayContextRenderType;
    meta_options_display_context: Record<string, unknown>;

    /** Foreign keys */
    id_gdo_display_context: string;
    id_puntivendita_display_context?: string;

    is_active_display_context: boolean;

    createdat?: Date;
    updatedat?: Date;
}

type DisplayContextPuntoVenditaCreationAttributes = Optional<
    DisplayContextPuntoVenditaAttributes,
    | "id_display_context"
    | "descrizione_display_context"
    | "auto_scroll_display_context"
    | "scroll_speed_display_context"
    | "show_indicators_display_context"
    | "show_nav_buttons_display_context"
    | "render_type_display_context"
    | "meta_options_display_context"
    | "id_puntivendita_display_context"
    | "is_active_display_context"
    | "createdat"
    | "updatedat"
>;

/* ======================================================
 * MODEL
 * ====================================================== */

class DisplayContextPuntoVendita
    extends Model<
        DisplayContextPuntoVenditaAttributes,
        DisplayContextPuntoVenditaCreationAttributes
    >
    implements DisplayContextPuntoVenditaAttributes {
    declare id_display_context: string;

    declare nome_display_context: string;
    declare descrizione_display_context?: string;

    declare filters_display_context: FilterCondition[][];

    declare endpoint_type_display_context: DisplayContextEndpointType;

    declare auto_scroll_display_context: boolean;
    declare scroll_speed_display_context: number;
    declare show_indicators_display_context: boolean;
    declare show_nav_buttons_display_context: boolean;
    declare render_type_display_context?: DisplayContextRenderType;
    declare meta_options_display_context: Record<string, unknown>;

    declare id_gdo_display_context: string;
    declare id_puntivendita_display_context?: string;

    declare is_active_display_context: boolean;

    declare createdat?: Date;
    declare updatedat?: Date;
}

/* ======================================================
 * INIT
 * ====================================================== */

DisplayContextPuntoVendita.init(
    {
        id_display_context: {
            type: DataTypes.UUID,
            defaultValue: sequelize.fn("uuid_generate_v4"),
            primaryKey: true,
            field: "id_display_context",
        },

        nome_display_context: {
            type: DataTypes.STRING(150),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [2, 150],
            },
            field: "nome_display_context",
        },

        descrizione_display_context: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: "descrizione_display_context",
        },

        filters_display_context: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            field: "filters_display_context",
        },

        endpoint_type_display_context: {
            type: DataTypes.ENUM("files"),
            allowNull: false,
            field: "endpoint_type_display_context",
        },

        auto_scroll_display_context: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: "auto_scroll_display_context",
        },

        scroll_speed_display_context: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5000,
            validate: {
                min: 1000,
                max: 60000,
            },
            field: "scroll_speed_display_context",
        },

        show_indicators_display_context: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: "show_indicators_display_context",
        },

        show_nav_buttons_display_context: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: "show_nav_buttons_display_context",
        },

        render_type_display_context: {
            type: DataTypes.ENUM("carousel", "grid"),
            allowNull: true,
            field: "render_type_display_context",
        },

        meta_options_display_context: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            field: "meta_options_display_context",
        },

        id_gdo_display_context: {
            type: DataTypes.UUID,
            allowNull: false,
            field: "id_gdo_display_context",
            references: {
                model: "gdo",
                key: "id_gdo",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
        },

        id_puntivendita_display_context: {
            type: DataTypes.UUID,
            allowNull: true,
            field: "id_puntivendita_display_context",
            references: {
                model: "punti_vendita",
                key: "id_puntivendita",
            },
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
        },

        is_active_display_context: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: "is_active_display_context",
        },
    },
    {
        sequelize,
        tableName: "display_context_punto_vendita",
        timestamps: true,
        createdAt: "createdat",
        updatedAt: "updatedat",
        indexes: [
            {
                fields: ["id_gdo_display_context"],
            },
            {
                fields: ["id_puntivendita_display_context"],
            },
            {
                fields: ["is_active_display_context"],
            },
            {
                fields: ["endpoint_type_display_context"],
            },
            {
                fields: ["id_gdo_display_context", "is_active_display_context"],
            },
        ],
        hooks: {
            beforeCreate: (ctx: DisplayContextPuntoVendita) => {
                if (ctx.nome_display_context) {
                    ctx.nome_display_context = ctx.nome_display_context.trim();
                }
                if (ctx.descrizione_display_context) {
                    ctx.descrizione_display_context = ctx.descrizione_display_context.trim();
                }
            },
            beforeUpdate: (ctx: DisplayContextPuntoVendita) => {
                if (ctx.nome_display_context) {
                    ctx.nome_display_context = ctx.nome_display_context.trim();
                }
                if (ctx.descrizione_display_context) {
                    ctx.descrizione_display_context = ctx.descrizione_display_context.trim();
                }
            },
        },
    }
);

export { DisplayContextPuntoVendita };
