import { describe, expect, it } from 'vitest';
import type { RegolaMenabo } from '../../../lib/impostazioniGdo/tipi';
import { menaboConadCno } from '../agenzia_lib/conadcno/ruoli-menabo';
import type { BoxKit } from './analisiKit';
import { opzioniDellAgenzia } from './insightAgenzia';
import { menaboDi } from './insightVolantino';
import type { RigaReferenza } from './referenzaStampata';
import { verificaRegoleMenabo } from './regoleMenabo';

/** Un box con una referenza (id uguale al codice) sulla pagina indicata. */
const scatola = (id: string, pagina: number): BoxKit => ({ pagina, referenze: [{ id }] }) as unknown as BoxKit;
const riga = (id: string, dati: Record<string, string>): RigaReferenza => ({ id, data_fields: dati }) as unknown as RigaReferenza;
const regole = (...voci: unknown[]): RegolaMenabo[] => {
  const { regole: lette, errori } = verificaRegoleMenabo({ regole: voci });
  expect(errori).toEqual([]);
  return lette;
};
const gruppo = (...figli: Array<[string, string, string?, string[]?]>) => ({
  tipo: 'gruppo', logica: 'tutte',
  figli: figli.map(([campo, operatore, valore = '', valori = []]) => ({ tipo: 'condizione', campo, operatore, valore, valori })),
});
const agenzia = { menabo: menaboConadCno } as never;
const menabo = (righe: RigaReferenza[], box: BoxKit[], r: RegolaMenabo[] = []) => menaboDi(box, opzioniDellAgenzia(agenzia, righe, r));

const RIGHE = [
  riga('a1', { mastro: 'PUL-PULIZIA_singola', reparto: '5', tema: 'x' }),
  riga('a2', { mastro: 'PUL-PULIZIA_singola', reparto: '84', tema: 'x' }),
  riga('p1', { mastro: 'A-Principale', reparto: '83', tema: 'y' }),
  riga('d1', { mastro: 'DIS-DISPENSA_doppia', reparto: '1', tema: 'rilancio' }),
];
const BOX = [scatola('a1', 22), scatola('a2', 22), scatola('p1', 26), scatola('d1', 14)];

describe('menabò con le regole (retrocompatibilità e regole di box)', () => {
  it('senza regole il menabò è quello di sempre: la mastro col nome leggibile, senza chiavi in più', () => {
    expect(menabo(RIGHE, BOX)).toEqual({
      pagine: [
        { pagina: 14, sezione: 'DIS-DISPENSA_doppia', nome: 'Dispensa' },
        { pagina: 22, sezione: 'PUL-PULIZIA_singola', nome: 'Pulizia' },
        { pagina: 26, sezione: 'A-Principale', nome: 'Principale' },
      ],
    });
  });

  it('una regola di box corregge la sezione e il suo colore; il motivo è la regola', () => {
    const r = regole({
      id: 'r1', titolo: 'Pulizia casa da regola', livello: 'box', sezione: 'Pulizia casa', colore: '#ff0000',
      condizione: gruppo(['mastro', 'contiene', 'PULIZIA']),
    });
    const pagina22 = menabo(RIGHE, BOX, r)!.pagine.find(p => p.pagina === 22);
    expect(pagina22).toEqual({ pagina: 22, sezione: 'Pulizia casa', nome: 'Pulizia casa', colore: '#ff0000', regola: 'Pulizia casa da regola' });
  });

  it('le altre pagine restano quelle di prima', () => {
    const r = regole({ id: 'r1', livello: 'box', sezione: 'Pulizia casa', condizione: gruppo(['mastro', 'contiene', 'PULIZIA']) });
    const altre = menabo(RIGHE, BOX, r)!.pagine.filter(p => p.pagina !== 22);
    expect(altre.map(p => p.nome)).toEqual(['Dispensa', 'Principale']);
    expect(altre.every(p => !('regola' in p))).toBe(true);
  });

  it('«non è una sezione»: i box non contano; la pagina mostra la sezione degli altri', () => {
    const righe = [...RIGHE, riga('o1', { mastro: 'Og-OFFERTE generiche', reparto: '1', tema: 'z' })];
    const box = [...BOX, scatola('o1', 26)];
    const r = regole({ id: 'r1', livello: 'box', sezione: null, condizione: gruppo(['mastro', 'uguale', 'A-Principale']) });
    expect(menabo(righe, box, r)!.pagine.find(p => p.pagina === 26)?.nome).toBe('Offerte generiche');
    // La pagina con i soli box «non sezione» sparisce dal menabò
    expect(menabo(RIGHE, BOX, r)!.pagine.find(p => p.pagina === 26)).toBeUndefined();
  });

  it('condizioni composte: il box del reparto 84 esce dalla regola', () => {
    const r = regole({
      id: 'r1', livello: 'box', sezione: 'Pulizia casa',
      condizione: {
        tipo: 'gruppo', logica: 'tutte', figli: [
          { tipo: 'condizione', campo: 'mastro', operatore: 'inizia', valore: 'PUL', valori: [] },
          { tipo: 'gruppo', logica: 'nessuna', figli: [{ tipo: 'condizione', campo: 'reparto', operatore: 'uguale', valore: '84', valori: [] }] },
        ],
      },
    });
    const righe = [riga('a1', { mastro: 'PUL-PULIZIA_singola', reparto: '5' }), riga('a2', { mastro: 'PUL-PULIZIA_singola', reparto: '84' }), riga('a3', { mastro: 'PUL-PULIZIA_singola', reparto: '84' })];
    const box = [scatola('a1', 22), scatola('a2', 22), scatola('a3', 22)];
    // Un box con la regola («Pulizia casa») contro due con la mastro («Pulizia»): vince la sezione di più box
    expect(menabo(righe, box, r)!.pagine[0].nome).toBe('Pulizia');
    // Con due box che soddisfano la regola, la regola vince
    expect(menabo([righe[0], riga('a2', { mastro: 'PUL-X', reparto: '5' }), righe[2]], box, r)!.pagine[0].nome).toBe('Pulizia casa');
  });

  it('nome da modello con la trasformazione «leggibile» della libreria', () => {
    const r = regole({ id: 'r1', livello: 'box', sezione: '{mastro|leggibile} da regola', condizione: gruppo(['mastro', 'non_vuoto']) });
    expect(menabo(RIGHE, BOX, r)!.pagine.map(p => p.nome)).toEqual(['Dispensa da regola', 'Pulizia da regola', 'Principale da regola']);
  });
});

describe('menabò con regole di pagina', () => {
  it('una regola di pagina decide la pagina intera, qualunque sia la sezione dei box', () => {
    const r = regole({
      id: 'p', titolo: 'Centrali', livello: 'pagina', sezione: 'Offerte generiche', colore: '#123456',
      condizione: gruppo(['@pagina', 'tra', '', ['12', '21']]),
    });
    const esito = menabo(RIGHE, BOX, r)!;
    expect(esito.pagine.find(p => p.pagina === 14)).toEqual({ pagina: 14, sezione: 'Offerte generiche', nome: 'Offerte generiche', colore: '#123456', regola: 'Centrali' });
    expect(esito.pagine.find(p => p.pagina === 22)?.nome).toBe('Pulizia');
  });

  it('la regola di pagina vince sulla regola di box', () => {
    const r = regole(
      { id: 'b', livello: 'box', sezione: 'Da box', condizione: gruppo(['mastro', 'non_vuoto']) },
      { id: 'p', livello: 'pagina', sezione: 'Da pagina', condizione: gruppo(['@pagina', 'uguale', '22']) },
    );
    const esito = menabo(RIGHE, BOX, r)!;
    expect(esito.pagine.find(p => p.pagina === 22)?.nome).toBe('Da pagina');
    expect(esito.pagine.find(p => p.pagina === 14)?.nome).toBe('Da box');
  });

  it('pagina che non è una sezione: sparisce dal menabò', () => {
    const r = regole({ id: 'p', livello: 'pagina', sezione: null, condizione: gruppo(['@pagina', 'uguale', '14']) });
    expect(menabo(RIGHE, BOX, r)!.pagine.map(p => p.pagina)).toEqual([22, 26]);
  });

  it('@prima_pagina e @ultima_pagina', () => {
    const r = regole(
      { id: 'u', livello: 'pagina', sezione: 'Ultima', condizione: gruppo(['@ultima_pagina', 'uguale', '1']) },
      { id: 'f', livello: 'pagina', sezione: 'Prima', condizione: gruppo(['@prima_pagina', 'uguale', '1']) },
    );
    const righe = [riga('x', { mastro: 'A-Uno' }), riga('y', { mastro: 'B-Due' })];
    const esito = menabo(righe, [scatola('x', 1), scatola('y', 9)], r)!;
    expect(esito.pagine.map(p => [p.pagina, p.nome])).toEqual([[1, 'Prima'], [9, 'Ultima']]);
  });

  it('una condizione di pagina su un campo vale se la soddisfa almeno un box della pagina', () => {
    const r = regole({ id: 'p', livello: 'pagina', sezione: 'Con reparto 84', condizione: gruppo(['reparto', 'uguale', '84']) });
    expect(menabo(RIGHE, BOX, r)!.pagine.find(p => p.pagina === 22)?.nome).toBe('Con reparto 84');
  });
});

describe('regole senza la dichiarazione del menabò del cliente', () => {
  it('senza menabò dichiarato le regole non si applicano e il menabò non compare', () => {
    const r = regole({ id: 'r', livello: 'box', sezione: 'X', condizione: gruppo(['mastro', 'non_vuoto']) });
    expect(menaboDi(BOX, opzioniDellAgenzia(undefined, RIGHE, r))).toBeNull();
    expect(menaboDi(BOX, opzioniDellAgenzia({} as never, RIGHE, r))).toBeNull();
  });
});

describe('@reparto_nome: il nome del reparto, uguale in ogni volantino', () => {
  // Stesso reparto scritto come nei tre formati di sigla_reparto dei volantini veri
  const righe = [
    riga('l1', { sigla_reparto: 'GRUPPO F  - FRESCHISSIMI - POP_LS', reparto: '24', mastro: 'Og-OFFERTE generiche' }),
    riga('l2', { sigla_reparto: 'LS', reparto: '24', mastro: 'Og-OFFERTE generiche' }),
    riga('l3', { sigla_reparto: '1', reparto: '01', mastro: 'Og-OFFERTE generiche' }),
  ];
  const lettura = {
    repartoConfigurato: (id: string) => ({ l1: { codice: '24', descrizione: 'FRESCHI' }, l2: { codice: '24', descrizione: 'FRESCHI' }, l3: { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' } } as Record<string, { codice: string; descrizione: string }>)[id] ?? null,
    risolviReparto: (r: { codice: string; descrizione: string }) =>
      r.codice === '24' ? { ...r, codice: '24', descrizione: 'Freschissimi', marketing: true }
        : /^0?1$/.test(r.codice) ? { ...r, codice: '1', descrizione: 'Dispensa', marketing: true } : r,
  };
  const regolaReparto = regole({ id: 'r', livello: 'box', sezione: '{@reparto_nome}', condizione: gruppo(['@reparto_nome', 'non_vuoto']) });
  const conReparti = (box: BoxKit[], r: RegolaMenabo[]) => menaboDi(box, opzioniDellAgenzia(agenzia, righe, r, lettura as never));

  it('la sezione è il nome del reparto, qualunque sia la scrittura di sigla_reparto', () => {
    const esito = conReparti([scatola('l1', 11), scatola('l2', 12), scatola('l3', 13)], regolaReparto)!;
    expect(esito.pagine.map(p => [p.pagina, p.nome])).toEqual([[11, 'Freschissimi'], [12, 'Freschissimi'], [13, 'Dispensa']]);
  });

  it('la pagina con più reparti prende quello con più box', () => {
    const esito = conReparti([scatola('l1', 11), scatola('l2', 11), scatola('l3', 11)], regolaReparto)!;
    expect(esito.pagine[0].nome).toBe('Freschissimi');
  });

  it('senza nome per il marketing il reparto è la descrizione come frase; senza reparto la regola non decide', () => {
    const senzaNomi = { repartoConfigurato: lettura.repartoConfigurato };
    expect(menaboDi([scatola('l3', 13)], opzioniDellAgenzia(agenzia, righe, regolaReparto, senzaNomi as never))!.pagine[0].nome).toBe('Drogheria alimentare');
    const nessuno = menaboDi([scatola('l3', 13)], opzioniDellAgenzia(agenzia, [riga('l3', { mastro: 'DIS-DISPENSA_doppia' })], regolaReparto))!;
    expect(nessuno.pagine[0].nome).toBe('Dispensa');
  });

  it('senza regole il menabò è quello di prima anche con la lettura dei reparti', () => {
    expect(conReparti([scatola('l1', 11)], [])).toEqual(menabo(righe, [scatola('l1', 11)]));
  });
});

describe('menabò sempre corretto: pagine generiche, quota minima ed ereditarietà', () => {
  // Come nel volantino P2620: pagine sul master generico, con il reparto che dà il titolo stampato
  const nomiReparto: Record<string, string> = { '1': 'La Dispensa', '3': 'Bevande', '24': 'Freschi', '25': 'Freschi', '84': 'Occasioni Extra' };
  const lettura = {
    repartoConfigurato: (id: string) => {
      const codice = id.split('-')[0];
      return { codice, descrizione: codice };
    },
    risolviReparto: (r: { codice: string; descrizione: string }) => ({ ...r, descrizione: nomiReparto[r.codice] ?? r.descrizione, marketing: true }),
  };
  const GENERICA = 'Og-OFFERTE generiche';
  // id = «codice reparto-numero»: il reparto si legge dall'id
  const generica = (reparto: string, n: number, pagina: number) => ({ riga: riga(`${reparto}-${n}`, { mastro: GENERICA, reparto }), box: scatola(`${reparto}-${n}`, pagina) });
  const conPagine = (pezzi: Array<ReturnType<typeof generica>>, r: RegolaMenabo[]) =>
    menaboDi(pezzi.map(p => p.box), opzioniDellAgenzia(agenzia, pezzi.map(p => p.riga), r, lettura as never))!.pagine;
  const perPagina = (pagine: ReturnType<typeof conPagine>) => pagine.map(p => [p.pagina, p.nome]);

  const regolaGenerica = {
    id: 'g', titolo: 'Titolo dal reparto', livello: 'pagina', sezione: '{@reparto_prevalente}',
    condizione: gruppo(['@mastro_prevalente', 'contiene', 'Og-'], ['@quota_reparto_prevalente', 'tra', '', ['80', '100']]),
  };
  const regolaEredita = {
    id: 'e', titolo: 'Come la pagina prima', livello: 'pagina', sezione: '{@sezione_precedente}',
    condizione: gruppo(['@mastro_prevalente', 'contiene', 'Og-'], ['@sezione_precedente', 'non_vuoto']),
  };

  it('la pagina generica prende il reparto prevalente se arriva alla soglia', () => {
    const pezzi = [
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => generica('1', n, 16)),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => generica('3', n, 19)),
      generica('1', 11, 19),
    ];
    const pagine = conPagine(pezzi, regole(regolaGenerica));
    expect(perPagina(pagine)).toEqual([[16, 'La Dispensa'], [19, 'Bevande']]);
    expect(pagine[0]).toMatchObject({ regola: 'Titolo dal reparto' });
  });

  it('sotto soglia la regola non decide: resta la sezione di prima (Offerte generiche)', () => {
    const pezzi = [generica('1', 1, 15), generica('1', 2, 15), generica('1', 3, 15), generica('3', 1, 15), generica('3', 2, 15)];
    expect(perPagina(conPagine(pezzi, regole(regolaGenerica)))).toEqual([[15, 'Offerte generiche']]);
  });

  it('una pagina con un master specifico non è toccata dalla regola delle pagine generiche', () => {
    const specifica = { riga: riga('84-1', { mastro: 'OF-ORTOFRUTTA', reparto: '84' }), box: scatola('84-1', 10) };
    expect(perPagina(conPagine([specifica], regole(regolaGenerica)))).toEqual([[10, 'Ortofrutta']]);
  });

  it('la pagina senza titolo eredita la sezione della pagina prima, in sequenza', () => {
    const pezzi = [
      ...[1, 2, 3, 4].map(n => generica('24', n, 13)),
      ...[1, 2].map(n => generica('24', n, 14)), ...[1, 2].map(n => generica('3', n, 14)),
      ...[1, 2].map(n => generica('1', n, 15)), ...[1, 2].map(n => generica('3', n, 15)),
    ];
    const pagine = conPagine(pezzi, regole(regolaGenerica, regolaEredita));
    expect(perPagina(pagine)).toEqual([[13, 'Freschi'], [14, 'Freschi'], [15, 'Freschi']]);
    // La prima pagina senza pagina prima non eredita niente
    expect(perPagina(conPagine([generica('1', 1, 5), generica('3', 1, 5)], regole(regolaGenerica, regolaEredita)))).toEqual([[5, 'Offerte generiche']]);
  });

  it('le pagine che non sono consecutive non ereditano', () => {
    const pezzi = [...[1, 2, 3].map(n => generica('24', n, 13)), generica('1', 1, 16), generica('3', 1, 16)];
    expect(perPagina(conPagine(pezzi, regole(regolaGenerica, regolaEredita)))).toEqual([[13, 'Freschi'], [16, 'Offerte generiche']]);
  });

  it('quota minima: un solo box che soddisfa la regola non decide la pagina', () => {
    const pezzi = [
      { riga: riga('a', { mastro: 'PB-Pagina bianca', reparto: '1' }), box: scatola('a', 27) },
      { riga: riga('b', { mastro: 'PB-Pagina bianca', reparto: '24' }), box: scatola('b', 27) },
      { riga: riga('c', { mastro: 'PB-Pagina bianca', reparto: '24' }), box: scatola('c', 27) },
      { riga: riga('d', { mastro: 'PB-Pagina bianca', reparto: '5' }), box: scatola('d', 27) },
    ];
    const dispensa = (quotaMinima?: number) => regole({
      id: 'd', titolo: 'La dispensa', livello: 'box', sezione: 'La Dispensa', condizione: gruppo(['reparto', 'uguale', '1']), ...(quotaMinima ? { quotaMinima } : {}),
    });
    const nome = (r: RegolaMenabo[]) => menaboDi(pezzi.map(p => p.box), opzioniDellAgenzia(agenzia, pezzi.map(p => p.riga), r))?.pagine.map(p => p.nome);
    // Senza quota: un box decide la pagina (il comportamento di sempre)
    expect(nome(dispensa())).toEqual(['La Dispensa']);
    // Con il 50%: un box su quattro non basta, i box tornano alla sezione di prima (pagina bianca: nessuna sezione)
    expect(nome(dispensa(50))).toBeUndefined();
    // Con il 25%: un box su quattro basta
    expect(nome(dispensa(25))).toEqual(['La Dispensa']);
  });

  it('senza i nuovi campi e senza quota le regole fanno quello di prima', () => {
    const r = regole({ id: 'r1', livello: 'box', sezione: 'Pulizia casa', condizione: gruppo(['mastro', 'contiene', 'PULIZIA']) });
    expect(menabo(RIGHE, BOX, r)!.pagine.find(p => p.pagina === 22)?.nome).toBe('Pulizia casa');
  });
});
