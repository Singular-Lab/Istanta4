import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../../../lib/errors';
import { isStessaPromo } from '../../utils/PromoModelUtils';
import { ServerUtils } from '../../utils/ServerUtils';
import { PromoService } from '../PromoService';

// Come in server.ts: le date del form arrivano come DD/MM/YYYY
dayjs.extend(customParseFormat);

// La promo dello screenshot di I20-961, gia presente
const ESISTENTE = {
  nome_promo: 'A2619_SC_04-09-26',
  validita_dal: new Date(2026, 8, 4),
  validita_al: new Date(2026, 8, 13),
};

const richiesta = (override: Record<string, unknown> = {}) => ({
  titolo: 'A2619_SC_04-09-26',
  dataDiScadenza: '03/09/2026',
  dataDiInizio: '04/09/2026',
  dataDiFine: '13/09/2026',
  offsetVisibilita: 0,
  context: [],
  ...override,
});

function makeService() {
  const promoRepository = {
    findAllWithOptions: vi.fn().mockResolvedValue([ESISTENTE]),
    create: vi.fn(async (promo: unknown) => promo),
  };
  const service = new PromoService({} as any, {} as any, promoRepository as any, {} as any, {} as any);
  const istanta = vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ data: { esito: true }, status: 200 } as any);
  return { service, promoRepository, istanta };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PromoService.inizioNuovaLavorazione: promo duplicate', () => {
  it('rifiuta stesso nome (maiuscole e spazi a parte) e stesse date, senza chiamare Istanta', async () => {
    const { service, promoRepository, istanta } = makeService();

    await expect(
      service.inizioNuovaLavorazione(richiesta({ titolo: ' a2619_sc_04-09-26 ' }), 'utente', {} as any)
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(istanta).not.toHaveBeenCalled();
    expect(promoRepository.create).not.toHaveBeenCalled();
  });

  it('crea la promo se cambia il nome', async () => {
    const { service, istanta } = makeService();

    await expect(
      service.inizioNuovaLavorazione(richiesta({ titolo: 'A2619_SC_04-09-26_BIS' }), 'utente', {} as any)
    ).resolves.toMatchObject({ nome: 'A2619_SC_04-09-26_BIS' });
    expect(istanta).toHaveBeenCalledTimes(1);
  });

  it('crea la promo se cambiano le date', async () => {
    const { service, istanta } = makeService();

    await expect(
      service.inizioNuovaLavorazione(richiesta({ dataDiFine: '20/09/2026' }), 'utente', {} as any)
    ).resolves.toMatchObject({ nome: 'A2619_SC_04-09-26' });
    expect(istanta).toHaveBeenCalledTimes(1);
  });
});

describe('isStessaPromo', () => {
  it('confronta le date per giorno, senza badare all\'ora', () => {
    expect(isStessaPromo(ESISTENTE, { ...ESISTENTE, validita_dal: new Date(2026, 8, 4, 10, 30) })).toBe(true);
    expect(isStessaPromo(ESISTENTE, { ...ESISTENTE, validita_al: new Date(2026, 8, 14) })).toBe(false);
  });
});
