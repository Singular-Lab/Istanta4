import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { creaProxyOlimpo } from '../olimpoProxy';

// Olimpo finto: registra le richieste ricevute e risponde come gli endpoint reali
const ricevute: Array<{ method: string; url: string; cookie?: string; authorization?: string; range?: string }> = [];
let olimpo: http.Server;
let target: string;

beforeAll(async () => {
  const app = express();
  app.use((req, res) => {
    ricevute.push({
      method: req.method,
      url: req.url,
      cookie: req.headers.cookie,
      authorization: req.headers.authorization,
      range: req.headers.range,
    });
    res.setHeader('Set-Cookie', 'olimpo=1');
    if (req.headers.range) {
      res.status(206).setHeader('Content-Range', 'bytes 0-3/10').send('vide');
      return;
    }
    res.type('image/png').send('immagine');
  });
  olimpo = app.listen(0);
  await new Promise(resolve => olimpo.once('listening', resolve));
  target = `http://127.0.0.1:${(olimpo.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => olimpo.close(() => resolve())));

beforeEach(() => {
  ricevute.length = 0;
});

function createApp() {
  const app = express();
  app.use('/olimpo', creaProxyOlimpo(target));
  return app;
}

describe('proxy /olimpo', () => {
  it('inoltra la miniatura con la query e senza cookie ne Authorization del browser', async () => {
    const res = await request(createApp())
      .get('/olimpo/foto/getThumbNailOnDemand?guidId=abc&performante=true')
      .set('Cookie', 'connect.sid=segreto')
      .set('Authorization', 'chiave');

    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString()).toBe('immagine');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(ricevute).toEqual([{
      method: 'GET', url: '/foto/getThumbNailOnDemand?guidId=abc&performante=true',
      cookie: undefined, authorization: undefined, range: undefined,
    }]);
  });

  it('passa le richieste Range dei video e restituisce 206', async () => {
    const res = await request(createApp())
      .get('/olimpo/materiali/getVideoOnDemand?guidId=v1')
      .set('Range', 'bytes=0-3');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-3/10');
    expect(ricevute[0].range).toBe('bytes=0-3');
  });

  it.each([
    ['POST', '/olimpo/materiali/uploadMateriale'],
    ['POST', '/olimpo/foto/updateFotoPathWeb'],
    ['GET', '/olimpo/auth/checkIdentity'],
    ['DELETE', '/olimpo/foto/getThumbNailOnDemand'],
  ])('%s %s non arriva a Olimpo', async (metodo, percorso) => {
    const agente = request(createApp()) as any;
    const res = await agente[metodo.toLowerCase()](percorso);

    expect(res.status).toBe(404);
    expect(ricevute).toEqual([]);
  });

  it('con Olimpo irraggiungibile risponde 502', async () => {
    const app = express();
    // Porta 9 (discard): nessun servizio in ascolto
    app.use('/olimpo', creaProxyOlimpo('http://127.0.0.1:9'));

    const res = await request(app).get('/olimpo/foto/getThumbNailOnDemand?guidId=abc');

    expect(res.status).toBe(502);
  });

  it('inoltra il polling di socket.io', async () => {
    const res = await request(createApp()).get('/olimpo/socket.io/?EIO=4&transport=polling');

    expect(res.status).toBe(200);
    expect(ricevute[0].url).toBe('/socket.io/?EIO=4&transport=polling');
  });
});
