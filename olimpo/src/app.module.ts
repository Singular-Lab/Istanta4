import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { OlimpoController } from './app.controller';
import { OlimpoService } from './app.service';
import { AbsolutePaths } from './models/absolute_path.model';
import { Foto } from './models/foto.model';
// import { Formati } from './models/formati.model';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { FtpModule } from './ftp/ftp.module';
import { ImpostazioniController } from './impostazioni/impostazioni.controller';
import { ImpostazioniService } from './impostazioni/impostazioni.service';
import { MaterialiController } from './materiali/materiali.controller';
import { MaterialiService } from './materiali/materiali.service';
import { Auth } from './models/auth.model';
import { Materiali } from './models/materiali.model';
import { PrivateSession } from './models/private_session.model';
import { Video } from './models/video.model';
import { WebsocketGateway } from './websocket/websocket.getaway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadModels: true,
      synchronize: true,
      logging: false,
      models: ['./models/*.model.ts'],
    }),
    SequelizeModule.forFeature([Foto, AbsolutePaths, Auth, Materiali, Video, PrivateSession]),
    AuthModule,
    forwardRef(() => FtpModule), // Utilizza forwardRef per evitare la dipendenza circolare
  ],
  controllers: [OlimpoController, MaterialiController, ImpostazioniController],
  providers: [MaterialiService, OlimpoService, ImpostazioniService, WebsocketGateway, {
    provide: 'WS_SERVER',
    useFactory: (gateway: WebsocketGateway) => gateway.server,
    inject: [WebsocketGateway],
  }],
  exports: [SequelizeModule, OlimpoService, 'WS_SERVER'], // Esporta WS_SERVER
})
export class OlimpoModule { }
