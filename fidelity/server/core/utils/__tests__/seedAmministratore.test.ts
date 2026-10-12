import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docker/fidelity-olimpo/seed-fidelity.sh semina l'installazione nuova. Non ha test suoi
// (e' uno script shell che parla con i container): qui si blocca il ritorno di due errori
// nei dati che produce, da cui dipendono getPassportFromOlympo e la scelta della GDO.
const seed = readFileSync(
  fileURLToPath(new URL('../../../../../docker/fidelity-olimpo/seed-fidelity.sh', import.meta.url)),
  'utf8'
).replace(/\r\n/g, '\n');

function blocco(inizio: string, fine: string): string {
  const da = seed.indexOf(inizio);
  expect(da, `"${inizio}" non trovato nel seed`).toBeGreaterThanOrEqual(0);
  const a = seed.indexOf(fine, da);
  expect(a, `"${fine}" non trovato dopo "${inizio}"`).toBeGreaterThan(da);
  return seed.slice(da, a + fine.length);
}

describe('seed-fidelity.sh: amministratore', () => {
  const insert = blocco('INSERT INTO utenti', 'WHERE NOT EXISTS');

  it('crea l\'amministratore con la chiave privata vuota', () => {
    // Con la chiave vuota getPassportFromOlympo usa fico-secret e Olimpo registra l'utente;
    // una chiave inventata Olimpo la rifiuta e Istanta riceve un'identita' vuota.
    expect(insert).toContain("'Superadmin', '', false");
  });

  it('non inventa una chiave privata', () => {
    expect(insert).not.toContain('gen_random_uuid()::text');
  });
});

describe('seed-fidelity.sh: GDO dell\'istanza', () => {
  it('legge CLIENT_ID da fidelity.env', () => {
    expect(seed).toMatch(/client_id=\$\(leggi CLIENT_ID fidelity\.env\)/);
  });

  it('inserisce la GDO col nome di CLIENT_ID senza duplicarla, maiuscole comprese', () => {
    const insert = blocco('INSERT INTO gdo', ';');
    expect(insert).toContain("SELECT gen_random_uuid(), :'nome', NOW(), NOW()");
    expect(insert).toContain("WHERE NOT EXISTS (SELECT 1 FROM gdo WHERE lower(nome_gdo) = lower(:'nome'))");
    expect(seed).toContain('psql_fidelity -v nome="$client_id"');
  });

  it('salta la GDO quando CLIENT_ID e\' vuoto o default', () => {
    const condizione = blocco('if [ -z "$client_id" ]', 'then');
    expect(condizione).toContain('= default');
    const da = seed.indexOf(condizione);
    expect(seed.indexOf('INSERT INTO gdo')).toBeGreaterThan(seed.indexOf('else', da));
  });

  it('si aspetta che le tabelle gdo, utenti_gdo e ruolo_utente_gdo esistano gia\'', () => {
    expect(seed).toContain('for t in auth_providers utenti menu_items gdo utenti_gdo ruolo_utente_gdo; do');
  });
});

describe('seed-fidelity.sh: amministratore collegato alla GDO', () => {
  // Al login Fidelity prende la GDO della sessione da utenti_gdo: senza la riga il
  // Superadmin entrava senza GDO operativa.
  const insert = blocco('INSERT INTO utenti_gdo', ';');

  it('collega l\'amministratore alla GDO di CLIENT_ID con il sotto-ruolo ADMIN', () => {
    expect(insert).toContain("JOIN gdo g ON lower(g.nome_gdo) = lower(:'nome')");
    expect(insert).toContain("WHERE u.email_utenti = :'email'");
    expect(insert).toContain("WHERE r.ruolo_ruolo_utente_gdo = 'ADMIN'");
    expect(seed).toContain('psql_fidelity -v nome="$client_id" -v email="$admin_email"');
  });

  it('non duplica ne\' sostituisce un collegamento gia\' presente', () => {
    expect(insert).toContain(
      'AND NOT EXISTS (SELECT 1 FROM utenti_gdo ug WHERE ug.id_utente_utentegdo = u.id_utenti)'
    );
  });

  it('collega solo dopo aver creato la GDO, e lo salta senza CLIENT_ID', () => {
    expect(seed.indexOf('INSERT INTO utenti_gdo')).toBeGreaterThan(seed.indexOf('INSERT INTO gdo'));
    const da = seed.indexOf('if [ -z "$client_id" ]');
    const altrimenti = seed.indexOf('else', da);
    expect(seed.slice(da, altrimenti)).toContain('saltato   utenti_gdo');
    expect(seed.indexOf('INSERT INTO utenti_gdo')).toBeGreaterThan(altrimenti);
  });
});

describe('seed-fidelity.sh: materialized view', () => {
  // Fidelity le crea all'avvio con le tabelle ancora vuote: senza refresh la gestione
  // utenti non mostrerebbe l'amministratore appena seminato.
  it('aggiorna tutte le materialized view lette da Fidelity, dopo gli inserimenti', () => {
    expect(seed).toContain(
      'for v in mv_utenti_completi mv_aree_ottimizzata mv_canali_ottimizzata mv_combinazioni_ottimizzata; do'
    );
    expect(seed).toContain('REFRESH MATERIALIZED VIEW public.$v');
    expect(seed.indexOf('REFRESH MATERIALIZED VIEW')).toBeGreaterThan(seed.indexOf('INSERT INTO utenti_gdo'));
  });

  it('termina con errore se una materialized view manca', () => {
    const controllo = blocco('if [ "$viste_mancanti" -gt 0 ]', 'exit 1');
    //Nessun "fi" prima di exit 1: l'uscita sta dentro il ramo delle viste mancanti.
    expect(controllo).not.toContain('\nfi\n');
  });
});
