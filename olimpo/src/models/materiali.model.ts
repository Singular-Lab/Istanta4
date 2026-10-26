import {
    Column,
    DataType,
    ForeignKey,
    Model,
    PrimaryKey,
    Table
} from 'sequelize-typescript';

import { AbsolutePaths } from './absolute_path.model';

@Table({
    tableName: 'materiali',
    timestamps: false,
    freezeTableName: true,
})
export class Materiali extends Model {

    @PrimaryKey
    @Column(DataType.UUID)
    public id: string;

    @ForeignKey(() => AbsolutePaths)
    @Column(DataType.STRING)
    public id_path_materiali: string;

    @Column(DataType.STRING)
    public file_name: string;

    @Column(DataType.STRING)
    public md5: string;

    @Column(DataType.STRING)
    public original_name: string;

    @Column(DataType.SMALLINT)
    public pagine: number;

    @Column(DataType.JSONB)
    public json_meta: any;
}

/**
 * Represents the attributes of a material.
 *
 * @property {string} id - The unique identifier for the material.
 * @property {string} id_path_materiali - The identifier for the path of the material.
 * @property {string} file_name - The name of the file.
 * @property {string} md5 - The MD5 hash of the file for integrity verification.
 * @property {string} original_name - The original name of the file.
 * @property {any} json_meta - The metadata of the material.
 * @property {string} pagine - The pages associated with the material.
 */
export type MaterialiAttributes = {
    id: string;
    id_path_materiali: string;
    file_name: string;
    md5: string;
    original_name: string;
    json_meta: any;
    pagine: string;
}
