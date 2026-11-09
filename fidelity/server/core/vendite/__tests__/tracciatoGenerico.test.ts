import { describe, expect, it } from 'vitest';
import { COLONNE_TRACCIATO_GENERICO } from '../../../../lib/vendite/tipi';
import { TRACCIATO_VENDITE_GENERICO } from '../tracciatoGenerico';
import { leggiDataVendita, normalizzaIntestazione, numeroVendita, validaRigaVendita } from '../valori';

// Spec proposta "Import delle vendite con il tracciato del cliente": il tracciato generico e la
// lettura di date e numeri, uguale per tutti i tracciati

const leggi = (riga: Record<string, unknown>) => TRACCIATO_VENDITE_GENERICO.leggiRiga(riga);

const riga = (campi: Record<string, unknown> = {}) => ({
  codice: '000123', punto_vendita: 'Conad Lucca', dal: '2026-01-15', al: '2026-01-21', pezzi: '12', valore: '30,50', ...campi,
});

describe('TRACCIATO_VENDITE_GENERICO', () => {
  it('dichiara nome e colonne mostrati nell\'anteprima', () => {
    expect(TRACCIATO_VENDITE_GENERICO.nome).toBe('Tracciato generico');
    expect(TRACCIATO_VENDITE_GENERICO.colonne).toEqual(['codice', 'punto_vendita', 'dal', 'al', 'pezzi', 'valore']);
    // Le stesse che la pagina Vendite spiega prima della scelta del file
    expect(TRACCIATO_VENDITE_GENERICO.colonne).toEqual([...COLONNE_TRACCIATO_GENERICO]);
  });

  it('legge una riga buona: codice normalizzato, date ISO, virgola decimale', () => {
    expect(leggi(riga())).toEqual({
      codiceProdotto: '123', puntoVendita: 'Conad Lucca', dal: '2026-01-15', al: '2026-01-21', pezzi: 12, valore: 30.5,
    });
  });

  it('confronta le intestazioni senza maiuscole, accenti, spazi e punteggiatura', () => {
    expect(leggi({ Codice: 'ab-1', 'Punto Vendita': '77', DAL: '15/01/2026', Al: '21/01/2026', 'Quantità': 3 })).toEqual({
      codiceProdotto: 'AB-1', puntoVendita: '77', dal: '2026-01-15', al: '2026-01-21', pezzi: 3, valore: null,
    });
    expect(normalizzaIntestazione(' punto_vendita ')).toBe(normalizzaIntestazione('PuntoVendita'));
  });

  it('accetta le date di Excel (numero seriale) e i numeri del foglio', () => {
    expect(leggi(riga({ dal: 46037, al: 46043, pezzi: 4.5, valore: 10 }))).toMatchObject({ dal: '2026-01-15', al: '2026-01-21', pezzi: 4.5, valore: 10 });
  });

  it('la colonna valore e\' facoltativa: senza, o vuota, la vendita e\' solo in pezzi', () => {
    const senzaValore: Record<string, unknown> = riga();
    delete senzaValore.valore;
    expect(leggi(senzaValore)).toMatchObject({ pezzi: 12, valore: null });
    expect(leggi(riga({ valore: '' }))).toMatchObject({ valore: null });
  });

  it('scarta con un motivo chiaro le righe sbagliate', () => {
    expect(leggi(riga({ codice: '  ' }))).toBe('Codice prodotto mancante');
    expect(leggi(riga({ punto_vendita: '' }))).toBe('Punto vendita mancante');
    expect(leggi(riga({ dal: '' }))).toBe('Periodo non valido: data di inizio (dal) mancante');
    expect(leggi(riga({ al: '' }))).toBe('Periodo non valido: data di fine (al) mancante');
    expect(leggi(riga({ dal: '31/02/2026' }))).toBe('Periodo non valido: data di inizio "31/02/2026" non riconosciuta');
    expect(leggi(riga({ al: 'domani' }))).toBe('Periodo non valido: data di fine "domani" non riconosciuta');
    expect(leggi(riga({ dal: '2026-01-22' }))).toBe("Periodo non valido: l'inizio (2026-01-22) e' dopo la fine (2026-01-21)");
    expect(leggi(riga({ pezzi: '' }))).toBe('Pezzi mancanti');
    expect(leggi(riga({ pezzi: 'dodici' }))).toBe('Pezzi non numerici: dodici');
    expect(leggi(riga({ pezzi: '-3' }))).toBe('Pezzi negativi: -3');
    expect(leggi(riga({ valore: 'n.d.' }))).toBe('Valore non numerico: n.d.');
    expect(leggi(riga({ valore: '-1' }))).toBe('Valore negativo: -1');
  });

  it('un file senza le colonne del tracciato scarta ogni riga dicendo quali mancano', () => {
    expect(leggi({ articolo: '1', negozio: 'Lucca', settimana: '3' })).toBe('Colonne mancanti nel file: codice, dal, al, pezzi');
  });

  it('un periodo di un solo giorno e\' valido', () => {
    expect(leggi(riga({ dal: '2026-01-15', al: '2026-01-15' }))).toMatchObject({ dal: '2026-01-15', al: '2026-01-15' });
  });
});

describe('leggiDataVendita', () => {
  it('testo ISO (anche con l\'ora), italiano con / - . e anno a due cifre, AAAAMMGG', () => {
    expect(leggiDataVendita('2026-01-15')).toBe('2026-01-15');
    expect(leggiDataVendita('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
    expect(leggiDataVendita('2026-1-5')).toBe('2026-01-05');
    expect(leggiDataVendita('15/01/2026')).toBe('2026-01-15');
    expect(leggiDataVendita('5-1-2026')).toBe('2026-01-05');
    expect(leggiDataVendita('15.01.26')).toBe('2026-01-15');
    expect(leggiDataVendita('20260115')).toBe('2026-01-15');
    expect(leggiDataVendita(20260115)).toBe('2026-01-15');
  });

  it('numero seriale di Excel, anche con l\'ora', () => {
    expect(leggiDataVendita(46037)).toBe('2026-01-15');
    expect(leggiDataVendita(46037.75)).toBe('2026-01-15');
  });

  it('Date: mezzanotte UTC vale il giorno UTC, altrimenti il giorno locale', () => {
    expect(leggiDataVendita(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01-15');
    expect(leggiDataVendita(new Date(2026, 0, 15))).toBe('2026-01-15');
    expect(leggiDataVendita(new Date(2026, 0, 15, 18, 30))).toBe('2026-01-15');
    expect(leggiDataVendita(new Date('non una data'))).toBeNull();
  });

  it('rifiuta giorni inesistenti, formato americano, anni fuori scala e valori che non sono date', () => {
    expect(leggiDataVendita('29/02/2025')).toBeNull();
    expect(leggiDataVendita('01/15/2026')).toBeNull();
    expect(leggiDataVendita('1850-01-01')).toBeNull();
    expect(leggiDataVendita(5)).toBeNull();
    expect(leggiDataVendita(-1)).toBeNull();
    expect(leggiDataVendita('')).toBeNull();
    expect(leggiDataVendita(true)).toBeNull();
    expect(leggiDataVendita(null)).toBeNull();
  });
});

describe('numeroVendita', () => {
  it('vuoto e\' null, non numerico e\' NaN', () => {
    expect(numeroVendita('')).toBeNull();
    expect(numeroVendita('   ')).toBeNull();
    expect(numeroVendita(undefined)).toBeNull();
    expect(numeroVendita(null)).toBeNull();
    expect(numeroVendita('abc')).toBeNaN();
    expect(numeroVendita('1,2,3x')).toBeNaN();
    expect(numeroVendita(true)).toBeNaN();
    expect(numeroVendita(Number.POSITIVE_INFINITY)).toBeNaN();
  });

  it('virgola decimale, migliaia italiane e inglesi, spazi ed euro', () => {
    expect(numeroVendita('12,5')).toBe(12.5);
    expect(numeroVendita('1.234,50')).toBe(1234.5);
    expect(numeroVendita('1,234.50')).toBe(1234.5);
    expect(numeroVendita('1.234.567')).toBe(1234567);
    expect(numeroVendita('1 234,5 €')).toBe(1234.5);
    expect(numeroVendita('€ 7')).toBe(7);
    expect(numeroVendita(' 42 ')).toBe(42);
    expect(numeroVendita(3.25)).toBe(3.25);
  });

  it('con un solo punto il punto e\' il decimale', () => {
    expect(numeroVendita('1.234')).toBe(1.234);
  });
});

describe('validaRigaVendita (i controlli di FP su ogni tracciato)', () => {
  const vendita = { codiceProdotto: ' 0042 ', puntoVendita: ' 9 ', dal: '2026-01-15', al: '2026-01-21', pezzi: 1, valore: null };

  it('normalizza codice e punto vendita', () => {
    expect(validaRigaVendita(vendita)).toEqual({ ...vendita, codiceProdotto: '42', puntoVendita: '9' });
  });

  it('accetta anche le date non ISO di una libreria agenzia', () => {
    expect(validaRigaVendita({ ...vendita, dal: '15/01/2026' })).toMatchObject({ dal: '2026-01-15' });
  });

  it('scarta codici troppo lunghi, pezzi non finiti, valori e pezzi fuori scala', () => {
    expect(validaRigaVendita({ ...vendita, codiceProdotto: 'X'.repeat(101) })).toMatch(/^Codice prodotto troppo lungo/);
    expect(validaRigaVendita({ ...vendita, pezzi: Number.NaN })).toBe('Pezzi non numerici: NaN');
    expect(validaRigaVendita({ ...vendita, pezzi: 1e11 })).toMatch(/^Pezzi fuori scala/);
    expect(validaRigaVendita({ ...vendita, valore: 1e12 })).toMatch(/^Valore fuori scala/);
    expect(validaRigaVendita({ ...vendita, puntoVendita: '' })).toBe('Punto vendita mancante');
  });
});
