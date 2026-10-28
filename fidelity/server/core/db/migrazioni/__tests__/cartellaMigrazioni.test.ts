import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analizzaMigrazione,
  checksumSql,
  FILE_BASELINE,
  leggiMigrazioni,
  Migrazione,
  SEGNAPOSTO_HASH,
  verificaNumerazione,
} from '../fileMigrazioni';
import { hashSchemaModelli } from '../schemaModelli';

/**
 * Controlli di CI sulla cartella delle migrazioni, senza database. All'avvio gli stessi controlli
 * fermano il server: meglio scoprirli qui.
 */

// La baseline e' congelata: rilasciata, non cambia piu'. Le modifiche vanno in una migrazione nuova.
const CHECKSUM_BASELINE = 'ac9a1c79a7b29354266acbc7361f819127ecd0ff9541284fdf046bd50471ae5d';

const HASH = 'a'.repeat(64);

describe('cartella delle migrazioni', () => {
  const migrazioni = leggiMigrazioni();

  it('ha una numerazione unica e contigua da 0000, che parte dalla baseline', () => {
    expect(migrazioni.map(m => m.numero)).toEqual(migrazioni.map((_m, indice) => indice));
    expect(`${migrazioni[0].nome}.sql`).toBe(FILE_BASELINE);
  });

  it('l\'intestazione dell\'ultima migrazione e\' l\'hash dei modelli attuali', () => {
    // Se fallisce: un modello e' cambiato senza migrazione. yarn migrazioni:nuova <nome>
    expect(migrazioni[migrazioni.length - 1].schemaDopo).toBe(hashSchemaModelli());
  });

  it('la baseline e\' congelata', () => {
    expect(migrazioni[0].checksum).toBe(CHECKSUM_BASELINE);
  });
});

describe('lettura di una migrazione', () => {
  it('legge l\'hash e l\'opzione senza-transazione dalle righe di commento in testa', () => {
    const normale = analizzaMigrazione('0001_uno.sql', `-- schema-dopo: ${HASH}\n-- Cosa fa.\nSELECT 1;\n`);
    const fuori = analizzaMigrazione('0002_due.sql', `-- schema-dopo: ${HASH}\n-- senza-transazione\nCREATE INDEX CONCURRENTLY i ON t (c);\n`);

    expect(normale).toMatchObject({ numero: 1, nome: '0001_uno', schemaDopo: HASH, senzaTransazione: false });
    expect(fuori.senzaTransazione).toBe(true);
  });

  it('senza intestazione schema-dopo non si applica', () => {
    expect(() => analizzaMigrazione('0001_uno.sql', 'SELECT 1;\n')).toThrow(/manca l'intestazione "-- schema-dopo: <hash>"/);
    // Dopo la prima istruzione non e' piu' intestazione
    expect(() => analizzaMigrazione('0001_uno.sql', `SELECT 1;\n-- schema-dopo: ${HASH}\n`)).toThrow(/manca l'intestazione/);
  });

  it(`con l'hash ancora ${SEGNAPOSTO_HASH} non si applica`, () => {
    expect(() => analizzaMigrazione('0001_uno.sql', `-- schema-dopo: ${SEGNAPOSTO_HASH}\nSELECT 1;\n`)).toThrow(/DA_CALCOLARE/);
  });

  it('un hash che non e\' uno sha256 non si applica', () => {
    expect(() => analizzaMigrazione('0001_uno.sql', '-- schema-dopo: abc\nSELECT 1;\n')).toThrow(/non e' uno sha256/);
  });

  it('BEGIN e COMMIT non sono ammessi; END; dei blocchi PL/pgSQL si', () => {
    expect(() => analizzaMigrazione('0001_uno.sql', `-- schema-dopo: ${HASH}\nBEGIN;\nSELECT 1;\nCOMMIT;\n`)).toThrow(/BEGIN\/COMMIT/);
    expect(() => analizzaMigrazione('0001_uno.sql', `-- schema-dopo: ${HASH}\nDO $$\nBEGIN\n  BEGIN\n    PERFORM 1;\n  END;\nEND $$;\n`)).not.toThrow();
  });

  it('il nome del file deve essere NNNN_nome.sql', () => {
    expect(() => analizzaMigrazione('1_uno.sql', `-- schema-dopo: ${HASH}\n`)).toThrow(/NNNN_nome\.sql/);
    expect(() => analizzaMigrazione('0001_Uno.sql', `-- schema-dopo: ${HASH}\n`)).toThrow(/NNNN_nome\.sql/);
  });

  it('il checksum non dipende dai fine riga', () => {
    expect(checksumSql('SELECT 1;\r\nSELECT 2;\r\n')).toBe(checksumSql('SELECT 1;\nSELECT 2;\n'));
  });
});

describe('numerazione', () => {
  const m = (nome: string): Migrazione => analizzaMigrazione(`${nome}.sql`, `-- schema-dopo: ${HASH}\n`);

  it('un buco nella numerazione ferma tutto', () => {
    expect(() => verificaNumerazione([m('0000_baseline'), m('0002_due')])).toThrow(/non contigua: attesa 0001, trovata 0002_due/);
  });

  it('due migrazioni con lo stesso numero fermano tutto', () => {
    expect(() => verificaNumerazione([m('0000_baseline'), m('0001_uno'), m('0001_altro')])).toThrow(/stesso numero: 0001_uno, 0001_altro/);
  });

  it('senza migrazioni non si parte', () => {
    expect(() => verificaNumerazione([])).toThrow(/0000_baseline\.sql/);
  });
});

describe('leggiMigrazioni', () => {
  let cartella: string;

  afterEach(() => {
    rmSync(cartella, { recursive: true, force: true });
  });

  it('legge i file in ordine di numero e rifiuta un file con l\'hash da calcolare', () => {
    cartella = mkdtempSync(path.join(tmpdir(), 'migrazioni-'));
    writeFileSync(path.join(cartella, '0001_uno.sql'), `-- schema-dopo: ${HASH}\nSELECT 1;\n`);
    writeFileSync(path.join(cartella, '0000_baseline.sql'), `-- schema-dopo: ${HASH}\nSELECT 0;\n`);
    writeFileSync(path.join(cartella, 'LEGGIMI.md'), 'non e\' una migrazione');

    expect(leggiMigrazioni(cartella).map(x => x.nome)).toEqual(['0000_baseline', '0001_uno']);

    writeFileSync(path.join(cartella, '0002_due.sql'), `-- schema-dopo: ${SEGNAPOSTO_HASH}\nSELECT 2;\n`);
    expect(() => leggiMigrazioni(cartella)).toThrow(/0002_due\.sql: l'intestazione schema-dopo e' ancora DA_CALCOLARE/);
  });
});
