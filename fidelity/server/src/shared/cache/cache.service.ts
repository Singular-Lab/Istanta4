import { getRedisClient } from './redis.client.js';

export async function get<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }
  } catch {
    return;
  }
}

export async function del(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch {
    return;
  }
}

export async function remember<T>(
  key: string,
  ttlSeconds: number,
  resolver: () => Promise<T>,
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) return cached;

  const value = await resolver();

  // Fire-and-forget save; if Redis is unavailable the resolver result is still returned
  set(key, value, ttlSeconds).catch(() => undefined);

  return value;
}
