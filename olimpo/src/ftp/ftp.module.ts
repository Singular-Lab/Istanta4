// filepath: /home/singular-nick/olimpo/src/ftp/ftp.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { FtpController } from './ftp.controller';
import { FtpService } from './ftp.service';
import { OlimpoModule } from 'src/app.module'; // Importa OlimpoModule
import { MaterialiService } from 'src/materiali/materiali.service';
import { WebsocketGateway } from 'src/websocket/websocket.getaway';

@Module({
  imports: [forwardRef(() => OlimpoModule)], // Utilizza forwardRef per evitare la dipendenza circolare
  controllers: [FtpController],
  providers: [FtpService, MaterialiService, WebsocketGateway],
  exports: [FtpService],
})
export class FtpModule {}