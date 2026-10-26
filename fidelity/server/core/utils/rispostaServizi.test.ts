import { describe, expect, it } from 'vitest';
import { ExternalApiError } from '../../../lib/errors';
import { verificaRisposta } from './rispostaServizi';

// Forme reali delle risposte, come le restituisce ServerUtils.sendToFICOApi
const ok = (data: unknown) => ({ data, status: 200, statusText: 'OK' });
const errore = (status: number | string, data: unknown, statusText = '') => ({ data, status, statusText });

function messaggio(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ExternalApiError);
    return (e as ExternalApiError).message;
  }
  throw new Error('verificaRisposta non ha lanciato');
}

describe('verificaRisposta', () => {
  it('restituisce data se Istanta risponde 2xx con esito positivo', () => {
    const data = { esito: true, errorCode: 0, error: '' };
    expect(verificaRisposta(ok(data), 'ISTANTA', '/ACPV/salvaArea')).toBe(data);
  });

  it('accetta le risposte senza esito, come le liste', () => {
    const data = { lista: [] };
    expect(verificaRisposta(ok(data), 'ISTANTA', '/x')).toBe(data);
  });

  it('esito false con motivo: il motivo arriva all\'operatore', () => {
    const r = errore(400, { esito: false, errorCode: 0, error: 'Area già esistente' });
    expect(messaggio(() => verificaRisposta(r, 'ISTANTA', '/ACPV/salvaArea'))).toBe('Istanta: Area già esistente');
  });

  it('esito false con HTTP 200 e motivo vuoto e comunque un fallimento', () => {
    expect(messaggio(() => verificaRisposta(ok({ esito: false, error: '' }), 'ISTANTA', '/x')))
      .toBe("Istanta non ha confermato l'operazione");
  });

  it('traduce i codici noti di Istanta', () => {
    const r = errore(400, { esito: false, error: 'impiegata_in_tipo_export' });
    expect(messaggio(() => verificaRisposta(r, 'ISTANTA', '/x')))
      .toBe('Istanta: la naming convention è usata da un tipo di export');
  });

  it('i codici noti arrivano al client in details.codice, il testo libero no', () => {
    const conCodice = () => verificaRisposta(ok({ esito: false, error: 'importazioni_esistenti_per_questa_promo' }), 'ISTANTA', '/x');
    const conTesto = () => verificaRisposta(errore(400, { esito: false, error: 'Area già esistente' }), 'ISTANTA', '/x');
    const dettagli = (fn: () => unknown) => {
      try { fn(); } catch (e) { return (e as ExternalApiError).details; }
    };

    expect(dettagli(conCodice)).toMatchObject({ codice: 'importazioni_esistenti_per_questa_promo' });
    expect(messaggio(conCodice)).toBe('Istanta: la promo ha delle importazioni collegate');
    expect(dettagli(conTesto)).not.toHaveProperty('codice');
  });

  it.each([
    [{ esito: false, errorCode: 0, error: 'no_login' }],
    [{ login: false, error: 'no_login_byolympus' }],
    [{ login: false, error: 'no_login public token empty' }],
  ])('no_login: utente non riconosciuto (%o)', (corpo) => {
    expect(messaggio(() => verificaRisposta(errore(401, corpo), 'ISTANTA', '/x')))
      .toBe("Istanta non ha riconosciuto l'utente");
  });

  it('no_login:<stack> e un errore interno e non mostra lo stack', () => {
    const corpo = { login: false, error: 'no_login:System.NullReferenceException: Object reference\n   at Istanta.X()' };
    const m = messaggio(() => verificaRisposta(errore(400, corpo), 'ISTANTA', '/x'));
    expect(m).toBe('Errore interno di Istanta');
  });

  it('ex.ToString(): solo la prima riga, senza stack', () => {
    const corpo = { esito: false, error: 'System.Exception: Formato non trovato\r\n   at Istanta.Y() in C:\\src\\Y.cs:line 12' };
    expect(messaggio(() => verificaRisposta(errore(400, corpo), 'ISTANTA', '/x')))
      .toBe('Istanta: System.Exception: Formato non trovato');
  });

  it('404 a corpo vuoto: funzione non disponibile', () => {
    expect(messaggio(() => verificaRisposta(errore(404, null, ''), 'ISTANTA', '/ACPV/modificaPV')))
      .toBe('Istanta non espone la funzione richiesta (/ACPV/modificaPV)');
  });

  it('nessuna risposta HTTP: servizio non contattabile, senza indirizzi del server', () => {
    const r = errore(0, null, 'request to http://10.0.0.5:5000/x failed, reason: connect ECONNREFUSED');
    const m = messaggio(() => verificaRisposta(r, 'ISTANTA', '/x'));
    expect(m).toBe('Impossibile contattare Istanta');
    expect(m).not.toContain('10.0.0.5');
  });

  it('pagina HTML di errore: solo lo stato HTTP', () => {
    const r = errore(500, null, '<!DOCTYPE html><html>Error</html>');
    expect(messaggio(() => verificaRisposta(r, 'ISTANTA', '/x'))).toBe('Istanta ha risposto con un errore (HTTP 500)');
  });

  it('Correggo: result error con errorDetails, tramite controllo personalizzato', () => {
    const r = ok({ result: 'error', errorDetails: 'Il pacchetto non ha un titolo', error_detail: 'Il pacchetto non ha un titolo' });
    const m = messaggio(() => verificaRisposta(r, 'CORREGGO', '/UploadVolFromFP.ashx', (d) => d?.result === 'ok'));
    expect(m).toBe('Correggo: Il pacchetto non ha un titolo');
  });

  it('il testo grezzo resta nella cause e i dettagli indicano servizio e stato reale', () => {
    expect.assertions(3);
    try {
      verificaRisposta(errore(401, { esito: false, error: 'no_login' }), 'ISTANTA', '/FicoProcess/x');
    } catch (e) {
      const err = e as ExternalApiError;
      expect(err.httpStatus).toBe(502);
      expect(err.details).toMatchObject({ service: 'ISTANTA', endpoint: '/FicoProcess/x', statusCode: 401 });
      expect((err.cause as Error).message).toBe('no_login');
    }
  });
});
