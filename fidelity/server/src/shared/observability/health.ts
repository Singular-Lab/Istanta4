import type { Request, Response } from 'express';
import { getRedisClient, getRedisStatus } from '../cache/redis.client.js';

// PostgreSQL check: we import sequelize lazily to avoid circular dependency issues.
// If the import fails at runtime the check is marked 'unknown'.
async function checkPostgres(): Promise<'ok' | 'error' | 'unknown'> {
  try {
    const { sequelize } = await import('../../../core/db/SequelizeConnector.js');
    await sequelize.authenticate();
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkRedis(): Promise<'ok' | 'disabled' | 'unavailable'> {
  const status = getRedisStatus();
  if (status === 'disabled' || status === 'unavailable') return status;

  const redis = getRedisClient();
  if (!redis) return 'unavailable';

  try {
    await redis.ping();
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);

  const allOk = postgres === 'ok';
  const status = allOk ? 'ok' : 'degraded';

  res.status(allOk ? 200 : 503).json({
    status,
    services: {
      http: 'ok',
      postgres,
      redis,
    },
  });
}
