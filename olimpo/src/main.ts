import compression from '@fastify/compress';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppClusterService } from './app-cluster.service';
import { OlimpoModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { HttpExceptionFilter } from './exception/exeptions';
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    OlimpoModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB in byte
    }),
    { rawBody: true }
  );

  const configService = app.get(ConfigService);
  const authService = app.get(AuthService);
  const fastifyInstance = app.getHttpAdapter().getInstance();

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('olimpo');

  // React SPA build — all private pages serve the same index.html
  const reactIndexFile = join('private-ui', 'index.html');

  const privateStaticFiles = [
    { route: '/olimpo/private-forbidden', fileName: reactIndexFile, contentType: 'text/html; charset=utf-8', requiresSession: false },
    { route: '/olimpo/private-login', fileName: reactIndexFile, contentType: 'text/html; charset=utf-8', requiresSession: false },
    { route: '/olimpo/private-dashboard', fileName: reactIndexFile, contentType: 'text/html; charset=utf-8', requiresSession: true },
    { route: '/olimpo/private-foto', fileName: reactIndexFile, contentType: 'text/html; charset=utf-8', requiresSession: true },
    { route: '/olimpo/private-materiali', fileName: reactIndexFile, contentType: 'text/html; charset=utf-8', requiresSession: true },
    { route: '/olimpo/private-utenti', fileName: reactIndexFile, contentType: 'text/html; charset=utf-8', requiresSession: true },
  ];

  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const requestPrefersHtml = (req: any) => {
    const acceptHeader = req.headers?.accept;
    if (typeof acceptHeader === 'string') {
      return acceptHeader.includes('text/html');
    }

    if (Array.isArray(acceptHeader)) {
      return acceptHeader.some((value) => String(value).includes('text/html'));
    }

    return false;
  };

  fastifyInstance.addHook('onRequest', async (req, reply) => {
    const requestUrl = (req.url || '').split('?')[0];
    const isPrivateShellRoute = requestUrl === '/olimpo/private'
      || authService.isLoginPageRoute(requestUrl)
      || authService.isProtectedPrivatePageRoute(requestUrl);

    if ((isPrivateShellRoute || authService.isSessionOnlyRoute(requestUrl)) && !authService.isPrivateDashboardIpAllowed(req as any)) {
      if (isPrivateShellRoute || requestPrefersHtml(req)) {
        return reply.redirect('/olimpo/private-forbidden');
      }

      return reply.status(403).send({
        status: 403,
        message: 'Accesso dashboard non consentito da questo IP',
      });
    }

    if (authService.isPublicRoute(requestUrl)) {
      return;
    }

    const accessContext = await authService.resolveAccessContext(req as any);
    if (!accessContext) {
      if (authService.isProtectedPrivatePageRoute(requestUrl)) {
        return reply.redirect('/olimpo/private-login');
      }

      return reply.status(401).send({
        status: 401,
        message: 'Accesso non autorizzato',
      });
    }

    if (authService.isSessionOnlyRoute(requestUrl) && accessContext.mode !== 'session') {
      if (authService.isProtectedPrivatePageRoute(requestUrl)) {
        return reply.redirect('/olimpo/private-login');
      }

      return reply.status(403).send({
        status: 403,
        message: 'Area riservata alla dashboard privata',
      });
    }
  });

  fastifyInstance.addHook('onSend', async (req, reply, payload) => {
    const requestUrl = (req.url || '').split('?')[0];
    const isPrivateResponse = requestUrl.startsWith('/olimpo/private')
      || requestUrl.startsWith('/olimpo/impostazioni/')
      || requestUrl.startsWith('/olimpo/auth/');
    const currentVaryHeader = reply.getHeader('Vary');
    const varyValues = new Set(
      (Array.isArray(currentVaryHeader)
        ? currentVaryHeader
        : currentVaryHeader
          ? [String(currentVaryHeader)]
          : []
      )
        .flatMap((headerValue) => headerValue.split(','))
        .map((headerValue) => headerValue.trim())
        .filter(Boolean),
    );

    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', isPrivateResponse ? 'same-origin' : 'cross-origin');
    reply.header('Origin-Agent-Cluster', '?1');
    varyValues.add('Origin');
    varyValues.add('Cookie');
    reply.header('Vary', Array.from(varyValues).join(', '));
    reply.header('Content-Security-Policy', cspPolicy);

    if ((process.env.NODE_ENV === 'production') || String(req.headers['x-forwarded-proto']).includes('https')) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    return payload;
  });

  fastifyInstance.get('/olimpo/private', async (req, reply) => {
    const accessContext = await authService.resolveAccessContext(req as any);
    reply.redirect(accessContext?.mode === 'session' ? '/olimpo/private-dashboard' : '/olimpo/private-login');
  });

  privateStaticFiles.forEach(({ route, fileName, contentType, requiresSession }) => {
    fastifyInstance.get(route, async (req, reply) => {
      const requestUrl = (req.url || '').split('?')[0];
      const accessContext = await authService.resolveAccessContext(req as any);

      if (requestUrl === '/olimpo/private-login' && accessContext?.mode === 'session') {
        return reply.redirect('/olimpo/private-dashboard');
      }

      if (requiresSession && accessContext?.mode !== 'session') {
        return reply.redirect('/olimpo/private-login');
      }

      const filePath = join(process.cwd(), fileName);
      try {
        const fileContent = readFileSync(filePath);
        if (contentType.includes('text/html') || route.includes('/olimpo/private-')) {
          reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
        reply.type(contentType).send(fileContent);
      } catch (err) {
        reply.status(404).send('Pagina non trovata');
      }
    });
  });

  fastifyInstance.get('/favicon.ico', async (req, reply) => {
    const faviconPath = join(process.cwd(), 'assets', 'favicon.ico');
    try {
      const icon = readFileSync(faviconPath);
      reply.type('image/x-icon').send(icon);
    } catch (err) {
      reply.status(404).send();
    }
  });

  // Serve React build assets at /olimpo/assets/* (public — no auth required)
  try {
    await fastifyInstance.register(fastifyStatic as any, {
      root: join(process.cwd(), 'private-ui', 'assets'),
      prefix: '/olimpo/assets/',
      decorateReply: false,
      cacheControl: true,
      maxAge: 31536000, // 1 year — assets are content-hashed by Vite
      immutable: true,
    });
  } catch {
    // private-ui not built yet — skip static serving (dev mode without UI build)
  }

  // Try this instead (type assertion)
  await app.register(compression as any, { encodings: ['gzip', 'deflate'] });
  // Configura il plugin multipart con limiti personalizzati
  await app.register(fastifyMultipart as any, {
    attachFieldsToBody: true,
    limits: {
      fieldNameSize: 100, // Lunghezza massima del nome del campo
      fieldSize: 1000000, // Dimensione massima del campo
      fields: 10, // Numero massimo di campi
      fileSize: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB in byte
      files: 10, // Numero massimo di file
      headerPairs: 2000, // Numero massimo di coppie di intestazioni
    },
    logLevel: 'warn',


  });

  // Configura il plugin CORS
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        callback(null, isLocalOrigin);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  });

  await app.listen(configService.get<number>('PORT') || 3000, '0.0.0.0');
}

process.env.NODE_ENV === 'production' ? AppClusterService.clusterize(bootstrap) : bootstrap();
