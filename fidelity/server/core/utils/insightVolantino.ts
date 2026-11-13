import {
  FASCE_SCONTO,
  type BoxInsight,
  type DensitaPagina,
  type EstensioneInsight,
  type FasciaSconto,
  type MarcaInsight,
  type MenaboVolantino,
  type MarcheVolantino,
  type ParteDescrizione,
  type PrezziSconti,
  type ProdottoInsight,
  type QuotaSpazio,
  type RepartoInsight,
  type ScontoPerGruppo,
  type SintesiVolantino,
  type TestiDescrizioneBox,
  type UsoSpazio,
} from '../../../lib/insightVolantino/tipi';
import { ETICHETTA_MECCANICA } from '../../../lib/puntiVendita/analisi';
import type { BoxKit } from './analisiKit';
import { repartoInAnagrafica, type RepartoAnagrafica } from './campiInsights';
import { lineaEBolli, lineeDelVolantino, type RegoleLinee } from './lineeDistributore';
import { DESCRIZIONE_ASSENTE, type ProdottoStampato, type ReferenzaStampata } from './referenzaStampata';
import { nomeRepartoLeggibile } from './repartiGdo';
import { descrizioneStandard, variantiDei } from '../../../lib/insightVolantino/descrizione';
import { etichettaRuolo } from '../../../lib/insightVolantino/ruolo';

/**
 * Le sezioni nuove degli insight del volantino (lib/insightVolantino/tipi.ts) dai box del kit
 * (boxDelKit), uguali per ogni GDO e per i kit di Istanta e dello storico: prezzi, sconti, marca,
 * meccanica e geometria vengono dalla lettura generica delle referenze (referenzaStampata.ts).
 * Della configurazione del cliente servono solo l'anagrafica dei reparti, il reparto e la
 * meccanica gia' mappati (per gli stessi codici e colori dei riepiloghi di sempre) e le marche
 * del distributore, e arrivano come opzioni: qui niente database e niente lettura della config.
 *
 * Ogni box conta nei conteggi; un box senza geometria ha spazio 0. Per decisione della direzione
 * niente visibilita' stimata, mappe di calore ne' zone calde.
 *
 * Due aggiunte facoltative, anche loro come opzioni: i reparti della GDO (Impostazioni GDO: nome per
 * il marketing e colore, utils/repartiGdo.ts) e le linee del distributore con i bolli, quando la
 * libreria agenzia del cliente le dichiara (utils/lineeDistributore.ts).
 */

export interface OpzioniInsight {
  totalePagine: number;
  anagraficaReparti: readonly RepartoAnagrafica[];
  marcheDistributore: readonly string[];
  /** reparto gia' mappato dalla config per id referenza */
  repartoConfigurato?: (idReferenza: string) => RepartoInsight | null;
  /** meccanica come la scrive la fonte per id referenza */
  meccanicaOriginale?: (idReferenza: string) => string | null;
  urlFoto: (guid: string) => string;
  origine?: (codiceBox: string) => 'listino' | 'fuori_listino' | undefined;
  /** Il reparto con nome per il marketing e colore della GDO (risolutoreReparti); senza, com'e'. */
  risolviReparto?: (reparto: RepartoInsight) => RepartoInsight;
  /** Linee e bolli della libreria agenzia: senza, i box non hanno linea ne' bolli e la sezione e' null. */
  lineeDistributore?: RegoleLinee | null;
  /** Le sigle dei loghi attivi assegnati da Istanta (foto_extra) per id referenza. */
  loghiAssegnati?: (idReferenza: string) => readonly string[];
  /** URL del logo di una sigla nel catalogo di Istanta, gia' letto; null se non c'e'. */
  urlLogo?: (sigla: string) => string | null;
  /** La descrizione completa del box come la compone la libreria agenzia; senza, quella standard. */
  descrizioneBox?: (testi: TestiDescrizioneBox) => ParteDescrizione[];
  /** Le etichette dei ruoli dichiarate dalla libreria agenzia (chiaveRuolo); senza, iniziale maiuscola. */
  ruoli?: Readonly<Record<string, string>>;
  /** Le etichette dei temi dichiarate dalla libreria agenzia (chiaveRuolo); senza, iniziale maiuscola. */
  temi?: Readonly<Record<string, string>>;
  /**
   * La sezione della pagina del menabò dai dati di una referenza (per Conad CNO la mastro), per id
   * referenza; senza, il menabò e' null.
   */
  sezionePagina?: (idReferenza: string) => string | null;
  /**
   * Il nome leggibile di una sezione del menabò; senza, il valore com'e'. Null per un valore che non
   * e' una sezione (per Conad CNO la mastro della pagina bianca): quei box non decidono la sezione.
   */
  nomeSezione?: (sezione: string) => string | null;
}

/** I gruppi dei box che non hanno il dato: chiave vuota, cosi' non si confondono con un valore vero. */
export const SENZA_REPARTO = { chiave: '', etichetta: 'Reparto non indicato' } as const;
export const SENZA_MECCANICA = { chiave: '', etichetta: 'Meccanica non riconosciuta' } as const;
export const SENZA_MARCA = { chiave: '', etichetta: 'Marca non indicata' } as const;

// ─── Numeri ─────────────────────────────────────────────────────────

const arrotonda = (valore: number, cifre = 1): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

const somma = (valori: readonly number[]): number => valori.reduce((totale, valore) => totale + valore, 0);

/** Percentuale 0-100 con un decimale; 0 se il totale e' 0. */
const quota = (parte: number, totale: number): number => (totale > 0 ? arrotonda((parte / totale) * 100) : 0);

const media = (valori: readonly number[]): number | null => (valori.length > 0 ? arrotonda(somma(valori) / valori.length) : null);

/** Nome normalizzato della marca: maiuscole e spazi singoli, per riconoscere la stessa marca scritta in modi diversi. */
export const chiaveMarca = (marca: string): string => marca.toLocaleUpperCase('it-IT').trim().replace(/\s+/g, ' ');

const sconti = (box: readonly BoxInsight[]): number[] => box.flatMap(singolo => (singolo.sconto === null ? [] : [singolo.sconto]));

const referenzeDi = (box: readonly BoxInsight[]): number => somma(box.map(singolo => singolo.idReferenze.length));

const spazioDi = (box: readonly BoxInsight[]): number => somma(box.map(singolo => singolo.spazio));

/**
 * Le pagine su cui si calcola: quelle del volantino, o fino all'ultima con un box se i dati ne
 * hanno di piu' (o se il numero di pagine non si sa), cosi' nessun box resta fuori.
 */
function pagineDelVolantino(box: readonly BoxKit[], totalePagine: number): number {
  const ultimaConBox = box.reduce((massima, singolo) => Math.max(massima, singolo.pagina ?? 0), 0);
  return Math.max(Number.isFinite(totalePagine) && totalePagine > 0 ? Math.floor(totalePagine) : 0, ultimaConBox);
}

// ─── Box ────────────────────────────────────────────────────────────

/** Il primo valore presente fra le referenze del box, dalla pilota in giu'. */
function primo<T>(referenze: readonly ReferenzaStampata[], valore: (referenza: ReferenzaStampata) => T | null | undefined): T | null {
  for (const referenza of referenze) {
    const trovato = valore(referenza);
    if (trovato !== null && trovato !== undefined) return trovato;
  }
  return null;
}

const NUMERO_REPARTO = /^Reparto (\d+)$/;

/**
 * Il reparto del box. Prima quello mappato dalla config (pilota, poi le altre righe del box): ha i
 * codici dell'anagrafica, gli stessi dei colori dei riepiloghi. Altrimenti la lettura generica,
 * ricondotta all'anagrafica se ne riconosce la descrizione, la sigla o il numero ("Reparto 01",
 * come la lettura generica scrive il reparto DB1 o lo stile DIC_Rep_NN); se no, com'e' stato letto.
 */
function repartoLetto(singolo: BoxKit, opzioni: OpzioniInsight): RepartoInsight | null {
  const configurato = primo(singolo.referenze, referenza => opzioni.repartoConfigurato?.(referenza.id));
  if (configurato && configurato.codice.trim() !== '') return configurato;

  const letto = singolo.reparto?.trim();
  if (!letto) return null;
  const numero = NUMERO_REPARTO.exec(letto)?.[1];
  const inAnagrafica = repartoInAnagrafica(opzioni.anagraficaReparti, numero ?? letto, letto);
  if (inAnagrafica) return { codice: inAnagrafica.codice, descrizione: inAnagrafica.descrizione };
  return { codice: letto, descrizione: letto };
}

/**
 * Il reparto del box, con il nome per il marketing e il colore della GDO quando ci sono: piu'
 * codici con lo stesso nome diventano un solo reparto, anche nei gruppi per reparto qui sotto. Senza
 * nome per il marketing la descrizione dell'anagrafica, che arriva in maiuscolo, si scrive come frase
 * ("DROGHERIA ALIMENTARE" -> "Drogheria alimentare"), cosi' accanto ai nomi per il marketing non
 * stona (spec insight-volantino, "Reparti e meccaniche leggibili per ogni fonte del volantino").
 */
function repartoDelBox(singolo: BoxKit, opzioni: OpzioniInsight): RepartoInsight | null {
  const letto = repartoLetto(singolo, opzioni);
  if (!letto) return null;
  const reparto = opzioni.risolviReparto ? opzioni.risolviReparto(letto) : letto;
  return reparto.marketing ? reparto : { ...reparto, descrizione: nomeRepartoLeggibile(reparto.descrizione) };
}

/** Linea e bolli del box dalla referenza pilota, solo se la libreria agenzia dichiara le linee. */
function lineaDelBox(singolo: BoxKit, opzioni: OpzioniInsight): Pick<BoxInsight, 'linea' | 'bolli'> {
  const regole = opzioni.lineeDistributore;
  if (!regole) return {};
  const pilota = singolo.referenze[0];
  return lineaEBolli(opzioni.loghiAssegnati?.(pilota.id) ?? [], {
    marca: pilota.marca,
    descrizione: pilota.nome === DESCRIZIONE_ASSENTE ? null : pilota.nome,
    gusto: pilota.tipo,
  }, regole);
}

/**
 * Gli EAN di una referenza: la fonte ne unisce a volte piu' d'uno in un campo solo
 * ("8033281161575_8033281162091"), con trattini bassi, virgole, punti e virgola o spazi.
 */
export const eanDi = (valore: string | null): string[] =>
  valore ? [...new Set(valore.split(/[\s_,;|/]+/).map(parte => parte.trim()).filter(Boolean))] : [];

/**
 * Un prodotto del box con i suoi dati anagrafici, per la scheda e per l'interrogazione del volantino.
 * Ruolo e tema con le etichette della libreria agenzia: lo stesso valore scritto in modi diversi e'
 * uno solo; il tema come lo scrive la fonte resta per il suggerimento.
 */
const prodottoInsight = (prodotto: ProdottoStampato, { ruoli, temi }: Pick<OpzioniInsight, 'ruoli' | 'temi'>): ProdottoInsight => ({
  chiave: prodotto.chiave,
  nome: prodotto.nome,
  marca: prodotto.marca,
  formato: prodotto.formato,
  gusto: prodotto.tipo,
  codice: prodotto.codice,
  ean: eanDi(prodotto.ean),
  prezzo: prodotto.prezzo,
  settore: prodotto.settore,
  segmento: prodotto.segmento,
  tema: etichettaRuolo(prodotto.tema, temi),
  temaOriginale: prodotto.tema?.trim() || null,
  ruolo: etichettaRuolo(prodotto.ruolo, ruoli),
});

function insightDelBox(singolo: BoxKit, opzioni: OpzioniInsight): BoxInsight {
  const referenze = singolo.referenze;
  const pilota = referenze[0];
  const geometria = singolo.geometria;
  // Prezzo e barrato vanno presi insieme dalla stessa riga: la pilota, o la prima che ha un prezzo.
  // Senza prezzo stampato, quello calcolato dal barrato e dallo sconto della stessa riga.
  const conPrezzo = referenze.find(referenza => referenza.prezzo !== null) ?? pilota;
  const prezzoCalcolato = conPrezzo.prezzo === null ? conPrezzo.prezzoCalcolato ?? null : null;
  const insight: BoxInsight = {
    id: singolo.id,
    codiceBox: singolo.codiceBox,
    pagina: singolo.pagina,
    geometria: geometria ? { x: geometria.x, y: geometria.y, w: geometria.w, h: geometria.h } : null,
    spazio: geometria?.spazio ?? 0,
    proporzionePagina: geometria?.proporzione ?? null,
    chiave: pilota.chiave,
    nome: pilota.nome,
    marca: pilota.marca,
    formato: pilota.formato,
    prezzo: conPrezzo.prezzo ?? prezzoCalcolato,
    barrato: conPrezzo.barrato,
    sconto: singolo.sconto,
    prezzoAlKg: primo(referenze, referenza => referenza.prezzoAlKg || null),
    punti: primo(referenze, referenza => referenza.punti || null),
    sottocosto: singolo.meccanica === 'sottocosto' || referenze.some(referenza => referenza.sottocosto),
    meccanica: singolo.meccanica,
    meccanicaOriginale: primo(referenze, referenza => opzioni.meccanicaOriginale?.(referenza.id) || null),
    reparto: repartoDelBox(singolo, opzioni),
    foto: [...new Set(referenze.flatMap(referenza => referenza.foto))].map(guid => opzioni.urlFoto(guid)),
    prodotti: singolo.prodotti.length,
    idReferenze: referenze.map(referenza => referenza.id),
    ...lineaDelBox(singolo, opzioni),
    dettaglioProdotti: singolo.prodotti.map(prodotto => prodottoInsight(prodotto, opzioni)),
    descrizione: (opzioni.descrizioneBox ?? descrizioneStandard)({
      nome: pilota.nome === DESCRIZIONE_ASSENTE ? null : pilota.nome,
      marca: pilota.marca,
      formato: pilota.formato,
      varianti: variantiDei(singolo.prodotti.map(prodotto => ({ gusto: prodotto.tipo }))),
    }),
  };
  if (prezzoCalcolato !== null) insight.prezzoCalcolato = true;
  if (conPrezzo.prezzo !== null && conPrezzo.prezzoAllEtto) insight.prezzoAllEtto = true;
  const origine = opzioni.origine?.(singolo.codiceBox);
  if (origine) insight.origine = origine;
  return insight;
}

/** I box del volantino per gli insight, nell'ordine del kit. */
export function boxInsight(box: readonly BoxKit[], opzioni: OpzioniInsight): BoxInsight[] {
  return box.map(singolo => insightDelBox(singolo, opzioni));
}

// ─── Gruppi ─────────────────────────────────────────────────────────

interface Etichettato {
  chiave: string;
  etichetta: string;
}

interface Gruppo extends Etichettato {
  box: BoxInsight[];
}

/** I box per gruppo, nell'ordine in cui il gruppo compare la prima volta. */
function raggruppa(box: readonly BoxInsight[], gruppoDi: (singolo: BoxInsight) => Etichettato): Gruppo[] {
  const gruppi = new Map<string, Gruppo>();
  for (const singolo of box) {
    const { chiave, etichetta } = gruppoDi(singolo);
    const gruppo = gruppi.get(chiave) ?? { chiave, etichetta, box: [] };
    gruppo.box.push(singolo);
    gruppi.set(chiave, gruppo);
  }
  return [...gruppi.values()];
}

const perReparto = (singolo: BoxInsight): Etichettato =>
  singolo.reparto
    ? { chiave: singolo.reparto.codice, etichetta: singolo.reparto.descrizione || singolo.reparto.codice }
    : SENZA_REPARTO;

const perMeccanica = (singolo: BoxInsight): Etichettato =>
  singolo.meccanica ? { chiave: singolo.meccanica, etichetta: ETICHETTA_MECCANICA[singolo.meccanica] } : SENZA_MECCANICA;

const perMarca = (singolo: BoxInsight): Etichettato => {
  const nome = singolo.marca?.trim();
  return nome ? { chiave: chiaveMarca(nome), etichetta: nome } : SENZA_MARCA;
};

const perEtichetta = (a: Etichettato, b: Etichettato): number => a.etichetta.localeCompare(b.etichetta, 'it');

// ─── Sezioni ────────────────────────────────────────────────────────

function sintesiDi(box: readonly BoxInsight[], pagine: number): SintesiVolantino {
  const conSconto = sconti(box);
  const conta = (condizione: (singolo: BoxInsight) => boolean): number => box.filter(condizione).length;
  return {
    referenze: referenzeDi(box),
    box: box.length,
    pagine,
    scontoMedio: media(conSconto),
    boxConSconto: conSconto.length,
    quotaFidelity: quota(conta(singolo => singolo.meccanica === 'fidelity'), box.length),
    sottocosto: conta(singolo => singolo.sottocosto),
    marche: new Set(box.flatMap(singolo => (singolo.marca?.trim() ? [chiaveMarca(singolo.marca)] : []))).size,
    copertura: {
      prezzo: quota(conta(singolo => singolo.prezzo !== null), box.length),
      marca: quota(conta(singolo => !!singolo.marca?.trim()), box.length),
      reparto: quota(conta(singolo => singolo.reparto !== null), box.length),
      geometria: quota(conta(singolo => singolo.geometria !== null), box.length),
    },
  };
}

function scontoPerGruppo(gruppi: readonly Gruppo[]): ScontoPerGruppo[] {
  return gruppi
    .map(gruppo => ({ chiave: gruppo.chiave, etichetta: gruppo.etichetta, box: gruppo.box.length, scontoMedio: media(sconti(gruppo.box)) }))
    .sort((a, b) => b.box - a.box || perEtichetta(a, b));
}

/** I box per fascia di sconto (FASCE_SCONTO): anche sui box di piu' volantini (dettaglio della promozione). */
export function fasceSconto(box: readonly BoxInsight[]): FasciaSconto[] {
  return FASCE_SCONTO.map((da, indice) => {
    const a = indice + 1 < FASCE_SCONTO.length ? FASCE_SCONTO[indice + 1] : null;
    const nellaFascia = box.filter(singolo => singolo.sconto !== null && singolo.sconto >= da && (a === null || singolo.sconto < a));
    return { da, a, box: nellaFascia.length };
  });
}

function prezziScontiDi(box: readonly BoxInsight[]): PrezziSconti {
  return {
    fasce: fasceSconto(box),
    perReparto: scontoPerGruppo(raggruppa(box, perReparto)),
    perMeccanica: scontoPerGruppo(raggruppa(box, perMeccanica)),
    sottocosto: box.filter(singolo => singolo.sottocosto).map(singolo => singolo.id),
    conPrezzoAlKg: box.filter(singolo => !!singolo.prezzoAlKg).length,
  };
}

function quoteSpazio(gruppi: readonly Gruppo[], totaleReferenze: number, totaleSpazio: number): QuotaSpazio[] {
  return gruppi
    .map(gruppo => {
      const referenze = referenzeDi(gruppo.box);
      const spazio = spazioDi(gruppo.box);
      return {
        chiave: gruppo.chiave,
        etichetta: gruppo.etichetta,
        referenze,
        spazio: arrotonda(spazio, 2),
        quotaReferenze: quota(referenze, totaleReferenze),
        quotaSpazio: quota(spazio, totaleSpazio),
      };
    })
    .sort((a, b) => b.spazio - a.spazio || b.referenze - a.referenze || perEtichetta(a, b));
}

/** Lo spazio per reparto, ordinato per spazio: anche sui box di piu' volantini (dettaglio della promozione). */
export function spazioPerReparto(box: readonly BoxInsight[]): QuotaSpazio[] {
  return quoteSpazio(raggruppa(box, perReparto), referenzeDi(box), spazioDi(box));
}

function usoSpazioDi(box: readonly BoxInsight[], pagine: number): UsoSpazio {
  const totaleReferenze = referenzeDi(box);
  const totaleSpazio = spazioDi(box);
  const perPagina: DensitaPagina[] = Array.from({ length: pagine }, (_, indice) => {
    const nellaPagina = box.filter(singolo => singolo.pagina === indice + 1);
    // Box sovrapposti non coprono piu' della pagina intera
    return { pagina: indice + 1, box: nellaPagina.length, spazioOccupato: Math.min(100, arrotonda(spazioDi(nellaPagina), 2)) };
  });
  return {
    perReparto: spazioPerReparto(box),
    perMeccanica: quoteSpazio(raggruppa(box, perMeccanica), totaleReferenze, totaleSpazio),
    perMarca: quoteSpazio(raggruppa(box, perMarca), totaleReferenze, totaleSpazio),
    perPagina,
  };
}

/**
 * Le marche dei box, per spazio, senza i box che non ne indicano una (la quota resta sullo spazio di
 * tutti i box): anche sui box di piu' volantini (dettaglio della promozione).
 */
export function marcheDi(box: readonly BoxInsight[], marcheDistributore: readonly string[]): MarcheVolantino {
  const totaleSpazio = spazioDi(box);
  const delDistributore = marcheDistributore.map(chiaveMarca).filter(valore => valore !== '');
  const eDelDistributore = (marca: string | null): boolean => {
    const chiave = marca ? chiaveMarca(marca) : '';
    return chiave !== '' && delDistributore.some(valore => chiave.includes(valore));
  };

  const elenco = raggruppa(box.filter(singolo => !!singolo.marca?.trim()), perMarca)
    .map(gruppo => ({ gruppo, spazio: spazioDi(gruppo.box) }))
    .sort((a, b) => b.spazio - a.spazio || b.gruppo.box.length - a.gruppo.box.length || perEtichetta(a.gruppo, b.gruppo))
    .map(({ gruppo, spazio }): MarcaInsight => ({
      chiave: gruppo.chiave,
      nome: gruppo.etichetta,
      box: gruppo.box.length,
      referenze: referenzeDi(gruppo.box),
      quotaSpazio: quota(spazio, totaleSpazio),
      scontoMedio: media(sconti(gruppo.box)),
      distributore: eDelDistributore(gruppo.etichetta),
    }));

  if (delDistributore.length === 0) return { elenco, quotaDistributore: null };
  const delDistributoreNelVolantino = box.filter(singolo => eDelDistributore(singolo.marca));
  return {
    elenco,
    quotaDistributore: {
      quotaSpazio: quota(spazioDi(delDistributoreNelVolantino), totaleSpazio),
      quotaBox: quota(delDistributoreNelVolantino.length, box.length),
    },
  };
}

// ─── Menabò ─────────────────────────────────────────────────────────

/**
 * Il menabò del volantino (spec insight-volantino, "Menabò del volantino"): per ogni pagina la
 * sezione delle sue referenze, dalla pilota di ogni box in giu'. Le sezioni si contano per nome
 * leggibile, senza distinguere maiuscole e spazi ("GAdx-GASTRONOMIA dx" e "GA-GASTRONOMIA" sono
 * "Gastronomia", "Focus Pulizia Casa" e "Focus puliziacasa" una sezione sola, col primo nome visto
 * nel volantino), con il primo valore della fonte per il suggerimento; con piu' sezioni nella stessa pagina vince quella del maggior numero di
 * box, a parita' quella che compare prima. Un valore che il nome dichiara non sezione (null) non conta.
 * Null senza la lettura della sezione o quando nessun box ne ha una.
 */
export function menaboDi(box: readonly BoxKit[], opzioni: Pick<OpzioniInsight, 'sezionePagina' | 'nomeSezione'>): MenaboVolantino | null {
  const leggi = opzioni.sezionePagina;
  if (!leggi) return null;
  // Lo stesso nome scritto in modi diversi e' la stessa sezione: vale il primo visto nel volantino
  const nomi = new Map<string, string>();
  // Per pagina: nome leggibile -> primo valore della fonte e numero di box
  const perPagina = new Map<number, Map<string, { sezione: string; box: number }>>();
  for (const singolo of box) {
    if (singolo.pagina === null) continue;
    const sezione = primo(singolo.referenze, referenza => leggi(referenza.id)?.trim() || null);
    if (!sezione) continue;
    const nome = opzioni.nomeSezione ? opzioni.nomeSezione(sezione) : sezione;
    if (nome === null) continue;
    const letto = nome || sezione;
    const chiaveNome = letto.toLocaleLowerCase('it-IT').replace(/\s+/g, '');
    if (!nomi.has(chiaveNome)) nomi.set(chiaveNome, letto);
    const chiave = nomi.get(chiaveNome) ?? letto;
    const conti = perPagina.get(singolo.pagina) ?? new Map<string, { sezione: string; box: number }>();
    const voce = conti.get(chiave);
    if (voce) voce.box += 1;
    else conti.set(chiave, { sezione, box: 1 });
    perPagina.set(singolo.pagina, conti);
  }
  if (perPagina.size === 0) return null;
  const pagine = [...perPagina]
    .sort(([a], [b]) => a - b)
    .map(([pagina, conti]) => {
      // Map tiene l'ordine d'inserimento: a parita' di box resta la sezione vista per prima
      let scelta = { nome: '', sezione: '', box: 0 };
      for (const [nome, voce] of conti) if (voce.box > scelta.box) scelta = { nome, ...voce };
      return { pagina, sezione: scelta.sezione, nome: scelta.nome };
    });
  return { pagine };
}

/** Box e sezioni degli insight del volantino; il PDF lo aggiunge chi conosce il kit. */
export function sezioniInsight(box: readonly BoxKit[], opzioni: OpzioniInsight): Omit<EstensioneInsight, 'pdf'> {
  const pagine = pagineDelVolantino(box, opzioni.totalePagine);
  const insight = boxInsight(box, opzioni);
  return {
    box: insight,
    sintesi: sintesiDi(insight, pagine),
    prezziSconti: prezziScontiDi(insight),
    spazio: usoSpazioDi(insight, pagine),
    marche: marcheDi(insight, opzioni.marcheDistributore),
    lineeDistributore: opzioni.lineeDistributore ? lineeDelVolantino(insight, opzioni.lineeDistributore, opzioni.urlLogo) : null,
    menabo: menaboDi(box, opzioni),
  };
}
