import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as sharp from 'sharp';

/*
 * Anteprima dei file Adobe Illustrator (.ai).
 *
 * Un .ai puo' contenere una rappresentazione PDF (Illustrator 9 e successivi con
 * "Crea file compatibile PDF"), PostScript (Illustrator 8 e precedenti) oppure
 * solo dati proprietari. ImageMagick non va usato per leggerli: la sua policy
 * blocca il coder PDF/PS, ed e' giusto che resti bloccato per file caricati
 * dagli utenti. Il riconoscimento usa il contenuto, non l'estensione:
 * - PDF       -> pdfinfo verifica il documento, pdftocairo genera l'anteprima,
 *                pdf_colorspace.py (pikepdf) legge lo spazio colore originale;
 * - PostScript -> Ghostscript con -dSAFER genera l'anteprima;
 * - altro     -> formato non supportato oppure file non valido.
 * Il file originale viene solo letto. Ogni processo esterno riceve gli argomenti
 * come array (niente shell), ha un timeout e, su Linux, limiti di memoria e CPU.
 */

export type StatoConversione =
  | 'completed'
  | 'preview_unavailable'
  | 'unsupported_format'
  | 'conversion_failed'
  | 'invalid_file';

export type ContenutoIllustrator = 'pdf' | 'postscript' | 'raster' | 'unsupported' | 'invalid';

export interface ColorspaceDocumento {
  /** Famiglie di spazio colore trovate nel documento (DeviceCMYK, ICCBased, Separation, ...). */
  spazi: string[];
  /** Componenti di processo usate: "cmyk", "rgb", "gray", "lab". */
  processo: string[];
  /** Tinte piatte (Separation / DeviceN). */
  tinte: string[];
  outputIntent: { sottotipo: string | null; condizione: string | null; processo: string | null }[];
  /** Da dove viene l'informazione: analisi del PDF o commenti DSC del PostScript. */
  fonte: 'pdf' | 'dsc';
  /** true se l'analisi si e' fermata ai limiti di pagine o di oggetti. */
  parziale: boolean;
}

export interface EsitoConversione {
  /** Nome del file di anteprima (PNG) restituito come prima da conversioneFile, null se manca. */
  nomeFile: string | null;
  stato: StatoConversione;
  /** Codice del motivo quando lo stato non e' completed. */
  motivo: string | null;
  /** Contenuto riconosciuto (solo per i .ai). */
  formato: ContenutoIllustrator | null;
  pagine: number | null;
  /** Spazio colore sintetico del documento originale: cmyk, rgb, gray, mixed, spot; null se non determinato. */
  colorspaceOriginale: string | null;
  colorspaceDettaglio: ColorspaceDocumento | null;
  /** Spazio colore dell'anteprima generata (es. srgb): non descrive il documento originale. */
  colorspaceAnteprima: string | null;
}

export interface ConfigurazioneIllustrator {
  dpi: number;
  latoMassimoPx: number;
  timeoutMs: number;
  memoriaMassimaMb: number;
  dimensioneMassimaByte: number;
  pagineMassimeAnalisi: number;
  oggettiMassimiAnalisi: number;
}

function numeroDaEnv(nome: string, predefinito: number): number {
  const valore = Number(process.env[nome]);
  return Number.isFinite(valore) && valore > 0 ? valore : predefinito;
}

export function configurazioneIllustrator(): ConfigurazioneIllustrator {
  return {
    dpi: numeroDaEnv('OLIMPO_AI_ANTEPRIMA_DPI', 300),
    latoMassimoPx: numeroDaEnv('OLIMPO_AI_ANTEPRIMA_LATO_MAX', 4096),
    timeoutMs: numeroDaEnv('OLIMPO_AI_TIMEOUT_MS', 60000),
    memoriaMassimaMb: numeroDaEnv('OLIMPO_AI_MEMORIA_MAX_MB', 1024),
    dimensioneMassimaByte: numeroDaEnv('OLIMPO_AI_DIMENSIONE_MAX_MB', 512) * 1024 * 1024,
    pagineMassimeAnalisi: numeroDaEnv('OLIMPO_AI_PAGINE_MAX_ANALISI', 20),
    oggettiMassimiAnalisi: numeroDaEnv('OLIMPO_AI_OGGETTI_MAX_ANALISI', 200000),
  };
}

//#region Processi esterni

export interface OpzioniProcesso {
  timeoutMs: number;
  memoriaMassimaMb: number;
  cwd?: string;
}

export interface RisultatoProcesso {
  stdout: string;
  stderr: string;
}

export class ErroreProcesso extends Error {
  constructor(
    message: string,
    public readonly timeout: boolean,
    public readonly codice: number | null,
    public readonly stderr: string,
  ) {
    super(message);
  }
}

export type EseguiProcesso = (comando: string, args: string[], opzioni: OpzioniProcesso) => Promise<RisultatoProcesso>;

const PRLIMIT = '/usr/bin/prlimit';
let prlimitDisponibile: boolean | undefined;

/**
 * Esegue un comando senza shell. Su Linux passa da prlimit, che applica i limiti
 * di memoria virtuale e di CPU e poi sostituisce se stesso con il comando:
 * il SIGKILL del timeout arriva quindi al convertitore.
 */
export const eseguiProcesso: EseguiProcesso = (comando, args, opzioni) => {
  if (prlimitDisponibile === undefined) {
    prlimitDisponibile = process.platform === 'linux' && fs.existsSync(PRLIMIT);
  }
  let eseguibile = comando;
  let argomenti = args;
  if (prlimitDisponibile) {
    const memoria = Math.floor(opzioni.memoriaMassimaMb * 1024 * 1024);
    const cpu = Math.ceil(opzioni.timeoutMs / 1000) + 1;
    eseguibile = PRLIMIT;
    argomenti = [`--as=${memoria}`, `--cpu=${cpu}`, '--', comando, ...args];
  }
  return new Promise((resolve, reject) => {
    execFile(
      eseguibile,
      argomenti,
      {
        timeout: opzioni.timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: 16 * 1024 * 1024,
        cwd: opzioni.cwd,
        windowsHide: true,
        // Ambiente minimo: nessun proxy o variabile di rete ereditata.
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          HOME: opzioni.cwd ?? os.tmpdir(),
          LANG: 'C',
          ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}),
        },
      },
      (error, stdout, stderr) => {
        const out = String(stdout ?? '');
        const err = String(stderr ?? '');
        if (!error) {
          resolve({ stdout: out, stderr: err });
          return;
        }
        const e = error as any;
        // SIGKILL dal timeout di execFile, SIGXCPU/SIGKILL dal limite di CPU.
        const timeout = Boolean(e.killed) || e.signal === 'SIGKILL' || e.signal === 'SIGXCPU';
        const codice = typeof e.code === 'number' ? e.code : null;
        reject(new ErroreProcesso(
          `${path.basename(comando)} ${timeout ? 'interrotto per timeout o limite di risorse' : `terminato con errore (${e.code ?? e.signal})`}: ${err.trim().slice(0, 500)}`,
          timeout,
          codice,
          err,
        ));
      },
    );
  });
};

//#endregion

//#region Riconoscimento del contenuto

const FIRME_NON_ILLUSTRATOR: { nome: string; firma: number[] }[] = [
  { nome: 'zip', firma: [0x50, 0x4b, 0x03, 0x04] },
  { nome: 'gzip', firma: [0x1f, 0x8b] },
  { nome: 'rar', firma: [0x52, 0x61, 0x72, 0x21] },
  { nome: '7z', firma: [0x37, 0x7a, 0xbc, 0xaf] },
  { nome: 'elf', firma: [0x7f, 0x45, 0x4c, 0x46] },
  { nome: 'exe', firma: [0x4d, 0x5a] },
  { nome: 'ole', firma: [0xd0, 0xcf, 0x11, 0xe0] },
];

const FIRME_RASTER: number[][] = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x49, 0x49, 0x2a, 0x00], // TIFF LE
  [0x4d, 0x4d, 0x00, 0x2a], // TIFF BE
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x38, 0x42, 0x50, 0x53], // PSD
];

function iniziaCon(buf: Buffer, firma: number[]): boolean {
  return buf.length >= firma.length && firma.every((b, i) => buf[i] === b);
}

export interface RiconoscimentoIllustrator {
  contenuto: ContenutoIllustrator;
  motivo: string | null;
  /** true se il PostScript dichiara Adobe Illustrator come creatore. */
  creatoreIllustrator?: boolean;
}

/**
 * Riconosce il contenuto di un .ai dai primi byte (e dalla coda per i PDF).
 * Non decide da solo che un PDF e' valido: lo verifica poi pdfinfo.
 */
export function riconosciContenutoIllustrator(testa: Buffer, coda: Buffer): RiconoscimentoIllustrator {
  if (testa.length === 0) {
    return { contenuto: 'invalid', motivo: 'file_vuoto' };
  }
  // L'intestazione PDF puo' stare nei primi 1024 byte.
  if (testa.subarray(0, 1024).indexOf('%PDF-') >= 0) {
    if (coda.indexOf('%%EOF') < 0) {
      return { contenuto: 'invalid', motivo: 'pdf_incompleto' };
    }
    return { contenuto: 'pdf', motivo: null };
  }
  // EPS DOS binario (C5 D0 D3 C6) o PostScript testuale.
  if (iniziaCon(testa, [0xc5, 0xd0, 0xd3, 0xc6]) || testa.subarray(0, 4).toString('latin1') === '%!PS') {
    const intestazione = testa.toString('latin1');
    return {
      contenuto: 'postscript',
      motivo: null,
      creatoreIllustrator: /^%%Creator:.*Illustrator/m.test(intestazione),
    };
  }
  if (FIRME_RASTER.some((f) => iniziaCon(testa, f))) {
    return { contenuto: 'raster', motivo: null };
  }
  const estranea = FIRME_NON_ILLUSTRATOR.find((f) => iniziaCon(testa, f.firma));
  if (estranea) {
    return { contenuto: 'invalid', motivo: `contenuto_incoerente_${estranea.nome}` };
  }
  return { contenuto: 'unsupported', motivo: 'formato_illustrator_non_riconosciuto' };
}

async function leggiTestaECoda(file: string, dimensione: number): Promise<{ testa: Buffer; coda: Buffer }> {
  const handle = await fs.promises.open(file, 'r');
  try {
    const testa = Buffer.alloc(Math.min(4096, dimensione));
    await handle.read(testa, 0, testa.length, 0);
    const lunghezzaCoda = Math.min(4096, dimensione);
    const coda = Buffer.alloc(lunghezzaCoda);
    await handle.read(coda, 0, lunghezzaCoda, dimensione - lunghezzaCoda);
    return { testa, coda };
  } finally {
    await handle.close();
  }
}

//#endregion

//#region Analisi e conversione

const isWindows = process.platform === 'win32';
const GS = isWindows ? 'gswin64c' : 'gs';
const PYTHON = isWindows ? 'python' : 'python3';

export function percorsoScriptColorspace(): string | null {
  // ts-jest: <olimpo>/lib -> <olimpo>/scripts; build: <olimpo|app>/dist/lib -> <olimpo|app>/scripts
  const candidati = [
    path.resolve(__dirname, '../scripts/pdf_colorspace.py'),
    path.resolve(__dirname, '../../scripts/pdf_colorspace.py'),
  ];
  return candidati.find((c) => fs.existsSync(c)) ?? null;
}

export interface InfoPdf {
  pagine: number;
  cifrato: boolean;
  /** Dimensione della prima pagina in punti, se pdfinfo la riporta. */
  larghezzaPt: number | null;
  altezzaPt: number | null;
}

export function leggiOutputPdfinfo(stdout: string): InfoPdf {
  const pagine = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? NaN);
  const cifrato = /^Encrypted:\s+yes/m.test(stdout);
  const dimensione = /^Page size:\s+([\d.]+) x ([\d.]+) pts/m.exec(stdout);
  return {
    pagine: Number.isFinite(pagine) ? pagine : 0,
    cifrato,
    larghezzaPt: dimensione ? Number(dimensione[1]) : null,
    altezzaPt: dimensione ? Number(dimensione[2]) : null,
  };
}

/** Sintesi dello spazio colore del documento; null quando non c'e' un'indicazione affidabile. */
export function sintesiColorspace(dettaglio: ColorspaceDocumento | null): string | null {
  if (!dettaglio) return null;
  const processo = new Set(dettaglio.processo);
  const cmyk = processo.has('cmyk');
  const rgb = processo.has('rgb');
  if (cmyk && rgb) return 'mixed';
  if (cmyk) return 'cmyk';
  if (rgb) return 'rgb';
  if (processo.has('lab')) return 'lab';
  if (processo.has('gray')) return 'gray';
  if (dettaglio.tinte.length > 0) return 'spot';
  return null;
}

/** Colori di processo e tinte dichiarati nei commenti DSC di un PostScript Illustrator. */
export function colorspaceDaDsc(intestazione: string): ColorspaceDocumento | null {
  const processo = /^%%DocumentProcessColors:(.*)$/m.exec(intestazione)?.[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  const tinte = [...intestazione.matchAll(/^%%(?:DocumentCustomColors:|\+)\s*\((.+?)\)/gm)].map((m) => m[1]);
  if (processo.length === 0 && tinte.length === 0) return null;
  const componenti = new Set<string>();
  if (processo.some((c) => ['Cyan', 'Magenta', 'Yellow'].includes(c))) componenti.add('cmyk');
  else if (processo.includes('Black')) componenti.add('gray');
  return {
    spazi: [],
    processo: [...componenti],
    tinte,
    outputIntent: [],
    fonte: 'dsc',
    parziale: false,
  };
}

async function colorspaceAnteprima(png: string): Promise<string | null> {
  try {
    const meta = await sharp(png).metadata();
    if (meta.space === 'b-w') return 'gray';
    return meta.space ?? null;
  } catch {
    return null;
  }
}

export interface DipendenzeIllustrator {
  esegui: EseguiProcesso;
  configurazione: ConfigurazioneIllustrator;
  log: (evento: Record<string, unknown>) => void;
}

function logStrutturato(evento: Record<string, unknown>): void {
  const riga = JSON.stringify({ evento: 'conversione_illustrator', ...evento });
  if (evento.stato === 'completed') console.log(riga);
  else console.warn(riga);
}

function esitoVuoto(stato: StatoConversione, motivo: string | null, formato: ContenutoIllustrator | null): EsitoConversione {
  return {
    nomeFile: null,
    stato,
    motivo,
    formato,
    pagine: null,
    colorspaceOriginale: null,
    colorspaceDettaglio: null,
    colorspaceAnteprima: null,
  };
}

function motivoDaErrore(prefisso: string, errore: unknown): { stato: StatoConversione; motivo: string } {
  if (errore instanceof ErroreProcesso && errore.timeout) {
    return { stato: 'conversion_failed', motivo: `${prefisso}_timeout` };
  }
  return { stato: 'conversion_failed', motivo: `${prefisso}_errore` };
}

export interface FileConversioneIllustrator {
  /** File .ai in archivio: viene solo letto. */
  originale: string;
  outputPng: string;
  outputWebp: string;
  /** Nome restituito al chiamante quando l'anteprima e' pronta. */
  nomeAnteprima: string;
}

/**
 * Genera l'anteprima PNG/WebP della prima pagina di un .ai e legge lo spazio
 * colore del documento. Non lancia eccezioni per gli esiti previsti: lo stato
 * dice se l'anteprima e' pronta e perche' non lo e'.
 * Il contenuto 'raster' non viene convertito qui: lo gestisce ConversionService.
 */
export async function convertiIllustrator(
  file: FileConversioneIllustrator,
  dipendenze: Partial<DipendenzeIllustrator> = {},
): Promise<EsitoConversione> {
  const esegui = dipendenze.esegui ?? eseguiProcesso;
  const cfg = dipendenze.configurazione ?? configurazioneIllustrator();
  const log = dipendenze.log ?? logStrutturato;
  const opzioni = (cwd: string): OpzioniProcesso => ({ timeoutMs: cfg.timeoutMs, memoriaMassimaMb: cfg.memoriaMassimaMb, cwd });

  const dimensione = (await fs.promises.stat(file.originale)).size;
  const { testa, coda } = await leggiTestaECoda(file.originale, dimensione);
  const riconosciuto = riconosciContenutoIllustrator(testa, coda);
  const base = { file: path.basename(file.originale), byte: dimensione, formato: riconosciuto.contenuto };

  if (riconosciuto.contenuto === 'raster') {
    return esitoVuoto('preview_unavailable', 'contenuto_raster', 'raster');
  }
  if (riconosciuto.contenuto === 'invalid') {
    const esito = esitoVuoto('invalid_file', riconosciuto.motivo, 'invalid');
    log({ ...base, stato: esito.stato, motivo: esito.motivo });
    return esito;
  }
  if (riconosciuto.contenuto === 'unsupported') {
    const esito = esitoVuoto('unsupported_format', riconosciuto.motivo, 'unsupported');
    log({ ...base, stato: esito.stato, motivo: esito.motivo });
    return esito;
  }
  if (dimensione > cfg.dimensioneMassimaByte) {
    const esito = esitoVuoto('preview_unavailable', 'file_troppo_grande', riconosciuto.contenuto);
    log({ ...base, stato: esito.stato, motivo: esito.motivo });
    return esito;
  }

  const cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-ai-'));
  try {
    // Copia di lavoro: l'originale in archivio non viene mai passato ai convertitori in scrittura.
    const ingresso = path.join(cartella, 'ingresso');
    await fs.promises.copyFile(file.originale, ingresso);
    const esito = riconosciuto.contenuto === 'pdf'
      ? await convertiPdf(ingresso, cartella, file, esegui, cfg, opzioni(cartella))
      : await convertiPostScript(ingresso, cartella, testa, file, esegui, cfg, opzioni(cartella));
    log({
      ...base,
      stato: esito.stato,
      motivo: esito.motivo,
      pagine: esito.pagine,
      colorspaceOriginale: esito.colorspaceOriginale,
      colorspaceAnteprima: esito.colorspaceAnteprima,
    });
    return esito;
  } finally {
    await fs.promises.rm(cartella, { recursive: true, force: true });
  }
}

async function convertiPdf(
  ingresso: string,
  cartella: string,
  file: FileConversioneIllustrator,
  esegui: EseguiProcesso,
  cfg: ConfigurazioneIllustrator,
  opzioni: OpzioniProcesso,
): Promise<EsitoConversione> {
  // 1. pdfinfo: il documento si apre? quante pagine? e' protetto?
  let info: InfoPdf;
  try {
    info = leggiOutputPdfinfo((await esegui('pdfinfo', [ingresso], opzioni)).stdout);
  } catch (errore) {
    if (errore instanceof ErroreProcesso && /password/i.test(errore.stderr)) {
      return esitoVuoto('unsupported_format', 'pdf_protetto_da_password', 'pdf');
    }
    if (errore instanceof ErroreProcesso && errore.timeout) {
      return esitoVuoto('conversion_failed', 'pdfinfo_timeout', 'pdf');
    }
    // Non valido solo se pdfinfo ha letto il file e lo ha rifiutato; se pdfinfo
    // non e' eseguibile (126/127, ENOENT) il file resta valido, senza anteprima.
    if (errore instanceof ErroreProcesso && errore.codice !== null && errore.codice !== 126 && errore.codice !== 127) {
      return esitoVuoto('invalid_file', 'pdf_non_leggibile', 'pdf');
    }
    return esitoVuoto('conversion_failed', 'pdfinfo_non_eseguibile', 'pdf');
  }
  if (info.pagine < 1) {
    return esitoVuoto('invalid_file', 'pdf_senza_pagine', 'pdf');
  }
  const esito = esitoVuoto('completed', null, 'pdf');
  esito.pagine = info.pagine;

  // 2. spazio colore del documento originale (indipendente dall'anteprima)
  esito.colorspaceDettaglio = await analizzaColorspacePdf(ingresso, esegui, cfg, opzioni);
  esito.colorspaceOriginale = sintesiColorspace(esito.colorspaceDettaglio);

  // 3. Illustrator salvato senza contenuto PDF: la pagina e' solo un avviso testuale.
  try {
    const testo = (await esegui('pdftotext', ['-f', '1', '-l', '1', '-q', ingresso, '-'], opzioni)).stdout;
    if (/saved without PDF Content/i.test(testo.replace(/\s+/g, ' '))) {
      esito.stato = 'unsupported_format';
      esito.motivo = 'ai_senza_contenuto_pdf';
      return esito;
    }
  } catch {
    // il testo serve solo a questo controllo: se manca si prosegue
  }

  // 4. anteprima della prima pagina (CropBox = tavola), con trasparenza
  const radice = path.join(cartella, 'anteprima');
  const args = ['-png', '-singlefile', '-f', '1', '-l', '1', '-cropbox', '-transp'];
  const latoPt = Math.max(info.larghezzaPt ?? 0, info.altezzaPt ?? 0);
  if (latoPt > 0 && (latoPt / 72) * cfg.dpi <= cfg.latoMassimoPx) {
    args.push('-r', String(cfg.dpi));
  } else {
    args.push('-scale-to', String(cfg.latoMassimoPx));
  }
  args.push(ingresso, radice);
  try {
    await esegui('pdftocairo', args, opzioni);
  } catch (errore) {
    const { stato, motivo } = motivoDaErrore('pdftocairo', errore);
    return { ...esito, stato, motivo };
  }
  return completaAnteprima(`${radice}.png`, file, esito);
}

async function analizzaColorspacePdf(
  ingresso: string,
  esegui: EseguiProcesso,
  cfg: ConfigurazioneIllustrator,
  opzioni: OpzioniProcesso,
): Promise<ColorspaceDocumento | null> {
  const script = percorsoScriptColorspace();
  if (!script) return null;
  try {
    const { stdout } = await esegui(
      PYTHON,
      ['-I', script, ingresso, String(cfg.pagineMassimeAnalisi), String(cfg.oggettiMassimiAnalisi)],
      opzioni,
    );
    const dati = JSON.parse(stdout);
    return {
      spazi: dati.spazi ?? [],
      processo: dati.processo ?? [],
      tinte: dati.tinte ?? [],
      outputIntent: dati.outputIntent ?? [],
      fonte: 'pdf',
      parziale: Boolean(dati.troncato),
    };
  } catch (errore: any) {
    // Lo spazio colore resta non determinato: l'anteprima non dipende da questo.
    console.warn(JSON.stringify({ evento: 'colorspace_illustrator_non_determinato', errore: String(errore?.message ?? errore).slice(0, 300) }));
    return null;
  }
}

async function convertiPostScript(
  ingresso: string,
  cartella: string,
  testa: Buffer,
  file: FileConversioneIllustrator,
  esegui: EseguiProcesso,
  cfg: ConfigurazioneIllustrator,
  opzioni: OpzioniProcesso,
): Promise<EsitoConversione> {
  const intestazione = testa.toString('latin1');
  const esito = esitoVuoto('completed', null, 'postscript');
  esito.colorspaceDettaglio = colorspaceDaDsc(intestazione);
  esito.colorspaceOriginale = sintesiColorspace(esito.colorspaceDettaglio);

  // Risoluzione ridotta se il BoundingBox supererebbe il lato massimo.
  let dpi = cfg.dpi;
  const bbox = /^%%BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/m.exec(intestazione);
  if (bbox) {
    const latoPt = Math.max(Number(bbox[3]) - Number(bbox[1]), Number(bbox[4]) - Number(bbox[2]));
    if (latoPt > 0) dpi = Math.max(1, Math.min(dpi, Math.floor((cfg.latoMassimoPx * 72) / latoPt)));
  }
  const png = path.join(cartella, 'anteprima.png');
  try {
    // -dSAFER: il PostScript non puo' leggere o scrivere file fuori dall'output.
    await esegui(GS, [
      '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop',
      '-dFirstPage=1', '-dLastPage=1',
      '-sDEVICE=pngalpha', `-r${dpi}`,
      '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
      `-sOutputFile=${png}`,
      '-f', ingresso,
    ], opzioni);
  } catch (errore) {
    const { stato, motivo } = motivoDaErrore('ghostscript', errore);
    return { ...esito, stato, motivo };
  }
  if (!fs.existsSync(png)) {
    return { ...esito, stato: 'conversion_failed', motivo: 'ghostscript_senza_output' };
  }
  esito.pagine = null; // Ghostscript non conta le pagine senza leggere tutto il documento
  return completaAnteprima(png, file, esito);
}

async function completaAnteprima(png: string, file: FileConversioneIllustrator, esito: EsitoConversione): Promise<EsitoConversione> {
  try {
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height) {
      return { ...esito, stato: 'conversion_failed', motivo: 'anteprima_vuota' };
    }
    await fs.promises.mkdir(path.dirname(file.outputPng), { recursive: true });
    await fs.promises.copyFile(png, file.outputPng);
    const webp = await sharp(png).webp().toBuffer();
    await fs.promises.writeFile(file.outputWebp, webp);
    return {
      ...esito,
      nomeFile: file.nomeAnteprima,
      colorspaceAnteprima: await colorspaceAnteprima(png),
    };
  } catch {
    await fs.promises.rm(file.outputPng, { force: true });
    await fs.promises.rm(file.outputWebp, { force: true });
    return { ...esito, stato: 'conversion_failed', motivo: 'anteprima_non_scrivibile' };
  }
}

//#endregion
