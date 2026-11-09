import { formattaValore } from '../../../lib/insightVolantino/formato';
import type {
  DatiReportVolantino,
  GraficoSezione,
  IndicatoreReport,
  SezioneReport,
  VoceGrafico,
} from '../../../lib/insightVolantino/report';
import type { ConfrontoEdizione, Variazione } from '../../../lib/insightVolantino/tipi';

/**
 * Sezioni standard del report PDF del volantino (spec insight-volantino, contratto in
 * lib/insightVolantino/report.ts). Funzioni pure: dai dati raccolti dal server (DatiReportVolantino)
 * ai testi, alle tabelle e ai grafici che il browser impagina. La libreria agenzia del cliente riceve
 * queste sezioni (insightVolantino.sezioniReport) e puo' riordinarle con riordinaSezioni.
 *
 * Regole di scrittura: solo sezioni con dati (una sezione vuota non c'e'); numeri all'italiana;
 * frasi brevi, senza gergo tecnico; le variazioni sull'edizione precedente sono neutre (positiva
 * null): il report descrive le scelte commerciali, non le giudica. Per decisione della direzione il
 * report non ha le pagine del volantino ne' stime: solo quello che il volantino impaginato dice.
 */

// ─── Costanti ───────────────────────────────────────────────────────

/** Voci al massimo nei grafici a barre e nel confronto dei reparti. */
export const MAX_VOCI_GRAFICO = 8;
/** Frasi chiave al massimo nella sintesi. */
export const MAX_FRASI_SINTESI = 4;
/** Prodotti entrati e prodotti usciti al massimo nella tabella del confronto. */
export const MAX_PRODOTTI_MOVIMENTO = 8;
/** Reparti con lo spostamento di spazio piu' grande nel confronto con l'edizione precedente. */
export const MAX_REPARTI_CONFRONTO = 5;

/**
 * Le sezioni standard, per riconoscerle e riordinarle (riordinaSezioni). Ogni sezione standard porta
 * la sua chiave in SezioneReport.chiave: la libreria agenzia puo' cambiarne titolo e testi e la
 * sezione resta riconoscibile.
 */
export type ChiaveSezioneReport =
  | 'sintesi'
  | 'assortimento'
  | 'prezziMarche'
  | 'confronto'
  | 'entratiUsciti'
  | 'metodo';

/** L'ordine delle sezioni standard. */
export const ORDINE_SEZIONI_STANDARD: readonly ChiaveSezioneReport[] = [
  'sintesi',
  'assortimento',
  'prezziMarche',
  'confronto',
  'entratiUsciti',
  'metodo',
];

export const TITOLI_REPORT = {
  sintesi: 'Sintesi',
  assortimento: 'Reparti e meccaniche',
  prezziMarche: 'Sconti e marche',
  confronto: "Confronto con l'edizione precedente",
  entratiUsciti: 'Prodotti entrati e usciti',
  metodo: 'Metodo e fonti dei dati',
} as const;

const NON_DISPONIBILE = 'N/D';

const CHIAVI_STANDARD: ReadonlySet<string> = new Set(ORDINE_SEZIONI_STANDARD);

/** La chiave e' quella di una sezione standard. */
export const eChiaveStandard = (chiave: string): chiave is ChiaveSezioneReport => CHIAVI_STANDARD.has(chiave);

// ─── Formati all'italiana ───────────────────────────────────────────

/** Numero con il separatore delle migliaia; `fissi`: sempre `decimali` cifre dopo la virgola. */
function numero(valore: number, decimali = 0, fissi = false): string {
  const testo = new Intl.NumberFormat('it-IT', {
    useGrouping: true,
    minimumFractionDigits: fissi ? decimali : 0,
    maximumFractionDigits: decimali,
  }).format(valore);
  // Un valore che si arrotonda a zero non porta il segno ("-0")
  return /^-0(,0*)?$/.test(testo) ? testo.slice(1) : testo;
}

const percento = (valore: number): string => formattaValore(valore, 'percentuale');

/** Euro con le migliaia separate; sotto i 100 euro sempre con i centesimi ("1,50 €"). */
const euro = (valore: number): string => `${numero(valore, valore < 100 ? 2 : 0, valore < 100)} €`;

const quota = (parte: number, totale: number): number => (totale > 0 ? Math.round((parte / totale) * 1000) / 10 : 0);

/** I numeri che in italiano si leggono con una vocale davanti: 1, 8, 11 e 80-89 ("l'8%", "dall'11"). */
const iniziaConVocale = (testo: string): boolean => /^(8|11(?!\d)|1(?!\d))/.test(testo);
/** Zero si legge "lo zero": "lo 0,5%", "dello 0%". */
const iniziaConZero = (testo: string): boolean => /^0(?!\d)/.test(testo);

/** "il 42%", "l'8%" o "lo 0,5%"; con `maiuscola` a inizio frase. */
export function conArticolo(testo: string, maiuscola = false): string {
  const articolo = iniziaConVocale(testo) ? "l'" : iniziaConZero(testo) ? 'lo ' : 'il ';
  const conIniziale = maiuscola ? articolo.charAt(0).toUpperCase() + articolo.slice(1) : articolo;
  return `${conIniziale}${testo}`;
}

/** "del 24%", "dell'8%" o "dello 0%". */
const delPercento = (testo: string): string =>
  iniziaConVocale(testo) ? `dell'${testo}` : iniziaConZero(testo) ? `dello ${testo}` : `del ${testo}`;

/** Un testo tutto maiuscolo (come le descrizioni dell'anagrafica reparti) in forma di frase. */
export function nomeLeggibile(testo: string): string {
  const pulito = testo.trim().replace(/\s+/g, ' ');
  if (!/\p{L}/u.test(pulito) || pulito !== pulito.toLocaleUpperCase('it-IT')) return pulito;
  const minuscolo = pulito.toLocaleLowerCase('it-IT');
  return minuscolo.charAt(0).toLocaleUpperCase('it-IT') + minuscolo.slice(1);
}

/** Chiude la frase con il punto, se non ha gia' la punteggiatura finale. */
const frase = (testo: string): string => {
  const pulito = testo.trim();
  return pulito === '' || /[.!?]$/.test(pulito) ? pulito : `${pulito}.`;
};

const unisciFrasi = (...frasi: Array<string | null | undefined>): string | null => {
  const testo = frasi.filter((voce): voce is string => !!voce && voce.trim() !== '').map(frase).join(' ');
  return testo === '' ? null : testo;
};

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

interface Giorno {
  giorno: number;
  mese: number;
  anno: number;
}

function leggiGiorno(data: string | null | undefined): Giorno | null {
  const parti = /^(\d{4})-(\d{2})-(\d{2})/.exec(data ?? '');
  if (!parti) return null;
  const [anno, mese, giorno] = [Number(parti[1]), Number(parti[2]), Number(parti[3])];
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  return { giorno, mese, anno };
}

const numeroGiorno = (giorno: number): string => (giorno === 1 ? '1°' : String(giorno));
/** "dal 3", "dall'8", "al 16", "all'11". */
const conPreposizione = (preposizione: 'dal' | 'al', giorno: number): string =>
  iniziaConVocale(String(giorno)) && giorno !== 1 ? `${preposizione}l'${giorno}` : `${preposizione} ${numeroGiorno(giorno)}`;
const meseEAnno = (data: Giorno): string => `${MESI[data.mese - 1]} ${data.anno}`;

/**
 * Il periodo in italiano, da date YYYY-MM-DD: "dal 3 al 16 novembre 2026", "dal 28 ottobre al
 * 10 novembre 2026", "dal 28 dicembre 2026 al 10 gennaio 2027"; null senza date.
 */
export function periodoInItaliano(dal: string | null | undefined, al: string | null | undefined): string | null {
  const inizio = leggiGiorno(dal);
  const fine = leggiGiorno(al);
  if (inizio && fine) {
    if (inizio.anno !== fine.anno) return `${conPreposizione('dal', inizio.giorno)} ${meseEAnno(inizio)} ${conPreposizione('al', fine.giorno)} ${meseEAnno(fine)}`;
    if (inizio.mese !== fine.mese) return `${conPreposizione('dal', inizio.giorno)} ${MESI[inizio.mese - 1]} ${conPreposizione('al', fine.giorno)} ${meseEAnno(fine)}`;
    if (inizio.giorno === fine.giorno) return `il ${numeroGiorno(inizio.giorno)} ${meseEAnno(inizio)}`;
    return `${conPreposizione('dal', inizio.giorno)} ${conPreposizione('al', fine.giorno)} ${meseEAnno(fine)}`;
  }
  if (inizio) return `${conPreposizione('dal', inizio.giorno)} ${meseEAnno(inizio)}`;
  if (fine) return `fino ${conPreposizione('al', fine.giorno)} ${meseEAnno(fine)}`;
  return null;
}

/** Il sottotitolo del report: "Toscana · Conad City · dal 3 al 16 novembre 2026", senza le parti che mancano. */
export function sottotitoloReport(contesto: DatiReportVolantino['contesto']): string {
  return [contesto.area, contesto.canale, periodoInItaliano(contesto.validitaDal, contesto.validitaAl)]
    .map(parte => parte?.trim() ?? '')
    .filter(parte => parte !== '')
    .join(' · ');
}

// ─── Variazioni ─────────────────────────────────────────────────────

type FormatoVariazione = 'conteggio' | 'punti';

const arrotondaVariazione = (differenza: number, formato: FormatoVariazione): number =>
  formato === 'punti' ? Math.round(differenza * 10) / 10 : Math.round(differenza);

/** "+12", "-3", "+2,5 punti"; la differenza gia' arrotondata e diversa da zero. */
function testoDifferenza(differenza: number, formato: FormatoVariazione): string {
  const segno = differenza > 0 ? '+' : '-';
  const assoluta = Math.abs(differenza);
  if (formato === 'conteggio') return `${segno}${numero(assoluta)}`;
  return `${segno}${numero(assoluta, 1)} ${assoluta === 1 ? 'punto' : 'punti'}`;
}

function variazioneIndicatore(voce: Variazione | undefined, formato: FormatoVariazione): IndicatoreReport['variazione'] {
  if (!voce || voce.differenza === null) return null;
  const differenza = arrotondaVariazione(voce.differenza, formato);
  if (differenza === 0) return { testo: 'Pari alla precedente', verso: 'pari', positiva: null };
  return { testo: `${testoDifferenza(differenza, formato)} sulla precedente`, verso: differenza > 0 ? 'su' : 'giu', positiva: null };
}

// ─── Sintesi ────────────────────────────────────────────────────────

/** Da 3 a 7 indicatori: i conteggi sempre, gli altri quando il volantino (o il precedente) ne ha. */
function indicatoriSintesi(dati: DatiReportVolantino): IndicatoreReport[] {
  const { sintesi, marche } = dati.insight;
  const confronto = dati.confronto?.sintesi;
  const almenoInUno = (attuale: number, voce: Variazione | undefined): boolean => attuale > 0 || (voce?.precedente ?? 0) > 0;

  const indicatori: IndicatoreReport[] = [
    {
      etichetta: 'Referenze',
      valore: numero(sintesi.referenze),
      dettaglio: sintesi.box > 0 ? `${numero(sintesi.referenze / sintesi.box, 1)} per box in media` : null,
      variazione: variazioneIndicatore(confronto?.referenze, 'conteggio'),
    },
    {
      etichetta: 'Box',
      valore: numero(sintesi.box),
      dettaglio: sintesi.pagine > 0 ? `${numero(sintesi.box / sintesi.pagine, 1)} per pagina in media` : null,
      variazione: variazioneIndicatore(confronto?.box, 'conteggio'),
    },
    {
      etichetta: 'Pagine',
      valore: numero(sintesi.pagine),
      dettaglio: null,
      variazione: variazioneIndicatore(confronto?.pagine, 'conteggio'),
    },
  ];
  if (sintesi.scontoMedio !== null) {
    indicatori.push({
      etichetta: 'Sconto medio',
      valore: percento(sintesi.scontoMedio),
      dettaglio: sintesi.boxConSconto === 1 ? "sull'unico box con sconto" : `sui ${numero(sintesi.boxConSconto)} box con sconto`,
      variazione: variazioneIndicatore(confronto?.scontoMedio, 'punti'),
    });
  }
  if (almenoInUno(sintesi.quotaFidelity, confronto?.quotaFidelity)) {
    indicatori.push({
      etichetta: 'Quota Fidelity',
      valore: percento(sintesi.quotaFidelity),
      dettaglio: 'dei box con il prezzo Fidelity',
      variazione: variazioneIndicatore(confronto?.quotaFidelity, 'punti'),
    });
  }
  if (almenoInUno(sintesi.sottocosto, confronto?.sottocosto)) {
    indicatori.push({
      etichetta: 'Sottocosto',
      valore: numero(sintesi.sottocosto),
      dettaglio: 'box in sottocosto',
      variazione: variazioneIndicatore(confronto?.sottocosto, 'conteggio'),
    });
  }
  if (almenoInUno(sintesi.marche, confronto?.marche)) {
    indicatori.push({
      etichetta: 'Marche',
      valore: numero(sintesi.marche),
      dettaglio: marche.quotaDistributore
        ? `${percento(marche.quotaDistributore.quotaSpazio)} dello spazio alle marche del distributore`
        : 'marche diverse nel volantino',
      variazione: variazioneIndicatore(confronto?.marche, 'conteggio'),
    });
  }
  return indicatori;
}

function fraseSpazio(dati: DatiReportVolantino): string | null {
  const primo = dati.insight.spazio.perReparto.find(voce => voce.chiave !== '' && voce.quotaSpazio > 0);
  if (!primo) return null;
  return `${conArticolo(percento(primo.quotaSpazio), true)} dello spazio va al reparto ${nomeLeggibile(primo.etichetta)}, che porta ${conArticolo(percento(primo.quotaReferenze))} delle referenze.`;
}

function fraseSconto(dati: DatiReportVolantino): string | null {
  const { sintesi, prezziSconti } = dati.insight;
  if (sintesi.scontoMedio === null || sintesi.boxConSconto === 0) return null;
  const base = `Lo sconto medio è ${delPercento(percento(sintesi.scontoMedio))} ${sintesi.boxConSconto === 1 ? "sull'unico box con sconto" : `sui ${numero(sintesi.boxConSconto)} box con sconto`}`;
  const oltre30 = prezziSconti.fasce.filter(fascia => fascia.da >= 30).reduce((totale, fascia) => totale + fascia.box, 0);
  if (oltre30 === 0 || sintesi.boxConSconto === 1) return `${base}.`;
  return `${base}; ${oltre30 === 1 ? 'uno supera' : `${numero(oltre30)} superano`} il 30%.`;
}

/** "entrano 34 prodotti e ne escono 28", al singolare e senza movimenti quando serve. */
function movimentiProdotti(entrati: number, usciti: number): string | null {
  if (entrati === 0 && usciti === 0) return null;
  const entrano = entrati === 0 ? 'non entrano prodotti' : entrati === 1 ? 'entra un prodotto' : `entrano ${numero(entrati)} prodotti`;
  const escono = usciti === 0 ? 'non ne esce nessuno' : usciti === 1 ? 'ne esce uno' : `ne escono ${numero(usciti)}`;
  return `${entrano} e ${escono}`;
}

function fraseConfronto(dati: DatiReportVolantino): string | null {
  const confronto = dati.confronto;
  if (!confronto) return null;
  const movimenti = movimentiProdotti(confronto.prodottiEntrati.length, confronto.prodottiUsciti.length);
  return movimenti ? `Rispetto all'edizione precedente ${movimenti}.` : "Rispetto all'edizione precedente i prodotti sono gli stessi.";
}

function fraseDistributore(dati: DatiReportVolantino): string | null {
  const distributore = dati.insight.marche.quotaDistributore;
  if (distributore && distributore.quotaSpazio > 0) {
    return `Le marche del distributore occupano ${conArticolo(percento(distributore.quotaSpazio))} dello spazio.`;
  }
  const fidelity = dati.insight.sintesi.quotaFidelity;
  return fidelity > 0 ? `${conArticolo(percento(fidelity), true)} dei box ha il prezzo Fidelity.` : null;
}

/** Le frasi chiave, al massimo MAX_FRASI_SINTESI, nell'ordine di importanza. */
export function frasiChiave(dati: DatiReportVolantino): string[] {
  return [fraseSpazio, fraseSconto, fraseConfronto, fraseDistributore]
    .map(calcola => calcola(dati))
    .filter((testo): testo is string => testo !== null)
    .slice(0, MAX_FRASI_SINTESI);
}

function sezioneSintesi(dati: DatiReportVolantino): SezioneReport | null {
  if (dati.insight.sintesi.box === 0) return null;
  return { chiave: 'sintesi', tipo: 'sintesi', titolo: TITOLI_REPORT.sintesi, indicatori: indicatoriSintesi(dati), frasi: frasiChiave(dati) };
}

// ─── Grafici ────────────────────────────────────────────────────────

function graficoReparti(dati: DatiReportVolantino): GraficoSezione | null {
  const voci = dati.insight.spazio.perReparto.filter(voce => voce.chiave !== '' && (voce.quotaSpazio > 0 || voce.quotaReferenze > 0));
  if (voci.length === 0) return null;
  const mostrate = voci.slice(0, MAX_VOCI_GRAFICO);
  return {
    titolo: 'Quota di referenze e quota di spazio per reparto',
    nota: unisciFrasi(
      voci.length > mostrate.length ? `I ${mostrate.length} reparti con più spazio, su ${numero(voci.length)}` : null,
      'Un reparto con più spazio che referenze ha box più grandi della media',
    ),
    grafico: {
      forma: 'confronto',
      serie: ['Quota referenze', 'Quota spazio'],
      voci: mostrate.map(voce => ({
        etichetta: nomeLeggibile(voce.etichetta),
        valori: [voce.quotaReferenze, voce.quotaSpazio],
        testi: [percento(voce.quotaReferenze), percento(voce.quotaSpazio)],
      })),
      unita: 'percentuale',
    },
  };
}

function graficoMeccaniche(dati: DatiReportVolantino): GraficoSezione | null {
  const voci = dati.insight.prezziSconti.perMeccanica.filter(voce => voce.box > 0);
  if (!voci.some(voce => voce.chiave !== '')) return null;
  const totale = voci.reduce((somma, voce) => somma + voce.box, 0);
  const { categorie, linee } = dati.palette;
  // Le meccaniche riconosciute con i colori delle categorie; quella non riconosciuta in fondo, neutra
  const ordinate = [...voci.filter(voce => voce.chiave !== ''), ...voci.filter(voce => voce.chiave === '')];
  const elenco: VoceGrafico[] = ordinate.map((voce, indice) => {
    const valore = quota(voce.box, totale);
    return {
      etichetta: voce.chiave === '' ? 'Non riconosciuta' : voce.etichetta,
      valore,
      testo: percento(valore),
      colore: voce.chiave === '' ? linee : categorie.length > 0 ? categorie[indice % categorie.length] : null,
    };
  });
  return {
    titolo: 'Meccaniche promozionali',
    nota: 'Quota dei box per meccanica.',
    grafico: { forma: 'ciambella', voci: elenco, centro: { valore: numero(totale), etichetta: 'box' } },
  };
}

function etichettaFascia(da: number, a: number | null): string {
  if (a === null) return `${da}% e oltre`;
  return da === 0 ? `fino al ${a}%` : `${da}-${a}%`;
}

function graficoFasceSconto(dati: DatiReportVolantino): GraficoSezione | null {
  const fasce = dati.insight.prezziSconti.fasce;
  const totale = fasce.reduce((somma, fascia) => somma + fascia.box, 0);
  if (totale === 0) return null;
  return {
    titolo: 'Box per fascia di sconto',
    nota: `Quota sui ${numero(totale)} box con sconto.`,
    grafico: {
      forma: 'barre',
      voci: fasce.map(fascia => {
        const valore = quota(fascia.box, totale);
        return { etichetta: etichettaFascia(fascia.da, fascia.a), valore, testo: percento(valore), colore: null };
      }),
      unita: 'percentuale',
    },
  };
}

function graficoMarche(dati: DatiReportVolantino): GraficoSezione | null {
  const { marche } = dati.insight;
  const elenco = marche.elenco.filter(marca => marca.quotaSpazio > 0).slice(0, MAX_VOCI_GRAFICO);
  if (elenco.length === 0) return null;
  const distributore = marche.quotaDistributore;
  const conDistributore = elenco.some(marca => marca.distributore);
  return {
    titolo: 'Marche principali per spazio',
    nota: distributore && conDistributore
      ? `Quota dello spazio del volantino. In evidenza le marche del distributore, che in tutto occupano ${conArticolo(percento(distributore.quotaSpazio))} dello spazio.`
      : 'Quota dello spazio del volantino.',
    grafico: {
      forma: 'barre',
      voci: elenco.map(marca => ({
        etichetta: marca.nome,
        valore: marca.quotaSpazio,
        testo: percento(marca.quotaSpazio),
        colore: marca.distributore ? dati.palette.accento : null,
      })),
      unita: 'percentuale',
    },
  };
}

function sezioneGrafici(
  chiave: ChiaveSezioneReport,
  titolo: string,
  introduzione: string,
  grafici: Array<GraficoSezione | null>,
): SezioneReport | null {
  const conDati = grafici.filter((grafico): grafico is GraficoSezione => grafico !== null);
  return conDati.length > 0 ? { chiave, tipo: 'grafici', titolo, introduzione, grafici: conDati } : null;
}

// ─── Confronto con l'edizione precedente ────────────────────────────

function rigaVariazione(etichetta: string, voce: Variazione, formato: FormatoVariazione): string[] {
  const valore = (numeroVoce: number | null) =>
    numeroVoce === null ? NON_DISPONIBILE : formato === 'punti' ? percento(numeroVoce) : numero(numeroVoce);
  let variazione = NON_DISPONIBILE;
  if (voce.differenza !== null) {
    const differenza = arrotondaVariazione(voce.differenza, formato);
    variazione = differenza === 0 ? 'Pari' : testoDifferenza(differenza, formato);
  }
  return [etichetta, valore(voce.attuale), valore(voce.precedente), variazione];
}

function tabellaConfronto(confronto: ConfrontoEdizione): SezioneReport {
  const { sintesi } = confronto;
  const reparti = confronto.spazioPerReparto
    .filter(voce => voce.chiave !== '')
    .map(voce => ({ voce, differenza: voce.attuale - voce.precedente }))
    .filter(({ differenza }) => Math.abs(differenza) >= 1)
    .sort((a, b) => Math.abs(b.differenza) - Math.abs(a.differenza))
    .slice(0, MAX_REPARTI_CONFRONTO);
  const periodo = periodoInItaliano(confronto.edizione.validitaDal, confronto.edizione.validitaAl);
  return {
    chiave: 'confronto',
    tipo: 'tabella',
    titolo: TITOLI_REPORT.confronto,
    introduzione: `Edizione precedente della stessa area e canale: ${confronto.edizione.titolo}${periodo ? `, ${periodo}` : ''}.`,
    colonne: [
      { titolo: 'Indicatore', allinea: 'sinistra' },
      { titolo: 'Questa edizione', allinea: 'destra' },
      { titolo: 'Edizione precedente', allinea: 'destra' },
      { titolo: 'Variazione', allinea: 'destra' },
    ],
    righe: [
      rigaVariazione('Referenze', sintesi.referenze, 'conteggio'),
      rigaVariazione('Box', sintesi.box, 'conteggio'),
      rigaVariazione('Pagine', sintesi.pagine, 'conteggio'),
      rigaVariazione('Sconto medio', sintesi.scontoMedio, 'punti'),
      rigaVariazione('Quota Fidelity', sintesi.quotaFidelity, 'punti'),
      rigaVariazione('Box in sottocosto', sintesi.sottocosto, 'conteggio'),
      rigaVariazione('Marche', sintesi.marche, 'conteggio'),
      ...reparti.map(({ voce }) =>
        rigaVariazione(`Spazio: ${nomeLeggibile(voce.etichetta)}`, { attuale: voce.attuale, precedente: voce.precedente, differenza: voce.attuale - voce.precedente }, 'punti')),
    ],
    nota: reparti.length > 0 ? "Per lo spazio dei reparti, i cambiamenti di almeno un punto, dal più grande." : null,
  };
}

function tabellaEntratiUsciti(confronto: ConfrontoEdizione): SezioneReport | null {
  const entrati = confronto.prodottiEntrati;
  const usciti = confronto.prodottiUsciti;
  const movimenti = movimentiProdotti(entrati.length, usciti.length);
  if (!movimenti) return null;
  const riga = (movimento: string, prodotto: ConfrontoEdizione['prodottiEntrati'][number]): string[] => [
    movimento,
    prodotto.nome.trim() || NON_DISPONIBILE,
    prodotto.marca?.trim() || '',
    prodotto.prezzo === null ? '' : euro(prodotto.prezzo),
    prodotto.sconto === null ? '' : percento(prodotto.sconto),
  ];
  const tagliati = entrati.length > MAX_PRODOTTI_MOVIMENTO || usciti.length > MAX_PRODOTTI_MOVIMENTO;
  return {
    chiave: 'entratiUsciti',
    tipo: 'tabella',
    titolo: TITOLI_REPORT.entratiUsciti,
    introduzione: `Rispetto all'edizione precedente ${movimenti}.`,
    colonne: [
      { titolo: 'Movimento', allinea: 'sinistra' },
      { titolo: 'Prodotto', allinea: 'sinistra' },
      { titolo: 'Marca', allinea: 'sinistra' },
      { titolo: 'Prezzo', allinea: 'destra' },
      { titolo: 'Sconto', allinea: 'destra' },
    ],
    righe: [
      ...entrati.slice(0, MAX_PRODOTTI_MOVIMENTO).map(prodotto => riga('Entrato', prodotto)),
      ...usciti.slice(0, MAX_PRODOTTI_MOVIMENTO).map(prodotto => riga('Uscito', prodotto)),
    ],
    nota: tagliati ? `Per ogni movimento i primi ${MAX_PRODOTTI_MOVIMENTO} prodotti, nell'ordine del volantino.` : null,
  };
}

function sezioniConfronto(dati: DatiReportVolantino): SezioneReport[] {
  const confronto = dati.confronto;
  if (!confronto) return [];
  const entratiUsciti = tabellaEntratiUsciti(confronto);
  return entratiUsciti ? [tabellaConfronto(confronto), entratiUsciti] : [tabellaConfronto(confronto)];
}

// ─── Metodo ─────────────────────────────────────────────────────────

function sezioneMetodo(dati: DatiReportVolantino): SezioneReport {
  const { sintesi } = dati.insight;
  const paragrafi = [
    "I dati vengono dal volantino impaginato: posizione e dimensione di ogni box, prezzi, sconti, marca e meccanica delle referenze. Reparti e marche del distributore seguono la configurazione del cliente.",
    'Lo spazio di un box è la parte della pagina che occupa; le quote di spazio di reparti, meccaniche e marche sommano lo spazio dei loro box.',
  ];
  if (sintesi.box > 0) {
    const copertura = sintesi.copertura;
    const senzaPosizione = copertura.geometria < 100 ? ' I box senza posizione contano nei totali ma non nello spazio.' : '';
    paragrafi.push(
      `Dati presenti sui box del volantino: prezzo ${percento(copertura.prezzo)}, marca ${percento(copertura.marca)}, reparto ${percento(copertura.reparto)}, posizione sulla pagina ${percento(copertura.geometria)}.${senzaPosizione}`,
    );
  }
  paragrafi.push("I numeri descrivono il volantino così com'è impaginato e non tengono conto di fattori esterni come stagionalità, meteo o iniziative della concorrenza.");
  return { chiave: 'metodo', tipo: 'metodo', titolo: TITOLI_REPORT.metodo, paragrafi };
}

// ─── Sezioni ────────────────────────────────────────────────────────

/**
 * Le sezioni standard nell'ordine di ORDINE_SEZIONI_STANDARD, solo quelle con dati: sintesi, reparti
 * e meccaniche, sconti e marche, confronto con l'edizione precedente e prodotti entrati e usciti, metodo.
 */
export function sezioniStandard(dati: DatiReportVolantino): SezioneReport[] {
  const sezioni: Array<SezioneReport | null> = [
    sezioneSintesi(dati),
    sezioneGrafici('assortimento', TITOLI_REPORT.assortimento, 'Come si distribuiscono referenze, spazio e box fra reparti e meccaniche.', [
      graficoReparti(dati),
      graficoMeccaniche(dati),
    ]),
    sezioneGrafici('prezziMarche', TITOLI_REPORT.prezziMarche, 'Quanto sono profondi gli sconti e quali marche occupano più spazio.', [
      graficoFasceSconto(dati),
      graficoMarche(dati),
    ]),
    ...sezioniConfronto(dati),
    sezioneMetodo(dati),
  ];
  return sezioni.filter((sezione): sezione is SezioneReport => sezione !== null);
}

// ─── Riordino per il cliente ────────────────────────────────────────

/**
 * Quale sezione standard e': dalla sua chiave (SezioneReport.chiave) o, per una sezione senza chiave,
 * dal tipo o dal titolo; null per una sezione del cliente. Una sezione con una chiave che non e'
 * standard e' del cliente, qualunque sia il titolo.
 */
export function chiaveSezione(sezione: SezioneReport): ChiaveSezioneReport | null {
  const { chiave } = sezione;
  if (chiave !== undefined) return eChiaveStandard(chiave) ? chiave : null;
  switch (sezione.tipo) {
    case 'sintesi':
      return 'sintesi';
    case 'metodo':
      return 'metodo';
    case 'grafici':
      if (sezione.titolo === TITOLI_REPORT.assortimento) return 'assortimento';
      return sezione.titolo === TITOLI_REPORT.prezziMarche ? 'prezziMarche' : null;
    case 'tabella':
      if (sezione.titolo === TITOLI_REPORT.confronto) return 'confronto';
      return sezione.titolo === TITOLI_REPORT.entratiUsciti ? 'entratiUsciti' : null;
  }
}

/**
 * Le sezioni nell'ordine indicato; a parita' (o per quelle che l'ordine non nomina, che vanno in
 * fondo) resta l'ordine ricevuto. Non toglie e non aggiunge nulla: le sezioni senza dati non ci sono gia'.
 */
export function riordinaSezioni(sezioni: readonly SezioneReport[], ordine: readonly ChiaveSezioneReport[]): SezioneReport[] {
  const posizione = (sezione: SezioneReport): number => {
    const chiave = chiaveSezione(sezione);
    const indice = chiave === null ? -1 : ordine.indexOf(chiave);
    return indice === -1 ? ordine.length : indice;
  };
  return sezioni
    .map((sezione, indice) => ({ sezione, indice, posizione: posizione(sezione) }))
    .sort((a, b) => a.posizione - b.posizione || a.indice - b.indice)
    .map(voce => voce.sezione);
}
