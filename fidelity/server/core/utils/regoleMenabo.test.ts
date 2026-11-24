import { describe, expect, it } from 'vitest';
import type { GruppoRegolaMenabo, RegolaMenabo } from '../../../lib/impostazioniGdo/tipi';
import {
  erroreEspressione,
  erroreModelloNome,
  nodoVale,
  nomeDaModello,
  primaRegolaChe,
  regoleMenaboDa,
  verificaRegoleMenabo,
} from './regoleMenabo';

const cond = (campo: string, operatore: string, valore = '', valori: string[] = []) => ({ tipo: 'condizione', campo, operatore, valore, valori }) as const;
const tutte = (...figli: unknown[]) => ({ tipo: 'gruppo', logica: 'tutte', figli }) as unknown as GruppoRegolaMenabo;
const regola = (sezione: string | null, condizione: GruppoRegolaMenabo, altro: Partial<RegolaMenabo> = {}): RegolaMenabo => ({
  id: 'r', titolo: null, livello: 'box', sezione, colore: null, condizione, ...altro,
});
const da = (dati: Record<string, string>) => (campo: string) => dati[campo] ?? null;

describe('operatori delle condizioni', () => {
  const vale = (c: ReturnType<typeof cond>, dati: Record<string, string>) => nodoVale(c as never, da(dati));

  it('uguale, diverso, contiene, non contiene, inizia, finisce: senza maiuscole né accenti', () => {
    const dati = { mastro: 'PUL-PULIZIA_singola', citta: 'Perù' };
    expect(vale(cond('mastro', 'uguale', 'pul-pulizia_SINGOLA'), dati)).toBe(true);
    expect(vale(cond('citta', 'uguale', 'peru'), dati)).toBe(true);
    expect(vale(cond('mastro', 'diverso', 'altro'), dati)).toBe(true);
    expect(vale(cond('mastro', 'contiene', 'pulizia'), dati)).toBe(true);
    expect(vale(cond('mastro', 'non_contiene', 'rilancio'), dati)).toBe(true);
    expect(vale(cond('mastro', 'inizia', 'pul-'), dati)).toBe(true);
    expect(vale(cond('mastro', 'finisce', 'singola'), dati)).toBe(true);
    expect(vale(cond('mastro', 'finisce', 'doppia'), dati)).toBe(false);
  });

  it('campo mancante: uguale, contiene, inizia, finisce e uno_di non valgono; diverso e non_contiene sì', () => {
    expect(vale(cond('mastro', 'uguale', 'x'), {})).toBe(false);
    expect(vale(cond('mastro', 'contiene', 'x'), {})).toBe(false);
    expect(vale(cond('mastro', 'uno_di', '', ['x']), {})).toBe(false);
    expect(vale(cond('mastro', 'diverso', 'x'), {})).toBe(true);
    expect(vale(cond('mastro', 'non_contiene', 'x'), {})).toBe(true);
  });

  it('vuoto e non vuoto', () => {
    expect(vale(cond('mastro', 'vuoto'), {})).toBe(true);
    expect(vale(cond('mastro', 'vuoto'), { mastro: '  ' })).toBe(true);
    expect(vale(cond('mastro', 'non_vuoto'), { mastro: 'A' })).toBe(true);
    expect(vale(cond('mastro', 'non_vuoto'), {})).toBe(false);
  });

  it('uno di', () => {
    expect(vale(cond('reparto', 'uno_di', '', ['5', '7', '84']), { reparto: '7' })).toBe(true);
    expect(vale(cond('reparto', 'uno_di', '', ['5', '7', '84']), { reparto: '9' })).toBe(false);
  });

  it('espressione regolare, senza maiuscole', () => {
    expect(vale(cond('mastro', 'regex', '^(PUL|PRO)-'), { mastro: 'pul-pulizia' })).toBe(true);
    expect(vale(cond('mastro', 'regex', '^(PUL|PRO)-'), { mastro: 'DIS-DISPENSA' })).toBe(false);
  });

  it('maggiore, minore e tra, anche con la virgola decimale e il «%»', () => {
    expect(vale(cond('sconto', 'maggiore', '30'), { sconto: '32,5%' })).toBe(true);
    expect(vale(cond('sconto', 'minore', '30'), { sconto: '32,5' })).toBe(false);
    expect(vale(cond('@pagina', 'tra', '', ['12', '21']), { '@pagina': '12' })).toBe(true);
    expect(vale(cond('@pagina', 'tra', '', ['12', '21']), { '@pagina': '22' })).toBe(false);
    expect(vale(cond('sconto', 'maggiore', '30'), { sconto: 'n.d.' })).toBe(false);
  });
});

describe('gruppi annidati', () => {
  it('tutte, almeno una, nessuna', () => {
    const leggi = da({ mastro: 'PUL-PULIZIA', tema: 'altro', reparto: '84' });
    const una = { tipo: 'gruppo', logica: 'una', figli: [cond('mastro', 'inizia', 'PUL'), cond('tema', 'uguale', 'PULIZIA')] } as never;
    const nessuna = { tipo: 'gruppo', logica: 'nessuna', figli: [cond('reparto', 'uguale', '84')] } as never;
    expect(nodoVale(una, leggi)).toBe(true);
    expect(nodoVale(nessuna, leggi)).toBe(false);
    // (mastro inizia con PUL O tema è PULIZIA) E NON reparto 84
    expect(nodoVale(tutte(una, nessuna), leggi)).toBe(false);
    expect(nodoVale(tutte(una, nessuna), da({ mastro: 'PUL-X', reparto: '5' }))).toBe(true);
  });

  it('un gruppo senza voci non vale mai', () => {
    expect(nodoVale(tutte(), da({}))).toBe(false);
    expect(nodoVale({ tipo: 'gruppo', logica: 'nessuna', figli: [] }, da({}))).toBe(false);
  });
});

describe('nome da modello', () => {
  const leggi = da({ mastro: 'DIS-DISPENSA_doppia', tema: 'rilancio' });

  it('un testo fisso resta com\'è', () => {
    expect(nomeDaModello('Pulizia casa', leggi)).toBe('Pulizia casa');
  });

  it('segnaposto con trasformazioni: senza-sigla, spazi, titolo', () => {
    expect(nomeDaModello('{mastro|senza-sigla|spazi|titolo}', leggi)).toBe('Dispensa doppia');
    expect(nomeDaModello('{tema|maiuscolo}', leggi)).toBe('RILANCIO');
    expect(nomeDaModello('Sez. {tema|titolo} ({mastro|senza-sigla|minuscolo})', leggi)).toBe('Sez. Rilancio (dispensa_doppia)');
  });

  it('un campo mancante dà un pezzo vuoto, senza spazi doppi', () => {
    expect(nomeDaModello('{manca} Offerte', leggi)).toBe('Offerte');
  });

  it('rinvio a un altro campo: con più campi separati da «/» vale il primo che ha un valore', () => {
    const solo = da({ mastro: 'DIS-DISPENSA_doppia' });
    expect(nomeDaModello('{tema/mastro|senza-sigla|spazi|titolo}', solo)).toBe('Dispensa doppia');
    expect(nomeDaModello('{tema/mastro}', da({ tema: 'rilancio', mastro: 'X' }))).toBe('rilancio');
    expect(nomeDaModello('{tema/mastro}', da({ tema: '  ', mastro: 'X' }))).toBe('X');
    expect(nomeDaModello('{tema/reparto}', da({}))).toBe('');
    expect(erroreModelloNome('{tema/mastro|titolo}')).toBeNull();
    expect(erroreModelloNome('{/ |titolo}')).toMatch(/campo/);
  });

  it('«leggibile» usa il nome della libreria agenzia', () => {
    expect(nomeDaModello('{mastro|leggibile}', leggi, valore => `L:${valore}`)).toBe('L:DIS-DISPENSA_doppia');
    expect(nomeDaModello('{mastro|leggibile}', leggi)).toBe('DIS-DISPENSA_doppia');
  });

  it('verifica del modello: graffe, campo e trasformazione', () => {
    expect(erroreModelloNome('Solo testo')).toBeNull();
    expect(erroreModelloNome('{mastro|titolo}')).toBeNull();
    expect(erroreModelloNome('{mastro')).toMatch(/graffe/);
    expect(erroreModelloNome('{|titolo}')).toMatch(/campo/);
    expect(erroreModelloNome('{mastro|saltella}')).toMatch(/saltella/);
  });
});

describe('espressioni regolari', () => {
  it('accetta le semplici e rifiuta non valide, troppo lunghe o con quantificatori annidati', () => {
    expect(erroreEspressione('^PUL-')).toBeNull();
    expect(erroreEspressione('(')).toMatch(/non valida/);
    expect(erroreEspressione('a'.repeat(201))).toMatch(/supera/);
    expect(erroreEspressione('(a+)+$')).toMatch(/annidati/);
  });

  it('una regex pericolosa già salvata non vale e non blocca', () => {
    expect(nodoVale(cond('mastro', 'regex', '(a+)+$') as never, da({ mastro: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!' }))).toBe(false);
  });
});

describe('primaRegolaChe', () => {
  const regole = [
    regola(null, tutte(cond('mastro', 'uguale', 'A-Principale')), { id: 'a', titolo: 'Principale non vale' }),
    regola('Pulizia casa', tutte(cond('mastro', 'contiene', 'PULIZIA')), { id: 'b', colore: '#ff0000' }),
    regola('Pagine centrali', tutte(cond('@pagina', 'tra', '', ['12', '21'])), { id: 'c', livello: 'pagina' }),
    regola('{tema|titolo}', tutte(cond('tema', 'non_vuoto')), { id: 'd' }),
  ];

  it('vale la prima regola del livello, nell\'ordine', () => {
    const esito = primaRegolaChe(regole, 'box', [da({ mastro: 'PUL-PULIZIA_singola', tema: 'x' })]);
    expect(esito).toEqual({ nome: 'Pulizia casa', colore: '#ff0000', regola: 'b' });
  });

  it('«non è una sezione» dà nome null e usa il titolo della regola', () => {
    expect(primaRegolaChe(regole, 'box', [da({ mastro: 'A-Principale' })])).toEqual({ nome: null, colore: null, regola: 'Principale non vale' });
  });

  it('i livelli non si mescolano', () => {
    expect(primaRegolaChe(regole, 'pagina', [da({ '@pagina': '15' })])?.nome).toBe('Pagine centrali');
    expect(primaRegolaChe(regole, 'box', [da({ '@pagina': '15' })])).toBeNull();
  });

  it('basta una referenza del box che soddisfi la condizione', () => {
    const esito = primaRegolaChe(regole, 'box', [da({ mastro: 'X' }), da({ mastro: 'PUL-PULIZIA' })]);
    expect(esito?.nome).toBe('Pulizia casa');
  });

  it('un modello che dà un nome vuoto non decide: si passa alla regola dopo', () => {
    const vuote = [regola('{manca}', tutte(cond('tema', 'non_vuoto')), { id: 'v' }), regola('Resto', tutte(cond('tema', 'non_vuoto')), { id: 'r' })];
    expect(primaRegolaChe(vuote, 'box', [da({ tema: 'x' })])?.nome).toBe('Resto');
  });

  it('nessuna regola soddisfatta: null', () => {
    expect(primaRegolaChe(regole, 'box', [da({})])).toBeNull();
    expect(primaRegolaChe([], 'box', [da({ mastro: 'A' })])).toBeNull();
  });
});

describe('verificaRegoleMenabo', () => {
  const valida = {
    id: 'x', titolo: 'Pulizia', livello: 'box', sezione: 'Pulizia casa', colore: '#00aa00',
    condizione: { tipo: 'gruppo', logica: 'tutte', figli: [{ tipo: 'condizione', campo: 'mastro', operatore: 'contiene', valore: 'PUL', valori: [] }] },
  };
  const conFiglio = (figlio: unknown) => ({ ...valida, condizione: { tipo: 'gruppo', logica: 'tutte', figli: [figlio] } });

  it('una regola valida si accetta e si normalizza', () => {
    const { regole, errori } = verificaRegoleMenabo({ regole: [valida] });
    expect(errori).toEqual([]);
    expect(regole).toHaveLength(1);
    expect(regole[0]).toMatchObject({ id: 'x', titolo: 'Pulizia', livello: 'box', sezione: 'Pulizia casa', colore: '#00aa00' });
  });

  it('«non è una sezione» è sezione null', () => {
    expect(verificaRegoleMenabo({ regole: [{ ...valida, sezione: null }] }).regole[0].sezione).toBeNull();
  });

  it('senza nome della sezione: dice quale regola', () => {
    const { regole, errori } = verificaRegoleMenabo({ regole: [valida, { ...valida, id: 'y', sezione: '  ' }] });
    expect(errori).toEqual(['regola 2: manca il nome della sezione']);
    expect(regole).toEqual([]);
  });

  it('senza condizioni, con operatore o campo mancanti, modello e colore sbagliati, regex non valida', () => {
    const errori = (voce: unknown) => verificaRegoleMenabo({ regole: [voce] }).errori.join(' | ');
    expect(errori({ ...valida, condizione: { tipo: 'gruppo', logica: 'tutte', figli: [] } })).toMatch(/serve almeno una condizione/);
    expect(errori({ ...valida, condizione: undefined })).toMatch(/manca la condizione/);
    expect(errori(conFiglio({ tipo: 'condizione', campo: '', operatore: 'uguale', valore: 'a', valori: [] }))).toMatch(/manca il campo/);
    expect(errori(conFiglio({ tipo: 'condizione', campo: 'm', operatore: 'boh', valore: 'a', valori: [] }))).toMatch(/operatore non valido/);
    expect(errori(conFiglio({ tipo: 'condizione', campo: 'm', operatore: 'regex', valore: '(', valori: [] }))).toMatch(/espressione non valida/);
    expect(errori(conFiglio({ tipo: 'condizione', campo: 'm', operatore: 'tra', valore: '', valori: ['9', '3'] }))).toMatch(/minimo è maggiore/);
    expect(errori(conFiglio({ tipo: 'condizione', campo: 'm', operatore: 'uno_di', valore: '', valori: [] }))).toMatch(/elenco dei valori/);
    expect(errori({ ...valida, sezione: '{mastro|saltella}' })).toMatch(/trasformazione sconosciuta/);
    expect(errori({ ...valida, colore: 'rosso' })).toMatch(/#rrggbb/);
    expect(errori({ ...valida, livello: 'foglia' })).toMatch(/livello/);
  });

  it('id ripetuto, troppi gruppi annidati, corpo che non è un elenco', () => {
    expect(verificaRegoleMenabo({ regole: [valida, valida] }).errori.join()).toMatch(/già usato/);
    let nodo: unknown = { tipo: 'condizione', campo: 'm', operatore: 'vuoto', valore: '', valori: [] };
    for (let i = 0; i < 9; i++) nodo = { tipo: 'gruppo', logica: 'tutte', figli: [nodo] };
    expect(verificaRegoleMenabo({ regole: [{ ...valida, condizione: nodo }] }).errori.join()).toMatch(/annidati/);
    expect(verificaRegoleMenabo({ regole: 'no' }).errori).toEqual(['regole deve essere un elenco']);
    expect(verificaRegoleMenabo(null).errori).toEqual(['regole deve essere un elenco']);
  });

  it('un elenco vuoto è valido: si tolgono tutte le regole', () => {
    expect(verificaRegoleMenabo({ regole: [] })).toEqual({ regole: [], errori: [] });
  });
});

describe('regoleMenaboDa (lettura dal database)', () => {
  it('rilegge ciò che si è salvato e scarta le voci rotte', () => {
    const salvate = verificaRegoleMenabo({
      regole: [{
        id: 'x', titolo: null, livello: 'pagina', sezione: 'Centrale', colore: null,
        condizione: { tipo: 'gruppo', logica: 'una', figli: [{ tipo: 'condizione', campo: '@pagina', operatore: 'tra', valore: '', valori: ['1', '3'] }] },
      }],
    }).regole;
    const lette = regoleMenaboDa([...salvate, { rotta: true }, null, 5]);
    expect(lette).toEqual(salvate);
  });

  it('non è un elenco: vuoto', () => {
    expect(regoleMenaboDa(undefined)).toEqual([]);
    expect(regoleMenaboDa({})).toEqual([]);
  });
});
