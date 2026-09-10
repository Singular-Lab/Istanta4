import { Controller, Post, Req, Res } from '@nestjs/common';
import { RootFileTree, RUNTIME_KIT_MONGO } from '@server_types/types';
import { decryptString } from '@lib/encryption';
import { FastifyReply, FastifyRequest } from 'fastify';
import { FtpService, SftpConfig } from './ftp.service';

@Controller('ftp')
export class FtpController {

  constructor(
    private readonly ftpService: FtpService,
  ) {

  }


  @Post('creazioneCartelleContratto')
  async creazioneContratto(
    @Res() res: FastifyReply,
    @Req() req: FastifyRequest<{
      Body: {
        contratto: RootFileTree | string,
        kit: RUNTIME_KIT_MONGO | string,
        socketId?: string,  // Add socketId parameter
        host_ftp?: string,
        user_ftp?: string,
        pwd_ftp?: string,
        port_ftp?: number | string
      }
    }>
  ) {
    try {
      let contrattoObj: RootFileTree;
      let kit: RUNTIME_KIT_MONGO;
      const socketId = req.body.socketId;
      const encryptedHostFtp = req.body.host_ftp?.trim();
      const encryptedUserFtp = req.body.user_ftp?.trim();
      const encryptedPwdFtp = req.body.pwd_ftp?.trim();
      const portFtp = Number(req.body.port_ftp);
      const ficoSecret = process.env.FICO_SECRET;

      if (!encryptedHostFtp || !encryptedUserFtp || !encryptedPwdFtp || !Number.isInteger(portFtp) || portFtp <= 0 || portFtp > 65535) {
        return res.status(400).send({
          esito: false,
          error: 'Parametri FTP/SFTP non validi',
          message: 'host_ftp, user_ftp, pwd_ftp e port_ftp sono obbligatori e validi'
        });
      }

      if (!ficoSecret) {
        return res.status(500).send({
          esito: false,
          error: 'Configurazione server non valida',
          message: 'FICO_SECRET non configurato'
        });
      }

      let hostFtp: string;
      let userFtp: string;
      let pwdFtp: string;
      try {
        hostFtp = decryptString(encryptedHostFtp, ficoSecret).trim();
        userFtp = decryptString(encryptedUserFtp, ficoSecret).trim();
        pwdFtp = decryptString(encryptedPwdFtp, ficoSecret).trim();
      } catch (error) {
        return res.status(400).send({
          esito: false,
          error: 'Parametri FTP/SFTP non validi',
          message: 'host_ftp, user_ftp e pwd_ftp devono essere cifrati in modo valido'
        });
      }

      if (!hostFtp || !userFtp || !pwdFtp) {
        return res.status(400).send({
          esito: false,
          error: 'Parametri FTP/SFTP non validi',
          message: 'host_ftp, user_ftp e pwd_ftp decriptati non possono essere vuoti'
        });
      }

      if (typeof req.body.contratto === 'string') {
        const contratto = req.body.contratto;
        contrattoObj = JSON.parse(contratto) as RootFileTree;
      } else if (typeof req.body.contratto === 'object') {
        contrattoObj = req.body.contratto;
      } else {
        return res.status(400).send({ message: 'Contratto non valido' });
      }

      if (typeof req.body.kit === 'string') {
        const files = req.body.kit;
        kit = JSON.parse(files) as RUNTIME_KIT_MONGO;
      } else if (typeof req.body.kit === 'object') {
        kit = req.body.kit;
      } else {
        return res.status(400).send({ message: 'Kit non valido' });
      }

      console.time('creaPathFromContrattoTipografia');
      const sftpConfig: SftpConfig = {
        host: hostFtp,
        username: userFtp,
        password: pwdFtp,
        port: portFtp,
      };

      // Pass socketId to the FTP service
      await this.ftpService.creaPathFromContrattoTipografia(contrattoObj, kit, socketId, sftpConfig);

      console.timeEnd('creaPathFromContrattoTipografia');
      return res.status(200).send({ esito: true, error: '', message: 'Cartelle create con successo' });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ esito: false, error: error, message: 'Errore nella creazione delle cartelle' });
    }
  }

  @Post("getVirtualDirectories")
  async getVirtualDirectories(
    @Res() res: FastifyReply,
    @Req() req: FastifyRequest<{
      Body: {
        kits: RUNTIME_KIT_MONGO[] | string,
      }
    }>
  ) {
    try {
      let kits: RUNTIME_KIT_MONGO[];

      if (typeof req.body.kits === 'string') {
        kits = JSON.parse(req.body.kits) as RUNTIME_KIT_MONGO[];
      } else if (Array.isArray(req.body.kits)) {
        kits = req.body.kits;
      } else {
        return res.status(400).send({ esito: false, error: 'Kits non validi' });
      }

      const virtualDirectories = await this.ftpService.getVirtualDirectories(kits);
      return res.status(200).send({ esito: true, directories: virtualDirectories });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ esito: false, error: error.message });
    }
  }

}
