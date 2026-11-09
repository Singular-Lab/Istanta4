import { describe, expect, it } from 'vitest';
import { chiavePuntoVenditaStampato } from '../puntiVenditaStampati';

// Quando due righe stampate nei volantini sono lo stesso punto vendita (spec volantini-pop,
// "Dettaglio di consultazione della promozione"): stessa località e stesso indirizzo.

const stesso = (a: Parameters<typeof chiavePuntoVenditaStampato>[0], b: Parameters<typeof chiavePuntoVenditaStampato>[0]) =>
  chiavePuntoVenditaStampato(a) === chiavePuntoVenditaStampato(b);

describe('chiavePuntoVenditaStampato', () => {
  it('stessa località e stesso indirizzo, senza distinguere maiuscole e spazi, anche se la riga cambia', () => {
    expect(stesso(
      { localita: 'AREZZO', indirizzo: 'VIA CHIARINI 23/A', riga: 'AREZZO - VIA CHIARINI 23/A' },
      { localita: ' Arezzo ', indirizzo: 'Via  Chiarini\t23/A', riga: 'Arezzo, Via Chiarini 23/A - tel. 0575 123456' }
    )).toBe(true);
  });

  it('località o indirizzo diversi sono punti vendita diversi', () => {
    expect(stesso(
      { localita: 'MARINA DI MASSA', indirizzo: 'Via S. Leonardo 350', riga: 'r1' },
      { localita: 'MASSA MARITTIMA', indirizzo: 'Via Don Luigi Rossi 5', riga: 'r2' }
    )).toBe(false);
    expect(stesso(
      { localita: 'FIRENZE', indirizzo: 'Via Zanella', riga: 'r1' },
      { localita: 'FIRENZE', indirizzo: 'Via Pistoiese 1', riga: 'r2' }
    )).toBe(false);
  });

  it('gli accenti contano: "Forlì" e "Forli" restano due, come nel conteggio SQL', () => {
    expect(stesso(
      { localita: 'Forlì', indirizzo: 'Via Roma 1', riga: '' },
      { localita: 'FORLI', indirizzo: 'Via Roma 1', riga: '' }
    )).toBe(false);
  });

  it('senza indirizzo o senza località vale la riga intera: due negozi della stessa città non diventano uno', () => {
    expect(stesso(
      { localita: 'FIRENZE', indirizzo: null, riga: 'FIRENZE - Via Zanella' },
      { localita: 'FIRENZE', indirizzo: '  ', riga: 'FIRENZE - Via Pistoiese 1' }
    )).toBe(false);
    expect(stesso(
      { localita: null, indirizzo: 'Via Arzelà', riga: 'Via Arzelà - tel. 0187 695225' },
      { localita: '', indirizzo: 'Via Arzelà', riga: 'VIA ARZELÀ  -  TEL. 0187 695225' }
    )).toBe(true);
  });

  it('una riga intera non si confonde con un luogo', () => {
    expect(chiavePuntoVenditaStampato({ localita: 'FIRENZE', indirizzo: 'Via Zanella', riga: '' })).toBe('firenze | via zanella');
    expect(chiavePuntoVenditaStampato({ localita: null, indirizzo: null, riga: 'firenze | via zanella' })).toBe('riga:firenze | via zanella');
  });
});
