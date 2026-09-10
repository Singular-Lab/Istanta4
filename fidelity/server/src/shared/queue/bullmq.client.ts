import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from '../cache/redis.client.js';
import { log } from '../../../core/logger/index.js';

export function createQueue(name: string): Queue | null {
  const connection = getRedisConnectionOptions();
  if (!connection) {
    return null;
  }

  const queue = new Queue(name, { connection });
  let queueErrorLogged = false;

  queue.on('error', (error) => {
    if (queueErrorLogged) return;
    queueErrorLogged = true;

    log.warn('BullMQ queue non disponibile, fallback locale attivo', {
      context: 'Redis',
      queue: name,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return queue;
}
