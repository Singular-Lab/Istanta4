import { describe, expect, it } from 'vitest';
import { formattaRiga } from '../index';

// Il JSON in coda alla riga era illeggibile: i campi diventano chiave=valore

const base = { level: 20, time: '2026-10-14T13:13:38.237Z', service: 'fidelity-service' };

describe('formattaRiga', () => {
  it('scrive i campi come chiave=valore, senza servizio ne contesto predefinito', () => {
    expect(formattaRiga({
      ...base,
      context: 'Application',
      msg: 'Socket UI iscritto agli aggiornamenti del punto vendita',
      socketId: 'LI5LDNVu50uN64E-AAAA',
      pvId: '626a253c-5589-41b6-90ce-e141daf63341',
    })).toBe('Socket UI iscritto agli aggiornamenti del punto vendita · socketId=LI5LDNVu50uN64E-AAAA pvId=626a253c-5589-41b6-90ce-e141daf63341');
  });

  it('un contesto diverso da quello predefinito resta in testa alla riga', () => {
    expect(formattaRiga({ ...base, context: 'Auth', msg: 'User login', userId: 'u1' })).toBe('[Auth] User login · userId=u1');
  });

  it('virgolette sulle stringhe con spazi o vuote, JSON compatto per oggetti e liste', () => {
    expect(formattaRiga({
      ...base,
      msg: 'Design trovato',
      titolo: 'Conad City',
      vuoto: '',
      tipiExport: 2,
      selezionate: ['A (1)', 'B (2)'],
      filtri: { idArea: 'a1' },
    })).toBe('Design trovato · titolo="Conad City" vuoto="" tipiExport=2 selezionate=["A (1)","B (2)"] filtri={"idArea":"a1"}');
  });

  it('senza campi resta il solo messaggio', () => {
    expect(formattaRiga({ ...base, context: 'Application', msg: 'Logger initialized' })).toBe('Logger initialized');
  });

  it('toglie i codici colore lasciati dai console.log con Colorize', () => {
    expect(formattaRiga({ ...base, context: 'Console', msg: '\x1b[41mCaricato Default Agenzia lib\x1b[0m' }))
      .toBe('[Console] Caricato Default Agenzia lib');
  });

  it('i campi dell\'errore, aggiunti per ultimi, restano in fondo alla riga', () => {
    expect(formattaRiga({ ...base, context: 'getKitByPromo', msg: 'Richiesta fallita', richiesta: 'ab12cd34', errorName: 'DatabaseError', errorMessage: 'Errore' }))
      .toBe('[getKitByPromo] Richiesta fallita · richiesta=ab12cd34 errorName=DatabaseError errorMessage=Errore');
  });
});
