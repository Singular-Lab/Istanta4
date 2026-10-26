// creami delle eccezioni personalizzate per questo progetto
import { Colorize } from '@lib/colorize';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    console.log(
      Colorize.bgRed(
        JSON.stringify({
          message: exception.message,
          timestamp: new Date().toISOString(),
          status: status,
        }),
      ),
    );
    response.status(status).send({
      error: exceptionResponse,
      timestamp: new Date().toISOString(),
      status,
    });
  }
}
