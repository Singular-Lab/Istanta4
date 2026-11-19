import { describe, expect, it } from 'vitest';
import {
  chiaveCoppia,
  codiceDoppio,
  codiciDoppi,
  coppieMembro,
  eProxy,
  idPezzo,
  kitConfusiDaIstanta,
  messaggioKitConfusi,
  pezziDelDesign,
  pezziDellaCombinazione,
  problemiVoce,
  proxyCheContengono,
  proxyDaVoci,
  vociRichieste,
  type ProxyNoti,
  type VoceAnagrafica,
} from '../areeCanali/proxy';

// Canali di una GDO Conad: SSCNCY e' il proxy del RIL (Superstore, Conad, City)
const SS: VoceAnagrafica = { id: 'ss', codice: 'SS', nome: 'Superstore', membri: [] };
const CN: VoceAnagrafica = { id: 'cn', codice: 'CN', nome: 'Conad', membri: [] };
const CY: VoceAnagrafica = { id: 'cy', codice: 'CY', nome: 'City', membri: [] };
const SSCNCY: VoceAnagrafica = { id: 'sscncy', codice: 'SSCNCY', nome: 'Superstore + Conad + City', membri: ['ss', 'cn', 'cy'] };
const canali = [SS, CN, CY, SSCNCY];

const proxy: ProxyNoti = {
  canali: new Map([['sscncy', ['ss', 'cn', 'cy']]]),
  aree: new Map([['toli', ['to', 'li']]]),
};

describe('proxy di canali e aree', () => {
  it('un proxy ha almeno due membri', () => {
    expect(eProxy(['ss', 'cn'])).toBe(true);
    expect(eProxy(['ss'])).toBe(false);
    expect(eProxy([])).toBe(false);
    expect(eProxy(null)).toBe(false);
  });

  it('i proxy si leggono dall\'anagrafica', () => {
    const { canali: perCanale, aree } = proxyDaVoci(canali, [{ id: 'to', codice: 'TO', nome: 'Toscana', membri: [] }]);
    expect([...perCanale]).toEqual([['sscncy', ['ss', 'cn', 'cy']]]);
    expect(aree.size).toBe(0);
  });

  it('Istanta che chiede un proxy riceve anche i membri; chiedendo un membro riceve solo quello', () => {
    expect(vociRichieste('sscncy', proxy.canali)).toEqual(['sscncy', 'ss', 'cn', 'cy']);
    expect(vociRichieste('ss', proxy.canali)).toEqual(['ss']);
    expect(vociRichieste('toli', proxy.aree)).toEqual(['toli', 'to', 'li']);
  });

  it('le coppie di una combinazione proxy sono quelle dei membri, canali per aree', () => {
    expect(coppieMembro('sscncy', 'la', proxy)).toEqual([['ss', 'la'], ['cn', 'la'], ['cy', 'la']]);
    expect(coppieMembro('ss', 'toli', proxy)).toEqual([['ss', 'to'], ['ss', 'li']]);
    expect(coppieMembro('sscncy', 'toli', proxy)).toHaveLength(6);
    expect(coppieMembro('ss', 'la', proxy)).toEqual([['ss', 'la']]);
  });
});

describe('pezzi di un design proxy per Istanta', () => {
  const attive = new Set([chiaveCoppia('ss', 'la'), chiaveCoppia('cn', 'la'), chiaveCoppia('cy', 'la')]);
  const ril = { guidId: 'd-ril', titolo: 'RIL', guidCanale: 'sscncy', guidArea: 'la', guidFormato: 'f1' };

  it('il design RIL su SSCNCY·LA diventa SS·LA, CN·LA e CY·LA, ognuno con il suo id', () => {
    const pezzi = pezziDelDesign(ril, proxy, attive);

    expect(pezzi.map(p => [p.guidCanale, p.guidArea])).toEqual([['ss', 'la'], ['cn', 'la'], ['cy', 'la']]);
    expect(pezzi.every(p => 'pezzo' in p && p.pezzo && p.guidIdDesign === 'd-ril' && p.titolo === 'RIL' && p.guidFormato === 'f1')).toBe(true);
    expect(new Set(pezzi.map(p => p.guidId)).size).toBe(3);
    expect(pezzi.map(p => p.guidId)).not.toContain('d-ril');
  });

  it("l'id di un pezzo e' sempre lo stesso, e cambia con design, canale o area", () => {
    expect(idPezzo('d-ril', 'ss', 'la')).toBe(idPezzo('d-ril', 'ss', 'la'));
    expect(idPezzo('d-ril', 'ss', 'la')).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set([idPezzo('d-ril', 'ss', 'la'), idPezzo('d-ril', 'cn', 'la'), idPezzo('d-ril', 'ss', 'to'), idPezzo('d-x', 'ss', 'la')]).size).toBe(4);
  });

  it('una combinazione membro disattiva o assente non da\' un pezzo', () => {
    const soloDue = new Set([chiaveCoppia('ss', 'la'), chiaveCoppia('cn', 'la')]);
    expect(pezziDelDesign(ril, proxy, soloDue).map(p => p.guidCanale)).toEqual(['ss', 'cn']);
  });

  it('un design normale resta lo stesso oggetto', () => {
    const normale = { guidId: 'd-vol', guidCanale: 'ss', guidArea: 'la' };
    expect(pezziDelDesign(normale, proxy, attive)).toEqual([normale]);
    expect(pezziDelDesign(normale, proxy, attive)[0]).toBe(normale);
  });

  it('la pagina dice in cosa si divide una combinazione proxy e cosa manca', () => {
    const combinazioni = [
      { id: 'c1', id_canale: 'ss', id_area: 'la', stato: 'ATTIVO' },
      { id: 'c2', id_canale: 'cn', id_area: 'la', stato: 'DISATTIVO' },
    ];
    expect(pezziDellaCombinazione({ id_canale: 'sscncy', id_area: 'la' }, proxy, combinazioni)).toEqual([
      { idCanale: 'ss', idArea: 'la', combinazione: combinazioni[0], attiva: true },
      { idCanale: 'cn', idArea: 'la', combinazione: combinazioni[1], attiva: false },
      { idCanale: 'cy', idArea: 'la', combinazione: undefined, attiva: false },
    ]);
  });
});

describe('kit che Istanta unirebbe', () => {
  const base = { guidIdRaccoglitore: 'r1', guidFormato: 'f1', guidCanale: 'ss', guidArea: 'la' };

  it('pezzo SS·LA del RIL e kit VOL su SS·LA, stesso raccoglitore e formato: uniti, con un messaggio chiaro', () => {
    const pezzo = { ...base, guidId: 'p1', titolo: 'RIL', pezzo: true };
    const vol = { ...base, guidId: 'k2', titolo: 'VOL SS' };

    const coppie = kitConfusiDaIstanta([pezzo, vol]);

    expect(coppie).toEqual([[pezzo, vol]]);
    expect(messaggioKitConfusi(coppie)).toContain('"RIL" e "VOL SS"');
    expect(messaggioKitConfusi(coppie)).toContain('pezzo di un kit proxy');
  });

  it('formato, raccoglitore o combinazione diversi: nessun problema', () => {
    const pezzo = { ...base, guidId: 'p1', pezzo: true };
    expect(kitConfusiDaIstanta([pezzo, { ...base, guidId: 'k2', guidFormato: 'f2' }])).toEqual([]);
    expect(kitConfusiDaIstanta([pezzo, { ...base, guidId: 'k3', guidIdRaccoglitore: 'r2' }])).toEqual([]);
    expect(kitConfusiDaIstanta([pezzo, { ...base, guidId: 'k4', guidCanale: 'cn' }])).toEqual([]);
  });

  it('due kit normali uguali non riguardano i proxy', () => {
    expect(kitConfusiDaIstanta([{ ...base, guidId: 'k1' }, { ...base, guidId: 'k2' }])).toEqual([]);
  });
});

describe('salvataggio di un canale o di un\'area', () => {
  it('un proxy nuovo con membri validi si salva', () => {
    const nuovo = { id: 'n1', codice: 'SSCN', membri: ['ss', 'cn'] };
    expect(problemiVoce('canale', nuovo, canali, null)).toEqual([]);
  });

  it('un solo membro, un membro ripetuto, sé stesso, un proxy o una voce di un\'altra GDO non vanno', () => {
    expect(problemiVoce('canale', { id: 'n1', codice: 'X1', membri: ['ss'] }, canali)).toEqual(['Un proxy ha almeno 2 membri.']);
    expect(problemiVoce('canale', { id: 'n1', codice: 'X1', membri: ['ss', 'ss'] }, canali)).toContain('Un membro non può comparire due volte.');
    expect(problemiVoce('canale', { id: 'n1', codice: 'X1', membri: ['n1', 'ss'] }, canali)).toContain('Un proxy non può essere membro di sé stesso.');
    expect(problemiVoce('canale', { id: 'n1', codice: 'X1', membri: ['sscncy', 'ss'] }, canali))
      .toContain('Superstore + Conad + City è a sua volta un proxy: non può essere membro.');
    expect(problemiVoce('area', { id: 'n1', codice: 'X1', membri: ['altrove', 'to'] }, [{ id: 'to', codice: 'TO', nome: 'Toscana', membri: [] }]))
      .toContain('Un membro non è fra le aree della GDO.');
  });

  it('un codice già usato nella GDO si rifiuta, senza distinguere le maiuscole', () => {
    expect(problemiVoce('canale', { id: 'n1', codice: ' ss ', membri: [] }, canali)).toEqual(['Il codice ss è già usato dal canale Superstore.']);
  });

  it('una voce già doppia si modifica se non cambia codice', () => {
    const doppia: VoceAnagrafica = { id: 'lo2', codice: 'LO', nome: 'Lombardia', membri: [] };
    const aree = [{ id: 'lo1', codice: 'LO', nome: 'Lombardia', membri: [] }, doppia];
    expect(problemiVoce('area', { id: 'lo2', codice: 'LO', membri: [] }, aree, doppia)).toEqual([]);
  });

  it('il tipo non cambia dopo la creazione', () => {
    expect(problemiVoce('canale', { id: 'ss', codice: 'SS', membri: ['cn', 'cy'] }, canali, SS))
      .toContain('Una voce esistente non diventa un proxy: crea un proxy nuovo.');
    expect(problemiVoce('canale', { id: 'sscncy', codice: 'SSCNCY', membri: [] }, canali, SSCNCY))
      .toContain('Un proxy resta un proxy: per tornare a una voce normale eliminalo e creane una nuova.');
  });

  it('un membro di un proxy non si elimina finché il proxy lo contiene', () => {
    expect(proxyCheContengono('cn', canali)).toEqual([SSCNCY]);
    expect(proxyCheContengono('sscncy', canali)).toEqual([]);
  });

  it('i codici doppi si trovano senza distinguere le maiuscole', () => {
    const doppi = codiciDoppi([{ codice: 'LO' }, { codice: 'lo' }, { codice: 'TO' }]);
    expect(codiceDoppio('Lo', doppi)).toBe(true);
    expect(codiceDoppio('TO', doppi)).toBe(false);
  });
});
