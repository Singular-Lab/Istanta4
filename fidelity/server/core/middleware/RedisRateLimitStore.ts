import type { Options, ClientRateLimitInfo, Store } from 'express-rate-limit';
import type Redis from 'ioredis';

export class RedisRateLimitStore implements Store {
  private windowMs!: number;

  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = 'rl:'
  ) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private k(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const k = this.k(key);
    const pipeline = this.redis.pipeline();
    pipeline.incr(k);
    pipeline.pttl(k);
    const results = await pipeline.exec();

    const hits = (results?.[0]?.[1] as number) ?? 1;
    const pttl = (results?.[1]?.[1] as number) ?? -1;

    // Imposta TTL solo al primo incremento (pttl -1 = chiave senza scadenza)
    if (pttl === -1) {
      await this.redis.pexpire(k, this.windowMs);
    }

    const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
    return { totalHits: hits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.k(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.k(key));
  }
}
