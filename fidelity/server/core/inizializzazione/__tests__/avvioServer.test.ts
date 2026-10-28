import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// server/index.ts avvia il processo e non si esegue nei test: si controllano i passi di ciascun ramo.
const sorgente = readFileSync(fileURLToPath(new URL('../../../index.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const tra = (inizio: string, fine: string): string => {
  const da = sorgente.indexOf(inizio);
  const a = da === -1 ? -1 : sorgente.indexOf(fine, da);
  return da === -1 || a === -1 ? '' : sorgente.slice(da, a);
};

// Le chiamate, non le menzioni nell'import o nei commenti
const chiamate = (ramo: string, funzione: string) => ramo.split(`await ${funzione}();`).length - 1;

const rami: Array<[string, string]> = [
  ['primario (produzione e test)', tra('if (cluster.isPrimary) {', '} else {')],
  ['di sviluppo (single-process)', tra('development: avvio single-process', "log.info('Applicazione avviata")],
];

describe('avvio del server: preparazione della configurazione', () => {
  it.each(rami)('il ramo %s prepara la configurazione una volta sola, dopo gli accessi', (_nome, ramo) => {
    expect(ramo).not.toBe('');
    expect(chiamate(ramo, 'preparaAccessiAllAvvio')).toBe(1);
    expect(chiamate(ramo, 'preparaConfigAllAvvio')).toBe(1);
    expect(ramo.indexOf('await preparaConfigAllAvvio();')).toBeGreaterThan(ramo.indexOf('await preparaAccessiAllAvvio();'));
  });

  it('i worker non ripetono la preparazione gia fatta dal processo primario', () => {
    const worker = tra('Worker ${process.pid}: avvio server HTTP', 'Worker ${process.pid}: server HTTP pronto');

    expect(worker).not.toBe('');
    expect(chiamate(worker, 'preparaConfigAllAvvio')).toBe(0);
  });
});

describe('avvio del server: migrazioni dello schema', () => {
  it.each(rami)('il ramo %s applica le migrazioni una volta sola, prima degli accessi', (_nome, ramo) => {
    expect(ramo).not.toBe('');
    expect(chiamate(ramo, 'applicaMigrazioniAllAvvio')).toBe(1);
    expect(ramo.indexOf('await applicaMigrazioniAllAvvio();')).toBeLessThan(ramo.indexOf('await preparaAccessiAllAvvio();'));
  });

  it('i worker non applicano le migrazioni: le ha gia applicate il processo primario', () => {
    const worker = tra('Worker ${process.pid}: avvio server HTTP', 'Worker ${process.pid}: server HTTP pronto');

    expect(worker).not.toBe('');
    expect(chiamate(worker, 'applicaMigrazioniAllAvvio')).toBe(0);
  });

  it('la vecchia sincronizzazione dei modelli non si usa piu', () => {
    expect(sorgente).not.toContain('sincronizzaSchemaAllAvvio');
  });
});
