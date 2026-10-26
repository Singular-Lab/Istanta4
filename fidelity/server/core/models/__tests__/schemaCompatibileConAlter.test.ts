import { describe, expect, it } from 'vitest';
import { MODELLI_SEQUELIZE } from '../index';
import { configuraRelazioni } from '../relazioni';

/**
 * models:sync allinea lo schema con l'ALTER di Sequelize 6, che su PostgreSQL
 * genera SQL non valido in alcuni casi. Un modello in uno di questi casi non si
 * sincronizza piu': la sync si ferma alla prima colonna in errore e le colonne
 * aggiunte dalle versioni nuove non arrivano nel database.
 *
 * I controlli qui sotto non usano il database: leggono le definizioni dei
 * modelli e falliscono se uno di questi casi si ripresenta.
 */
configuraRelazioni();

const modelli = Object.values(MODELLI_SEQUELIZE).map(({ nome, model }) => ({ nome, model: model as any }));

const colonne = () =>
  modelli.flatMap(({ nome, model }) =>
    Object.entries<any>(model.rawAttributes).map(([colonna, attributo]) => ({ nome, model, colonna, attributo }))
  );

describe('modelli compatibili con l\'ALTER di models:sync', () => {
  it('nessun indice ha un nome oltre i 63 caratteri', () => {
    // PostgreSQL tronca il nome, Sequelize non lo riconosce e prova a ricrearlo:
    // "la relazione ... esiste gia'".
    const lunghi = modelli.flatMap(({ nome, model }) =>
      (model._indexes as { name?: string }[])
        .filter(indice => (indice.name ?? '').length > 63)
        .map(indice => `${nome}: ${indice.name}`)
    );
    expect(lunghi).toEqual([]);
  });

  it('nessuna colonna ENUM ha un comment', () => {
    // Sequelize aggiunge USING dopo il COMMENT ON: "errore di sintassi a o presso USING".
    const conCommento = colonne()
      .filter(({ attributo }) => attributo.type?.key === 'ENUM' && attributo.comment)
      .map(({ nome, colonna }) => `${nome}.${colonna}`);
    expect(conCommento).toEqual([]);
  });

  it('nessuna colonna e\' un array di ENUM', () => {
    // Sequelize converte la colonna nel tipo enum singolo:
    // "non e' possibile convertire il tipo enum_...[] in enum_...".
    const arrayDiEnum = colonne()
      .filter(({ attributo }) => attributo.type?.key === 'ARRAY' && attributo.type.type?.key === 'ENUM')
      .map(({ nome, colonna }) => `${nome}.${colonna}`);
    expect(arrayDiEnum).toEqual([]);
  });

  it('l\'unicita\' di una colonna sta negli indici, non sulla colonna', () => {
    // Con unique sulla colonna Sequelize aggiunge un vincolo nuovo a ogni sync, e
    // con un comment genera "TYPE VARCHAR(50) UNIQUE", che non e' valido.
    const uniche = colonne()
      .filter(({ attributo }) => attributo.unique && !attributo.primaryKey)
      .map(({ nome, colonna }) => `${nome}.${colonna}`);
    expect(uniche).toEqual([]);
  });

  it('ogni chiave esterna ha lo stesso tipo della chiave a cui punta', () => {
    // Con tipi diversi PostgreSQL non crea il vincolo e la tabella non viene
    // creata: era il caso di tracciati.id_promo_tracciati (UUID) verso
    // promo.id_promo (VARCHAR).
    const perTabella = new Map(modelli.map(({ model }) => [model.getTableName().toString(), model]));
    const diverse: string[] = [];
    for (const { nome, colonna, attributo } of colonne()) {
      if (!attributo.references) continue;
      const tabella = typeof attributo.references.model === 'string'
        ? attributo.references.model
        : attributo.references.model.tableName;
      const destinazione = perTabella.get(tabella);
      if (!destinazione) continue;
      const chiave = attributo.references.key ?? 'id';
      const puntata = Object.values<any>(destinazione.rawAttributes)
        .find(a => a.field === chiave || a.fieldName === chiave);
      if (puntata && puntata.type.key !== attributo.type.key)
        diverse.push(`${nome}.${colonna} (${attributo.type.key}) -> ${tabella}.${chiave} (${puntata.type.key})`);
    }
    expect(diverse).toEqual([]);
  });

  it('il controllo delle chiavi esterne vede anche quella dei tracciati', () => {
    // Le references le aggiunge configuraRelazioni: senza, il test qui sopra
    // passerebbe senza controllare nulla.
    const tracciati = modelli.find(({ nome }) => nome === 'Tracciati')!.model;
    expect(tracciati.rawAttributes.id_promo_tracciati.references).toBeTruthy();
  });
});
