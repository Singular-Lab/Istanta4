import express, { type Express } from 'express';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http, { type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CACHE_ASSET_CON_HASH,
  CACHE_HTML,
  compressioneRisposte,
  politicaCache,
  serviClientStatico,
} from '../staticiPrecompressi';

// Una build finta in una cartella temporanea: ogni variante ha un contenuto diverso, cosi' dal
// corpo decompresso si capisce quale file e' stato servito.
const ripeti = (testo: string) => `${testo}\n`.repeat(200);
const CONTENUTI = {
  indice: ripeti('<!doctype html><title>originale</title>'),
  indiceBr: ripeti('<!doctype html><title>variante br</title>'),
  indiceGz: ripeti('<!doctype html><title>variante gzip</title>'),
  script: ripeti('console.log("originale");'),
  scriptBr: ripeti('console.log("variante br");'),
  scriptGz: ripeti('console.log("variante gzip");'),
  stile: ripeti('body { color: black; }'),
  manifest: JSON.stringify({ name: 'Fidelity' }),
  segreto: 'password del server',
};

let cartella: string;
let radice: string;
const byte: Record<'indiceBr' | 'indiceGz' | 'scriptBr' | 'scriptGz', Buffer> = {
  indiceBr: Buffer.alloc(0), indiceGz: Buffer.alloc(0), scriptBr: Buffer.alloc(0), scriptGz: Buffer.alloc(0),
};

function creaApp(): Express {
  const app = express();
  // Lo stesso ordine di server.ts: compressione fra i middleware comuni, API, poi il client
  app.use(compressioneRisposte);
  app.get('/api/prova', (_req, res) => {
    res.json({ ok: true, testo: CONTENUTI.stile });
  });
  serviClientStatico(app, radice);
  return app;
}

interface RispostaGrezza { status: number; headers: IncomingHttpHeaders; corpo: Buffer }

/** Richiesta HTTP senza client che aggiunge o decomprime: header e byte come escono dal server. */
async function richiestaGrezza(app: Express, percorso: string, header: Record<string, string> = {}, metodo = 'GET'): Promise<RispostaGrezza> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address() as AddressInfo;
    return await new Promise<RispostaGrezza>((resolve, reject) => {
      const richiesta = http.request({ host: '127.0.0.1', port, path: percorso, method: metodo, headers: header, agent: false }, (risposta) => {
        const parti: Buffer[] = [];
        risposta.on('data', (parte: Buffer) => {
          parti.push(parte);
        });
        risposta.on('end', () => {
          resolve({ status: risposta.statusCode ?? 0, headers: risposta.headers, corpo: Buffer.concat(parti) });
        });
        risposta.on('error', reject);
      });
      richiesta.on('error', reject);
      richiesta.end();
    });
  } finally {
    server.close();
  }
}

/** Il corpo decodificato secondo il suo Content-Encoding (anche la compressione al volo). */
function testo(risposta: RispostaGrezza): string {
  const codifica = risposta.headers['content-encoding'];
  if (codifica === 'br') return brotliDecompressSync(risposta.corpo).toString();
  if (codifica === 'gzip') return gunzipSync(risposta.corpo).toString();
  return risposta.corpo.toString();
}

beforeAll(async () => {
  cartella = await mkdtemp(path.join(os.tmpdir(), 'staticiPrecompressi-'));
  radice = path.join(cartella, 'client');
  await mkdir(path.join(radice, 'assets', 'js'), { recursive: true });
  await mkdir(path.join(radice, 'assets', 'css'), { recursive: true });

  byte.indiceBr = brotliCompressSync(CONTENUTI.indiceBr);
  byte.indiceGz = gzipSync(CONTENUTI.indiceGz);
  byte.scriptBr = brotliCompressSync(CONTENUTI.scriptBr);
  byte.scriptGz = gzipSync(CONTENUTI.scriptGz);

  await writeFile(path.join(radice, 'index.html'), CONTENUTI.indice);
  await writeFile(path.join(radice, 'index.html.br'), byte.indiceBr);
  await writeFile(path.join(radice, 'index.html.gz'), byte.indiceGz);
  await writeFile(path.join(radice, 'assets', 'js', 'a1b2c3.js'), CONTENUTI.script);
  await writeFile(path.join(radice, 'assets', 'js', 'a1b2c3.js.br'), byte.scriptBr);
  await writeFile(path.join(radice, 'assets', 'js', 'a1b2c3.js.gz'), byte.scriptGz);
  // Sotto la soglia della build: nessuna variante, si comprime al volo
  await writeFile(path.join(radice, 'assets', 'css', 'd4e5f6.css'), CONTENUTI.stile);
  await writeFile(path.join(radice, 'manifest.json'), CONTENUTI.manifest);
  await writeFile(path.join(radice, '.nascosto'), CONTENUTI.segreto);
  // Fuori dalla cartella della build, anche con le sue varianti
  await writeFile(path.join(cartella, 'segreto.txt'), CONTENUTI.segreto);
  await writeFile(path.join(cartella, 'segreto.txt.gz'), gzipSync(CONTENUTI.segreto));
  await writeFile(path.join(cartella, 'segreto.txt.br'), brotliCompressSync(CONTENUTI.segreto));
});

afterAll(async () => {
  await rm(cartella, { recursive: true, force: true });
});

describe('politicaCache', () => {
  it('asset con hash immutabili, html sempre rivalidato, il resto con la cache predefinita', () => {
    expect(politicaCache('assets/js/a1b2c3.js')).toBe(CACHE_ASSET_CON_HASH);
    expect(politicaCache('index.html')).toBe(CACHE_HTML);
    expect(politicaCache('manifest.json')).toBeUndefined();
  });
});

describe('client statico: varianti precompresse', () => {
  it('con br accettato serve il .br cosi com e, con il tipo dell originale', async () => {
    const app = creaApp();

    const risposta = await richiestaGrezza(app, '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'gzip, deflate, br' });

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-encoding']).toBe('br');
    expect(risposta.headers['content-type']).toMatch(/^text\/javascript/);
    expect(risposta.headers.vary).toMatch(/Accept-Encoding/i);
    expect(risposta.headers['cache-control']).toBe(CACHE_ASSET_CON_HASH);
    // Gli stessi byte del file: nessuna seconda compressione al volo
    expect(Number(risposta.headers['content-length'])).toBe(byte.scriptBr.length);
    expect(risposta.corpo.equals(byte.scriptBr)).toBe(true);
    expect(brotliDecompressSync(risposta.corpo).toString()).toBe(CONTENUTI.scriptBr);
  });

  it('con solo gzip serve il .gz', async () => {
    const risposta = await richiestaGrezza(creaApp(), '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'gzip' });

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-encoding']).toBe('gzip');
    expect(risposta.corpo.equals(byte.scriptGz)).toBe(true);
    expect(gunzipSync(risposta.corpo).toString()).toBe(CONTENUTI.scriptGz);
  });

  it('br rifiutato con q=0: serve il .gz', async () => {
    const risposta = await richiestaGrezza(creaApp(), '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'br;q=0, gzip' });

    expect(risposta.headers['content-encoding']).toBe('gzip');
    expect(risposta.corpo.equals(byte.scriptGz)).toBe(true);
  });

  it('senza Accept-Encoding serve l originale, non compresso, con lo stesso Content-Type', async () => {
    const app = creaApp();

    const originale = await richiestaGrezza(app, '/assets/js/a1b2c3.js');
    const variante = await richiestaGrezza(app, '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'br' });

    expect(originale.status).toBe(200);
    expect(originale.headers['content-encoding']).toBeUndefined();
    expect(originale.corpo.toString()).toBe(CONTENUTI.script);
    expect(originale.headers['cache-control']).toBe(CACHE_ASSET_CON_HASH);
    expect(variante.headers['content-type']).toBe(originale.headers['content-type']);
  });

  it('HEAD della variante: header della variante, senza corpo', async () => {
    const risposta = await richiestaGrezza(creaApp(), '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'br' }, 'HEAD');

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-encoding']).toBe('br');
    expect(Number(risposta.headers['content-length'])).toBe(byte.scriptBr.length);
    expect(risposta.corpo.length).toBe(0);
  });

  it('Range e richieste condizionali valgono sui byte della variante', async () => {
    const app = creaApp();

    const parziale = await richiestaGrezza(app, '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'br', Range: 'bytes=0-3' });
    const intera = await richiestaGrezza(app, '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'br' });
    const etag = String(intera.headers.etag);
    const nonCambiata = await richiestaGrezza(app, '/assets/js/a1b2c3.js', { 'Accept-Encoding': 'br', 'If-None-Match': etag });

    expect(parziale.status).toBe(206);
    expect(parziale.headers['content-range']).toBe(`bytes 0-3/${byte.scriptBr.length}`);
    expect(parziale.corpo.equals(byte.scriptBr.subarray(0, 4))).toBe(true);
    expect(nonCambiata.status).toBe(304);
    expect(nonCambiata.corpo.length).toBe(0);
  });
});

describe('client statico: index.html e rotte della SPA', () => {
  it('GET / serve la variante di index.html con no-cache', async () => {
    const risposta = await richiestaGrezza(creaApp(), '/', { 'Accept-Encoding': 'br', Accept: 'text/html' });

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-encoding']).toBe('br');
    expect(risposta.headers['content-type']).toMatch(/^text\/html/);
    expect(risposta.headers['cache-control']).toBe(CACHE_HTML);
    expect(risposta.corpo.equals(byte.indiceBr)).toBe(true);
  });

  it('una rotta della SPA restituisce index.html precompresso e no-cache', async () => {
    const risposta = await request(creaApp())
      .get('/promozioni/in-corso')
      .set('Accept', 'text/html')
      .set('Accept-Encoding', 'gzip');

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-encoding']).toBe('gzip');
    expect(risposta.headers['cache-control']).toBe(CACHE_HTML);
    expect(risposta.text).toBe(CONTENUTI.indiceGz);
  });

  it('senza Accept-Encoding la rotta della SPA e /index.html restituiscono l originale, no-cache', async () => {
    const app = creaApp();

    const rotta = await richiestaGrezza(app, '/promozioni/in-corso', { Accept: 'text/html' });
    const indice = await richiestaGrezza(app, '/index.html', { Accept: 'text/html' });

    for (const risposta of [rotta, indice]) {
      expect(risposta.status).toBe(200);
      expect(risposta.headers['content-encoding']).toBeUndefined();
      expect(risposta.headers['cache-control']).toBe(CACHE_HTML);
      expect(risposta.corpo.toString()).toBe(CONTENUTI.indice);
    }
  });
});

describe('client statico: file senza variante e compressione al volo', () => {
  it('un asset senza variante si comprime al volo una sola volta e resta immutabile', async () => {
    const risposta = await request(creaApp()).get('/assets/css/d4e5f6.css').set('Accept-Encoding', 'gzip');

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-encoding']).toBe('gzip');
    expect(risposta.headers['cache-control']).toBe(CACHE_ASSET_CON_HASH);
    // supertest decomprime una volta: se fosse compresso due volte il testo non tornerebbe
    expect(risposta.text).toBe(CONTENUTI.stile);
  });

  it('una risposta che ha gia Content-Encoding non si ricomprime', async () => {
    const app = express();
    app.use(compressioneRisposte);
    const giaCompresso = gzipSync(CONTENUTI.stile);
    app.get('/gia-compresso', (_req, res) => {
      res.type('css').setHeader('Content-Encoding', 'gzip');
      res.send(giaCompresso);
    });

    const risposta = await richiestaGrezza(app, '/gia-compresso', { 'Accept-Encoding': 'br, gzip' });

    expect(risposta.headers['content-encoding']).toBe('gzip');
    expect(risposta.corpo.equals(giaCompresso)).toBe(true);
  });

  it('gli altri file della build hanno la cache predefinita di express.static', async () => {
    const risposta = await richiestaGrezza(creaApp(), '/manifest.json');

    expect(risposta.status).toBe(200);
    expect(risposta.headers['cache-control']).toBe('public, max-age=0');
    expect(risposta.corpo.toString()).toBe(CONTENUTI.manifest);
  });

  it('le API non cambiano: niente cache del client, e nessun index.html per una API inesistente', async () => {
    const app = creaApp();

    const api = await request(app).get('/api/prova').set('Accept-Encoding', 'gzip');
    const inesistente = await request(app).get('/api/inesistente').set('Accept', 'text/html');

    expect(api.status).toBe(200);
    expect(api.headers['cache-control']).toBeUndefined();
    expect(api.headers['content-encoding']).toBe('gzip');
    expect(api.body).toEqual({ ok: true, testo: CONTENUTI.stile });
    expect(inesistente.status).toBe(404);
    expect(inesistente.text).not.toContain('<title>originale</title>');
  });
});

describe('client statico: percorsi fuori dalla build', () => {
  it.each([
    '/..%2fsegreto.txt',
    '/%2e%2e%2fsegreto.txt',
    '/assets/..%2f..%2fsegreto.txt',
    '/assets/js/..%2f..%2f..%2fsegreto.txt',
  ])('%s e rifiutato, anche se esistono le sue varianti', async (percorso) => {
    const app = creaApp();

    const conVarianti = await richiestaGrezza(app, percorso, { 'Accept-Encoding': 'br, gzip', Accept: 'text/html' });
    const senza = await richiestaGrezza(app, percorso, { Accept: 'text/html' });

    for (const risposta of [conVarianti, senza]) {
      expect(risposta.status).toBe(403);
      expect(testo(risposta)).toBe('Forbidden');
    }
  });

  it('i file nascosti della build non si servono', async () => {
    const app = creaApp();

    const comePagina = await richiestaGrezza(app, '/.nascosto', { 'Accept-Encoding': 'gzip' });
    const comeFile = await richiestaGrezza(app, '/.nascosto', { 'Accept-Encoding': 'gzip', Accept: 'application/octet-stream' });

    // Come pagina riceve index.html (fallback della SPA), come file un 404
    expect(testo(comePagina)).toBe(CONTENUTI.indiceGz);
    expect(comeFile.status).toBe(404);
    expect(testo(comeFile)).not.toContain(CONTENUTI.segreto);
  });
});
