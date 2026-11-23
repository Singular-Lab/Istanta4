import { ABSOLUTE_PATH_TYPE } from '@enums/enums';
import * as childProcess from 'child_process';
import { FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import { itConGhostscript } from '../../test/strumenti-nativi';
import { codaLetturaFinita, generateAllThumbnails, MaterialiController } from './materiali.controller';
import { RESA_LETTURA } from './pagine-pdf';

/**
 * Le immagini delle pagine servite da getThumbnailMaterialePdfs e la loro preparazione in
 * background, con Ghostscript e sharp veri su un PDF di prova creato al momento (pagine da
 * 200×100 punti).
 */
describe('MaterialiController: pagine dei PDF a 150 e 300 dpi', () => {
  let cartella: string;
  let controller: MaterialiController;
  let materialiService: { getMaterialeFromId: jest.Mock; getAllMateriali: jest.Mock };
  const thumbnails = () => path.join(cartella, 'thumbnails');
  const file = (nome: string) => path.join(thumbnails(), nome);

  /** Un PDF di `pagine` pagine con una scritta ciascuna, disegnato da Ghostscript. */
  const creaPdf = (pagine: number) => {
    const postscript = Array.from(
      { length: pagine },
      (_, i) => `<< /PageSize [200 100] >> setpagedevice /Helvetica findfont 18 scalefont setfont 20 40 moveto (Pagina ${i + 1}) show showpage`,
    ).join(' ');
    const percorso = path.join(cartella, 'volantino.pdf');
    const esito = childProcess.spawnSync('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', `-sOutputFile=${percorso}`, '-c', postscript]);
    if (esito.status !== 0) throw new Error(`Ghostscript non ha creato il PDF di prova: ${esito.stderr}`);
    materialiService.getMaterialeFromId.mockResolvedValue({ id: 'm1', file_name: 'volantino.pdf', original_name: 'volantino.pdf', pagine });
    materialiService.getAllMateriali.mockResolvedValue([{ id: 'm1', file_name: 'volantino.pdf', original_name: 'volantino.pdf', pagine }]);
    return percorso;
  };

  const chiedi = async (params: { page?: string; dpi?: string; width?: string; height?: string }) => {
    const intestazioni: Record<string, string> = {};
    const corpo: { buffer?: Buffer } = {};
    const reply = {
      raw: {
        setHeader: jest.fn((nome: string, valore: string) => {
          intestazioni[nome] = valore;
        }),
        end: jest.fn((buffer: Buffer) => {
          corpo.buffer = buffer;
        }),
      },
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as FastifyReply;
    await controller.getThumbnailMaterialePdfs('m1', params.page ?? '1', params.width, params.height, undefined, params.dpi, reply);
    const meta = corpo.buffer ? await sharp(corpo.buffer).metadata() : undefined;
    return { reply, buffer: corpo.buffer, intestazioni, meta };
  };

  /** La rigenerazione via SSE: restituisce gli eventi inviati. */
  const rigenera = async () => {
    const eventi: Array<{ evento: string; dati: any }> = [];
    let ultimo = '';
    const reply = {
      raw: {
        writeHead: jest.fn(),
        write: jest.fn((testo: string) => {
          if (testo.startsWith('event: ')) ultimo = testo.slice(7).trim();
          else if (testo.startsWith('data: ')) eventi.push({ evento: ultimo, dati: JSON.parse(testo.slice(6)) });
        }),
        end: jest.fn(),
      },
    } as unknown as FastifyReply;
    await controller.generateAllThumbnailsEndpoint('300', reply);
    return eventi;
  };

  beforeEach(async () => {
    cartella = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-pagine-pdf-'));
    materialiService = { getMaterialeFromId: jest.fn(), getAllMateriali: jest.fn() };
    const olimpoService = {
      getAbsolutePathFromType: jest.fn().mockImplementation((tipo: ABSOLUTE_PATH_TYPE) =>
        Promise.resolve({ path: tipo === ABSOLUTE_PATH_TYPE.MATERIALI ? cartella : os.tmpdir() }),
      ),
    };
    controller = new MaterialiController(olimpoService as any, materialiService as any, { server: { emit: jest.fn() } } as any);
  });

  afterEach(async () => {
    await codaLetturaFinita();
    jest.restoreAllMocks();
    await fs.promises.rm(cartella, { recursive: true, force: true });
  });

  it('rifiuta un dpi non ammesso senza disegnare né salvare niente', async () => {
    materialiService.getMaterialeFromId.mockResolvedValue({ id: 'm1', file_name: 'volantino.pdf', pagine: 1 });

    const { reply, buffer } = await chiedi({ dpi: '600' });

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ esito: false }));
    expect(buffer).toBeUndefined();
    expect(fs.existsSync(thumbnails())).toBe(false);
  });

  itConGhostscript('senza dpi serve la pagina a 150 dpi di sempre, con la cache di un anno', async () => {
    creaPdf(1);

    const base = await chiedi({ page: '1' });

    expect([base.meta.format, base.meta.width]).toEqual(['webp', 417]); // 200 punti a 150 dpi
    expect(base.intestazioni['Cache-Control']).toBe('public, max-age=31536000');
    expect(fs.existsSync(file('m1_page1_300dpi.webp'))).toBe(false);
  });

  itConGhostscript('con dpi=300 e la pagina non ancora pronta risponde subito a 150 dpi, senza cache, e prepara le pagine in background', async () => {
    creaPdf(2);

    const subito = await chiedi({ page: '2', dpi: '300' });

    expect(subito.meta.width).toBe(417);
    expect(subito.intestazioni['X-Olimpo-Dpi']).toBe('150');
    expect(subito.intestazioni['Cache-Control']).toBe('no-store');

    await codaLetturaFinita();
    const dopo = await chiedi({ page: '2', dpi: '300' });

    expect(Math.abs(dopo.meta.width - 2 * 417)).toBeLessThanOrEqual(1);
    expect(dopo.intestazioni['X-Olimpo-Dpi']).toBe('300');
    expect(dopo.intestazioni['Cache-Control']).toBe('public, max-age=31536000');
    // Tutte le pagine del PDF, non solo quella chiesta
    expect(fs.existsSync(file('m1_page1_300dpi.webp'))).toBe(true);
  });

  itConGhostscript('serve i file in cache così come sono, senza ricodificarli né ridisegnarli', async () => {
    creaPdf(1);
    await chiedi({ page: '1', dpi: '300' });
    await codaLetturaFinita();
    const spawn = jest.spyOn(childProcess, 'spawn');

    const lettura = await chiedi({ page: '1', dpi: '300' });
    const base = await chiedi({ page: '1' });

    expect(lettura.buffer.equals(fs.readFileSync(file('m1_page1_300dpi.webp')))).toBe(true);
    expect(base.buffer.equals(fs.readFileSync(file('m1_page1.webp')))).toBe(true);
    expect(spawn).not.toHaveBeenCalled();
  });

  itConGhostscript('con width e height restituisce la pagina ridotta a quella misura', async () => {
    creaPdf(1);

    const ridotta = await chiedi({ page: '1', dpi: '300', width: '120', height: '60' });

    expect([ridotta.meta.width, ridotta.meta.height]).toEqual([120, 60]);
  });

  itConGhostscript('richieste contemporanee della stessa pagina mettono in coda il PDF una volta sola', async () => {
    creaPdf(1);
    const spawn = jest.spyOn(childProcess, 'spawn');

    await Promise.all([chiedi({ page: '1', dpi: '300' }), chiedi({ page: '1', dpi: '300' }), chiedi({ page: '1', dpi: '300' })]);
    await codaLetturaFinita();

    const disegni600 = spawn.mock.calls.filter(([, args]) => Array.isArray(args) && args.includes('-r600'));
    expect(disegni600).toHaveLength(1);
    expect(fs.readdirSync(thumbnails()).sort()).toEqual(['m1_page1.webp', 'm1_page1_300dpi.webp']);
  });

  itConGhostscript('la preparazione a 300 dpi salta le pagine pronte, quelle di un altro processo e non tocca le miniature', async () => {
    const pdf = creaPdf(3);
    await generateAllThumbnails(pdf, 'm1', thumbnails(), 3);
    const miniatura = fs.readFileSync(file('m1_page1.webp'));
    // La pagina 3 la sta disegnando un altro processo
    fs.writeFileSync(file('m1_page3_300dpi.webp.lock'), '12345 adesso');

    expect(await generateAllThumbnails(pdf, 'm1', thumbnails(), 3, RESA_LETTURA)).toBe(2);
    expect(await generateAllThumbnails(pdf, 'm1', thumbnails(), 3, RESA_LETTURA)).toBe(0);

    expect(fs.existsSync(file('m1_page1_300dpi.webp'))).toBe(true);
    expect(fs.existsSync(file('m1_page2_300dpi.webp'))).toBe(true);
    expect(fs.existsSync(file('m1_page3_300dpi.webp'))).toBe(false);
    expect(fs.readFileSync(file('m1_page1.webp')).equals(miniatura)).toBe(true);
  });

  itConGhostscript('la rigenerazione dell\'archivio prepara le pagine dei PDF e non parte due volte insieme', async () => {
    creaPdf(2);

    const [prima, seconda] = await Promise.all([rigenera(), rigenera()]);

    expect(prima.find((e) => e.evento === 'complete')?.dati).toEqual({ success: true });
    expect(prima).toContainEqual({ evento: 'log', dati: { type: 'success', message: 'volantino.pdf: 2/2 pagine a 300 dpi' } });
    expect(seconda.find((e) => e.evento === 'error')?.dati.message).toMatch(/già in corso/);
    expect(seconda.find((e) => e.evento === 'complete')?.dati).toEqual({ success: false });
    expect(fs.existsSync(file('m1_page2_300dpi.webp'))).toBe(true);

    // Rilanciata, riprende: le pagine pronte si saltano
    const ancora = await rigenera();
    expect(ancora.find((e) => e.evento === 'complete')?.dati).toEqual({ success: true });
  });
});
