import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as sharp from 'sharp';
import { promisify } from "util";
import { Colorize } from "./colorize";

const execPromise = promisify(exec);

type RealFileType = 'psd' | 'psb' | 'png' | 'tiff' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'unknown';

function detectRealFileType(filePath: string): RealFileType {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  // PSD / PSB: "8BPS"
  if (buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53) {
    return buf.readUInt16BE(4) === 2 ? 'psb' : 'psd';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  // TIFF little-endian: II*\0
  if (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) return 'tiff';
  // TIFF big-endian: MM\0*
  if (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A) return 'tiff';
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  // BMP: BM
  if (buf[0] === 0x42 && buf[1] === 0x4D) return 'bmp';
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';

  return 'unknown';
}

function normalizeColorSpace(cs: string): string {
  const len = cs.length;
  for (let i = 1; i <= len; i++) {
    if (len % i === 0) {
      const candidate = cs.slice(0, i);
      if (candidate.repeat(len / i) === cs) {
        return candidate;
      }
    }
  }
  return cs;
}

/**
 * Funzione per ottenere il colorspace del file usando il comando identify.
 * Restituisce una stringa (ad es. "cmyk", "srgb", "rgb").
 */
async function getColorSpace(filePath: string): Promise<string> {
  // Check if we're on Windows
  const isWindows = process.platform === 'win32' || process.platform.toLowerCase().includes('win');

  // Common identify command for both platforms
  const identifyCommand = isWindows
    ? `magick identify -format "%[colorspace]" "${filePath}"`  // Windows uses 'magick identify'
    : `identify -format "%[colorspace]" "${filePath}"`;        // Linux uses just 'identify'

  try {
    const { stdout } = await execPromise(identifyCommand);
    let cs = stdout.trim().toLowerCase();
    // Normalizza il risultato, eliminando eventuali ripetizioni
    cs = normalizeColorSpace(cs);
    if (cs !== "cmyk") {
      console.log(`Colorspace: ${cs}`);
    }
    return cs;
  } catch (error) {
    // If identify fails, try to determine colorspace from file extension
    if (path.extname(filePath).toLowerCase() === '.psd') {
      console.warn('Using default colorspace for PSD file');
      return 'cmyk'; // Most PSD files are CMYK by default
    }
    throw new Error(`Errore ottenendo il colorspace: ${error}`);
  }
}
class ConversionService {
  /**
   * Esegue la conversione del file in base all'estensione e al colorspace rilevato.
   *
   * @param path_file_dello_zip_completo - Percorso del file sorgente (es. ZIP completo)
   * @param nome_archivio_file_finale - Percorso del file archivio (originale)
   * @param nome_web_file_finale - Percorso destinazione per il file web
   * @param unique_name - Nome univoco generato per il file di output
   * @returns Una Promise che risolve il nuovo nome del file convertito
   */
  static async conversioneFile(
    path_file_dello_zip_completo: string,
    nome_archivio_file_finale: string,
    nome_web_file_finale: string,
    unique_name: string
  ): Promise<string> {
    try {
      console.log(Colorize.bgBlue(`Inizio conversione file: ${nome_archivio_file_finale}`));
      const fileSize = fs.statSync(nome_archivio_file_finale).size;
      if (fileSize === 0) {
        throw new Error(`Il file è vuoto (0 byte): ${path.basename(nome_archivio_file_finale)}`);
      }
      const ext = path.extname(nome_archivio_file_finale);
      console.log(Colorize.bgYellow(`Estensione file: ${ext}`));

      switch (ext.toLowerCase()) {
        case ".psd":
        case ".ai": {
          console.log(Colorize.bgGreen(`Elaborazione file ${ext} in corso...`));
          const outputPng = nome_web_file_finale.replace(ext, ".png");
          const outputWebp = outputPng.replace(".png", ".webp");

          // Verifica il tipo reale del file (potrebbe essere PNG/TIFF/JPEG rinominato come PSD)
          const realType = detectRealFileType(nome_archivio_file_finale);
          console.log(Colorize.bgCyan(`Tipo reale rilevato dai magic bytes: ${realType}`));
          if (realType !== 'psd' && realType !== 'psb' && realType !== 'unknown') {
            console.log(Colorize.bgYellow(`File con estensione ${ext} ma tipo reale ${realType} — conversione diretta con Sharp`));
            await sharp(nome_archivio_file_finale)
              .flatten({ background: { r: 255, g: 255, b: 255 } })
              .png()
              .toFile(outputPng);
            const webpBuf = await sharp(outputPng).webp().toBuffer();
            await fs.promises.writeFile(outputWebp, webpBuf);
            return unique_name.replace(ext, ".png");
          }

          // 1. Try sharp/libvips — let libvips handle colorspace automatically
          if (ext.toLowerCase() === ".psd") {
            try {
              console.log(Colorize.bgBlue("Tentativo conversione PSD con Sharp/libvips"));
              await sharp(nome_archivio_file_finale)
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .png()
                .toFile(outputPng);
              console.log(Colorize.bgGreen("Conversione PSD in PNG completata con Sharp"));
              const webpBuffer = await sharp(outputPng).webp().toBuffer();
              await fs.promises.writeFile(outputWebp, webpBuffer);
              console.log(Colorize.bgGreen("Conversione in WebP completata"));
              return unique_name.replace(ext, ".png");
            } catch (sharpError: any) {
              console.warn(Colorize.bgYellow(`Sharp non è riuscito (${sharpError.message}), provo con ImageMagick...`));
            }
          }

          // 2. Try ImageMagick
          const colorspace = await getColorSpace(nome_archivio_file_finale);
          console.log(Colorize.bgCyan(`Colorspace rilevato: ${colorspace}`));

          let comandoConvert = "";
          const isWindows = process.platform === 'win32' || process.platform.toLowerCase().includes('win');
          console.log(Colorize.bgMagenta(`Sistema operativo: ${isWindows ? 'Windows' : 'Linux'}`));

          if (isWindows) {
            if (colorspace == "cmyk") {
              console.log(Colorize.bgBlue('Applicazione profilo CMYK per Windows'));
              comandoConvert = `magick "${nome_archivio_file_finale}[0]" -profile "${path.join(__dirname, "../../ICC/USWebCoatedSWOP.icc")}" -profile "${path.join(__dirname, "../../ICC/sRGB2014.icc")}" -background none -flatten "${outputPng}"`;
            } else if (colorspace == "srgb" || colorspace == "rgb") {
              console.log(Colorize.bgBlue('Applicazione profilo sRGB/RGB per Windows'));
              comandoConvert = `magick "${nome_archivio_file_finale}[0]" -profile "${path.join(__dirname, "../../ICC/sRGB2014.icc")}" -colorspace sRGB -background none -flatten "${outputPng}"`;
            } else {
              console.log(Colorize.bgBlue('Conversione standard per Windows'));
              comandoConvert = `magick "${nome_archivio_file_finale}[0]" -colorspace sRGB -background none -flatten "${outputPng}"`;
            }
          } else {
            console.log(Colorize.bgYellow('Utilizzo codice legacy per Linux'));
            if (colorspace == "cmyk") {
              console.log(Colorize.bgBlue('Applicazione profilo CMYK per Linux'));
              comandoConvert = `convert "${nome_archivio_file_finale}" -profile "${path.join(__dirname, "../../ICC/USWebCoatedSWOP.icc")}" -profile "${path.join(__dirname, "../../ICC/sRGB2014.icc")}" -background none -flatten "${outputPng}"`;
            } else if (colorspace === "srgb" || colorspace === "rgb") {
              console.log(Colorize.bgBlue('Applicazione profilo sRGB/RGB per Linux'));
              comandoConvert = `convert "${nome_archivio_file_finale}" -profile "${path.join(__dirname, "../../ICC/sRGB2014.icc")}" -colorspace sRGB -background none -flatten "${outputPng}"`;
            } else {
              console.log(Colorize.bgBlue('Conversione standard per Linux'));
              comandoConvert = `convert "${nome_archivio_file_finale}" -colorspace sRGB -background none -flatten "${outputPng}"`;
            }
          }

          try {
            console.log(Colorize.bgGreen("Esecuzione comando convert:", comandoConvert));
            await execPromise(comandoConvert);
            console.log(Colorize.bgGreen("Conversione in PNG completata"));
            const image = sharp(outputPng);
            const buffer = await image.webp().toBuffer();
            await fs.promises.writeFile(outputWebp, buffer);
            console.log(Colorize.bgGreen("Conversione in WebP completata"));
            return unique_name.replace(ext, ".png");
          } catch (imError: any) {
            console.warn(Colorize.bgYellow(`ImageMagick non è riuscito (${imError.message}), provo con Python Pillow...`));
          }

          // 3. Python Pillow — last resort for problematic PSD files
          if (ext.toLowerCase() === ".psd") {
            const inputPy = nome_archivio_file_finale.replace(/\\/g, '/');
            const outputPy = outputPng.replace(/\\/g, '/');
            const pilCmd = `python3 -c "from PIL import Image; img=Image.open(r'${inputPy}'); img.convert('RGB').save(r'${outputPy}', 'PNG')"`;
            console.log(Colorize.bgBlue("Tentativo conversione PSD con Python Pillow"));
            await execPromise(pilCmd);
            console.log(Colorize.bgGreen("Conversione PSD in PNG completata con Python Pillow"));
            const MAX_WEBP = 16383;
            const image = sharp(outputPng);
            const metadata = await image.metadata();
            let { width, height } = metadata;
            if (width > MAX_WEBP || height > MAX_WEBP) {
              const scale = Math.min(MAX_WEBP / width, MAX_WEBP / height);
              width = Math.floor(width * scale);
              height = Math.floor(height * scale);
              console.log(Colorize.bgYellow(`Ridimensiono immagine a ${width}x${height}`));
            }
            const webpBuffer = await sharp(outputPng)
              .resize(width, height, { fit: "inside", withoutEnlargement: true })
              .webp()
              .toBuffer();
            await fs.promises.writeFile(outputWebp, webpBuffer);
            console.log(Colorize.bgGreen("Conversione in WebP completata"));
            return unique_name.replace(ext, ".png");
          }

          throw new Error(`Tutti i metodi di conversione hanno fallito per ${ext}`);
        }
        case ".eps": {
          console.log(Colorize.bgBlue("Inizio conversione file EPS"));
          // Si parte dal file in archivio: il temporaneo di estrazione viene
          // rimosso dallo smistamento prima che il worker venga avviato.
          const outputPngEPS = nome_web_file_finale.replace(ext, ".png");
          const fileWebpEPS = nome_web_file_finale.replace(ext, ".webp");
          console.log(Colorize.bgYellow("Conversione EPS in PNG con ImageMagick"));
          await execPromise(`convert -density 300 "${nome_archivio_file_finale}" -flatten "${outputPngEPS}"`);
          console.log(Colorize.bgGreen("Conversione EPS in PNG completata"));
          const MAX_WEBP_EPS = 16383;
          const imageEPS = sharp(outputPngEPS);
          const metaEPS = await imageEPS.metadata();
          let { width: wEPS, height: hEPS } = metaEPS;
          if (wEPS > MAX_WEBP_EPS || hEPS > MAX_WEBP_EPS) {
            const scale = Math.min(MAX_WEBP_EPS / wEPS, MAX_WEBP_EPS / hEPS);
            wEPS = Math.floor(wEPS * scale);
            hEPS = Math.floor(hEPS * scale);
            console.log(Colorize.bgYellow(`Ridimensiono immagine a ${wEPS}x${hEPS}`));
          }
          const webpBufEPS = await sharp(outputPngEPS)
            .resize(wEPS, hEPS, { fit: "inside", withoutEnlargement: true })
            .webp()
            .toBuffer();
          await fs.promises.writeFile(fileWebpEPS, webpBufEPS);
          console.log(Colorize.bgGreen("Conversione EPS completata"));
          return unique_name.replace(ext, ".png");
        }
        case ".idms": {
          console.log(Colorize.bgBlue("Elaborazione file IDMS"));
          const outputIdms = nome_web_file_finale.replace(ext, ".idms");
          fs.copyFileSync(nome_archivio_file_finale, outputIdms);
          const outputWebpIdms = nome_web_file_finale.replace(ext, ".webp");
          console.log(Colorize.bgYellow("Conversione IDMS in WebP"));
          const comandoWebpIdms = `convert "${outputIdms}" "${outputWebpIdms}"`;
          await execPromise(comandoWebpIdms);
          console.log(Colorize.bgGreen("Conversione IDMS completata"));
          return unique_name.replace(ext, ".webp");
        }
        default: {
          console.log(Colorize.bgBlue("Elaborazione file generico"));
          fs.copyFileSync(nome_archivio_file_finale, nome_web_file_finale);
          const outputWebp = ext ? nome_web_file_finale.replace(ext, ".webp") : nome_web_file_finale + ".webp";
          console.log(Colorize.bgYellow("Conversione in WebP"));
          const bufferWebp = await sharp(nome_archivio_file_finale).webp().toBuffer();
          await fs.promises.writeFile(outputWebp, bufferWebp);
          console.log(Colorize.bgGreen("Conversione completata"));
          return unique_name;
        }
      }
    } catch (error: any) {
      console.error(Colorize.bgRed(`Errore durante la conversione del file: ${error.message}`));
      throw new Error("Errore durante la conversione del file: " + error.message);
    }
  }

}

export default ConversionService;
