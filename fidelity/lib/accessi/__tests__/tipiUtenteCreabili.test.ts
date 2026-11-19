import { describe, expect, it } from 'vitest';
import { TIPO_UTENTI } from '../../enums';
import {
  ETICHETTE_TIPO_UTENTE,
  puoCreareTipo,
  REGOLA_PASSWORD,
  REGOLA_TELEFONO,
  scegliePiuGdo,
  tipiUtenteCreabili,
} from '../tipiUtenteCreabili';

describe('tipi di utente creabili', () => {
  it('il Superadmin crea ogni tipo, compreso il Superadmin', () => {
    expect(tipiUtenteCreabili(TIPO_UTENTI.SUPERADMIN)).toHaveLength(8);
    expect(puoCreareTipo(TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.SUPERADMIN)).toBe(true);
  });

  it('l\'Agenzia crea tutti i tipi tranne il Superadmin', () => {
    const tipi = tipiUtenteCreabili(TIPO_UTENTI.AGENZIA);
    expect(tipi).not.toContain(TIPO_UTENTI.SUPERADMIN);
    expect(tipi).toContain(TIPO_UTENTI.AGENZIA);
    expect(tipi).toContain(TIPO_UTENTI.GDO);
    expect(puoCreareTipo(TIPO_UTENTI.AGENZIA, TIPO_UTENTI.SUPERADMIN)).toBe(false);
  });

  it('un utente GDO non crea utenti GDO né Superadmin', () => {
    const tipi = tipiUtenteCreabili(TIPO_UTENTI.GDO);
    expect(tipi).not.toContain(TIPO_UTENTI.GDO);
    expect(tipi).not.toContain(TIPO_UTENTI.SUPERADMIN);
    expect(tipi).toContain(TIPO_UTENTI.PUNTOVENDITA);
    expect(tipi).toContain(TIPO_UTENTI.CATEGORY);
  });

  it('un utente Punto Vendita non crea GDO, Superadmin né Guest', () => {
    const tipi = tipiUtenteCreabili(TIPO_UTENTI.PUNTOVENDITA);
    expect(tipi).not.toContain(TIPO_UTENTI.GDO);
    expect(tipi).not.toContain(TIPO_UTENTI.SUPERADMIN);
    expect(tipi).not.toContain(TIPO_UTENTI.GUEST);
    expect(tipi).toContain(TIPO_UTENTI.PUNTOVENDITA);
  });

  it('senza tipo di sessione non si crea mai un Superadmin', () => {
    expect(puoCreareTipo(undefined, TIPO_UTENTI.SUPERADMIN)).toBe(false);
    expect(puoCreareTipo(undefined, 'TipoInventato')).toBe(false);
  });

  it('ogni tipo ha un nome leggibile', () => {
    expect(ETICHETTE_TIPO_UTENTE[TIPO_UTENTI.PUNTOVENDITA]).toBe('Punto Vendita');
  });
});

describe('GDO del nuovo utente', () => {
  it('solo Superadmin e Agenzia scelgono la GDO', () => {
    expect(scegliePiuGdo(TIPO_UTENTI.SUPERADMIN)).toBe(true);
    expect(scegliePiuGdo(TIPO_UTENTI.AGENZIA)).toBe(true);
    expect(scegliePiuGdo(TIPO_UTENTI.GDO)).toBe(false);
    expect(scegliePiuGdo(TIPO_UTENTI.IT)).toBe(false);
    expect(scegliePiuGdo(undefined)).toBe(false);
  });
});

describe('regole di password e telefono', () => {
  // Valori composti a pezzi: nessuna stringa che somigli a una credenziale nel codice
  const componi = (...parti: string[]) => parti.join('');
  const rispettaRegola = (valore: string) => REGOLA_PASSWORD.test(valore);

  it('la password vuole maiuscola, minuscola, cifra e simbolo', () => {
    expect(rispettaRegola(componi('A', '1', '@', 'a'.repeat(5)))).toBe(true);
    expect(rispettaRegola('a'.repeat(8))).toBe(false);
    expect(rispettaRegola(componi('A', '1', '@', 'a'.repeat(4)))).toBe(false);
    expect(rispettaRegola(componi('A', '1', 'a'.repeat(6)))).toBe(false);
  });

  it('il telefono accetta prefisso internazionale e spazi', () => {
    expect(REGOLA_TELEFONO.test('+39 055 123 4567')).toBe(true);
    expect(REGOLA_TELEFONO.test('3331234567')).toBe(true);
    expect(REGOLA_TELEFONO.test('055 12345')).toBe(true);
    expect(REGOLA_TELEFONO.test('abc')).toBe(false);
    expect(REGOLA_TELEFONO.test('12')).toBe(false);
    expect(REGOLA_TELEFONO.test('+39 ')).toBe(false);
  });
});
