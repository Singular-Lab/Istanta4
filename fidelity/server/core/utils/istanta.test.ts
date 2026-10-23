import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalApiError } from '../../../lib/errors';
import { HEADER_DISSINCRONIA, scriviSuIstanta, TIMEOUT_SVILUPPO_MS } from './istanta';
import { ServerUtils } from './ServerUtils';

vi.mock('../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// In development Istanta irraggiungibile non blocca le scritture: restano solo in FP, con un avviso

const NESSUNA_RISPOSTA = { data: null, status: 0, statusText: 'fetch failed' };
const RIFIUTO = { data: { esito: false, error: 'Sigla già usata' }, status: 400 };
const OK = { data: { esito: true, error: '' }, status: 200 };

function richiesta() {
  const setHeader = vi.fn();
  return { req: { res: { headersSent: false, setHeader } } as any, setHeader };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scriviSuIstanta', () => {
  it('development, Istanta non risponde: prosegue e segnala la dissincronia con l\'header', async () => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(NESSUNA_RISPOSTA as any);
    const { req, setHeader } = richiesta();

    await expect(scriviSuIstanta(req, '/ACPV/eliminaArea/a1', 'DELETE', undefined, 'development')).resolves.toEqual({ sincronizzato: false });
    expect(setHeader).toHaveBeenCalledWith(HEADER_DISSINCRONIA, '/ACPV/eliminaArea');
  });

  it('development, Istanta rifiuta: errore come sempre', async () => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(RIFIUTO as any);
    const { req, setHeader } = richiesta();

    await expect(scriviSuIstanta(req, '/ACPV/salvaArea', 'PUT', {}, 'development')).rejects.toBeInstanceOf(ExternalApiError);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it.each(['production', 'test'])('%s, Istanta non risponde: errore e nessuna scrittura', async ambiente => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(NESSUNA_RISPOSTA as any);
    const { req } = richiesta();

    await expect(scriviSuIstanta(req, '/ACPV/salvaPV', 'PUT', {}, ambiente)).rejects.toThrow('Impossibile contattare Istanta');
  });

  it('Istanta accetta: sincronizzato, senza header', async () => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(OK as any);
    const { req, setHeader } = richiesta();

    await expect(scriviSuIstanta(req, '/ACPV/salvaPV', 'PUT', {}, 'development')).resolves.toEqual({ sincronizzato: true });
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('il timeout breve vale solo in development', async () => {
    const invio = vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(OK as any);
    const { req } = richiesta();

    await scriviSuIstanta(req, '/ACPV/salvaPV', 'PUT', {}, 'development');
    await scriviSuIstanta(req, '/ACPV/salvaPV', 'PUT', {}, 'production');

    expect(invio.mock.calls[0][5]).toBe(TIMEOUT_SVILUPPO_MS);
    expect(invio.mock.calls[1][5]).toBeUndefined();
  });

  it('a risposta gia inviata (import in background) non tocca gli header', async () => {
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(NESSUNA_RISPOSTA as any);
    const setHeader = vi.fn();

    await scriviSuIstanta({ res: { headersSent: true, setHeader } } as any, '/ACPV/salvaPV', 'PUT', {}, 'development');

    expect(setHeader).not.toHaveBeenCalled();
  });
});
