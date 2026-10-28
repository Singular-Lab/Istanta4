import os from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { numeroWorkerHttp } from '../cluster';

afterEach(() => {
  vi.unstubAllEnvs();
});

// Il conto deve coincidere con i worker che server/index.ts fa partire
describe('numeroWorkerHttp', () => {
  it('in sviluppo il server e\' un processo solo', () => {
    vi.stubEnv('HTTP_WORKERS', '2');

    expect(numeroWorkerHttp('development')).toBe(1);
  });

  it('senza NODE_ENV vale sviluppo, come nella configurazione', () => {
    vi.stubEnv('HTTP_WORKERS', '2');
    vi.stubEnv('NODE_ENV', undefined);

    expect(numeroWorkerHttp()).toBe(1);
  });

  it.each([['production'], ['test']])('in %s vale HTTP_WORKERS, entro il numero di CPU', (ambiente) => {
    vi.stubEnv('HTTP_WORKERS', '1');

    expect(numeroWorkerHttp(ambiente)).toBe(1);
  });

  it('senza HTTP_WORKERS in produzione sono al massimo 2', () => {
    vi.stubEnv('HTTP_WORKERS', '');

    expect(numeroWorkerHttp('production')).toBe(Math.min(os.cpus().length, 2));
  });
});
