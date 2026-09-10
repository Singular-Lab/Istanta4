import { ABSOLUTE_PATH_TYPE } from '@enums/enums';
import { Colorize } from '@lib/colorize';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as fs from 'fs';
import * as path from 'path';
import { validate as isUUID } from 'uuid';
import { AbsolutePaths } from './models/absolute_path.model';
import { Foto, FotoAttributes } from './models/foto.model';
import { Video } from './models/video.model';
// import { Formati } from './models/formati.model';
// di al compilatore di ignorare l'errore di importazione
// @ts-ignore

@Injectable()
export class OlimpoService {
  private PATH_WEB_ASSOLUTO: string;
  private PATH_ARCHIVIO_ASSOLUTO: string;
  private PATH_VIDEO_ASSOLUTO: string;

  constructor(
    @InjectModel(Foto) private readonly fotoModel: typeof Foto,
    @InjectModel(Video) private readonly videoModel: typeof Video,
    @InjectModel(AbsolutePaths)
    private readonly absolutePathsModel: typeof AbsolutePaths,
    // @InjectModel(Formati) private readonly formatiModel: typeof Formati,
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.PATH_WEB_ASSOLUTO = (await this.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB)).path;
    this.PATH_ARCHIVIO_ASSOLUTO = (await this.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO)).path;
    this.PATH_VIDEO_ASSOLUTO = (await this.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.VIDEO)).path;

  }


  async creaFotoRecord(foto: Foto): Promise<Foto> {
    try {
      await this.fotoModel.sync({ force: false });
      return await this.fotoModel.create(foto.toJSON());
    } catch (error) {
      console.error(error);
    }
  }

  async checkFileExistFromMD5(md5: string): Promise<Foto> {
    try {
      await this.fotoModel.sync({ force: false });
      const existFileFromMD5 = await this.fotoModel.findOne({ where: { md5 } });
      if (!existFileFromMD5) {
        return null;
      }
      return existFileFromMD5;
    } catch (error) {
      console.error(error);
    }
  }

  // async rimuoviSfondoBianco(input: Uint8Array, threshold: number): Promise<Uint8Array> {
  //   return  wasmModule.remove_white_bg_wasm(input, threshold);
  // }


  async getAbsoluteFilePathFromId(id: string): Promise<string> {
    try {
      await this.absolutePathsModel.sync({ force: false });
      const absolutePath = await this.absolutePathsModel.findOne({
        where: { id: id },
      });
      if (!absolutePath) {
        throw new HttpException(
          `Absolute path for id ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      return absolutePath.path;
    } catch (error) {
      console.error(error);
    }
  }
  async getAbsolutePathFromType(type: string): Promise<AbsolutePaths> {
    try {
      await this.absolutePathsModel.sync({ force: false });
      const absolutePath = await this.absolutePathsModel.findOne({
        where: { tipo: type, active: true },
      });
      if (!absolutePath) {
        throw new HttpException(
          `Absolute path for type ${type} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      return absolutePath;
    } catch (error) {
      console.error(error);
    }
  }
  async getPathFotoArchivioFromID(id: string): Promise<string> {
    try {
      await this.fotoModel.sync({ force: false });
      const foto = await this.fotoModel.findOne({ where: { id: id }, plain: true });
      if (!foto) {
        throw new HttpException(
          `Foto with id ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      const pathAssoluto = await this.getAbsoluteFilePathFromId(
        foto.id_path_archivio,
      );
      if (!pathAssoluto) {
        throw new HttpException(
          `Absolute path for id ${foto.id_path_archivio} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      const pathCompleto = path.join(pathAssoluto, foto.file_name);
      return pathCompleto;
    } catch (error) {
      console.error(error);
      throw new HttpException(
        `Error getting path for id ${id}`,
        HttpStatus.INTERNAL_SERVER_ERROR, {
        cause: error
      });
    }
  }

  async getPathVideoFromID(id: string): Promise<string> {
    try {
      await this.videoModel.sync({ force: false });
      const video = await this.videoModel.findOne({ where: { id: id } });
      if (!video) {
        throw new HttpException(
          `Video with id ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      const pathAssoluto = this.PATH_VIDEO_ASSOLUTO;
      if (!pathAssoluto) {
        throw new HttpException(
          `Absolute path for id ${video.id_path_video} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      const pathCompleto = path.join(pathAssoluto, video.file_name);
      return pathCompleto;
    } catch (error) {
      console.error(error);
      throw new HttpException(
        `Error getting path for id ${id}`,
        HttpStatus.INTERNAL_SERVER_ERROR, {
        cause: error
      });
    }
  }

  async getPathFotoWebFromID(id: string, perfomante?: boolean): Promise<string> {
    try {
      await this.fotoModel.sync({ force: false });
      const foto = await this.fotoModel.findOne({ where: { id: id } });
      if (!foto) {
        throw new HttpException(
          `Foto with id ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      const pathAssoluto = await this.getAbsoluteFilePathFromId(
        foto.id_path_web,
      );
      // const pathAssoluto = this.PATH_WEB_ASSOLUTO;
      if (!pathAssoluto) {
        throw new HttpException(
          `Absolute path for id ${foto.id_path_web} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      if (perfomante) {
        return path.join(pathAssoluto, foto.file_name_web_performante);
      } else {
        return path.join(pathAssoluto, foto.file_name_web);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }


  async getPathFotoWebFromFilename(fileName: string): Promise<string> {
    try {
      // await this.fotoModel.sync({ force: false });
      // const foto = await this.fotoModel.findOne({ where: { id: id } });
      // if (!foto) {
      //   throw new HttpException(
      //     `Foto with id ${id} not found`,
      //     HttpStatus.NOT_FOUND,
      //   );
      // }
      // const pathAssoluto = await this.getAbsoluteFilePathFromId(
      //   foto.id_path_web,
      // );
      const pathAssoluto = this.PATH_WEB_ASSOLUTO;
      if (!pathAssoluto) {
        throw new HttpException(
          `Absolute path for id not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      return path.join(pathAssoluto, fileName);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async provaArray(): Promise<FileDataINDD[]> {
    try {
      const resultQuery = await this.fotoModel.findAll();
      const fileData: FileDataINDD[] = [];

      for (const foto of resultQuery) {
        const pathArchivio = await this.getPathFotoArchivioFromID(foto.id);
        const size = fs.readFileSync(pathArchivio).byteLength;
        fileData.push({
          id: foto.id,
          filename: foto.file_name,
          size: size,
          md5: foto.md5,
        });
      }
      return fileData;
    } catch (error) {
      console.error(error);
      throw error; // Rilancia l'errore per una migliore gestione degli errori
    }
  }
  async getInfoFotoEPathFromId(idFotoRecord: string) {
    try {
      // Verifica se l'ID è un UUID valido
      if (!isUUID(idFotoRecord)) {
        console.log(Colorize.bgRed(`ID: ${idFotoRecord}`));
        throw new HttpException('Invalid UUID format', HttpStatus.BAD_REQUEST);
      }
      else {
        console.log(Colorize.bgCyan(`ID: ${idFotoRecord}`));
      }

      await this.fotoModel.sync();
      const resultIntoFotoEPathFromId = await this.fotoModel.findByPk(idFotoRecord, { plain: true });
      if (resultIntoFotoEPathFromId != null) {
        const pathAssoluto = await this.getPathFotoArchivioFromID(resultIntoFotoEPathFromId.id);
        console.warn({
          path_completo: path.join(pathAssoluto),
          hash: resultIntoFotoEPathFromId.md5,
        });
        return {
          path_completo: path.join(pathAssoluto),
          hash: resultIntoFotoEPathFromId.md5,
        };
      } else {
        throw new HttpException('Nessuna foto corrisponde a questo id', HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async updateFotoRecord(foto: Foto | FotoAttributes): Promise<boolean> {
    try {
      await this.fotoModel.sync({ force: false });

      const updateData = foto instanceof Foto ? foto.toJSON() : foto;

      // Verifica che l'ID sia valido
      if (!updateData.id) {
        console.error(Colorize.bgRed('ID mancante per aggiornamento foto'));
        return false;
      }

      // Verifica che il record esista prima dell'aggiornamento
      const existingRecord = await this.fotoModel.findByPk(updateData.id, { plain: true });
      if (!existingRecord) {
        console.error(Colorize.bgYellow(`Record non trovato per ID: ${updateData.id}`));
        return false;
      }

      // Esegui l'aggiornamento
      const result = await this.fotoModel.update(updateData, {
        where: { id: updateData.id },
        returning: true // Restituisce i record aggiornati (supportato da PostgreSQL)
      });
      this.fotoModel.sync({ force: false });
      const updatedCount = result[0];

      if (updatedCount === 0) {
        console.error(Colorize.bgRed(`Nessun record aggiornato per ID: ${updateData.id}`));
        return false;
      }

      console.log(Colorize.bgGreen(`Aggiornati ${updatedCount} record per ID: ${updateData.id}`));
      return true;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante updateFotoRecord:'), error);
      throw error; // Rilancia l'errore per gestirlo nel chiamante
    }
  }
  async getFotoFromId(id: string): Promise<Foto> {
    try {
      await this.fotoModel.sync({ force: false });
      const foto = await this.fotoModel.findOne({ where: { id: id } });
      if (!foto) {
        throw new HttpException(
          `Foto with id ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      return foto;
    }
    catch (error) {

      console.error(error);
      return null;
    }
  }

  async getAllFoto(): Promise<Foto[]> {
    try {
      await this.fotoModel.sync({ force: false });
      return await this.fotoModel.findAll();
    }
    catch (error) {
      console.error(error);
    }
  }
  async getFotoFromNomeFileEWebPathid(nomeFile: string, idWebPath: string): Promise<Foto> {
    try {
      await this.fotoModel.sync({ force: false });
      const foto = await this.fotoModel.findOne({
        where: { file_name_web: nomeFile, id_path_web: idWebPath },
      });
      if (!foto) {
        throw new HttpException(
          `Foto with file name ${nomeFile} not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      return foto;
    } catch (error) {
      console.error(error);
    }
  }

  // async getFormati(): Promise<Formati[]> {
  //   return await this.formatiModel.findAll();
  // }
}



interface FileDataINDD {
  id: string;
  filename: string;
  size: number;
  md5: string;
}
