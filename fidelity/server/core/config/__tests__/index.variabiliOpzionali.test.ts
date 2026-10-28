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

describe('servizi AI e Meta', () => {
  const OPENAI = ['OPENAI_API_KEY', 'ASSISTANT_ID', 'OPEN_AI_ASSISTANT_ID', 'OPEN_AI_ASSISTANT_ID_TRANSLATION', 'OPENAI_PROJECT_ID'];

  it('senza variabili valgono i default: indirizzo AI, 120 s, Graph API v24.0', async () => {
    vi.stubEnv('AI_RICETTE_API_URL', undefined as unknown as string);
    vi.stubEnv('AI_RICETTE_TIMEOUT_MS', undefined as unknown as string);
    vi.stubEnv('META_GRAPH_API_VERSION', undefined as unknown as string);
    const { default: config } = await import('../index');

    expect(config.AI_RICETTE_API_URL).toBe('https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php');
    expect(config.AI_RICETTE_TIMEOUT_MS).toBe(120000);
    expect(config.META_GRAPH_API_VERSION).toBe('v24.0');
  });

  it('quando sono impostate prevalgono, con il tempo massimo come numero', async () => {
    vi.stubEnv('AI_RICETTE_API_URL', 'https://ai.test/endpoint.php');
    vi.stubEnv('AI_RICETTE_TIMEOUT_MS', '30000');
    vi.stubEnv('META_GRAPH_API_VERSION', 'v25.0');
    const { default: config } = await import('../index');

    expect(config.AI_RICETTE_API_URL).toBe('https://ai.test/endpoint.php');
    expect(config.AI_RICETTE_TIMEOUT_MS).toBe(30000);
    expect(config.META_GRAPH_API_VERSION).toBe('v25.0');
  });

  it('le variabili OpenAI non lette dal codice sono facoltative, API_KEY_AI no', async () => {
    for (const nome of OPENAI) vi.stubEnv(nome, undefined as unknown as string);
    const { default: config } = await import('../index');
    expect(config.OPENAI_API_KEY).toBeUndefined();

    vi.resetModules();
    vi.stubEnv('API_KEY_AI', undefined as unknown as string);
    const errori = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(process, 'exit').mockImplementation(((codice: number) => {
      throw new Error(`exit ${codice}`);
    }) as never);

    await expect(import('../index')).rejects.toThrow('exit 1');
    expect(errori.mock.calls.flat().join('\n')).toContain('- API_KEY_AI:');
  });
});
