import type { RequestHandler } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eRichiestaWebpliantSsr, ID_DATI_SSR, serializzaDatiSsr, type BootstrapWebpliantSsr, type DatiWebpliantSsr } from '../../../src/ssr/webpliant';

interface ManifestEntry {
  file: string;
  css?: string[];
  imports?: string[];
}

interface RisultatoRendering {
  html: string;
  bootstrap: BootstrapWebpliantSsr;
}

interface OpzioniSsr {
  cartellaClient: string;
  carica: (url: URL) => Promise<DatiWebpliantSsr>;
  render: (dati: DatiWebpliantSsr) => Promise<RisultatoRendering>;
  timeoutMs?: number;
}

const escapeHtml = (testo: string) => testo.replace(/[&<>"']/g, carattere => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[carattere]!);

export function creaSsrWebpliant({ cartellaClient, carica, render, timeoutMs = 20_000 }: OpzioniSsr): RequestHandler {
  return async (req, res, next) => {
    const url = new URL(req.originalUrl, 'http://ssr.local');
    if (!['GET', 'HEAD'].includes(req.method) || !req.accepts('html') || !eRichiestaWebpliantSsr(url)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const risultato = await Promise.race([
        (async () => {
          const [dati, template, manifestTesto] = await Promise.all([
            carica(url),
            readFile(path.join(cartellaClient, 'index.html'), 'utf8'),
            readFile(path.join(cartellaClient, '.vite/manifest.json'), 'utf8'),
          ]);
          const rendering = await render(dati);
          const manifest = JSON.parse(manifestTesto) as Record<string, ManifestEntry>;
          const css = new Set<string>();
          const visitati = new Set<string>();
          const visita = (chiave: string) => {
            if (visitati.has(chiave)) return;
            visitati.add(chiave);
            const entry = manifest[chiave];
            entry?.css?.forEach(file => css.add(file));
            entry?.imports?.forEach(visita);
          };
          ['index.html', 'src/pages/WebpliantLayout/index.tsx', 'src/pages/WebPliant/index.tsx',
            'src/pages/WebPliant/CarouselContainer/index.tsx'].forEach(visita);
          const base = process.env.BASE_URL || '/';
          const head = `${[...css].map(file => `<link rel="stylesheet" href="${escapeHtml(base + file)}">`).join('')
             }<style id="webpliant-styles">${dati.css.replace(/</g, '\\3c ')}</style>`;
          const bootstrap = `<script id="${ID_DATI_SSR}" type="application/json">${serializzaDatiSsr(rendering.bootstrap)}</script>`;
          if (!template.includes('<!--ssr-app-->') || !template.includes('<!--ssr-head-->')) {
            throw new Error('Template SSR non disponibile: ricostruire il client');
          }
          return template
            .replace('<!--ssr-head-->', () => head)
            .replace('<!--ssr-app-->', () => rendering.html)
            .replace('<!--ssr-state-->', () => bootstrap)
            .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(dati.dataWebPliant.nomeWorkspace || 'Volantino')}</title>`)
            .replace(/<noscript>[^<]*<\/noscript>/, '');
        })(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Tempo di caricamento del volantino superato')), timeoutMs);
        }),
      ]);
      if (!res.destroyed) res.status(200).type('html').send(risultato);
    } catch (error) {
      const codice = typeof error === 'object' && error !== null && 'httpStatus' in error ? Number(error.httpStatus) : 500;
      const stato = codice >= 400 && codice <= 599 ? codice : 500;
      const messaggio = stato === 404 ? 'Volantino non trovato'
        : stato === 400 ? 'Parametri del volantino non validi' : 'Il volantino non e disponibile. Riprova piu tardi.';
      if (!res.destroyed) res.status(stato).type('html').send(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${messaggio}</title></head><body><main><h1>${messaggio}</h1><a href="${escapeHtml(req.originalUrl)}">Riprova</a></main></body></html>`);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}
