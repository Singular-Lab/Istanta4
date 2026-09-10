import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as io from '@pm2/io';

const currentReqs = io.counter({
  name: 'Realtime request count',
  id: 'app/realtime/requests'
});

@Injectable()
export class RequestCountMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: Function) {
    currentReqs.inc();
    res.raw.on('finish', () => {
      currentReqs.dec();
    });
    next();
  }
}