import { describe, expect, it } from 'vitest';
import type { PosizioneRiga } from '../../../lib/puntiVendita/analisi';
import {
  chiaveCombinazione,
  chiavePosizione,
  confronta,
  datiStampati,
  distanzaMetri,
  formattaDistanza,
  localitaDaCercare,
  posizioneDelGruppo,
  puntoVenditaConfrontato,
} from './confrontoPuntiVendita';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';

// Il confronto fra le righe stampate nei volantini e un PV dell'anagrafica: suggerimenti e verifica

const riga = (dati: { localita?: string; indirizzo?: string; telefono?: string; provincia?: string; canale?: string; area?: string }) => ({
  localita: dati.localita ?? null,
  telefono: dati.telefono ?? null,
  provincia: dati.provincia ?? null,
  chiaveIndirizzo: chiaveIndirizzo(dati.indirizzo),
  chiaveTelefono: chiaveTelefono(dati.telefono),
  idCanale: dati.canale ?? 'CY',
  idArea: dati.area ?? 'LI',
});

const posizione = (lat: number | null, lon: number | null, precisione: PosizioneRiga['precisione'] = 'via'): PosizioneRiga => ({
  chiave: 'ind:X|Y', lat, lon, precisione, fonte: 'nominatim', errore: null, aggiornataIl: '2026-11-11T09:00:00.000Z',
});

const pv = (sovrascritti: Partial<Parameters<typeof puntoVenditaConfrontato>[0]> = {}) => puntoVenditaConfrontato({
  id: 'pv-1', nome: 'Conad City Sanremo', telefono: '0184 591201', citta: 'Sanremo', indirizzo: 'Corso Nazario Sauro 44', provincia: 'IM',
  idCanale: 'CY', nomeCanale: 'Conad City', idArea: 'LI', nomeArea: 'Liguria', lat: '43.8170', lon: '7.7760', ...sovrascritti,
});

describe('chiavi e distanze', () => {
  it('la combinazione come chiave, in minuscolo; null se manca canale o area', () => {
    expect(chiaveCombinazione('CY', 'LI')).toBe('cy|li');
    expect(chiaveCombinazione('CY', null)).toBeNull();
  });

  it('la chiave della posizione: localita\' e indirizzo come la chiave "ind:" della riga, o la sola localita\'', () => {
    expect(chiavePosizione({ localita: 'PRA', chiaveIndirizzo: 'VIA MURTOLA 12 14' })).toBe('ind:PRA|VIA MURTOLA 12 14');
    expect(chiavePosizione({ localita: 'BOLOGNA e provincia', chiaveIndirizzo: null })).toBe('loc:BOLOGNA');
    expect(chiavePosizione({ localita: null, chiaveIndirizzo: null })).toBeNull();
  });

  it('la localita\' da cercare senza "e provincia" ne\' trattini finali', () => {
    expect(localitaDaCercare('BOLOGNA e provincia')).toBe('BOLOGNA');
    expect(localitaDaCercare('CASALECCHIO DI RENO -')).toBe('CASALECCHIO DI RENO');
    expect(localitaDaCercare('  ')).toBeNull();
  });

  it('distanza in metri e scritta per le persone', () => {
    // Un millesimo di grado di latitudine: circa 111 metri
    expect(distanzaMetri({ lat: 44, lon: 8 }, { lat: 44.001, lon: 8 })).toBe(111);
    expect(formattaDistanza(450)).toBe('450 m');
    expect(formattaDistanza(1234)).toBe('1,2 km');
    expect(formattaDistanza(95_400)).toBe('95 km');
  });
});

describe('confronta', () => {
  it('stesso telefono, indirizzo con l\'abbreviazione, stessa localita\' e provincia, combinazione e distanza', () => {
    const dati = datiStampati([riga({ localita: 'SANREMO', indirizzo: 'C.so Nazario Sauro 44', telefono: '0184 591201', provincia: 'IM' })]);

    expect(confronta(dati, pv(), posizione(43.8171, 7.7761))).toEqual({
      telefono: 'uguale', indirizzo: 'uguale', localita: 'uguale', provincia: 'uguale', stessaCombinazione: true, distanzaMetri: 14,
    });
  });

  it('stessa via con un altro civico: indirizzo simile; frazione scritta diversa ma con le stesse parole: localita\' simile', () => {
    const dati = datiStampati([riga({ localita: 'S. STEFANO MAGRA', indirizzo: 'Via Arzela 12' })]);

    const confronto = confronta(dati, pv({ citta: 'Santo Stefano di Magra', indirizzo: 'Via Arzelà 4', telefono: null }), null);

    expect(confronto).toMatchObject({ telefono: 'assente', indirizzo: 'simile', localita: 'simile', distanzaMetri: null });
  });

  it('telefono e indirizzo diversi, localita\' diversa, provincia in sigla diversa, altra combinazione', () => {
    const dati = datiStampati([riga({ localita: 'MARINA DI MASSA', indirizzo: 'Via S. Leonardo 350', telefono: '0585 000000', provincia: 'MS', canale: 'CY', area: 'TO' })]);

    expect(confronta(dati, pv({ citta: 'Massa Marittima', provincia: 'GR', idArea: 'LI' }), null)).toMatchObject({
      telefono: 'diverso', indirizzo: 'diverso', localita: 'diverso', provincia: 'diverso', stessaCombinazione: false,
    });
  });

  it('una provincia scritta per esteso non si confronta con una sigla', () => {
    const dati = datiStampati([riga({ provincia: 'IMPERIA' })]);
    expect(confronta(dati, pv(), null).provincia).toBe('assente');
  });
});

describe('posizioneDelGruppo', () => {
  const posizioni = new Map<string, PosizioneRiga>([
    ['ind:PRA|VIA NOVELLA 3', { ...posizione(44.43, 8.78, 'comune'), chiave: 'ind:PRA|VIA NOVELLA 3' }],
    ['ind:PRA|VIA MURTOLA 12 14', { ...posizione(44.428, 8.783, 'via'), chiave: 'ind:PRA|VIA MURTOLA 12 14' }],
    ['ind:PRA|VIA ERRATA 1', { ...posizione(null, null, 'non_trovata'), chiave: 'ind:PRA|VIA ERRATA 1' }],
  ]);
  const di = (indirizzo: string) => ({ localita: 'PRA', chiaveIndirizzo: chiaveIndirizzo(indirizzo) });

  it('dalla riga piu\' recente la prima precisa, poi la prima con coordinate, poi la prima cercata', () => {
    expect(posizioneDelGruppo([di('Via Novella 3'), di('Via Murtola 12/14')], posizioni)?.chiave).toBe('ind:PRA|VIA MURTOLA 12 14');
    expect(posizioneDelGruppo([di('Via Errata 1'), di('Via Novella 3')], posizioni)?.chiave).toBe('ind:PRA|VIA NOVELLA 3');
    expect(posizioneDelGruppo([di('Via Errata 1')], posizioni)?.precisione).toBe('non_trovata');
    expect(posizioneDelGruppo([di('Via Mai Cercata 9')], posizioni)).toBeNull();
  });
});
