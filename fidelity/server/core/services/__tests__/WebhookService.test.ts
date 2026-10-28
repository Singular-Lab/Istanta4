import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTI_WEBHOOK, STATO_TENTATIVO_WEBHOOK, STATO_WEBHOOK } from '../../../../lib/enums';
import { ValidationError } from '../../../../lib/errors';

// DNS finto: i nomi della tabella risolvono negli IP indicati
const dns = vi.hoisted(() => ({
  tabella: {
    'ricevente.esempio.it': ['93.184.216.34'],
    'interno.lan': ['10.0.0.5'],
    'rebinding.esempio.it': ['127.0.0.1'],
  } as Record<string, string[]>,
}));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const indirizzi = dns.tabella[host];
    if (!indirizzi) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
    return indirizzi.map(address => ({ address, family: 4 }));
  }),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { timeoutTentativoMs, TIMEOUT_MASSIMO_TENTATIVO_MS, WebhookService } from '../WebhookService';

const fetchFinto = vi.fn();
vi.stubGlobal('fetch', fetchFinto);

const WEBHOOK = {
  id_webhook: 'w1',
  nome_webhook: 'ERP',
  url_webhook: 'https://ricevente.esempio.it/eventi',
  eventi_webhook: [EVENTI_WEBHOOK.KIT_PUBBLICATO],
  stato_webhook: STATO_WEBHOOK.ATTIVO,
  secret_webhook: 'segreto-di-prova',
  timeout_webhook: 30,
  retry_count_webhook: 2,
  retry_delay_webhook: 1,
  headers_personalizzati_webhook: { 'X-Webhook-Delivery-Id': 'sovrascritto' },
};

const modello = (dati: Record<string, unknown>) => ({ ...dati, toJSON: () => ({ ...dati }) });

function creaServizio(webhook: Record<string, unknown> = WEBHOOK) {
  const webhookRepository = {
    findActiveByEvento: vi.fn(async () => [modello(webhook)]),
    findById: vi.fn(async () => modello(webhook)),
    create: vi.fn(async (dati: Record<string, unknown>) => modello(dati)),
    update: vi.fn(async () => [1]),
  };
  const tentativi = { create: vi.fn(async () => undefined) };
  const service = new WebhookService(webhookRepository as any, tentativi as any);
  return { service, webhookRepository, tentativi };
}

const statiRegistrati = (tentativi: { create: ReturnType<typeof vi.fn> }) =>
  tentativi.create.mock.calls.map(([t]: any[]) => t.stato_tentativo);

beforeEach(() => {
  // Jitter a zero: con retry_delay 1 ms i retry non rallentano i test
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(sequelize, 'transaction').mockResolvedValue({ commit: vi.fn(), rollback: vi.fn() } as any);
});

afterEach(() => {
  fetchFinto.mockReset();
  vi.restoreAllMocks();
});

describe('WebhookService.scatenaEvento', () => {
  it('torna prima che la consegna sia completata: la pubblicazione non aspetta il webhook', async () => {
    let rispondi!: (r: Response) => void;
    fetchFinto.mockReturnValueOnce(new Promise<Response>(resolve => { rispondi = resolve; }));
    const { service, tentativi } = creaServizio();

    await service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: { kit: 'k1' } });

    expect(tentativi.create).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fetchFinto).toHaveBeenCalledOnce());
    rispondi(new Response('ok', { status: 200 }));
    await vi.waitFor(() => expect(statiRegistrati(tentativi)).toEqual([STATO_TENTATIVO_WEBHOOK.SUCCESSO]));
  });

  it('un errore nel recupero dei webhook non arriva a chi pubblica', async () => {
    const { service, webhookRepository } = creaServizio();
    webhookRepository.findActiveByEvento.mockRejectedValueOnce(new Error('db giu'));

    await expect(service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: {} })).resolves.toBeUndefined();
  });

  it('ritenta un 5xx con lo stesso X-Webhook-Delivery-Id, uguale all\'id del payload', async () => {
    fetchFinto
      .mockResolvedValueOnce(new Response('giu', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const { service, tentativi } = creaServizio();

    await service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: {} });
    await vi.waitFor(() => expect(tentativi.create).toHaveBeenCalledTimes(2));

    const [primo, secondo] = fetchFinto.mock.calls.map(([, init]) => init);
    const idPayload = JSON.parse(primo.body).id;
    expect(primo.headers['X-Webhook-Delivery-Id']).toBe(idPayload);
    expect(secondo.headers['X-Webhook-Delivery-Id']).toBe(idPayload);
    expect(primo.headers['X-Webhook-Signature']).toMatch(/^sha256=/);
    expect(statiRegistrati(tentativi)).toEqual([STATO_TENTATIVO_WEBHOOK.RETRY, STATO_TENTATIVO_WEBHOOK.SUCCESSO]);
  });

  it('un 4xx non viene ritentato', async () => {
    fetchFinto.mockResolvedValue(new Response('no', { status: 400 }));
    const { service, tentativi } = creaServizio();

    await service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: {} });
    await vi.waitFor(() => expect(tentativi.create).toHaveBeenCalledOnce());

    expect(fetchFinto).toHaveBeenCalledOnce();
    expect(statiRegistrati(tentativi)).toEqual([STATO_TENTATIVO_WEBHOOK.FALLITO]);
  });

  it('non segue un redirect: tentativo fallito, senza retry', async () => {
    fetchFinto.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }));
    const { service, tentativi } = creaServizio();

    await service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: {} });
    await vi.waitFor(() => expect(tentativi.create).toHaveBeenCalledOnce());

    expect(fetchFinto).toHaveBeenCalledOnce();
    expect(fetchFinto.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(tentativi.create.mock.calls[0][0]).toMatchObject({ stato_tentativo: STATO_TENTATIVO_WEBHOOK.FALLITO, http_status_tentativo: 302 });
  });

  it('un URL che ora risolve in loopback non viene contattato', async () => {
    const { service, tentativi } = creaServizio({ ...WEBHOOK, url_webhook: 'https://rebinding.esempio.it/eventi' });

    await service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: {} });
    await vi.waitFor(() => expect(tentativi.create).toHaveBeenCalledOnce());

    expect(fetchFinto).not.toHaveBeenCalled();
    expect(statiRegistrati(tentativi)).toEqual([STATO_TENTATIVO_WEBHOOK.FALLITO]);
  });

  it('ogni tentativo ha al massimo 30 secondi, anche se il webhook ne chiede di piu\'', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetchFinto.mockResolvedValue(new Response('ok', { status: 200 }));
    const { service, tentativi } = creaServizio({ ...WEBHOOK, timeout_webhook: 300 });

    await service.scatenaEvento({ evento: EVENTI_WEBHOOK.KIT_PUBBLICATO, dati: {} });
    await vi.waitFor(() => expect(tentativi.create).toHaveBeenCalledOnce());

    expect(timeout).toHaveBeenCalledWith(TIMEOUT_MASSIMO_TENTATIVO_MS);
  });
});

describe('timeoutTentativoMs', () => {
  it.each([
    [30, 30_000],
    [10, 10_000],
    [300, 30_000],
    [120_000, 30_000],
    [5_000, 5_000],
    [30_000, 30_000],
    [500, 1_000],
    [undefined, 30_000],
    [0, 30_000],
  ])('timeout_webhook %s -> %s ms', (valore, atteso) => {
    expect(timeoutTentativoMs(valore as number | undefined)).toBe(atteso);
  });
});

describe('WebhookService - URL dei webhook', () => {
  const nuovo = {
    nome_webhook: 'ERP',
    eventi_webhook: [EVENTI_WEBHOOK.KIT_PUBBLICATO],
    timeout_webhook: 30,
    retry_count_webhook: 3,
  };

  it.each([
    ['http://127.0.0.1:5432/'],
    ['http://169.254.169.254/latest/meta-data/'],
    ['http://[::ffff:127.0.0.1]/'],
    ['https://rebinding.esempio.it/eventi'],
    ['file:///etc/passwd'],
  ])('rifiuta in creazione un URL non sicuro: %s', async (url) => {
    const { service, webhookRepository } = creaServizio();

    await expect(service.creaWebhook({ ...nuovo, url_webhook: url }, 'u1')).rejects.toBeInstanceOf(ValidationError);
    expect(webhookRepository.create).not.toHaveBeenCalled();
  });

  it('ammette in creazione un ricevente sulla rete privata', async () => {
    const { service, webhookRepository } = creaServizio();

    await service.creaWebhook({ ...nuovo, url_webhook: 'http://interno.lan:8080/hook' }, 'u1');

    expect(webhookRepository.create).toHaveBeenCalledOnce();
  });

  it('rifiuta in modifica un URL non sicuro', async () => {
    const { service, webhookRepository } = creaServizio();

    await expect(service.aggiornaWebhook('w1', { url_webhook: 'https://rebinding.esempio.it/eventi' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.aggiornaWebhook('w1', { url_webhook: 'http://[fe80::1]/' })).rejects.toBeInstanceOf(ValidationError);
    expect(webhookRepository.update).not.toHaveBeenCalled();
  });
});

describe('WebhookService.testaWebhook', () => {
  it('aspetta l\'esito: un solo tentativo, firmato, e false se il ricevente fallisce', async () => {
    fetchFinto.mockResolvedValue(new Response('giu', { status: 503 }));
    const { service } = creaServizio();

    await expect(service.testaWebhook('w1')).resolves.toBe(false);

    expect(fetchFinto).toHaveBeenCalledOnce();
    expect(fetchFinto.mock.calls[0][1].headers['X-Webhook-Signature']).toMatch(/^sha256=/);
  });

  it('true se il ricevente risponde 2xx', async () => {
    fetchFinto.mockResolvedValue(new Response('ok', { status: 200 }));
    const { service } = creaServizio();

    await expect(service.testaWebhook('w1')).resolves.toBe(true);
  });
});
