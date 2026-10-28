import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Gli script di server/core/db/scripts li esegue Fidelity a ogni avvio
// (ModelliManager.sincronizzaTuttiIModelli): quelli della sottocartella
// prima_della_sincronizzazione prima della sync dei modelli, gli altri dopo.
// Un errore viene solo registrato nel log, quindi uno script rotto passava
// inosservato: e' cosi' che mv_utenti_completi non veniva mai creata.
const cartella = fileURLToPath(new URL('../scripts', import.meta.url));
const cartellaPrima = path.join(cartella, 'prima_della_sincronizzazione');

const sqlIn = (dir: string) => readdirSync(dir).filter(file => file.endsWith('.sql')).sort();
const leggi = (dir: string, file: string) => readFileSync(path.join(dir, file), 'utf8');

describe('script SQL eseguiti all\'avvio', () => {
  it('contengono solo cio\' che serve all\'applicazione', () => {
    expect(sqlIn(cartella)).toEqual([
      'create_materialized_views_complete.sql',
      'create_mv_utenti_completi_complete.sql',
      'fix_permessi_ruolo_unique_indexes.sql',
      'v_attivita.sql',
    ]);
    expect(sqlIn(cartellaPrima)).toEqual([
      'hash_api_key_ruoli.sql',
      'rimuovi_oggetti_derivati.sql',
      'sistema_schema_esistente.sql',
    ]);
  });

  it('prima della sync sostituiscono le chiavi API dei ruoli con il loro hash, una volta sola', () => {
    const script = leggi(cartellaPrima, 'hash_api_key_ruoli.sql');

    // Su un database vuoto la colonna non c'e' ancora: lo script non fa nulla.
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

  it('non indicano un proprietario ne\' tipi che Sequelize non crea', () => {
    for (const file of sqlIn(cartella)) {
      const sql = leggi(cartella, file);
      // Il ruolo postgres non esiste se il superutente ha un altro nome; i tipi
      // "STATO_UTENTI" e "TIPO_UTENTE" non esistono: Sequelize crea enum_utenti_*.
      expect(sql, file).not.toMatch(/OWNER TO/i);
      expect(sql, file).not.toContain('::"STATO_UTENTI"');
      expect(sql, file).not.toContain('::"TIPO_UTENTE"');
    }
  });

  it('prima della sync tolgono ogni view e materialized view creata dopo', () => {
    const rimozione = leggi(cartellaPrima, 'rimuovi_oggetti_derivati.sql');
    const creati = new Set<string>();
    for (const file of sqlIn(cartella)) {
      for (const [, tipo, nome] of leggi(cartella, file).matchAll(
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
    for (const voce of creati) {
      const [tipo, nome] = [voce.slice(0, voce.lastIndexOf(' ')), voce.slice(voce.lastIndexOf(' ') + 1)];
      expect(rimozione, voce).toContain(`DROP ${tipo} IF EXISTS public.${nome} CASCADE;`);
    }
  });

  it('prima della sync tolgono anche le view delle versioni precedenti', () => {
    // Sulle installazioni esistenti ci sono ancora, e bloccherebbero l'ALTER.
    const rimozione = leggi(cartellaPrima, 'rimuovi_oggetti_derivati.sql');
    for (const nome of [
      'MATERIALIZED VIEW IF EXISTS public.mv_aree_canali_combinazioni',
      'VIEW IF EXISTS public.v_combinazioni_canale_area_stats',
      'VIEW IF EXISTS public.v_dashboard_utenti_attivita',
      'VIEW IF EXISTS public.v_ordini_stampa_dettagli',
      'VIEW IF EXISTS public.v_punti_vendita_completa',
      'VIEW IF EXISTS public.v_tracciati_completi',
      'VIEW IF EXISTS public.v_webhook_statistiche',
    ]) {
      expect(rimozione).toContain(`DROP ${nome} CASCADE;`);
    }
  });

  it('prima della sync portano le installazioni esistenti allo schema dei modelli', () => {
    // Gira a ogni avvio: ogni correzione deve controllare prima lo stato del
    // database, cosi' su un database vuoto o gia' corretto non fa nulla.
    const correzioni = leggi(cartellaPrima, 'sistema_schema_esistente.sql');

    // Tracciati: da UUID al tipo di promo.id_promo, solo se e' ancora UUID, e
    // via le righe di promo che non esistono piu'.
    expect(correzioni).toMatch(/column_name = 'id_promo_tracciati' AND data_type = 'uuid'[\s\S]*ALTER COLUMN id_promo_tracciati TYPE VARCHAR\(255\)/);
    expect(correzioni).toMatch(/DELETE FROM public\.tracciati t\s+WHERE NOT EXISTS/);

    // Webhook: da array di enum ad array di VARCHAR, solo se e' ancora di enum,
    // togliendo prima il default.
    expect(correzioni).toMatch(/udt_name = '_enum_webhooks_eventi_webhook'[\s\S]*DROP DEFAULT;[\s\S]*TYPE VARCHAR\(255\)\[\]/);

    // Indici troncati: rinominati con i nomi dei modelli, se ci sono.
    for (const [vecchio, nuovo] of [
      ['display_context_punto_vendita_id_gdo_display_context_is_active_', 'display_context_pv_gdo_attivo'],
      ['attivita_utente_id_utente_attivita_utente_id_attivita_attivita_', 'attivita_utente_utente_attivita_uq'],
    ]) {
      expect(correzioni).toContain(`['${vecchio}', '${nuovo}']`);
    }
    expect(correzioni).toContain("IF to_regclass('public.' || rinomina[i][1]) IS NOT NULL THEN");
  });

  it('mantengono le funzioni chiamate dai servizi', () => {
    const tutto = sqlIn(cartella).map(file => leggi(cartella, file)).join('\n');
    for (const funzione of [
      'refresh_mv_aree()',
      'refresh_mv_canali()',
      'refresh_mv_combinazioni()',
      'public.get_utenti_completi_filtered(',
      'public.get_attivita_for_user(',
      'public.count_unread_attivita_for_user(',
      'public.cleanup_expired_attivita()',
    ]) {
      expect(tutto, funzione).toContain(`CREATE OR REPLACE FUNCTION ${funzione}`);
    }
  });
});
