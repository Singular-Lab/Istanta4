import { Express, NextFunction, Request, Response } from 'express';
import 'express-session';
import helmet from 'helmet';
import config from '../config';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';
/**
 * Configurazione avanzata di Helmet per la sicurezza
 */
export function configureSecurityHeaders(app: Express): void {
  // Configurazione base delle direttive CSP
  const baseDirectives = {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Necessario per alcuni componenti CSS
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net",

    ],
    scriptSrc: [
      "'self'",
      "https://cdn.jsdelivr.net",
      "https://www.googletagmanager.com",
      "'wasm-unsafe-eval'", // Richiesto da @react-pdf/renderer (fontkit/harfbuzz via WebAssembly)
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "https://fonts.googleapis.com",
      "data:"
    ],
    imgSrc: [
      "'self'",
      "https:",
      "blob:",
      "data:",
      config.OLYMPUS_IP_ADDRESS_CORS,
    ],
    connectSrc: [
      "'self'",
      "wss:",
      "ws:",
      config.CLIENT_URL || "'self'",
      config.OLYMPUS_IP_ADDRESS_CORS,
      config.ISTANTA_IP_ADDRESS
    ],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'", "blob:"]
  };

  // La direttiva upgrade-insecure-requests viene ignorata quando la CSP è in modalità report-only
  // Quindi la includiamo solo in produzione quando la CSP è in modalità enforcement
  const isReportOnly = config.NODE_ENV !== 'production';
  const cspDirectives = !isReportOnly
    ? { ...baseDirectives, upgradeInsecureRequests: [] }
    : baseDirectives;

  app.use(helmet({
    // Disabilitiamo la CSP di Helmet per gestirla manualmente
    contentSecurityPolicy: false,

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 anno
      includeSubDomains: true,
      preload: true
    },

    // Prevenzione MIME type sniffing
    noSniff: true,

    // Protezione XSS
    xssFilter: true,

    // Prevenzione clickjacking
    frameguard: { action: 'deny' },

    // Rimuovi header X-Powered-By
    hidePoweredBy: true,

    // Referrer Policy
    //DEPRECATED in Helmet v5, gestito manualmente
    //referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // Permissions Policy (ex Feature Policy)
    // Nota: Helmet non supporta ancora direttamente la proprietà 'permissionsPolicy'.
    // Per applicare la Permissions Policy, aggiungiamo manualmente l'header tramite middleware custom.
    // Rimuoviamo la proprietà non supportata da Helmet.
  }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', "geolocation=(self), microphone=(), camera=()");
    res.setHeader('Content-Security-Policy', generateCSPHeader(cspDirectives));
    next();
  });

  log.info('Security headers configured with Helmet', {
    cspMode: isReportOnly ? 'report-only' : 'enforcement',
    upgradeInsecureRequests: !isReportOnly ? 'enabled' : 'disabled (ignored in report-only mode)'
  });
}

const generateCSPHeader = (directives: Record<string, (string | number)[]>): string => {
  return Object.entries(directives)
    .map(([key, values]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Middleware per logging delle richieste sospette
 */
export function suspiciousActivityLogger(req: Request, res: Response, next: NextFunction): void {
  // Escludi le route OIDC/Entra ID: il loro payload (code, state, JWT) contiene pattern che
  // vengono rilevati come sospetti (es. "--" nei token, "localhost" nel redirect_uri in dev).
  const oidcPaths = ['/auth/oidc/callback', '/auth/oidc/fake-callback'];
  if (oidcPaths.some(p => req.path.endsWith(p))) {
    return next();
  }

  // const suspiciousPatterns = [
  // Path traversal
  // /\.\.\//,
  // /\.\.\\/,
  // /%2e%2e%2f/i,
  // /%252e%252e%252f/i,

  // // Sensitive files
  // /\/etc\/passwd/i,
  // /\/etc\/shadow/i,
  // /\/proc\//i,
  // /\/proc\/self\/environ/i,
  // /\/root\//i,
  // /\/home\/.+/i,
  // /\.env/i,
  // /\.git/i,
  // /\.htaccess/i,
  // /\.htpasswd/i,

  // // Command injection
  // /;\s*\w+/,
  // /\|\|/,
  // /&&/,
  // /`.+`/,
  // /\$\(.+\)/,

  // // XSS
  // /<script/i,
  // /<\/script>/i,
  // /javascript:/i,
  // /vbscript:/i,
  // /data:text\/html/i,
  //!BUG: /on\w+=/i,  questa dava falso positivo se era presente context nella query

  // // SQL injection
  // /union\s+select/i,
  // /select\s+.*from/i,
  // /insert\s+into/i,
  // /update\s+.*set/i,
  // /delete\s+from/i,
  // /drop\s+table/i,
  // /or\s+1=1/i,
  // /--/,
  // /#/,
  // /\/\*/,

  // // File inclusion
  // /php:\/\/input/i,
  // /php:\/\/filter/i,
  // /expect:\/\//i,
  // /data:\/\//i,

  // // RCE / exploits
  // /wget\s+/i,
  // /curl\s+/i,
  // /bash\s+-c/i,
  // /sh\s+-c/i,
  // /nc\s+/i,
  // /netcat/i,
  // /python\s+-c/i,
  // /perl\s+-e/i,

  // // Encoding bypass attempts
  // /%00/,
  // /%0a/i,
  // /%0d/i,

  // // SSRF
  // /127\.0\.0\.1/,
  // /localhost/i,
  // /169\.254\.169\.254/,
  // /0\.0\.0\.0/,

  // // Common scanners
  // /acunetix/i,
  // /nikto/i,
  // /sqlmap/i,
  // /nmap/i,
  // /masscan/i
  // ];

  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /\/etc\/passwd/, // File system access
    /\/proc\//, // Process information
    /<script/i, // XSS attempts
    /javascript:/i, // JavaScript injection
    /vbscript:/i, // VBScript injection
    /onload=/i, // Event handler injection
    /onerror=/i, // Event handler injection
    /eval\(/i, // Code evaluation
    /union.*select/i, // SQL injection
    /drop.*table/i, // SQL injection
    /insert.*into/i, // SQL injection
    /update.*set/i, // SQL injection
    /delete.*from/i // SQL injection
  ]
  const userAgent = req.get('User-Agent') || '';
  const url = req.originalUrl || req.url;
  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});

  // Controlla pattern sospetti nell'URL
  const suspiciousUrl = suspiciousPatterns.some((pattern) => {
    const isValid = pattern.test(url)
    if (isValid) {
      return true;
    }
    return isValid;
  });
  // const suspiciousUrl = suspiciousPatterns.some(pattern => pattern.test(url));

  // Controlla pattern sospetti nel body
  const suspiciousBody = suspiciousPatterns.some(pattern => pattern.test(body));

  // Controlla pattern sospetti nei query parameters
  const suspiciousQuery = suspiciousPatterns.some(pattern => pattern.test(query));

  // User agents sospetti
  const suspiciousUserAgents = [
    // SQLi / scanner
    /sqlmap/i,
    /nikto/i,
    /acunetix/i,
    /netsparker/i,
    /w3af/i,

    // Vulnerability scanners
    /nessus/i,
    /openvas/i,
    /qualys/i,
    /rapid7/i,

    // Network scanners
    /nmap/i,
    /masscan/i,
    /zmap/i,

    // Proxy / interception tools
    /burpsuite/i,
    /zap/i,
    /owasp.*zap/i,

    // Crawlers sospetti / fuzzers
    /dirbuster/i,
    /gobuster/i,
    /wfuzz/i,
    /ffuf/i,

    // Exploit frameworks
    /metasploit/i,
    /cobaltstrike/i,

    // Script generici sospetti
    /python-requests/i,
    /curl/i,
    /wget/i,
    /libwww-perl/i,
    /httpclient/i,

    // Headless browsers usati per scraping aggressivo
    /headless/i,
    /phantomjs/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,

    // Bot generici sospetti
    /crawler/i,
    /spider/i,
    /scrapy/i,

    // User agent vuoto o anomalo
    /^$/,
    /^-$/,
  ];

  const suspiciousAgent = suspiciousUserAgents.some(pattern => pattern.test(userAgent));

  if (suspiciousUrl || suspiciousBody || suspiciousQuery || suspiciousAgent) {
    log.warn('Suspicious activity detected', {
      ip: req.ip,
      userAgent,
      method: req.method,
      url,
      suspiciousUrl,
      suspiciousBody,
      suspiciousQuery,
      suspiciousAgent,
      headers: req.headers,
      body: req.body,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    AuditLogService.getInstance().suspiciousActivity(req, 'suspicious_request', {
      suspiciousUrl,
      suspiciousBody,
      suspiciousQuery,
      suspiciousAgent,
      url,
      method: req.method,
      userAgent
    });

    // In produzione, potresti voler bloccare queste richieste
    if ((config.NODE_ENV === 'production' || config.NODE_ENV == "test") && (suspiciousUrl || suspiciousBody || suspiciousQuery)) {
      res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Richiesta non valida'
      });
      return;
    }
  }

  next();
}

/**
 * Middleware per prevenire attacchi di timing
 */
export function timingAttackPrevention(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log richieste che impiegano troppo tempo
    if (duration > 5000) { // 5 secondi
      log.warn('Slow request detected', {
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')
      });
    }
  });

  next();
}

/**
 * Middleware per limitare la dimensione del body delle richieste
 */
export function bodySizeLimit(limit: string = '10mb') {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');

    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const limitInBytes = parseLimit(limit);

      if (sizeInBytes > limitInBytes) {
        log.warn('Request body too large', {
          ip: req.ip,
          contentLength: sizeInBytes,
          limit: limitInBytes,
          url: req.originalUrl
        });

        return res.status(413).json({
          success: false,
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Il corpo della richiesta è troppo grande',
          maxSize: limit
        });
      }
    }

    next();
  };
}

/**
 * Utility per convertire limite stringa in bytes
 */
function parseLimit(limit: string): number {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = limit.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 1024 * 1024; // Default 1MB

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(value * (units[unit as keyof typeof units] || 1));
}

/**
 * Middleware per aggiungere headers di sicurezza personalizzati
 */
export function customSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevenzione information disclosure
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Headers personalizzati per sicurezza
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Request-ID', req.get('X-Request-ID') || 'unknown');

  // Cache control per contenuti sensibili
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  next();
}

/**
 * Middleware per logging delle sessioni sospette
 */
export function sessionSecurityLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.id_utente) {
    const currentIP = req.ip;
    const currentUserAgent = req.get('User-Agent') || '';

    // Controlla se l'IP è cambiato
    if (req.session.lastIP && req.session.lastIP !== currentIP) {
      log.warn('IP address changed during session', {
        userId: req.session.id_utente,
        previousIP: req.session.lastIP,
        currentIP,
        userAgent: currentUserAgent,
        sessionId: req.sessionID
      });
    }

    // Controlla se il User-Agent è cambiato significativamente
    if (req.session.lastUserAgent && req.session.lastUserAgent !== currentUserAgent) {
      log.warn('User-Agent changed during session', {
        userId: req.session.id_utente,
        previousUserAgent: req.session.lastUserAgent,
        currentUserAgent,
        ip: currentIP,
        sessionId: req.sessionID
      });
    }

    // Aggiorna i dati della sessione
    req.session.lastIP = currentIP;
    req.session.lastUserAgent = currentUserAgent;
    req.session.lastActivity = new Date();
  }

  next();
}

/**
 * Middleware per prevenire attacchi di session fixation
 */
export function sessionFixationPrevention(req: Request, res: Response, next: NextFunction): void {
  // Se è una richiesta di login e la sessione esiste già
  if (req.path.includes('/login') && req.method === 'POST' && req.sessionID) {
    const oldSessionId = req.sessionID;

    req.session.regenerate((err) => {
      if (err) {
        log.error('Failed to regenerate session', err);
        return next(err);
      }

      log.info('Session regenerated for security', {
        oldSessionId,
        newSessionId: req.sessionID,
        ip: req.ip
      });

      next();
    });
  } else {
    next();
  }
}

/**
 * Applica tutti i middleware di sicurezza
 */
export function applySecurityMiddlewares(app: Express): void {
  // Headers di sicurezza con Helmet
  configureSecurityHeaders(app);

  // Middleware personalizzati
  app.use(customSecurityHeaders);
  app.use(suspiciousActivityLogger);
  app.use(timingAttackPrevention);
  app.use(bodySizeLimit('200mb')); // Limite più alto per upload file
  app.use(sessionSecurityLogger);

  log.info('All security middlewares applied');
}
