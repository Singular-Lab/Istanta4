import { afterEach, vi } from 'vitest';
import { TEST_ENV } from './ambienteTest';

// Variabili d'ambiente finte e isolate per la validazione di server/core/config: vedi ambienteTest.ts

for (const [chiave, valore] of Object.entries(TEST_ENV)) {
  if (process.env[chiave] === undefined || process.env[chiave] === '') {
    process.env[chiave] = valore;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Da Node 25 `globalThis.localStorage` e' il Web Storage di Node: senza `--localstorage-file`
 * vale undefined e, essendo gia' definito, copre quello di jsdom nei test con
 * `@vitest-environment jsdom` (es. "Cannot read properties of undefined (reading 'clear')").
 * Qui, solo nei test con DOM, lo si sostituisce con uno Storage in memoria.
 */
// Il tsconfig del server non ha la lib DOM: niente `document` o `Storage` come tipi, si passa da globalThis.
const globale = globalThis as unknown as Record<string, unknown>;
if (typeof globale.document !== 'undefined' && !globale.localStorage) {
  type StorageInMemoria = {
    readonly length: number;
    key: (indice: number) => string | null;
    getItem: (chiave: string) => string | null;
    setItem: (chiave: string, valore: string) => void;
    removeItem: (chiave: string) => void;
    clear: () => void;
  };
  const creaStorage = (): StorageInMemoria => {
    const dati = new Map<string, string>();
    return {
      get length() { return dati.size; },
      key: (indice) => Array.from(dati.keys())[indice] ?? null,
      getItem: (chiave) => dati.get(chiave) ?? null,
      setItem: (chiave, valore) => { dati.set(chiave, String(valore)); },
      removeItem: (chiave) => { dati.delete(chiave); },
      clear: () => { dati.clear(); },
    };
  };
  for (const nome of ['localStorage', 'sessionStorage']) {
    if (!globale[nome]) {
      Object.defineProperty(globalThis, nome, { value: creaStorage(), configurable: true, writable: true });
    }
  }
}
