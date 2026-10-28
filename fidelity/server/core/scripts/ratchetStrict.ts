import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cricchetto di TypeScript strict sul server (yarn type-check:strict).
 *
 * Il server compila con strict:false. server/tsconfig.strict.json lo compila con strict:true e
 * server/tsconfig.strict.baseline.json conta, file per file, gli errori che c'erano gia'. Il
 * controllo fallisce se un file supera il proprio conteggio o se compare un file nuovo con
 * errori. Fallisce anche quando gli errori calano, finche' non si aggiorna il baseline con
 * `yarn type-check:strict --aggiorna`: cosi' il conteggio registrato puo' solo scendere.
 */

export type ConteggioErrori = Record<string, number>;

export interface EsitoConfronto {
  /** File con piu' errori del baseline, o nuovi: fanno fallire il controllo. */
  peggiorati: { file: string; prima: number; adesso: number }[];
  /** File con meno errori del baseline: il baseline va aggiornato. */
  migliorati: { file: string; prima: number; adesso: number }[];
}

const RIGA_ERRORE = /^(.+?)\(\d+,\d+\): error TS\d+:/;

/**
 * Errori per file dall'output di `tsc --pretty false`. Le righe di errore senza file (opzioni,
 * tsconfig) le restituisce a parte: non si contano, fanno fallire il controllo.
 */
export function contaErroriTsc(output: string, radice: string): { conteggio: ConteggioErrori; senzaFile: string[] } {
  const conteggio: ConteggioErrori = {};
  const senzaFile: string[] = [];
  for (const riga of output.split(/\r?\n/)) {
    const trovato = RIGA_ERRORE.exec(riga);
    if (trovato) {
      const file = path.relative(radice, path.resolve(radice, trovato[1])).split(path.sep).join('/');
      conteggio[file] = (conteggio[file] ?? 0) + 1;
    } else if (/^error TS\d+:/.test(riga)) {
      senzaFile.push(riga);
    }
  }
  return { conteggio, senzaFile };
}

export function confrontaConBaseline(baseline: ConteggioErrori, attuale: ConteggioErrori): EsitoConfronto {
  const esito: EsitoConfronto = { peggiorati: [], migliorati: [] };
  const file = [...new Set([...Object.keys(baseline), ...Object.keys(attuale)])].sort();
  for (const f of file) {
    const prima = baseline[f] ?? 0;
    const adesso = attuale[f] ?? 0;
    if (adesso > prima) esito.peggiorati.push({ file: f, prima, adesso });
    else if (adesso < prima) esito.migliorati.push({ file: f, prima, adesso });
  }
  return esito;
}

/** Baseline da scrivere: chiavi ordinate, solo i file che hanno ancora errori. */
export function serializzaBaseline(conteggio: ConteggioErrori): string {
  const ordinato: ConteggioErrori = {};
  for (const f of Object.keys(conteggio).sort()) {
    if (conteggio[f] > 0) ordinato[f] = conteggio[f];
  }
  return `${JSON.stringify(ordinato, null, 2)}\n`;
}

function main(): void {
  const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const fileBaseline = path.join(radice, 'server/tsconfig.strict.baseline.json');
  const aggiorna = process.argv.includes('--aggiorna');

  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  const esecuzione = spawnSync(process.execPath, [tsc, '-p', 'server/tsconfig.strict.json', '--noEmit', '--pretty', 'false'], {
    cwd: radice,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${esecuzione.stdout ?? ''}${esecuzione.stderr ?? ''}`;
  if (esecuzione.error) {
    console.error(`tsc non avviato: ${esecuzione.error.message}`);
    process.exit(1);
  }

  const { conteggio, senzaFile } = contaErroriTsc(output, radice);
  if (senzaFile.length > 0) {
    console.error(`tsc ha segnalato errori che non riguardano un file:\n${senzaFile.join('\n')}`);
    process.exit(1);
  }

  const totale = Object.values(conteggio).reduce((a, b) => a + b, 0);
  if (!existsSync(fileBaseline)) {
    // Solo la prima volta: il baseline nasce dallo stato attuale
    if (aggiorna) {
      writeFileSync(fileBaseline, serializzaBaseline(conteggio));
      console.log(`Baseline creato: ${totale} errori in ${Object.keys(conteggio).length} file.`);
      return;
    }
    console.error(`Manca ${path.relative(radice, fileBaseline)}: crealo con yarn type-check:strict --aggiorna`);
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(fileBaseline, 'utf8')) as ConteggioErrori;
  const { peggiorati, migliorati } = confrontaConBaseline(baseline, conteggio);

  if (peggiorati.length > 0) {
    console.error('TypeScript strict: errori nuovi rispetto al baseline.');
    for (const { file, prima, adesso } of peggiorati) console.error(`  ${file}: ${prima} -> ${adesso}`);
    const nomi = new Set(peggiorati.map(p => p.file));
    const righe = output.split(/\r?\n/).filter(r => {
      const trovato = RIGA_ERRORE.exec(r);
      return trovato && nomi.has(path.relative(radice, path.resolve(radice, trovato[1])).split(path.sep).join('/'));
    });
    console.error(`\n${righe.join('\n')}`);
    console.error('\nCorreggi gli errori nuovi: il baseline non si alza.');
    process.exit(1);
  }

  if (migliorati.length > 0) {
    if (aggiorna) {
      writeFileSync(fileBaseline, serializzaBaseline(conteggio));
      console.log(`Baseline aggiornato: ${totale} errori in ${Object.keys(conteggio).length} file.`);
      return;
    }
    console.error('TypeScript strict: errori in meno rispetto al baseline.');
    for (const { file, prima, adesso } of migliorati) console.error(`  ${file}: ${prima} -> ${adesso}`);
    console.error('\nAggiorna il baseline con: yarn type-check:strict --aggiorna');
    process.exit(1);
  }

  console.log(`TypeScript strict: ${totale} errori in ${Object.keys(conteggio).length} file, come il baseline.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
