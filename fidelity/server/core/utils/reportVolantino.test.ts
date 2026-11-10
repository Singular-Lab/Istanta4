import { describe, expect, it } from 'vitest';
import { PALETTE_REPORT_STANDARD, type DatiReportVolantino, type SezioneReport } from '../../../lib/insightVolantino/report';
import type { BoxInsight, ConfrontoEdizione } from '../../../lib/insightVolantino/tipi';
import {
  chiaveSezione,
  conArticolo,
  frasiChiave,
  nomeLeggibile,
  ORDINE_SEZIONI_STANDARD,
  periodoInItaliano,
  riordinaSezioni,
  sezioniStandard,
  sottotitoloReport,
  TITOLI_REPORT,
} from './reportVolantino';

// Sezioni standard del report PDF del volantino (spec insight-volantino): solo quelle con dati,
// nell'ordine standard, con indicatori, variazioni e frasi in italiano e numeri all'italiana. Per
// decisione della direzione niente pagine del volantino, mappe, visibilita', vendite ne' previsioni.

/** Le parole che il report non deve piu' usare. */
const FUORI_DAL_REPORT = /visibilit|vendit|previs|calore|zone calde|mappa|rendiment|investimento|stim[ae]\b/i;

const DROGHERIA = { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' };
const BEVANDE = { codice: '03', descrizione: 'BEVANDE' };

const box = (id: string, altro: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 25,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: 'Alfa',
  formato: null,
  prezzo: 1.5,
  barrato: 2,
  sconto: 25,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: 'sconto',
  meccanicaOriginale: null,
  reparto: DROGHERIA,
  foto: [],
  prodotti: 1,
  idReferenze: [id],
  ...altro,
});

const BOX: BoxInsight[] = [
  box('b1', { pagina: 1, sconto: 40, meccanica: 'fidelity' }),
  box('b2', { pagina: 2, sconto: 20 }),
  box('b3', { pagina: 2, geometria: null, spazio: 0, sconto: null, reparto: BEVANDE, marca: 'Beta' }),
  box('b4', { pagina: 3, sconto: 10, nome: 'Acqua', marca: 'Gamma', reparto: BEVANDE }),
];

/** Un volantino con i dati del solo impaginato, senza edizione precedente. */
function dati(altro: Partial<DatiReportVolantino> = {}): DatiReportVolantino {
  return {
    contesto: {
      idKit: 'kit-1',
      titolo: 'Volantino 21',
      nomeGdo: 'GDO di prova',
      area: 'Toscana',
      canale: 'Conad City',
      validitaDal: '2026-11-03',
      validitaAl: '2026-11-16',
    },
    insight: {
      pdf: { idOlimpoCloud: 'pdf-1', pagine: 4 },
      box: BOX,
      sintesi: {
        referenze: 60,
        box: 50,
        pagine: 4,
        scontoMedio: 24.4,
        boxConSconto: 40,
        quotaFidelity: 18,
        sottocosto: 2,
        marche: 12,
        copertura: { prezzo: 96, marca: 80, reparto: 90, geometria: 98 },
      },
      prezziSconti: {
        fasce: [
          { da: 0, a: 10, box: 4 },
          { da: 10, a: 20, box: 10 },
          { da: 20, a: 30, box: 14 },
          { da: 30, a: 40, box: 8 },
          { da: 40, a: 50, box: 3 },
          { da: 50, a: null, box: 1 },
        ],
        perReparto: [],
        perMeccanica: [
          { chiave: 'sconto', etichetta: 'Sconto in %', box: 30, scontoMedio: 25 },
          { chiave: '', etichetta: 'Meccanica non riconosciuta', box: 11, scontoMedio: null },
          { chiave: 'fidelity', etichetta: 'Prezzo Fidelity', box: 9, scontoMedio: 30 },
        ],
        sottocosto: ['b1', 'b2'],
        conPrezzoAlKg: 3,
      },
      spazio: {
        perReparto: [
          { chiave: '', etichetta: 'Reparto non indicato', referenze: 5, spazio: 130, quotaReferenze: 8.3, quotaSpazio: 45 },
          { chiave: '01', etichetta: 'DROGHERIA ALIMENTARE', referenze: 19, spazio: 120, quotaReferenze: 31, quotaSpazio: 42 },
          { chiave: '03', etichetta: 'BEVANDE', referenze: 10, spazio: 37, quotaReferenze: 16.7, quotaSpazio: 13 },
        ],
        perMeccanica: [],
        perMarca: [],
        perPagina: [],
      },
      marche: {
        elenco: [
          { chiave: 'ALFA', nome: 'Alfa', box: 10, referenze: 12, quotaSpazio: 20, scontoMedio: 25, distributore: false },
          { chiave: 'INSEGNA', nome: 'Insegna', box: 8, referenze: 8, quotaSpazio: 15, scontoMedio: 20, distributore: true },
          { chiave: 'BETA', nome: 'Beta', box: 1, referenze: 1, quotaSpazio: 0, scontoMedio: null, distributore: false },
        ],
        quotaDistributore: { quotaSpazio: 15, quotaBox: 16 },
      },
      totalePagine: 4,
      totaleReferenze: 60,
    },
    confronto: null,
    palette: PALETTE_REPORT_STANDARD,
    ...altro,
  };
}

const CONFRONTO: ConfrontoEdizione = {
  edizione: {
    idKit: 'kit-0',
    titolo: 'Volantino 20',
    idPromo: 'promo-0',
    nomePromo: null,
    area: 'Toscana',
    canale: 'Conad City',
    validitaDal: '2026-10-20',
    validitaAl: '2026-11-02',
    storico: false,
  },
  sintesi: {
    referenze: { attuale: 60, precedente: 55, differenza: 5 },
    box: { attuale: 50, precedente: 50, differenza: 0 },
    pagine: { attuale: 4, precedente: 4, differenza: 0 },
    scontoMedio: { attuale: 24.4, precedente: 26.4, differenza: 24.4 - 26.4 },
    quotaFidelity: { attuale: 18, precedente: 12, differenza: 6 },
    sottocosto: { attuale: 2, precedente: 0, differenza: 2 },
    marche: { attuale: 12, precedente: 14, differenza: -2 },
  },
  spazioPerReparto: [
    { chiave: '01', etichetta: 'DROGHERIA ALIMENTARE', attuale: 42, precedente: 35 },
    // Meno di un punto: non e' un cambiamento da riportare
    { chiave: '03', etichetta: 'BEVANDE', attuale: 13, precedente: 12.6 },
    { chiave: '', etichetta: 'Reparto non indicato', attuale: 45, precedente: 20 },
  ],
  prodottiEntrati: [{ chiave: 'c-9', nome: 'Caffè macinato', marca: 'Alfa', prezzo: 3.49, sconto: 30 }],
  prodottiUsciti: [
    { chiave: 'c-7', nome: 'Tè verde', marca: null, prezzo: null, sconto: null },
    { chiave: 'c-8', nome: 'Biscotti', marca: 'Beta', prezzo: 2, sconto: 10 },
  ],
};

const chiavi = (sezioni: readonly SezioneReport[]) => sezioni.map(chiaveSezione);

function sezioneDi<T extends SezioneReport['tipo']>(sezioni: readonly SezioneReport[], chiave: string): Extract<SezioneReport, { tipo: T }> {
  const trovata = sezioni.find(sezione => chiaveSezione(sezione) === chiave);
  if (!trovata) throw new Error(`Sezione ${chiave} assente`);
  return trovata as Extract<SezioneReport, { tipo: T }>;
}

describe('sezioniStandard: quali sezioni e in che ordine', () => {
  it('con il solo impaginato: sintesi, grafici e metodo', () => {
    const sezioni = sezioniStandard(dati());

    expect(chiavi(sezioni)).toEqual(['sintesi', 'assortimento', 'prezziMarche', 'metodo']);
  });

  it('con l\'edizione precedente: tutte, nell\'ordine standard', () => {
    const sezioni = sezioniStandard(dati({ confronto: CONFRONTO }));

    expect(ORDINE_SEZIONI_STANDARD).toEqual(['sintesi', 'assortimento', 'prezziMarche', 'confronto', 'entratiUsciti', 'metodo']);
    expect(chiavi(sezioni)).toEqual([...ORDINE_SEZIONI_STANDARD]);
    // Ogni sezione standard porta la sua chiave stabile
    expect(sezioni.map(sezione => sezione.chiave)).toEqual([...ORDINE_SEZIONI_STANDARD]);
  });

  it('niente pagine del volantino, mappe, visibilita\', vendite ne\' previsioni, in nessun testo', () => {
    const sezioni = sezioniStandard(dati({ confronto: CONFRONTO }));

    expect(sezioni.map(sezione => sezione.tipo)).not.toContain('pagine');
    expect(JSON.stringify(sezioni)).not.toMatch(FUORI_DAL_REPORT);
  });

  it('un volantino senza box ha solo il metodo: nessuna sezione vuota', () => {
    const vuoto = dati();
    vuoto.insight = {
      ...vuoto.insight,
      box: [],
      sintesi: { ...vuoto.insight.sintesi, referenze: 0, box: 0, scontoMedio: null, boxConSconto: 0, quotaFidelity: 0, sottocosto: 0, marche: 0 },
      prezziSconti: { ...vuoto.insight.prezziSconti, fasce: vuoto.insight.prezziSconti.fasce.map(fascia => ({ ...fascia, box: 0 })), perMeccanica: [] },
      spazio: { ...vuoto.insight.spazio, perReparto: [] },
      marche: { elenco: [], quotaDistributore: null },
    };

    const sezioni = sezioniStandard(vuoto);

    expect(chiavi(sezioni)).toEqual(['metodo']);
    // Senza box niente copertura dei dati
    expect(sezioneDi<'metodo'>(sezioni, 'metodo').paragrafi.some(paragrafo => paragrafo.startsWith('Dati presenti'))).toBe(false);
  });
});

describe('sezioniStandard: sintesi', () => {
  it('indicatori formattati all\'italiana; fidelity, sottocosto e marche solo se ci sono', () => {
    const { indicatori } = sezioneDi<'sintesi'>(sezioniStandard(dati()), 'sintesi');

    expect(indicatori.map(indicatore => [indicatore.etichetta, indicatore.valore, indicatore.dettaglio])).toEqual([
      ['Referenze', '60', '1,2 per box in media'],
      ['Box', '50', '12,5 per pagina in media'],
      ['Pagine', '4', null],
      ['Sconto medio', '24%', 'sui 40 box con sconto'],
      ['Quota Fidelity', '18%', 'dei box con il prezzo Fidelity'],
      ['Sottocosto', '2', 'box in sottocosto'],
      ['Marche', '12', '15% dello spazio alle marche del distributore'],
    ]);
    expect(indicatori.every(indicatore => indicatore.variazione === null)).toBe(true);

    const senzaFidelity = dati();
    senzaFidelity.insight = { ...senzaFidelity.insight, sintesi: { ...senzaFidelity.insight.sintesi, quotaFidelity: 0, sottocosto: 0 } };
    expect(sezioneDi<'sintesi'>(sezioniStandard(senzaFidelity), 'sintesi').indicatori.map(indicatore => indicatore.etichetta))
      .toEqual(['Referenze', 'Box', 'Pagine', 'Sconto medio', 'Marche']);
  });

  it('con l\'edizione precedente ogni indicatore ha la variazione, neutra; nessun indicatore delle vendite', () => {
    const { indicatori } = sezioneDi<'sintesi'>(sezioniStandard(dati({ confronto: CONFRONTO })), 'sintesi');
    const perEtichetta = new Map(indicatori.map(indicatore => [indicatore.etichetta, indicatore]));

    expect(indicatori).toHaveLength(7);
    expect(perEtichetta.get('Referenze')?.variazione).toEqual({ testo: '+5 sulla precedente', verso: 'su', positiva: null });
    expect(perEtichetta.get('Box')?.variazione).toEqual({ testo: 'Pari alla precedente', verso: 'pari', positiva: null });
    expect(perEtichetta.get('Sconto medio')?.variazione).toEqual({ testo: '-2 punti sulla precedente', verso: 'giu', positiva: null });
    expect(perEtichetta.get('Quota Fidelity')?.variazione?.testo).toBe('+6 punti sulla precedente');
    expect(perEtichetta.get('Marche')?.variazione).toMatchObject({ testo: '-2 sulla precedente', verso: 'giu' });
    expect(perEtichetta.has('Vendite')).toBe(false);
  });

  it('frasi chiave dai dati: spazio, sconto e marche del distributore', () => {
    expect(frasiChiave(dati())).toEqual([
      'Il 42% dello spazio va al reparto Drogheria alimentare, che porta il 31% delle referenze.',
      'Lo sconto medio è del 24% sui 40 box con sconto; 12 superano il 30%.',
      'Le marche del distributore occupano il 15% dello spazio.',
    ]);
  });

  it('con l\'edizione precedente la frase sui prodotti entrati e usciti viene prima delle marche', () => {
    expect(frasiChiave(dati({ confronto: CONFRONTO }))).toEqual([
      'Il 42% dello spazio va al reparto Drogheria alimentare, che porta il 31% delle referenze.',
      'Lo sconto medio è del 24% sui 40 box con sconto; 12 superano il 30%.',
      "Rispetto all'edizione precedente entra un prodotto e ne escono 2.",
      'Le marche del distributore occupano il 15% dello spazio.',
    ]);
  });
});

describe('sezioniStandard: grafici', () => {
  it('reparti e meccaniche: senza il reparto non indicato; la meccanica non riconosciuta in fondo, neutra', () => {
    const { grafici } = sezioneDi<'grafici'>(sezioniStandard(dati()), 'assortimento');

    expect(grafici.map(grafico => grafico.titolo)).toEqual(['Quota di referenze e quota di spazio per reparto', 'Meccaniche promozionali']);
    expect(grafici[0].grafico).toEqual({
      forma: 'confronto',
      serie: ['Quota referenze', 'Quota spazio'],
      voci: [
        { etichetta: 'Drogheria alimentare', valori: [31, 42], testi: ['31%', '42%'] },
        { etichetta: 'Bevande', valori: [16.7, 13], testi: ['17%', '13%'] },
      ],
      unita: 'percentuale',
    });
    expect(grafici[1].grafico).toEqual({
      forma: 'ciambella',
      voci: [
        { etichetta: 'Sconto in %', valore: 60, testo: '60%', colore: PALETTE_REPORT_STANDARD.categorie[0] },
        { etichetta: 'Prezzo Fidelity', valore: 18, testo: '18%', colore: PALETTE_REPORT_STANDARD.categorie[1] },
        { etichetta: 'Non riconosciuta', valore: 22, testo: '22%', colore: PALETTE_REPORT_STANDARD.linee },
      ],
      centro: { valore: '50', etichetta: 'box' },
    });
  });

  it('sconti e marche: fasce in quota sui box con sconto; marche del distributore con l\'accento del cliente', () => {
    const palette = { ...PALETTE_REPORT_STANDARD, accento: '#abcdef', categorie: ['#111111', '#222222'] };
    const sezioni = sezioniStandard(dati({ palette }));
    const { grafici } = sezioneDi<'grafici'>(sezioni, 'prezziMarche');

    expect(grafici[0].grafico).toMatchObject({ forma: 'barre', unita: 'percentuale' });
    expect(grafici[0].grafico.forma === 'barre' && grafici[0].grafico.voci.map(voce => [voce.etichetta, voce.valore])).toEqual([
      ['fino al 10%', 10],
      ['10-20%', 25],
      ['20-30%', 35],
      ['30-40%', 20],
      ['40-50%', 7.5],
      ['50% e oltre', 2.5],
    ]);
    // Senza le marche che non occupano spazio
    expect(grafici[1].grafico.forma === 'barre' && grafici[1].grafico.voci).toEqual([
      { etichetta: 'Alfa', valore: 20, testo: '20%', colore: null },
      { etichetta: 'Insegna', valore: 15, testo: '15%', colore: '#abcdef' },
    ]);
    expect(grafici[1].nota).toContain('In evidenza le marche del distributore');
    const meccaniche = sezioneDi<'grafici'>(sezioni, 'assortimento').grafici[1].grafico;
    expect(meccaniche.forma === 'ciambella' && meccaniche.voci.map(voce => voce.colore)).toEqual(['#111111', '#222222', PALETTE_REPORT_STANDARD.linee]);
  });
});

describe('sezioniStandard: confronto con l\'edizione precedente', () => {
  it('indicatori nelle due edizioni e reparti che cambiano di almeno un punto', () => {
    const tabella = sezioneDi<'tabella'>(sezioniStandard(dati({ confronto: CONFRONTO })), 'confronto');

    expect(tabella.introduzione).toBe('Edizione precedente della stessa area e canale: Volantino 20, dal 20 ottobre al 2 novembre 2026.');
    expect(tabella.righe).toEqual([
      ['Referenze', '60', '55', '+5'],
      ['Box', '50', '50', 'Pari'],
      ['Pagine', '4', '4', 'Pari'],
      ['Sconto medio', '24%', '26%', '-2 punti'],
      ['Quota Fidelity', '18%', '12%', '+6 punti'],
      ['Box in sottocosto', '2', '0', '+2'],
      ['Marche', '12', '14', '-2'],
      ['Spazio: Drogheria alimentare', '42%', '35%', '+7 punti'],
    ]);
  });

  it('prodotti entrati e usciti con prezzo e sconto all\'italiana', () => {
    const tabella = sezioneDi<'tabella'>(sezioniStandard(dati({ confronto: CONFRONTO })), 'entratiUsciti');

    expect(tabella.introduzione).toBe("Rispetto all'edizione precedente entra un prodotto e ne escono 2.");
    expect(tabella.righe).toEqual([
      ['Entrato', 'Caffè macinato', 'Alfa', '3,49 €', '30%'],
      ['Uscito', 'Tè verde', '', '', ''],
      ['Uscito', 'Biscotti', 'Beta', '2,00 €', '10%'],
    ]);
  });

  it('senza prodotti entrati o usciti resta solo la tabella degli indicatori', () => {
    const sezioni = sezioniStandard(dati({ confronto: { ...CONFRONTO, prodottiEntrati: [], prodottiUsciti: [] } }));

    expect(chiavi(sezioni)).toContain('confronto');
    expect(chiavi(sezioni)).not.toContain('entratiUsciti');
  });
});

describe('sezioniStandard: metodo', () => {
  it('spiega fonti, spazio, copertura dei dati e limiti, senza visibilita\', vendite ne\' previsioni', () => {
    const { paragrafi } = sezioneDi<'metodo'>(sezioniStandard(dati({ confronto: CONFRONTO })), 'metodo');

    expect(paragrafi).toHaveLength(4);
    expect(paragrafi[0]).toMatch(/^I dati vengono dal volantino impaginato/);
    expect(paragrafi[1]).toContain('quote di spazio');
    expect(paragrafi[2]).toContain('posizione sulla pagina 98%');
    expect(paragrafi[2]).toContain('I box senza posizione contano nei totali ma non nello spazio.');
    expect(paragrafi[3]).toContain('stagionalità');
    expect(paragrafi.join(' ')).not.toMatch(FUORI_DAL_REPORT);
  });

  it('con tutti i box posizionati non serve la nota sui box senza posizione', () => {
    const tuttiPosizionati = dati();
    tuttiPosizionati.insight = {
      ...tuttiPosizionati.insight,
      sintesi: { ...tuttiPosizionati.insight.sintesi, copertura: { ...tuttiPosizionati.insight.sintesi.copertura, geometria: 100 } },
    };

    const { paragrafi } = sezioneDi<'metodo'>(sezioniStandard(tuttiPosizionati), 'metodo');

    expect(paragrafi.join(' ')).not.toContain('senza posizione');
  });
});

describe('riordinaSezioni', () => {
  it('mette le sezioni nell\'ordine indicato; quelle che l\'ordine non nomina, o del cliente, in fondo nel loro ordine', () => {
    const standard = sezioniStandard(dati({ confronto: CONFRONTO }));
    const delCliente: SezioneReport = { tipo: 'tabella', titolo: 'Tabella del cliente', introduzione: null, colonne: [], righe: [], nota: null };

    const riordinate = riordinaSezioni([...standard, delCliente], ['confronto', 'sintesi']);

    expect(chiavi(riordinate)).toEqual(['confronto', 'sintesi', 'assortimento', 'prezziMarche', 'entratiUsciti', 'metodo', null]);
    expect(riordinate).toHaveLength(standard.length + 1);
  });

  it('riconosce le sezioni dalla chiave anche con il titolo cambiato dal cliente; senza chiave, dal titolo', () => {
    const standard = sezioniStandard(dati({ confronto: CONFRONTO }));
    const rinominate = standard.map(sezione => ({ ...sezione, titolo: `Titolo del cliente: ${sezione.titolo}` }));
    const senzaChiave = standard.map((sezione) => {
      const copia = { ...sezione };
      delete copia.chiave;
      return copia;
    });
    const delCliente: SezioneReport = { chiave: 'promo-speciale', tipo: 'metodo', titolo: TITOLI_REPORT.metodo, paragrafi: ['Nota del cliente'] };

    expect(chiavi(rinominate)).toEqual(chiavi(standard));
    expect(chiavi(senzaChiave)).toEqual(chiavi(standard));
    // Una chiave che non e' standard e' del cliente, anche con il titolo e il tipo di una sezione standard
    expect(chiaveSezione(delCliente)).toBeNull();
    // Quelle che l'ordine non nomina restano nell'ordine ricevuto: la sezione del cliente era la prima
    expect(chiavi(riordinaSezioni([delCliente, ...rinominate], ['metodo', 'confronto']))).toEqual([
      'metodo', 'confronto', null, 'sintesi', 'assortimento', 'prezziMarche', 'entratiUsciti',
    ]);
  });
});

describe('testi in italiano', () => {
  it('periodo della promo', () => {
    expect(periodoInItaliano('2026-11-03', '2026-11-16')).toBe('dal 3 al 16 novembre 2026');
    expect(periodoInItaliano('2026-10-28', '2026-11-10')).toBe('dal 28 ottobre al 10 novembre 2026');
    expect(periodoInItaliano('2026-12-28', '2027-01-10')).toBe('dal 28 dicembre 2026 al 10 gennaio 2027');
    expect(periodoInItaliano('2026-11-01', '2026-11-08')).toBe("dal 1° all'8 novembre 2026");
    expect(periodoInItaliano('2026-11-11', null)).toBe("dall'11 novembre 2026");
    expect(periodoInItaliano(null, '2026-11-16')).toBe('fino al 16 novembre 2026');
    expect(periodoInItaliano('2026-11-16', '2026-11-16')).toBe('il 16 novembre 2026');
    expect(periodoInItaliano(null, null)).toBeNull();
    expect(periodoInItaliano('non una data', '2026-13-40')).toBeNull();
  });

  it('sottotitolo con area, canale e periodo, senza le parti che mancano', () => {
    const { contesto } = dati();

    expect(sottotitoloReport(contesto)).toBe('Toscana · Conad City · dal 3 al 16 novembre 2026');
    expect(sottotitoloReport({ ...contesto, area: null, validitaDal: null, validitaAl: null })).toBe('Conad City');
  });

  it('articolo davanti alle percentuali e nomi in maiuscolo in forma di frase', () => {
    expect(conArticolo('42%')).toBe('il 42%');
    expect(conArticolo('8%', true)).toBe("L'8%");
    expect(conArticolo('11,5%')).toBe("l'11,5%");
    expect(conArticolo('1%')).toBe("l'1%");
    expect(conArticolo('18%')).toBe('il 18%');
    expect(conArticolo('0,5%')).toBe('lo 0,5%');
    expect(nomeLeggibile('DROGHERIA  ALIMENTARE')).toBe('Drogheria alimentare');
    expect(nomeLeggibile('Ortofrutta')).toBe('Ortofrutta');
    expect(nomeLeggibile('Reparto 01')).toBe('Reparto 01');
  });
});

describe('reparti con il nome per il marketing della GDO', () => {
  // Un nome per il marketing si mostra come e' scritto, anche tutto maiuscolo; le descrizioni
  // dell'anagrafica restano in forma di frase
  const MARKETING = { codice: '01', descrizione: 'BIO & GUSTO', colore: '#22c55e', marketing: true };
  const conMarketing = (altro: Partial<DatiReportVolantino> = {}): DatiReportVolantino => {
    const base = dati(altro);
    return {
      ...base,
      insight: {
        ...base.insight,
        box: base.insight.box.map(singolo => (singolo.reparto?.codice === '01' ? { ...singolo, reparto: MARKETING } : singolo)),
        spazio: {
          ...base.insight.spazio,
          perReparto: base.insight.spazio.perReparto.map(voce => (voce.chiave === '01' ? { ...voce, etichetta: 'BIO & GUSTO' } : voce)),
        },
      },
    };
  };

  it('nel grafico dei reparti e nella frase sullo spazio', () => {
    const sezioni = sezioniStandard(conMarketing());
    const { grafici } = sezioneDi<'grafici'>(sezioni, 'assortimento');

    expect(grafici[0].grafico.forma === 'confronto' && grafici[0].grafico.voci.map(voce => voce.etichetta)).toEqual(['BIO & GUSTO', 'Bevande']);
    expect(frasiChiave(conMarketing())[0]).toContain('va al reparto BIO & GUSTO');
    // Senza nome per il marketing la descrizione dell'anagrafica resta in forma di frase
    expect(frasiChiave(dati())[0]).toContain('va al reparto Drogheria alimentare');
  });

  it('nel confronto con l\'edizione precedente', () => {
    const confronto = { ...CONFRONTO, spazioPerReparto: CONFRONTO.spazioPerReparto.map(voce => (voce.chiave === '01' ? { ...voce, etichetta: 'BIO & GUSTO' } : voce)) };
    const tabella = sezioneDi<'tabella'>(sezioniStandard(conMarketing({ confronto })), 'confronto');

    expect(tabella.righe).toContainEqual(['Spazio: BIO & GUSTO', '42%', '35%', '+7 punti']);
  });
});
