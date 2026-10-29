import compression from 'compression';
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Il client React (dist/client) servito da Express: cache per tipo di file, file precompressi
 * dalla build (il plugin compressioneStatica di vite.config.ts scrive .br e .gz accanto
 * all'originale) e compressione
 * al volo solo per cio' che non e' gia' compresso.
 */

/** Gli asset di Vite hanno l'hash nel nome: lo stesso URL ha sempre lo stesso contenuto. */
export const CACHE_ASSET_CON_HASH = 'public, max-age=31536000, immutable';

/** index.html si rivalida sempre: dopo un deploy il browser chiede subito i nuovi asset. */
export const CACHE_HTML = 'no-cache';

/** Varianti precompresse, nell'ordine in cui si preferiscono quando il client le accetta tutte. */
const VARIANTI = [
  { codifica: 'br', estensione: '.br' },
  { codifica: 'gzip', estensione: '.gz' },
] as const;

type Variante = (typeof VARIANTI)[number];

/** Header impostati per una variante: se l'invio fallisce si tolgono e decide express.static. */
const HEADER_DELLA_VARIANTE = [
  'Content-Encoding', 'Content-Type', 'Content-Length', 'Content-Range', 'Cache-Control', 'ETag', 'Last-Modified', 'Accept-Ranges',
];

/** Cache-Control di un file del client, dal percorso relativo alla cartella della build. */
export function politicaCache(percorsoRelativo: string): string | undefined {
  const relativo = percorsoRelativo.split(path.sep).join('/');
  if (relativo.startsWith('assets/')) return CACHE_ASSET_CON_HASH;
  if (relativo.endsWith('.html')) return CACHE_HTML;
  return undefined;
}

function haGiaUnaCodifica(res: Response): boolean {
  const codifica = res.getHeader('Content-Encoding');
  return codifica !== undefined && String(codifica).toLowerCase() !== 'identity';
}

/**
 * Compressione al volo delle risposte (API e statici senza variante precompressa). Una risposta
 * che ha gia' Content-Encoding (i file precompressi qui sotto) non si ricomprime: compression lo
 * controlla gia' da se', il filtro lo rende esplicito e indipendente dall'ordine dei suoi controlli.
 */
export const compressioneRisposte = compression({
  level: 6,
  threshold: 0,
  filter: (req, res) => !haGiaUnaCodifica(res) && compression.filter(req, res),
});

// Stesso controllo del fallback della SPA: le API non passano mai dai file del client
const eApi = (percorso: string) => percorso.startsWith('/api');

type FileDelClient = { assoluto: string; relativo: string };

type Risoluzione =
  | { esito: 'file'; file: FileDelClient }
  /** Il percorso esce dalla cartella della build (../ anche codificato): si rifiuta. */
  | { esito: 'fuori' }
  /** Non e' un file da gestire qui (URL malformato, file nascosto): decide express.static. */
  | { esito: 'altro' };

/** Il file della build indicato dall'URL, controllando che resti dentro la cartella. */
function risolvi(radice: string, percorsoUrl: string): Risoluzione {
  let decodificato: string;
  try {
    decodificato = decodeURIComponent(percorsoUrl);
  } catch {
    return { esito: 'altro' };
  }
  if (decodificato.includes('\0')) return { esito: 'altro' };

  const conIndice = decodificato.endsWith('/') ? `${decodificato}index.html` : decodificato;
  const assoluto = path.resolve(radice, `.${path.sep}${conIndice}`);
  const relativo = path.relative(radice, assoluto);
  if (relativo === '..' || relativo.startsWith(`..${path.sep}`) || path.isAbsolute(relativo)) return { esito: 'fuori' };
  if (relativo === '' || relativo.split(path.sep).some(parte => parte.startsWith('.'))) return { esito: 'altro' };
  return { esito: 'file', file: { assoluto, relativo } };
}

async function eUnFile(percorso: string): Promise<boolean> {
  try {
    return (await stat(percorso)).isFile();
  } catch {
    return false;
  }
}

/** La variante da servire: la prima accettata dal client che esiste accanto all'originale. */
async function varianteDa(req: Request, file: FileDelClient): Promise<Variante | null> {
  const accettate = VARIANTI.filter(v => req.acceptsEncodings(v.codifica) === v.codifica);
  if (accettate.length === 0 || !(await eUnFile(file.assoluto))) return null;
  for (const variante of accettate) {
    if (await eUnFile(file.assoluto + variante.estensione)) return variante;
  }
  return null;
}

/**
 * Invia la variante precompressa del file, se c'e' e il client la accetta. Restituisce false
 * quando non c'e' nulla da inviare: allora l'originale lo serve il chiamante. HEAD, Range, ETag
 * e richieste condizionali li gestisce res.sendFile, sui byte della variante; se l'invio fallisce
 * prima di partire si chiama `senzaVariante`, che serve l'originale.
 */
async function inviaVariante(
  req: Request,
  res: Response,
  next: NextFunction,
  radice: string,
  file: FileDelClient,
  senzaVariante: () => void
): Promise<boolean> {
  const variante = await varianteDa(req, file);
  if (!variante) return false;

  const cache = politicaCache(file.relativo);
  res.vary('Accept-Encoding');
  // Il tipo e' quello dell'originale: send non sovrascrive un Content-Type gia' presente
  res.type(path.extname(file.assoluto));
  res.sendFile(file.relativo + variante.estensione, {
    root: radice,
    headers: { 'Content-Encoding': variante.codifica, ...(cache ? { 'Cache-Control': cache } : {}) },
  }, (errore?: NodeJS.ErrnoException) => {
    // Come res.sendFile senza callback: client che chiude la connessione, nulla da fare
    if (!errore || errore.code === 'ECONNABORTED' || errore.syscall === 'write') return;
    if (res.headersSent) {
      next(errore);
      return;
    }
    // Variante sparita fra il controllo e l'invio, precondizione o Range non soddisfatti sui
    // byte compressi: si torna all'originale, come prima dei file precompressi
    for (const header of HEADER_DELLA_VARIANTE) res.removeHeader(header);
    senzaVariante();
  });
  return true;
}

/**
 * GET e HEAD dei file della build che hanno una variante precompressa accettata dal client.
 * Il resto (file senza variante, cartelle, file nascosti) passa a express.static.
 */
export function staticiPrecompressi(cartellaBuild: string): RequestHandler {
  const radice = path.resolve(cartellaBuild);
  return async (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || eApi(req.path)) {
      next();
      return;
    }
    const risoluzione = risolvi(radice, req.path);
    if (risoluzione.esito === 'fuori') {
      res.sendStatus(403);
      return;
    }
    if (risoluzione.esito === 'altro' || !(await inviaVariante(req, res, next, radice, risoluzione.file, next))) next();
  };
}

/**
 * Monta il client sull'app, dopo le API: varianti precompresse, poi express.static per tutti
 * gli altri file, poi il fallback della SPA che restituisce index.html per le rotte del client.
 */
export function serviClientStatico(app: Express, cartellaBuild: string): void {
  const radice = path.resolve(cartellaBuild);
  const indice: FileDelClient = { assoluto: path.join(radice, 'index.html'), relativo: 'index.html' };

  app.use(staticiPrecompressi(radice));
  app.use(express.static(radice, {
    setHeaders: (res, percorso) => {
      const cache = politicaCache(path.relative(radice, percorso));
      if (cache) res.setHeader('Cache-Control', cache);
    },
  }));

  // Fallback della SPA, dopo API e statici. Express 5: regex al posto del wildcard '*'
  app.get(/(.*)/, async (req, res, next) => {
    // Richieste non HTML (asset mancanti, chiamate API) non ricevono index.html
    if (!req.accepts('html') || eApi(req.path)) {
      next();
      return;
    }
    const inviaOriginale = () => res.sendFile(indice.relativo, { root: radice, headers: { 'Cache-Control': CACHE_HTML } });
    if (!(await inviaVariante(req, res, next, radice, indice, inviaOriginale))) inviaOriginale();
  });
}
