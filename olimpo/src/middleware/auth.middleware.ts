import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {
  }

  async use(req: FastifyRequest, reply: FastifyReply, next: () => void) {
    try {
      const requestUrl = req.url || '';
      if (this.authService.isPublicRoute(requestUrl)) {
        next();
        return;
      }

      const accessContext = await this.authService.resolveAccessContext(req);
      if (!accessContext) {
        if (this.authService.isProtectedPrivatePageRoute(requestUrl)) {
          return reply.redirect('/olimpo/private-login');
        }

        return reply
          .status(HttpStatus.UNAUTHORIZED)
          .send({
            status: HttpStatus.UNAUTHORIZED,
            message: 'Accesso non autorizzato'
          });
      }

      next(); // Prosegui con il prossimo middleware o controller
    } catch (error: any) {
      console.error('Errore in AuthMiddleware:', error);
      return reply
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({
          message: 'Errore in AuthMiddleware: ' + error.message
        });
    }
  }
}
