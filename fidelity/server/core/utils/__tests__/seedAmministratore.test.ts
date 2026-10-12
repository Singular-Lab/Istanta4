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

  it('si aspetta che la tabella gdo esista gia\'', () => {
    expect(seed).toContain('for t in auth_providers utenti menu_items gdo; do');
  });
});
