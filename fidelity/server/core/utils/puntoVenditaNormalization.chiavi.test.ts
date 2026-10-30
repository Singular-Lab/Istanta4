import { describe, expect, it } from 'vitest';
import { chiaveIndirizzo, chiaveLocalita, chiaveTelefono, civiciIndirizzo } from './puntoVenditaNormalization';

// Chiavi per riconoscere un PV della lista di un volantino in anagrafica: scritture diverse, stessa chiave

describe('chiaveIndirizzo', () => {
  it.each([
    ['V.le Montegrappa 4', 'Viale Montegrappa 4', 'VIALE MONTEGRAPPA 4'],
    ['C.so Nazario Sauro 44', 'Corso Nazario Sauro, 44', 'CORSO NAZARIO SAURO 44'],
    ['P.zza Napoleone 1', 'Piazza Napoleone n. 1', 'PIAZZA NAPOLEONE 1'],
    ['P.za Garibaldi 3', 'PZZA GARIBALDI 3', 'PIAZZA GARIBALDI 3'],
    ['P.le Roma 2', 'Piazzale Roma nr 2', 'PIAZZALE ROMA 2'],
    ['L.go Carducci 5', 'Largo Carducci n°5', 'LARGO CARDUCCI 5'],
    ['Str. Provinciale 7', 'Strada Provinciale 7', 'STRADA PROVINCIALE 7'],
    ['Loc. Madonna dell\'Acqua', 'Località Madonna dell’Acqua', 'LOCALITA MADONNA DELLACQUA'],
    ['Fraz. Pieve 10', 'Frazione Pieve 10', 'FRAZIONE PIEVE 10'],
    ['B.go Stretto 1', 'Borgo Stretto 1', 'BORGO STRETTO 1'],
    ['C.da Lame 4', 'Contrada Lame 4', 'CONTRADA LAME 4'],
    ['S.S. 1 Aurelia km 12', 'SS1 Aurelia Km 12', 'STRADA STATALE 1 AURELIA KM 12'],
    ['S.P. 25', 'SP 25', 'STRADA PROVINCIALE 25'],
    ['V. Roma 3', 'Via Roma 3', 'VIA ROMA 3'],
  ])('%s e %s danno %s', (prima, seconda, attesa) => {
    expect(chiaveIndirizzo(prima)).toBe(attesa);
    expect(chiaveIndirizzo(seconda)).toBe(attesa);
  });

  it('i civici con barra, trattino o lettera attaccata si confrontano a parole separate', () => {
    expect(chiaveIndirizzo('Via Murtola 12/14')).toBe('VIA MURTOLA 12 14');
    expect(chiaveIndirizzo('VIA MURTOLA, 12-14')).toBe('VIA MURTOLA 12 14');
    expect(chiaveIndirizzo('Via Pasteur 70/e')).toBe('VIA PASTEUR 70 E');
    expect(chiaveIndirizzo('Via Pasteur 70E')).toBe('VIA PASTEUR 70 E');
    expect(chiaveIndirizzo('Via Trossarelli 1/F')).toBe(chiaveIndirizzo('via trossarelli 1 f'));
  });

  it('ignora accenti e maiuscole; "snc" in ogni forma', () => {
    expect(chiaveIndirizzo('Via Città di Castello s.n.c.')).toBe('VIA CITTA DI CASTELLO SNC');
    expect(chiaveIndirizzo('VIA CITTA DI CASTELLO SNC')).toBe('VIA CITTA DI CASTELLO SNC');
  });

  it.each([undefined, null, '', '  ', '-/,'])('%j: nessuna chiave', (indirizzo) => {
    expect(chiaveIndirizzo(indirizzo)).toBeNull();
  });
});

describe('civiciIndirizzo', () => {
  it('le cifre dei civici della chiave', () => {
    expect(civiciIndirizzo('VIA MURTOLA 12 14')).toBe('12 14');
    expect(civiciIndirizzo('VIA ROMA')).toBe('');
    expect(civiciIndirizzo(null)).toBe('');
  });
});

describe('chiaveTelefono', () => {
  it('solo cifre, senza prefisso internazionale', () => {
    expect(chiaveTelefono('010 6197180')).toBe('0106197180');
    expect(chiaveTelefono('010/619.71.80')).toBe('0106197180');
    expect(chiaveTelefono('+39 010 6197180')).toBe('0106197180');
    expect(chiaveTelefono('0039 010 6197180')).toBe('0106197180');
    expect(chiaveTelefono('+39 333 1234567')).toBe('3331234567');
  });

  it('un cellulare che comincia per 39 resta com\'e', () => {
    expect(chiaveTelefono('390 1234567')).toBe('3901234567');
  });

  it.each([undefined, null, '', 'tel.', '12345', '051 12'])('%j: troppo corto, nessuna chiave', (telefono) => {
    expect(chiaveTelefono(telefono)).toBeNull();
  });
});

describe('chiaveLocalita', () => {
  it('testo normalizzato, null se vuoto', () => {
    expect(chiaveLocalita('Pra\'')).toBe('PRA');
    expect(chiaveLocalita('Reggio nell\'Emilia')).toBe('REGGIO NELLEMILIA');
    expect(chiaveLocalita('  ')).toBeNull();
    expect(chiaveLocalita(undefined)).toBeNull();
  });
});
