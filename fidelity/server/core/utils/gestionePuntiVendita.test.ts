import { MASSIMO_CANDIDATI, type PosizioneRiga } from '../../../lib/puntiVendita/analisi';
import { describe, expect, it } from 'vitest';
import { chiaviRigaVolantino } from './chiaviRigheVolantino';
import { type EdizioneConLista, raggruppaRigheNonAbbinate, righeDaRevisionare, type RigaSenzaPuntoVendita, volantiniDelGruppo } from './gestionePuntiVendita';
import { chiaveIndirizzo, chiaveTelefono } from './puntoVenditaNormalization';

// Qualita' dei dati nella gestione dei PV: righe dell'import da rivedere e righe dei volantini senza PV

describe('righeDaRevisionare', () => {
  it('le righe scartate o non scritte dell\'ultimo import, una volta ciascuna, piu\' quella in attesa', () => {
    expect(righeDaRevisionare({
      errori: [{ row: 3, error: 'CAP mancante' }, { row: 5, error: 'Canale sconosciuto' }, { row: 5, error: 'Indirizzo' }, { row: 0, error: 'Import interrotto' }],
      rigaInAttesa: { riga: 9 },
    })).toBe(3);
    expect(righeDaRevisionare({ errori: [] })).toBe(0);
    expect(righeDaRevisionare({})).toBe(0);
    expect(righeDaRevisionare(null)).toBe(0);
    expect(righeDaRevisionare('rotto')).toBe(0);
  });
});

describe('raggruppaRigheNonAbbinate', () => {
  const NOMI: Record<string, string> = { SS: 'Conad Superstore', CC: 'Conad City' };

  const riga = (idKit: string, data: string, testo: string, dati: { localita?: string; indirizzo?: string; telefono?: string; canale?: string }): RigaSenzaPuntoVendita => ({
    idKit,
    data,
    idCanale: dati.canale ?? 'SS',
    nomeCanale: NOMI[dati.canale ?? 'SS'],
    idArea: 'LI',
    posizione: 1,
    riga: testo,
    localita: dati.localita ?? null,
    indirizzo: dati.indirizzo ?? null,
    telefono: dati.telefono ?? null,
    chiaveIndirizzo: chiaveIndirizzo(dati.indirizzo),
    chiaveTelefono: chiaveTelefono(dati.telefono),
  });

  const RIGHE: RigaSenzaPuntoVendita[] = [
    // Stesso telefono di un PV dell'anagrafica
    riga('k1', '2022-01-06', 'SANREMO - Via Roma 3 - tel. 0184 555 0143', { localita: 'SANREMO', indirizzo: 'Via Roma 3', telefono: '0184 555 0143' }),
    riga('k2', '2022-01-13', 'SANREMO - V. Roma 3 - tel. 0184 555 0143', { localita: 'SANREMO', indirizzo: 'V. Roma 3', telefono: '0184 555 0143' }),
    // Non c'e' piu' nelle ultime tre edizioni della sua insegna e area
    riga('k2', '2022-01-13', 'ALASSIO - Via Dante 88 - tel. 0182 555 0611', { localita: 'ALASSIO', indirizzo: 'Via Dante 88', telefono: '0182 555 0611' }),
    // Stesso indirizzo, la seconda volta senza telefono: lo stesso PV
    riga('k1', '2022-01-06', 'ARMA DI TAGGIA - P.zza Chierotti 4 - tel. 0184 999 0000', { localita: 'ARMA DI TAGGIA', indirizzo: 'P.zza Chierotti 4', telefono: '0184 999 0000' }),
    riga('k5', '2022-02-03', 'ARMA DI TAGGIA - P.zza Chierotti 4', { localita: 'ARMA DI TAGGIA', indirizzo: 'P.zza Chierotti 4' }),
    // Ne' telefono ne' indirizzo: si riconosce dal testo; solo due edizioni dopo, non basta per "forse chiuso"
    riga('c1', '2022-01-06', 'Punto vendita senza indirizzo', { canale: 'CC' }),
    riga('c2', '2022-01-13', 'PUNTO VENDITA SENZA INDIRIZZO', { canale: 'CC' }),
  ];

  const EDIZIONI: EdizioneConLista[] = [
    ...['2022-01-06', '2022-01-13', '2022-01-20', '2022-01-27', '2022-02-03'].map(data => ({ idCanale: 'SS', idArea: 'LI', data })),
    ...['2022-01-06', '2022-01-13', '2022-01-20', '2022-01-27'].map(data => ({ idCanale: 'CC', idArea: 'LI', data })),
  ];

  const PUNTI_VENDITA = [
    { id: 'pv-9', nome: 'Conad Superstore Sanremo', telefono: '0184 5550143', idCanale: 'SS', idArea: 'LI' },
    { id: 'pv-3', nome: 'Conad City Genova', telefono: null, idCanale: 'CC', idArea: 'LI' },
  ];

  const gruppi = raggruppaRigheNonAbbinate(RIGHE, EDIZIONI, PUNTI_VENDITA);

  it('un gruppo per PV stampato, dal visto piu\' di recente; a parita\' per volantini e testo', () => {
    expect(gruppi.map(gruppo => gruppo.riga)).toEqual([
      'ARMA DI TAGGIA - P.zza Chierotti 4',
      'PUNTO VENDITA SENZA INDIRIZZO',
      'SANREMO - V. Roma 3 - tel. 0184 555 0143',
      'ALASSIO - Via Dante 88 - tel. 0182 555 0611',
    ]);
  });

  it('la riga piu\' recente, il telefono dell\'ultima che lo stampa, volantini, prima e ultima volta, insegna', () => {
    expect(gruppi[0]).toEqual({
      // La chiave del gruppo: quella dell'indirizzo, comune alle due righe
      chiave: chiaviRigaVolantino(RIGHE[4])[0],
      riga: 'ARMA DI TAGGIA - P.zza Chierotti 4',
      varianti: ['ARMA DI TAGGIA - P.zza Chierotti 4', 'ARMA DI TAGGIA - P.zza Chierotti 4 - tel. 0184 999 0000'],
      localita: 'ARMA DI TAGGIA',
      indirizzo: 'P.zza Chierotti 4',
      telefono: '0184 999 0000',
      provincia: null,
      volantini: 2,
      primoVolantino: '2022-01-06',
      ultimoVolantino: '2022-02-03',
      canale: { id: 'SS', nome: 'Conad Superstore' },
      combinazioni: [{ canale: { id: 'SS', nome: 'Conad Superstore' }, area: { id: 'LI', nome: '' } }],
      // Mai cercata: nessuna posizione
      posizione: null,
      suggerimento: { tipo: 'da_aggiungere' },
      candidati: [],
    });
  });

  it('la chiave di ogni gruppo e\' una delle chiavi delle sue righe, e i gruppi hanno chiavi diverse', () => {
    const sanremo = gruppi.find(gruppo => gruppo.riga.startsWith('SANREMO'));
    expect(chiaviRigaVolantino(RIGHE[0])).toContain(sanremo?.chiave);
    expect(new Set(gruppi.map(gruppo => gruppo.chiave)).size).toBe(gruppi.length);
  });

  it('suggerimenti: stesso telefono di un PV, forse chiuso dopo tre edizioni senza, altrimenti da aggiungere', () => {
    expect(Object.fromEntries(gruppi.map(gruppo => [gruppo.riga.slice(0, 7), gruppo.suggerimento]))).toEqual({
      'ARMA DI': { tipo: 'da_aggiungere' },
      'PUNTO V': { tipo: 'da_aggiungere' },
      'SANREMO': { tipo: 'stesso_telefono', puntoVendita: { id: 'pv-9', nome: 'Conad Superstore Sanremo' } },
      'ALASSIO': { tipo: 'forse_chiuso' },
    });
    expect(gruppi.find(gruppo => gruppo.riga.startsWith('SANREMO'))?.volantini).toBe(2);
  });

  it('nessuna riga, nessun gruppo', () => {
    expect(raggruppaRigheNonAbbinate([], EDIZIONI, PUNTI_VENDITA)).toEqual([]);
  });
});

const SS_LI = { idCanale: 'SS', nomeCanale: 'Conad Superstore', idArea: 'LI', nomeArea: 'Liguria' };

describe('raggruppaRigheNonAbbinate: punti vendita a cui collegare la riga', () => {
  const rigaSanremo = (telefono: string | null): RigaSenzaPuntoVendita => ({
    idKit: 'k1',
    data: '2024-03-07',
    idCanale: 'SS',
    nomeCanale: 'Conad Superstore',
    idArea: 'LI',
    posizione: 1,
    riga: `SANREMO - C.so Nazario Sauro 44${telefono ? ` - tel. ${telefono}` : ''}`,
    localita: 'SANREMO',
    indirizzo: 'C.so Nazario Sauro 44',
    telefono,
    chiaveIndirizzo: chiaveIndirizzo('C.so Nazario Sauro 44'),
    chiaveTelefono: chiaveTelefono(telefono),
  });

  it('dal motivo piu\' forte: stesso telefono, stesso indirizzo altrove, indirizzo simile, stessa localita\'', () => {
    const [gruppo] = raggruppaRigheNonAbbinate([rigaSanremo('0184 555 0001')], [], [
      { ...SS_LI, id: 'pv-roma', nome: 'PV Via Roma', telefono: null, citta: 'Sanremo', indirizzo: 'Via Roma 3' },
      { ...SS_LI, id: 'pv-46', nome: 'PV Corso 46', telefono: null, citta: 'Sanremo', indirizzo: 'Corso Nazario Sauro 46' },
      { ...SS_LI, id: 'pv-taggia', nome: 'PV Taggia', telefono: null, citta: 'Taggia', indirizzo: 'Corso Nazario Sauro 44' },
      { ...SS_LI, id: 'pv-centralino', nome: 'Centralino', telefono: '0184 5550001', citta: 'Sanremo', indirizzo: 'Via Matteotti 1' },
      { ...SS_LI, id: 'pv-genova', nome: 'Genova', telefono: null, citta: 'Genova', indirizzo: 'Via XX Settembre 1' },
    ]);

    expect(gruppo.candidati.map(candidato => [candidato.puntoVendita.id, candidato.motivo])).toEqual([
      ['pv-centralino', 'stesso_telefono'],
      ['pv-taggia', 'stesso_indirizzo'],
      ['pv-46', 'indirizzo_simile'],
      ['pv-roma', 'stessa_localita'],
    ]);
    expect(gruppo.candidati[1].puntoVendita).toEqual({
      id: 'pv-taggia', nome: 'PV Taggia', ragioneSociale: null, indirizzo: 'Corso Nazario Sauro 44', citta: 'Taggia', provincia: null, telefono: null,
      lat: null, lon: null, combinazione: { canale: { id: 'SS', nome: 'Conad Superstore' }, area: { id: 'LI', nome: 'Liguria' } },
    });
    // Ogni candidato con il confronto: stesso indirizzo, altra localita'
    expect(gruppo.candidati[1].confronto).toEqual({
      telefono: 'assente', indirizzo: 'uguale', localita: 'diverso', provincia: 'assente', stessaCombinazione: true, distanzaMetri: null,
    });
  });

  it('al massimo otto, i piu\' vicini per indirizzo', () => {
    const puntiVendita = Array.from({ length: 10 }, (_, indice) => ({
      ...SS_LI, id: `pv-${indice}`, nome: `PV ${indice}`, telefono: null, citta: 'Sanremo', indirizzo: `Via Lontana ${'X'.repeat(indice)} 1`,
    }));

    const [gruppo] = raggruppaRigheNonAbbinate([rigaSanremo(null)], [], puntiVendita);

    expect(gruppo.candidati).toHaveLength(MASSIMO_CANDIDATI);
    expect(gruppo.candidati.every(candidato => candidato.motivo === 'stessa_localita')).toBe(true);
  });

  it('nome o ragione sociale che contengono la localita\' o la via stampate, a parole intere', () => {
    const riga: RigaSenzaPuntoVendita = {
      ...rigaSanremo(null),
      riga: 'PRA - Via Murtola 12/14',
      localita: 'PRA',
      indirizzo: 'Via Murtola 12/14',
      chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'),
    };

    const [gruppo] = raggruppaRigheNonAbbinate([riga], [], [
      { ...SS_LI, id: 'pv-pra', nome: 'Superstore Pra', telefono: null, citta: 'Genova', indirizzo: 'Via Novella 3' },
      { ...SS_LI, id: 'pv-murtola', nome: 'Conad Genova', ragioneSociale: 'Murtola Market Srl', telefono: null, citta: 'Genova', indirizzo: 'Via Roma 1' },
      // "PRATO" non e' "PRA"
      { ...SS_LI, id: 'pv-prato', nome: 'Conad Prato', telefono: null, citta: 'Prato', indirizzo: 'Via Pistoiese 2' },
    ]);

    expect(gruppo.candidati.map(candidato => [candidato.puntoVendita.id, candidato.motivo])).toEqual([
      ['pv-murtola', 'nome_simile'],
      ['pv-pra', 'nome_simile'],
    ]);
    expect(gruppo.candidati[0].puntoVendita.ragioneSociale).toBe('Murtola Market Srl');
  });

  it('nessun PV della stessa localita\', telefono o indirizzo: nessun candidato', () => {
    const [gruppo] = raggruppaRigheNonAbbinate([rigaSanremo('0184 555 0001')], [], [
      { ...SS_LI, id: 'pv-genova', nome: 'Genova', telefono: '010 1234567', citta: 'Genova', indirizzo: 'Via XX Settembre 1' },
    ]);
    expect(gruppo.candidati).toEqual([]);
  });
});

describe('raggruppaRigheNonAbbinate: canale e area, posizione e vicinanza', () => {
  const riga = (sovrascritti: Partial<RigaSenzaPuntoVendita> = {}): RigaSenzaPuntoVendita => ({
    idKit: 'k1', data: '2024-03-07', idCanale: 'SS', nomeCanale: 'Conad Superstore', idArea: 'LI', nomeArea: 'Liguria', posizione: 1,
    riga: 'PRA - Via Murtola 12/14 - tel. 010 6197180', localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180', provincia: 'GE',
    chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'), chiaveTelefono: chiaveTelefono('010 6197180'),
    ...sovrascritti,
  });
  const posizioneMurtola = (precisione: PosizioneRiga['precisione']): Map<string, PosizioneRiga> => new Map([[
    'ind:PRA|VIA MURTOLA 12 14',
    { chiave: 'ind:PRA|VIA MURTOLA 12 14', lat: 44.4281, lon: 8.7836, precisione, fonte: 'nominatim', errore: null, aggiornataIl: '2026-11-11T09:00:00.000Z' },
  ]]);
  const CITY_LI = { idCanale: 'CC', nomeCanale: 'Conad City', idArea: 'LI', nomeArea: 'Liguria' };

  it('solo PV della combinazione di uno dei volantini della riga, anche per il suggerimento "stesso telefono"', () => {
    const [gruppo] = raggruppaRigheNonAbbinate([riga()], [], [
      { ...CITY_LI, id: 'pv-city', nome: 'Conad City Pra', telefono: '010 6197180', citta: 'Genova', indirizzo: 'Via Murtola 12/14' },
      { ...SS_LI, id: 'pv-ss', nome: 'Superstore Pra', telefono: null, citta: 'PRA', indirizzo: 'Via Novella 3' },
    ]);

    expect(gruppo.candidati.map(candidato => candidato.puntoVendita.id)).toEqual(['pv-ss']);
    expect(gruppo.suggerimento).toEqual({ tipo: 'da_aggiungere' });
    expect(gruppo.combinazioni).toEqual([{ canale: { id: 'SS', nome: 'Conad Superstore' }, area: { id: 'LI', nome: 'Liguria' } }]);
    expect(gruppo.provincia).toBe('GE');
  });

  it('una riga stampata in due combinazioni: PV di tutte e due', () => {
    const [gruppo] = raggruppaRigheNonAbbinate([riga(), riga({ idKit: 'k2', idCanale: 'CC', nomeCanale: 'Conad City' })], [], [
      { ...CITY_LI, id: 'pv-city', nome: 'Conad City Pra', telefono: '010 6197180', citta: 'Genova', indirizzo: 'Via Novella 3' },
      { ...SS_LI, id: 'pv-ss', nome: 'Superstore Pra', telefono: null, citta: 'PRA', indirizzo: 'Via Novella 3' },
    ]);

    expect(gruppo.candidati.map(candidato => [candidato.puntoVendita.id, candidato.motivo])).toEqual([['pv-city', 'stesso_telefono'], ['pv-ss', 'nome_simile']]);
    expect(gruppo.combinazioni).toHaveLength(2);
  });

  it('vicini alla posizione della riga, dal piu\' vicino, con la distanza nel confronto; oltre il raggio no', () => {
    const [gruppo] = raggruppaRigheNonAbbinate([riga({ telefono: null, chiaveTelefono: null })], [], [
      { ...SS_LI, id: 'pv-lontano', nome: 'Superstore Voltri', telefono: null, citta: 'Genova', indirizzo: 'Via Lungomare 1', lat: 44.4281, lon: 8.7300 },
      { ...SS_LI, id: 'pv-150', nome: 'Superstore Ponente', telefono: null, citta: 'Genova', indirizzo: 'Via Novella 3', lat: 44.4290, lon: 8.7850 },
      { ...SS_LI, id: 'pv-1000', nome: 'Superstore Pegli', telefono: null, citta: 'Genova', indirizzo: 'Via Pegli 1', lat: 44.4281, lon: 8.7960 },
    ], posizioneMurtola('via'));

    expect(gruppo.posizione).toMatchObject({ precisione: 'via', lat: 44.4281 });
    expect(gruppo.candidati.map(candidato => [candidato.puntoVendita.id, candidato.motivo])).toEqual([['pv-150', 'vicino'], ['pv-1000', 'vicino']]);
    expect(gruppo.candidati[0].confronto.distanzaMetri).toBeGreaterThan(100);
    expect(gruppo.candidati[0].confronto.distanzaMetri).toBeLessThan(200);
  });

  it('con la sola posizione del comune nessun PV e\' suggerito per vicinanza', () => {
    const [gruppo] = raggruppaRigheNonAbbinate([riga({ telefono: null, chiaveTelefono: null })], [], [
      { ...SS_LI, id: 'pv-150', nome: 'Superstore Ponente', telefono: null, citta: 'Genova', indirizzo: 'Via Novella 3', lat: 44.4290, lon: 8.7850 },
    ], posizioneMurtola('comune'));

    expect(gruppo.candidati).toEqual([]);
  });
});

describe('volantiniDelGruppo', () => {
  const riga = (idKit: string, data: string, testo: string, posizione = 1): RigaSenzaPuntoVendita => ({
    idKit,
    data,
    idCanale: 'CC',
    nomeCanale: 'Conad City',
    idArea: 'LI',
    nomeArea: 'Liguria',
    titoloKit: `CC LI ${idKit}`,
    idPromo: `promo-${idKit}`,
    nomePromo: `Volantino ${idKit}`,
    posizione,
    riga: testo,
    localita: 'SANREMO',
    indirizzo: testo.includes('V. Roma') ? 'V. Roma 3' : 'Via Roma 3',
    telefono: '0184 555 0143',
    chiaveIndirizzo: chiaveIndirizzo(testo.includes('V. Roma') ? 'V. Roma 3' : 'Via Roma 3'),
    chiaveTelefono: chiaveTelefono('0184 555 0143'),
  });
  const RIGHE = [
    riga('k1', '2024-01-04', 'SANREMO - Via Roma 3 - tel. 0184 555 0143'),
    riga('k2', '2024-02-01', 'SANREMO - V. Roma 3 - tel. 0184 555 0143'),
    // Stampata due volte nello stesso volantino: il volantino conta una volta
    riga('k2', '2024-02-01', 'SANREMO - V. Roma 3 - tel. 0184 555 0143', 9),
  ];

  it('uno per kit, dal piu\' recente, con la riga com\'era stampata in ciascuno', () => {
    const chiave = chiaviRigaVolantino(RIGHE[0])[0];

    expect(volantiniDelGruppo(RIGHE, chiave)).toEqual([
      {
        idKit: 'k2', titoloKit: 'CC LI k2', promo: { id: 'promo-k2', nome: 'Volantino k2' }, data: '2024-02-01',
        canale: { id: 'CC', nome: 'Conad City' }, area: { id: 'LI', nome: 'Liguria' }, rigaStampata: 'SANREMO - V. Roma 3 - tel. 0184 555 0143',
      },
      {
        idKit: 'k1', titoloKit: 'CC LI k1', promo: { id: 'promo-k1', nome: 'Volantino k1' }, data: '2024-01-04',
        canale: { id: 'CC', nome: 'Conad City' }, area: { id: 'LI', nome: 'Liguria' }, rigaStampata: 'SANREMO - Via Roma 3 - tel. 0184 555 0143',
      },
    ]);
  });

  it('una chiave che nessun gruppo ha: null', () => {
    expect(volantiniDelGruppo(RIGHE, 'tel:000000')).toBeNull();
  });
});
