import { describe, expect, it } from 'vitest';
import {
  ACCESSO_SERVIZIO_TTL_MAX_MS,
  createAccessoServizioParams,
  verifyAccessoServizioParams,
} from '../accessoServizioLink';

const SEGRETO = 'segreto-di-test-lungo-almeno-trentadue-caratteri';
const ADESSO = 1_800_000_000_000;

describe('link dell\'accesso di servizio', () => {
  it('un link appena firmato e\' valido', () => {
    const params = createAccessoServizioParams('mario@esempio.it', 'oid-1', SEGRETO, ADESSO);

    expect(verifyAccessoServizioParams({ ...params }, SEGRETO, ADESSO + 1000)).toBe('valid');
  });

  it('cambiare l\'email dopo la firma invalida il link', () => {
    const params = createAccessoServizioParams('mario@esempio.it', '', SEGRETO, ADESSO);

    expect(verifyAccessoServizioParams({ ...params, email: 'admin@esempio.it' }, SEGRETO, ADESSO)).toBe('invalid');
  });

  it('un link firmato con un altro segreto non vale', () => {
    const params = createAccessoServizioParams('mario@esempio.it', '', 'un-altro-segreto-lungo-trentadue-caratteri!', ADESSO);

    expect(verifyAccessoServizioParams({ ...params }, SEGRETO, ADESSO)).toBe('invalid');
  });

  it('dopo la scadenza il link risulta scaduto', () => {
    const params = createAccessoServizioParams('mario@esempio.it', '', SEGRETO, ADESSO);

    expect(verifyAccessoServizioParams({ ...params }, SEGRETO, ADESSO + 6 * 60 * 1000)).toBe('expired');
  });

  it('la durata non supera mai il massimo, anche se richiesta piu\' lunga', () => {
    const params = createAccessoServizioParams('mario@esempio.it', '', SEGRETO, ADESSO, 24 * 60 * 60 * 1000);

    expect(Number(params.exp)).toBe(ADESSO + ACCESSO_SERVIZIO_TTL_MAX_MS);
  });

  it('senza firma, o con parametri ripetuti, il link non vale', () => {
    const params = createAccessoServizioParams('mario@esempio.it', '', SEGRETO, ADESSO);

    expect(verifyAccessoServizioParams({ email: params.email, exp: params.exp }, SEGRETO, ADESSO)).toBe('invalid');
    expect(verifyAccessoServizioParams({ ...params, email: [params.email, 'x@y.it'] }, SEGRETO, ADESSO)).toBe('invalid');
  });
});
