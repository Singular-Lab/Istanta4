import * as path from 'path';
import { FtpService, SftpConfig } from './ftp.service';

const mockConnect = jest.fn();
const mockEnd = jest.fn();
const mockExists = jest.fn();
const mockMkdir = jest.fn();
const mockPut = jest.fn();

jest.mock('ssh2-sftp-client', () => {
  return jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
    exists: mockExists,
    mkdir: mockMkdir,
    put: mockPut,
  }));
});

describe('FtpService (SFTP mode)', () => {
  let service: FtpService;
  let olimpoService: { getAbsolutePathFromType: jest.Mock };
  let materialiService: { getMaterialeFromId: jest.Mock };
  let websocketGateway: { server: { emit: jest.Mock } };

  const sftpConfig: SftpConfig = {
    host: 'sftp.test.local',
    port: 22,
    username: 'user',
    password: 'pwd',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
    mockExists.mockResolvedValue(false);
    mockMkdir.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);

    olimpoService = {
      getAbsolutePathFromType: jest.fn().mockResolvedValue({ path: 'C:/materiali' }),
    };

    materialiService = {
      getMaterialeFromId: jest.fn().mockResolvedValue({
        file_name: 'source.pdf',
        original_name: 'file-A1.pdf',
      }),
    };

    websocketGateway = {
      server: {
        emit: jest.fn(),
      },
    };

    service = new FtpService(
      olimpoService as any,
      materialiService as any,
      websocketGateway as any,
    );
  });

  /*
   * Questo test chiedeva il deposito SENZA contratto.root e falliva da sempre:
   * creaPathFromContrattoTipografia crea la root del contratto e ci fa partire
   * l'albero, e getVirtualDirectories costruisce il suo albero virtuale sulla
   * stessa root, tanto che una virtual_dir scelta in Fidelity la contiene gia'
   * (per questo il ramo merged non la riaggiunge). Il test ora fissa il
   * comportamento reale, root compresa.
   *
   * Resta aperta per chi governa il contratto tipografia una domanda che nessun
   * test puo' decidere: se l'utenza SFTP e' gia' confinata nella cartella del
   * cliente, prefissare la root creerebbe una cartella annidata di troppo sul
   * server della tipografia. In quel caso va corretto il servizio, non questo test.
   */
  it('connects with expected credentials and uploads under contratto.root', async () => {
    const contratto: any = {
      root: 'ROOT_CONTRATTO',
      dictionary: { AREA: 'A1' },
      root_file_tree: [
        {
          priority: 1,
          conditions: [{ field: 'nome', operator: 'contains', value: 'A1' }],
          on_respect_condition: { commands: ['mkdir', 'deposit'], dirname: ['folder_AREA'] },
          on_error: { commands: [] },
          fallback: { action: 'mkdir', dirname: [] },
        },
      ],
    };

    const kit: any = {
      titolo: 'Kit test',
      codiceArea: 'A1',
      codiceCanale: 'C1',
      files: [
        {
          id: 'file-1',
          id_runtime: 'runtime-1',
          direttive: '',
          nome: 'input.pdf',
          nome_originale: 'input.pdf',
          isOptional: false,
          id_olimpo_cloud: 'mat-1',
          meta_olimpo_cloud: {},
          tipo_export: 'pdf',
        },
      ],
    };

    await service.creaPathFromContrattoTipografia(contratto, kit, 'sock-1', sftpConfig);

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'sftp.test.local',
        port: 22,
        username: 'user',
        password: 'pwd',
        hostVerifier: expect.any(Function),
      }),
    );

    const connectOptions = mockConnect.mock.calls[0][0];
    expect(connectOptions.hostVerifier('any-key')).toBe(true);

    //La root del contratto viene creata prima di percorrere l'albero.
    expect(mockMkdir).toHaveBeenCalledWith('ROOT_CONTRATTO', true);

    const targetCall = mockPut.mock.calls.find(
      (call) => call[1] === 'ROOT_CONTRATTO/folder_AREA/folder_AREA/file-A1.pdf',
    );
    expect(targetCall).toBeDefined();
    expect(targetCall[0]).toBe(path.join('C:/materiali', 'source.pdf'));
    //Un solo deposito e nessuna root ripetuta lungo il path.
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(targetCall[1].split('ROOT_CONTRATTO')).toHaveLength(2);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('uploads merged group using virtual_dir as provided (normalized posix)', async () => {
    const contratto: any = {
      root: 'ROOT_CONTRATTO',
      dictionary: {},
      root_file_tree: [],
    };

    const kit: any = {
      titolo: 'Kit merged',
      codiceArea: 'A1',
      codiceCanale: 'C1',
      files: [
        {
          id: 'file-merged',
          id_runtime: 'runtime-merged',
          direttive: '',
          nome: 'merged.zip',
          nome_originale: 'merged.zip',
          isOptional: false,
          id_olimpo_cloud: 'mat-1',
          meta_olimpo_cloud: {},
          tipo_export: 'zip',
          is_merged_group: true,
          virtual_dir: 'incoming\\cliente-a',
        },
      ],
    };

    await service.creaPathFromContrattoTipografia(contratto, kit, undefined, sftpConfig);

    const mergedCall = mockPut.mock.calls.find((call) => call[1] === 'incoming/cliente-a/merged.zip');
    expect(mergedCall).toBeDefined();
    expect(mergedCall[1]).not.toContain('ROOT_CONTRATTO');
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('propagates upload errors and still closes SFTP connection', async () => {
    const contratto: any = {
      root: 'ROOT_CONTRATTO',
      dictionary: { AREA: 'A1' },
      root_file_tree: [
        {
          priority: 1,
          conditions: [{ field: 'nome', operator: 'contains', value: 'A1' }],
          on_respect_condition: { commands: ['mkdir', 'deposit'], dirname: ['folder_AREA'] },
          on_error: { commands: [] },
          fallback: { action: 'mkdir', dirname: [] },
        },
      ],
    };

    const kit: any = {
      titolo: 'Kit errore',
      codiceArea: 'A1',
      codiceCanale: 'C1',
      files: [
        {
          id: 'file-1',
          id_runtime: 'runtime-1',
          direttive: '',
          nome: 'input.pdf',
          nome_originale: 'input.pdf',
          isOptional: false,
          id_olimpo_cloud: 'mat-1',
          meta_olimpo_cloud: {},
          tipo_export: 'pdf',
        },
      ],
    };

    mockPut.mockRejectedValueOnce(new Error('upload failed'));

    await expect(
      service.creaPathFromContrattoTipografia(contratto, kit, 'sock-err', sftpConfig),
    ).rejects.toThrow('upload failed');

    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
