import { ABSOLUTE_PATH_TYPE } from '@enums/enums';
import * as fs from 'fs';
import { FastifyReply } from 'fastify';
import { MaterialiController } from './materiali.controller';
import { convertPdfToSvgUsingPostScript } from './pdf-to-svg.postscript';

jest.mock('sharp', () => {
  const instance = {
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('')),
  };
  return jest.fn(() => instance);
});

jest.mock('./pdf-to-svg.postscript', () => ({
  convertPdfToSvgUsingPostScript: jest.fn(),
}));

describe('MaterialiController.getMaterialeSVGById', () => {
  let controller: MaterialiController;
  let materialiService: { getMaterialeFromId: jest.Mock };
  let olimpoService: { getAbsolutePathFromType: jest.Mock };

  const makeReply = () => {
    const rawEnd = jest.fn();
    const reply = {
      request: { headers: {} },
      raw: {
        end: rawEnd,
        setHeader: jest.fn(),
      },
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      headers: jest.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    return { reply, rawEnd };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    materialiService = {
      getMaterialeFromId: jest.fn(),
    };

    olimpoService = {
      getAbsolutePathFromType: jest.fn().mockImplementation((type: ABSOLUTE_PATH_TYPE) => {
        if (type === ABSOLUTE_PATH_TYPE.MATERIALI) {
          return Promise.resolve({ path: '/tmp/materiali' });
        }
        return Promise.resolve({ path: '/tmp' });
      }),
    };

    controller = new MaterialiController(
      olimpoService as any,
      materialiService as any,
      { server: { emit: jest.fn() } } as any,
    );
  });

  it('returns 404 when materiale does not exist', async () => {
    materialiService.getMaterialeFromId.mockResolvedValue(null);
    const { reply } = makeReply();

    await controller.getMaterialeSVGById('missing-id', '1', reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Material not found', esito: false }),
    );
  });

  it('returns 400 when materiale is not a pdf', async () => {
    materialiService.getMaterialeFromId.mockResolvedValue({
      id: 'm1',
      file_name: 'file.png',
    });
    const { reply } = makeReply();

    await controller.getMaterialeSVGById('m1', '1', reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Material is not a PDF', esito: false }),
    );
  });

  it('converts pdf and returns svg body', async () => {
    materialiService.getMaterialeFromId.mockResolvedValue({
      id: 'm1',
      file_name: 'file.pdf',
      pagine: 1,
    });

    jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue('<svg />');
    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      return String(targetPath) === '/tmp/materiali/file.pdf';
    });

    (convertPdfToSvgUsingPostScript as jest.Mock).mockResolvedValue({
      executable: 'inkscape',
      outputPath: '/tmp/materiali/svg/m1_page1.svg',
      firstPage: 1,
      lastPage: 1,
    });

    const { reply, rawEnd } = makeReply();
    await controller.getMaterialeSVGById('m1', '1', reply);

    expect(convertPdfToSvgUsingPostScript).toHaveBeenCalledWith({
      pdfPath: '/tmp/materiali/file.pdf',
      outputPath: '/tmp/materiali/svg/m1_page1.svg',
      firstPage: 1,
      lastPage: 1,
    });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.headers).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'image/svg+xml; charset=utf-8' }),
    );
    expect(rawEnd).toHaveBeenCalledWith('<svg />');
  });
});
