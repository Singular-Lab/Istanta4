import { FtpController } from './ftp.controller';
import { FtpService } from './ftp.service';
import { decryptString } from '@lib/encryption';

jest.mock('@lib/encryption', () => ({
  decryptString: jest.fn((value: string) => value),
}));

describe('FtpController', () => {
  let controller: FtpController;
  let ftpService: { creaPathFromContrattoTipografia: jest.Mock };

  const baseBody = {
    contratto: {
      root: 'ROOT_CONTRATTO',
      root_file_tree: [],
      dictionary: {},
    },
    kit: {
      titolo: 'Kit test',
      files: [],
    },
    host_ftp: 'sftp.test.local',
    user_ftp: 'test-user',
    pwd_ftp: 'test-pwd',
    port_ftp: 22,
  };

  const createRes = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FICO_SECRET = 'secret-key';
    ftpService = {
      creaPathFromContrattoTipografia: jest.fn().mockResolvedValue(undefined),
    };

    controller = new FtpController(ftpService as unknown as FtpService);
  });

  it('returns 400 when one FTP field is missing', async () => {
    const res = createRes();
    const req = {
      body: {
        ...baseBody,
        host_ftp: '',
      },
    };

    await controller.creazioneContratto(res as any, req as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ftpService.creaPathFromContrattoTipografia).not.toHaveBeenCalled();
  });

  it('returns 400 when port_ftp is not numeric', async () => {
    const res = createRes();
    const req = {
      body: {
        ...baseBody,
        port_ftp: 'abc',
      },
    };

    await controller.creazioneContratto(res as any, req as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ftpService.creaPathFromContrattoTipografia).not.toHaveBeenCalled();
  });

  it('calls service with SFTP config when payload is valid', async () => {
    const res = createRes();
    const req = {
      body: {
        ...baseBody,
        socketId: 'socket-1',
      },
    };

    await controller.creazioneContratto(res as any, req as any);

    expect(ftpService.creaPathFromContrattoTipografia).toHaveBeenCalledWith(
      req.body.contratto,
      req.body.kit,
      'socket-1',
      {
        host: 'sftp.test.local',
        username: 'test-user',
        password: 'test-pwd',
        port: 22,
      },
    );
    expect(decryptString).toHaveBeenNthCalledWith(1, 'sftp.test.local', 'secret-key');
    expect(decryptString).toHaveBeenNthCalledWith(2, 'test-user', 'secret-key');
    expect(decryptString).toHaveBeenNthCalledWith(3, 'test-pwd', 'secret-key');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 when FICO_SECRET is missing', async () => {
    delete process.env.FICO_SECRET;
    const res = createRes();
    const req = {
      body: {
        ...baseBody,
      },
    };

    await controller.creazioneContratto(res as any, req as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(ftpService.creaPathFromContrattoTipografia).not.toHaveBeenCalled();
  });
});
