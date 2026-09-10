import crypto from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import config from '../config';

const isProd = config.NODE_ENV === 'production';
const SERVICE_NAME = 'fidelity-service';
const DEFAULT_CONTEXT = 'Application';
const MAX_STACK_LENGTH = 1200;

type LogContext = Record<string, unknown> & { context?: string };
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function toSingleLine(value: string): string {
  return value.replace(/\r?\n+/g, ' | ').replace(/\s+/g, ' ').trim();
}

function normalizeMessage(msg: string): string {
  return toSingleLine(msg);
}

function normalizeSql(query?: string): string | undefined {
  if (!query) return undefined;
  return toSingleLine(query).slice(0, 200);
}

function compactObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
}

function sanitizeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const maybeError = err as Error & Record<string, unknown>;

    return compactObject({
      errorName: err.name,
      errorMessage: toSingleLine(err.message),
      errorStack: err.stack ? toSingleLine(err.stack).slice(0, MAX_STACK_LENGTH) : undefined,
      errorCode: sanitizeValue(maybeError.code),
      errorStatus: sanitizeValue(maybeError.status),
      errorCause: sanitizeValue(maybeError.cause),
    });
  }

  if (typeof err === 'string') {
    return { errorMessage: toSingleLine(err) };
  }

  return { error: sanitizeValue(err) };
}

function sanitizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === undefined || value === null) return value;
  if (depth > 4) return '[Truncated]';

  if (typeof value === 'string') return toSingleLine(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return sanitizeError(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const record = value as Record<string, unknown>;
    const sanitizedEntries = Object.entries(record).map(([key, currentValue]) => [
      key,
      sanitizeValue(currentValue, depth + 1, seen),
    ]);

    return compactObject(Object.fromEntries(sanitizedEntries) as Record<string, unknown>);
  }

  return String(value);
}

function normalizeContext(ctx?: LogContext, fallbackContext = DEFAULT_CONTEXT): LogContext {
  const source = ctx ?? {};
  const { context, ...rest } = source;
  const resolvedContext = typeof context === 'string' && context.trim()
    ? toSingleLine(context)
    : fallbackContext;

  const sanitizedEntries = Object.entries(rest).map(([key, value]) => [key, sanitizeValue(value)]);

  return compactObject({
    context: resolvedContext,
    ...(Object.fromEntries(sanitizedEntries) as Record<string, unknown>),
  });
}

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: !isProd,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
    levelFirst: true,
    singleLine: true,
    ignore: 'hostname',
    messageFormat: '[{service}] {if context}[{context}] {end}{msg}',
  }
});

const logger = pino(
  {
    level: isProd ? 'info' : 'debug',
    base: {
      service: SERVICE_NAME
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

let isConsoleBridgeInstalled = false;
let isConsoleBridgeActive = false;

function parseConsoleArgs(args: unknown[]): { message: string; details?: unknown } {
  const normalizedArgs = args.map((arg) => sanitizeValue(arg));

  if (normalizedArgs.length === 0) {
    return { message: 'Console output' };
  }

  const [first, ...rest] = normalizedArgs;
  if (typeof first === 'string') {
    if (rest.length === 0) {
      return { message: normalizeMessage(first) };
    }

    if (rest.length === 1) {
      return { message: normalizeMessage(first), details: rest[0] };
    }

    return { message: normalizeMessage(first), details: rest };
  }

  return {
    message: 'Console output',
    details: normalizedArgs,
  };
}

function installConsoleBridge(): void {
  if (isConsoleBridgeInstalled) return;
  isConsoleBridgeInstalled = true;

  const bridgeMap: Array<{ method: 'log' | 'info' | 'warn' | 'error' | 'debug'; level: LogLevel }> = [
    { method: 'log', level: 'info' },
    { method: 'info', level: 'info' },
    { method: 'warn', level: 'warn' },
    { method: 'error', level: 'error' },
    { method: 'debug', level: 'debug' },
  ];

  for (const { method, level } of bridgeMap) {
    const original = console[method].bind(console);

    Object.defineProperty(console, method, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: (...args: unknown[]) => {
        if (isConsoleBridgeActive) {
          original(...args);
          return;
        }

        if (args.length === 0) return;

        isConsoleBridgeActive = true;
        try {
          const { message, details } = parseConsoleArgs(args);
          const payload = details === undefined
            ? normalizeContext({ context: 'Console' }, 'Console')
            : normalizeContext({ context: 'Console', details }, 'Console');

          logger[level](payload, message);
        } catch {
          original(...args);
        } finally {
          isConsoleBridgeActive = false;
        }
      },
    });
  }
}

installConsoleBridge();

export default logger;

const HTTP_LOG_EXCLUSIONS = [
  /\/assets\//,
  /\/static\//,
  /\.(ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i,
  /\/health$/,
  /\/ping$/,
  /\/favicon\.ico$/,
  /\/__vite_ping$/,
  /\/socket\.io\//,
];

const shouldLogHttp = (url?: string) =>
  url ? !HTTP_LOG_EXCLUSIONS.some((regex) => regex.test(url)) : true;

export const httpLogger = pinoHttp({
  logger,
  autoLogging: false,

  genReqId(req) {
    return (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  },

  customProps(req) {
    const session = (req as any).session;
    return {
      context: 'HTTP',
      userId: session?.id_utente,
      tenantId: session?.id_gdo,
    };
  },

  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  serializers: {
    req(req) {
      if (!shouldLogHttp(req.url)) return undefined;
      return {
        method: req.method,
        url: req.url,
        ip: req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },

  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },

  customErrorMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },

  customSuccessObject(_req, _res, loggableObject) {
    const raw = loggableObject as Record<string, unknown>;
    return normalizeContext({
      ...(raw as Record<string, unknown>),
      context: 'HTTP',
      responseTimeMs: raw.responseTime,
    }, 'HTTP');
  },

  customErrorObject(_req, _res, err, loggableObject) {
    const raw = loggableObject as Record<string, unknown>;
    const { err: _ignoredErr, ...rest } = raw;

    return normalizeContext({
      ...rest,
      ...sanitizeError(err),
      context: 'HTTP',
      responseTimeMs: raw.responseTime,
    }, 'HTTP');
  },
});

function write(level: LogLevel, msg: string, ctx?: LogContext, fallbackContext = DEFAULT_CONTEXT): void {
  logger[level](normalizeContext(ctx, fallbackContext), normalizeMessage(msg));
}

function writeError(msg: string, err: unknown, ctx?: LogContext, fallbackContext = DEFAULT_CONTEXT): void {
  const payload = {
    ...normalizeContext(ctx, fallbackContext),
    ...sanitizeError(err),
  };
  logger.error(payload, normalizeMessage(msg));
}

export const log = {
  info(msg: string, ctx?: LogContext) {
    write('info', msg, ctx);
  },

  warn(msg: string, ctx?: LogContext) {
    write('warn', msg, ctx);
  },

  debug(msg: string, ctx?: LogContext) {
    write('debug', msg, ctx);
  },

  error(msg: string, err?: unknown, ctx?: LogContext) {
    if (err === undefined) {
      write('error', msg, ctx);
      return;
    }

    writeError(msg, err, ctx);
  },

  db: {
    query(query: string, params?: unknown[], duration?: number) {
      if (isProd) {
        if (duration && duration > 1000) {
          write('warn', 'Slow database query', {
            context: 'Database',
            query: normalizeSql(query),
            duration,
            slow: true,
          }, 'Database');
        }
        return;
      }

      write('debug', 'Database query', {
        context: 'Database',
        query: normalizeSql(query),
        paramsCount: params?.length,
        duration,
      }, 'Database');
    },

    error(operation: string, err: Error, query?: string) {
      writeError('Database error', err, {
        context: 'Database',
        operation,
        query: normalizeSql(query),
      }, 'Database');
    },

    success(operation: string, affectedRows?: number, duration?: number) {
      if (!isProd || (affectedRows && affectedRows > 100)) {
        write('info', 'Database success', {
          context: 'Database',
          operation,
          affectedRows,
          duration,
        }, 'Database');
      }
    }
  },

  auth: {
    login(userId: string, ip: string) {
      write('info', 'User login', { context: 'Auth', userId, ip, action: 'login' }, 'Auth');
    },

    logout(userId: string, ip: string) {
      write('info', 'User logout', { context: 'Auth', userId, ip, action: 'logout' }, 'Auth');
    },

    loginFailed(email: string, ip: string, reason: string) {
      write('warn', 'Login failed', { context: 'Auth', email, ip, reason }, 'Auth');
    },

    logoutFailed(email: string, ip: string, reason: string) {
      write('warn', 'Logout failed', { context: 'Auth', email, ip, reason }, 'Auth');
    },

    unauthorized(userId: string, resource: string, ip: string) {
      write('warn', 'Unauthorized access', { context: 'Auth', userId, resource, ip }, 'Auth');
    }
  },

  business: {
    transaction(type: string, userId: string, amount?: number, details?: unknown) {
      write('info', 'Business transaction', {
        context: 'Business',
        type,
        userId,
        amount,
        details,
      }, 'Business');
    },

    error(operation: string, userId: string, err: Error, ctx?: unknown) {
      writeError('Business error', err, {
        context: 'Business',
        operation,
        userId,
        details: ctx,
      }, 'Business');
    }
  },

  perf: {
    measure(operation: string, duration: number, ctx?: Record<string, unknown>) {
      const level: LogLevel =
        duration > 1000 ? 'warn' :
          duration > 500 ? 'info' : 'debug';

      write(level, 'Performance metric', {
        context: 'Performance',
        operation,
        duration,
        slow: duration > 1000,
        ...ctx,
      }, 'Performance');
    },

    start(operation: string) {
      const start = Date.now();
      return () => {
        const duration = Date.now() - start;
        this.measure(operation, duration);
      };
    }
  }
};

export async function tryCatch<T>(
  fn: () => Promise<T>,
  ctx: {
    operation: string;
    userId?: string;
    errorMessage?: string;
    logContext?: Record<string, unknown>;
  }
): Promise<T> {
  const start = Date.now();

  try {
    if (!isProd) {
      write('debug', `Starting ${ctx.operation}`, {
        context: 'TryCatch',
        userId: ctx.userId,
        ...ctx.logContext
      }, 'TryCatch');
    }

    const result = await fn();
    const duration = Date.now() - start;

    if (!isProd || duration > 2000) {
      write(duration > 2000 ? 'warn' : 'debug', 'Completed operation', {
        context: 'TryCatch',
        operation: ctx.operation,
        userId: ctx.userId,
        duration,
        slow: duration > 2000
      }, 'TryCatch');
    }

    return result;
  } catch (err) {
    const duration = Date.now() - start;

    writeError(
      ctx.errorMessage ?? `Failed ${ctx.operation}`,
      err,
      {
        context: 'TryCatch',
        operation: ctx.operation,
        userId: ctx.userId,
        duration,
        ...ctx.logContext
      },
      'TryCatch'
    );

    throw err;
  }
}

log.info('Logger initialized', {
  context: 'Bootstrap',
  environment: config.NODE_ENV,
  pretty: !isProd,
});
