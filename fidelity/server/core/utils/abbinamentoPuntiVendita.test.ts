import { describe, expect, it } from 'vitest';
import { AbbinatorePuntiVendita, type PuntoVenditaAnagrafica } from './abbinamentoPuntiVendita';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';

// Abbinamento delle righe dei volantini all'anagrafica della GDO: mai a caso, mai fusioni

const pv = (id: string, citta: string, indirizzo: string, telefono: string | null = null): PuntoVenditaAnagrafica =>
  ({ id, citta, indirizzo, telefono });

const riga = (localita: string | null, indirizzo: string | null, telefono: string | null = null) => ({
  localita,
  chiaveIndirizzo: chiaveIndirizzo(indirizzo),
  chiaveTelefono: chiaveTelefono(telefono),
});

describe('AbbinatorePuntiVendita', () => {
  const anagrafica = [
    pv('genova-murtola', 'Genova', 'Via Murtola 12/14', '010 6197180'),
    pv('sanremo-sauro', 'Sanremo', 'Corso Nazario Sauro 44', '+39 0184 591201'),
    pv('bordighera', 'Bordighera', 'Via Pasteur 70/E', null),
    // Due PV col centralino della stessa cooperativa
    pv('lucca-roma', 'Lucca', 'Via Roma 1', '0583 000000'),
    pv('pisa-roma', 'Pisa', 'Via Roma 1', '0583 000000'),
  ];
  const abbinatore = new AbbinatorePuntiVendita(anagrafica);

  it('telefono uguale e di un solo PV: abbinamento per telefono, anche con un indirizzo scritto diverso', () => {
    expect(abbinatore.abbina(riga('SANREMO', 'C.so N. Sauro 44 bis', 'tel. 0184 591201'))).toEqual({ idPuntoVendita: 'sanremo-sauro', tipo: 'telefono' });
  });

  it('telefono condiviso fra piu\' PV: decide l\'indirizzo nella stessa localita\'', () => {
    expect(abbinatore.abbina(riga('PISA', 'Via Roma 1', '0583 000000'))).toEqual({ idPuntoVendita: 'pisa-roma', tipo: 'indirizzo' });
  });

  it('telefono condiviso e nient\'altro che lo distingua: resta senza PV', () => {
    expect(abbinatore.abbina(riga(null, null, '0583 000000'))).toBeNull();
  });

  it('stessa localita\' e stesso indirizzo, con le abbreviazioni: abbinamento per indirizzo', () => {
    expect(abbinatore.abbina(riga('BORDIGHERA', 'Via Pasteur 70/e'))).toEqual({ idPuntoVendita: 'bordighera', tipo: 'indirizzo' });
    expect(abbinatore.abbina(riga('Sanremo', 'C.so Nazario Sauro 44'))).toEqual({ idPuntoVendita: 'sanremo-sauro', tipo: 'indirizzo' });
  });

  it('il volantino stampa la frazione (PRA invece di GENOVA): stesso indirizzo unico nella GDO, abbinamento probabile', () => {
    expect(abbinatore.abbina(riga('PRA', 'Via Murtola 12/14'))).toEqual({ idPuntoVendita: 'genova-murtola', tipo: 'probabile' });
  });

  it('stesso indirizzo in due PV e localita\' che non e\' di nessuno dei due: ambiguo, senza PV', () => {
    expect(abbinatore.abbina(riga('VIAREGGIO', 'Via Roma 1'))).toBeNull();
  });

  it('stessa localita\', un carattere di differenza e stessi civici: probabile', () => {
    expect(abbinatore.abbina(riga('Bordighera', 'Via Pasteurr 70/e'))).toEqual({ idPuntoVendita: 'bordighera', tipo: 'probabile' });
  });

  it('un carattere di differenza ma civico diverso: senza PV', () => {
    expect(abbinatore.abbina(riga('Bordighera', 'Via Pasteur 71/e'))).toBeNull();
  });

  it('due PV vicini a un carattere nella stessa localita\': ambiguo, senza PV', () => {
    const vicini = new AbbinatorePuntiVendita([pv('a', 'Lucca', 'Via Rossi 1'), pv('b', 'Lucca', 'Via Russi 1')]);

    expect(vicini.abbina(riga('Lucca', 'Via Rassi 1'))).toBeNull();
  });

  it('due PV con lo stesso indirizzo nella stessa citta\' (un doppione in anagrafica): non si sceglie', () => {
    const doppioni = new AbbinatorePuntiVendita([pv('a', 'Lucca', 'Via Roma 1'), pv('b', 'Lucca', 'Via Roma 1')]);

    expect(doppioni.abbina(riga('Lucca', 'Via Roma 1'))).toBeNull();
  });

  it('nessuna corrispondenza o riga senza chiavi: senza PV', () => {
    expect(abbinatore.abbina(riga('LIVORNO', 'Via Grande 100', '0586 111111'))).toBeNull();
    expect(abbinatore.abbina(riga('LIVORNO', null, null))).toBeNull();
  });

  it('anagrafica vuota: nessun abbinamento', () => {
    expect(new AbbinatorePuntiVendita([]).abbina(riga('PRA', 'Via Murtola 12/14', '010 6197180'))).toBeNull();
  });
});
