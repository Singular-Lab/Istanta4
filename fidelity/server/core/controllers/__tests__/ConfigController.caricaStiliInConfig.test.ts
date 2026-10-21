import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerUtils } from '../../utils/ServerUtils';
import { ConfigController } from '../ConfigController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Il controller all'import si aggancia al server websocket: qui non serve
vi.mock('../../../ws-server', () => ({
  emitToClients: () => undefined,
}));

const CSS = '/* titolo */\n.box {\n  color: red;\n}\n';

let cwdVuota: string;

beforeEach(() => {
  // Una cartella vuota come cwd: se il controller scrivesse il CSS su un percorso relativo, comparirebbe qui
  cwdVuota = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-css-'));
  vi.spyOn(process, 'cwd').mockReturnValue(cwdVuota);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(cwdVuota, { recursive: true, force: true });
});

function createApp() {
  const configService = { caricaStiliInConfig: vi.fn().mockResolvedValue(undefined) };
  const app = express();
  new ConfigController(configService as any).registerRoutes(app);
  return { app, configService };
}

describe('POST /api/caricaStiliInConfig', () => {
  it('salva il CSS minificato nella configurazione senza lasciare file su disco', async () => {
    const { app, configService } = createApp();

    const res = await request(app)
      .post('/api/caricaStiliInConfig')
      .field('id', 'cfg-1')
      .attach('file', Buffer.from(CSS), { filename: 'stile.css', contentType: 'text/css' });

    expect(res.status).toBe(200);
    expect(configService.caricaStiliInConfig).toHaveBeenCalledTimes(1);
    const [id, salvato] = configService.caricaStiliInConfig.mock.calls[0];
    expect(id).toBe('cfg-1');
    expect(salvato).toBe(ServerUtils.minifyCSS(CSS));
    expect(salvato).not.toContain('titolo');
    expect(fs.readdirSync(cwdVuota)).toEqual([]);
  });

  it('un file che non e CSS non arriva alla configurazione', async () => {
    const { app, configService } = createApp();

    const res = await request(app)
      .post('/api/caricaStiliInConfig')
      .field('id', 'cfg-1')
      .attach('file', Buffer.from('non css'), { filename: 'stile.txt', contentType: 'text/plain' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(configService.caricaStiliInConfig).not.toHaveBeenCalled();
    expect(fs.readdirSync(cwdVuota)).toEqual([]);
  });
});
