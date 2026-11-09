import { describe, expect, it } from 'vitest';
import { MAX_MARCHE_PROMOZIONE, type VarianteConsultazione } from '../../../lib/consultazione/tipi';
import type { BoxInsight, SintesiVolantino } from '../../../lib/insightVolantino/tipi';
import { aggregaPromozioneVolantini, type KitConInsight, puntoVenditaDa, type RigaPuntoVenditaPromozione } from './promozioneVolantini';

// Il dettaglio di consultazione di una promozione (spec volantini-pop): i numeri dei kit dalla sintesi
// dei loro insight, quelli della promozione dai box di tutti i kit, le righe dei punti vendita stampate
// nell'ordine dei kit con la regione normalizzata.

/** Un box degli insight: senza geometria, sconto, marca, meccanica e reparto salvo indicazione. */
const box = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
  geometria: null,
  spazio: 0,
  proporzionePagina: null,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  ...dati,
});

const sintesi = (dati: Partial<SintesiVolantino> = {}): SintesiVolantino => ({
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

const variante = (id: string, canale = 'Superstore', area = 'Toscana'): VarianteConsultazione => ({
  id,
  titolo: `VOL ${id}`,
  area: { id: `area-${area}`, nome: area },
  canale: { id: `canale-${canale}`, nome: canale },
  numeroFile: 2,
  numeroPuntiVendita: 0,
  copertina: null,
});

const kit = (id: string, elenco: BoxInsight[], altro: { canale?: string; sintesi?: Partial<SintesiVolantino> } = {}): KitConInsight => ({
  variante: variante(id, altro.canale),
  sintesi: sintesi(altro.sintesi),
  box: elenco,
});

/** Box con la chiave del prodotto indicata (lo stesso prodotto in kit diversi ha la stessa chiave). */
const prodotto = (chiave: string, idBox = chiave) => box(idBox, { chiave: `c-${chiave}` });

const riga = (id: string, idKit: string, posizione: number, dati: Partial<RigaPuntoVenditaPromozione> = {}): RigaPuntoVenditaPromozione => ({
  id,
  id_kit: idKit,
  posizione,
  riga: `Riga ${id}`,
  localita: null,
  indirizzo: null,
  regione: null,
  provincia: null,
  id_punto_vendita: null,
  nome_punto_vendita: null,
  lat: null,
  lon: null,
  regione_anagrafica: null,
  provincia_anagrafica: null,
  ...dati,
});

describe('aggregaPromozioneVolantini: prodotti comuni e locali', () => {
  it('per chiave del prodotto pilota: in tutti i kit, in alcuni, in uno solo; un prodotto ripetuto in un kit conta una volta', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [prodotto('A'), prodotto('A', 'A-bis'), prodotto('B'), prodotto('C')]),
      kit('k2', [prodotto('A'), prodotto('B'), prodotto('D')]),
      kit('k3', [prodotto('A'), prodotto('E')]),
    ], []);

    expect(dettaglio.assortimento.prodotti).toEqual({ inTutti: 1, inAlcuni: 1, inUnoSolo: 3 });
    expect(dettaglio.numeri.prodotti).toBe(5);
  });

  it('con due kit un prodotto presente in entrambi e\' in tutti', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [prodotto('A'), prodotto('B')]),
      kit('k2', [prodotto('A')]),
    ], []);

    expect(dettaglio.assortimento.prodotti).toEqual({ inTutti: 1, inAlcuni: 0, inUnoSolo: 1 });
  });

  it('con un solo kit nessun prodotto e\' in tutti o in alcuni: sono tutti in uno solo', () => {
    const dettaglio = aggregaPromozioneVolantini([kit('k1', [prodotto('A'), prodotto('B'), prodotto('B', 'B-bis')])], []);

    expect(dettaglio.assortimento.prodotti).toEqual({ inTutti: 0, inAlcuni: 0, inUnoSolo: 2 });
    expect(dettaglio.numeri.prodotti).toBe(2);
  });
});

describe('aggregaPromozioneVolantini: numeri', () => {
  it('kit con i numeri dei loro insight; kit, pagine, referenze e sottocosto sommati sui kit', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [prodotto('A')], { sintesi: { referenze: 40, box: 30, pagine: 8, scontoMedio: 22.5, quotaFidelity: 10, sottocosto: 2 } }),
      kit('k2', [prodotto('B')], { canale: 'Iper', sintesi: { referenze: 12, box: 10, pagine: 4, scontoMedio: null, quotaFidelity: 0, sottocosto: 1 } }),
    ], []);

    expect(dettaglio.kit).toEqual([
      { ...variante('k1'), referenze: 40, box: 30, pagine: 8, scontoMedio: 22.5, quotaFidelity: 10, sottocosto: 2 },
      { ...variante('k2', 'Iper'), referenze: 12, box: 10, pagine: 4, scontoMedio: null, quotaFidelity: 0, sottocosto: 1 },
    ]);
    expect(dettaglio.numeri).toMatchObject({ kit: 2, pagine: 12, referenze: 52, sottocosto: 3 });
  });

  it('lo sconto medio e\' la media degli sconti di tutti i box che ne hanno uno, non la media delle medie dei kit', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [box('a', { sconto: 10 }), box('b', { sconto: 20 }), box('c', { sconto: 30 }), box('d')], { sintesi: { scontoMedio: 20 } }),
      kit('k2', [box('e', { sconto: 50 })], { sintesi: { scontoMedio: 50 } }),
    ], []);

    // (10 + 20 + 30 + 50) / 4, non (20 + 50) / 2
    expect(dettaglio.numeri.scontoMedio).toBe(27.5);
  });

  it('senza box con sconto lo sconto medio non c\'e\'', () => {
    expect(aggregaPromozioneVolantini([kit('k1', [box('a')])], []).numeri.scontoMedio).toBeNull();
  });
});

describe('aggregaPromozioneVolantini: assortimento', () => {
  it('fasce di sconto su tutti i box dei kit, come negli insight', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [box('a', { sconto: 5 }), box('b', { sconto: 15 }), box('c')]),
      kit('k2', [box('d', { sconto: 10 }), box('e', { sconto: 55 })]),
    ], []);

    expect(dettaglio.assortimento.fasceSconto).toEqual([
      { da: 0, a: 10, box: 1 },
      { da: 10, a: 20, box: 2 },
      { da: 20, a: 30, box: 0 },
      { da: 30, a: 40, box: 0 },
      { da: 40, a: 50, box: 0 },
      { da: 50, a: null, box: 1 },
    ]);
  });

  it('reparti sommati su tutti i box e ordinati per spazio; i box senza reparto nel loro gruppo', () => {
    const ortofrutta = { codice: '33', descrizione: 'ORTOFRUTTA' };
    const bevande = { codice: '03', descrizione: 'BEVANDE' };
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [box('a', { reparto: ortofrutta, spazio: 10 }), box('b', { reparto: bevande, spazio: 30 })]),
      kit('k2', [box('c', { reparto: ortofrutta, spazio: 25 }), box('d', { spazio: 5 })]),
    ], []);

    expect(dettaglio.assortimento.reparti).toEqual([
      { chiave: '33', etichetta: 'ORTOFRUTTA', referenze: 2, spazio: 35, quotaReferenze: 50, quotaSpazio: 50 },
      { chiave: '03', etichetta: 'BEVANDE', referenze: 1, spazio: 30, quotaReferenze: 25, quotaSpazio: 42.9 },
      { chiave: '', etichetta: 'Reparto non indicato', referenze: 1, spazio: 5, quotaReferenze: 25, quotaSpazio: 7.1 },
    ]);
  });

  it('meccaniche per canale, nell\'ordine dei canali dei kit e di MECCANICHE, poi la non riconosciuta; solo quelle con box', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [box('a', { meccanica: 'fidelity' }), box('b', { meccanica: 'sconto' }), box('c')]),
      kit('k2', [box('d', { meccanica: 'prezzo' })], { canale: 'Iper' }),
      kit('k3', [box('e', { meccanica: 'sconto' })]),
      kit('k4', [], { canale: 'Online' }),
    ], []);

    expect(dettaglio.assortimento.meccanichePerCanale).toEqual([
      {
        canale: { id: 'canale-Superstore', nome: 'Superstore' },
        box: 4,
        quote: [
          { meccanica: 'sconto', etichetta: 'Sconto in %', box: 2, quota: 50 },
          { meccanica: 'fidelity', etichetta: 'Prezzo Fidelity', box: 1, quota: 25 },
          { meccanica: null, etichetta: 'Meccanica non riconosciuta', box: 1, quota: 25 },
        ],
      },
      {
        canale: { id: 'canale-Iper', nome: 'Iper' },
        box: 1,
        quote: [{ meccanica: 'prezzo', etichetta: 'Prezzo senza sconto', box: 1, quota: 100 }],
      },
      { canale: { id: 'canale-Online', nome: 'Online' }, box: 0, quote: [] },
    ]);
  });

  it('marche: al massimo MAX_MARCHE_PROMOZIONE per spazio, senza la marca non indicata, la stessa marca unita fra i kit', () => {
    // Dieci marche con spazio decrescente e un box senza marca, il piu' grande
    const marche = Array.from({ length: 10 }, (_, indice) =>
      box(`m${indice}`, { marca: `Marca ${String.fromCharCode(65 + indice)}`, spazio: 20 - indice, sconto: 10 + indice }));
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [box('senza', { spazio: 40 }), ...marche.slice(0, 5)]),
      kit('k2', [...marche.slice(5), box('stessa', { marca: 'MARCA a ', spazio: 1, sconto: 30 })]),
    ], []);

    const elenco = dettaglio.assortimento.marche;
    expect(elenco).toHaveLength(MAX_MARCHE_PROMOZIONE);
    expect(elenco.map(marca => marca.nome)).toEqual(['Marca A', 'Marca B', 'Marca C', 'Marca D', 'Marca E', 'Marca F', 'Marca G', 'Marca H']);
    // "Marca A" e "MARCA a " sono la stessa marca: due box, sconto medio (10 + 30) / 2, spazio 21 su 196
    expect(elenco[0]).toEqual({ nome: 'Marca A', box: 2, quotaSpazio: 10.7, scontoMedio: 20 });
    expect(elenco.some(marca => marca.nome === 'Marca non indicata')).toBe(false);
  });

  it('un kit senza referenze analizzabili vale come un kit con zero box, senza errori', () => {
    const dettaglio = aggregaPromozioneVolantini([
      kit('k1', [box('a', { sconto: 20, meccanica: 'sconto' })], { sintesi: { referenze: 1, box: 1, pagine: 2 } }),
      kit('k2', [], { sintesi: { pagine: 6 } }),
    ], []);

    expect(dettaglio.numeri).toMatchObject({ kit: 2, pagine: 8, referenze: 1, prodotti: 1, scontoMedio: 20 });
    // Il prodotto non sta nel kit senza box: non e' in tutti i kit
    expect(dettaglio.assortimento.prodotti).toEqual({ inTutti: 0, inAlcuni: 0, inUnoSolo: 1 });
    expect(dettaglio.kit[1]).toMatchObject({ id: 'k2', box: 0, referenze: 0, scontoMedio: null });

    const vuoto = aggregaPromozioneVolantini([kit('k1', [])], []);
    expect(vuoto.numeri).toMatchObject({ kit: 1, prodotti: 0, referenze: 0, scontoMedio: null, sottocosto: 0 });
    expect(vuoto.assortimento).toMatchObject({ prodotti: { inTutti: 0, inAlcuni: 0, inUnoSolo: 0 }, reparti: [], marche: [] });
    expect(vuoto.assortimento.fasceSconto.every(fascia => fascia.box === 0)).toBe(true);
  });
});

describe('aggregaPromozioneVolantini: punti vendita', () => {
  it('nell\'ordine dei kit e per posizione; le righe di un kit che non e\' fra i kit restano fuori', () => {
    const dettaglio = aggregaPromozioneVolantini([kit('k2', []), kit('k1', [])], [
      riga('r1', 'k1', 2),
      riga('r2', 'k2', 2),
      riga('r3', 'k1', 1),
      riga('r4', 'k2', 1),
      riga('r5', 'altro', 1),
    ]);

    expect(dettaglio.puntiVendita.map(voce => voce.id)).toEqual(['r4', 'r2', 'r3', 'r1']);
    expect(dettaglio.numeri.puntiVendita).toBe(4);
  });

  it('localita diverse senza distinguere maiuscole, spazi e accenti; regioni diverse fra quelle note', () => {
    const dettaglio = aggregaPromozioneVolantini([kit('k1', [])], [
      riga('r1', 'k1', 1, { localita: 'Firenze', regione: 'TOSCANA' }),
      riga('r2', 'k1', 2, { localita: ' FIRENZE ', provincia: 'FI' }),
      riga('r3', 'k1', 3, { localita: 'Forlì', regione: 'EMILIA ROMAGNA' }),
      riga('r4', 'k1', 4, { localita: 'FORLI', regione: 'Emilia-Romagna' }),
      riga('r5', 'k1', 5, { localita: null }),
    ]);

    expect(dettaglio.numeri).toMatchObject({ puntiVendita: 5, localita: 2, regioni: 2 });
  });

  it('regione dalla riga stampata o dall\'anagrafica; il PV abbinato con le coordinate solo se ci sono entrambe', () => {
    expect(puntoVenditaDa(riga('r1', 'k1', 1, {
      riga: 'MODENA - Via Emilia 12',
      localita: ' Modena ',
      indirizzo: 'Via Emilia 12',
      provincia: 'MO',
      id_punto_vendita: 'pv-1',
      nome_punto_vendita: 'Superstore Modena',
      lat: '44.64700000',
      lon: '10.92500000',
    }))).toEqual({
      id: 'r1',
      idKit: 'k1',
      riga: 'MODENA - Via Emilia 12',
      localita: 'Modena',
      indirizzo: 'Via Emilia 12',
      regione: 'EMR',
      puntoVendita: { id: 'pv-1', nome: 'Superstore Modena', coordinate: { lat: 44.647, lon: 10.925 } },
    });

    const soloAnagrafica = puntoVenditaDa(riga('r2', 'k1', 2, {
      id_punto_vendita: 'pv-2', nome_punto_vendita: 'Iper Grosseto', lat: 42.76, lon: null, regione_anagrafica: 'Toscana',
    }));
    expect(soloAnagrafica.regione).toBe('TOS');
    expect(soloAnagrafica.puntoVendita).toEqual({ id: 'pv-2', nome: 'Iper Grosseto', coordinate: null });

    const senzaAbbinamento = puntoVenditaDa(riga('r3', 'k1', 3, { regione: 'Atlantide', localita: '' }));
    expect(senzaAbbinamento).toMatchObject({ regione: null, localita: null, puntoVendita: null });
  });
});
