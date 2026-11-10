import { describe, expect, it } from 'vitest';
import type { BoxInsight } from '../../../lib/insightVolantino/tipi';
import { lineaEBolli, lineeDelVolantino, regoleLinee, sigleAssegnate } from './lineeDistributore';

// Spec insight-volantino, "Linee del distributore con loghi e bolli": la linea del box e' quella
// assegnata da Istanta o, senza, quella ricavata dai testi con la regola della libreria agenzia.

const REGOLE = regoleLinee({
  linee: [
    { sigla: 'conad_logo', nome: 'Conad', colore: '#d52b1e' },
    { sigla: 'conad_11p', nome: '11 Paralleli' },
    { sigla: 'conad_bio', nome: 'Il Biologico' },
  ],
  bolli: [
    { sigla: 'dop', nome: 'DOP' },
    { sigla: 'LOGO_filiera', nome: 'Filiera controllata' },
  ],
  lineaDaTesti: ({ marca, descrizione }) => {
    if (!marca?.toLowerCase().includes('conad')) return null;
    return descrizione?.toLowerCase().includes('bio') ? 'CONAD_BIO' : 'conad_logo';
  },
})!;

const testi = (marca: string | null, descrizione: string | null = null) => ({ marca, descrizione, gusto: null });

describe('regoleLinee e sigleAssegnate', () => {
  it('senza linee dichiarate non ci sono regole', () => {
    expect(regoleLinee(undefined)).toBeNull();
    expect(regoleLinee(null)).toBeNull();
  });

  it('i loghi attivi di foto_extra, con guidId o guid_id; quelli spenti o senza sigla no', () => {
    expect(sigleAssegnate([
      { guidId: 'g1', attiva: true, sigla: 'conad_11P', tipo: 3 },
      { guid_id: 'g2', sigla: ' dop ', tipo: 2 },
      { guidId: 'g3', attiva: false, sigla: 'igp', tipo: 2 },
      { guidId: 'g4', sigla: '' },
      null,
      'testo',
    ])).toEqual(['conad_11P', 'dop']);
    expect(sigleAssegnate(null)).toEqual([]);
    expect(sigleAssegnate({ sigla: 'dop' })).toEqual([]);
  });
});

describe('lineaEBolli', () => {
  it('la prima linea dichiarata fra i loghi di Istanta, senza distinguere le maiuscole', () => {
    expect(lineaEBolli(['logo_selezione', 'conad_11P', 'conad_bio'], testi('Conad', 'Bio'), REGOLE))
      .toEqual({ linea: { sigla: 'conad_11p', nome: '11 Paralleli' }, bolli: [] });
  });

  it('senza linea fra i loghi vale quella dai testi; senza neanche quella, nessuna linea', () => {
    expect(lineaEBolli([], testi('Conad', 'Passata bio'), REGOLE).linea).toEqual({ sigla: 'conad_bio', nome: 'Il Biologico' });
    expect(lineaEBolli(['dop'], testi('Conad', 'Pasta'), REGOLE).linea).toEqual({ sigla: 'conad_logo', nome: 'Conad' });
    expect(lineaEBolli([], testi('Barilla', 'Pasta'), REGOLE).linea).toBeNull();
  });

  it('una sigla dai testi che non e\' fra le linee dichiarate non conta; una regola che fallisce nemmeno', () => {
    const conSiglaIgnota = regoleLinee({ linee: [{ sigla: 'conad_logo', nome: 'Conad' }], lineaDaTesti: () => 'conad_altra' })!;
    const rotta = regoleLinee({ linee: [{ sigla: 'conad_logo', nome: 'Conad' }], lineaDaTesti: () => { throw new Error('regola rotta'); } })!;

    expect(lineaEBolli([], testi('Conad'), conSiglaIgnota).linea).toBeNull();
    expect(lineaEBolli([], testi('Conad'), rotta).linea).toBeNull();
  });

  it('i bolli: solo quelli dichiarati, senza doppioni, nell\'ordine dichiarato, con la sigla dichiarata', () => {
    expect(lineaEBolli(['logo_filiera', 'DOP', 'dop', 'igp'], testi(null), REGOLE).bolli).toEqual(['dop', 'LOGO_filiera']);
  });
});

describe('lineeDelVolantino', () => {
  const box = (id: string, spazio: number, linea: BoxInsight['linea'], bolli: string[] = [], sconto: number | null = null, referenze = 1) =>
    ({ id, spazio, linea, bolli, sconto, idReferenze: Array.from({ length: referenze }, (_, indice) => `${id}-${indice}`) }) as BoxInsight;

  it('per linea, nell\'ordine dichiarato e solo quelle presenti: box, referenze, quota dello spazio, sconto medio, logo', () => {
    const sezione = lineeDelVolantino([
      box('a', 30, { sigla: 'conad_bio', nome: 'Il Biologico' }, ['dop'], 20, 2),
      box('b', 10, { sigla: 'conad_logo', nome: 'Conad' }, ['LOGO_filiera', 'dop'], 30),
      box('c', 20, { sigla: 'conad_logo', nome: 'Conad' }, [], null),
      box('d', 40, null, ['dop']),
    ], REGOLE, sigla => (sigla === 'conad_logo' ? '/olimpo/conad' : null));

    expect(sezione).toEqual({
      quotaSpazio: 60,
      quotaBox: 75,
      box: 3,
      linee: [
        { sigla: 'conad_logo', nome: 'Conad', colore: '#d52b1e', logo: '/olimpo/conad', box: 2, referenze: 2, quotaSpazio: 30, scontoMedio: 30 },
        { sigla: 'conad_bio', nome: 'Il Biologico', colore: null, logo: null, box: 1, referenze: 2, quotaSpazio: 30, scontoMedio: 20 },
      ],
      bolli: [
        { sigla: 'dop', nome: 'DOP', logo: null, box: 3 },
        { sigla: 'LOGO_filiera', nome: 'Filiera controllata', logo: null, box: 1 },
      ],
    });
  });

  it('volantino senza box o senza linee: quote a zero ed elenchi vuoti', () => {
    expect(lineeDelVolantino([], REGOLE)).toEqual({ quotaSpazio: 0, quotaBox: 0, box: 0, linee: [], bolli: [] });
    expect(lineeDelVolantino([box('a', 10, null)], REGOLE)).toEqual({ quotaSpazio: 0, quotaBox: 0, box: 0, linee: [], bolli: [] });
  });
});
