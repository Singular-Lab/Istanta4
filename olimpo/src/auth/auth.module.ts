import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Auth } from '../models/auth.model';
import { PrivateSession } from '../models/private_session.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Auth, PrivateSession]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule{}
