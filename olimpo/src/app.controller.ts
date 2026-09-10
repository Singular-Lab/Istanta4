import { ABSOLUTE_PATH_TYPE } from '@enums/enums';
import { MultipartFile } from '@fastify/multipart';
import { Colorize } from '@lib/colorize';
import ConversionService from '@lib/ConversionService';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { InfoFotoMassivo, JSONMetaFoto } from '@server_types/types';
import { exec } from "child_process";
import * as crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import * as path from 'path';
import { PythonShell } from 'python-shell';
import * as sharp from 'sharp';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { OlimpoService } from './app.service';
import { AbsolutePaths } from './models/absolute_path.model';
import { Foto, FotoAttributes } from './models/foto.model';
import runConversionTask from './worker/conversionTask';
import AdmZip = require('adm-zip');
const FORCE_FOR_OVERIDE_FOR_TEST = false;

const sizeOf = promisify(imageSize);
const execPromise = promisify(exec)

@Controller('foto')
export class OlimpoController {
  /**
   *
   */
  private PATH_WEB_ASSOLUTO: AbsolutePaths;
  private PATH_ARCHIVIO_ASSOLUTO: AbsolutePaths;
  private PATH_VIDEO_ASSOLUTO: AbsolutePaths;

  constructor(private readonly olimpoService: OlimpoService) {
    this.init();
  }

  async init() {
    this.PATH_WEB_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
    this.PATH_ARCHIVIO_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO);
    this.PATH_VIDEO_ASSOLUTO = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.VIDEO);
  }




  @Post('uploadPacchettoFoto')
  async uploadMassivoPacchettoFoto(
    @Res() res: FastifyReply,
    @Req() req: FastifyRequest<{ Body: { file: MultipartFile; json_meta_foto: { value: string | JSONMetaFoto[] } } }>,
  ): Promise<void> {
    let meta_foto: JSONMetaFoto[];
    try {
      if (typeof req.body.json_meta_foto.value === 'string') {
        meta_foto = JSON.parse(req.body.json_meta_foto.value) as JSONMetaFoto[];
        if (typeof meta_foto === "string") {
          meta_foto = JSON.parse(meta_foto);
        }
      } else {
        meta_foto = req.body.json_meta_foto.value as JSONMetaFoto[];
      }
    } catch (error) {
      res.status(400).send({ lista: [], error: 'Invalid JSON in json_meta_foto' });
      return;
    }
    const file = req.body.file;
    console.log(meta_foto);

    const path_pacchetto_zip = path.resolve(__dirname, `../../foto-${uuidv4()}.zip`);
    const path_prima_estrazione_zip = path.resolve(__dirname, process.env.EXTRACTION_PATH);

    if (!fs.existsSync(path_prima_estrazione_zip)) {
      fs.mkdirSync(path_prima_estrazione_zip, { recursive: true });
    }
    try {
      const bufferFile: Buffer = await file.toBuffer();
      fs.writeFileSync(path_pacchetto_zip, bufferFile);

      const zip = new AdmZip(path_pacchetto_zip);
      zip.extractAllTo(path_prima_estrazione_zip, true);
      await fs.promises.rm(path_pacchetto_zip);
      const files = fs.readdirSync(path_prima_estrazione_zip);
      let file_number = files.length;
      console.log(meta_foto);
      const path_web_db = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
      const path_archivio_db = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO);

      // Array per raccogliere le conversioni da eseguire in parallelo
      const conversionPromises: Promise<unknown>[] = [];

      for (const file_dello_zip of files) {
        //NOTE: Qui va controllata la lista di file NON accettati.
        if (isAcceptedFileOrFileExtension(file_dello_zip) === false) {
          await fs.promises.rm(path.join(path_prima_estrazione_zip, file_dello_zip), { force: true, recursive: true });
          console.log(Colorize.bgRed(`Il file ${file_dello_zip} ha un formato non accettato e verrà eliminato`));
          continue;
        }
        const nome_nuovo_uuid_file = `${uuidv4()}${path.extname(file_dello_zip)}`;
        const nome_archivio_file_finale = path.join(path_archivio_db.path, nome_nuovo_uuid_file);
        const nome_web_file_finale = path.join(path_web_db.path, nome_nuovo_uuid_file);
        const path_file_dello_zip_completo = path.join(path_prima_estrazione_zip, file_dello_zip);

        console.log(Colorize.bgBlue(`Inizio elaborazione file: ${file_dello_zip}`));
        const buffer_file_dello_zip = fs.readFileSync(path_file_dello_zip_completo);
        const md5_file_dello_zip = crypto.createHash('md5').update(buffer_file_dello_zip).digest('hex');

        const foto_db = await this.olimpoService.checkFileExistFromMD5(md5_file_dello_zip);
        const esiste_in_db = foto_db != null;
        const file_corrisponde_alla_lista = meta_foto.find((meta) => meta.FileName === file_dello_zip) !== undefined;
        const foto_finale = new Foto();
        foto_finale.id = uuidv4();
        foto_finale.md5 = md5_file_dello_zip;
        foto_finale.id_path_archivio = path_archivio_db.id;
        foto_finale.id_path_web = path_web_db.id;
        foto_finale.file_name = nome_nuovo_uuid_file;
        //foto_finale.id_formato = '58a8e168-b2c7-4e07-9d96-7ae271df8be4';

        if (esiste_in_db && file_corrisponde_alla_lista) {
          file_number--;
          await fs.promises.rm(path_file_dello_zip_completo, { force: true });
          console.log(Colorize.bgYellow(`File duplicato eliminato: ${nome_nuovo_uuid_file}`));
          meta_foto
            .filter((meta) => meta.FileHash.toUpperCase() === md5_file_dello_zip.toUpperCase())
            .forEach((meta) => {
              meta.Id = foto_db.id;
            });
          console.log(Colorize.bgGreen(`Il file ${file_dello_zip} è già presente nel database`));
          continue;
        } else if (!esiste_in_db && file_corrisponde_alla_lista) {
          // Smistamento sincrono (o eventualmente parallelizzato se necessario)
          await this.smistamentoFile(path_file_dello_zip_completo, nome_archivio_file_finale);

          // Avvia la conversione in un worker
          const conversionTask = runConversionTask({
            path_file_dello_zip_completo,
            nome_archivio_file_finale,
            nome_web_file_finale,
            unique_name: nome_nuovo_uuid_file,
          });

          // NOTE: nel array va la catena *già gestita*, altrimenti il rejection del
          // task grezzo (e quello della pulizia) resta senza handler e fa cadere il processo.
          const conversionHandled = conversionTask
            .then((nome_file_convertito) => {
              if (nome_file_convertito === null) {
                throw new Error('Errore durante la conversione del file');
              }
              // Aggiorna i dati da salvare sul database
              foto_finale.file_name_web = nome_file_convertito;
              foto_finale.file_name_web_performante = nome_file_convertito.replace(
                path.extname(nome_file_convertito),
                '.webp'
              );
              meta_foto.filter((meta) => meta.FileHash.toUpperCase() === md5_file_dello_zip.toUpperCase()).forEach((meta) => {
                meta.Id = foto_finale.id;
              });
              return this.olimpoService.creaFotoRecord(foto_finale);
            })
            .catch(async (error) => {
              console.error(`Errore conversione file ${file_dello_zip}:`, error);
              //se errore togli il file da meta_file e fai l'unlink
              meta_foto = meta_foto.filter((meta) => meta.FileName !== file_dello_zip);
              // force: il temporaneo può già essere stato rimosso dallo smistamento
              await fs.promises.rm(path_file_dello_zip_completo, { force: true });
            });

          conversionPromises.push(conversionHandled);
          console.log(Colorize.bgGreen(`Il file ${file_dello_zip} verrà processato tramite worker`));
          continue;
        } else if (esiste_in_db && !file_corrisponde_alla_lista) {
          await fs.promises.rm(path_file_dello_zip_completo);
          console.log(Colorize.bgRed(`Il file ${file_dello_zip} non corrisponde alla lista`));
          continue;
        } else if (!esiste_in_db && !file_corrisponde_alla_lista) {
          await fs.promises.rm(path_file_dello_zip_completo);
          console.log(Colorize.bgYellow(`Il file ${file_dello_zip} non è presente nel database e non corrisponde alla lista`));
          continue;
        }
      }

      // Attendi tutte le conversioni in parallelo
      await Promise.all(conversionPromises);
      return res.status(200).send({ lista: meta_foto, error: '' });
    } catch (error) {
      console.log(error);
      res.status(500).send({ lista: [], error: 'Internal server error' });
    }
  }


  //#endregion

  //#region Upload singolo file con form-data

  @Post('uploadFoto')
  async uploadSingoloFileFotoInArchivio(
    @Req() req: FastifyRequest<{ Body: { file: MultipartFile; json_meta_foto: { value: string | JSONMetaFoto } } }>,
    @Res() res: FastifyReply,
  ): Promise<void> {
    let meta_foto: JSONMetaFoto;
    console.log(Colorize.bgCyan('--- INIZIO CHIAMATA uploadSingoloFileFotoInArchivio ---'));
    try {
      console.log(Colorize.bgCyan('Ricevuto body:'), req.body);
      // Verifica se json_meta_foto è già un oggetto
      if (typeof req.body.json_meta_foto.value === 'string') {
        console.log(Colorize.bgCyan('json_meta_foto.value è una stringa, provo a fare il parse...'));
        meta_foto = JSON.parse(req.body.json_meta_foto.value) as JSONMetaFoto;
      } else {
        console.log(Colorize.bgCyan('json_meta_foto.value è già un oggetto'));
        meta_foto = req.body.json_meta_foto.value as JSONMetaFoto;
      }
      console.log(Colorize.bgCyan('meta_foto dopo il parsing:'), meta_foto);
    } catch (error) {
      console.error(Colorize.bgRed('Errore nel parsing di json_meta_foto:'), error);
      res.status(400).send({ record: {}, error: 'Invalid JSON in json_meta_foto' });
      return;
    }
    const file = req.body.file;
    console.log(Colorize.bgCyan('File ricevuto:'), {
      filename: file.filename,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      encoding: file.encoding,
      byteCount: file.file ? file.file.bytesRead : undefined
    });

    const nome_nuovo_uuid_file = `${uuidv4()}${path.extname(file.filename)}`;
    const path_file = path.resolve(__dirname, `../../${nome_nuovo_uuid_file}`);
    const path_archivio_db = this.PATH_ARCHIVIO_ASSOLUTO;
    const path_web_db = this.PATH_WEB_ASSOLUTO;

    const nome_archivio_file_finale = path.join(path_archivio_db.path, nome_nuovo_uuid_file);
    const nome_web_file_finale = path.join(path_web_db.path, nome_nuovo_uuid_file);

    try {
      if (isAcceptedFileOrFileExtension(nome_nuovo_uuid_file) === false) {
        await fs.promises.rm(path_file);
        console.log(Colorize.bgRed(`Il file ${nome_nuovo_uuid_file} ha un formato non accettato e verrà eliminato`));
      }
      console.log(Colorize.bgCyan('Inizio conversione file in buffer...'));
      const bufferFile: Buffer = await file.toBuffer();
      console.log(Colorize.bgCyan('Buffer file creato, dimensione:'), bufferFile.length);

      // Scrivi il file caricato sul disco
      fs.writeFileSync(path_file, bufferFile);
      console.log(Colorize.bgCyan('File scritto su disco temporaneo:'), path_file);

      //variabili che verranno utilizzate per il salvataggio del file
      console.log(Colorize.bgBlue(`Inizio elaborazione file: ${file.filename}`));
      const md5_file = crypto.createHash('md5').update(bufferFile).digest('hex');
      console.log(Colorize.bgCyan('MD5 calcolato:'), md5_file);

      const esiste_in_db = await this.olimpoService.checkFileExistFromMD5(md5_file) != null;
      const foto_db = await this.olimpoService.checkFileExistFromMD5(md5_file);
      console.log(Colorize.bgCyan('Esiste in DB:'), esiste_in_db, 'foto_db:', foto_db);

      const file_corrisponde_alla_lista = meta_foto.FileName === file.filename;
      console.log(Colorize.bgCyan('File corrisponde alla lista?'), file_corrisponde_alla_lista);

      const foto_finale = new Foto();
      foto_finale.id = uuidv4();
      foto_finale.md5 = md5_file;
      foto_finale.id_path_archivio = path_archivio_db.id;
      foto_finale.id_path_web = path_web_db.id;
      foto_finale.file_name = nome_nuovo_uuid_file;
      //foto_finale.id_formato = '58a8e168-b2c7-4e07-9d96-7ae271df8be4';

      if ((esiste_in_db && file_corrisponde_alla_lista) && !FORCE_FOR_OVERIDE_FOR_TEST) {
        console.log(Colorize.bgYellow('File già presente in DB e corrisponde alla lista, non verrà sovrascritto.'));
        if (md5_file !== null) {
          // Se il file è duplicato, lo elimina
          await fs.promises.rm(path_file);
          console.log(Colorize.bgYellow(`File duplicato eliminato: ${nome_nuovo_uuid_file}`));
          meta_foto.Id = foto_db.id;
        }
        console.log(Colorize.bgGreen(`Il file ${file.fieldname} è già presente nel database`));
      }
      else if ((!esiste_in_db && file_corrisponde_alla_lista) || FORCE_FOR_OVERIDE_FOR_TEST) {
        console.log(Colorize.bgGreen('File non presente in DB oppure forzatura attiva, procedo con smistamento/conversione.'));
        await this.smistamentoFile(path_file, nome_archivio_file_finale);
        console.log(Colorize.bgCyan('File smistato in archivio:'), nome_archivio_file_finale);

        if (path.extname(nome_archivio_file_finale) === ".idms") {
          //copialo e basta senza convertire
          fs.copyFileSync(nome_archivio_file_finale, nome_web_file_finale);
          console.log(Colorize.bgCyan('File .idms copiato anche in web:'), nome_web_file_finale);
          foto_finale.file_name_web = nome_nuovo_uuid_file;
          foto_finale.file_name_web_performante = "";
          foto_finale.file_name = nome_nuovo_uuid_file;
          await this.olimpoService.creaFotoRecord(foto_finale);
          console.log(Colorize.bgGreen('Record creato in DB per file .idms'), foto_finale);
          meta_foto.Id = foto_finale.id;
        } else {
          console.log(Colorize.bgCyan('Chiamo ConversionService.conversioneFile...'));
          const nome_file_convertito = await ConversionService.conversioneFile(path_file, nome_archivio_file_finale, nome_web_file_finale, nome_nuovo_uuid_file);
          console.log(Colorize.bgCyan('Conversione completata, nome file convertito:'), nome_file_convertito);
          foto_finale.file_name_web = nome_file_convertito;
          foto_finale.file_name_web_performante = nome_file_convertito.replace(path.extname(nome_file_convertito), '.webp');
          await this.olimpoService.creaFotoRecord(foto_finale);
          console.log(Colorize.bgGreen('Record creato in DB per file convertito'), foto_finale);
          meta_foto.Id = foto_finale.id;
          console.log(Colorize.bgGreen(`Il file ${file.filename} non è presente nel database ma corrisponde alla lista, quindi verrà processato`));
        }

      } else if (esiste_in_db && !file_corrisponde_alla_lista) {
        console.log(Colorize.bgRed('File già presente in DB ma NON corrisponde alla lista, lo elimino.'));
        await fs.promises.rm(path_file);
        console.log(Colorize.bgRed(`Il file ${file.filename} non corrisponde alla lista`));

      } else if (!esiste_in_db && !file_corrisponde_alla_lista) {
        console.log(Colorize.bgYellow('File NON presente in DB e NON corrisponde alla lista, lo elimino.'));
        await fs.promises.rm(path_file);
        console.log(Colorize.bgYellow(`Il file ${file.fieldname} non è presente nel database e non corrisponde alla lista`));
      }
      console.log(Colorize.bgCyan('Fine chiamata uploadSingoloFileFotoInArchivio, restituisco meta_foto:'), meta_foto);
      return res.status(200).send({ record: meta_foto, error: '' });

    } catch (error) {
      console.error(Colorize.bgRed('Errore durante la chiamata uploadSingoloFileFotoInArchivio:'), error);
      try {
        fs.rmSync(path_file, { force: true });
        console.log(Colorize.bgYellow('File temporaneo eliminato dopo errore:'), path_file);
      } catch (err) {
        console.error(Colorize.bgRed('Errore durante la rimozione del file temporaneo:'), err);
      }
      res.status(500).send({ error: error.message });
    }
    console.log(Colorize.bgCyan('--- FINE CHIAMATA uploadSingoloFileFotoInArchivio ---'));
  }


  @Post('uploadFotoWebPliant')
  async uploadFotoWebPliant(
    @Req() req: FastifyRequest<{ Body: { file: MultipartFile; } }>,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const file = req.body.file;
    let nome_nuovo_uuid_file = `${uuidv4()}${path.extname(file.filename)}`;
    if (path.extname(nome_nuovo_uuid_file) === "") {
      const mimeType = file.mimetype;
      let extension = "";
      switch (mimeType) {
        case "image/jpeg":
          extension = ".jpg";
          break;
        case "image/png":
          extension = ".png";
          break;
        case "image/webp":
          extension = ".webp";
          break;
        case "image/gif":
          extension = ".gif";
          break;
        case "image/tiff":
          extension = ".tiff";
          break;
        default:
          extension = "";
          break;
      }
      nome_nuovo_uuid_file = `${nome_nuovo_uuid_file}${extension}`;
    }
    const path_file = path.resolve(__dirname, `../../${nome_nuovo_uuid_file}`);
    const path_archivio_db = this.PATH_ARCHIVIO_ASSOLUTO;
    const path_web_db = this.PATH_WEB_ASSOLUTO;
    const nome_archivio_file_finale = path.join(path_archivio_db.path, nome_nuovo_uuid_file);
    const nome_web_file_finale = path.join(path_web_db.path, nome_nuovo_uuid_file);

    try {
      const bufferFile: Buffer = await file.toBuffer();
      // Scrivi il file caricato sul disco
      fs.writeFileSync(path_file, bufferFile);
      console.log(Colorize.bgBlue(`Inizio elaborazione file: ${file.filename}`));
      const md5_file = crypto.createHash('md5').update(bufferFile).digest('hex');

      const esiste_in_db = await this.olimpoService.checkFileExistFromMD5(md5_file) != null;
      const foto_db = await this.olimpoService.checkFileExistFromMD5(md5_file);
      const foto_finale = new Foto();
      foto_finale.id = uuidv4();
      foto_finale.md5 = md5_file;
      foto_finale.id_path_archivio = path_archivio_db.id;
      foto_finale.id_path_web = path_web_db.id;
      foto_finale.file_name = nome_nuovo_uuid_file;
      //foto_finale.id_formato = '58a8e168-b2c7-4e07-9d96-7ae271df8be4';

      if (esiste_in_db) {
        if (md5_file !== null) {
          // Se il file è duplicato, lo elimina
          await fs.promises.rm(path_file);
          console.log(Colorize.bgYellow(`File duplicato eliminato: ${nome_nuovo_uuid_file}`));
        }
        console.log(Colorize.bgGreen(`Il file ${file.fieldname} è già presente nel database`));
        res.send({ record: { guidId: foto_db.id }, error: '' });
      }
      else if (!esiste_in_db) {
        await this.smistamentoFile(path_file, nome_archivio_file_finale);
        const nome_file_convertito = await ConversionService.conversioneFile(path_file, nome_archivio_file_finale, nome_web_file_finale, nome_nuovo_uuid_file);
        foto_finale.file_name_web = nome_file_convertito;
        foto_finale.file_name_web_performante = nome_file_convertito.replace(path.extname(nome_file_convertito), '.webp');
        const foto = await this.olimpoService.creaFotoRecord(foto_finale);
        console.log(Colorize.bgGreen(`Il file ${file.filename} non è presente nel database ma corrisponde alla lista, quindi verrà processato`));
        res.send({ record: { guidId: foto.id }, error: '' });
      }

    } catch (error) {
      console.log(error);
      res.status(500).send({ record: {}, error: 'Internal server error' });
    }
  }

  @Post('updateFotoPathWeb')
  async updateFotoPathWeb(
    @Req() req: FastifyRequest<{ Body: { id: any; file: MultipartFile } }>,
    @Res() res: FastifyReply,
  ): Promise<void> {
    try {
      // Estrai id e file dalla richiesta
      let { id } = req.body;
      const file = req.body.file;

      // Normalizza l'ID se necessario
      if (id && id.value) {
        id = id.value;
      }

      // Verifica l'esistenza della foto
      const existingFoto = await this.olimpoService.getFotoFromId(id);

      // Prepara i buffer e genera nomi file univoci
      const uuid = uuidv4();
      const nomeFileNuovo = `${uuid}${path.extname(file.filename)}`;
      const nomeFileNuovoWebp = `${uuid}.webp`;
      const bufferFileNuovaFoto: Buffer = await file.toBuffer();
      const md5 = crypto.createHash('md5').update(bufferFileNuovaFoto).digest('hex');

      // Percorsi per i file
      const pathFotoWeb = path.join(this.PATH_WEB_ASSOLUTO.path, nomeFileNuovo);
      const pathFotoWebWebp = path.join(this.PATH_WEB_ASSOLUTO.path, nomeFileNuovoWebp);
      const pathFotoArchivio = path.join(this.PATH_ARCHIVIO_ASSOLUTO.path, nomeFileNuovo);

      // Converti in formato webp per tipi di immagine supportati
      let bufferWebpNuovaFoto: Buffer | null = null;
      if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'].includes(file.mimetype)) {
        bufferWebpNuovaFoto = await sharp(bufferFileNuovaFoto).webp({ quality: 80 }).toBuffer();
      }

      // Salva i file
      await fs.promises.writeFile(pathFotoWeb, bufferFileNuovaFoto);
      if (bufferWebpNuovaFoto) {
        await fs.promises.writeFile(pathFotoWebWebp, bufferWebpNuovaFoto);
      }
      await fs.promises.writeFile(pathFotoArchivio, bufferFileNuovaFoto);

      if (!existingFoto) {
        // Crea nuovo record
        const validId = this.isValidUUID(id) ? id : uuidv4();

        const newFoto = new Foto({
          id: validId,
          file_name: nomeFileNuovo,
          file_name_web: nomeFileNuovo,
          file_name_web_performante: nomeFileNuovoWebp,
          id_path_archivio: this.PATH_ARCHIVIO_ASSOLUTO.id,
          id_path_web: this.PATH_WEB_ASSOLUTO.id,
          //id_formato: '58a8e168-b2c7-4e07-9d96-7ae271df8be4',
          md5: md5,
        });

        await this.olimpoService.creaFotoRecord(newFoto);
        res.status(HttpStatus.CREATED).send({
          message: 'File salvato con successo',
          esito: true,
          error: "",
          guidId: validId
        });
      } else {
        // Aggiorna record esistente
        const oldFileName = existingFoto.file_name_web;
        const oldFilePath = path.join(this.PATH_WEB_ASSOLUTO.path, oldFileName);

        const fotoToUpdate: FotoAttributes = {
          id: existingFoto.id,
          file_name: existingFoto.file_name,
          file_name_web: nomeFileNuovo,
          file_name_web_performante: nomeFileNuovoWebp,
          id_path_archivio: this.PATH_ARCHIVIO_ASSOLUTO.id,
          id_path_web: this.PATH_WEB_ASSOLUTO.id,
          //id_formato: '58a8e168-b2c7-4e07-9d96-7ae271df8be4',
          md5: existingFoto.md5, // Mantieni l'MD5 originale o aggiorna? In caso aggiorna: md5
        };

        const updateResult = await this.olimpoService.updateFotoRecord(fotoToUpdate);

        // Elimina il vecchio file se esiste
        if (fs.existsSync(oldFilePath)) {
          try {
            await fs.promises.unlink(oldFilePath);
          } catch (err) {
            console.warn(`Non è stato possibile eliminare il vecchio file: ${oldFilePath}`, err);
          }
        }

        res.status(200).send({
          message: 'Path updated successfully',
          esito: true,
          guidId: existingFoto.id,
          error: ""
        });
      }
    } catch (error) {
      console.error('Errore in updateFotoPathWeb:', error);
      res.status(500).send({ error: 'Internal server error', details: error.message });
    }
  }

  // #endregion

  @Get('getFotoPathFromId')
  async getFotoPathFotoArchiovioFromId(
    @Query('id') id: string,
  ): Promise<string> {
    return await this.olimpoService.getPathFotoArchivioFromID(id);
  }

  @Get('getFotoStreamFromId')
  async getFotoStreamFromId(
    @Query('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Res() res: FastifyReply,
  ) {
    try {
      console.log(`[getFotoStreamFromId] Starting stream request for id: ${id}, range: ${start}-${end}`);

      const filePath = await this.olimpoService.getPathFotoArchivioFromID(id);
      console.log(`[getFotoStreamFromId] Retrieved file path: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.error(`[getFotoStreamFromId] File not found at path: ${filePath}`);
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      const stat = fs.statSync(filePath);
      const total = stat.size;
      console.log(`[getFotoStreamFromId] File size: ${total} bytes`);

      const parsedStart = parseInt(start, 10);
      const parsedEnd = parseInt(end, 10);
      const startNum = isNaN(parsedStart) ? 0 : parsedStart;
      const endNum = isNaN(parsedEnd) ? total - 1 : parsedEnd - 1;
      console.log(`[getFotoStreamFromId] Parsed range: ${startNum}-${endNum}`);

      if (startNum > total || endNum >= total || startNum > endNum) {
        console.error(`[getFotoStreamFromId] Invalid range requested. Start: ${startNum}, End: ${endNum}, Total: ${total}`);
        throw new HttpException(
          'Invalid range',
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        );
      }

      const chunksize = endNum - startNum + 1;
      console.log(`[getFotoStreamFromId] Chunk size: ${chunksize} bytes`);

      const fileName = path.basename(filePath);
      const file = fs.createReadStream(filePath, {
        start: startNum,
        end: endNum,
      });
      console.log(`[getFotoStreamFromId] Created read stream for range ${startNum}-${endNum}`);

      const isFullFile = startNum === 0 && endNum === total - 1;
      res.status(isFullFile ? 200 : 206);
      res.header('Content-Range', `bytes ${startNum}-${endNum}/${total}`);
      res.header('Accept-Ranges', 'bytes');
      res.header('Content-Length', chunksize);
      res.header('Content-Type', 'application/octet-stream');
      res.header('Content-Disposition', `attachment; filename="${fileName}"`);
      console.log(`[getFotoStreamFromId] Set response headers for streaming`);

      file.pipe(res.raw);
      console.log(`[getFotoStreamFromId] Started piping file stream to response`);
    } catch (error) {
      console.error(`[getFotoStreamFromId] Error occurred:`, error);
      res.send(error);
    }
  }

  //#region Download multiplo dei file

  // @Header('Content-Type', 'application/octet-stream')
  // @Header('Content-Disposition', 'attachment; filename=files.stream')
  // @Put('getFotoStreamFromIds')
  // async getFotoStreamFromIds(@Body() body: { ids: string[] }, @Res() res: FastifyReply) {
  //   const { ids } = body;

  //   for (const id of ids) {
  //     const filePath = await this.olimpoService.getPathFotoArchivioFromID(id);
  //     console.log(filePath);
  //     if (fs.existsSync(filePath)) {
  //       const fileName = path.basename(filePath);
  //       res.raw.write(`\n--file-name--${fileName}--file-name--\n`);
  //       const fileStream = fs.createReadStream(filePath);
  //       await new Promise<void>((resolve) => {
  //         fileStream.pipe(res.raw, { end: false });
  //         fileStream.on('end', () => {
  //           res.raw.write('\n--file-separator--\n'); // Aggiungi un separatore tra i file
  //           resolve();
  //         });
  //       });
  //     } else {
  //       console.error(`File not found: ${filePath}`);
  //     }
  //   }

  //   res.raw.end();
  // }


  @Put("/getInfoMassivo")
  async getInfoMassivo(@Body() body: any, @Res() res: FastifyReply): Promise<void> {
    try {
      const fotoInfoDaRiempire = body as InfoFotoMassivo[];
      const fotoInfoDaRimandareRiempito: InfoFotoMassivo[] = [];
      for (const element of fotoInfoDaRiempire) {
        try {
          const resultPerInfoFoto = await this.olimpoService.getInfoFotoEPathFromId(element.Id);
          const fileSize = fs.readFileSync(resultPerInfoFoto.path_completo).byteLength;
          let width = 0;
          let height = 0;
          if (path.extname(resultPerInfoFoto.path_completo).toLowerCase() !== ".idms" && path.extname(resultPerInfoFoto.path_completo).toLowerCase() !== ".ai" && path.extname(resultPerInfoFoto.path_completo).toLowerCase() !== ".psd" && path.extname(resultPerInfoFoto.path_completo).toLowerCase() !== ".eps") {
            const buffer = fs.readFileSync(resultPerInfoFoto.path_completo);

            const metadata = await sharp(buffer).metadata();
            width = metadata.width || 0;
            height = metadata.height || 0;
          }
          const obj: InfoFotoMassivo = {
            FileHash: resultPerInfoFoto.hash,
            Id: element.Id,
            Size: fileSize,
            FileName: element.FileName,
            Width: width,
            Height: height,
          };
          fotoInfoDaRimandareRiempito.push(obj);
        } catch (error) {
          console.error(`Error processing ID ${element.Id}:`, error.message);
          // Puoi decidere di continuare o interrompere il ciclo in base alle tue esigenze
        }
      }

      res.status(HttpStatus.OK).send(fotoInfoDaRimandareRiempito);
    } catch (error) {
      console.log(error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }


  @Header('Content-Type', 'application/octet-stream')
  @Header('Content-Disposition', 'attachment; filename=files.stream')
  @Put('getFotoStreamFromIds')
  async getFotoStreamFromIds(
    @Body() body: { ids: string[] },
    @Res() res: FastifyReply,
  ) {
    res.raw.write(`\n--file-separator--\n`);
    res.raw.end();
  }

  @Get('provaArray')
  async provaArray(@Res() res: FastifyReply): Promise<void> {
    try {
      const result = await this.olimpoService.provaArray();
      res.send(result);
    } catch (error) {
      res.send(error);
    }
  }

  @Get('salvaFile')
  getFile(@Query('path') fullPath: string) {
    // Separiamo il path dal nome del file
    const parts = fullPath.split('/');
    const nomeFile = parts.pop(); // Estraiamo l'ultimo elemento come nome file
    const path = parts.join('/'); // Il resto è il path

    return {
      path,
      nomeFile,
    };
  }

  @Get('getThumbNailOnDemand')
  async getThumbNailOnDemand(
    @Res() res: FastifyReply,
    @Query('guidId') guidId: string,
    @Query('guidIdDiretto') guidIdDiretto: string,
    @Query('width') width: string,
    @Query('height') height: string,
    @Query("performante") performante: boolean
    // @Query('format') format: string,
  ): Promise<void> {
    try {
      console.log(Colorize.bgMagenta(`Ricevuta richiesta per getThumbNailOnDemand con guidId: ${guidId}, width: ${width}, height: ${height}, perfomante: ${performante}`));

      // Ottieni il percorso della foto usando l'ID
      //HACK attenzione questo e un hack per le performance
      let pathFoto: string = ""
      if (guidIdDiretto != "" && guidIdDiretto != null) {
        pathFoto = await this.olimpoService.getPathFotoWebFromFilename(guidIdDiretto);
      } else {
        if (!guidId || !this.isValidUUID(guidId)) {
          throw new Error(`Invalid UUID: ${guidId}`);
        }
        pathFoto = await this.olimpoService.getPathFotoWebFromID(guidId, performante);
        console.log(Colorize.bgMagenta(`Percorso della foto ottenuto: ${pathFoto}`));
      }

      // Leggi l'immagine dal percorso
      if (fs.existsSync(pathFoto)) {
        console.log(Colorize.bgMagenta(`Il file esiste nel percorso: ${pathFoto}`));
        let buffer = fs.readFileSync(pathFoto);
        let format = path.extname(pathFoto).replace(".", "");
        //NOTE commentata per il test
        // let image = sharp(buffer);

        // Valida gli input di larghezza e altezza
        if ((width == "0" && height == "0") || (width == "" && height == "")) {
          console.error(Colorize.bgRed("Width e height non possono essere entrambi nulli o 0"));
          res.status(400).send("Width e height non possono essere entrambi nulli o 0");
          return;
        }

        const widthNum = parseInt(width, 10);
        const heightNum = parseInt(height, 10);
        console.log(Colorize.bgMagenta(`Valori di width e height convertiti: widthNum = ${widthNum}, heightNum = ${heightNum}`));

        // Ottieni le dimensioni originali dell'immagine
        let image = sharp(buffer);
        const metadata = await image.metadata();
        const origWidth = metadata.width || 0;
        const origHeight = metadata.height || 0;
        console.log(Colorize.bgMagenta(`Dimensioni originali dell'immagine: width = ${origWidth}, height = ${origHeight}, format = ${format}`));
        if (widthNum > 0 && heightNum > 0) {
          // Entrambi width e height sono forniti
          // Primo calcolo: (origWidth / origHeight) = (widthNum / y)
          const y = (origHeight * widthNum) / origWidth;
          console.log(Colorize.bgMagenta(`Calcolo della nuova altezza proporzionale (y): y = ${y}`));

          if (y > heightNum) {
            // Secondo calcolo: (widthNum / y) = (x / heightNum)
            const x = (widthNum * heightNum) / y;
            console.log(Colorize.bgMagenta(`Calcolo della nuova larghezza proporzionale (x): x = ${x}`));

            // Ridimensiona l'immagine a x e heightNum
            image = image.resize(Math.round(x), heightNum, {
              fit: sharp.fit.inside,
              withoutEnlargement: true,
            });
          } else {
            // Ridimensiona l'immagine a widthNum e y
            image = image.resize(widthNum, Math.round(y), {
              fit: sharp.fit.inside,
              withoutEnlargement: true,
            });
          }
        } else if (widthNum > 0) {
          // Solo width è fornito
          // Calcola la nuova altezza mantenendo le proporzioni
          const newHeight = (origHeight * widthNum) / origWidth;
          console.log(Colorize.bgMagenta(`Solo width fornito. Nuova altezza calcolata: newHeight = ${newHeight}`));

          // Ridimensiona l'immagine
          image = image.resize(widthNum, Math.round(newHeight), {
            fit: sharp.fit.inside,
            withoutEnlargement: true,
          });
        } else if (heightNum > 0) {
          // Solo height è fornito
          // Calcola la nuova larghezza mantenendo le proporzioni
          const newWidth = (origWidth * heightNum) / origHeight;
          console.log(Colorize.bgMagenta(`Solo height fornito. Nuova larghezza calcolata: newWidth = ${newWidth}`));

          // Ridimensiona l'immagine
          image = image.resize(Math.round(newWidth), heightNum, {
            fit: sharp.fit.inside,
            withoutEnlargement: true,
          });
        } else {
          // Nessuno dei due valori è valido allora manda l'immagine con le dimensioni originali
          console.log(Colorize.bgMagenta(`Nessuna dimensione valida fornita. Invio l'immagine con le dimensioni originali`));
        }

        // Converte l'immagine in un buffer
        const imageBuffer = await image.toBuffer();
        console.log(Colorize.bgMagenta(`Immagine ridimensionata e convertita in buffer`));

        // Imposta l'intestazione Content-Type in base al formato dell'immagine
        res.header("Cache-Control", "public, max-age=31536000, immutable");
        res.header('Content-Type', `image/${format}`);

        // Invia il buffer come risposta
        //NOTE commentata per test
        res.send(imageBuffer);
        //res.send(buffer);
        console.log(Colorize.bgGreen(`Risposta inviata con successo`));
      } else {
        console.error(Colorize.bgMagenta(`File non trovato nel percorso: ${pathFoto}`));
        if (process.env.NODE_ENV === "development") {
          const pathPlaceholder = path.resolve(__dirname, '../../nofoto.jpg');
          const buffer = await fs.promises.readFile(pathPlaceholder);
          res.header('Content-Type', 'image/png');
          res.send(buffer);
          return;
        }
        res.status(404).send("File non trovato");
      }
    } catch (error: any) {
      console.error(`Errore durante l'elaborazione della richiesta: ${error.message}`);
      if (process.env.NODE_ENV === "development") {
        const pathPlaceholder = path.resolve(__dirname, '../../nofoto.jpg');
        const buffer = await fs.promises.readFile(pathPlaceholder);
        res.header('Content-Type', 'image/png');
        res.send(buffer);
        return;
      }
      res.status(500).send(error.message);
    }
  }


  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  @Get('getFotoOnDemand')
  async getFotoOnDemand(
    @Res() res: FastifyReply,
    @Query('guidId') guidId: string
  ): Promise<void> {
    try {
      console.log(Colorize.bgMagenta(`Ricevuta richiesta per getFoto con guidId: ${guidId}`));

      // Ottieni il percorso della foto usando l'ID
      const pathFoto = await this.olimpoService.getPathFotoWebFromID(guidId);
      console.log(Colorize.bgMagenta(`Percorso della foto ottenuto: ${pathFoto}`));

      // Leggi l'immagine dal percorso
      if (fs.existsSync(pathFoto)) {
        console.log(Colorize.bgMagenta(`Il file esiste nel percorso: ${pathFoto}`));
        const buffer = fs.readFileSync(pathFoto);

        // Ottieni il formato dell'immagine
        const image = sharp(buffer);
        const metadata = await image.metadata();
        const format = metadata.format || 'jpeg'; // Formato dell'immagine
        console.log(Colorize.bgMagenta(`Formato dell'immagine: ${format}`));

        // Imposta l'intestazione Content-Type in base al formato dell'immagine
        res.header('Content-Type', `image/${format}`);

        // Invia il buffer come risposta
        res.send(buffer);
        console.log(Colorize.bgGreen(`Risposta inviata con successo`));
      } else {
        console.error(Colorize.bgMagenta(`File non trovato nel percorso: ${pathFoto}`));
        res.status(404).send("File non trovato");
      }
    } catch (error: any) {
      console.error(`Errore durante l'elaborazione della richiesta: ${error.message}`);
      res.status(500).send(error.message);
    }
  }



  //#endregion


  @Post('riconversioneCartellaArchivioACartellaWeb')
  async riconversioneCartellaArchivioACartellaWeb(
    @Req() req: FastifyRequest<{ Body: { id: string } }>,
    @Res() res: FastifyReply
  ): Promise<void> {
    try {
      //prendi tutti i file nella cartella di archivio
      const path_assoluto_archivio = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO);
      const path_assoluto_web = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);

      const files = fs.readdirSync(path_assoluto_archivio.path);
      console.log(files);

      //devi anche fare in modo che i file nel database siano aggiornati con i nuovi file web

      for (const file of files) {
        const filePath = path.join(path_assoluto_archivio.path, file);

        const filebuffer = fs.readFileSync(filePath)
        const md5File = crypto.createHash('md5').update(filebuffer).digest('hex');
        const existFileMD5 = await this.olimpoService.checkFileExistFromMD5(md5File);
        if (!existFileMD5) {
          console.log("File inesistente");
          const uniqueName = `${uuidv4()}${path.extname(file)}`;

          const archiveFilePath = path.join(path_assoluto_archivio.path, uniqueName);
          await fs.promises.rename(filePath, archiveFilePath);
          const fotoFinale: FotoAttributes = {
            id: uuidv4(),
            md5: md5File,
            id_path_archivio: path_assoluto_archivio.id,
            id_path_web: path_assoluto_web.id,
            file_name: uniqueName,
            //id_formato: '58a8e168-b2c7-4e07-9d96-7ae271df8be4',
            file_name_web: uniqueName,
            file_name_web_performante: uniqueName.split(".").length > 1 ? uniqueName.split(".")[0] + ".webp" : uniqueName + ".webp"
          };
          const formData = new FormData();
          const blob = new Blob([filebuffer]);
          formData.append("file", blob, file);
          const result = await fetch(process.env.ISTANTA_IP_FOTO + "/api/convertFotoToWebFormat", {
            method: "POST",
            body: formData,
            headers: {
              "Authorization": `Bearer ${process.env.ISTANTA_AUTH_TOKEN}`
            }
          })
          const resultJson = await result.json() as {
            content: string;
            requestFile: string;
            exportFormat: string;
            error: string;
          };

          if (resultJson.error && resultJson.content == undefined) {
            res.send(resultJson.error);
            return;
          }
          if (resultJson.exportFormat != path.extname(fotoFinale.file_name_web)) {
            const extName = path.extname(fotoFinale.file_name_web);
            fotoFinale.file_name_web = fotoFinale.file_name_web.replace(extName, resultJson.exportFormat);
          }

          const finalPathTempWeb = path.join(path_assoluto_web.path, fotoFinale.file_name_web);

          await fs.promises.writeFile(finalPathTempWeb, Buffer.from(resultJson.content, 'base64'));
          const resultUpdate = await this.olimpoService.creaFotoRecord(fotoFinale as Foto);
          console.log(resultUpdate);


        } else {

          const formData = new FormData();
          const blob = new Blob([filebuffer]);
          formData.append("file", blob, file);
          const result = await fetch(process.env.ISTANTA_IP_FOTO + "/api/convertFotoToWebFormat", {
            method: "POST",
            body: formData,
            headers: {
              "Authorization": `Bearer ${process.env.ISTANTA_AUTH_TOKEN}`
            }
          })
          const resultJson = await result.json() as {
            content: string;
            requestFile: string;
            exportFormat: string;
            error: string;
          };
          if (resultJson.error && resultJson.content == undefined) {
            res.send(resultJson.error);
            return;
          }
          if (resultJson.exportFormat != path.extname(existFileMD5.file_name_web)) {
            const extName = path.extname(existFileMD5.file_name_web);
            existFileMD5.file_name_web = existFileMD5.file_name_web.replace(extName, resultJson.exportFormat);
          }

          const resultUpdate = await this.olimpoService.updateFotoRecord(existFileMD5);
          console.log(resultUpdate);
          const pathFinaleWeb = path.join(path_assoluto_web.path, existFileMD5.file_name_web);
          await fs.promises.writeFile(pathFinaleWeb, Buffer.from(resultJson.content, 'base64'));
        }
      }

    } catch (error) {
      res.send(error);
    }
  }





  private async runPythonConversion(
    filePath: string,
    outPutDir: string,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      console.log(`Converting file: ${filePath}`);
      PythonShell.run('python_image_processor/process_image.py', {
        args: [filePath, outPutDir],
        stdio: 'inherit',
        pythonOptions: ['-u'],
        mode: 'json',
      })
        .then((results) => {
          console.log(Colorize.bgBlue(`Conversione completata: ${results}`));
          resolve(results[0]);
        })
        .catch((error) => {
          console.error(
            Colorize.bgRed(`Errore durante la conversione del file: ${error}`),
          );
          reject(error);
        });
    });
  }


  private async smistamentoFile(
    path_file_dello_zip_completo: string,
    nome_archivio_file_finale: string
  ) {
    try {
      // La cartella di destinazione va garantita sempre, non solo quando il sorgente manca.
      fs.mkdirSync(path.dirname(nome_archivio_file_finale), { recursive: true });
      fs.copyFileSync(path_file_dello_zip_completo, nome_archivio_file_finale);
      fs.unlinkSync(path_file_dello_zip_completo);
    } catch (error) {
      throw new Error('Errore durante lo smistamento del file ' + error.message);
    }
  }

  // private async conversioneFile(
  //   path_file_dello_zip_completo: string,
  //   nome_archivio_file_finale: string,
  //   nome_web_file_finale: string,
  //   unique_name: string
  // ): Promise<string> {
  //   try {
  //     switch (path.extname(nome_archivio_file_finale).toLowerCase()) {
  //       case '.psd':
  //       case ".ai":
  //         const estensione = path.extname(nome_archivio_file_finale).toLowerCase();
  //         const fileBuffer = await fs.promises.readFile(nome_archivio_file_finale);
  //         try {
  //           const imagePSD = sharp(fileBuffer);
  //           const metadataPSD = await imagePSD.metadata();
  //           console.log(metadataPSD);

  //         } catch (error) {
  //           console.error(error);
  //         }
  //         //DOC questo viene fatto per convertire il file in png
  //           const outputPng = nome_archivio_file_finale.replace(estensione, ".png");
  //           let comandoConvert = `convert "${nome_archivio_file_finale}" -profile "${path.join(__dirname,"../../ICC/USWebCoatedSWOP.icc")}" -profile "${path.join(__dirname,"../../ICC/sRGB2014.icc")}" -background none -flatten "${outputPng}"`;
  //           console.log(comandoConvert);

  //         await execPromise(comandoConvert);
  //         // const filebuffer = fs.readFileSync(nome_archivio_file_finale);

  //         //BUG attenzione questo non funziona
  //         // const formData = new FormData();
  //         // const blob = new Blob([filebuffer]);
  //         // formData.append("file", blob, path.basename(nome_archivio_file_finale));
  //         // const result = await fetch(process.env.ISTANTA_IP_FOTO + "/api/convertFotoToWebFormat", {
  //         //   method: "POST",
  //         //   body: formData,
  //         //   headers: {
  //         //     "Authorization": `Bearer ${process.env.ISTANTA_AUTH_TOKEN}`
  //         //   }
  //         // })
  //         // const resultJson = await result.json() as {
  //         //   content: string;
  //         //   requestFile: string;
  //         //   exportFormat: string;
  //         //   error: string;
  //         // };
  //         // if (resultJson.error && resultJson.content == undefined) {
  //         //   return resultJson.error;
  //         // }
  //         // const file_buffer_convertito = Buffer.from(resultJson.content, 'base64');

  //         const file_buffer_convertito = await fs.promises.readFile(outputPng);

  //         let image = sharp(file_buffer_convertito);
  //         try {
  //           let file_buffer_webp = await image.webp().toBuffer();
  //           const extNamePerWebP = path.extname(nome_web_file_finale).toLowerCase();
  //           const file_path_finale_webp = nome_web_file_finale.replace(extNamePerWebP, ".webp");
  //           await fs.promises.writeFile(file_path_finale_webp, file_buffer_webp);

  //           let file_buffer_png = await image.png().toBuffer();
  //           const file_path_finale_png = nome_web_file_finale.replace(path.extname(nome_archivio_file_finale).toLowerCase(), ".png");
  //           await fs.promises.writeFile(file_path_finale_png, file_buffer_png);

  //           //fine parte web del file

  //           //ritorna solo il nome con cui è stato salvato il file
  //           const nome_file_finale = unique_name.replace(estensione, ".png");
  //           await fs.promises.rm(outputPng);
  //           return nome_file_finale;
  //         } catch (error) {
  //           const file_path_finale = nome_web_file_finale.replace(path.extname(nome_archivio_file_finale).toLowerCase(), ".png");
  //           await fs.promises.writeFile(file_path_finale, file_buffer_convertito);
  //           //fine parte web del file
  //           //ritorna solo il nome con cui è stato salvato il file
  //           const nome_file_finale = unique_name.replace(estensione, ".png");
  //           return nome_file_finale;
  //         }
  //       case '.eps':
  //         await this.runPythonConversion(path_file_dello_zip_completo, nome_web_file_finale);
  //         //adesso che il file è stato convertito, cambio il tipo di file e lo metto a .webp
  //         const file_buffer_webp = await fs.promises.readFile(nome_web_file_finale);
  //         const image_eps_webp = sharp(file_buffer_webp);
  //         await image_eps_webp.webp().toFile(nome_web_file_finale.replace('.eps', '.webp'));
  //         return unique_name.replace('.eps', '.webp');
  //       default:
  //         fs.copyFileSync(nome_archivio_file_finale, nome_web_file_finale);
  //         // anche qui andra attuata la conversione in webp
  //         const buffer = await fs.promises.readFile(nome_archivio_file_finale);
  //         const image_normal = sharp(buffer);
  //         const metadata = await image_normal.metadata();
  //         if (!['jpeg', 'png', 'webp', 'tiff', 'gif', "jpg"].includes(metadata.format)) {
  //           throw new Error(`Formato immagine non supportato: ${metadata.format}`);
  //         }
  //         const file_convertito = await image_normal.webp().toBuffer();
  //         const file_path_finale = nome_web_file_finale.replace(path.extname(nome_archivio_file_finale).toLowerCase(), ".webp");
  //         await fs.promises.writeFile(file_path_finale, file_convertito);

  //         return unique_name;

  //     }
  //   } catch (error: any) {
  //     throw new Error('Errore durante la conversione del file ' + error.message);
  //   }
  // }

  @Get("conversioneForzataFoto")
  async conversioneForzataFoto(
    @Req() req: FastifyRequest<{ Querystring: { id: string } }>,
    @Res() res: FastifyReply
  ): Promise<void> {
    try {
      const id = req.query.id;
      const foto = await this.olimpoService.getFotoFromId(id);
      const path_archivio_db = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO);

      const path_file = path.join(path_archivio_db.path, foto.file_name);
      const bufferFoto = fs.readFileSync(path_file);
      const formData = new FormData();
      const blob = new Blob([bufferFoto]);
      formData.append("file", blob, foto.file_name);
      const chiamataFotoGate = await fetch(process.env.ISTANTA_IP_FOTO + "/api/convertFotoToWebFormat", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${process.env.ISTANTA_AUTH_TOKEN}`
        }
      })
      const result = await chiamataFotoGate.json() as {
        content: string;
        requestFile: string;
        exportFormat: string;
        error: string;
      };
      if (result.error && result.content == undefined) {
        res.send(result.error);
        return;
      }
      if (result.exportFormat != path.extname(foto.file_name_web)) {
        const extName = path.extname(foto.file_name_web);
        foto.file_name_web = foto.file_name_web.replace(extName, result.exportFormat);
      }
      const buffer = Buffer.from(result.content, 'base64');
      const path_finale = path.join(__dirname, `../../${foto.file_name_web}`);
      await fs.promises.writeFile(path_finale, buffer);
    } catch (error) {
      console.log(error);
      res.send(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Get('convertFotoToWebpLocale')
  async convertFotoToWebpLocale(
    @Res() res: FastifyReply
  ): Promise<void> {
    try {
      const webpath = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
      const files = fs.readdirSync(webpath.path);

      for (const file of files) {
        if (path.extname(file).toLowerCase() === ".webp") {
          console.log(`File già in formato webp: ${file}`);
          continue;
        }
        const finalPath = path.resolve(webpath.path, file);
        const getFotoFromPath = await this.olimpoService.getFotoFromNomeFileEWebPathid(file, webpath.id);
        console.log(Colorize.bgRed(`File: ${file}`));
        if (getFotoFromPath == null) {
          console.log(`File non trovato: ${file}`);
          continue;
        }
        if (!['jpeg', 'png', 'webp', 'tiff', 'gif', 'jpg'].includes(path.extname(file).toLowerCase().replace('.', ''))) {
          console.log(`Formato immagine non supportato: ${path.extname(file).toLowerCase()}`);
          continue
        }
        try {
          const file_buffer = await fs.promises.readFile(finalPath);

          const image = sharp(file_buffer);
          const metadata = await image.metadata();
          if (!['jpeg', 'png', 'webp', 'tiff', 'gif', "jpg"].includes(metadata.format)) {
            console.log(`Formato immagine non supportato: ${metadata.format}`);
            continue;
          }
          const fileConvertito = await image.webp().toBuffer();
          const file_path_finale = finalPath.replace(path.extname(file).toLowerCase(), ".webp");
          const fotoModificata: FotoAttributes = {
            id: getFotoFromPath.id,
            file_name_web: file,
            md5: getFotoFromPath.md5,
            id_path_archivio: getFotoFromPath.id_path_archivio,
            id_path_web: getFotoFromPath.id_path_web,
            file_name: getFotoFromPath.file_name,
            // id_formato: getFotoFromPath.id_formato,
            file_name_web_performante: file.replace(path.extname(file).toLowerCase(), ".webp")
          }
          await this.olimpoService.updateFotoRecord(fotoModificata);
          await fs.promises.writeFile(file_path_finale, fileConvertito);
          await fs.promises.unlink(finalPath);
          console.log(`File convertito con successo: ${file}`);
        } catch (error) {
          console.log(error);
          continue;
        }
      }
      res.send("Tutti i file sono stati convertiti con successo");
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Get('convertFotoToPngFromWebpLocale')
  async convertFotoToPngFromWebpLocale(@Res() res: FastifyReply): Promise<void> {
    try {
      const webpath = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
      const files = fs.readdirSync(webpath.path);

      for (const file of files) {
        if (path.extname(file).toLowerCase() === ".png") {
          console.log(`File già in formato png: ${file}`);
          continue;
        }
        const finalPath = path.resolve(webpath.path, file);
        const getFotoFromPath = await this.olimpoService.getFotoFromNomeFileEWebPathid(file, webpath.id);
        console.log(Colorize.bgRed(`File: ${file}`));
        if (getFotoFromPath == null) {
          console.log(`File non trovato: ${file}`);
          continue;
        }
        if (!['jpeg', 'png', 'webp', 'tiff', 'gif', 'jpg'].includes(path.extname(file).toLowerCase().replace('.', ''))) {
          console.log(`Formato immagine non supportato: ${path.extname(file).toLowerCase()}`);
          continue
        }
        try {
          const file_buffer = await fs.promises.readFile(finalPath);

          const image = sharp(file_buffer);
          const metadata = await image.metadata();
          if (!['jpeg', 'png', 'webp', 'tiff', 'gif', "jpg"].includes(metadata.format)) {
            console.log(`Formato immagine non supportato: ${metadata.format}`);
            continue;
          }
          const fileConvertito = await image.png().toBuffer();
          const file_path_finale = finalPath.replace(path.extname(file).toLowerCase(), ".png");
          const fotoModificata: FotoAttributes = {
            id: getFotoFromPath.id,
            file_name_web: file.replace(path.extname(file).toLowerCase(), ".png"),
            md5: getFotoFromPath.md5,
            id_path_archivio: getFotoFromPath.id_path_archivio,
            id_path_web: getFotoFromPath.id_path_web,
            file_name: getFotoFromPath.file_name,
            // id_formato: getFotoFromPath.id_formato,
            file_name_web_performante: null
          }
          await this.olimpoService.updateFotoRecord(fotoModificata);
          await fs.promises.writeFile(file_path_finale, fileConvertito);
          await fs.promises.unlink(finalPath);
          console.log(`File convertito con successo: ${file}`);
        } catch (error) {
          console.log(error);
          continue;
        }
      }
      res.send("Tutti i file sono stati convertiti con successo");

    }
    catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Get('convertFotoToWebpDoppioni')
  async convertFotoToWebpDoppioni(@Res() res: FastifyReply): Promise<void> {
    try {
      const webpath = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
      const files = fs.readdirSync(webpath.path);
      let index = 0;
      for (const file of files) {
        //PER OGNI FILE PNG CREO UNA COPIA IN WEBP
        if (path.extname(file).toLowerCase() === ".webp") {
          console.log(`File già in formato webp: ${file}`);
          continue;
        }

        const finalPath = path.resolve(webpath.path, file);
        const getFotoFromPath = await this.olimpoService.getFotoFromNomeFileEWebPathid(file, webpath.id);
        console.log(Colorize.bgBlue(`File: ${file}`));
        if (getFotoFromPath == null) {
          console.log(`File non trovato: ${file}`);
          continue;
        }

        if (!['jpeg', 'png', 'webp', 'tiff', 'gif', 'jpg'].includes(path.extname(file).toLowerCase().replace('.', ''))) {
          console.log(`Formato immagine non supportato: ${path.extname(file).toLowerCase()}`);
          continue
        }

        try {
          const file_buffer = await fs.promises.readFile(finalPath);
          const image = sharp(file_buffer);
          const metadata = await image.metadata();
          if (!['jpeg', 'png', 'webp', 'tiff', 'gif', "jpg"].includes(metadata.format)) {
            console.log(`Formato immagine non supportato: ${metadata.format}`);
            continue;
          }
          const fileConvertito = await image.webp().toBuffer();
          const file_path_finale = finalPath.replace(path.extname(file).toLowerCase(), ".webp");
          //adesso questa e la parte delicata, qui creaiamo una copia del file in webp e lo associamo alla colonna file_name_web_performante

          const fotoModificata: FotoAttributes = {
            id: getFotoFromPath.id,
            file_name_web: file,
            md5: getFotoFromPath.md5,
            id_path_archivio: getFotoFromPath.id_path_archivio,
            id_path_web: getFotoFromPath.id_path_web,
            file_name: getFotoFromPath.file_name,
            // id_formato: getFotoFromPath.id_formato,
            file_name_web_performante: file.replace(path.extname(file).toLowerCase(), ".webp")
          }
          await fs.promises.writeFile(file_path_finale, fileConvertito);
          await this.olimpoService.updateFotoRecord(fotoModificata);
          index++;
          console.log(Colorize.bgBlue(`File convertito con successo: ${file} in ${file_path_finale}`));
        }

        catch (error) {
          console.log(error);
          continue;
        }
        res.status(HttpStatus.OK).send(`Tutti i file sono stati convertiti con successo. ${index} file convertiti`);
      }

    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }


  @Get('conversioneCorrettaPerIlWeb')
  async conversioneCorrettaPerIlWeb(@Res() res: FastifyReply): Promise<void> {
    // Imposta gli header per SSE
    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    // Invia una riga vuota per inizializzare il flusso
    res.raw.write('\n');

    try {
      const allFoto = await this.olimpoService.getAllFoto();
      const webPath = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.WEB);
      const archivioPath = await this.olimpoService.getAbsolutePathFromType(ABSOLUTE_PATH_TYPE.ARCHIVIO);
      let index = 0;
      const threshold = 10; // Se necessario, puoi utilizzare la soglia

      for (const foto of allFoto) {
        if (path.extname(foto.file_name) === ".psd" || path.extname(foto.file_name) === ".ai") {
          const pathFoto = path.join(webPath.path, foto.file_name_web);
          const pathArchivio = path.join(archivioPath.path, foto.file_name);
          const nomeFileNuovo = uuidv4() + ".png";
          const nomeFileNuovoWebp = nomeFileNuovo.replace(".png", ".webp");
          const pathFotoNuovo = path.join(webPath.path, nomeFileNuovo);

          res.raw.write(`data: Eliminazione del file: ${pathFoto}\n\n`);
          try {
            await fs.promises.unlink(pathFoto);
            await fs.promises.unlink(pathFoto.replace(".png", ".webp"));
          } catch (error) {
            res.raw.write(`data: Errore durante l'eliminazione del file: ${pathFoto} - ${foto.id}\n\n`);
          }

          res.raw.write(`data: Conversione del file: ${pathArchivio}\n\n`);
          try {
            await ConversionService.conversioneFile(pathArchivio, pathArchivio, pathFotoNuovo, nomeFileNuovo);
          } catch (error) {
            res.raw.write(`data: Errore durante la conversione del file: ${pathArchivio}\n\n`);
            continue; // Passa al prossimo file
          }

          const fotoModificata: FotoAttributes = {
            id: foto.id,
            file_name_web: nomeFileNuovo,
            file_name_web_performante: nomeFileNuovoWebp,
            md5: foto.md5,
            id_path_archivio: foto.id_path_archivio,
            id_path_web: foto.id_path_web,
            file_name: foto.file_name,
            // id_formato: foto.id_formato
          };

          res.raw.write(`data: Aggiornamento del record nel database per il file: ${foto.file_name}\n\n`);
          await this.olimpoService.updateFotoRecord(fotoModificata);

          index++;
          res.raw.write(`data: File convertito con successo: ${foto.file_name}\n\n`);

          // Se vuoi forzare una soglia, decommenta le seguenti righe:
          // if (index >= threshold) {
          //   res.raw.write(`data: Threshold of ${threshold} reached. Stopping the conversion process.\n\n`);
          //   break;
          // }
        }
      }

      res.raw.write(`data: Tutti i file sono stati convertiti con successo. ${index} file convertiti\n\n`);
      res.raw.end();
    } catch (error) {
      res.raw.write(`data: Errore: ${error}\n\n`);
      res.raw.end();
    }
  }



  @Get('ping')
  async ping(
    @Res() res: FastifyReply
  ): Promise<void> {
    res.send("pong");
  }
}
const NEVER_ACCEPTED_EXTENSIONS = new Set([
  // Eseguibili / installer / link
  ".exe", ".msi", ".com", ".scr", ".pif", ".cpl", ".lnk", ".reg",
  // Script & codice sorgente / bytecode
  ".bat", ".cmd", ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".vbs", ".vbe",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".coffee",
  ".py", ".pyc", ".pyo", ".rb", ".pl", ".php", ".jar", ".war", ".ear",
  ".class", ".scala", ".go", ".rs", ".c", ".cpp", ".h", ".hpp",
  // Librerie/binari di sistema
  ".dll", ".sys", ".drv", ".so", ".dylib", ".o", ".a", ".lib",
  // Immagini disco / macchine virtuali
  ".iso", ".img", ".dmg", ".vhd", ".vhdx", ".vmdk",
  // Archivi e compressi
  ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz", ".tbz", ".txz",
  // Documenti / testuali generici (non immagini)
  ".pdf", ".doc", ".docx", ".dotx", ".rtf", ".odt", ".ott",
  ".xls", ".xlsx", ".ods", ".csv", ".tsv",
  ".ppt", ".pptx", ".odp", ".md", ".txt", ".log",
  // Audio
  ".mp3", ".wav", ".flac", ".aac", ".ogg", ".oga", ".m4a", ".aiff",
  // Video (l’API è solo foto, niente video)
  ".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".wmv", ".mts", ".m2ts",
  // Pacchetti mobile
  ".apk", ".ipa", ".xap",
  // Varie potenzialmente pericolose/irrilevanti
  ".crt", ".pem", ".key", ".pcap", ".saz", ".sqlite", ".db", ".bak"
]);
const NEVER_ACCEPTED_FILENAMES = new Set([
  ".ds_store",        // macOS
  "thumbs.db",        // Windows
  "desktop.ini"       // Windows
]);

const looksLikeResourceFork = (base: string) => base.startsWith("._"); // macOS resource fork
const hasDangerousDoubleExtension = (fileName: string) => {
  // Esempi da bloccare: "foto.jpg.exe", "cover.png.sh", "x.tiff.js"
  const lower = fileName.toLowerCase();
  for (const ext of NEVER_ACCEPTED_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      // se il nome contiene un'altra estensione "immagine" prima di quella pericolosa → è una doppia estensione
      const withoutDanger = lower.slice(0, -ext.length);
      if (/\.[a-z0-9]{1,6}$/.test(withoutDanger)) return true;
    }
  }
  return false;
};

/**
 * Ritorna true SOLO se il file è un'immagine consentita e non ricade nei blocchi "mai accettati".
 * (Preferibile alla sola denylist)
 */
export const isAcceptedPhotoFile = (fileName: string): boolean => {
  const base = path.basename(fileName);
  const ext = path.extname(base).toLowerCase();

  // Blocca nomi di sistema e resource fork
  if (NEVER_ACCEPTED_FILENAMES.has(base.toLowerCase())) return false;
  if (looksLikeResourceFork(base)) return false;

  // Blocca estensioni mai accettate
  if (NEVER_ACCEPTED_EXTENSIONS.has(ext)) return false;

  // Blocca doppie estensioni pericolose (es. .jpg.exe)
  if (hasDangerousDoubleExtension(base)) return false;

  // **Whitelist** immagini
  return true;
};

/**
 * Versione solo con denylist (mantiene compatibilità col tuo nome funzione).
 * Restituisce true se l’estensione NON è nella lista nera e non è DS_Store / resource fork
 * (meno sicura della whitelist, ma utile se vuoi solo estendere il tuo controllo iniziale).
 */
export const isAcceptedFileOrFileExtension = (fileName: string): boolean => {
  const base = path.basename(fileName);
  const ext = path.extname(base).toLowerCase();

  if (NEVER_ACCEPTED_FILENAMES.has(base.toLowerCase())) return false;
  if (looksLikeResourceFork(base)) return false;

  if (NEVER_ACCEPTED_EXTENSIONS.has(ext)) return false;

  if (hasDangerousDoubleExtension(base)) return false;

  // Se vuoi forzare SOLO immagini, decommenta:
  // return ALLOWED_IMAGE_EXTENSIONS.has(ext);

  return true;
};
