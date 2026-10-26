import { afterEach, describe, expect, it, vi } from 'vitest';

// Il .env locale di chi esegue i test non deve entrare nella prova
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('validazione della configurazione', () => {
  it('le porte senza valore prendono il default numerico', async () => {
    vi.stubEnv('NODE_PORT', undefined as unknown as string);
    vi.stubEnv('INTERNAL_REQUEST_WINDOW_MS', undefined as unknown as string);
    const { default: config } = await import('../index');

    expect(config.NODE_PORT).toBe(3001);
    expect(config.INTERNAL_REQUEST_WINDOW_MS).toBe(60000);
  });

  it('le porte impostate diventano numeri', async () => {
    vi.stubEnv('NODE_PORT', '4000');
    const { default: config } = await import('../index');

    expect(config.NODE_PORT).toBe(4000);
  });

  it('una variabile non valida ferma l avvio indicando quale', async () => {
    vi.stubEnv('CLIENT_URL', 'non-un-indirizzo');
    const errori = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(process, 'exit').mockImplementation(((codice: number) => {
      throw new Error(`exit ${codice}`);
    }) as never);

    await expect(import('../index')).rejects.toThrow('exit 1');
    expect(errori.mock.calls.flat().join('\n')).toContain('- CLIENT_URL:');
  });
});
