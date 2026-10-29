import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldType } from '../../../../lib/enums';
import { BadRequestError } from '../../../../lib/errors';
import type { FilterCondition, FilterConditionContesto, PageLayoutItem } from '../../../../lib/types';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { Referenze } from '../../models/referenze';
import { RuntimeKit } from '../../models/runtime_kit';
import { WorkspaceWebpliant } from '../../models/workspace_webpliant';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { ReferenzeService } from '../ReferenzeService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Spec referenze-webpliant, "Filtri WebPliant" e "Referenza presente in piu promo visibili":
// filtri di contesto, filtri sui data_fields, policy di area/canale/PV e deduplica per codice.

const OGGI = '2026-10-28';

// Promo visibili oggi: B e C sono iniziate dopo A. Date alle 00:00 di Roma, come le scrive Istanta.
const PROMO = [
  { id_promo: 'promo-a', validita_dal: new Date('2026-10-19T22:00:00Z'), validita_al: new Date('2026-11-05T23:00:00Z'), offset_visibilita: 0 },
  { id_promo: 'promo-b', validita_dal: new Date('2026-10-24T22:00:00Z'), validita_al: new Date('2026-11-05T23:00:00Z'), offset_visibilita: 0 },
  // Stesso inizio di B
  { id_promo: 'promo-c', validita_dal: new Date('2026-10-24T22:00:00Z'), validita_al: new Date('2026-11-10T23:00:00Z'), offset_visibilita: 0 },
];

type RigaReferenza = { id: string; id_promo: string; id_runtime_kit: string; data_fields: Record<string, unknown> };

function referenza(id: string, dataFields: Record<string, unknown>, idPromo = 'promo-a'): RigaReferenza {
  return { id, id_promo: idPromo, id_runtime_kit: `kit-${idPromo}`, data_fields: { codice_referenza: id, ...dataFields } };
}

const contesto = (nome: string, valore: unknown) => [{ nome_field: nome, user_value: valore }];

function elemento(content: Record<string, unknown>, policy?: unknown): PageLayoutItem {
  return { content, ...(policy ? { policy } : {}) } as unknown as PageLayoutItem;
}

async function filtra(
  righe: RigaReferenza[],
  item: PageLayoutItem,
  opzioni: { isEditor?: boolean; idArea?: string; idCanale?: string; idPV?: string } = {}
): Promise<string[]> {
  vi.spyOn(WorkspaceWebpliant, 'findOne').mockResolvedValue({ id: 'w1' } as unknown as Awaited<ReturnType<typeof WorkspaceWebpliant.findOne>>);
  vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue(PROMO.map((p) => ({ id: `kit-${p.id_promo}` })) as unknown as Awaited<ReturnType<typeof RuntimeKit.findAll>>);
  vi.spyOn(Referenze, 'findAll').mockResolvedValue(righe as unknown as Awaited<ReturnType<typeof Referenze.findAll>>);
  const promoRepository = { findAllWithOptions: vi.fn().mockResolvedValue(PROMO) } as unknown as IPromoRepository;
  const service = new ReferenzeService(promoRepository, {} as unknown as IWebPliantService);

  const risultato = await service.getFilteredReferenze(
    'w1', OGGI, opzioni.idArea, opzioni.idCanale, opzioni.idPV, item, opzioni.isEditor ?? false
  );
  return risultato.map((r) => r.id);
}

const filtroContesto = (nome_field: string, operator: string, user_value: string): FilterConditionContesto =>
  ({ nome_field, operator, user_value });
const filtro = (field: string, operator: string, value: string): FilterCondition => ({ field, operator, value });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReferenzeService.getFilteredReferenze: filtro di contesto', () => {
  it('non distingue maiuscole e spazi su entrambi i lati: "SC" trova "SC"', async () => {
    const righe = [
      referenza('r-sc', { context_promo: contesto('canale', 'SC') }),
      referenza('r-spazi', { context_promo: contesto('Canale', ' sc ') }),
      referenza('r-ip', { context_promo: contesto('canale', 'IP') }),
    ];

    expect(await filtra(righe, elemento({ filtriContesto: [filtroContesto('canale', 'equals', 'SC')] })))
      .toEqual(['r-sc', 'r-spazi']);
  });

  it('cerca il valore anche nel contesto del tracciato', async () => {
    const righe = [
      referenza('r-tracciato', { context_tracciato: contesto('reparto', 'Freschi') }),
      referenza('r-altro', { context_tracciato: contesto('reparto', 'Secco') }),
    ];

    expect(await filtra(righe, elemento({ filtriContesto: [filtroContesto('REPARTO', 'equals', ' freschi')] })))
      .toEqual(['r-tracciato']);
  });

  it('not_equals esclude il valore anche se scritto con maiuscole diverse', async () => {
    const righe = [
      referenza('r-sc', { context_promo: contesto('canale', 'SC') }),
      referenza('r-ip', { context_promo: contesto('canale', 'IP') }),
    ];

    expect(await filtra(righe, elemento({ filtriContesto: [filtroContesto('canale', 'not_equals', 'sc')] })))
      .toEqual(['r-ip']);
  });

  it('OR fra le condizioni sullo stesso campo, AND fra campi diversi', async () => {
    const righe = [
      referenza('r-sc-freschi', { context_promo: contesto('canale', 'SC'), context_tracciato: contesto('reparto', 'FRESCHI') }),
      referenza('r-ip-freschi', { context_promo: contesto('canale', 'IP'), context_tracciato: contesto('reparto', 'freschi') }),
      referenza('r-sc-secco', { context_promo: contesto('canale', 'SC'), context_tracciato: contesto('reparto', 'SECCO') }),
      referenza('r-xx-freschi', { context_promo: contesto('canale', 'XX'), context_tracciato: contesto('reparto', 'FRESCHI') }),
    ];
    const filtri = [
      filtroContesto('canale', 'equals', 'sc'),
      filtroContesto('canale', 'equals', 'ip'),
      filtroContesto('reparto', 'equals', 'Freschi'),
    ];

    expect(await filtra(righe, elemento({ filtriContesto: filtri }))).toEqual(['r-sc-freschi', 'r-ip-freschi']);
  });
});

describe('ReferenzeService.getFilteredReferenze: filtri sui data_fields', () => {
  const codici = [
    referenza('r-00123', { codice_articolo: '00123' }),
    referenza('r-123', { codice_articolo: '123' }),
    referenza('r-00456', { codice_articolo: '00456' }),
  ];

  it('uguale a "00123" seleziona il codice con gli zeri iniziali', async () => {
    expect(await filtra(codici, elemento({ filtersNew: [[filtro('codice_articolo', 'equals', '00123')]] })))
      .toEqual(['r-00123']);
  });

  it('uguale a "123" non seleziona "00123"', async () => {
    expect(await filtra(codici, elemento({ filtersNew: [[filtro('codice_articolo', 'equals', '123')]] })))
      .toEqual(['r-123']);
  });

  it('in e not_in confrontano i codici come testo', async () => {
    expect(await filtra(codici, elemento({ filtersNew: [[filtro('codice_articolo', 'in', '00123, 00456')]] })))
      .toEqual(['r-00123', 'r-00456']);
    expect(await filtra(codici, elemento({ filtersNew: [[filtro('codice_articolo', 'not_in', '00123,00456')]] })))
      .toEqual(['r-123']);
  });

  it('maggiore e minore restano confronti numerici', async () => {
    const prezzi = [
      referenza('r-5', { prezzo: 5 }),
      referenza('r-15', { prezzo: 15 }),
      referenza('r-9-testo', { prezzo: '9' }),
    ];

    expect(await filtra(prezzi, elemento({ filtersNew: [[filtro('prezzo', 'greater_than', '10')]] }))).toEqual(['r-15']);
    expect(await filtra(prezzi, elemento({ filtersNew: [[filtro('prezzo', 'less_than', '10')]] }))).toEqual(['r-5', 'r-9-testo']);
  });

  it('OR fra i gruppi, AND dentro ogni gruppo', async () => {
    const righe = [
      referenza('r-freschi-caro', { reparto: 'FRESCHI', prezzo: 12 }),
      referenza('r-freschi-economico', { reparto: 'FRESCHI', prezzo: 3 }),
      referenza('r-marca', { reparto: 'SECCO', prezzo: 1, marca: 'XYZ' }),
      referenza('r-nessuno', { reparto: 'SECCO', prezzo: 20 }),
    ];
    const gruppi = [
      [filtro('reparto', 'equals', 'FRESCHI'), filtro('prezzo', 'greater_than', '10')],
      [filtro('marca', 'equals', 'XYZ')],
    ];

    expect(await filtra(righe, elemento({ filtersNew: gruppi }))).toEqual(['r-freschi-caro', 'r-marca']);
  });
});

describe('ReferenzeService.getFilteredReferenze: policy di visualizzazione', () => {
  const righe = [
    referenza('r-a1-c1-pv1', { area: 'a1', canale: 'c1', punto_vendita: 'pv1' }),
    referenza('r-a1-c2-pv2', { area: 'a1', canale: 'c2', punto_vendita: 'pv2' }),
    referenza('r-a2-c1-pv2', { area: 'a2', canale: 'c1', punto_vendita: 'pv2' }),
  ];
  const policy = (inclusione: FieldType[], esclusione: FieldType[], locked = true) => ({
    locked,
    visualizzazione: [{ inclusione: inclusione.map((tipo) => ({ tipo })), esclusione: esclusione.map((tipo) => ({ tipo })) }],
  });

  it('l\'inclusione per area e canale tiene solo le referenze della richiesta', async () => {
    const item = elemento({}, policy([FieldType.AREA, FieldType.CANALE], []));

    expect(await filtra(righe, item, { idArea: 'a1', idCanale: 'c1' })).toEqual(['r-a1-c1-pv1']);
  });

  it('l\'esclusione per punto vendita toglie le referenze di quel punto vendita', async () => {
    const item = elemento({}, policy([], [FieldType.PUNTO_VENDITA]));

    expect(await filtra(righe, item, { idPV: 'pv1' })).toEqual(['r-a1-c2-pv2', 'r-a2-c1-pv2']);
  });

  it('una policy non bloccata non filtra', async () => {
    const item = elemento({}, policy([FieldType.AREA], [FieldType.PUNTO_VENDITA], false));

    expect(await filtra(righe, item, { idArea: 'a1', idPV: 'pv1' })).toEqual(['r-a1-c1-pv1', 'r-a1-c2-pv2', 'r-a2-c1-pv2']);
  });
});

describe('ReferenzeService.getFilteredReferenze: una referenza per codice', () => {
  it('stessa referenza in due promo: vince quella iniziata piu di recente, in qualunque ordine arrivi', async () => {
    const vecchia = referenza('r-promo-a', { codice_referenza: '8001234', prezzo: 3 }, 'promo-a');
    const recente = referenza('r-promo-b', { codice_referenza: '8001234', prezzo: 2 }, 'promo-b');

    expect(await filtra([vecchia, recente], elemento({}))).toEqual(['r-promo-b']);
    expect(await filtra([recente, vecchia], elemento({}))).toEqual(['r-promo-b']);
  });

  it('a parita di inizio vince la promo con l\'id minore, nella stessa promo la referenza con l\'id minore', async () => {
    const stessoCodice = (id: string, idPromo: string) => referenza(id, { codice_referenza: 'C1' }, idPromo);

    // B e C iniziano lo stesso giorno, dopo A
    expect(await filtra([stessoCodice('r-c', 'promo-c'), stessoCodice('r-a', 'promo-a'), stessoCodice('r-b', 'promo-b')], elemento({})))
      .toEqual(['r-b']);
    // Stesso codice in due kit della stessa promo
    expect(await filtra([stessoCodice('r-2', 'promo-b'), stessoCodice('r-1', 'promo-b')], elemento({})))
      .toEqual(['r-1']);
  });

  it('nell\'editor restituisce al massimo 20 referenze, al pubblico tutte', async () => {
    const tante = Array.from({ length: 25 }, (_, i) => referenza(`r-${i}`, {}));

    expect(await filtra(tante, elemento({}), { isEditor: true })).toHaveLength(20);
    expect(await filtra(tante, elemento({}))).toHaveLength(25);
  });
});

describe('ReferenzeService.getFilteredReferenze: richiesta non valida', () => {
  it('senza l\'elemento della pagina e\' una richiesta non valida (400), non un errore interno', async () => {
    const service = new ReferenzeService({} as unknown as IPromoRepository, {} as unknown as IWebPliantService);

    const errore = await service.getFilteredReferenze('w1', OGGI, undefined, undefined, undefined, undefined as unknown as PageLayoutItem, false)
      .catch((e: unknown) => e);

    expect(errore).toBeInstanceOf(BadRequestError);
    expect((errore as BadRequestError).httpStatus).toBe(400);
  });
});
