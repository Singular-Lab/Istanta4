import express from 'express';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BootstrapWebpliantSsr, DatiWebpliantSsr } from '../../../../src/ssr/webpliant';
import { creaSsrWebpliant } from '../ssrWebpliant';
import { serviClientStatico } from '../staticiPrecompressi';

let cartella: string;
beforeAll(async () => {
  cartella = await mkdtemp(path.join(tmpdir(), 'fidelity-ssr-'));
  await mkdir(path.join(cartella, '.vite'));
  await writeFile(path.join(cartella, 'index.html'), '<!doctype html><html><head><title>SPA</title><!--ssr-head--></head><body><div id="root"><!--ssr-app--></div><!--ssr-state--></body></html>');
  await writeFile(path.join(cartella, '.vite/manifest.json'), JSON.stringify({ 'index.html': { file: 'assets/main.js', css: ['assets/app.css'] } }));
});
afterAll(async () => { await rm(cartella, { recursive: true, force: true }); });

function creaApp() {
  const dati = {
    url: '/webpliant/volantino?id=w1&idArea=a1&idCanale=c1',
    dataWebPliant: { nomeWorkspace: 'Volantino di test' },
    config: { webpliant: {} }, css: '.test { color: red; }',
  } as unknown as DatiWebpliantSsr;
  const carica = vi.fn().mockResolvedValue(dati);
  const render = vi.fn().mockResolvedValue({ html: '<main>Latte 1,99</main>', bootstrap: { dati, reduxState: {} } as BootstrapWebpliantSsr });
  const app = express();
  app.use(creaSsrWebpliant({ cartellaClient: cartella, carica, render }));
  serviClientStatico(app, cartella);
  return { app, carica, render, dati };
}

const URL_VOLANTINO = '/webpliant/volantino?id=w1&idArea=a1&idCanale=c1';
describe('risposta HTTP SSR del volantino pubblico', () => {
  it('restituisce contenuto iniziale, CSS, stato e no-store', async () => {
    const { app } = creaApp();
    const risposta = await request(app).get(URL_VOLANTINO).set('Accept', 'text/html').expect(200);
    expect(risposta.text).toContain('<main>Latte 1,99</main>');
    expect(risposta.text).toContain('<title>Volantino di test</title>');
    expect(risposta.text).toContain('assets/app.css');
    expect(risposta.text).toContain('type="application/json"');
    expect(risposta.headers['cache-control']).toBe('no-store');
  });

  it('HEAD mantiene gli header senza corpo', async () => {
    const { app } = creaApp();
    const risposta = await request(app).head(URL_VOLANTINO).set('Accept', 'text/html').expect(200);
    expect(risposta.text).toBeUndefined();
    expect(risposta.headers['cache-control']).toBe('no-store');
  });

  it.each(['date=2099-01-01', 'isEditor=true', 'debug=true', 'sessionWishlistId=lista-test', 'c=true'])('lascia alla SPA la modalita %s', async parametro => {
    const { app, carica } = creaApp();
    const risposta = await request(app).get(`${URL_VOLANTINO}&${parametro}`).set('Accept', 'text/html').expect(200);
    expect(risposta.text).toContain('<!--ssr-app-->');
    expect(carica).not.toHaveBeenCalled();
  });

  it.each([400, 404, 503])('mantiene lo stato di errore %s e non espone dettagli interni', async httpStatus => {
    const { app, carica } = creaApp();
    carica.mockRejectedValue(Object.assign(new Error('Dettaglio interno da non esporre'), { httpStatus }));
    const risposta = await request(app).get(URL_VOLANTINO).set('Accept', 'text/html').expect(httpStatus);
    expect(risposta.text).toContain('Riprova');
    expect(risposta.text).not.toContain('Dettaglio interno');
    expect(risposta.headers['cache-control']).toBe('no-store');
  });

  it('non permette ai dati iniziali di chiudere script o style', async () => {
    const { app, dati } = creaApp();
    dati.dataWebPliant.nomeWorkspace = '</script><script>codiceTest()</script>';
    dati.css = '</style><script>codiceCssTest()</script>';
    const risposta = await request(app).get(URL_VOLANTINO).set('Accept', 'text/html').expect(200);
    expect(risposta.text).not.toContain('<script>codiceTest()');
    expect(risposta.text).not.toContain('<script>codiceCssTest()');
    expect(risposta.text).toContain('\\u003c/script\\u003e');
  });

  it('non espone il bundle server ne trasforma le API in HTML', async () => {
    const { app, carica } = creaApp();
    await request(app).get('/dist/ssr/entry-server.js').set('Accept', 'application/javascript').expect(404);
    await request(app).get('/api/assente').set('Accept', 'application/json').expect(404);
    expect(carica).not.toHaveBeenCalled();
  });
});
