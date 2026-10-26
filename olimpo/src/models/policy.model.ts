import {
    Column,
    Model,
    Table,
    DataType,
    PrimaryKey,
  } from 'sequelize-typescript';


@Table({
    tableName: 'policy',
    timestamps: false,
    freezeTableName: true,
})
export class Policy extends Model {

    @PrimaryKey
    @Column(DataType.UUID)
    public id: string;

    @Column(DataType.JSON)
    public policy: IPolicy;

    @Column(DataType.STRING)
    public nome: string;
}

/**
 * Represents the attributes of a material.
 * 
 * @property {string} id - The unique identifier for the material.
 * @property {IPolicy} policy - The identifier for the path of the material.
 */
export type PolicyAttributers = {
    id: string;
    policy : IPolicy;
}

export type IPolicy = {
    origin: string,
    tipo_utente: string,
    id_utente?: string,
    autorizzato: boolean,
}[]
