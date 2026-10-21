import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import config from '../../config';
import { DashboardService } from '../DashboardService';
import { ExternalApiService } from '../ExternalApiService';
import { riferimentiOlimpoComeGuid } from '../ReferenzeService';

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
