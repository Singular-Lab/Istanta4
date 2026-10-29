import { expect, it } from 'vitest';
import { describeConDatabase, usaDatabase } from '../../../../__tests__/integrazione/database';
import { applicaMigrazioni, leggiStorico } from '../applicaMigrazioni';
import { leggiMigrazioni } from '../fileMigrazioni';
import { verificaSchema } from '../verificaSchema';

// Il database di test nasce vuoto e globalSetup gli applica le migrazioni come a una installazione
// nuova: qui si verifica il risultato (spec installazione-iniziale, migrazioni applicate all'avvio).
describeConDatabase('migrazioni su un database vuoto', () => {
  usaDatabase();

  it('registra nello storico tutte le migrazioni del repository, in ordine', async () => {
    const storico = await leggiStorico();

    expect(storico.map(r => r.nome)).toEqual(leggiMigrazioni().map(m => m.nome));
    expect(storico.every(r => r.modo === 'eseguita')).toBe(true);
  });

  it('una seconda esecuzione non applica nulla', async () => {
    const esito = await applicaMigrazioni();

    expect(esito.applicate).toEqual([]);
  });

  it('lo schema ottenuto coincide con quello dei modelli', async () => {
    const problemi = (await verificaSchema()).filter(d => d.gravita === 'problema');

    expect(problemi).toEqual([]);
  });
});
