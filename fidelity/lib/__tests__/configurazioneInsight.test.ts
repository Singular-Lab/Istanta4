import { describe, expect, it } from 'vitest';
import { verificaConfigurazioneInsight } from '../insightVolantino/configurazione';

// Spec impostazioni-gdo: la configurazione degli insight si verifica prima di salvarla per la GDO.
// Le configurazioni in uso devono passare: quella di un'installazione Edro21 (config/flyerInsightsConfig.json,
// fuori da git: qui la sua forma) e quelle dei test degli insight (VolantinoService.repartiMeccaniche).

/** La forma di config/flyerInsightsConfig.json di un'installazione Edro21, con meno voci per mappa. */
const CONFIG_INSTALLAZIONE = {
  dataMapping: {
    referenzaFields: {
      codiceReferenza: ['data_fields.codice_referenza', 'data_fields.Referenza.Codice'],
      eanReferenza: ['data_fields.ean_referenza', 'data_fields.Referenza.Ean'],
      descrizione: ['data_fields.descrizione_uno', 'data_fields.Descrizioni.Descrizione1'],
      reparto: 'data_fields.reparto',
      descrizioneReparto: 'data_fields.descrizione_reparto',
      meccanica: ['meccanica', 'data_fields.meccanica'],
      prezzo: ['data_fields.prezzo', 'data_fields.prezzo_offerta'],
      prezzoAnziche: 'data_fields.prezzo_anziche',
      foto: 'foto',
      fotoGruppo: 'fotoGruppo',
    },
    reparti: [
      { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
      { codice: '03', descrizione: 'BEVANDE' },
      { codice: '09', descrizione: 'PROFUMERIA' },
    ],
  },
  reparti: {
    title: 'Distribuzione per Reparto',
    groupBy: { field: 'reparto', descriptionField: 'descrizioneReparto' },
    chart: { type: 'doughnut', width: 180, height: 180, cutout: '65%' },
    colorStrategy: {
      type: 'static',
      map: {
        '01': { hex: '#f97316', tw: 'bg-orange-100 text-orange-700' },
        '03': { hex: '#3b82f6', tw: 'bg-blue-100 text-blue-700' },
      },
      default: { hex: '#64748b', tw: 'bg-slate-100 text-slate-700' },
    },
    fields: { labelField: 'descrizione', labelFallback: 'sigla', valueField: 'numeroReferenze', colorField: 'sigla' },
    display: { showLegend: false, centerLabel: { valueType: 'total', label: 'referenze' }, tooltipFormat: '{value} referenze ({percentage}%)', listMaxHeight: 240 },
    emptyState: { icon: 'LayoutGrid', message: 'Nessun reparto trovato' },
  },
  meccaniche: {
    title: 'Distribuzione Meccaniche Promozionali',
    groupBy: { field: 'meccanica' },
    chart: { type: 'bar', indexAxis: 'y', barThickness: 14, borderRadius: 4, heightPerItem: 26, minHeight: 150 },
    colorStrategy: {
      type: 'pattern',
      matchers: [
        { patterns: ['PUNTI'], hex: '#f59e0b', tw: 'bg-amber-100 text-amber-700 border-amber-200' },
        { patterns: ['_FID'], hex: '#3b82f6', tw: 'bg-blue-100 text-blue-700 border-blue-200' },
      ],
      default: { hex: '#64748b', tw: 'bg-slate-100 text-slate-600 border-slate-200' },
    },
    fields: { labelField: 'meccanica', labelFallback: 'N/D', valueField: 'numeroReferenze' },
    display: { showLegend: false, tooltipFormat: '{value} referenze ({percentage}%)', listMaxHeight: 250 },
    emptyState: { icon: 'Tag', message: 'Nessuna meccanica trovata' },
  },
  pagine: {
    title: 'Distribuzione per Pagina',
    chart: {
      type: 'bar', height: 200, barPercentage: 0.7, borderRadius: 4,
      secondaryDataset: { type: 'line', label: 'Ingombro %', borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true },
    },
    fields: { labelField: 'pagina', labelPrefix: 'Pag. ', valueField: 'numeroReferenze', valueLabel: 'Referenze', secondaryValueField: 'ingombroTotalePerc', secondaryValueLabel: 'Ingombro %' },
    display: { showLegend: true, legendPosition: 'top', listMaxHeight: 150, listCols: 4 },
    emptyState: { icon: 'FileX', message: 'Nessuna referenza con dati di posizione' },
  },
  mappa: {
    enabled: true,
    title: 'Mappa Visiva',
    colorField: 'reparto',
    colorStrategy: {
      type: 'static',
      map: { '01': { hex: '#f97316', label: 'Drogheria alimentare' }, '03': { hex: '#3b82f6', label: 'Bevande' } },
      default: { hex: '#64748b', label: 'Altro' },
    },
    display: { maxSpreadWidth: 600, showLegend: true, showMiniNavigation: true, showTotalInfo: true },
    infoPanel: { width: 192, showPrice: true, showMeccanica: true, showIngombro: true },
    emptyState: { icon: 'MapPinOff', message: 'Nessuna referenza con dati di posizione per la mappa' },
  },
};

/** CONFIG_EDRO21 di VolantinoService.repartiMeccaniche.test.ts: sezioni senza titoli ne' grafici. */
const CONFIG_EDRO21 = {
  dataMapping: {
    referenzaFields: {
      codiceReferenza: ['data_fields.codice_referenza', 'data_fields.Referenza.Codice'],
      reparto: 'data_fields.reparto',
      descrizioneReparto: 'data_fields.descrizione_reparto',
      meccanica: ['meccanica', 'data_fields.meccanica'],
    },
    reparti: [
      { codice: '01', descrizione: 'DROGHERIA ALIMENTARE' },
      { codice: '05', descrizione: 'DROGHERIA CHIMICA' },
      { codice: '24', descrizione: 'DEPERIBILI LIBERO SERVIZIO' },
    ],
  },
  reparti: { groupBy: { field: 'reparto', descriptionField: 'descrizioneReparto' } },
  meccaniche: { groupBy: { field: 'meccanica' } },
};

/** CONFIG_SEMPLICE dello stesso test: solo la mappatura dei campi. */
const CONFIG_SEMPLICE = {
  dataMapping: {
    referenzaFields: {
      reparto: 'data_fields.reparto',
      descrizioneReparto: 'data_fields.descrizione_reparto',
      meccanica: 'meccanica',
    },
  },
};

describe('verificaConfigurazioneInsight: le configurazioni in uso', () => {
  it('quella dell\'installazione e\' valida, con le sezioni che ha', () => {
    expect(verificaConfigurazioneInsight(CONFIG_INSTALLAZIONE)).toEqual({
      valida: true,
      errori: [],
      sezioni: ['dataMapping', 'reparti', 'meccaniche', 'pagine', 'mappa'],
    });
  });

  it('quelle dei test degli insight sono valide', () => {
    expect(verificaConfigurazioneInsight(CONFIG_EDRO21)).toEqual({ valida: true, errori: [], sezioni: ['dataMapping', 'reparti', 'meccaniche'] });
    expect(verificaConfigurazioneInsight(CONFIG_SEMPLICE)).toEqual({ valida: true, errori: [], sezioni: ['dataMapping'] });
  });

  it('le chiavi sconosciute restano ammesse; marche del distributore riconosciute', () => {
    const esito = verificaConfigurazioneInsight({ ...CONFIG_SEMPLICE, marche: { distributore: ['Conad'] }, altro: { qualunque: 1 } });
    expect(esito).toEqual({ valida: true, errori: [], sezioni: ['dataMapping', 'marche'] });
  });
});

describe('verificaConfigurazioneInsight: gli errori, in italiano e con il percorso', () => {
  it('la radice deve essere un oggetto con la mappatura dei campi', () => {
    expect(verificaConfigurazioneInsight(null).errori).toEqual([{ percorso: '', messaggio: 'deve essere un oggetto' }]);
    expect(verificaConfigurazioneInsight([]).errori).toEqual([{ percorso: '', messaggio: 'deve essere un oggetto' }]);
    expect(verificaConfigurazioneInsight({})).toEqual({
      valida: false,
      errori: [{ percorso: 'dataMapping', messaggio: "manca: e' obbligatorio" }],
      sezioni: [],
    });
  });

  it('i percorsi dei campi: un testo o un elenco di testi', () => {
    const esito = verificaConfigurazioneInsight({ dataMapping: { referenzaFields: { reparto: 3, meccanica: [] } } });
    expect(esito.valida).toBe(false);
    expect(esito.errori.map(errore => errore.percorso)).toEqual(['dataMapping.referenzaFields.reparto', 'dataMapping.referenzaFields.meccanica']);
    expect(esito.errori[0].messaggio).toBe('deve essere un percorso (testo) o un elenco di percorsi');
  });

  it('l\'anagrafica dei reparti: codice e descrizione', () => {
    const esito = verificaConfigurazioneInsight({ dataMapping: { referenzaFields: {}, reparti: [{ codice: '01' }, { codice: '', descrizione: 'BEVANDE' }] } });
    expect(esito.errori).toEqual([
      { percorso: 'dataMapping.reparti.0.descrizione', messaggio: "manca: e' obbligatorio" },
      { percorso: 'dataMapping.reparti.1.codice', messaggio: "non puo' essere vuoto" },
    ]);
  });

  it('strategie di colore: tipo static o pattern, colori esadecimali', () => {
    const esito = verificaConfigurazioneInsight({
      ...CONFIG_SEMPLICE,
      reparti: { colorStrategy: { type: 'casuale' } },
      meccaniche: { colorStrategy: { type: 'pattern', matchers: [{ patterns: ['_FID'], hex: 'blu' }] } },
      mappa: { colorStrategy: { type: 'static', map: { '01': { hex: '#12345' } } } },
    });
    expect(esito.errori).toEqual([
      { percorso: 'reparti.colorStrategy.type', messaggio: 'deve essere "static" o "pattern"' },
      { percorso: 'meccaniche.colorStrategy.matchers.0.hex', messaggio: 'deve essere un colore esadecimale come #1a2b3c' },
      { percorso: 'mappa.colorStrategy.map.01.hex', messaggio: 'deve essere un colore esadecimale come #1a2b3c' },
    ]);
  });

  it('groupBy con il campo, marche del distributore come elenco, tipi dei flag', () => {
    const esito = verificaConfigurazioneInsight({
      ...CONFIG_SEMPLICE,
      reparti: { groupBy: { field: '' }, enabled: 'si' },
      marche: { distributore: 'Conad' },
    });
    expect(esito.errori).toEqual([
      { percorso: 'reparti.enabled', messaggio: 'deve essere vero o falso (true/false)' },
      { percorso: 'reparti.groupBy.field', messaggio: "non puo' essere vuoto" },
      { percorso: 'marche.distributore', messaggio: 'deve essere un elenco' },
    ]);
  });
});
