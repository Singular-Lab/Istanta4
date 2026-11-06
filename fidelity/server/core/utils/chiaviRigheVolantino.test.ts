import { describe, expect, it } from 'vitest';
import { chiaviRigaVolantino, raggruppaPerChiavi, RegoleCollegamento } from './chiaviRigheVolantino';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';

// Chiavi delle righe dei volantini: raggruppano lo stesso PV stampato e reggono i collegamenti a mano

const riga = (testo: string, dati: { localita?: string; indirizzo?: string; telefono?: string } = {}) => ({
  riga: testo,
  localita: dati.localita ?? null,
  chiaveIndirizzo: chiaveIndirizzo(dati.indirizzo),
  chiaveTelefono: chiaveTelefono(dati.telefono),
});

describe('chiaviRigaVolantino', () => {
  it('telefono e localita\' con indirizzo; il testo solo se mancano entrambi', () => {
    expect(chiaviRigaVolantino(riga('PRA - Via Murtola 12/14 - tel. 010 6197180', { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' })))
      .toEqual(['tel:0106197180', 'ind:PRA|VIA MURTOLA 12 14']);
    expect(chiaviRigaVolantino(riga('Punto vendita senza indirizzo'))).toEqual(['riga:PUNTO VENDITA SENZA INDIRIZZO']);
  });

  it('la stessa via scritta in modo diverso da\' la stessa chiave', () => {
    const corso = chiaviRigaVolantino(riga('SANREMO - Corso Nazario Sauro 44', { localita: 'SANREMO', indirizzo: 'Corso Nazario Sauro 44' }));
    const abbreviato = chiaviRigaVolantino(riga('SANREMO - C.so Nazario Sauro 44', { localita: 'Sanremo', indirizzo: 'C.so Nazario Sauro 44' }));
    expect(abbreviato).toEqual(corso);
  });
});

describe('raggruppaPerChiavi', () => {
  it('unisce le righe con una chiave in comune, anche attraverso una terza riga', () => {
    const righe = [
      riga('A', { localita: 'PRA', indirizzo: 'Via Murtola 12', telefono: '010 6197180' }),
      riga('B', { localita: 'PRA', indirizzo: 'Via Novella 3', telefono: '010 6197180' }),
      riga('C', { localita: 'PRA', indirizzo: 'Via Novella 3' }),
      riga('D', { localita: 'SESTRI', indirizzo: 'Via Sestri 5' }),
    ];

    const gruppi = raggruppaPerChiavi(righe);

    expect(gruppi.map(gruppo => gruppo.righe.map(r => r.riga))).toEqual([['A', 'B', 'C'], ['D']]);
    expect(gruppi[0].chiavi).toEqual(['ind:PRA|VIA MURTOLA 12', 'ind:PRA|VIA NOVELLA 3', 'tel:0106197180']);
  });
});

describe('RegoleCollegamento', () => {
  const pra = riga('PRA - Via Murtola 12/14 - tel. 010 6197180', { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' });

  it('trova il collegamento di una delle chiavi della riga', () => {
    const regole = new RegoleCollegamento([{ id: 'c1', idPuntoVendita: 'pv-1', chiavi: ['ind:PRA|VIA MURTOLA 12 14'], creatoIl: '2026-11-06T10:00:00Z' }]);
    expect(regole.per(pra)?.idPuntoVendita).toBe('pv-1');
    expect(regole.per(riga('SESTRI - Via Sestri 5', { localita: 'SESTRI', indirizzo: 'Via Sestri 5' }))).toBeNull();
  });

  it('a parita\' di chiave vince il collegamento piu\' recente', () => {
    const regole = new RegoleCollegamento([
      { id: 'nuovo', idPuntoVendita: 'pv-2', chiavi: ['tel:0106197180'], creatoIl: '2026-11-06T11:00:00Z' },
      { id: 'vecchio', idPuntoVendita: 'pv-1', chiavi: ['tel:0106197180'], creatoIl: '2026-11-06T10:00:00Z' },
    ]);
    expect(regole.per(pra)?.id).toBe('nuovo');
  });

  it('senza collegamenti non trova nulla', () => {
    const regole = new RegoleCollegamento([]);
    expect(regole.vuote).toBe(true);
    expect(regole.per(pra)).toBeNull();
  });
});
