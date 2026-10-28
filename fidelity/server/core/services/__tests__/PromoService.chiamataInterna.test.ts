import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalApiError } from '../../../../lib/errors';
import config from '../../config';
import { chiamaHttp } from '../../http/clienteHttp';
import { ServerUtils } from '../../utils/ServerUtils';
import { PromoService, urlInternoFidelity } from '../PromoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// La chiamata verso Fidelity stessa passa dal client comune: qui si controlla con cosa parte
vi.mock('../../http/clienteHttp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../http/clienteHttp')>()),
  chiamaHttp: vi.fn(),
}));
const chiama = vi.mocked(chiamaHttp);

/** Contesto di Istanta con una sola chiamata runtime verso `url`. */
function contestoConChiamata(url: string) {
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({
    status: 200,
    data: { esito: true, error: '', content: JSON.stringify([{ chiamata_runtime: { url, metodo: 'GET' } }]) },
  } as any);
}

const service = () => new PromoService({} as any, {} as any, {} as any, {} as any, {} as any);
const req = { headers: { authorization: 'Bearer utente' } } as any;

afterEach(() => {
  chiama.mockReset();
});

describe('chiamata runtime del contesto verso Fidelity', () => {
  it.each([
    ['URL assoluto', '.http://altro.host/api/combinazioni'],
    ['host con @', '.@altro.host/api/combinazioni'],
    ['host con //', './/altro.host/api/combinazioni'],
  ])('%s: rifiutato senza chiamarlo (porterebbe fuori l\'Authorization e la firma interna)', async (_caso, url) => {
    contestoConChiamata(url);

    const errore = await service().getContestoPerNuovaLavorazione(req).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toBe('Chiamata runtime del contesto non ammessa');
    expect(chiama).not.toHaveBeenCalled();
  });

  it('percorso relativo: chiamato su Fidelity con il tempo massimo di una lettura', async () => {
    contestoConChiamata('./api/combinazioni');
    chiama.mockResolvedValue(new Response(JSON.stringify([{ sigla: 'A1', id: 'c1' }]), { status: 200 }));

    const contesto = await service().getContestoPerNuovaLavorazione(req);

    expect(chiama).toHaveBeenCalledTimes(1);
    const [url, opzioni] = chiama.mock.calls[0];
    expect(url).toBe(`${config.VITE_API_URL.split('/api')[0]}/api/combinazioni`);
    expect(opzioni).toMatchObject({ method: 'GET', categoria: 'lettura' });
    expect(opzioni?.headers).toMatchObject({ Authorization: 'Bearer utente' });
    expect(contesto[0].valore).toEqual([{ titolo: 'A1', valore: 'c1' }]);
    expect(contesto[0].chiamata_runtime).toBeUndefined();
  });
});

describe('urlInternoFidelity', () => {
  it.each([
    ['/api/combinazioni', 'http://fidelity.test/api/combinazioni'],
    ['/api/x?y=1', 'http://fidelity.test/api/x?y=1'],
  ])('%s resta su Fidelity', (percorso, atteso) => {
    expect(urlInternoFidelity('http://fidelity.test', percorso)).toBe(atteso);
  });

  it.each(['http://altro.host/x', '//altro.host/x', '@altro.host/x', 'api/x', '/\\altro.host/x'])('%s viene rifiutato', (percorso) => {
    expect(urlInternoFidelity('http://fidelity.test', percorso)).toBeNull();
  });
});
