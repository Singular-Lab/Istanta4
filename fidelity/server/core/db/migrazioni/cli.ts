#!/usr/bin/env node
import { program } from 'commander';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, initializeDatabase } from '../index';
import { applicaMigrazioni, leggiStatoDatabase, leggiStorico, RigaStorico } from './applicaMigrazioni';
import { CARTELLA_SQL, FILE_SCHEMA, leggiMigrazioni } from './fileMigrazioni';
import { descriviSchemaModelli, hashSchema, scriviSchema } from './schemaModelli';
import { descriviDifferenza, verificaSchema } from './verificaSchema';

/**
 * Comandi delle migrazioni dello schema:
 *   yarn migrazioni:nuova <nome>   nuovo file numerato con l'hash dei modelli, aggiorna schema.json
 *   yarn migrazioni:stato          migrazioni applicate e da applicare
 *   yarn migrazioni:verifica       confronto in sola lettura fra database e schema.json
 *   yarn migrazioni:applica        applica le migrazioni pendenti (anche con MIGRAZIONI_APPLICA_ALL_AVVIO=false)
 */

export interface NuovaMigrazione {
  file: string;
  hash: string;
  /** False: i modelli sono quelli dell'ultima migrazione (migrazione di soli dati). */
  modelliCambiati: boolean;
}

export const creaNuovaMigrazione = (nome: string, cartella: string = CARTELLA_SQL, fileSchema: string = FILE_SCHEMA): NuovaMigrazione => {
  const suffisso = nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!suffisso) throw new Error('Nome della migrazione vuoto: usare lettere minuscole, cifre e _');

  const migrazioni = leggiMigrazioni(cartella);
  const ultima = migrazioni[migrazioni.length - 1];
  const descrizione = descriviSchemaModelli();
  const hash = hashSchema(descrizione);
  const file = path.join(cartella, `${String(migrazioni.length).padStart(4, '0')}_${suffisso}.sql`);

  const testo = [
    `-- schema-dopo: ${hash}`,
    `-- ${suffisso}: cosa cambia e perche'.`,
    '--',
    '-- Porta lo schema dalla migrazione precedente allo stato attuale dei modelli (schema.json).',
    '-- Gira una volta sola, in una transazione con lock_timeout: niente BEGIN/COMMIT. Le view e le',
    '-- materialized view sono gia\' tolte prima e ricreate dopo. Per un\'istruzione che non puo\' stare',
    '-- in una transazione (CREATE INDEX CONCURRENTLY) aggiungere in testa la riga "-- senza-transazione"',
    '-- e lasciare nel file solo quell\'istruzione, rieseguibile (IF NOT EXISTS).',
    '',
    '',
  ].join('\n');

  // wx: non sovrascrive un file con lo stesso nome
  writeFileSync(file, testo, { encoding: 'utf8', flag: 'wx' });
  scriviSchema(descrizione, fileSchema);
  return { file, hash, modelliCambiati: hash !== ultima.schemaDopo };
};

const formattaData = (valore: Date | string | null | undefined): string =>
  valore ? new Date(valore).toISOString().replace('T', ' ').slice(0, 19) : '';

export const stampaStato = async (): Promise<void> => {
  const migrazioni = leggiMigrazioni();
  const hashModelli = hashSchema(descriviSchemaModelli());
  const stato = await leggiStatoDatabase();
  const registrate: RigaStorico[] = stato.storico ? await leggiStorico() : [];
  const perNome = new Map(registrate.map(r => [r.nome, r] as const));

  console.log('Migrazioni dello schema');
  console.log('='.repeat(72));
  for (const migrazione of migrazioni) {
    const riga = perNome.get(migrazione.nome);
    const esito = !riga
      ? 'da applicare'
      : riga.checksum.trim() !== migrazione.checksum ? `${riga.modo}, FILE CAMBIATO DOPO L'APPLICAZIONE` : riga.modo;
    const dettaglio = riga ? `  ${formattaData(riga.applicata_il)}  ${riga.versione_app ?? ''}` : '';
    console.log(`${migrazione.nome.padEnd(48)} ${esito}${dettaglio}`);
  }
  const sconosciute = registrate.filter(r => !migrazioni.some(m => m.nome === r.nome));
  for (const riga of sconosciute) console.log(`${riga.nome.padEnd(48)} nel database, sconosciuta a questa versione`);
  console.log('='.repeat(72));

  if (registrate.length === 0)
    console.log(stato.gdo ? 'Database esistente senza storico: la baseline verra\' adottata al prossimo avvio' : 'Database vuoto: la baseline verra\' eseguita al prossimo avvio');
  const ultima = migrazioni[migrazioni.length - 1];
  console.log(ultima.schemaDopo === hashModelli
    ? 'Modelli allineati all\'ultima migrazione'
    : `Modelli DIVERSI dall'ultima migrazione (${ultima.nome}): creare una migrazione con yarn migrazioni:nuova <nome>`);
};

export const stampaVerifica = async (): Promise<void> => {
  const differenze = await verificaSchema();
  const problemi = differenze.filter(d => d.gravita === 'problema');
  const informazioni = differenze.filter(d => d.gravita === 'informazione');
  console.log(`Verifica dello schema rispetto a ${FILE_SCHEMA}`);
  console.log('='.repeat(72));
  if (problemi.length === 0) console.log('Nessuna differenza rispetto ai modelli');
  for (const d of problemi) console.log(`PROBLEMA      ${descriviDifferenza(d)}`);
  for (const d of informazioni) console.log(`informazione  ${descriviDifferenza(d)}`);
  console.log('='.repeat(72));
  console.log(`${problemi.length} problemi, ${informazioni.length} oggetti in piu' non usati dai modelli`);
};

const conDatabase = (azione: () => Promise<void>) => async () => {
  try {
    await initializeDatabase(false);
    await azione();
    await closeDatabase();
    process.exit(0);
  } catch (errore) {
    console.error(errore instanceof Error ? errore.message : errore);
    process.exit(1);
  }
};

const main = (): void => {
  program.name('migrazioni').description('Migrazioni versionate dello schema di Fidelity');

  program
    .command('nuova <nome>')
    .description('Crea la prossima migrazione con l\'hash dei modelli attuali e aggiorna schema.json')
    .action((nome: string) => {
      try {
        const nuova = creaNuovaMigrazione(nome);
        console.log(`Creata ${nuova.file}: scrivere l'SQL della migrazione`);
        console.log(`schema-dopo: ${nuova.hash}`);
        if (!nuova.modelliCambiati) console.log('I modelli non sono cambiati dall\'ultima migrazione: e\' una migrazione di soli dati');
        process.exit(0);
      } catch (errore) {
        console.error(errore instanceof Error ? errore.message : errore);
        process.exit(1);
      }
    });

  program
    .command('stato')
    .description('Migrazioni applicate e da applicare')
    .action(conDatabase(stampaStato));

  program
    .command('verifica')
    .description('Confronta in sola lettura il database con schema.json')
    .action(conDatabase(stampaVerifica));

  program
    .command('applica')
    .description('Applica le migrazioni pendenti, con lo stesso lock e lo stesso storico dell\'avvio')
    .action(conDatabase(async () => {
      const esito = await applicaMigrazioni();
      console.log(esito.applicate.length > 0 ? `Applicate: ${esito.applicate.join(', ')}` : 'Nessuna migrazione da applicare');
    }));

  program.parse();
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
