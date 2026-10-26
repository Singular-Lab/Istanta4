import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import ConversionService from '@lib/ConversionService';
import { Sequelize } from 'sequelize-typescript';
import { OlimpoController } from '../app.controller';
import { AbsolutePaths } from '../models/absolute_path.model';
import { Foto } from '../models/foto.model';

/*
 * Contratto di upload per i .ai e regressione degli altri formati.
 * Un .ai valido senza anteprima viene archiviato con il suo GUID; un .ai non
 * valido viene rifiutato senza record e senza copia in archivio. I client
 * (Istanta, Fidelity, Correggo4) leggono record.Id ed error: il campo
 * conversione e' solo aggiunto.
 */
const FIXTURE = path.resolve(__dirname, '../../test/fixtures/ai');

describe('ConversionService: regressione degli altri formati', () => {
  let cartella: string;

  beforeEach(async () => {
    cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-conv-test-'));
    await fs.promises.mkdir(path.join(cartella, 'archivio'));
    await fs.promises.mkdir(path.join(cartella, 'web'));
  });

  afterEach(async () => {
    await fs.promises.rm(cartella, { recursive: true, force: true });
  });

  async function immagine(nome: string, formato: 'png' | 'jpeg' | 'tiff'): Promise<string> {
    const file = path.join(cartella, 'archivio', nome);
    await sharp({ create: { width: 20, height: 10, channels: 3, background: { r: 200, g: 10, b: 10 } } })
      .toFormat(formato)
      .toFile(file);
    return file;
  }

  it.each([
    ['foto.png', 'png'],
    ['foto.jpg', 'jpeg'],
    ['foto.tif', 'tiff'],
  ] as const)('%s: copia il file nella cartella web e genera il WebP come prima', async (nome, formato) => {
    const archivio = await immagine(nome, formato);
    const web = path.join(cartella, 'web', nome);

    const nomeFile = await ConversionService.conversioneFile(archivio, archivio, web, nome);
    const esito = await ConversionService.conversioneFileConEsito(archivio, archivio, web, nome);

    expect(nomeFile).toBe(nome);
    expect(esito.stato).toBe('completed');
    expect(esito.nomeFile).toBe(nome);
    expect(fs.existsSync(web)).toBe(true);
    const webp = web.replace(path.extname(web), '.webp');
    expect((await sharp(webp).metadata()).format).toBe('webp');
  });

  it('un .ai che contiene un PNG resta convertito con Sharp come prima', async () => {
    const archivio = await immagine('logo.ai', 'png');
    const web = path.join(cartella, 'web', 'logo.ai');

    const esito = await ConversionService.conversioneFileConEsito(archivio, archivio, web, 'logo.ai');

    expect(esito.stato).toBe('completed');
    expect(esito.nomeFile).toBe('logo.png');
    expect(fs.existsSync(path.join(cartella, 'web', 'logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(cartella, 'web', 'logo.webp'))).toBe(true);
  });

  it('conversioneFile su un .ai PDF-compatible restituisce il PNG senza passare da ImageMagick', async () => {
    const archivio = path.join(cartella, 'archivio', 'logo.ai');
    await fs.promises.copyFile(path.join(FIXTURE, 'vettoriale-cmyk.ai'), archivio);
    const web = path.join(cartella, 'web', 'logo.ai');

    const nomeFile = await ConversionService.conversioneFile(archivio, archivio, web, 'logo.ai');

    expect(nomeFile).toBe('logo.png');
    expect((await sharp(path.join(cartella, 'web', 'logo.png')).metadata()).format).toBe('png');
  });

  it('conversioneFile mantiene il contratto: eccezione se un .ai non ha anteprima', async () => {
    const archivio = path.join(cartella, 'archivio', 'logo.ai');
    await fs.promises.copyFile(path.join(FIXTURE, 'proprietario.ai'), archivio);

    await expect(ConversionService.conversioneFile(archivio, archivio, path.join(cartella, 'web', 'logo.ai'), 'logo.ai'))
      .rejects.toThrow('unsupported_format');
  });
});

describe('OlimpoController.uploadSingoloFileFotoInArchivio con file .ai', () => {
  let sequelize: Sequelize;
  let cartella: string;
  let creaFotoRecord: jest.Mock;
  let controller: OlimpoController;

  beforeAll(() => {
    // Il controller istanzia Foto: il modello va registrato, ma il database non
    // viene mai contattato (creaFotoRecord e' simulato).
    sequelize = new Sequelize({ dialect: 'postgres', models: [AbsolutePaths, Foto], logging: false });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-upload-test-'));
    const archivio = { id: 'archivio', path: path.join(cartella, 'archivio') };
    const web = { id: 'web', path: path.join(cartella, 'web') };
    await fs.promises.mkdir(archivio.path);
    await fs.promises.mkdir(web.path);
    creaFotoRecord = jest.fn(async (foto) => foto);
    const servizio = {
      getAbsolutePathFromType: jest.fn(async (tipo: string) => (tipo === 'ARCHIVIO' ? archivio : web)),
      checkFileExistFromMD5: jest.fn(async () => null),
      creaFotoRecord,
    };
    controller = new OlimpoController(servizio as any);
    await controller.init();
    // percorsi fissati qui: non dipendono dai valori dell'enum
    (controller as any).PATH_ARCHIVIO_ASSOLUTO = archivio;
    (controller as any).PATH_WEB_ASSOLUTO = web;
  });

  afterEach(async () => {
    await fs.promises.rm(cartella, { recursive: true, force: true });
  });

  async function carica(nomeFixture: string) {
    const buffer = await fs.promises.readFile(path.join(FIXTURE, nomeFixture));
    const req: any = {
      body: {
        file: { filename: 'logo CASA.ai', mimetype: 'application/postscript', fieldname: 'file', encoding: '7bit', toBuffer: async () => buffer },
        json_meta_foto: { value: { Id: '0', FileHash: '', FileName: 'logo CASA.ai', IdRef: '', Size: 0 } },
      },
    };
    const res: any = {
      codice: 200,
      corpo: undefined,
      status(codice: number) { this.codice = codice; return this; },
      send(corpo: unknown) { this.corpo = corpo; return this; },
    };
    await controller.uploadSingoloFileFotoInArchivio(req, res);
    return res;
  }

  it('archivia un .ai PDF-compatible con anteprima e spazi colore distinti', async () => {
    const res = await carica('vettoriale-cmyk.ai');

    expect(res.codice).toBe(200);
    expect(res.corpo.error).toBe('');
    expect(res.corpo.record.Id).toBe(creaFotoRecord.mock.calls[0][0].id);
    expect(res.corpo.conversione).toMatchObject({ stato: 'completed', colorspaceOriginale: 'cmyk', colorspaceAnteprima: 'srgb', pagine: 1 });
    const foto = creaFotoRecord.mock.calls[0][0];
    expect(path.extname(foto.file_name)).toBe('.ai');
    expect(path.extname(foto.file_name_web)).toBe('.png');
    expect(path.extname(foto.file_name_web_performante)).toBe('.webp');
    expect(fs.existsSync(path.join(cartella, 'archivio', foto.file_name))).toBe(true);
  });

  it('archivia un .ai valido anche quando l\'anteprima non e\' disponibile', async () => {
    const res = await carica('proprietario.ai');

    expect(res.codice).toBe(200);
    expect(res.corpo.error).toBe('');
    expect(creaFotoRecord).toHaveBeenCalledTimes(1);
    const foto = creaFotoRecord.mock.calls[0][0];
    expect(res.corpo.record.Id).toBe(foto.id);
    expect(foto.file_name_web).toBe('');
    expect(foto.file_name_web_performante).toBe('');
    expect(res.corpo.conversione).toMatchObject({ stato: 'unsupported_format', motivo: 'formato_illustrator_non_riconosciuto', colorspaceOriginale: null });
    // l'originale resta in archivio, identico al file caricato
    const archiviato = await fs.promises.readFile(path.join(cartella, 'archivio', foto.file_name));
    expect(archiviato.equals(await fs.promises.readFile(path.join(FIXTURE, 'proprietario.ai')))).toBe(true);
  });

  it('rifiuta un .ai non valido senza record e senza file in archivio', async () => {
    const res = await carica('troncato.ai');

    expect(res.codice).toBe(422);
    expect(res.corpo.error).toContain('pdf_incompleto');
    expect(res.corpo.record.Id).toBe('0');
    expect(creaFotoRecord).not.toHaveBeenCalled();
    expect(await fs.promises.readdir(path.join(cartella, 'archivio'))).toEqual([]);
    expect(await fs.promises.readdir(path.join(cartella, 'web'))).toEqual([]);
  });
});
