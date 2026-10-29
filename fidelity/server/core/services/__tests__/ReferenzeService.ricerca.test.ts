import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';
import { BadRequestError } from '../../../../lib/errors';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { ReferenzeGruppo } from '../../models/referenze_gruppo';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { ReferenzeService } from '../ReferenzeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Ricerca pubblica delle referenze di un workspace WebPliant (/api/ricercaReferenzePromo).
// I kit arrivano da getReferenzeWebPliant con i soli campi della risposta pubblica
// (spec referenze-webpliant, Referenze pubbliche per area e canale).

type Kit = { id: string; stato_lavorazione: string; visibile: boolean; webpliant: unknown[] };

const referenza = (id: string, dataFields: Record<string, unknown> | null) => ({ id, foto: [], foto_extra: [], data_fields: dataFields });

function kit(webpliant: unknown[], stato: string = STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO): Kit {
  return { id: `kit-${stato}`, stato_lavorazione: stato, visibile: true, webpliant };
}

function crea(kits: Kit[]) {
  vi.spyOn(ReferenzeGruppo, 'findAll').mockResolvedValue([] as unknown as Awaited<ReturnType<typeof ReferenzeGruppo.findAll>>);
  const getReferenzeWebPliant = vi.fn().mockResolvedValue(kits);
  const service = new ReferenzeService({} as unknown as IPromoRepository, { getReferenzeWebPliant } as unknown as IWebPliantService);
  return { service, getReferenzeWebPliant };
}

const richiesta = (query: unknown, areaCanale: { idArea?: unknown; idCanale?: unknown } = { idArea: 'a1', idCanale: 'c1' }) =>
  ({ query, idWorkspace: 'w1', ...areaCanale }) as unknown as Parameters<ReferenzeService['ricercaReferenzePromo']>[0];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReferenzeService.ricercaReferenzePromo', () => {
  it.each([
    ['vuota', ''],
    ['assente', undefined],
    ['non testuale', 42],
  ])('query %s: richiesta non valida (400) e nessuna lettura dei kit', async (_caso, query) => {
    const { service, getReferenzeWebPliant } = crea([]);

    const errore = await service.ricercaReferenzePromo(richiesta(query)).catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(BadRequestError);
    expect((errore as BadRequestError).httpStatus).toBe(400);
    expect(getReferenzeWebPliant).not.toHaveBeenCalled();
  });

  it.each([
    ['senza area', undefined, 'c1'],
    ['senza canale', 'a1', null],
    ['con area vuota', '  ', 'c1'],
  ])('%s: richiesta non valida (400), non 404 ne 500', async (_caso, idArea, idCanale) => {
    const { service, getReferenzeWebPliant } = crea([kit([referenza('r1', { descrizione_uno: 'pasta' })])]);

    const errore = await service.ricercaReferenzePromo(richiesta('pasta', { idArea, idCanale })).catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(BadRequestError);
    expect((errore as BadRequestError).httpStatus).toBe(400);
    expect(getReferenzeWebPliant).not.toHaveBeenCalled();
  });

  it('cerca nei kit dell\'area e del canale richiesti, alla data di oggi', async () => {
    const { service, getReferenzeWebPliant } = crea([kit([referenza('r1', { descrizione_uno: 'pasta' })])]);

    await service.ricercaReferenzePromo(richiesta('pasta'));

    expect(getReferenzeWebPliant).toHaveBeenCalledWith('w1', expect.any(Date), 'a1', 'c1');
  });

  it('una referenza senza data_fields si salta senza errore', async () => {
    const { service } = crea([kit([referenza('r-null', null), referenza('r-pasta', { descrizione_uno: 'Pasta di semola' })])]);

    const risultati = await service.ricercaReferenzePromo(richiesta('pasta'));

    expect(risultati.map((r) => r.ref.id)).toEqual(['r-pasta']);
  });

  it('la corrispondenza esatta viene prima di quella parziale', async () => {
    const { service } = crea([kit([
      referenza('r-parziale', { descrizione_uno: 'Pastasciutta pronta' }),
      referenza('r-esatta', { descrizione_uno: 'Pasta corta' }),
      referenza('r-assente', { descrizione_uno: 'Riso' }),
    ])]);

    const risultati = await service.ricercaReferenzePromo(richiesta('pasta'));

    expect(risultati.map((r) => r.ref.id)).toEqual(['r-esatta', 'r-parziale']);
    expect(risultati[0].score).toBeGreaterThan(risultati[1].score);
  });

  it('ordina per punteggio decrescente, sommando le parole e i campi', async () => {
    const { service } = crea([kit([
      referenza('r-una-parola', { descrizione_uno: 'Pasta' }),
      referenza('r-due-campi', { descrizione_uno: 'Pasta', descrizione_due: 'pasta fresca' }),
      referenza('r-peso', { descrizione_peso: 'pasta' }),
    ])]);

    const risultati = await service.ricercaReferenzePromo(richiesta('pasta'));

    expect(risultati.map((r) => r.ref.id)).toEqual(['r-due-campi', 'r-una-parola', 'r-peso']);
  });

  it('cerca solo fra le referenze dei kit PUBBLICATI', async () => {
    const { service } = crea([
      kit([referenza('r-pubblicato', { descrizione_uno: 'pasta' })]),
      kit([referenza('r-in-revisione', { descrizione_uno: 'pasta' })], STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE),
    ]);

    const risultati = await service.ricercaReferenzePromo(richiesta('pasta'));

    expect(risultati.map((r) => r.ref.id)).toEqual(['r-pubblicato']);
  });
});
