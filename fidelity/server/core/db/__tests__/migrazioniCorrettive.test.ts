import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_ORDINI_STAMPA } from '../../../../lib/enums';
import { OrdiniDiStampa } from '../../models/ordini_di_stampa';
import { GDOWhatsappPreset } from '../../models/whatsapp/gdo_whatsapp_preset';
import { CARTELLA_SQL, FILE_SCHEMA } from '../migrazioni/fileMigrazioni';
import type { DescrizioneSchema } from '../migrazioni/schemaModelli';

// Migrazioni 0004-0009: portano le installazioni esistenti allo schema dei
// modelli (yarn migrazioni:verifica su una copia reale trovava 37 differenze).
// Girano su database creati dalla baseline, adottati o vecchi: ogni passo deve
// controllare prima lo stato, non perdere dati e restare allineato a
// schema.json. Nessun database: si controlla il testo SQL.
const leggi = (file: string) => readFileSync(path.join(CARTELLA_SQL, file), 'utf8');
const schema: DescrizioneSchema = JSON.parse(readFileSync(FILE_SCHEMA, 'utf8'));
const colonna = (tabella: string, nome: string) => {
  const trovata = schema.tabelle[tabella]?.colonne[nome];
  if (!trovata) throw new Error(`${tabella}.${nome} non e' in schema.json`);
  return trovata;
};

const ENUM = '0004_enum_del_modello.sql';
const OBBLIGATORIETA = '0005_obbligatorieta.sql';
const DATE = '0006_date_con_fuso.sql';
const LUNGHEZZE = '0007_lunghezze.sql';
const INDICI = '0008_indici.sql';
const PULIZIA = '0009_pulizia_oggetti_inutilizzati.sql';
const CORRETTIVE = [ENUM, OBBLIGATORIETA, DATE, LUNGHEZZE, INDICI, PULIZIA];

/** Solo il codice: i commenti possono citare istruzioni che non si eseguono. */
const senzaCommenti = (sql: string) => sql.replace(/--[^\n]*/g, '');

describe('migrazioni correttive 0004-0009', () => {
  it('sono rieseguibili nella transazione del runner e non toccano le righe', () => {
    for (const file of CORRETTIVE) {
      const sql = leggi(file);
      const codice = senzaCommenti(sql);
      expect(sql.split('\n')[0], file).toMatch(/^-- schema-dopo: [0-9a-f]{64}$/);
      expect(sql, file).not.toMatch(/^--\s*senza-transazione/im);
      expect(codice, file).not.toMatch(/\bCONCURRENTLY\b/i);
      // Cambiano lo schema, non i dati: niente righe eliminate o riscritte, niente CASCADE
      expect(codice, file).not.toMatch(/\b(?:DELETE\s+FROM|UPDATE\s+public\.|TRUNCATE|INSERT\s+INTO)\b/i);
      expect(codice, file).not.toMatch(/\bCASCADE\b/i);
    }
  });
});

describe('0004: enum dei modelli', () => {
  const sql = leggi(ENUM);
  const righe = [...sql.matchAll(/\('(\w+)', '(\w+)', '(\w+)',\s+ARRAY\[([^\]]+)\], (NULL|'[^']*')\)/g)]
    .map(([, tabella, nome, tipo, valori, predefinito]) => ({
      tabella, nome, tipo,
      valori: [...valori.matchAll(/'([^']*)'/g)].map(([, valore]) => valore),
      predefinito: predefinito === 'NULL' ? null : predefinito,
    }));

  it('converte le colonne con i tipi delle versioni precedenti e le VARCHAR di attivita', () => {
    expect(righe.map(r => `${r.tabella}.${r.nome}`)).toEqual([
      'utenti.stato_utenti',
      'utenti.tipo_utenti',
      'attivita.tipo_attivita',
      'attivita.categoria_attivita',
      'attivita.priorita_attivita',
      'combinazione_canale_area.stato_combinazione_canale_area',
      'ordini_stampa.stato_ordinistampa',
      'tipi_export.modalita_tipiexport',
    ]);
  });

  it('usa gli enum, i valori e i default di schema.json', () => {
    for (const r of righe) {
      const atteso = colonna(r.tabella, r.nome);
      expect(r.tipo, r.nome).toBe(atteso.tipo);
      expect(r.valori, r.nome).toEqual(schema.enum[r.tipo]);
      expect(r.predefinito, r.nome).toBe(atteso.default);
    }
    // Il motivo per cui serve: il blocco dell'invio FTP scrive IN_INVIO
    expect(righe.find(r => r.nome === 'stato_ordinistampa')?.valori).toContain(STATO_ORDINI_STAMPA.IN_INVIO);
  });

  it('salta le colonne che usano gia\' l\'enum del modello (database della baseline)', () => {
    expect(sql).toMatch(/IF tipo_modello IS NOT NULL AND tipo_attuale = tipo_modello THEN\s+CONTINUE;/);
    expect(sql).toContain("RAISE NOTICE 'Colonna %.% assente: non si converte'");
  });

  it('si ferma con l\'elenco dei valori nei dati che il modello non prevede', () => {
    expect(sql).toMatch(/WHERE %1\$I IS NOT NULL AND NOT \(%1\$I::text = ANY \(\$1\)\)',\s+r\.colonna, r\.tabella\)\s+INTO sconosciuti USING r\.valori;/);
    expect(sql).toMatch(/IF sconosciuti IS NOT NULL THEN\s+RAISE EXCEPTION 'Colonna %\.%: valori % non previsti/);
    // Il controllo viene prima di ogni modifica
    expect(sql.indexOf('INTO sconosciuti')).toBeLessThan(sql.indexOf('CREATE TYPE'));
    expect(sql.indexOf('INTO sconosciuti')).toBeLessThan(sql.indexOf('ALTER TABLE'));
  });

  it('crea l\'enum completo se manca, e aggiunge valori solo a un enum usato da altre colonne', () => {
    expect(sql).toMatch(/IF tipo_modello IS NULL THEN\s+EXECUTE format\('CREATE TYPE public\.%I AS ENUM \(%s\)', r\.tipo, elenco\);/);
    // Enum incompleto e inutilizzato: si ricrea, cosi' i valori si usano subito
    expect(sql).toMatch(/EXECUTE format\('DROP TYPE public\.%I', r\.tipo\);\s+EXECUTE format\('CREATE TYPE public\.%I AS ENUM \(%s\)', r\.tipo, elenco\);\s+EXCEPTION WHEN dependent_objects_still_exist THEN/);
    // ADD VALUE solo li', e i valori aggiunti non si possono usare nella stessa transazione
    expect(senzaCommenti(sql).match(/ADD VALUE IF NOT EXISTS/g)).toHaveLength(1);
    expect(sql).toMatch(/EXCEPTION WHEN dependent_objects_still_exist THEN\s+FOREACH valore IN ARRAY mancanti LOOP\s+EXECUTE format\('ALTER TYPE public\.%I ADD VALUE IF NOT EXISTS %L'/);
    expect(sql).toMatch(/IF usati IS NOT NULL THEN\s+RAISE EXCEPTION/);
  });

  it('toglie il default, converte passando dal testo e rimette il default del modello', () => {
    const toglie = sql.indexOf("'ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT'");
    const converte = sql.indexOf("'ALTER TABLE public.%1$I ALTER COLUMN %2$I TYPE public.%3$I USING %2$I::text::public.%3$I'");
    const rimette = sql.indexOf("'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %L::public.%I'");
    expect(toglie).toBeGreaterThan(0);
    expect(converte).toBeGreaterThan(toglie);
    expect(rimette).toBeGreaterThan(converte);
    expect(sql).toMatch(/IF r\.predefinito IS NOT NULL THEN\s+EXECUTE format\('ALTER TABLE public\.%I ALTER COLUMN %I SET DEFAULT/);
  });

  it('elimina i tipi vecchi solo se niente li usa piu\'', () => {
    expect(sql).toMatch(/AND typtype = 'e'\)\s+AND NOT \(tipo_attuale = ANY \(vecchi\)\) THEN\s+vecchi := vecchi \|\| tipo_attuale;/);
    expect(sql).toMatch(/EXECUTE format\('DROP TYPE %s', nome_vecchio\);[\s\S]*?EXCEPTION WHEN dependent_objects_still_exist THEN\s+RAISE NOTICE 'Tipo % ancora usato: non si elimina'/);
  });
});

describe('0005: obbligatorieta\'', () => {
  const sql = leggi(OBBLIGATORIETA);
  const [facoltative, obbligatorie] = [...sql.matchAll(/SELECT \* FROM \(VALUES([\s\S]*?)\) AS v\(tabella, colonna\)/g)]
    .map(([, blocco]) => [...blocco.matchAll(/\('(\w+)', '(\w+)'\)/g)].map(([, tabella, nome]) => `${tabella}.${nome}`));

  it('rende facoltative le colonne dove il codice scrive NULL, come nel modello', () => {
    expect(facoltative).toEqual(['attivita.idutente_attivita', 'attivita.meta_attivita']);
    for (const voce of facoltative) {
      const [tabella, nome] = voce.split('.');
      expect(colonna(tabella, nome).nullable, voce).toBe(true);
    }
    expect(sql).toMatch(/AND column_name = r\.colonna AND is_nullable = 'NO'\s+\) THEN\s+EXECUTE format\('ALTER TABLE public\.%I ALTER COLUMN %I DROP NOT NULL'/);
  });

  it('rende obbligatorie le colonne obbligatorie nel modello, solo senza righe NULL', () => {
    expect(obbligatorie).toEqual([
      'attivita.tipo_attivita',
      'ordini_stampa.createdat',
      'ordini_stampa.updatedat',
      'gdo_whatsapp_presets.id_gdowhatsappreset',
      'utenti_guest.id_UtentiGuest',
      'tipi_export.modalita_tipiexport',
      'utenti.tipo_utenti',
      'utenti.createdat',
      'utenti.updatedat',
    ]);
    for (const voce of obbligatorie) {
      const [tabella, nome] = voce.split('.');
      expect(colonna(tabella, nome).nullable, voce).toBe(false);
    }
    // Prima il conteggio, poi (solo con zero NULL) il vincolo
    expect(sql).toMatch(/'SELECT count\(\*\) FROM public\.%I WHERE %I IS NULL', r\.tabella, r\.colonna\) INTO nulli;\s+IF nulli > 0 THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;\s+END IF;\s+EXECUTE format\('ALTER TABLE public\.%I ALTER COLUMN %I SET NOT NULL'/);
  });

  it('le date degli ordini, ora obbligatorie, le valorizza il modello: creare un ordine senza date resta valido', async () => {
    // Come OrdiniStampaService.creaOrdineStampa, che non indica createdat e updatedat
    const ordine = OrdiniDiStampa.build({
      idutente_ordinistampa: '00000000-0000-0000-0000-000000000001',
      id_promo_ordinistampa: 'promo-1',
      stato_ordinistampa: STATO_ORDINI_STAMPA.IN_REVISIONE,
      data_di_conferma_ordinistampa: new Date().toISOString(),
    });

    // Con allowNull: false e senza default la validazione darebbe "createdat cannot be null"
    await ordine.validate();
    expect(ordine.createdat).toBeInstanceOf(Date);
    expect(ordine.updatedat).toBeInstanceOf(Date);
    // La colonna storica resta facoltativa e il codice non la scrive
    expect(ordine.datadiconferma_ordinistampa).toBeUndefined();
  });
});

describe('0006: date con fuso', () => {
  const sql = leggi(DATE);
  const righe = [...sql.matchAll(/\((\d+), '(\w+)', '(\w+)', '([^']+)'\)/g)]
    .map(([, , tabella, nome, fuso]) => ({ voce: `${tabella}.${nome}`, tabella, nome, fuso }));

  it('converte le colonne senza fuso che i modelli vogliono con fuso', () => {
    expect(righe.map(r => r.voce)).toEqual([
      'attivita.createdat',
      'attivita.updatedat',
      'attivita.expires_at',
      'combinazione_canale_area.createdat',
      'combinazione_canale_area.updatedat',
      'ordini_stampa.createdat',
      'ordini_stampa.updatedat',
      'utenti.createdat',
      'utenti.updatedat',
    ]);
    for (const r of righe) expect(colonna(r.tabella, r.nome).tipo, r.voce).toBe('timestamp with time zone');
  });

  it('legge l\'ora nel fuso di chi la scrive: UTC, perche\' Sequelize apre le sessioni in UTC', () => {
    // Anche default e trigger scrivono in una sessione di Sequelize, aperta con SET TIME ZONE '+00:00'
    for (const r of righe) expect(r.fuso, r.voce).toBe('UTC');
    expect(sql).toContain("SET TIME ZONE INTERVAL '+00:00'");
    expect(sql).toContain("'ALTER COLUMN %1$I TYPE TIMESTAMP WITH TIME ZONE USING %1$I AT TIME ZONE %2$L'");
  });

  it('tocca solo le colonne ancora senza fuso, con una sola ALTER per tabella', () => {
    expect(sql).toMatch(/WHERE c\.data_type = 'timestamp without time zone'\s+GROUP BY v\.tabella/);
    expect(sql).toContain("EXECUTE format('ALTER TABLE public.%I %s', r.tabella, r.modifiche);");
    // I default CURRENT_TIMESTAMP restano: niente DROP DEFAULT
    expect(senzaCommenti(sql)).not.toMatch(/DROP DEFAULT/);
  });
});

describe('0007: lunghezze', () => {
  const sql = leggi(LUNGHEZZE);
  const righe = [...sql.matchAll(/\('(\w+)', '(\w+)', (\d+)\)/g)]
    .map(([, tabella, nome, lunghezza]) => ({ voce: `${tabella}.${nome}`, tabella, nome, lunghezza: Number(lunghezza) }));

  it('usa le lunghezze dei modelli', () => {
    expect(righe.map(r => r.voce)).toEqual([
      'ordini_stampa.id_promo_ordinistampa',
      'tracciati.id_promo_tracciati',
      'utenti.privatekey_utenti',
      'utenti.telefono_utenti',
    ]);
    for (const r of righe) expect(colonna(r.tabella, r.nome).tipo, r.voce).toBe(`character varying(${r.lunghezza})`);
  });

  it('non tronca: con un valore piu\' lungo lascia la colonna com\'e\'', () => {
    expect(sql).toMatch(/EXECUTE format\('SELECT max\(length\(%I\)\) FROM public\.%I', r\.colonna, r\.tabella\) INTO massima;\s+IF massima > r\.lunghezza THEN\s+RAISE NOTICE[\s\S]*?CONTINUE;\s+END IF;\s+EXECUTE format\('ALTER TABLE public\.%I ALTER COLUMN %I TYPE VARCHAR\(%s\)'/);
    // Solo i VARCHAR da cambiare
    expect(sql).toMatch(/OR tipo_attuale NOT LIKE 'character varying%'\s+OR tipo_attuale = format\('character varying\(%s\)', r\.lunghezza\) THEN\s+CONTINUE;/);
  });
});

describe('0008: indici', () => {
  const sql = leggi(INDICI);
  const righe = [...sql.matchAll(/\('(\w+)', '(\w+)', ARRAY\[[^\]]*\], '([^']+)'\)/g)]
    .map(([, nome, tabella, elenco]) => ({ nome, tabella, elenco }));
  const indice = (tabella: string, nome: string) => schema.tabelle[tabella].indici.find(i => i.nome === nome);

  it('crea gli indici con i nomi e le colonne dei modelli', () => {
    expect(righe.map(r => r.nome)).toEqual([
      'utenti_tipo_utenti',
      'utenti_stato_utenti',
      'utenti_nome_utenti_cognome_utenti',
      'promo_gdo_stato',
      'promo_validita_dal_validita_al',
      'tracciati_id_promo_tracciati',
      'attivita_idutente_attivita_createdat',
      'files_runtime_log_kit_file_versione',
    ]);
    for (const r of righe) {
      const atteso = indice(r.tabella, r.nome);
      expect(atteso, r.nome).toBeDefined();
      expect(r.elenco, r.nome).toBe(atteso!.colonne.join(', '));
      expect(atteso!.unico, r.nome).toBe(false);
    }
    expect(sql).toContain("EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', r.nome, r.tabella, r.elenco);");
    // Tabella o colonne assenti: avviso, non errore
    expect(sql).toMatch(/< cardinality\(r\.colonne\) THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;/);
  });

  it('copre tutti gli indici del modello di utenti', () => {
    const creati = [...righe.filter(r => r.tabella === 'utenti').map(r => r.nome), 'utenti_meta_utenti', 'utenti_email_utenti'];
    expect(creati.sort()).toEqual(schema.tabelle.utenti.indici.map(i => i.nome).sort());
  });

  it('utenti_meta_utenti e\' GIN, e un btree esistente si sostituisce', () => {
    expect(indice('utenti', 'utenti_meta_utenti')?.metodo).toBe('gin');
    expect(sql).toMatch(/IF definizione IS NOT NULL AND definizione NOT ILIKE '%USING gin%' THEN\s+DROP INDEX public\.utenti_meta_utenti;/);
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS utenti_meta_utenti ON public.utenti USING gin (meta_utenti);');
    expect(sql).toMatch(/column_name = 'meta_utenti' AND udt_name = 'jsonb'/);
  });

  it('utenti_email_utenti e\' univoco e si crea solo senza email ripetute', () => {
    expect(indice('utenti', 'utenti_email_utenti')?.unico).toBe(true);
    expect(sql).toMatch(/GROUP BY email_utenti HAVING count\(\*\) > 1\s+\) THEN\s+RAISE NOTICE[^;]*;\s+ELSE\s+CREATE UNIQUE INDEX utenti_email_utenti ON public\.utenti \(email_utenti\);/);
  });

  it('gli indici parziali di attivita creati da 0001 sono ora nel modello', () => {
    for (const nome of ['idx_attivita_expires_at', 'idx_attivita_categoria', 'idx_attivita_priorita']) {
      const atteso = indice('attivita', nome);
      expect(atteso, nome).toBeDefined();
      expect(atteso!.condizione, nome).toMatch(/IS NOT NULL$/);
    }
  });
});

describe('0009: pulizia degli oggetti inutilizzati', () => {
  const sql = leggi(PULIZIA);
  const codice = senzaCommenti(sql);

  it('tiene datadiconferma_ordinistampa, la aggiunge dove manca e la rende facoltativa come nel modello', () => {
    expect(colonna('ordini_stampa', 'datadiconferma_ordinistampa')).toMatchObject({ tipo: 'timestamp without time zone', nullable: true });
    expect(sql).toContain('ALTER TABLE public.ordini_stampa ADD COLUMN IF NOT EXISTS datadiconferma_ordinistampa TIMESTAMP;');
    expect(sql).toMatch(/column_name = 'datadiconferma_ordinistampa' AND is_nullable = 'NO'\s+\) THEN\s+ALTER TABLE public\.ordini_stampa ALTER COLUMN datadiconferma_ordinistampa DROP NOT NULL;/);
    expect(codice).not.toMatch(/DROP\s+COLUMN\s+(?:IF EXISTS\s+)?datadiconferma/i);
  });

  it('elimina le colonne con la vecchia denominazione solo se sono tutte NULL', () => {
    expect(sql).toContain("FOREACH colonna IN ARRAY ARRAY['sesso_Utenti', 'meta_Utenti'] LOOP");
    expect(sql).toMatch(/WHERE %I IS NOT NULL\)', colonna\) INTO valorizzata;\s+IF valorizzata THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;\s+END IF;\s+EXECUTE format\('ALTER TABLE public\.utenti DROP COLUMN %I', colonna\);/);
    // Mai le colonne del modello
    expect(codice).not.toMatch(/DROP COLUMN (?:IF EXISTS )?(?:sesso_utenti|meta_utenti)\b/);
  });

  it('elimina le tabelle senza modello solo se vuote e non puntate da chiavi esterne', () => {
    expect(sql).toContain("FOREACH tabella IN ARRAY ARRAY['foto_referenze', 'tipo_utente_punto_vendita'] LOOP");
    const chiavi = sql.indexOf("WHERE contype = 'f'");
    const vuota = sql.indexOf("'SELECT EXISTS (SELECT 1 FROM public.%I)', tabella) INTO piena;");
    const elimina = sql.indexOf("EXECUTE format('DROP TABLE public.%I', tabella);");
    expect(chiavi).toBeGreaterThan(0);
    expect(vuota).toBeGreaterThan(chiavi);
    expect(elimina).toBeGreaterThan(vuota);
    expect(sql).toMatch(/IF piena THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;/);
    for (const tabella of ['foto_referenze', 'tipo_utente_punto_vendita']) expect(schema.tabelle).not.toHaveProperty(tabella);
  });

  it('toglie l\'indice univoco legacy di permessi_ruolo_gdo solo se c\'e\' quello con COALESCE', () => {
    const legacy = 'permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten';
    // Il nome che PostgreSQL ha troncato a 63 caratteri
    expect(legacy).toBe('permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_utente_gdo'.slice(0, 63));
    expect(sql).toMatch(/ELSIF definizione ILIKE '%COALESCE%' THEN\s+RAISE NOTICE/);
    expect(sql).toMatch(/ELSIF NOT EXISTS \([\s\S]*?indexname = 'permessi_ruolo_gdo_unique_override'\s+AND indexdef LIKE 'CREATE UNIQUE INDEX%'\s+AND indexdef ILIKE '%COALESCE%'\s+\) THEN\s+RAISE NOTICE/);
    expect(sql).toContain(`DROP CONSTRAINT ${legacy};`);
    expect(sql).toContain(`DROP INDEX public.${legacy};`);
    // Il modello non lo dichiara
    expect(schema.tabelle.permessi_ruolo_gdo.indici.map(i => i.nome)).not.toContain(legacy);
  });
});

// Migrazioni 0011-0013: chiavi primarie, enum senza colonne, date doppie dei preset WhatsApp. Il
// comportamento su un database lo verifica migrazioniInstallazioniVecchie.integrazione.test.ts.
const CHIAVI = '0011_chiavi_primarie.sql';
const ENUM_ORFANI = '0012_enum_orfani.sql';
const DATE_PRESET = '0013_timestamp_preset_whatsapp.sql';

describe('migrazioni 0011-0013', () => {
  it('sono nella transazione del runner, senza CASCADE e senza eliminare righe', () => {
    for (const file of [CHIAVI, ENUM_ORFANI, DATE_PRESET]) {
      const sql = leggi(file);
      const codice = senzaCommenti(sql);
      expect(sql.split('\n')[0], file).toMatch(/^-- schema-dopo: [0-9a-f]{64}$/);
      expect(sql, file).not.toMatch(/^--\s*senza-transazione/im);
      expect(codice, file).not.toMatch(/\b(?:DELETE\s+FROM|TRUNCATE|INSERT\s+INTO)\b/i);
      expect(codice, file).not.toMatch(/\bCASCADE\b/i);
    }
    // Solo 0013 riscrive righe, e solo le date dei preset
    expect(senzaCommenti(leggi(CHIAVI))).not.toMatch(/\bUPDATE\b/i);
    expect(senzaCommenti(leggi(ENUM_ORFANI))).not.toMatch(/\bUPDATE\b/i);
  });
});

describe('0011: chiavi primarie', () => {
  const sql = leggi(CHIAVI);
  const righe = [...sql.matchAll(/\('(\w+)', '(\w+)'\)/g)].map(([, tabella, nome]) => ({ tabella, nome }));

  it('aggiunge le chiavi primarie dei modelli che le installazioni vecchie non hanno', () => {
    expect(righe.map(r => `${r.tabella}.${r.nome}`)).toEqual(['gdo_whatsapp_presets.id_gdowhatsappreset', 'utenti_guest.id_UtentiGuest']);
    for (const r of righe) {
      const chiave = Object.entries(schema.tabelle[r.tabella].colonne).filter(([, c]) => c.chiavePrimaria).map(([nome]) => nome);
      expect(chiave, r.tabella).toEqual([r.nome]);
    }
  });

  it('non tocca una tabella che ha gia\' una chiave primaria', () => {
    expect(sql).toMatch(/WHERE k\.conrelid = tabella_oid AND k\.contype = 'p';\s+IF esistente IS NOT NULL THEN[\s\S]*?CONTINUE;\s+END IF;/);
  });

  it('con id NULL o ripetuti non crea la chiave: un avviso e la tabella resta com\'e\'', () => {
    expect(sql).toContain("'SELECT count(*) - count(%1$I), count(%1$I) - count(DISTINCT %1$I) FROM public.%2$I'");
    expect(sql).toMatch(/IF nulli > 0 OR doppi > 0 THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;\s+END IF;/);
    const conteggio = sql.indexOf('INTO nulli, doppi;');
    const aggiunta = sql.indexOf("EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (%I)', r.tabella, chiave, r.colonna);");
    expect(conteggio).toBeGreaterThan(0);
    expect(aggiunta).toBeGreaterThan(conteggio);
  });

  it('usa il nome che PostgreSQL da\' alle chiavi della baseline, solo se e\' libero', () => {
    expect(sql).toContain("chiave := r.tabella || '_pkey';");
    expect(leggi('0000_baseline.sql')).toMatch(/CREATE TABLE IF NOT EXISTS "utenti_guest" \([\s\S]*?PRIMARY KEY \("id_UtentiGuest"\)/);
    expect(sql).toMatch(/IF to_regclass\(format\('public\.%I', chiave\)\) IS NOT NULL\s+OR EXISTS \([^)]*conname = chiave\) THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;/);
  });
});

describe('0012: enum orfani', () => {
  const sql = leggi(ENUM_ORFANI);
  const elenco = sql.match(/modelli TEXT\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] ?? '';
  const modelli = [...elenco.matchAll(/'([^']+)'/g)].map(([, nome]) => nome);
  const enumBaseline = [...leggi('0000_baseline.sql').matchAll(/CREATE TYPE "public"\."([^"]+)" AS ENUM/g)].map(([, nome]) => nome);

  it('non tocca gli enum dei modelli: l\'elenco e\' quello della baseline e di schema.json', () => {
    expect(modelli).toHaveLength(41);
    expect([...modelli].sort()).toEqual([...enumBaseline].sort());
    // Uguali a schema.json quando la migrazione e' stata scritta; un enum aggiunto dopo nasce con la
    // sua colonna, quindi usato, e 0012 non lo elimina comunque
    expect([...modelli].sort()).toEqual(Object.keys(schema.enum).sort());
    expect(sql).toContain('AND NOT (t.typname = ANY (modelli))');
  });

  it('elimina solo gli enum di public che nessuna colonna usa, neanche come array, e da cui niente dipende', () => {
    expect(sql).toContain("WHERE n.nspname = 'public' AND t.typtype = 'e'");
    expect(sql).toMatch(/WHERE a\.atttypid IN \(r\.oid, r\.typarray\) AND a\.attnum > 0 AND NOT a\.attisdropped\s+\) THEN\s+RAISE NOTICE[^;]*;\s+CONTINUE;/);
    expect(sql).toMatch(/d\.refobjid IN \(r\.oid, r\.typarray\)\s+AND NOT \(d\.classid = 'pg_type'::regclass AND d\.objid = r\.typarray\)/);
    expect(sql).toContain("d.objid = r.oid AND d.deptype = 'e'");
    const colonne = sql.indexOf('a.atttypid IN (r.oid, r.typarray)');
    const dipendenze = sql.indexOf('FROM pg_depend d');
    const elimina = sql.indexOf("EXECUTE format('DROP TYPE public.%I', r.typname);");
    expect(colonne).toBeGreaterThan(0);
    expect(dipendenze).toBeGreaterThan(colonne);
    expect(elimina).toBeGreaterThan(dipendenze);
  });

  it('DROP TYPE senza CASCADE: se qualcosa lo usa comunque resta, con un avviso', () => {
    expect(sql).toMatch(/EXECUTE format\('DROP TYPE public\.%I', r\.typname\);\s+RAISE NOTICE[^;]*;\s+EXCEPTION WHEN dependent_objects_still_exist THEN\s+RAISE NOTICE/);
  });
});

describe('0013: date dei preset WhatsApp', () => {
  const sql = leggi(DATE_PRESET);
  const codice = senzaCommenti(sql);
  const colonne = schema.tabelle.gdo_whatsapp_presets.colonne;

  it('modello e schema.json hanno una sola coppia di date: createdat/updatedat, che legge il client', () => {
    expect(Object.keys(colonne)).toEqual(expect.arrayContaining(['createdat', 'updatedat']));
    expect(colonne).not.toHaveProperty('createdAt');
    expect(colonne).not.toHaveProperty('updatedAt');
    expect(colonne.createdat).toMatchObject({ tipo: 'timestamp with time zone', nullable: true, default: 'NOW()' });
    expect(colonne.updatedat).toMatchObject({ tipo: 'timestamp with time zone', nullable: true, default: 'NOW()' });
    expect(Object.keys(GDOWhatsappPreset.getAttributes())).not.toEqual(expect.arrayContaining(['createdAt']));
    expect(Object.keys(GDOWhatsappPreset.getAttributes())).not.toEqual(expect.arrayContaining(['updatedAt']));
    expect(GDOWhatsappPreset.options).toMatchObject({ timestamps: true, createdAt: 'createdat', updatedAt: 'updatedat' });
  });

  it('unisce i valori senza perderne prima di eliminare: createdat la data piu\' vecchia, updatedat la piu\' recente', () => {
    expect(sql).toContain("('createdat', 'createdAt', 'LEAST')");
    expect(sql).toContain("('updatedat', 'updatedAt', 'GREATEST')");
    const unisce = sql.indexOf("'UPDATE public.gdo_whatsapp_presets SET %1$I = %3$s(%1$I, %2$I) WHERE %1$I IS DISTINCT FROM %3$s(%1$I, %2$I)'");
    const facoltativa = sql.indexOf("'ALTER TABLE public.gdo_whatsapp_presets ALTER COLUMN %I DROP NOT NULL', r.doppia");
    const elimina = sql.indexOf("'ALTER TABLE public.gdo_whatsapp_presets DROP COLUMN %I', r.doppia");
    expect(unisce).toBeGreaterThan(0);
    expect(facoltativa).toBeGreaterThan(unisce);
    expect(elimina).toBeGreaterThan(facoltativa);
    // Se un altro oggetto usa la colonna resta, facoltativa: l'INSERT del modello non la scrive
    expect(sql).toMatch(/DROP COLUMN %I', r\.doppia\);\s+RAISE NOTICE[^;]*;\s+EXCEPTION WHEN dependent_objects_still_exist THEN\s+RAISE NOTICE/);
  });

  it('dove manca aggiunge la colonna del modello senza mettere la data di oggi sulle righe esistenti', () => {
    expect(sql).toMatch(/'ALTER TABLE public\.gdo_whatsapp_presets ADD COLUMN %I TIMESTAMP WITH TIME ZONE', r\.tenuta\);\s+EXECUTE format\('ALTER TABLE public\.gdo_whatsapp_presets ALTER COLUMN %I SET DEFAULT NOW\(\)', r\.tenuta\);/);
  });

  it('tocca solo gdo_whatsapp_presets, e solo dove ci sono ancora le colonne doppie', () => {
    const tabelle = [...codice.matchAll(/\b(?:UPDATE|ALTER TABLE)\s+public\.(\w+)/gi)].map(([, tabella]) => tabella);
    expect(tabelle.length).toBeGreaterThan(0);
    expect(new Set(tabelle)).toEqual(new Set(['gdo_whatsapp_presets']));
    expect(sql).toMatch(/AND column_name = r\.doppia\s+\) THEN\s+CONTINUE;/);
  });
});

describe('GDOWhatsappPreset con una sola coppia di date', () => {
  const RIGA = {
    id_gdowhatsappreset: '00000000-0000-0000-0000-0000000000a1',
    id_template_gdowhatsappreset: '00000000-0000-0000-0000-0000000000b1',
    nome_preset_gdowhatsappreset: 'Preset di prova',
    is_default_gdowhatsappreset: true,
    hash_gdowhatsappreset: 'hash',
    json_meta_gdowhatsappreset: { nome: { origine: 'utente' } },
    createdat: new Date('2026-01-10T08:00:00.000Z'),
    updatedat: new Date('2026-03-20T09:30:00.000Z'),
  };
  const queryInterface = () => {
    const istanza = GDOWhatsappPreset.sequelize;
    if (!istanza) throw new Error('GDOWhatsappPreset senza sequelize');
    return istanza.getQueryInterface();
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('la risposta JSON dei preset ha la stessa forma di prima: createdAt/updatedAt restano, uguali a createdat/updatedat', () => {
    // Come una riga letta da findAll (get_all_presets_template_whatsapp)
    const preset = GDOWhatsappPreset.build(RIGA, { isNewRecord: false, raw: true });

    const json = JSON.parse(JSON.stringify(preset));

    expect(Object.keys(json)).toEqual([
      'id_gdowhatsappreset', 'id_template_gdowhatsappreset', 'nome_preset_gdowhatsappreset', 'is_default_gdowhatsappreset',
      'hash_gdowhatsappreset', 'json_meta_gdowhatsappreset', 'createdat', 'updatedat', 'createdAt', 'updatedAt',
    ]);
    expect(json).toMatchObject({
      createdat: '2026-01-10T08:00:00.000Z', updatedat: '2026-03-20T09:30:00.000Z',
      createdAt: '2026-01-10T08:00:00.000Z', updatedAt: '2026-03-20T09:30:00.000Z',
    });
  });

  // Le colonne si leggono al momento della chiamata: dopo, save() aggiunge al suo oggetto i dataValues
  it('la creazione scrive createdat e updatedat, non le colonne tolte da 0013', async () => {
    const scritte: string[][] = [];
    vi.spyOn(queryInterface(), 'insert').mockImplementation(async (istanza, _tabella, valori) => {
      scritte.push(Object.keys(valori));
      return [istanza, 1];
    });

    await GDOWhatsappPreset.create({
      id_template_gdowhatsappreset: RIGA.id_template_gdowhatsappreset,
      nome_preset_gdowhatsappreset: RIGA.nome_preset_gdowhatsappreset,
      is_default_gdowhatsappreset: true,
      hash_gdowhatsappreset: RIGA.hash_gdowhatsappreset,
      json_meta_gdowhatsappreset: RIGA.json_meta_gdowhatsappreset,
    });

    expect(scritte).toHaveLength(1);
    expect(scritte[0]).toEqual(expect.arrayContaining(['createdat', 'updatedat']));
    expect(scritte[0]).not.toEqual(expect.arrayContaining(['createdAt']));
    expect(scritte[0]).not.toEqual(expect.arrayContaining(['updatedAt']));
  });

  it('una modifica aggiorna updatedat ("Ultimo aggiornamento" nel client), non piu\' updatedAt', async () => {
    const scritte: string[][] = [];
    vi.spyOn(queryInterface(), 'update').mockImplementation(async (istanza, _tabella, valori) => {
      scritte.push(Object.keys(valori));
      return [istanza, 1];
    });
    const preset = GDOWhatsappPreset.build(RIGA, { isNewRecord: false, raw: true });

    await preset.update({ nome_preset_gdowhatsappreset: 'Preset rinominato' });

    expect(scritte).toEqual([['nome_preset_gdowhatsappreset', 'updatedat']]);
  });
});
