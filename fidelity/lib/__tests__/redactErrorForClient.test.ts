import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../errors/application/BadRequestError';
import { GENERIC_ERROR_MESSAGE, redactErrorForClient, serializeError, wrapExternalError } from '../errors/errorUtils';

const sqlError = () => new Error('relation "utenti_segreti" does not exist');

describe('redactErrorForClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('in produzione un errore non applicativo arriva col solo messaggio generico', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const wrapped = wrapExternalError(sqlError(), { message: sqlError().message, httpStatus: 500 });

    const payload = redactErrorForClient(serializeError(wrapped), false);

    expect(payload.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(JSON.stringify(payload)).not.toContain('utenti_segreti');
  });

  it('in produzione un errore applicativo tiene messaggio e dettagli ma non la causa', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = new BadRequestError({ message: 'Campo obbligatorio', details: { field: 'email' }, cause: sqlError() });

    const payload = redactErrorForClient(serializeError(error), true);

    expect(payload.message).toBe('Campo obbligatorio');
    expect(payload.details).toEqual({ field: 'email' });
    expect(JSON.stringify(payload)).not.toContain('utenti_segreti');
  });

  it('fuori produzione il payload resta completo per il debug', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const wrapped = wrapExternalError(sqlError(), { message: sqlError().message, httpStatus: 500 });

    const payload = redactErrorForClient(serializeError(wrapped), false);

    expect(payload.message).toContain('utenti_segreti');
  });
});
