import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../ConfigController';
import { inviaFormDataAOlimpo } from '../../http/olimpo';

// Upload verso Olympus: si controlla la risposta, la rete non serve
vi.mock('../../http/olimpo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../http/olimpo')>()),
  inviaFormDataAOlimpo: vi.fn(),
}));
const post = vi.mocked(inviaFormDataAOlimpo);

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

// Base64 valido di pochi byte, sufficiente per la regex del controller
const BASE64_IMMAGINE = 'iVBORw0KGgo=';

function createApp() {
  const configService = { saveConfigWebPliantFromVolantino: vi.fn().mockResolvedValue({ ok: true }) };
  const app = express();
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1', private_key: 'chiave' }; next(); });
  new ConfigController(configService as any).registerRoutes(app);
  return { app, configService };
}

const configurazione = (logoBase64: string, iconaPagina: string) => ({
  _id: 'cfg-1',
  webpliant: { logo_header: [{ base64: logoBase64, url: '' }], icona_pagina: iconaPagina },
});

afterEach(() => {
  vi.restoreAllMocks();
  post.mockReset();
});

describe('POST /api/saveWebpliantConfig', () => {
  it.each([
    ['logo dell\'header', configurazione(BASE64_IMMAGINE, '')],
    ['icona della pagina', configurazione('', BASE64_IMMAGINE)],
  ])('Olympus rifiuta il %s: risposta di errore e configurazione non salvata', async (_immagine, corpo) => {
    post.mockResolvedValue({ data: { esito: false, guidId: '', error: 'formato non supportato' }, status: 200 });
    const { app, configService } = createApp();

    const res = await request(app).post('/api/saveWebpliantConfig').send(corpo);

    expect(res.status).toBe(502);
    expect(post).toHaveBeenCalledOnce();
    expect(configService.saveConfigWebPliantFromVolantino).not.toHaveBeenCalled();
  });

  it('base64 vuoti: nessuna chiamata a Olympus e configurazione salvata', async () => {
    post.mockRejectedValue(new Error('chiamata non attesa'));
    const { app, configService } = createApp();

    const res = await request(app).post('/api/saveWebpliantConfig').send(configurazione('', ''));

    expect(res.status).toBe(200);
    expect(post).not.toHaveBeenCalled();
    expect(configService.saveConfigWebPliantFromVolantino).toHaveBeenCalledOnce();
  });

  it('Olympus accetta il logo: la configurazione salvata punta all\'immagine caricata', async () => {
    post.mockResolvedValue({ data: { esito: true, guidId: 'guid-logo', error: '' }, status: 200 });
    const { app, configService } = createApp();

    const res = await request(app).post('/api/saveWebpliantConfig').send(configurazione(BASE64_IMMAGINE, ''));

    expect(res.status).toBe(200);
    const [salvata] = configService.saveConfigWebPliantFromVolantino.mock.calls[0];
    expect(salvata.webpliant.logo_header[0].url).toMatch(/getThumbNailOnDemand\?guidId=guid-logo$/);
  });

  it.each([
    ['relativa al proxy', '/olimpo/foto/getThumbNailOnDemand?guidId=guid-icona'],
    ['assoluta', 'http://olimpo:3000/foto/getThumbNailOnDemand?guidId=guid-icona'],
  ])("un'icona della pagina rimandata come URL %s viene salvata come GUID", async (_forma, icona) => {
    post.mockRejectedValue(new Error('chiamata non attesa'));
    const { app, configService } = createApp();

    const res = await request(app).post('/api/saveWebpliantConfig').send(configurazione('', icona));

    expect(res.status).toBe(200);
    const [salvata] = configService.saveConfigWebPliantFromVolantino.mock.calls[0];
    expect(salvata.webpliant.icona_pagina).toBe('guid-icona');
  });
});
