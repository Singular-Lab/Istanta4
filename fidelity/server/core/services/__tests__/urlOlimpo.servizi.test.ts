import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { EVENTI_WEBHOOK, STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';
import config from '../../config';
import { sequelize } from '../../db/SequelizeConnector';
import { Area } from '../../models/aree';
import { Canale } from '../../models/canali';
import { FilesRuntime } from '../../models/files_runtime';
import { FilesRuntimeLog } from '../../models/files_runtime_log';
import { Promo } from '../../models/promo';
import { RuntimeKit } from '../../models/runtime_kit';
import { DashboardService } from '../DashboardService';
import { ExternalApiService } from '../ExternalApiService';
import { KitRuntimeService } from '../KitRuntimeService';
import { riferimentiOlimpoComeGuid } from '../ReferenzeService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('URL Olimpo restituiti dai servizi', () => {
  it('lo storico volantini riceve miniature relative al proxy di Fidelity', () => {
    const service = new DashboardService({} as any, {} as any) as any;

    const [anteprima] = service.mapFilesToAnteprima([{ id: 'f1', nome: 'vol.pdf', id_olimpo_cloud: 'o1' }]);

    expect(anteprima.thumbnailUrl).toBe('/olimpo/materiali/getThumbnailMaterialePdfs?id=o1');
  });

  it('le API esterne ricevono foto con URL assoluto pubblico, anche da un URL legacy interno', () => {
    const service = new ExternalApiService() as any;
    const base = config.CLIENT_URL.replace(/\/+$/, '');

    expect(service.buildOlympusUrl('g1')).toBe(`${base}/olimpo/foto/getThumbNailOnDemand?guidId=g1&performante=true`);
    expect(service.buildOlympusUrl('http://olimpo:3000/foto/getThumbNailOnDemand?guidId=g1'))
      .toBe(`${base}/olimpo/foto/getThumbNailOnDemand?guidId=g1&performante=true`);
  });

  it('una referenza rimandata dal frontend con foto in forma di URL viene salvata con i GUID', () => {
    const salvata = riferimentiOlimpoComeGuid({
      id: 'r1',
      foto: ['/olimpo/foto/getThumbNailOnDemand?guidId=g1&performante=true', 'g2', { guidId: 'http://olimpo:3000/foto/getThumbNailOnDemand?guidId=g3' }],
      foto_extra: [{ guidId: '/olimpo/foto/getThumbNailOnDemand?guidId=e1', sigla: 'BIO' }],
    });

    expect(salvata.foto).toEqual(['g1', 'g2', { guidId: 'g3' }]);
    expect(salvata.foto_extra).toEqual([{ guidId: 'e1', sigla: 'BIO' }]);
  });
});

describe('URL dei file runtime (files_runtime.url)', () => {
  const base = () => config.CLIENT_URL.replace(/\/+$/, '');
  // Un URL salvato con l'indirizzo interno di Olimpo e un id ormai superato
  const URL_INTERNO_VECCHIO = 'http://olimpo:3000/materiali/getThumbnailMaterialePdfs?id=vecchio';

  it('il browser riceve i file del kit con URL relativi al proxy, ricostruiti dall id Olimpo', async () => {
    vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([
      { id: 'f1', nome: 'vol.pdf', id_olimpo_cloud: 'o1', url: URL_INTERNO_VECCHIO },
      { id: 'f2', nome: 'legacy.pdf', id_olimpo_cloud: null, url: '/olimpo/materiali/getMaterialePDF?id=l1' },
    ] as any);
    vi.spyOn(FilesRuntimeLog, 'findAll').mockResolvedValue([]);
    const service = new KitRuntimeService({} as any, {} as any);

    const [conId, legacy] = await service.getFilesRuntimeByIdKitRuntime('k1');

    expect(conId.url).toBe('/olimpo/materiali/getThumbnailMaterialePdfs?id=o1');
    expect(conId.url_download).toBe('/olimpo/materiali/getMaterialePDF?id=o1');
    // Solo le righe senza id Olimpo ripiegano sull URL salvato
    expect(legacy.url).toBe('/olimpo/materiali/getMaterialePDF?id=l1');
  });

  it('aggiornamento e inserimento di un file non salvano gli URL ne il log calcolati alla lettura', async () => {
    const update = vi.spyOn(FilesRuntime, 'update').mockResolvedValue([1] as any);
    const create = vi.spyOn(FilesRuntime, 'create').mockResolvedValue({} as any);
    const service = new KitRuntimeService({} as any, {} as any);
    const letto = {
      id: 'f1', id_runtime: 'k1', nome: 'vol.pdf', id_olimpo_cloud: 'o2', isOptional: false,
      url: URL_INTERNO_VECCHIO, url_download: '/olimpo/materiali/getMaterialePDF?id=vecchio', log: { id: 'l1' },
    } as any;

    await service.updateSingleFileRuntime(letto);
    await service.insertNewFileRuntime(letto);

    for (const salvato of [update.mock.calls[0][0], create.mock.calls[0][0]] as any[]) {
      expect(salvato).not.toHaveProperty('url');
      expect(salvato).not.toHaveProperty('url_download');
      expect(salvato).not.toHaveProperty('log');
      expect(salvato).toMatchObject({ id: 'f1', id_olimpo_cloud: 'o2', is_optional: false });
    }
    expect(update.mock.calls[0][1]).toEqual({ where: { id: 'f1' } });
  });

  it('il webhook KIT_PUBBLICATO riceve l URL assoluto pubblico del PDF, mai quello interno di Olimpo', async () => {
    const kit = { id: 'k1', stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE, id_area: 'a1', id_canale: 'c1', id_promo: 'p1' };
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (cb: any) => cb({ LOCK: { UPDATE: 'UPDATE' } })) as any);
    vi.spyOn(RuntimeKit, 'findOne').mockResolvedValue(kit as any);
    vi.spyOn(RuntimeKit, 'update').mockResolvedValue([1] as any);
    vi.spyOn(Area, 'findOne').mockResolvedValue(null);
    vi.spyOn(Canale, 'findOne').mockResolvedValue(null);
    vi.spyOn(Promo, 'findOne').mockResolvedValue(null);
    vi.spyOn(KitRuntimeService.prototype as any, 'creaLogPubblicazioneFiles').mockResolvedValue(undefined);
    vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([
      { id: 'f1', nome: 'vol.pdf', id_olimpo_cloud: 'o1', url: URL_INTERNO_VECCHIO, tipo_export: 't1' },
      { id: 'f2', nome: 'legacy.pdf', id_olimpo_cloud: null, url: 'http://olimpo:3000/materiali/getMaterialePDF?id=l1', tipo_export: 't1' },
      { id: 'f3', nome: 'esterno.pdf', id_olimpo_cloud: null, url: 'https://cdn.example.com/esterno.pdf', tipo_export: 't1' },
    ] as any);
    const scatenaEvento = vi.fn(async () => undefined);
    const service = new KitRuntimeService({} as any, { scatenaEvento } as any);

    await service.pubblicaKitRuntime('k1', { session: { id_utente: 'u1' } } as any);

    expect(scatenaEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO }));
    const { dati } = (scatenaEvento.mock.calls[0] as any[])[0];
    expect(dati.files.map((f: any) => f.url)).toEqual([
      `${base()}/olimpo/materiali/getMaterialePDF?id=o1`,
      // Riga legacy senza id: l URL salvato passa alla forma pubblica
      `${base()}/olimpo/materiali/getMaterialePDF?id=l1`,
      // Un URL che non e di Olimpo resta com e
      'https://cdn.example.com/esterno.pdf',
    ]);
  });
});
