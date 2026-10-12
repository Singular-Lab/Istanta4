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
    expect(sqlIn(cartellaPrima)).toEqual(['rimuovi_oggetti_derivati.sql']);
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
