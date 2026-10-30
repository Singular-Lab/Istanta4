import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { Request as ExpressRequest } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { IConfigService } from '../../interfaces/IConfigService';
import type { IIstantaService } from '../../interfaces/IIstantaService';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import type { PromoAttributes } from '../../models/promo';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { ServerUtils } from '../../utils/ServerUtils';
import { PromoService } from '../PromoService';

// Come in server.ts: le date del form arrivano come DD/MM/YYYY
dayjs.extend(customParseFormat);

const richiesta = (dataDiScadenza: string, dataDiInizio: string, dataDiFine: string) => ({
  titolo: 'A2619_SC_04-09-26',
  dataDiScadenza,
  dataDiInizio,
  dataDiFine,
  offsetVisibilita: 0,
  context: [],
});

function makeService() {
  const promoRepository = {
    findAllWithOptions: vi.fn().mockResolvedValue([]),
    create: vi.fn(async (promo: PromoAttributes) => promo),
  };
  const service = new PromoService(
    {} as IWebPliantService,
    {} as IIstantaService,
    promoRepository as unknown as IPromoRepository,
    {} as IAgenziaLib,
    {} as IConfigService
  );
  const istanta = vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ data: { esito: true }, status: 200 } as never);
  return { service, promoRepository, istanta };
}

beforeEach(() => {
  // Server in UTC come nel container: le 23:30 UTC del 10 ottobre a Roma sono gia' l'11
  vi.stubEnv('TZ', 'UTC');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T23:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('PromoService.inizioNuovaLavorazione: stato iniziale dalle date', () => {
  it.each([
    // Le promo storiche del plugin InDesign: non devono passare da "in corso"
    ['validita tutta nel passato', STATO_PROMO.ARCHIVIATA, '01/09/2026', '04/09/2026', '13/09/2026'],
    ['finita il 10 ottobre, a Roma e gia l\'11', STATO_PROMO.ARCHIVIATA, '30/09/2026', '01/10/2026', '10/10/2026'],
    ['nel periodo di validita', STATO_PROMO.VALIDA, '04/10/2026', '05/10/2026', '20/10/2026'],
    ['futura, scadenza oltre 7 giorni', STATO_PROMO.PIANIFICATA, '20/11/2026', '21/11/2026', '30/11/2026'],
  ])('%s: salva e restituisce %s, a Istanta resta PIANIFICATA', async (_caso, statoAtteso, scadenza, inizio, fine) => {
    const { service, promoRepository, istanta } = makeService();

    const risposta = await service.inizioNuovaLavorazione(richiesta(scadenza, inizio, fine), 'utente', {} as ExpressRequest);

    expect(promoRepository.create).toHaveBeenCalledWith(expect.objectContaining({ stato: statoAtteso }));
    expect(risposta.stato).toBe(statoAtteso);
    // Il payload verso /FicoProcess/inizioNuovaLavorazione non cambia
    expect(istanta).toHaveBeenCalledTimes(1);
    expect(istanta.mock.calls[0][3]).toMatchObject({
      stato: STATO_PROMO.PIANIFICATA,
      nomePromo: 'A2619_SC_04-09-26',
      validitaDal: dayjs(inizio, 'DD/MM/YYYY').toDate(),
      validitaAl: dayjs(fine, 'DD/MM/YYYY').toDate(),
      dataScadenza: dayjs(scadenza, 'DD/MM/YYYY').toDate(),
    });
  });
});
