import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import {
  ConfigurazioneIllustrator,
  convertiIllustrator,
  ErroreProcesso,
  EseguiProcesso,
  eseguiProcesso,
  leggiOutputPdfinfo,
  riconosciContenutoIllustrator,
  sintesiColorspace,
} from '@lib/illustrator';

/*
 * Un .ai PDF-compatible (Illustrator 27.2, %PDF-1.6) faceva fallire l'upload:
 * ConversionService chiedeva il colorspace a ImageMagick, la cui policy blocca
 * la lettura dei PDF. Questi test usano i convertitori reali (pdfinfo,
 * pdftocairo, pdftotext, Ghostscript, pikepdf) sulle fixture sintetiche di
 * test/fixtures/ai, rigenerabili con genera-fixture.sh.
 */
const FIXTURE = path.resolve(__dirname, '../../test/fixtures/ai');

const CONFIG: ConfigurazioneIllustrator = {
  dpi: 300,
  latoMassimoPx: 4096,
  timeoutMs: 30000,
  memoriaMassimaMb: 1024,
  dimensioneMassimaByte: 50 * 1024 * 1024,
  pagineMassimeAnalisi: 20,
  oggettiMassimiAnalisi: 200000,
};

const nessunLog = () => undefined;

describe('convertiIllustrator', () => {
  let tmpOriginale: string | undefined;
  let tmpTest: string;
  let cartellaWeb: string;

  beforeEach(async () => {
    // Cartella temporanea dedicata: serve a verificare che non restino file di lavoro.
    tmpOriginale = process.env.TMPDIR;
    tmpTest = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-ai-test-'));
    cartellaWeb = path.join(tmpTest, 'web');
    await fs.promises.mkdir(cartellaWeb);
    process.env.TMPDIR = path.join(tmpTest, 'lavoro');
    await fs.promises.mkdir(process.env.TMPDIR);
  });

  afterEach(async () => {
    if (tmpOriginale === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = tmpOriginale;
    await fs.promises.rm(tmpTest, { recursive: true, force: true });
  });

  /** Copia la fixture come "archivio" e converte, come fa l'upload. */
  async function converti(nomeFixture: string, esegui?: EseguiProcesso, configurazione: ConfigurazioneIllustrator = CONFIG) {
    const originale = path.join(tmpTest, nomeFixture);
    await fs.promises.copyFile(path.join(FIXTURE, nomeFixture), originale);
    const prima = await fs.promises.readFile(originale);
    const file = {
      originale,
      outputPng: path.join(cartellaWeb, 'anteprima.png'),
      outputWebp: path.join(cartellaWeb, 'anteprima.webp'),
      nomeAnteprima: 'anteprima.png',
    };
    const esito = await convertiIllustrator(file, { configurazione, log: nessunLog, ...(esegui ? { esegui } : {}) });
    const dopo = await fs.promises.readFile(originale);
    return { esito, file, originaleInvariato: prima.equals(dopo) };
  }

  async function residuiDiLavoro(): Promise<string[]> {
    return fs.promises.readdir(process.env.TMPDIR as string);
  }

  it('riconosce un .ai PDF-compatible e genera l\'anteprima della prima pagina', async () => {
    const { esito, file, originaleInvariato } = await converti('vettoriale-cmyk.ai');

    expect(esito.stato).toBe('completed');
    expect(esito.formato).toBe('pdf');
    expect(esito.nomeFile).toBe('anteprima.png');
    expect(esito.pagine).toBe(1);
    // 200 x 100 pt a 300 dpi = 833 x 417 px circa
    const meta = await sharp(file.outputPng).metadata();
    expect(meta.format).toBe('png');
    expect(Math.abs(meta.width - 833)).toBeLessThanOrEqual(2);
    expect(Math.abs(meta.height - 417)).toBeLessThanOrEqual(2);
    expect(meta.hasAlpha).toBe(true);
    expect((await sharp(file.outputWebp).metadata()).format).toBe('webp');
    expect(originaleInvariato).toBe(true);
    expect(await residuiDiLavoro()).toEqual([]);
  });

  it('legge lo spazio colore del documento vettoriale dai content stream compressi', async () => {
    const { esito } = await converti('vettoriale-cmyk.ai');

    expect(esito.colorspaceOriginale).toBe('cmyk');
    expect(esito.colorspaceDettaglio?.fonte).toBe('pdf');
    expect(esito.colorspaceDettaglio?.processo).toContain('cmyk');
    expect(esito.colorspaceDettaglio?.spazi).toContain('Separation');
    expect(esito.colorspaceDettaglio?.tinte).toContain('PANTONE 485 C');
  });

  it('distingue lo spazio colore dell\'anteprima (sRGB) da quello del documento (CMYK)', async () => {
    const { esito } = await converti('vettoriale-cmyk.ai');

    expect(esito.colorspaceAnteprima).toBe('srgb');
    expect(esito.colorspaceOriginale).toBe('cmyk');
  });

  it('riconosce lo spazio colore di un\'immagine raster incorporata', async () => {
    const { esito } = await converti('raster-rgb.ai');

    expect(esito.stato).toBe('completed');
    expect(esito.colorspaceDettaglio?.processo).toEqual(['rgb']);
    expect(esito.colorspaceOriginale).toBe('rgb');
  });

  it('su un PDF di piu\' pagine genera l\'anteprima della prima e segnala il numero di pagine', async () => {
    const { esito, file } = await converti('multipagina.ai');

    expect(esito.stato).toBe('completed');
    expect(esito.pagine).toBe(3);
    // la prima pagina e' rossa
    const { data } = await sharp(file.outputPng).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
    const meta = await sharp(file.outputPng).metadata();
    const centro = (Math.floor(meta.height / 2) * meta.width + Math.floor(meta.width / 2)) * 3;
    expect([data[centro], data[centro + 1], data[centro + 2]]).toEqual([255, 0, 0]);
  });

  it('converte un .ai legacy PostScript con Ghostscript e legge i colori dai commenti DSC', async () => {
    const { esito, file, originaleInvariato } = await converti('legacy-postscript.ai');

    expect(esito.stato).toBe('completed');
    expect(esito.formato).toBe('postscript');
    expect(fs.existsSync(file.outputPng)).toBe(true);
    expect(esito.colorspaceOriginale).toBe('cmyk');
    expect(esito.colorspaceDettaglio?.fonte).toBe('dsc');
    expect(esito.colorspaceDettaglio?.tinte).toEqual(['PANTONE 485 C']);
    expect(originaleInvariato).toBe(true);
    expect(await residuiDiLavoro()).toEqual([]);
  });

  it('segnala come non supportato un .ai senza rappresentazione interpretabile, senza dichiararlo corrotto', async () => {
    const { esito, file } = await converti('proprietario.ai');

    expect(esito.stato).toBe('unsupported_format');
    expect(esito.motivo).toBe('formato_illustrator_non_riconosciuto');
    expect(esito.nomeFile).toBeNull();
    expect(esito.colorspaceOriginale).toBeNull();
    expect(fs.existsSync(file.outputPng)).toBe(false);
  });

  it('segnala come non supportato un .ai salvato senza contenuto PDF', async () => {
    const { esito } = await converti('senza-contenuto-pdf.ai');

    expect(esito.stato).toBe('unsupported_format');
    expect(esito.motivo).toBe('ai_senza_contenuto_pdf');
    expect(esito.nomeFile).toBeNull();
  });

  it('rifiuta come non valido un .ai PDF troncato', async () => {
    const { esito } = await converti('troncato.ai');

    expect(esito.stato).toBe('invalid_file');
    expect(esito.motivo).toBe('pdf_incompleto');
    expect(esito.nomeFile).toBeNull();
  });

  it('rifiuta come non valido un file .ai che contiene uno zip', async () => {
    const { esito } = await converti('incoerente.ai');

    expect(esito.stato).toBe('invalid_file');
    expect(esito.motivo).toBe('contenuto_incoerente_zip');
  });

  it('segnala come non supportato un PDF protetto da password', async () => {
    const { esito } = await converti('cifrato.ai');

    expect(esito.stato).toBe('unsupported_format');
    expect(esito.motivo).toBe('pdf_protetto_da_password');
    expect(esito.nomeFile).toBeNull();
  });

  it('con un convertitore in timeout lascia l\'anteprima non disponibile e pulisce i temporanei', async () => {
    const esegui: EseguiProcesso = async (comando, args, opzioni) => {
      if (comando === 'pdftocairo') {
        throw new ErroreProcesso('pdftocairo interrotto per timeout', true, null, '');
      }
      return eseguiProcesso(comando, args, opzioni);
    };

    const { esito, file, originaleInvariato } = await converti('vettoriale-cmyk.ai', esegui);

    expect(esito.stato).toBe('conversion_failed');
    expect(esito.motivo).toBe('pdftocairo_timeout');
    expect(esito.nomeFile).toBeNull();
    // il documento resta descritto anche senza anteprima
    expect(esito.pagine).toBe(1);
    expect(esito.colorspaceOriginale).toBe('cmyk');
    expect(fs.existsSync(file.outputPng)).toBe(false);
    expect(originaleInvariato).toBe(true);
    expect(await residuiDiLavoro()).toEqual([]);
  });

  it('pulisce i temporanei anche quando un convertitore lancia un errore inatteso', async () => {
    const esegui: EseguiProcesso = async () => {
      throw new Error('errore inatteso');
    };

    const { esito, originaleInvariato } = await converti('vettoriale-cmyk.ai', esegui);

    // un convertitore che non parte non rende il file non valido
    expect(esito.stato).toBe('conversion_failed');
    expect(esito.motivo).toBe('pdfinfo_non_eseguibile');
    expect(originaleInvariato).toBe(true);
    expect(await residuiDiLavoro()).toEqual([]);
  });

  it('limita il lato dell\'anteprima', async () => {
    const { esito, file } = await converti('vettoriale-cmyk.ai', undefined, { ...CONFIG, latoMassimoPx: 400 });

    expect(esito.stato).toBe('completed');
    const meta = await sharp(file.outputPng).metadata();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(400);
  });

  it('non converte i file oltre la dimensione massima ma li considera validi', async () => {
    const { esito } = await converti('vettoriale-cmyk.ai', undefined, { ...CONFIG, dimensioneMassimaByte: 100 });

    expect(esito.stato).toBe('preview_unavailable');
    expect(esito.motivo).toBe('file_troppo_grande');
  });
});

describe('eseguiProcesso', () => {
  it('termina un processo che supera il timeout', async () => {
    const inizio = Date.now();
    const errore = await eseguiProcesso(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { timeoutMs: 300, memoriaMassimaMb: 1024 })
      .catch((e) => e);

    expect(errore).toBeInstanceOf(ErroreProcesso);
    expect(errore.timeout).toBe(true);
    expect(Date.now() - inizio).toBeLessThan(5000);
  });

  it('passa gli argomenti senza shell', async () => {
    const cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-ai-shell-'));
    try {
      const segnale = path.join(cartella, 'iniettato');
      const { stdout } = await eseguiProcesso(
        process.execPath,
        ['-e', 'process.stdout.write(process.argv[1])', `x"; touch ${segnale}; echo "`],
        { timeoutMs: 5000, memoriaMassimaMb: 1024 },
      );

      expect(stdout).toBe(`x"; touch ${segnale}; echo "`);
      expect(fs.existsSync(segnale)).toBe(false);
    } finally {
      await fs.promises.rm(cartella, { recursive: true, force: true });
    }
  });
});

describe('riconosciContenutoIllustrator', () => {
  const coda = Buffer.from('\nstartxref\n123\n%%EOF\n');

  it('riconosce l\'intestazione PDF anche dopo byte iniziali', () => {
    expect(riconosciContenutoIllustrator(Buffer.from('\x00\x00%PDF-1.6\n'), coda).contenuto).toBe('pdf');
  });

  it('non usa l\'estensione: un PNG e\' raster', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(riconosciContenutoIllustrator(png, png).contenuto).toBe('raster');
  });

  it('riconosce il PostScript e il creatore Illustrator', () => {
    const ps = Buffer.from('%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator(R) 8.0\n');
    expect(riconosciContenutoIllustrator(ps, ps)).toEqual({ contenuto: 'postscript', motivo: null, creatoreIllustrator: true });
  });

  it('non assume che ogni PostScript sia Illustrator', () => {
    const ps = Buffer.from('%!PS-Adobe-3.0\n%%Creator: dvips\n');
    expect(riconosciContenutoIllustrator(ps, ps).creatoreIllustrator).toBe(false);
  });

  it('considera non valido un file vuoto', () => {
    expect(riconosciContenutoIllustrator(Buffer.alloc(0), Buffer.alloc(0)).contenuto).toBe('invalid');
  });
});

describe('leggiOutputPdfinfo', () => {
  it('legge pagine, cifratura e dimensione della pagina', () => {
    const out = 'Creator:         Adobe Illustrator 27.2\nEncrypted:       yes (print:yes copy:no)\nPage size:       595.276 x 841.89 pts (A4)\nPages:           2\n';
    expect(leggiOutputPdfinfo(out)).toEqual({ pagine: 2, cifrato: true, larghezzaPt: 595.276, altezzaPt: 841.89 });
  });
});

describe('sintesiColorspace', () => {
  const dettaglio = (processo: string[], tinte: string[] = []) =>
    ({ spazi: [], processo, tinte, outputIntent: [], fonte: 'pdf' as const, parziale: false });

  it('restituisce null quando lo spazio colore non e\' determinabile', () => {
    expect(sintesiColorspace(null)).toBeNull();
    expect(sintesiColorspace(dettaglio([]))).toBeNull();
  });

  it('distingue CMYK, RGB, misto e sola tinta piatta', () => {
    expect(sintesiColorspace(dettaglio(['cmyk', 'gray']))).toBe('cmyk');
    expect(sintesiColorspace(dettaglio(['rgb']))).toBe('rgb');
    expect(sintesiColorspace(dettaglio(['cmyk', 'rgb']))).toBe('mixed');
    expect(sintesiColorspace(dettaglio([], ['PANTONE 485 C']))).toBe('spot');
  });
});
