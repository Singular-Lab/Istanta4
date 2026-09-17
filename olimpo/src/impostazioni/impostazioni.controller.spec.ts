import { HttpException } from '@nestjs/common';
import { ImpostazioniController } from './impostazioni.controller';
import { ImpostazioniService } from './impostazioni.service';

/*
 * Lo spec generato da Nest costruiva un TestingModule con il solo controller e
 * senza ImpostazioniService, che il controller si e' preso come dipendenza: la
 * risoluzione falliva sempre. Qui il controller viene istanziato direttamente
 * con un doppio del servizio, come gia' fa ftp.controller.spec.ts.
 */
describe('ImpostazioniController', () => {
  let controller: ImpostazioniController;
  let impostazioniService: {
    getAllFoto: jest.Mock;
    getFotoPage: jest.Mock;
    updateFoto: jest.Mock;
    getAllMateriali: jest.Mock;
    getDashboardOverview: jest.Mock;
  };

  const createRes = () => ({
    header: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    impostazioniService = {
      getAllFoto: jest.fn().mockResolvedValue([{ id: 1 }]),
      getFotoPage: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
      updateFoto: jest.fn().mockResolvedValue({ id: 1 }),
      getAllMateriali: jest.fn().mockResolvedValue([]),
      getDashboardOverview: jest.fn().mockResolvedValue({ foto: 0 }),
    };

    controller = new ImpostazioniController(
      impostazioniService as unknown as ImpostazioniService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getAllFoto risponde con le foto del servizio e senza cache', async () => {
    const res = createRes();

    await controller.getAllFoto(res as any);

    expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.send).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it('getFotoPage inoltra al servizio offset, limit e ricerca', async () => {
    const res = createRes();

    await controller.getFotoPage('20', '10', 'mela', res as any);

    expect(impostazioniService.getFotoPage).toHaveBeenCalledWith({
      offset: '20',
      limit: '10',
      search: 'mela',
    });
    expect(res.send).toHaveBeenCalledWith({ rows: [], count: 0 });
  });

  it('updateFoto passa al servizio id e attributi della foto', async () => {
    const fotoAttributes: any = { id: 7, nome: 'foto.psd' };

    const esito = await controller.updateFoto(fotoAttributes);

    expect(impostazioniService.updateFoto).toHaveBeenCalledWith(7, fotoAttributes);
    expect(esito).toEqual({ id: 1 });
  });

  it('un errore del servizio diventa HttpException e non esce grezzo', async () => {
    impostazioniService.getAllFoto.mockRejectedValueOnce(new Error('db giu'));
    const res = createRes();

    await expect(controller.getAllFoto(res as any)).rejects.toBeInstanceOf(HttpException);
    expect(res.send).not.toHaveBeenCalled();
  });
});
