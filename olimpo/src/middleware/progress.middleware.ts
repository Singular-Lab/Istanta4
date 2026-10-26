import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ServerUtils } from 'lib/ServerUtils';

@Injectable()
export class ProgressMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: Function) {
    const contentLength = parseInt(req.headers['content-length'], 10);
    let receivedLength = 0;

    if (req.raw && typeof req.raw.on === 'function') {
      req.raw.on('data', (chunk) => {
        receivedLength += chunk.length;
        const progress = (receivedLength / contentLength) * 100;
        ServerUtils.sendSSE('progress', { progress: progress.toFixed(2) }, res);
      });

      req.raw.on('end', () => {
        ServerUtils.sendSSE('progress', { progress: '100.00' }, res);
      });
    } else {
      console.error('req.raw non è definito o non supporta il metodo on');
    }

    next();
  }
}
