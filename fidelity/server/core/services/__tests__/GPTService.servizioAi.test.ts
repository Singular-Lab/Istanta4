import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIPO_RICETTA } from '../../../../lib/types';

const http = vi.hoisted(() => ({ chiamaHttp: vi.fn() }));

// Il servizio AI passa dal client HTTP comune: si intercetta quello, ErroreHttp resta reale
vi.mock('../../http/clienteHttp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../http/clienteHttp')>()),
  chiamaHttp: http.chiamaHttp,
}));
// Indirizzo e tempo massimo del servizio AI vengono dalla configurazione
vi.mock('../../config', async (importOriginal) => {
  const reale = (await importOriginal<typeof import('../../config')>()).default;
  return {
    default: {
      ...reale,
      API_KEY_AI: 'chiave-ai-finta',
      AI_RICETTE_API_URL: 'https://ai.test/ricette/endpoint-api.php',
      AI_RICETTE_TIMEOUT_MS: 1234,
    },
  };
});
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../ws-server', () => ({ emitToClients: vi.fn() }));

import { ErroreHttp } from '../../http/clienteHttp';
import { ApprofondimentoVino } from '../../models/approfondimento_vino';
import { Ricette } from '../../models/ricette';
import { ServerUtils } from '../../utils/ServerUtils';
import { GPTService, scaricaImmagineGenerata } from '../GPTService';

const CHIAVE = 'chiave-ai-finta';
const service = () => new GPTService({} as any);

const rispostaJson = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

const datiVino = { cantina: 'Cantina', nome: 'Rosso', codice: 'V1', anno: 2020 };

afterEach(() => {
  http.chiamaHttp.mockReset();
});

describe('chiamate al servizio AI delle ricette', () => {
  it('usano l\'indirizzo e il tempo massimo della configurazione, senza ripetere la chiamata', async () => {
    http.chiamaHttp.mockResolvedValueOnce(rispostaJson(200, { success: true, risposta: { descrizione: 'ok' } }));
    vi.spyOn(ApprofondimentoVino, 'create').mockResolvedValue({ id: 'a1' } as any);

    await service().createApprofondimentoVino(datiVino);

    expect(http.chiamaHttp).toHaveBeenCalledTimes(1);
    const [url, opzioni] = http.chiamaHttp.mock.calls[0];
    expect(url).toBe('https://ai.test/ricette/endpoint-api.php?azione=approfondimentoVinoNoDb');
    expect(opzioni).toMatchObject({ method: 'POST', timeoutMs: 1234, idempotente: false });
    expect(JSON.parse(opzioni.body)).toMatchObject({ apiKey: CHIAVE, dati_vino: { cantina: 'Cantina', nome: 'Rosso', anno: 2020 } });
  });

  it('un errore HTTP diventa ExternalApiError con solo stato e motivo, senza la chiave', async () => {
    http.chiamaHttp.mockResolvedValueOnce(rispostaJson(500, { message: 'quota esaurita' }));

    const errore = await service().createApprofondimentoVino(datiVino).catch((e) => e);

    expect(errore.name).toBe('ExternalApiError');
    expect(errore.httpStatus).toBe(502);
    expect(errore.details.statusCode).toBe(500);
    expect(errore.message).toContain('HTTP 500');
    expect(errore.message).toContain('quota esaurita');
    expect(JSON.stringify(errore.toJSON())).not.toContain(CHIAVE);
  });

  it('success false del servizio e\' un errore del servizio, non del database', async () => {
    http.chiamaHttp.mockResolvedValueOnce(rispostaJson(200, { success: false, message: 'vino sconosciuto' }));
    const crea = vi.spyOn(ApprofondimentoVino, 'create');

    const errore = await service().createApprofondimentoVino(datiVino).catch((e) => e);

    expect(errore.name).toBe('ExternalApiError');
    expect(errore.message).toContain('vino sconosciuto');
    expect(crea).not.toHaveBeenCalled();
  });

  it('se il servizio non risponde in tempo: servizio non disponibile, senza dettagli della richiesta', async () => {
    http.chiamaHttp.mockRejectedValueOnce(new ErroreHttp('timeout', 'https://ai.test/ricette/endpoint-api.php', false));

    const errore = await service().generaRicetta({ apiKey: CHIAVE, indicazioni: 'veloce', prodottiInOfferta: [] }).catch((e) => e);

    expect(errore.name).toBe('ServiceUnavailableError');
    expect(errore.httpStatus).toBe(503);
    expect(errore.message).toContain('non ha risposto in tempo');
    const serializzato = JSON.stringify(errore.toJSON());
    expect(serializzato).not.toContain(CHIAVE);
    expect(serializzato).not.toContain('Authorization');
  });
});

describe('download dell\'immagine generata', () => {
  it('accetta solo indirizzi https e non chiama nulla altrimenti', async () => {
    await expect(scaricaImmagineGenerata('http://img.test/foto.jpg')).rejects.toMatchObject({ name: 'ExternalApiError' });
    await expect(scaricaImmagineGenerata(undefined)).rejects.toMatchObject({ name: 'ExternalApiError' });
    expect(http.chiamaHttp).not.toHaveBeenCalled();
  });

  it('scarica con tempo massimo di 30 secondi e un solo nuovo tentativo', async () => {
    http.chiamaHttp.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const immagine = await scaricaImmagineGenerata('https://img.test/foto.jpg');

    expect([...immagine]).toEqual([1, 2, 3]);
    expect(http.chiamaHttp.mock.calls[0][1]).toMatchObject({ method: 'GET', timeoutMs: 30_000, idempotente: true, tentativi: 2 });
  });

  it('rifiuta un\'immagine dichiarata oltre i 10 MB senza leggerla', async () => {
    http.chiamaHttp.mockResolvedValueOnce(new Response('x', { status: 200, headers: { 'content-length': String(20 * 1024 * 1024) } }));

    await expect(scaricaImmagineGenerata('https://img.test/grande.jpg')).rejects.toMatchObject({
      message: expect.stringContaining('10 MB'),
    });
  });

  it('smette di leggere oltre i 10 MB anche senza Content-Length', async () => {
    let blocchiLetti = 0;
    const flussoSenzaFine = new ReadableStream<Uint8Array>({
      pull(controller) {
        blocchiLetti++;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    http.chiamaHttp.mockResolvedValueOnce(new Response(flussoSenzaFine, { status: 200 }));

    await expect(scaricaImmagineGenerata('https://img.test/infinita.jpg')).rejects.toMatchObject({
      message: expect.stringContaining('10 MB'),
    });
    expect(blocchiLetti).toBeLessThan(15);
  });
});

describe('salvataggio su Olimpo della foto generata', () => {
  it('un upload non riuscito si ferma con un errore chiaro e la ricetta resta invariata', async () => {
    vi.spyOn(Ricette, 'findOne').mockResolvedValue({ id: 'r1', titolo: 'Pasta', tipo: TIPO_RICETTA.LUNGA, ingredienti: [], foto_ricetta: [] } as any);
    const aggiorna = vi.spyOn(Ricette, 'update').mockResolvedValue([1] as any);
    http.chiamaHttp
      .mockResolvedValueOnce(rispostaJson(200, { success: true, url: 'https://img.test/foto.jpg', prompt: 'piatto' }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ status: 0, data: null, statusText: 'non raggiungibile', headers: new Headers() } as any);

    await expect(service().generaFotoRicetta({ apiKey: CHIAVE, id: 'r1' }, {} as any)).rejects.toMatchObject({
      name: 'ExternalApiError',
      message: 'Impossibile contattare Olimpo per salvare la foto della ricetta',
    });
    expect(aggiorna).not.toHaveBeenCalled();
  });
});
