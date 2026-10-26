import {
    Column,
    Model,
    Table,
    DataType,
    HasOne,
    PrimaryKey,
    ForeignKey,
  } from 'sequelize-typescript';

import { AbsolutePaths } from './absolute_path.model';

@Table({
    tableName: 'video',
    timestamps: false,
    freezeTableName: true,
})
export class Video extends Model {

    @PrimaryKey
    @Column(DataType.UUID)
    public id: string;

    @ForeignKey(() => AbsolutePaths)
    @Column(DataType.STRING)
    public id_path_video: string;

    @Column(DataType.STRING)
    public file_name: string;

    @Column(DataType.STRING)
    public md5: string;

    @Column(DataType.STRING)
    public original_name: string;

    @Column(DataType.JSON)
    public json_meta_video: string;
}

/**
 * Represents the attributes of a material.
 * 
 * @property {string} id - The unique identifier for the material.
 * @property {string} id_path_video - The identifier for the path of the material.
 * @property {string} file_name - The name of the file.
 * @property {string} md5 - The MD5 hash of the file for integrity verification.
 * @property {string} original_name - The original name of the file.
 * @property {string} json_meta_video - The metadata of the video.
 */
export type VideoAttributes = {
    id: string;
    id_path_video: string;
    file_name: string;
    md5: string;
    original_name: string;
    json_meta_video: string;
}
