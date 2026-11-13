import { OlimpoService } from './app.service';

/*
 * Le cartelle di absolute_paths lette prima che il processo accetti richieste
 * (spec olimpo/processi-in-produzione). Prima si leggevano nel costruttore senza await e con una
 * DDL (sync) a ogni chiamata: un processo poteva rispondere con le cartelle undefined.
 */

const riga = (tipo: string, active = true) => ({ id: `id-${tipo}`, tipo, path: `/dati/${tipo.toLowerCase()}`, active });

const servizioCon = (righe: Array<ReturnType<typeof riga>>) => {
  const absolutePathsModel = {
    findAll: jest.fn(async ({ where }: { where: { active: boolean } }) => righe.filter((r) => r.active === where.active)),
    findOne: jest.fn(async ({ where }: { where: { tipo?: string; id?: string } }) =>
      righe.find((r) => r.active && (r.tipo === where.tipo || r.id === where.id)) ?? null
    ),
    sync: jest.fn(),
  };
  const servizio = new OlimpoService({} as any, {} as any, absolutePathsModel as any);
  return { servizio, absolutePathsModel };
};

describe('OlimpoService: cartelle di absolute_paths', () => {
  const TUTTE = ['WEB', 'ARCHIVIO', 'VIDEO', 'MATERIALI'].map((tipo) => riga(tipo));

  it('le legge una volta all\'avvio e poi le restituisce senza toccare il database', async () => {
    const { servizio, absolutePathsModel } = servizioCon(TUTTE);

    await servizio.onModuleInit();
    const web = await servizio.getAbsolutePathFromType('WEB');
    const materiali = await servizio.getAbsolutePathFromType('MATERIALI');
    const archivio = await servizio.getAbsoluteFilePathFromId('id-ARCHIVIO');

    expect(web.path).toBe('/dati/web');
    expect(materiali.path).toBe('/dati/materiali');
    expect(archivio).toBe('/dati/archivio');
    expect(absolutePathsModel.findAll).toHaveBeenCalledTimes(1);
    expect(absolutePathsModel.findOne).not.toHaveBeenCalled();
    expect(absolutePathsModel.sync).not.toHaveBeenCalled();
  });

  it('se manca una cartella obbligatoria ferma l\'avvio dicendo quali mancano', async () => {
    const { servizio } = servizioCon([riga('WEB'), riga('ARCHIVIO'), riga('VIDEO', false)]);

    await expect(servizio.onModuleInit()).rejects.toThrow('absolute_paths: mancano le cartelle attive VIDEO, MATERIALI');
  });

  it('un tipo non letto all\'avvio si cerca nel database, senza sync', async () => {
    const { servizio, absolutePathsModel } = servizioCon([...TUTTE, riga('ALTRO')]);

    const altro = await servizio.getAbsolutePathFromType('ALTRO');

    expect(altro.path).toBe('/dati/altro');
    expect(absolutePathsModel.findOne).toHaveBeenCalledTimes(1);
    expect(absolutePathsModel.sync).not.toHaveBeenCalled();
  });
});
