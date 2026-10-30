import { describe, expect, it } from 'vitest';
import { type EdizioneConLista, raggruppaRigheNonAbbinate, righeDaRevisionare, type RigaSenzaPuntoVendita } from './gestionePuntiVendita';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';

// Qualita' dei dati nella gestione dei PV: righe dell'import da rivedere e righe dei volantini senza PV

describe('righeDaRevisionare', () => {
  it('le righe scartate o non scritte dell\'ultimo import, una volta ciascuna, piu\' quella in attesa', () => {
    expect(righeDaRevisionare({
      errori: [{ row: 3, error: 'CAP mancante' }, { row: 5, error: 'Canale sconosciuto' }, { row: 5, error: 'Indirizzo' }, { row: 0, error: 'Import interrotto' }],
      rigaInAttesa: { riga: 9 },
    })).toBe(3);
    expect(righeDaRevisionare({ errori: [] })).toBe(0);
    expect(righeDaRevisionare({})).toBe(0);
    expect(righeDaRevisionare(null)).toBe(0);
    expect(righeDaRevisionare('rotto')).toBe(0);
  });
});

describe('raggruppaRigheNonAbbinate', () => {
  const NOMI: Record<string, string> = { SS: 'Conad Superstore', CC: 'Conad City' };

  const riga = (idKit: string, data: string, testo: string, dati: { localita?: string; indirizzo?: string; telefono?: string; canale?: string }): RigaSenzaPuntoVendita => ({
    idKit,
    data,
    idCanale: dati.canale ?? 'SS',
    nomeCanale: NOMI[dati.canale ?? 'SS'],
    idArea: 'LI',
    posizione: 1,
    riga: testo,
    localita: dati.localita ?? null,
    indirizzo: dati.indirizzo ?? null,
    telefono: dati.telefono ?? null,
    chiaveIndirizzo: chiaveIndirizzo(dati.indirizzo),
    chiaveTelefono: chiaveTelefono(dati.telefono),
  });

  const RIGHE: RigaSenzaPuntoVendita[] = [
    // Stesso telefono di un PV dell'anagrafica
    riga('k1', '2022-01-06', 'SANREMO - Via Roma 3 - tel. 0184 555 0143', { localita: 'SANREMO', indirizzo: 'Via Roma 3', telefono: '0184 555 0143' }),
    riga('k2', '2022-01-13', 'SANREMO - V. Roma 3 - tel. 0184 555 0143', { localita: 'SANREMO', indirizzo: 'V. Roma 3', telefono: '0184 555 0143' }),
    // Non c'e' piu' nelle ultime tre edizioni della sua insegna e area
    riga('k2', '2022-01-13', 'ALASSIO - Via Dante 88 - tel. 0182 555 0611', { localita: 'ALASSIO', indirizzo: 'Via Dante 88', telefono: '0182 555 0611' }),
    // Stesso indirizzo, la seconda volta senza telefono: lo stesso PV
    riga('k1', '2022-01-06', 'ARMA DI TAGGIA - P.zza Chierotti 4 - tel. 0184 999 0000', { localita: 'ARMA DI TAGGIA', indirizzo: 'P.zza Chierotti 4', telefono: '0184 999 0000' }),
    riga('k5', '2022-02-03', 'ARMA DI TAGGIA - P.zza Chierotti 4', { localita: 'ARMA DI TAGGIA', indirizzo: 'P.zza Chierotti 4' }),
    // Ne' telefono ne' indirizzo: si riconosce dal testo; solo due edizioni dopo, non basta per "forse chiuso"
    riga('c1', '2022-01-06', 'Punto vendita senza indirizzo', { canale: 'CC' }),
    riga('c2', '2022-01-13', 'PUNTO VENDITA SENZA INDIRIZZO', { canale: 'CC' }),
  ];

  const EDIZIONI: EdizioneConLista[] = [
    ...['2022-01-06', '2022-01-13', '2022-01-20', '2022-01-27', '2022-02-03'].map(data => ({ idCanale: 'SS', idArea: 'LI', data })),
    ...['2022-01-06', '2022-01-13', '2022-01-20', '2022-01-27'].map(data => ({ idCanale: 'CC', idArea: 'LI', data })),
  ];

  const PUNTI_VENDITA = [
    { id: 'pv-9', nome: 'Conad Superstore Sanremo', telefono: '0184 5550143' },
    { id: 'pv-3', nome: 'Conad City Genova', telefono: null },
  ];

  const gruppi = raggruppaRigheNonAbbinate(RIGHE, EDIZIONI, PUNTI_VENDITA);

  it('un gruppo per PV stampato, dal visto piu\' di recente; a parita\' per volantini e testo', () => {
    expect(gruppi.map(gruppo => gruppo.riga)).toEqual([
      'ARMA DI TAGGIA - P.zza Chierotti 4',
      'PUNTO VENDITA SENZA INDIRIZZO',
      'SANREMO - V. Roma 3 - tel. 0184 555 0143',
      'ALASSIO - Via Dante 88 - tel. 0182 555 0611',
    ]);
  });

  it('la riga piu\' recente, il telefono dell\'ultima che lo stampa, volantini, prima e ultima volta, insegna', () => {
    expect(gruppi[0]).toEqual({
      riga: 'ARMA DI TAGGIA - P.zza Chierotti 4',
      localita: 'ARMA DI TAGGIA',
      indirizzo: 'P.zza Chierotti 4',
      telefono: '0184 999 0000',
      volantini: 2,
      primoVolantino: '2022-01-06',
      ultimoVolantino: '2022-02-03',
      canale: { id: 'SS', nome: 'Conad Superstore' },
      suggerimento: { tipo: 'da_aggiungere' },
    });
  });

  it('suggerimenti: stesso telefono di un PV, forse chiuso dopo tre edizioni senza, altrimenti da aggiungere', () => {
    expect(Object.fromEntries(gruppi.map(gruppo => [gruppo.riga.slice(0, 7), gruppo.suggerimento]))).toEqual({
      'ARMA DI': { tipo: 'da_aggiungere' },
      'PUNTO V': { tipo: 'da_aggiungere' },
      'SANREMO': { tipo: 'stesso_telefono', puntoVendita: { id: 'pv-9', nome: 'Conad Superstore Sanremo' } },
      'ALASSIO': { tipo: 'forse_chiuso' },
    });
    expect(gruppi.find(gruppo => gruppo.riga.startsWith('SANREMO'))?.volantini).toBe(2);
  });

  it('nessuna riga, nessun gruppo', () => {
    expect(raggruppaRigheNonAbbinate([], EDIZIONI, PUNTI_VENDITA)).toEqual([]);
  });
});
