import { describe, expect, it } from 'vitest';
import type { PosizioneRiga } from '../../../lib/puntiVendita/analisi';
import type { PuntoVenditaDaConfrontare } from './confrontoPuntiVendita';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';
import { contaPerEsito, type RigaCollegata, verificaCollegamenti } from './verificaCollegamenti';

// La verifica dei collegamenti fra righe dei volantini e PV: esito, motivi e PV vicini

const PV_SPEZIA = 'pv-spezia';
const PV_SARZANA = 'pv-sarzana';
const PV_SARZANA_DUE = 'pv-sarzana-2';

const puntoVendita = (id: string, sovrascritti: Partial<PuntoVenditaDaConfrontare> = {}): PuntoVenditaDaConfrontare => ({
  id, nome: id, telefono: null, citta: 'Sarzana', indirizzo: 'Via Variante Aurelia 1', provincia: 'SP',
  idCanale: 'SP', nomeCanale: 'Spazio Conad', idArea: 'LI', nomeArea: 'Liguria', lat: 44.1100, lon: 9.9600, ...sovrascritti,
});

let progressivo = 0;
const riga = (sovrascritti: Partial<RigaCollegata> & { indirizzoStampato?: string; telefonoStampato?: string } = {}): RigaCollegata => {
  const { indirizzoStampato = 'Via Variante Aurelia 1', telefonoStampato, ...resto } = sovrascritti;
  return {
    id: `r${++progressivo}`, idKit: 'kit-1', data: '2026-10-01', idCanale: 'SP', nomeCanale: 'Spazio Conad', idArea: 'LI', nomeArea: 'Liguria',
    posizione: 1, riga: `SARZANA - ${indirizzoStampato}`, localita: 'SARZANA', indirizzo: indirizzoStampato, telefono: telefonoStampato ?? null,
    chiaveIndirizzo: chiaveIndirizzo(indirizzoStampato), chiaveTelefono: chiaveTelefono(telefonoStampato), provincia: 'SP',
    titoloKit: 'SP LI 40', idPuntoVendita: PV_SARZANA, abbinamento: 'indirizzo', ...resto,
  };
};

const posizioneDi = (localita: string, indirizzo: string, lat: number, lon: number, precisione: PosizioneRiga['precisione'] = 'via'): [string, PosizioneRiga] => {
  const chiave = `ind:${localita}|${chiaveIndirizzo(indirizzo)}`;
  return [chiave, { chiave, lat, lon, precisione, fonte: 'nominatim', errore: null, aggiornataIl: '2026-11-11T09:00:00.000Z' }];
};

describe('verificaCollegamenti', () => {
  it('stesso indirizzo, stessa combinazione, a pochi metri: coerente, senza motivi gravi', () => {
    const posizioni = new Map([posizioneDi('SARZANA', 'Via Variante Aurelia 1', 44.1101, 9.9601)]);

    const [gruppo] = verificaCollegamenti([riga()], [puntoVendita(PV_SARZANA)], posizioni, []);

    expect(gruppo).toMatchObject({ esito: 'coerente', tipo: 'automatico', abbinamenti: ['indirizzo'], idCollegamento: null, volantini: 1 });
    expect(gruppo.confronto.distanzaMetri).toBeLessThan(20);
    expect(gruppo.motivi).toEqual([]);
  });

  it('canale o area del PV diversi da quelli dei volantini: incongruente, con le due combinazioni', () => {
    const [gruppo] = verificaCollegamenti([riga({ idArea: 'TO', nomeArea: 'Toscana' })], [puntoVendita(PV_SARZANA)], new Map(), []);

    expect(gruppo.esito).toBe('incongruente');
    expect(gruppo.motivi[0]).toEqual({
      tipo: 'combinazione_diversa',
      livello: 'incongruente',
      testo: 'Il punto vendita è di Spazio Conad · Liguria, la riga è nei volantini di Spazio Conad · Toscana',
    });
  });

  it('distanza: entro 300 m nulla, fino a 2 km da verificare, oltre incongruente; col solo comune conta oltre 10 km', () => {
    const esitoA = (lat: number, precisione: PosizioneRiga['precisione'] = 'via') => {
      const posizioni = new Map([posizioneDi('SARZANA', 'Via Variante Aurelia 1', lat, 9.96, precisione)]);
      return verificaCollegamenti([riga()], [puntoVendita(PV_SARZANA)], posizioni, [])[0];
    };
    // Un millesimo di grado di latitudine: circa 111 metri
    expect(esitoA(44.1120).esito).toBe('coerente');
    expect(esitoA(44.1190)).toMatchObject({ esito: 'da_verificare', motivi: [expect.objectContaining({ tipo: 'distanza', livello: 'da_verificare' })] });
    expect(esitoA(44.1400)).toMatchObject({ esito: 'incongruente', motivi: [expect.objectContaining({ tipo: 'distanza', livello: 'incongruente' })] });
    expect(esitoA(44.1400, 'comune').esito).toBe('coerente');
    expect(esitoA(44.2100, 'comune').esito).toBe('incongruente');
  });

  it('due righe diverse dello stesso volantino sullo stesso PV: entrambe incongruenti', () => {
    const gruppi = verificaCollegamenti([
      riga({ riga: 'Via Arzelà - tel. 0187 695225', localita: null, indirizzoStampato: 'Via Arzelà', telefonoStampato: '0187 695225', abbinamento: 'probabile' }),
      riga({ riga: 'la spezia - s. STEFANO MAGRA', localita: 'la spezia', indirizzoStampato: 's. STEFANO MAGRA', abbinamento: 'manuale' }),
    ], [puntoVendita(PV_SARZANA, { citta: 'Santo Stefano di Magra', indirizzo: 'Via Arzelà' })], new Map(), []);

    expect(gruppi).toHaveLength(2);
    expect(gruppi.every(gruppo => gruppo.esito === 'incongruente')).toBe(true);
    expect(gruppi.flatMap(gruppo => gruppo.motivi.filter(motivo => motivo.tipo === 'stesso_volantino').map(motivo => motivo.testo))).toEqual(expect.arrayContaining([
      'Nello stesso volantino (SP LI 40) anche "la spezia - s. STEFANO MAGRA" è collegata a questo punto vendita',
      'Nello stesso volantino (SP LI 40) anche "Via Arzelà - tel. 0187 695225" è collegata a questo punto vendita',
    ]));
  });

  it('un PV della stessa combinazione molto piu\' vicino: da verificare, con il PV piu\' vicino fra i vicini', () => {
    const posizioni = new Map([posizioneDi('SARZANA', 'Via Variante Aurelia 1', 44.1100, 9.9600)]);

    const [gruppo] = verificaCollegamenti([riga()], [
      puntoVendita(PV_SARZANA, { lat: 44.1180 }),
      puntoVendita(PV_SARZANA_DUE, { nome: 'Spazio Sarzana Centro', lat: 44.1101 }),
      // Altra combinazione: non conta anche se e' vicinissimo
      puntoVendita(PV_SPEZIA, { idCanale: 'CY', nomeCanale: 'Conad City', lat: 44.1100 }),
    ], posizioni, []);

    expect(gruppo.esito).toBe('da_verificare');
    expect(gruppo.vicini.map(vicino => vicino.puntoVendita.id)).toEqual([PV_SARZANA_DUE]);
    expect(gruppo.motivi).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'piu_vicino', puntoVendita: { id: PV_SARZANA_DUE, nome: 'Spazio Sarzana Centro' } }),
    ]));
  });

  it('abbinamento probabile, localita\' diversa, telefono e indirizzo diversi: da verificare; posizione mancante solo informazione', () => {
    const [gruppo] = verificaCollegamenti([
      riga({ localita: 'LUNI', indirizzoStampato: 'Via Aurelia 100', telefonoStampato: '0187 111111', abbinamento: 'probabile' }),
    ], [puntoVendita(PV_SARZANA, { telefono: '0187 222222' })], new Map(), []);

    expect(gruppo.esito).toBe('da_verificare');
    expect(gruppo.motivi.map(motivo => [motivo.tipo, motivo.livello])).toEqual([
      ['localita_diversa', 'da_verificare'],
      ['probabile', 'da_verificare'],
      ['telefono_e_indirizzo_diversi', 'da_verificare'],
      ['posizione_mancante', 'informazione'],
    ]);
  });

  it('collegato a mano: tipo manuale e il collegamento che lo regge, anche fatto prima del vincolo su canale e area', () => {
    const regola = { id: 'c1', idPuntoVendita: PV_SARZANA, chiavi: [`ind:SARZANA|${chiaveIndirizzo('Via Variante Aurelia 1')}`], creatoIl: '2026-11-06T10:00:00Z', combinazione: 'sp|li' };

    const [gruppo] = verificaCollegamenti([riga({ abbinamento: 'manuale', idArea: 'TO', nomeArea: 'Toscana' })], [puntoVendita(PV_SARZANA)], new Map(), [regola]);

    expect(gruppo).toMatchObject({ tipo: 'manuale', idCollegamento: 'c1', esito: 'incongruente' });
  });

  it('dal piu\' grave; conteggio per esito', () => {
    const gruppi = verificaCollegamenti([
      riga(),
      riga({ idPuntoVendita: PV_SPEZIA, idArea: 'TO', nomeArea: 'Toscana', indirizzoStampato: 'Via Roma 1', riga: 'SARZANA - Via Roma 1' }),
    ], [puntoVendita(PV_SARZANA), puntoVendita(PV_SPEZIA, { indirizzo: 'Via Roma 1' })], new Map(), []);

    expect(gruppi.map(gruppo => gruppo.esito)).toEqual(['incongruente', 'coerente']);
    expect(contaPerEsito(gruppi)).toEqual({ incongruente: 1, da_verificare: 0, coerente: 1 });
  });
});
