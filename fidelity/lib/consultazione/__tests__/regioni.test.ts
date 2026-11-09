import { describe, expect, it } from 'vitest';
import {
  isCodiceRegione,
  nomeRegione,
  REGIONI,
  regioneDa,
  regioneDaProvincia,
  regioneDaTesto,
  testoNormalizzato,
} from '../regioni';

// La regione di un punto vendita stampato in un volantino (spec volantini-pop, "Dettaglio di
// consultazione della promozione"): regione e provincia arrivano come le stampa il cliente.

describe('regioni italiane', () => {
  it('sono venti, con codici diversi, e ognuna ha il suo nome', () => {
    expect(REGIONI).toHaveLength(20);
    expect(new Set(REGIONI.map(regione => regione.codice)).size).toBe(20);
    expect(nomeRegione('EMR')).toBe('Emilia-Romagna');
    expect(nomeRegione('VDA')).toBe("Valle d'Aosta");
  });

  it('un codice sconosciuto non e\' una regione e come nome vale il codice stesso', () => {
    expect(isCodiceRegione('TOS')).toBe(true);
    for (const valore of ['tos', 'XX', '', null, undefined, 1]) expect(isCodiceRegione(valore), String(valore)).toBe(false);
    expect(nomeRegione('XX')).toBe('XX');
  });
});

describe('testoNormalizzato', () => {
  it('maiuscole, senza accenti, solo lettere separate da uno spazio', () => {
    expect(testoNormalizzato('Forlì-Cesena')).toBe('FORLI CESENA');
    expect(testoNormalizzato("  Valle d'Aosta ")).toBe('VALLE D AOSTA');
    expect(testoNormalizzato('Reggio nell’Emilia')).toBe('REGGIO NELL EMILIA');
  });

  it('senza testo, una stringa vuota', () => {
    expect(testoNormalizzato(null)).toBe('');
    expect(testoNormalizzato(undefined)).toBe('');
    expect(testoNormalizzato(' - ')).toBe('');
  });
});

describe('regioneDaTesto', () => {
  it('riconosce la regione comunque sia scritta: con o senza trattino, maiuscole, codice', () => {
    for (const testo of ['EMILIA ROMAGNA', 'Emilia-Romagna', 'emilia romagna ', 'EMILIA-ROMAGNA', 'EMR']) {
      expect(regioneDaTesto(testo), testo).toBe('EMR');
    }
    expect(regioneDaTesto("Valle d'Aosta")).toBe('VDA');
    expect(regioneDaTesto('Friuli V.G.')).toBe('FVG');
    expect(regioneDaTesto('Trentino-Alto Adige')).toBe('TAA');
    expect(regioneDaTesto('TRENTINO')).toBe('TAA');
  });

  it('null quando non e\' una regione', () => {
    for (const testo of ['Atlantide', 'FIRENZE', '', null, undefined]) expect(regioneDaTesto(testo), String(testo)).toBeNull();
  });
});

describe('regioneDaProvincia', () => {
  it('dalla sigla o dal nome per esteso della provincia', () => {
    expect(regioneDaProvincia('MO')).toBe('EMR');
    expect(regioneDaProvincia('mo')).toBe('EMR');
    expect(regioneDaProvincia('GROSSETO')).toBe('TOS');
    expect(regioneDaProvincia('Forlì-Cesena')).toBe('EMR');
    expect(regioneDaProvincia('Reggio Calabria')).toBe('CAL');
    expect(regioneDaProvincia('RM')).toBe('LAZ');
  });

  it('riconosce anche le province sarde soppresse', () => {
    for (const provincia of ['MEDIO CAMPIDANO', 'VS', 'CARBONIA IGLESIAS', 'CI', 'OLBIA TEMPIO', 'OT', 'OGLIASTRA', 'OG', 'SUD SARDEGNA', 'SU']) {
      expect(regioneDaProvincia(provincia), provincia).toBe('SAR');
    }
  });

  it('null quando non e\' una provincia', () => {
    for (const provincia of ['XX', 'TOSCANA', '', null, undefined]) expect(regioneDaProvincia(provincia), String(provincia)).toBeNull();
  });
});

describe('regioneDa', () => {
  it('prima la regione stampata, poi la provincia stampata', () => {
    expect(regioneDa({ regione: 'TOSCANA', provincia: 'MO' })).toBe('TOS');
    expect(regioneDa({ regione: '', provincia: 'MO' })).toBe('EMR');
    expect(regioneDa({ regione: 'Centro Italia', provincia: 'GROSSETO' })).toBe('TOS');
  });

  it('senza regione e provincia stampate riconoscibili, regione e provincia dell\'anagrafica del PV abbinato', () => {
    expect(regioneDa({ regione: null, provincia: null, regioneAnagrafica: 'Lazio', provinciaAnagrafica: 'MI' })).toBe('LAZ');
    expect(regioneDa({ provincia: 'XX', regioneAnagrafica: null, provinciaAnagrafica: 'RM' })).toBe('LAZ');
    // La riga stampata vale piu' dell'anagrafica
    expect(regioneDa({ provincia: 'GR', regioneAnagrafica: 'Lazio' })).toBe('TOS');
  });

  it('null quando nessuna fonte si riconosce', () => {
    expect(regioneDa({})).toBeNull();
    expect(regioneDa({ regione: null, provincia: null, regioneAnagrafica: null, provinciaAnagrafica: null })).toBeNull();
    expect(regioneDa({ regione: 'Atlantide', provincia: 'XX', regioneAnagrafica: '', provinciaAnagrafica: 'ZZ' })).toBeNull();
  });
});
