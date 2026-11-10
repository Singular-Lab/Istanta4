import { describe, expect, it } from 'vitest';
import type { QuotaSpazio, SintesiVolantino } from '../../../lib/insightVolantino/tipi';
import type { BoxKit } from './analisiKit';
import { confrontoSintesi, confrontoSpazioPerReparto, prodottiAssenti, variazione } from './diffVarianti';
import type { ProdottoStampato } from './referenzaStampata';

// Un volantino e l'edizione precedente, per il report PDF: numeri chiave, spazio per reparto,
// prodotti entrati e usciti. Le differenze fra varianti non ci sono piu': la pagina degli insight non
// confronta il volantino con altri.

const prodotto = (chiave: string, dati: Partial<ProdottoStampato> = {}): ProdottoStampato => ({
  chiave,
  nome: `Prodotto ${chiave}`,
  marca: null,
  formato: null,
  tipo: null,
  codice: null,
  ean: null,
  prezzo: 1.99,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  meccanica: null,
  sottocosto: false,
  reparto: null,
  settore: null,
  segmento: null,
  ruolo: null,
  tema: null,
  fonte: 'istanta',
  foto: [],
  ...dati,
});

/** Un box con i suoi prodotti (il primo e' il pilota), con o senza posizione sulla pagina. */
const box = (id: string, pagina: number | null, prodotti: ProdottoStampato[], spazio = 4): BoxKit => ({
  id,
  codiceBox: id,
  pagina,
  geometria: pagina === null ? null : { pagina, x: 0.1, y: 0.1, w: 0.2, h: 0.2, spazio, proporzione: 0.73 },
  meccanica: null,
  reparto: null,
  sconto: prodotti[0]?.sconto ?? null,
  referenze: [],
  prodotti,
});

describe('edizione precedente', () => {
  const sintesi = (dati: Partial<SintesiVolantino>): SintesiVolantino => ({
    referenze: 0,
    box: 0,
    pagine: 0,
    scontoMedio: null,
    boxConSconto: 0,
    quotaFidelity: 0,
    sottocosto: 0,
    marche: 0,
    copertura: { prezzo: 0, marca: 0, reparto: 0, geometria: 0 },
    ...dati,
  });

  it('la variazione e\' la differenza arrotondata; senza uno dei due valori non c\'e\'', () => {
    expect(variazione(25.4, 22.1)).toEqual({ attuale: 25.4, precedente: 22.1, differenza: 3.3 });
    expect(variazione(10, 12)).toEqual({ attuale: 10, precedente: 12, differenza: -2 });
    expect(variazione(null, 12)).toEqual({ attuale: null, precedente: 12, differenza: null });
    expect(variazione(18, null)).toEqual({ attuale: 18, precedente: null, differenza: null });
  });

  it('i numeri chiave del volantino accanto a quelli dell\'edizione precedente', () => {
    const confronto = confrontoSintesi(
      sintesi({ referenze: 120, box: 90, pagine: 16, scontoMedio: 28.5, quotaFidelity: 40, sottocosto: 3, marche: 55 }),
      sintesi({ referenze: 100, box: 80, pagine: 12, scontoMedio: null, quotaFidelity: 35, sottocosto: 5, marche: 50 }),
    );

    expect(confronto).toEqual({
      referenze: { attuale: 120, precedente: 100, differenza: 20 },
      box: { attuale: 90, precedente: 80, differenza: 10 },
      pagine: { attuale: 16, precedente: 12, differenza: 4 },
      scontoMedio: { attuale: 28.5, precedente: null, differenza: null },
      quotaFidelity: { attuale: 40, precedente: 35, differenza: 5 },
      sottocosto: { attuale: 3, precedente: 5, differenza: -2 },
      marche: { attuale: 55, precedente: 50, differenza: 5 },
    });
  });

  it('lo spazio per reparto unisce i reparti dei due volantini: quello che manca vale 0', () => {
    const quota = (chiave: string, etichetta: string, quotaSpazio: number): QuotaSpazio => ({
      chiave, etichetta, referenze: 1, spazio: quotaSpazio, quotaReferenze: 0, quotaSpazio,
    });

    const confronto = confrontoSpazioPerReparto(
      [quota('01', 'Freschi', 40), quota('02', 'Bevande', 25), quota('', 'Reparto non indicato', 5)],
      [quota('02', 'Bevande', 30), quota('03', 'Casa', 20)],
    );

    expect(confronto).toEqual([
      { chiave: '01', etichetta: 'Freschi', attuale: 40, precedente: 0 },
      { chiave: '02', etichetta: 'Bevande', attuale: 25, precedente: 30 },
      { chiave: '', etichetta: 'Reparto non indicato', attuale: 5, precedente: 0 },
      { chiave: '03', etichetta: 'Casa', attuale: 0, precedente: 20 },
    ]);
    expect(confrontoSpazioPerReparto([], [])).toEqual([]);
  });

  it('prodotti entrati e usciti per chiave, su tutti i prodotti dei box, nell\'ordine del volantino', () => {
    const attuale = [
      box('n1', 1, [prodotto('c-A'), prodotto('c-N2', { nome: 'Novita\' nel gruppo', marca: 'Marca', sconto: 20 })]),
      box('n2', 2, [prodotto('c-N1', { prezzo: 0.89 })]),
    ];
    const precedente = [box('p1', 1, [prodotto('c-U1')]), box('p2', 3, [prodotto('c-X'), prodotto('c-A')])];

    expect(prodottiAssenti(attuale, precedente)).toEqual([
      { chiave: 'c-N2', nome: 'Novita\' nel gruppo', marca: 'Marca', prezzo: 1.99, sconto: 20 },
      { chiave: 'c-N1', nome: 'Prodotto c-N1', marca: null, prezzo: 0.89, sconto: null },
    ]);
    expect(prodottiAssenti(precedente, attuale).map(voce => voce.chiave)).toEqual(['c-U1', 'c-X']);
    expect(prodottiAssenti(attuale, attuale)).toEqual([]);
  });
});
