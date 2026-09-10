import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';
import { getRedisClient, getRedisStatus } from '../cache/redis.client.js';

const register = client.register;

client.collectDefaultMetrics({
  register,
});

const METRICS_PATH = '/metrics';

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (4xx/5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const redisHealthStatus = new client.Gauge({
  name: 'redis_health_status',
  help: '1 if Redis is reachable, 0 otherwise',
  registers: [register],
});

export const postgresHealthStatus = new client.Gauge({
  name: 'postgres_health_status',
  help: '1 if PostgreSQL is reachable, 0 otherwise',
  registers: [register],
});

let postgresHealthy = 0;
let redisHealthy = 0;

async function checkPostgresForMetrics(): Promise<void> {
  try {
    const { sequelize } = await import('../../../core/db/SequelizeConnector.js');

    await sequelize.authenticate();

    postgresHealthy = 1;
  } catch {
    postgresHealthy = 0;
  }

  postgresHealthStatus.set(postgresHealthy);
}

async function checkRedisForMetrics(): Promise<void> {
  const status = getRedisStatus();

  if (status === 'disabled') {
    redisHealthy = 1;
    redisHealthStatus.set(redisHealthy);
    return;
  }

  if (status === 'unavailable') {
    redisHealthy = 0;
    redisHealthStatus.set(redisHealthy);
    return;
  }

  const redis = getRedisClient();

  if (!redis) {
    redisHealthy = 0;
    redisHealthStatus.set(redisHealthy);
    return;
  }

  try {
    await redis.ping();

    redisHealthy = 1;
  } catch {
    redisHealthy = 0;
  }

  redisHealthStatus.set(redisHealthy);
}

/*
 * Riduce drasticamente il costo:
 * - evita authenticate() e ping() ad ogni scrape
 * - aggiorna stato health in background
 */
const metricsGlobalState = globalThis as typeof globalThis & {
  __metricsHealthChecksInterval__?: ReturnType<typeof setInterval>;
};

if (metricsGlobalState.__metricsHealthChecksInterval__) {
  clearInterval(metricsGlobalState.__metricsHealthChecksInterval__);
}

const healthChecksInterval = setInterval(() => {
  void checkPostgresForMetrics();
  void checkRedisForMetrics();
}, 10_000);

healthChecksInterval.unref();
metricsGlobalState.__metricsHealthChecksInterval__ = healthChecksInterval;

/*
 * Primo bootstrap immediato
 */
void checkPostgresForMetrics();
void checkRedisForMetrics();

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  
  const start = process.hrtime.bigint();

  /*
   * Evita lookup dinamici costosi dopo finish
   */
  const method = req.method;
  const route = req.route?.path || req.path;

  res.once('finish', () => {
    const durationSeconds =
      Number(process.hrtime.bigint() - start) / 1_000_000_000;

    const statusCode = res.statusCode.toString();

    const labels = {
      method,
      route,
      status_code: statusCode,
    };

    httpRequestsTotal.inc(labels);

    httpRequestDurationSeconds.observe(labels, durationSeconds);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
}

export async function metricsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.setHeader('Content-Type', register.contentType);

  /*
   * metrics() già cached internamente da prom-client
   * nessun check runtime qui
   */
  res.end(await register.metrics());
}
