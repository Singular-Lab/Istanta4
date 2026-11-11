import { describe, expect, it } from 'vitest';
import { descrizioneStandard, testoDescrizione, testoVarianti, variantiDei } from '../insightVolantino/descrizione';

// Spec insight-volantino, "Scheda del box del volantino": la descrizione completa accanto al prezzo.
// Questa e' la composizione standard; la libreria agenzia del cliente puo' dichiararne un'altra.

describe('descrizioneStandard', () => {
  it('nome, marca in evidenza e formato, come si leggono sul volantino', () => {
    const parti = descrizioneStandard({ nome: 'Gelato', marca: 'Nutella', formato: '230 g', varianti: [] });

    expect(parti).toEqual([{ testo: 'Gelato' }, { testo: 'Nutella', evidenza: true }, { testo: '230 g' }]);
    expect(testoDescrizione(parti)).toBe('Gelato Nutella 230 g');
  });

  it('le varianti dei prodotti in fondo; le parti vuote non ci sono', () => {
    expect(descrizioneStandard({ nome: '  ', marca: 'Granarolo', formato: null, varianti: ['Light', 'Intera'] })).toEqual([
      { testo: 'Granarolo', evidenza: true },
      { testo: 'Light, Intera' },
    ]);
    expect(descrizioneStandard({ nome: null, marca: null, formato: null, varianti: [] })).toEqual([]);
  });
});

describe('varianti', () => {
  it('le varianti diverse dei prodotti, senza doppioni né vuote, nell\'ordine dei prodotti', () => {
    expect(variantiDei([{ gusto: 'Light' }, { gusto: null }, { gusto: ' LIGHT ' }, { gusto: 'Intera' }, { gusto: '' }])).toEqual(['Light', 'Intera']);
  });

  it('oltre tre varianti si dice quante altre', () => {
    expect(testoVarianti([])).toBeNull();
    expect(testoVarianti(['A', 'B', 'C'])).toBe('A, B, C');
    expect(testoVarianti(['A', 'B', 'C', 'D'])).toBe("A, B, C e un'altra");
    expect(testoVarianti(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C e altre 2');
  });
});
