import { afterEach, describe, expect, it, vi } from 'vitest';

const VARIABILI = ['DB_POOL_MAX', 'DB_SLOW_QUERY_THRESHOLD', 'REDIS_URL'] as const;

// Il .env locale di chi esegue i test non deve entrare nella prova
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('variabili d ambiente lette fuori dallo schema', () => {
  it('sono opzionali: la configurazione si carica anche senza', async () => {
    for (const nome of VARIABILI) vi.stubEnv(nome, undefined as unknown as string);
    const { default: config } = await import('../index');

    expect(config.DB_POOL_MAX).toBeUndefined();
    expect(config.REDIS_URL).toBeUndefined();
  });

  it('quando sono impostate compaiono nella configurazione', async () => {
    vi.stubEnv('DB_POOL_MAX', '12');
    vi.stubEnv('DB_SLOW_QUERY_THRESHOLD', '300');
    vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:6379');
    const { default: config } = await import('../index');

    expect(config.DB_POOL_MAX).toBe('12');
    expect(config.DB_SLOW_QUERY_THRESHOLD).toBe('300');
    expect(config.REDIS_URL).toBe('redis://127.0.0.1:6379');
  });
});
