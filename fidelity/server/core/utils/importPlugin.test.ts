import { describe, expect, it } from 'vitest';
import { loghiDelPlugin } from './importPlugin';
import { lineaEBolli, regoleLinee, sigleAssegnate } from './lineeDistributore';

describe('loghiDelPlugin', () => {
  it('porta i loghi e i bolli del plugin nella forma di Istanta, attivi e con guidId', () => {
    expect(loghiDelPlugin([
      { sigla: 'conad_saporidintorni', tipo: 3, guid_id: 'g-1' },
      { sigla: ' boll_STAR ', tipo: 2, guid_id: ' g-2 ' },
    ])).toEqual([
      { tipo: 3, sigla: 'conad_saporidintorni', guidId: 'g-1', attiva: true },
      { tipo: 2, sigla: 'boll_STAR', guidId: 'g-2', attiva: true },
    ]);
  });

  it('accetta anche guidId, come nei loghi di Istanta', () => {
    expect(loghiDelPlugin([{ sigla: 'conad_cpq', tipo: 3, guidId: 'g-istanta' }]))
      .toEqual([{ tipo: 3, sigla: 'conad_cpq', guidId: 'g-istanta', attiva: true }]);
  });

  it('scarta i loghi non caricati su Olimpo, senza sigla o senza tipo numerico', () => {
    expect(loghiDelPlugin([
      { sigla: 'Logo_VistoinTV', tipo: 3, guid_id: '' },
      { sigla: 'Logo_VistoinTV', tipo: 3, guid_id: '   ' },
      { sigla: 'conad_bio', tipo: 3 },
      { sigla: '', tipo: 3, guid_id: 'g-1' },
      { sigla: 'conad_vn', tipo: '3', guid_id: 'g-2' },
      { sigla: 'conad_vn', tipo: Number.NaN, guid_id: 'g-3' },
      null,
      'conad_logo',
    ])).toEqual([]);
  });

  it('senza foto_extra, o con un valore che non e un elenco, nessun logo', () => {
    expect(loghiDelPlugin(undefined)).toEqual([]);
    expect(loghiDelPlugin(null)).toEqual([]);
    expect(loghiDelPlugin({ sigla: 'conad_cpq', tipo: 3, guid_id: 'g-1' })).toEqual([]);
  });

  it('i loghi salvati danno agli insight la linea e i bolli del box dello storico', () => {
    const regole = regoleLinee({
      linee: [{ sigla: 'conad_saporidintorni', nome: 'Sapori & Dintorni' }, { sigla: 'conad_cpq', nome: 'Percorso Qualità' }],
      bolli: [{ sigla: 'LOGO_filiera', nome: 'Filiera controllata' }],
      // Il testo direbbe Percorso Qualità: il logo stampato nel box vince
      lineaDaTesti: () => 'conad_cpq',
    });
    const salvati = loghiDelPlugin([
      { sigla: 'conad_saporidintorni', tipo: 3, guid_id: 'g-1' },
      { sigla: 'LOGO_filiera', tipo: 3, guid_id: 'g-2' },
    ]);

    const assegnate = sigleAssegnate(salvati);

    expect(assegnate).toEqual(['conad_saporidintorni', 'LOGO_filiera']);
    expect(lineaEBolli(assegnate, { marca: 'Conad Percorso Qualità', descrizione: 'Passata', gusto: null }, regole!)).toEqual({
      linea: { sigla: 'conad_saporidintorni', nome: 'Sapori & Dintorni' },
      bolli: ['LOGO_filiera'],
    });
  });
});
