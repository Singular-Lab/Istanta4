import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalApiError } from '../../../lib/errors';

vi.mock('../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { svuotaCachePassaporti } from '../http/cachePassaporti';
import { Utente } from '../models/utenti';
import { verificaRisposta } from './rispostaServizi';
import { ServerUtils } from './ServerUtils';

// Olimpo e Istanta finti dietro il fetch globale usato dal client HTTP comune
const fetchFinto = vi.fn();
vi.stubGlobal('fetch', fetchFinto);

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
const NO_LOGIN = { esito: false, errorCode: 0, error: 'no_login' };
const URL_ISTANTA = 'http://127.0.0.1:5000/FicoProcess/getFormContext/1';

let chiaviRilasciate: string[];
let risposteIstanta: Array<{ status: number; corpo: unknown }>;
const chiamate = (percorso: string) => fetchFinto.mock.calls.filter(([url]) => String(url).includes(percorso));
const authorizationIstanta = (indice: number) =>
  new Headers((chiamate('/FicoProcess/')[indice][1] as RequestInit).headers).get('authorization');

function richiesta() {
  return { session: { id_utente: 'u1', private_key: 'chiave-privata' }, headers: {} } as any;
}

beforeEach(() => {
  chiaviRilasciate = ['pk-1', 'pk-2', 'pk-3'];
  risposteIstanta = [];
  vi.spyOn(Utente, 'findByPk').mockResolvedValue({
    id_utenti: 'u1', outsider_utenti: false, privatekey_utenti: 'chiave-privata', email_utenti: 'mario@esempio.it',
    tipo_utenti: 'ADMIN', meta_utenti: {}, save: vi.fn(),
  } as any);
  fetchFinto.mockImplementation(async (url: string) => {
    if (url.includes('/auth/getPassport')) {
      // Olimpo lento quanto basta perche le chiamate contemporanee si sovrappongano
      await new Promise(resolve => setTimeout(resolve, 10));
      return json(200, { esito: true, publicKey: chiaviRilasciate.shift(), privateKey: 'chiave-privata' });
    }
    const prossima = risposteIstanta.shift() ?? { status: 200, corpo: { esito: true, content: '[]' } };
    return json(prossima.status, prossima.corpo);
  });
});

afterEach(() => {
  fetchFinto.mockReset();
  svuotaCachePassaporti();
});

describe('passaporto Olimpo in cache', () => {
  it('chiamate contemporanee dello stesso utente: un solo passaporto richiesto a Olimpo', async () => {
    const esiti = await Promise.all(Array.from({ length: 5 }, () =>
      ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined, undefined, undefined, { categoria: 'lettura', idempotente: true })
    ));

    expect(esiti.every(r => r.status === 200)).toBe(true);
    expect(chiamate('/auth/getPassport')).toHaveLength(1);
    expect(Utente.findByPk).toHaveBeenCalledTimes(1);
    expect(chiamate('/FicoProcess/')).toHaveLength(5);
    expect(authorizationIstanta(4)).toBe('Bearer pk-1');
  });

  it('chiamate successive riusano il passaporto', async () => {
    await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined);
    await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined);

    expect(chiamate('/auth/getPassport')).toHaveLength(1);
    expect(authorizationIstanta(1)).toBe('Bearer pk-1');
  });

  it('un passaporto non rilasciato non resta in cache: la chiamata dopo lo richiede di nuovo', async () => {
    fetchFinto.mockImplementationOnce(async () => json(200, { esito: false, error: 'Olimpo occupato', publicKey: '' }));

    const prima = await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined);
    const seconda = await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined);

    expect(prima.status).toBe(0);
    expect(prima.motivo).toBe('passaporto');
    expect(seconda.status).toBe(200);
    expect(chiamate('/auth/getPassport')).toHaveLength(2);
  });
});

describe('Istanta non riconosce piu il passaporto (401 no_login)', () => {
  it('lettura idempotente: passaporto scartato e un solo nuovo tentativo con un passaporto nuovo', async () => {
    risposteIstanta = [{ status: 401, corpo: NO_LOGIN }, { status: 200, corpo: { esito: true, content: '[]' } }];

    const r = await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined, undefined, undefined, { categoria: 'lettura', idempotente: true });

    expect(r.status).toBe(200);
    expect(chiamate('/auth/getPassport')).toHaveLength(2);
    expect(chiamate('/FicoProcess/')).toHaveLength(2);
    expect(authorizationIstanta(0)).toBe('Bearer pk-1');
    expect(authorizationIstanta(1)).toBe('Bearer pk-2');
  });

  it('lettura idempotente rifiutata di nuovo: si ferma al secondo tentativo', async () => {
    risposteIstanta = [{ status: 401, corpo: NO_LOGIN }, { status: 401, corpo: { login: false, error: 'no_login_byolympus' } }];

    const r = await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined, undefined, undefined, { categoria: 'lettura', idempotente: true });

    expect(r.status).toBe(401);
    expect(chiamate('/FicoProcess/')).toHaveLength(2);
  });

  it('scrittura: nessun nuovo tentativo, l\'operatore vede utente non riconosciuto, il passaporto e scartato', async () => {
    risposteIstanta = [{ status: 401, corpo: { login: false, error: 'no_login public token empty' } }];

    const r = await ServerUtils.sendToFICOApi(richiesta(), 'http://127.0.0.1:5000/FicoProcess/aggiornaPromo', 'PUT', { a: 1 }, undefined, undefined, { categoria: 'scrittura' });

    expect(r.status).toBe(401);
    expect(chiamate('/FicoProcess/')).toHaveLength(1);
    let errore: unknown;
    try { verificaRisposta(r, 'ISTANTA', '/FicoProcess/aggiornaPromo'); } catch (e) { errore = e; }
    expect(errore).toBeInstanceOf(ExternalApiError);
    expect((errore as ExternalApiError).message).toBe("Istanta non ha riconosciuto l'utente");

    // La chiamata successiva chiede un passaporto nuovo
    await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined);
    expect(chiamate('/auth/getPassport')).toHaveLength(2);
    expect(authorizationIstanta(1)).toBe('Bearer pk-2');
  });

  it('no_login: seguito dallo stack e un\'eccezione di Istanta: il passaporto resta valido', async () => {
    risposteIstanta = [{ status: 400, corpo: { login: false, error: 'no_login:System.Exception: errore\n   at Istanta.X()' } }];

    await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined, undefined, undefined, { categoria: 'lettura', idempotente: true });
    await ServerUtils.sendToFICOApi(richiesta(), URL_ISTANTA, 'GET', undefined);

    expect(chiamate('/auth/getPassport')).toHaveLength(1);
    expect(chiamate('/FicoProcess/')).toHaveLength(2);
  });
});
