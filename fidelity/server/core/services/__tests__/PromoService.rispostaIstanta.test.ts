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

// Risposte nella forma di sendToFICOApi: stato reale e corpo interpretato (status 0 senza risposta HTTP)
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
    ['controller', 401, '{"esito":false,"errorCode":0,"error":"no_login"}'],
    ['LoginMiddleWare', 401, '{"login":false,"error":"no_login_byolympus"}'],
  ])('no_login dal %s: errore che dice utente non riconosciuto, promo non creata', async (_origine, status, corpo) => {
    const { service, promoRepository } = makeService({ data: JSON.parse(corpo), status, statusText: corpo });

    const errore = await service.inizioNuovaLavorazione(richiesta, 'utente', {} as any).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toBe("Istanta non ha riconosciuto l'utente");
    expect(promoRepository.create).not.toHaveBeenCalled();
  });

  it('eccezione di Istanta (no_login:<stack>): errore interno, senza stack, promo non creata', async () => {
    const corpo = { login: false, error: 'no_login:System.FormatException: data non valida\n   at Istanta.X()' };
    const { service, promoRepository } = makeService({ data: corpo, status: 400, statusText: JSON.stringify(corpo) });

    const errore = await service.inizioNuovaLavorazione(richiesta, 'utente', {} as any).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toBe('Errore interno di Istanta');
    expect(promoRepository.create).not.toHaveBeenCalled();
  });

  it('Istanta non raggiungibile: promo non creata', async () => {
    const { service, promoRepository } = makeService({ data: null, status: 0, statusText: 'fetch failed' });

    const errore = await service.inizioNuovaLavorazione(richiesta, 'utente', {} as any).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toBe('Impossibile contattare Istanta');
    expect(promoRepository.create).not.toHaveBeenCalled();
  });

  it('esito false con HTTP 200: il motivo di Istanta, promo non creata', async () => {
    const { service, promoRepository } = makeService({ data: { esito: false, error: 'Promo non valida' }, status: 200 });

    const errore = await service.inizioNuovaLavorazione(richiesta, 'utente', {} as any).catch((e) => e);

    expect(errore).toBeInstanceOf(ExternalApiError);
    expect(errore.message).toBe('Istanta: Promo non valida');
    expect(promoRepository.create).not.toHaveBeenCalled();
  });
});
