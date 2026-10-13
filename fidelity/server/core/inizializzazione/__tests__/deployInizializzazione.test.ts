import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MENU_SUPERADMIN, PROVIDER_EMAIL_PASSWORD } from '../datiPredefiniti';

// Il deploy Docker (docker/fidelity-olimpo) esegue l'inizializzazione dentro il comando del container
// fidelity. Non si avvia un compose nei test: si controllano l'ordine dei passi e le variabili.
const cartella = (nome: string) =>
  fileURLToPath(new URL(`../../../../../docker/fidelity-olimpo/${nome}`, import.meta.url));
const leggi = (nome: string) => readFileSync(cartella(nome), 'utf8').replace(/\r\n/g, '\n');

describe('compose di fidelity-olimpo', () => {
  const compose = leggi('compose.production.yaml');

  it('inizializza dopo models:sync e prima di avviare il server', () => {
    // I comandi, non le menzioni nei commenti.
    const sync = compose.indexOf('node --import tsx server/core/scripts/initializeModels.ts sync');
    const inizializza = compose.indexOf('node --import tsx server/core/scripts/inizializza.ts');
    const server = compose.indexOf('exec env -u FIDELITY_ADMIN_PASSWORD node --import tsx server/index.ts');

    expect(sync).toBeGreaterThan(-1);
    expect(inizializza).toBeGreaterThan(sync);
    expect(server).toBeGreaterThan(inizializza);
  });

  it('si puo saltare con FIDELITY_INIZIALIZZA=no e un suo errore non ferma il server', () => {
    expect(compose).toContain('if [ "$${FIDELITY_INIZIALIZZA:-si}" = "no" ]; then');
    expect(compose).toContain('node --import tsx server/core/scripts/inizializza.ts || echo');
    expect(compose).toContain('FIDELITY_INIZIALIZZA: ${FIDELITY_INIZIALIZZA:-si}');
  });

  it('passa le credenziali dell amministratore, ma il server parte senza la password', () => {
    for (const nome of ['FIDELITY_ADMIN_EMAIL', 'FIDELITY_ADMIN_PASSWORD', 'FIDELITY_ADMIN_NOME', 'FIDELITY_ADMIN_COGNOME'])
      expect(compose).toContain(`${nome}: \${${nome}:-`);
    expect(compose).toContain('exec env -u FIDELITY_ADMIN_PASSWORD node --import tsx server/index.ts');
  });
});

describe('seed-fidelity.sh e inizializzazione automatica', () => {
  // Lo script resta per l'uso a mano: deve inserire gli stessi dati di riferimento.
  const seed = leggi('seed-fidelity.sh');

  it('hanno lo stesso menu del Superadmin, voce per voce', () => {
    const idSeed = [...seed.matchAll(/^\('([0-9a-f-]{36})','Superadmin'/gm)].map(m => m[1]);
    expect(idSeed).toEqual(MENU_SUPERADMIN.map(v => v.id_menu_item));
    for (const voce of MENU_SUPERADMIN)
      expect(seed).toContain(`('${voce.id_menu_item}','Superadmin',NULL,'${voce.titolo}','${voce.tipo}'`);
  });

  it('hanno lo stesso provider di accesso', () => {
    expect(seed).toContain(`'${PROVIDER_EMAIL_PASSWORD.id}', '${PROVIDER_EMAIL_PASSWORD.codice}'`);
  });
});
