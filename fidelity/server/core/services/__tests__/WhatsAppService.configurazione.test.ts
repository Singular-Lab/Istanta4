import { UniqueConstraintError } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_WHATSAPP, STATO_GDO_WHATSAPP_NUMBER, STATO_GDO_WHATSAPP_TEMPLATE } from '../../../../lib/enums';

const meta = vi.hoisted(() => ({ fetch: vi.fn() }));

// Le chiamate a Meta passano dal client HTTP comune: si intercetta quello, ErroreHttp resta reale
vi.mock('../../http/clienteHttp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../http/clienteHttp')>()),
  chiamaHttp: meta.fetch,
}));
vi.mock('../../../src/shared/queue/bullmq.client.js', () => ({ createQueue: () => ({ add: vi.fn() }) }));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ErroreHttp } from '../../http/clienteHttp';
import { GDO } from '../../models';
import { GDOWhatsappNumbers } from '../../models/whatsapp/gdo_whatsapp_numbers';
import { GDOWhatsappPreset } from '../../models/whatsapp/gdo_whatsapp_preset';
import { GDOWhatsappTemplate } from '../../models/whatsapp/gdo_whatsapp_template';
import { WhatsAppService } from '../WhatsAppService';

const service = () => new WhatsAppService({} as any);

// Token palesemente finti: nessuna credenziale reale nei test
const canale = (extra: Record<string, unknown> = {}) => ({
  id_gdowhatsappnumbers: 'n1',
  id_gdo_gdowhatsappnumbers: 'gdo-a',
  id_numero_whatsapp_gdowhatsappnumbers: 'phone-id-finto',
  display_name_gdowhatsappnumbers: 'Negozio',
  stato_gdowhatsappnumbers: STATO_GDO_WHATSAPP_NUMBER.PENDING,
  provider_gdowhatsappnumbers: PROVIDER_WHATSAPP.META,
  whatsapp_business_account_id_gdowhatsappnumbers: 'waba-finto',
  access_token_gdowhatsappnumbers: 'access-token-finto',
  verify_token_gdowhatsappnumbers: 'verify-token-finto',
  update: vi.fn(),
  ...extra,
});

const setup = (extra: Record<string, unknown> = {}) => ({
  id_gdo: 'gdo-a',
  display_name: 'Negozio',
  id_numero_whatsapp: 'phone-id-finto',
  whatsapp_business_account_id: 'waba-finto',
  stato: STATO_GDO_WHATSAPP_NUMBER.VERIFIED,
  access_token: '',
  verify_token: '',
  ...extra,
});

const bozza = (extra: Record<string, unknown> = {}) => ({
  name: 'promo_autunno',
  language: { code: 'it', policy: 'deterministic' },
  category: 'MARKETING',
  components: [{ type: 'BODY', text: 'Ciao {{1}}', example: { body_text: [['Mario']] } }],
  ...extra,
});

afterEach(() => {
  vi.restoreAllMocks();
  meta.fetch.mockReset();
});

describe('lettura del canale WhatsApp', () => {
  it('i token non arrivano al browser: solo se sono configurati', async () => {
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale({ verify_token_gdowhatsappnumbers: '' }) as any);
    vi.spyOn(GDO, 'findOne').mockResolvedValue({ nome_gdo: 'GDO A' } as any);

    const configurazione = await service().getGDOWhatsappById('gdo-a');

    expect(configurazione).toMatchObject({ access_token_configurato: true, verify_token_configurato: false, nome: 'GDO A' });
    expect(configurazione).not.toHaveProperty('access_token');
    expect(configurazione).not.toHaveProperty('verify_token');
    expect(JSON.stringify(configurazione)).not.toContain('access-token-finto');
  });
});

describe('setup del canale WhatsApp', () => {
  it('un token lasciato vuoto mantiene quello salvato', async () => {
    const esistente = canale();
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(esistente as any);

    const esito = await service().salvaSetupGDOWhatsapp(setup());

    const valori = esistente.update.mock.calls[0][0];
    expect(valori).not.toHaveProperty('access_token_gdowhatsappnumbers');
    expect(valori).not.toHaveProperty('verify_token_gdowhatsappnumbers');
    expect(valori.stato_gdowhatsappnumbers).toBe(STATO_GDO_WHATSAPP_NUMBER.VERIFIED);
    expect(esito).toEqual({ success: true, creato: false, campiModificati: ['stato'] });
  });

  it('un token nuovo sostituisce quello salvato e figura fra i campi cambiati', async () => {
    const esistente = canale();
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(esistente as any);

    const esito = await service().salvaSetupGDOWhatsapp(setup({ stato: STATO_GDO_WHATSAPP_NUMBER.PENDING, access_token: ' nuovo-token-finto ' }));

    expect(esistente.update.mock.calls[0][0].access_token_gdowhatsappnumbers).toBe('nuovo-token-finto');
    expect(esito.campiModificati).toEqual(['access_token']);
  });

  it('un canale nuovo senza token viene rifiutato', async () => {
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(null);
    const crea = vi.spyOn(GDOWhatsappNumbers, 'create');

    await expect(service().salvaSetupGDOWhatsapp(setup({ access_token: 'access-token-finto' }))).rejects.toMatchObject({
      httpStatus: 400,
      message: 'Per configurare il canale servono access token e verify token',
    });
    expect(crea).not.toHaveBeenCalled();
  });

  it('un canale nuovo con i token si crea con provider Meta', async () => {
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(null);
    const crea = vi.spyOn(GDOWhatsappNumbers, 'create').mockResolvedValue({} as any);

    const esito = await service().salvaSetupGDOWhatsapp(setup({ access_token: 'access-token-finto', verify_token: 'verify-token-finto' }));

    expect(crea).toHaveBeenCalledWith(expect.objectContaining({
      id_gdo_gdowhatsappnumbers: 'gdo-a',
      provider_gdowhatsappnumbers: PROVIDER_WHATSAPP.META,
      display_name_gdowhatsappnumbers: 'Negozio',
      access_token_gdowhatsappnumbers: 'access-token-finto',
    }));
    expect(esito.creato).toBe(true);
  });

  it('uno stato sconosciuto o un campo obbligatorio vuoto vengono rifiutati prima di toccare il database', async () => {
    const cerca = vi.spyOn(GDOWhatsappNumbers, 'findOne');

    await expect(service().salvaSetupGDOWhatsapp(setup({ stato: 'ATTIVO' }))).rejects.toMatchObject({ httpStatus: 400 });
    await expect(service().salvaSetupGDOWhatsapp(setup({ display_name: '  ' }))).rejects.toMatchObject({ httpStatus: 400 });
    expect(cerca).not.toHaveBeenCalled();
  });

  it('una GDO inesistente risponde non trovata', async () => {
    vi.spyOn(GDO, 'findByPk').mockResolvedValue(null);

    await expect(service().salvaSetupGDOWhatsapp(setup())).rejects.toMatchObject({ httpStatus: 404 });
  });

  it("numero o WABA già usati da un'altra GDO danno un motivo comprensibile", async () => {
    const esistente = canale({ update: vi.fn().mockRejectedValue(new UniqueConstraintError({ message: 'duplicate key' } as any)) });
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(esistente as any);

    await expect(service().salvaSetupGDOWhatsapp(setup())).rejects.toMatchObject({
      message: expect.stringContaining("già usati da un'altra GDO"),
    });
  });
});

describe('creazione di un modello', () => {
  it('si salva come bozza locale con nome, lingua e categoria del modello', async () => {
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    vi.spyOn(GDOWhatsappTemplate, 'findOne').mockResolvedValue(null);
    const crea = vi.spyOn(GDOWhatsappTemplate, 'create').mockResolvedValue({ id_gdowhatsapptemplate: 't-nuovo' } as any);

    const esito = await service().creaTemplateLocale('gdo-a', bozza({ id: 'id-meta-iniettato' }));

    expect(esito).toEqual({ success: true, newTemplateId: 't-nuovo' });
    const valori = crea.mock.calls[0][0] as any;
    expect(valori).toMatchObject({
      id_gdo_gdowhatsapptemplate: 'gdo-a',
      nome_template_gdowhatsapptemplate: 'promo_autunno',
      lingua_template_gdowhatsapptemplate: 'it',
      categoria_template_gdowhatsapptemplate: 'MARKETING',
      stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE.CREATED_BUT_NOT_SYNCED,
    });
    // Un id di Meta farebbe sembrare il modello già inviato
    expect(valori.json_meta_gdowhatsapptemplate).not.toHaveProperty('id');
  });

  it.each(['Promo Autunno', 'promo-autunno', ''])('il nome "%s" viene rifiutato senza creare nulla', async (nome) => {
    const crea = vi.spyOn(GDOWhatsappTemplate, 'create');

    await expect(service().creaTemplateLocale('gdo-a', bozza({ name: nome }))).rejects.toMatchObject({
      httpStatus: 400,
      message: expect.stringContaining('Nome non valido'),
    });
    expect(crea).not.toHaveBeenCalled();
  });

  it('un nome già usato dalla GDO nella stessa lingua viene rifiutato', async () => {
    vi.spyOn(GDO, 'findByPk').mockResolvedValue({ id_gdo: 'gdo-a' } as any);
    const cerca = vi.spyOn(GDOWhatsappTemplate, 'findOne').mockResolvedValue({ id_gdowhatsapptemplate: 't1' } as any);
    const crea = vi.spyOn(GDOWhatsappTemplate, 'create');

    await expect(service().creaTemplateLocale('gdo-a', bozza())).rejects.toMatchObject({
      message: 'Esiste già un template "promo_autunno" in questa lingua (it)',
    });
    expect((cerca.mock.calls[0][0] as any).where).toMatchObject({
      id_gdo_gdowhatsapptemplate: 'gdo-a',
      nome_template_gdowhatsapptemplate: 'promo_autunno',
      lingua_template_gdowhatsapptemplate: 'it',
    });
    expect(crea).not.toHaveBeenCalled();
  });

  it('senza corpo del messaggio o con categoria sconosciuta viene rifiutato', async () => {
    await expect(service().creaTemplateLocale('gdo-a', bozza({ components: [] }))).rejects.toMatchObject({ httpStatus: 400 });
    await expect(service().creaTemplateLocale('gdo-a', bozza({ category: 'PROMO' }))).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe('invio di un modello a Meta', () => {
  const modello = () => ({
    id_gdowhatsapptemplate: 't1',
    id_gdo_gdowhatsapptemplate: 'gdo-a',
    json_meta_gdowhatsapptemplate: bozza(),
    update: vi.fn(),
  });

  it('restituisce lo stato reale assegnato da Meta', async () => {
    const t = modello();
    vi.spyOn(GDOWhatsappTemplate, 'findOne').mockResolvedValue(t as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale() as any);
    meta.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'hsm-1', status: 'PENDING' }) });

    const esito = await service().sendModifiedTemplateToMeta('t1');

    expect(esito).toEqual({ success: true, stato: STATO_GDO_WHATSAPP_TEMPLATE.PENDING });
    expect(t.update).toHaveBeenCalledWith(expect.objectContaining({ stato_meta_gdowhatsapptemplate: 'PENDING' }));
  });

  it('se Meta rifiuta riporta il suo motivo e il modello resta invariato', async () => {
    const t = modello();
    vi.spyOn(GDOWhatsappTemplate, 'findOne').mockResolvedValue(t as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale() as any);
    meta.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Invalid parameter', error_user_msg: 'Il nome del modello esiste già in questa lingua' } }),
    });

    await expect(service().sendModifiedTemplateToMeta('t1')).rejects.toMatchObject({
      message: 'Errore API Meta: Invalid parameter – Il nome del modello esiste già in questa lingua',
    });
    expect(t.update).not.toHaveBeenCalled();
  });

  it('la creazione su Meta ha un tempo massimo e non viene mai ripetuta in automatico', async () => {
    vi.spyOn(GDOWhatsappTemplate, 'findOne').mockResolvedValue(modello() as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale() as any);
    meta.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'hsm-1', status: 'PENDING' }) });

    await service().sendModifiedTemplateToMeta('t1');

    const [url, opzioni] = meta.fetch.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v24.0/waba-finto/message_templates');
    expect(opzioni).toMatchObject({ method: 'POST', timeoutMs: 15_000, idempotente: false });
  });

  it('se Meta non risponde in tempo avvisa di verificare l\'esito, senza riportare il token', async () => {
    const t = modello();
    vi.spyOn(GDOWhatsappTemplate, 'findOne').mockResolvedValue(t as any);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale() as any);
    meta.fetch.mockRejectedValue(new ErroreHttp('timeout', 'https://graph.facebook.com/v24.0/waba-finto/message_templates', false));

    const errore = await service().sendModifiedTemplateToMeta('t1').catch((e) => e);

    expect(errore.httpStatus).toBe(503);
    expect(errore.message).toContain('verifica l\'esito prima di riprovare');
    expect(JSON.stringify(errore.toJSON())).not.toContain('access-token-finto');
    expect(t.update).not.toHaveBeenCalled();
  });
});

describe('sincronizzazione dei modelli da Meta', () => {
  it('legge tutte le pagine, ognuna con un tempo massimo e ritentabile perche\' e\' una lettura', async () => {
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale() as any);
    vi.spyOn(GDOWhatsappTemplate, 'findAll').mockResolvedValue([] as any);
    meta.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], paging: { next: 'https://graph.facebook.com/v24.0/waba-finto/message_templates?after=x' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const esito = await service().syncTemplatesFromMeta('gdo-a');

    expect(esito).toEqual({ success: true });
    expect(meta.fetch).toHaveBeenCalledTimes(2);
    expect(meta.fetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v24.0/waba-finto/message_templates?limit=100');
    for (const [, opzioni] of meta.fetch.mock.calls) {
      expect(opzioni).toMatchObject({ method: 'GET', timeoutMs: 15_000, idempotente: true });
    }
  });
});

describe('messaggio di prova a un utente', () => {
  const preparaInvio = () => {
    const s = new WhatsAppService({ getUserById: vi.fn().mockResolvedValue({ nome: 'Mario', telefono: '393330000000' }) } as any);
    vi.spyOn(s, 'getWhatsappTemplateById').mockResolvedValue({
      id_gdo_gdowhatsapptemplate: 'gdo-a',
      nome_template_gdowhatsapptemplate: 'promo_autunno',
      json_meta_gdowhatsapptemplate: bozza(),
    } as any);
    vi.spyOn(s, 'mapPresetToTemplateParams').mockReturnValue([] as any);
    vi.spyOn(s, 'buildMetaTemplatePayload').mockReturnValue({ messaging_product: 'whatsapp' } as any);
    vi.spyOn(GDOWhatsappPreset, 'findOne').mockResolvedValue(null);
    vi.spyOn(GDOWhatsappNumbers, 'findOne').mockResolvedValue(canale() as any);
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    return s;
  };

  it('parte una sola volta con un tempo massimo', async () => {
    const s = preparaInvio();
    meta.fetch.mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });

    await expect(s.invioDiTestAdUtente('u1', 't1')).resolves.toEqual({ success: true, error: undefined });

    const [url, opzioni] = meta.fetch.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v24.0/phone-id-finto/messages');
    expect(opzioni).toMatchObject({ method: 'POST', timeoutMs: 15_000, idempotente: false });
  });

  it('senza risposta dopo l\'invio l\'esito e\' sconosciuto: si avvisa di controllare prima di riprovare', async () => {
    const s = preparaInvio();
    meta.fetch.mockRejectedValue(new ErroreHttp('timeout', 'https://graph.facebook.com/v24.0/phone-id-finto/messages', false));

    const esito = await s.invioDiTestAdUtente('u1', 't1');

    expect(esito.success).toBe(false);
    expect(esito.error).toContain('esito sconosciuto');
    expect(meta.fetch).toHaveBeenCalledTimes(1);
  });
});
