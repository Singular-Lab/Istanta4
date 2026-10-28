import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODELLI_SEQUELIZE } from '../../../models';
import { FILE_SCHEMA } from '../fileMigrazioni';
import { generaBaseline } from '../generaBaseline';
import {
  descriviSchemaModelli,
  hashSchema,
  hashSchemaModelli,
  jsonCanonico,
  normalizzaTipo,
  testoSchema,
} from '../schemaModelli';

/**
 * La descrizione dei modelli e' cio' che lega codice e migrazioni: il suo hash sta in testa a
 * ogni migrazione e all'avvio si confronta con i modelli. Nessun database: solo le definizioni.
 */
describe('descrizione dello schema dei modelli', () => {
  it('e\' deterministica: due descrizioni danno lo stesso testo e lo stesso hash', () => {
    expect(testoSchema(descriviSchemaModelli())).toBe(testoSchema(descriviSchemaModelli()));
    expect(hashSchemaModelli()).toBe(hashSchemaModelli());
    expect(hashSchemaModelli()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('coincide con schema.json: un modello cambiato va accompagnato da yarn migrazioni:nuova', () => {
    const salvato = readFileSync(FILE_SCHEMA, 'utf8').replace(/\r\n/g, '\n');
    expect(testoSchema(descriviSchemaModelli())).toBe(salvato);
  });

  it('l\'hash cambia quando cambia un modello', () => {
    const prima = hashSchemaModelli();
    const attributo = (MODELLI_SEQUELIZE.GDO.model as any).rawAttributes.nome_gdo;
    const allowNull = attributo.allowNull;
    try {
      attributo.allowNull = !allowNull;
      expect(hashSchemaModelli()).not.toBe(prima);
    } finally {
      attributo.allowNull = allowNull;
    }
    expect(hashSchemaModelli()).toBe(prima);
  });

  it('descrive colonne, chiavi esterne, indici ed enum', () => {
    const { tabelle, enum: enumerazioni } = descriviSchemaModelli();

    expect(tabelle.aree.colonne.id_gdo_aree).toMatchObject({
      tipo: 'uuid', nullable: false, riferimento: { tabella: 'gdo', colonna: 'id_gdo', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
    });
    expect(tabelle.utenti.colonne.geom_utenti.tipo).toBe('geometry(point,4326)');
    expect(tabelle.permessi_ruolo.indici).toContainEqual(expect.objectContaining({
      nome: 'permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo', unico: true,
    }));
    expect(enumerazioni.enum_attivita_priorita_attivita).toEqual(['ALTA', 'MEDIA', 'BASSA']);
  });

  it('usa i nomi come li salva PostgreSQL, troncati a 63 caratteri', () => {
    const { tabelle, enum: enumerazioni } = descriviSchemaModelli();
    const tipo = tabelle.gdo_whatsapp_conversations.colonne.last_direction_gdowhatsappconversation.tipo;

    expect(tipo).toHaveLength(63);
    expect(enumerazioni[tipo]).toEqual(['in', 'out']);
    expect(Object.keys(enumerazioni).every(nome => nome.length <= 63)).toBe(true);
  });

  it('lascia fuori le tabelle ponte di belongsToMany, che la sincronizzazione non ha mai creato', () => {
    const { tabelle } = descriviSchemaModelli();

    expect(Object.keys(tabelle)).toHaveLength(Object.keys(MODELLI_SEQUELIZE).length);
    expect(tabelle).not.toHaveProperty('raccoglitore_kit_aree');
  });

  it('jsonCanonico ordina le chiavi a ogni livello e lascia gli array come sono', () => {
    expect(jsonCanonico({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
    expect(hashSchema({ formato: 1, tabelle: {}, enum: {} })).toBe(hashSchema({ enum: {}, tabelle: {}, formato: 1 } as any));
  });

  it('normalizza i tipi di Sequelize come format_type() di PostgreSQL', () => {
    expect(normalizzaTipo('VARCHAR(255)')).toBe('character varying(255)');
    expect(normalizzaTipo('DECIMAL(10, 8)')).toBe('numeric(10,8)');
    expect(normalizzaTipo('FLOAT')).toBe('double precision');
    expect(normalizzaTipo('TIMESTAMP WITH TIME ZONE')).toBe('timestamp with time zone');
    expect(normalizzaTipo('GEOMETRY(POINT,4326)')).toBe('geometry(point,4326)');
    expect(normalizzaTipo('TIME')).toBe('time without time zone');
  });
});

describe('generatore della baseline', () => {
  const baseline = generaBaseline();
  const ordineTabelle = [...baseline.sql.matchAll(/^CREATE TABLE IF NOT EXISTS "([^"]+)"/gm)].map(m => m[1]);

  it('ha in testa l\'hash della descrizione dei modelli', () => {
    expect(baseline.sql.split('\n')[0]).toBe(`-- schema-dopo: ${hashSchemaModelli()}`);
    expect(baseline.hash).toBe(hashSchemaModelli());
  });

  it('crea ogni tabella dei modelli una volta, dopo quelle a cui punta', () => {
    const { tabelle } = baseline.descrizione;
    expect([...ordineTabelle].sort()).toEqual(Object.keys(tabelle).sort());

    const fuoriOrdine: string[] = [];
    for (const [tabella, definizione] of Object.entries(tabelle)) {
      for (const colonna of Object.values(definizione.colonne)) {
        const puntata = colonna.riferimento?.tabella;
        if (puntata && puntata !== tabella && ordineTabelle.indexOf(puntata) > ordineTabelle.indexOf(tabella))
          fuoriOrdine.push(`${tabella} -> ${puntata}`);
      }
    }
    expect(fuoriOrdine).toEqual([]);
  });

  it('e\' rieseguibile: estensioni ed enum solo se mancano, indici IF NOT EXISTS', () => {
    expect(baseline.sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'\)/);
    expect(baseline.sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'postgis'\)/);
    expect(baseline.sql.match(/CREATE TYPE /g)).toHaveLength(Object.keys(baseline.descrizione.enum).length);
    expect(baseline.sql.match(/WHERE t\.typname = /g)).toHaveLength(Object.keys(baseline.descrizione.enum).length);
    const indici = baseline.sql.match(/^CREATE (UNIQUE )?INDEX .*$/gm) ?? [];
    expect(indici).toHaveLength(baseline.statistiche.indici);
    expect(indici.every(riga => /^CREATE (UNIQUE )?INDEX IF NOT EXISTS /.test(riga))).toBe(true);
    // La transazione la apre il runner
    expect(baseline.sql).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/m);
  });

  it('una estensione che non si puo\' creare da\' un errore che spiega cosa fare', () => {
    expect(baseline.sql).toContain('Va creata da un superuser: CREATE EXTENSION "uuid-ossp"');
  });
});
