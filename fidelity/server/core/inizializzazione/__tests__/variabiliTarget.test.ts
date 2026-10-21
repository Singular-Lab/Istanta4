import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// TASK-6ad36d2a: in produzione il contesto di Nuova lavorazione rispondeva 401 perche'
// INTERNAL_REQUEST_SECRET non era impostato. Per Zod e' facoltativa, quindi Fidelity partiva lo
// stesso e le chiamate a se stessa arrivavano senza firma. Ora la pretende prepare-target.sh e
// fidelity.env.example la elenca fra le obbligatorie.
const radice = (percorso: string) =>
  fileURLToPath(new URL(`../../../../../${percorso}`, import.meta.url));
const leggi = (percorso: string) => readFileSync(radice(percorso), 'utf8').replace(/\r\n/g, '\n');

describe('INTERNAL_REQUEST_SECRET sul target fidelity-olimpo', () => {
  it('fidelity.env.example la elenca fra le variabili obbligatorie', () => {
    const esempio = leggi('docker/fidelity-olimpo/fidelity.env.example');
    const variabile = esempio.search(/^INTERNAL_REQUEST_SECRET=$/m);
    const facoltative = esempio.indexOf('Facoltative');

    expect(variabile).toBeGreaterThan(-1);
    expect(facoltative).toBeGreaterThan(variabile);
  });

  it('prepare-target.sh la controlla come obbligatoria', () => {
    const script = leggi('docker/fidelity-olimpo/prepare-target.sh');

    expect(script).toMatch(/^valore_richiesto fidelity\.env INTERNAL_REQUEST_SECRET /m);
    expect(script).toContain('tutte valorizzate (23 variabili)');
  });

  it('il server la legge ancora, altrimenti il controllo non servirebbe', () => {
    const configurazione = leggi('fidelity/server/core/config/index.ts');

    expect(configurazione).toContain('INTERNAL_REQUEST_SECRET');
  });
});
