import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalApiError } from '../../../../lib/errors';
import { ServerUtils } from '../../utils/ServerUtils';
import { PromoService } from '../PromoService';

// Come in server.ts: le date del form arrivano come DD/MM/YYYY
dayjs.extend(customParseFormat);

const richiesta = {
  titolo: 'A2641_SC_08-10-26',
  dataDiScadenza: '07/10/2026',
  dataDiInizio: '08/10/2026',
  dataDiFine: '18/10/2026',
  offsetVisibilita: 0,
  context: [],
};

// Su risposta non OK sendToFICOApi restituisce data null e il corpo di Istanta in statusText
function makeService(rispostaIstanta: unknown) {
  const promoRepository = {
    findAllWithOptions: vi.fn().mockResolvedValue([]),
    create: vi.fn(async (promo: unknown) => promo),
  };
  const service = new PromoService({} as any, {} as any, promoRepository as any, {} as any, {} as any);
  vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(rispostaIstanta as any);
  return { service, promoRepository };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoService.inizioNuovaLavorazione: Istanta non conferma la promo', () => {
  it.each([
    ['controller', '{"esito":false,"errorCode":0,"error":"no_login"}'],
    ['LoginMiddleWare', '{"login":false,"error":"no_login_byolympus"}'],
  ])('no_login dal %s: errore che dice utente non riconosciuto, promo non creata', async (_origine, corpo) => {
    const { service, promoRepository } = makeService({ data: null, status: 500, statusText: corpo });

    const errore = await service.inizioNuovaLavorazione(richiesta, 'utente', {} as any).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toContain('non ha riconosciuto');
    expect(promoRepository.create).not.toHaveBeenCalled();
  });

  it('Istanta non raggiungibile: errore generico, promo non creata', async () => {
    const { service, promoRepository } = makeService({ data: null, status: 500, statusText: 'fetch failed' });

    const errore = await service.inizioNuovaLavorazione(richiesta, 'utente', {} as any).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toBe("Errore durante la chiamata all'API di Istanta");
    expect(promoRepository.create).not.toHaveBeenCalled();
  });

  it('esito false con HTTP 200: errore generico, promo non creata', async () => {
    const { service, promoRepository } = makeService({ data: { esito: false, error: 'Promo non valida' }, status: 200 });

    await expect(service.inizioNuovaLavorazione(richiesta, 'utente', {} as any)).rejects.toBeInstanceOf(ExternalApiError);
    expect(promoRepository.create).not.toHaveBeenCalled();
  });
});
