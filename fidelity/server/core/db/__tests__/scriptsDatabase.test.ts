import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TIPO_TO_CATEGORIA } from '../../models/attivita';

// Il codice SQL di Fidelity sta in due posti:
// - migrazioni/sql: migrazioni versionate, ciascuna applicata una volta sola
//   e in una transazione, su database creati dalla baseline o su
//   installazioni esistenti; ogni passo deve controllare prima lo stato;
// - oggetti_derivati: view, materialized view e funzioni, ricreate da
//   migrazioni/oggettiDerivati.ts quando il file cambia o l'oggetto manca.
// Prima giravano tutti a ogni avvio da db/scripts, e un errore finiva solo nel
// log: e' cosi' che mv_utenti_completi non veniva mai creata. Ora un errore
// ferma l'avvio, quindi il contenuto va controllato qui.
const cartellaDb = fileURLToPath(new URL('..', import.meta.url));
const cartellaMigrazioni = path.join(cartellaDb, 'migrazioni', 'sql');
const cartellaDerivati = path.join(cartellaDb, 'oggetti_derivati');

const sqlIn = (dir: string) => readdirSync(dir).filter(file => file.endsWith('.sql')).sort();
const leggi = (dir: string, file: string) => readFileSync(path.join(dir, file), 'utf8');

const MIGRAZIONE_CORREZIONI = '0001_correzioni_installazioni_esistenti.sql';
const MIGRAZIONE_ORFANI = '0002_tracciati_orfani.sql';
const MIGRAZIONE_CATEGORIA = '0003_categoria_attivita.sql';

/** Il testo eseguito subito: senza corpi delle funzioni, commenti e stringhe. */
const istruzioniDiretti = (sql: string) => sql
  .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '')
  .replace(/--[^\n]*/g, '')
  .replace(/'(?:[^']|'')*'/g, "''");

describe('migrazioni SQL', () => {
  it('ci sono le correzioni delle installazioni esistenti, i tracciati orfani e la categoria delle attivita\'', () => {
    expect(sqlIn(cartellaMigrazioni)).toEqual(expect.arrayContaining([
      MIGRAZIONE_CORREZIONI,
      MIGRAZIONE_ORFANI,
      MIGRAZIONE_CATEGORIA,
    ]));
    // I vecchi script eseguiti a ogni avvio non ci sono piu'.
    expect(existsSync(path.join(cartellaDb, 'scripts'))).toBe(false);
  });

  it('hanno in testa l\'intestazione schema-dopo e niente controllo della transazione', () => {
    for (const file of sqlIn(cartellaMigrazioni)) {
      const sql = leggi(cartellaMigrazioni, file);
      expect(file, file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(sql.split('\n')[0], file).toMatch(/^-- schema-dopo: [0-9a-f]{64}$/);
      // La transazione la apre il runner (END; dei blocchi PL/pgSQL e' lecito).
      expect(sql, file).not.toMatch(/^\s*(?:(?:BEGIN|COMMIT|ROLLBACK)(?:\s+(?:TRANSACTION|WORK))?\s*;|START\s+TRANSACTION\b)/im);
    }
    // Nessuna delle correzioni ha bisogno di girare fuori transazione.
    for (const file of [MIGRAZIONE_CORREZIONI, MIGRAZIONE_ORFANI, MIGRAZIONE_CATEGORIA]) {
      expect(leggi(cartellaMigrazioni, file), file).not.toMatch(/^--\s*senza-transazione/im);
    }
  });

  it('eliminano tracciati solo in 0002, che prima ne fa una copia', () => {
    for (const file of sqlIn(cartellaMigrazioni).filter(file => file !== MIGRAZIONE_ORFANI)) {
      expect(leggi(cartellaMigrazioni, file), file).not.toMatch(/DELETE\s+FROM\s+(?:public\.)?tracciati\b/i);
    }

    const orfani = leggi(cartellaMigrazioni, MIGRAZIONE_ORFANI);
    // Su un database senza tabelle o senza orfani non fa nulla.
    expect(orfani).toContain("IF to_regclass('public.tracciati') IS NULL OR to_regclass('public.promo') IS NULL THEN");
    expect(orfani).toMatch(/IF NOT EXISTS \([\s\S]*?\) THEN\s+RAISE NOTICE 'Tracciati orfani: nessuno';\s+RETURN;/);
    // Copia con la data fissa della migrazione, senza sovrascriverne una esistente.
    expect(orfani).toContain("copia TEXT := 'tracciati_orfani_20261028';");
    expect(orfani).toMatch(/WHILE to_regclass\('public\.' \|\| quote_ident\(copia\)\) IS NOT NULL LOOP/);
    // Prima la copia, poi l'eliminazione delle sole righe copiate, poi il conteggio.
    const copia = orfani.indexOf('CREATE TABLE public.%I AS');
    const eliminazione = orfani.indexOf('DELETE FROM public.tracciati t');
    expect(copia).toBeGreaterThan(0);
    expect(eliminazione).toBeGreaterThan(copia);
    expect(orfani).toMatch(/USING public\.%I c\s+WHERE t\.id_tracciati = c\.id_tracciati/);
    expect(orfani).toMatch(/RAISE NOTICE 'Tracciati orfani: % righe copiate/);
    // Stessa condizione dell'eliminazione che prima girava a ogni avvio.
    expect(orfani.match(/p\.id_promo = t\.id_promo_tracciati::text/g)).toHaveLength(3);
  });

  it('sostituiscono le chiavi API dei ruoli con il loro hash, una volta sola', () => {
    const script = leggi(cartellaMigrazioni, MIGRAZIONE_CORREZIONI);

    // Su un database senza la colonna non fa nulla.
    expect(script).toMatch(/table_name = 'ruolo_utente_gdo'\s+AND column_name = 'api_key_ruolo_utente_gdo'[\s\S]*THEN\s+UPDATE public\.ruolo_utente_gdo/);
    // Stessa conversione di hashApiKey (middleware/apiKeyAuth.ts): sha256 dei byte UTF-8 in esadecimale.
    expect(script).toContain("encode(sha256(convert_to(api_key_ruolo_utente_gdo, 'UTF8')), 'hex')");

    // Idempotenza: un hash gia' convertito e' escluso, una chiave emessa da Fidelity no.
    const [, giaConvertito] = script.match(/api_key_ruolo_utente_gdo !~ '([^']+)'/) ?? [];
    expect(giaConvertito).toBeDefined();
    const escluso = new RegExp(giaConvertito as string);
    const chiaveEmessa = 'ab'.repeat(80); // 160 caratteri esadecimali, come le chiavi cifrate
    const hash = createHash('sha256').update(chiaveEmessa, 'utf8').digest('hex');

    expect(escluso.test(chiaveEmessa)).toBe(false);
    expect(escluso.test(hash)).toBe(true);
    expect(script).toContain("api_key_ruolo_utente_gdo <> ''");
  });

  it('portano le installazioni esistenti allo schema dei modelli, solo se serve', () => {
    const correzioni = leggi(cartellaMigrazioni, MIGRAZIONE_CORREZIONI);

    // Tracciati: da UUID al tipo di promo.id_promo, solo se e' ancora UUID.
    expect(correzioni).toMatch(/column_name = 'id_promo_tracciati' AND data_type = 'uuid'[\s\S]*ALTER COLUMN id_promo_tracciati TYPE VARCHAR\(255\)/);

    // Webhook: da array di enum ad array di VARCHAR, solo se e' ancora di enum,
    // togliendo prima il default e rimettendo quello del modello.
    expect(correzioni).toMatch(/udt_name = '_enum_webhooks_eventi_webhook'[\s\S]*DROP DEFAULT;[\s\S]*TYPE VARCHAR\(255\)\[\][\s\S]*SET DEFAULT ARRAY\[\]::VARCHAR\(255\)\[\];/);

    // Indici troncati: rinominati con i nomi dei modelli, se ci sono.
    for (const [vecchio, nuovo] of [
      ['display_context_punto_vendita_id_gdo_display_context_is_active_', 'display_context_pv_gdo_attivo'],
      ['attivita_utente_id_utente_attivita_utente_id_attivita_attivita_', 'attivita_utente_utente_attivita_uq'],
    ]) {
      expect(correzioni).toContain(`['${vecchio}', '${nuovo}']`);
    }
    expect(correzioni).toContain("IF to_regclass('public.' || rinomina[i][1]) IS NOT NULL THEN");
  });

  it('tolgono gli oggetti derivati delle versioni precedenti prima di cambiare le colonne', () => {
    const correzioni = leggi(cartellaMigrazioni, MIGRAZIONE_CORREZIONI);
    const primaModifica = correzioni.indexOf('ALTER TABLE public.tracciati');
    for (const voce of [
      'MATERIALIZED VIEW IF EXISTS public.mv_aree_canali_combinazioni',
      'VIEW IF EXISTS public.v_utenti_completi_filtered',
      'VIEW IF EXISTS public.v_combinazioni_canale_area_stats',
      'VIEW IF EXISTS public.v_dashboard_utenti_attivita',
      'VIEW IF EXISTS public.v_ordini_stampa_dettagli',
      'VIEW IF EXISTS public.v_punti_vendita_completa',
      'VIEW IF EXISTS public.v_tracciati_completi',
      'VIEW IF EXISTS public.v_webhook_statistiche',
    ]) {
      const posizione = correzioni.indexOf(`DROP ${voce} CASCADE;`);
      expect(posizione, voce).toBeGreaterThan(0);
      expect(posizione, voce).toBeLessThan(primaModifica);
    }
    for (const funzione of [
      'refresh_all_materialized_views()',
      'refresh_mv_aree_canali_combinazioni()',
      'sp_report_promozione(TEXT, TEXT, DATE, DATE, TEXT)',
    ]) {
      expect(correzioni).toContain(`DROP FUNCTION IF EXISTS public.${funzione};`);
    }
  });

  it('rendono univoci i permessi con COALESCE sul sotto-ruolo, eliminando i doppioni solo per crearli', () => {
    const correzioni = leggi(cartellaMigrazioni, MIGRAZIONE_CORREZIONI);

    // Vincolo legacy a 2 colonne, come vincolo o come indice.
    expect(correzioni).toContain('ALTER TABLE public.permessi_ruolo DROP CONSTRAINT permessi_ruolo_tipo_utente_id_permesso;');
    expect(correzioni).toContain('DROP INDEX IF EXISTS public.permessi_ruolo_tipo_utente_id_permesso;');
    // Indice a 3 colonne sostituito solo se non e' gia' quello con COALESCE.
    expect(correzioni).toMatch(/indexname = 'permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo'\s+AND indexdef LIKE 'CREATE UNIQUE INDEX%'\s+AND indexdef ILIKE '%COALESCE%'/);
    expect(correzioni).toMatch(/CREATE UNIQUE INDEX permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo\s+ON public\.permessi_ruolo \(\s+tipo_utente,\s+id_permesso,\s+COALESCE\(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'::uuid\)\s+\);/);

    // Override per GDO: via il vincolo a 3 colonne e l'indice a 4 senza COALESCE.
    expect(correzioni).toContain('DROP INDEX IF EXISTS public.permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso;');
    expect(correzioni).toContain('DROP INDEX IF EXISTS public.permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_utente_gdo;');
    expect(correzioni).toMatch(/IF to_regclass\('public\.permessi_ruolo_gdo_unique_override'\) IS NULL THEN[\s\S]*CREATE UNIQUE INDEX permessi_ruolo_gdo_unique_override\s+ON public\.permessi_ruolo_gdo \(\s+id_gdo,\s+tipo_utente,\s+id_permesso,\s+COALESCE\(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'::uuid\)\s+\);/);

    // Le uniche eliminazioni sono i doppioni, subito prima di creare l'indice.
    const eliminate = [...correzioni.matchAll(/DELETE FROM (public\.\w+)/g)].map(([, tabella]) => tabella);
    expect(eliminate).toEqual(['public.permessi_ruolo', 'public.permessi_ruolo_gdo']);
    expect(correzioni).toMatch(/DELETE FROM public\.permessi_ruolo a[\s\S]*?IS NOT DISTINCT FROM b\.id_ruolo_utente_gdo;\s+CREATE UNIQUE INDEX permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo/);
    expect(correzioni).toMatch(/DELETE FROM public\.permessi_ruolo_gdo a[\s\S]*?IS NOT DISTINCT FROM b\.id_ruolo_utente_gdo;\s+CREATE UNIQUE INDEX permessi_ruolo_gdo_unique_override/);
  });

  it('aggiungono le colonne e le tabelle che prima creava il codice a ogni avvio', () => {
    const correzioni = leggi(cartellaMigrazioni, MIGRAZIONE_CORREZIONI);

    expect(correzioni).toContain('ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS id_ruolo_utente_gdo UUID;');
    expect(correzioni).toContain('ALTER TABLE IF EXISTS public.config ADD COLUMN IF NOT EXISTS id_gdo_config UUID;');
    expect(correzioni).toContain('ALTER TABLE IF EXISTS public.config ADD COLUMN IF NOT EXISTS funzionalita JSONB;');

    // Stessa tabella di versionePermessi: una riga sola, schema degli accessi da 0.
    expect(correzioni).toMatch(/CREATE TABLE IF NOT EXISTS public\.accessi_stato \(\s+id SMALLINT PRIMARY KEY DEFAULT 1 CHECK \(id = 1\),\s+versione BIGINT NOT NULL DEFAULT 1,\s+schema_accessi INTEGER NOT NULL DEFAULT 0,\s+aggiornato_il TIMESTAMPTZ NOT NULL DEFAULT now\(\)\s+\);/);
    expect(correzioni).toContain('INSERT INTO public.accessi_stato (id) VALUES (1) ON CONFLICT (id) DO NOTHING;');
  });

  it('completano attivita con i tipi del modello e gli indici parziali, e tolgono gli enum mai usati', () => {
    const correzioni = leggi(cartellaMigrazioni, MIGRAZIONE_CORREZIONI);

    expect(correzioni).toContain("IF to_regclass('public.attivita') IS NULL THEN");
    expect(correzioni).toContain('ADD COLUMN categoria_attivita public.enum_attivita_categoria_attivita;');
    expect(correzioni).toContain("ADD COLUMN priorita_attivita public.enum_attivita_priorita_attivita DEFAULT 'MEDIA';");
    expect(correzioni).toContain('ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;');
    for (const [indice, colonna] of [
      ['idx_attivita_expires_at', 'expires_at'],
      ['idx_attivita_categoria', 'categoria_attivita'],
      ['idx_attivita_priorita', 'priorita_attivita'],
    ]) {
      expect(correzioni).toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS ${indice}\\s+ON public\\.attivita \\(${colonna}\\) WHERE ${colonna} IS NOT NULL;`));
    }
    // Il vecchio script aggiungeva VARCHAR: il modello usa enum_attivita_*.
    expect(correzioni).not.toMatch(/ADD COLUMN (?:IF NOT EXISTS )?categoria_attivita VARCHAR/);

    // Enum di v_attivita.sql: eliminati solo se nessuna colonna li usa.
    expect(correzioni).toContain("FOREACH tipo IN ARRAY ARRAY['categoria_attivita_enum', 'priorita_attivita_enum'] LOOP");
    expect(correzioni).toMatch(/udt_name IN \(tipo, '_' \|\| tipo\)[\s\S]*CONTINUE;[\s\S]*EXECUTE format\('DROP TYPE public\.%I', tipo\);\s+EXCEPTION WHEN dependent_objects_still_exist THEN/);
  });

  it('allineano la categoria delle attivita\' alla mappa del modello, una volta sola', () => {
    const categoria = leggi(cartellaMigrazioni, MIGRAZIONE_CATEGORIA);

    expect(categoria).toMatch(/column_name = 'tipo_attivita'\s+\) THEN\s+RETURN;/);
    expect(categoria).toMatch(/column_name = 'categoria_attivita';\s+IF tipo_categoria IS NULL THEN\s+RETURN;/);
    // Tocca solo le righe con una categoria diversa da quella del modello: ripeterla non cambia nulla
    expect(categoria).toContain('a.categoria_attivita::text IS DISTINCT FROM m.categoria');
    // Il risultato si converte nel tipo effettivo della colonna.
    expect(categoria).toContain("SELECT format('%I.%I', udt_schema, udt_name) INTO tipo_categoria");
    expect(categoria).toContain('SET categoria_attivita = m.categoria::%s');
    expect(categoria).toContain("ELSE COALESCE(categoria_attivita::text, 'INTEGRAZIONI')");
  });

  it('usano la stessa mappa tipo -> categoria di TIPO_TO_CATEGORIA', () => {
    const categoria = leggi(cartellaMigrazioni, MIGRAZIONE_CATEGORIA);
    const mappaSql = Object.fromEntries(
      [...categoria.matchAll(/WHEN '([A-Z_]+)' THEN '([A-Z_]+)'/g)].map(([, tipo, cat]) => [tipo, cat]),
    );

    expect(mappaSql).toEqual({ ...TIPO_TO_CATEGORIA });
  });
});

describe('oggetti derivati', () => {
  it('sono una view e tre materialized view, in file ordinati per dipendenza', () => {
    expect(sqlIn(cartellaDerivati)).toEqual([
      '010_v_attivita.sql',
      '020_materialized_views.sql',
      '030_mv_utenti_completi.sql',
    ]);

    const creati = new Set<string>();
    for (const file of sqlIn(cartellaDerivati)) {
      // Solo il codice: un commento che cita "CREATE MATERIALIZED VIEW" non crea niente
      const codice = leggi(cartellaDerivati, file).replace(/--.*$/gm, '');
      for (const [, tipo, nome] of codice.matchAll(
        /CREATE (?:OR REPLACE )?(MATERIALIZED VIEW|VIEW)(?: IF NOT EXISTS)? (?:public\.)?(\w+)/g
      )) {
        creati.add(`${tipo} ${nome}`);
      }
    }
    expect([...creati].sort()).toEqual([
      'MATERIALIZED VIEW mv_aree_ottimizzata',
      'MATERIALIZED VIEW mv_canali_ottimizzata',
      'MATERIALIZED VIEW mv_combinazioni_ottimizzata',
      'MATERIALIZED VIEW mv_utenti_completi',
      'VIEW v_attivita',
    ]);
  });

  it('sono autosufficienti: ogni file elimina le sue view prima di ricrearle', () => {
    for (const file of sqlIn(cartellaDerivati)) {
      const sql = leggi(cartellaDerivati, file);
      for (const [creazione, tipo, nome] of sql.matchAll(
        /CREATE (?:OR REPLACE )?(MATERIALIZED VIEW|VIEW)(?: IF NOT EXISTS)? public\.(\w+)/g
      )) {
        const rimozione = sql.indexOf(`DROP ${tipo} IF EXISTS public.${nome} CASCADE;`);
        expect(rimozione, `${file}: ${nome}`).toBeGreaterThanOrEqual(0);
        expect(rimozione, `${file}: ${nome}`).toBeLessThan(sql.indexOf(creazione));
      }
    }
  });

  it('non cambiano dati ne\' schema delle tabelle quando vengono ricreati', () => {
    for (const file of sqlIn(cartellaDerivati)) {
      const diretti = istruzioniDiretti(leggi(cartellaDerivati, file));
      // DELETE e UPDATE stanno solo nei corpi delle funzioni (cleanup_expired_attivita).
      expect(diretti, file).not.toMatch(/\b(?:DELETE|UPDATE|INSERT|TRUNCATE)\b/i);
      // Colonne, enum e indici delle tabelle sono nelle migrazioni.
      expect(diretti, file).not.toMatch(/\bALTER\s+TABLE\b|\bCREATE\s+TYPE\b/i);
      expect(diretti, file).not.toMatch(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?\w+\s+ON (?:public\.)?attivita\b/i);
    }
  });

  it('non indicano un proprietario ne\' tipi che Sequelize non crea', () => {
    for (const file of sqlIn(cartellaDerivati)) {
      const sql = leggi(cartellaDerivati, file);
      // Il ruolo postgres non esiste se il superutente ha un altro nome; i tipi
      // "STATO_UTENTI" e "TIPO_UTENTE" non esistono: Sequelize crea enum_utenti_*.
      expect(sql, file).not.toMatch(/OWNER TO/i);
      expect(sql, file).not.toContain('::"STATO_UTENTI"');
      expect(sql, file).not.toContain('::"TIPO_UTENTE"');
    }
  });

  it('mantengono le funzioni chiamate dai servizi', () => {
    const tutto = sqlIn(cartellaDerivati).map(file => leggi(cartellaDerivati, file)).join('\n');
    for (const funzione of [
      'public.refresh_mv_aree()',
      'public.refresh_mv_canali()',
      'public.refresh_mv_combinazioni()',
      'public.refresh_mv_utenti_completi()',
      'public.get_utenti_completi_filtered(',
      'public.get_attivita_for_user(',
      'public.count_unread_attivita_for_user(',
      'public.cleanup_expired_attivita()',
    ]) {
      expect(tutto, funzione).toContain(`CREATE OR REPLACE FUNCTION ${funzione}`);
    }
  });
});
