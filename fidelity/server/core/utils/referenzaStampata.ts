import type { MeccanicaReferenza } from '../../../lib/puntiVendita/analisi';

/**
 * Una riga della tabella referenze letta com'è stampata nel volantino, qualunque sia la fonte
 * (contratto in lib/puntiVendita/analisi.ts):
 * - storico (sync del Plugin): testo stampato in compiled_fields (descrizione con gli stili di
 *   carattere <DES_descr_nome>, <DES_descr_marca>…, prezzi come "1,69" o "€ 2,95", sconti come
 *   "-42,71%"), meccanica vuota, codice_box = groupId di InDesign, data_fields dal listino DB1
 *   (chiavi puntate) o, per le compilate a mano, il record DB1 con gli alias FP;
 * - Istanta: data_fields con chiavi puntate o FP e prezzi come testo, meccanica = nome della
 *   combinazione ("TP_FID_KgL"), il resto del box in group_elements.
 *
 * La geometria ha due significati: lo storico manda x relativa alla pagina e perc_ingombro già in
 * percentuale, Istanta x relativa alla doppia pagina (le pagine destre partono da w_page) e
 * perc_ingombro come frazione. Si decide riga per riga dai valori e si restituisce sempre la
 * geometria relativa alla pagina, da 0 a 1, con lo spazio in percentuale.
 *
 * Funzioni pure: niente database, niente configurazione.
 */

export type FonteReferenza = 'db1' | 'istanta' | 'testo';

/** Le colonne di referenze che servono all'analisi, come le restituisce pg. */
export interface RigaReferenza {
  id: string;
  compiled_fields?: unknown;
  data_fields?: unknown;
  foto?: unknown;
  meccanica?: string | null;
  codice_box?: string | null;
  group_elements?: unknown;
  pag?: number | string | null;
  x?: number | string | null;
  y?: number | string | null;
  w?: number | string | null;
  h?: number | string | null;
  w_page?: number | string | null;
  h_page?: number | string | null;
  perc_ingombro?: number | string | null;
}

export interface ContestoReferenza {
  /** Il kit viene dallo storico (runtime_kit.import_storico): codice e dati arrivano da DB1. */
  storico: boolean;
}

/** Un prodotto del box: la referenza stessa (pilota) o un altro elemento del suo gruppo. */
export interface ProdottoStampato {
  /** Chiave stabile del prodotto, sicura per un URL: 'c-<codice>' o 'd-<nome|marca|formato>'. */
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  tipo: string | null;
  codice: string | null;
  ean: string | null;
  prezzo: number | null;
  barrato: number | null;
  /** 0–100. */
  sconto: number | null;
  prezzoAlKg: string | null;
  punti: string | null;
  meccanica: MeccanicaReferenza | null;
  sottocosto: boolean;
  reparto: string | null;
  settore: string | null;
  segmento: string | null;
  ruolo: string | null;
  tema: string | null;
  fonte: FonteReferenza;
  /** Guid Olimpo senza doppioni; vuoto per gli elementi del gruppo, che non hanno foto proprie. */
  foto: string[];
}

/** Posizione del box nella sua pagina, da 0 a 1. */
export interface GeometriaReferenza {
  pagina: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Percentuale della superficie della pagina, 0–100. */
  spazio: number;
  /** Larghezza/altezza della pagina. */
  proporzione: number;
}

export interface ReferenzaStampata extends ProdottoStampato {
  id: string;
  codiceBox: string;
  pagina: number | null;
  geometria: GeometriaReferenza | null;
  /** Prodotti del box senza doppioni: il primo è la referenza stessa. */
  prodotti: ProdottoStampato[];
}

export const DESCRIZIONE_ASSENTE = 'Referenza senza descrizione';

// ─── Testo e numeri ─────────────────────────────────────────────────

const ENTITA: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', euro: '€', deg: '°', times: '×', middot: '·',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
};

const decodificaEntita = (intera: string, nome: string): string => {
  if (nome.startsWith('#x') || nome.startsWith('#X')) {
    const codice = Number.parseInt(nome.slice(2), 16);
    return Number.isFinite(codice) ? String.fromCodePoint(codice) : intera;
  }
  if (nome.startsWith('#')) {
    const codice = Number.parseInt(nome.slice(1), 10);
    return Number.isFinite(codice) ? String.fromCodePoint(codice) : intera;
  }
  return ENTITA[nome] ?? ENTITA[nome.toLowerCase()] ?? intera;
};

/** Testo leggibile da un contenuto stampato: senza tag e stili di carattere, <br> e a capo come spazi. */
export function testoStampato(valore: unknown): string {
  if (valore === null || valore === undefined || typeof valore === 'object') return '';
  return String(valore)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodificaEntita)
    .replace(/[\s\u00a0\u2028\u2029]+/g, ' ')
    .trim();
}

/**
 * Il primo numero di un testo stampato o di un campo: "2,69", "€ 2,95", "-42,71%", "1.234,56",
 * 1.29. Sempre positivo (il segno dello sconto stampato non conta); null se non c'è.
 */
export function numeroStampato(valore: unknown): number | null {
  if (typeof valore === 'number') return Number.isFinite(valore) ? Math.abs(valore) : null;
  if (typeof valore !== 'string') return null;
  const trovato = /\d+(?:[.,]\d+)*/.exec(valore);
  if (!trovato) return null;
  let testo = trovato[0];
  if (testo.includes(',')) {
    // Virgola decimale (l'ultima), punti come separatori delle migliaia
    const ultima = testo.lastIndexOf(',');
    testo = `${testo.slice(0, ultima).replace(/[.,]/g, '')}.${testo.slice(ultima + 1)}`;
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(testo)) {
    testo = testo.replace(/\./g, '');
  }
  const numero = Number(testo);
  return Number.isFinite(numero) ? numero : null;
}

const arrotonda = (valore: number, cifre = 2): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

const prezzoValido = (valore: number | null): number | null =>
  valore !== null && valore > 0 && valore < 100000 ? arrotonda(valore) : null;

const scontoValido = (valore: number | null): number | null =>
  valore !== null && valore > 0 && valore < 100 ? arrotonda(valore) : null;

/** Lo sconto dai due prezzi, solo se il barrato è più alto. */
export function scontoDaiPrezzi(prezzo: number | null, barrato: number | null): number | null {
  if (prezzo === null || barrato === null || barrato <= prezzo) return null;
  return scontoValido((1 - prezzo / barrato) * 100);
}

/** Un testo tutto maiuscolo con le iniziali maiuscole ("SAN BENEDETTO" -> "San Benedetto"); gli altri restano come sono. */
export function maiuscoleSensate(testo: string | null): string | null {
  if (!testo) return null;
  if (/\p{Ll}/u.test(testo) || !/\p{Lu}/u.test(testo)) return testo;
  return testo.toLocaleLowerCase('it-IT').replace(/(^|[\s'’(-])(\p{L})/gu, (_, prima: string, lettera: string) => prima + lettera.toLocaleUpperCase('it-IT'));
}

/** La prima lettera maiuscola ("plumcake" -> "Plumcake"). */
const primaMaiuscola = (testo: string | null): string | null =>
  testo ? testo.charAt(0).toLocaleUpperCase('it-IT') + testo.slice(1) : null;

/** Un testo tutto maiuscolo come frase ("DROGHERIA ALIMENTARE" -> "Drogheria alimentare"). */
export function comeFrase(testo: string | null): string | null {
  if (!testo) return null;
  if (/\p{Ll}/u.test(testo) || !/\p{Lu}/u.test(testo)) return testo;
  const minuscolo = testo.toLocaleLowerCase('it-IT');
  return minuscolo.charAt(0).toLocaleUpperCase('it-IT') + minuscolo.slice(1);
}

// ─── Campi stampati e dati ──────────────────────────────────────────

interface CampoStampato {
  etichetta: string;
  paragrafo: string;
  contenuto: string;
}

type Dati = Record<string, unknown>;

const testoCampo = (valore: unknown): string =>
  typeof valore === 'string' ? valore : typeof valore === 'number' ? String(valore) : '';

/** compiled_fields: { labelName, paragraphName, content }, anche in snake_case. */
function campiStampati(valore: unknown): CampoStampato[] {
  if (!Array.isArray(valore)) return [];
  return valore.flatMap((campo: unknown) => {
    if (!campo || typeof campo !== 'object') return [];
    const voce = campo as Dati;
    return [{
      etichetta: testoCampo(voce.labelName ?? voce.label_name).trim(),
      paragrafo: testoCampo(voce.paragraphName ?? voce.paragraph_name).trim(),
      contenuto: testoCampo(voce.content),
    }];
  });
}

const datiDi = (valore: unknown): Dati =>
  valore && typeof valore === 'object' && !Array.isArray(valore) ? valore as Dati : {};

/** Il primo dei campi indicati che ha un valore, come testo. */
function dato(dati: Dati, ...chiavi: string[]): string | null {
  for (const chiave of chiavi) {
    const valore = dati[chiave];
    if (typeof valore === 'string' && valore.trim() !== '') return valore.trim();
    if (typeof valore === 'number' && Number.isFinite(valore)) return String(valore);
  }
  return null;
}

function datoNumerico(dati: Dati, ...chiavi: string[]): number | null {
  for (const chiave of chiavi) {
    const numero = numeroStampato(dati[chiave]);
    if (numero !== null) return numero;
  }
  return null;
}

/** Il testo stampato del primo campo con una delle etichette (senza maiuscole), nell'ordine dato. */
function stampato(campi: readonly CampoStampato[], ...etichette: string[]): CampoStampato | null {
  for (const etichetta of etichette) {
    const campo = campi.find(voce => voce.etichetta.toLowerCase() === etichetta.toLowerCase() && testoStampato(voce.contenuto) !== '');
    if (campo) return campo;
  }
  return null;
}

const STILE_DESCRIZIONE = /<(DES_descr_([a-z]+)[a-z0-9_]*)>([\s\S]*?)<\/\1>/gi;

interface Descrizione {
  nome: string | null;
  marca: string | null;
  tipo: string | null;
  formato: string | null;
}

const MISURA_STAMPATA = /\d+(?:[.,]\d+)?\s*(?:kg|g|gr|mg|ml|cl|dl|lt|l|pezzi|pezzo|pz)\b/i;

/**
 * Nome, marca, tipo e formato dagli stili di carattere della descrizione stampata (e dalle loro
 * varianti _MC, _BFist…). Una descrizione senza stili (le copertine) e' tutta nome, tranne le
 * ultime righe con una misura ("330 g", "conf. da 10 pezzi"), che sono il formato.
 */
export function descrizioneStampata(contenuto: string): Descrizione {
  const parti = new Map<string, string[]>();
  let conStili = false;
  for (const trovato of contenuto.matchAll(STILE_DESCRIZIONE)) {
    conStili = true;
    const testo = testoStampato(trovato[3]);
    if (!testo) continue;
    const parte = trovato[2].toLowerCase();
    parti.set(parte, [...(parti.get(parte) ?? []), testo]);
  }
  if (!conStili) {
    const righe = contenuto.split(/<br\s*\/?>|\r\n|\r|\n|\u2028|\u2029/i).map(testoStampato).filter(Boolean);
    const formato: string[] = [];
    while (righe.length > 1 && MISURA_STAMPATA.test(righe[righe.length - 1])) formato.unshift(righe.pop() as string);
    return { nome: righe.join(' ') || null, marca: null, tipo: null, formato: formato.join(' ') || null };
  }
  const unisci = (parte: string): string | null => parti.get(parte)?.join(' ') || null;
  return { nome: unisci('nome'), marca: unisci('marca'), tipo: unisci('tipo'), formato: unisci('gr') };
}

function campoDescrizione(campi: readonly CampoStampato[]): CampoStampato | null {
  return campi.find(campo => /<DES_descr_/i.test(campo.contenuto))
    ?? campi.find(campo => campo.etichetta.toLowerCase() === 'descrizione' && testoStampato(campo.contenuto) !== '')
    ?? null;
}

// ─── Chiave del prodotto ────────────────────────────────────────────

const normalizzaChiave = (testo: string | null): string =>
  (testo ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const MISURA = /\d+(?: \d+)? ?(?:kg|g|gr|mg|ml|cl|dl|lt|l|pezzi|pezzo|pz)\b/g;

/** Il formato nella chiave: le misure ("conf. 80 g x 12 pezzi" -> "80g 12pezzi"), o il testo se non ce ne sono. */
function formatoChiave(formato: string | null): string {
  const normalizzato = normalizzaChiave(formato);
  const misure = normalizzato.match(MISURA);
  return misure ? misure.map(misura => misura.replace(/ /g, '')).join(' ') : normalizzato;
}

const SICURO_PER_URL = /^[A-Za-z0-9_.~-]+$/;

const base64url = (testo: string): string => Buffer.from(testo, 'utf8').toString('base64url');

/**
 * Chiave stabile del prodotto: 'c-<codice>' se DB1 o Istanta lo mandano (l'EAN non basta: i
 * prodotti a peso variabile ne hanno più d'uno), altrimenti 'd-' e nome, marca e formato del testo
 * stampato, normalizzati. Un prodotto senza nessuno dei tre resta a sé (riserva: l'id della riga).
 */
export function chiaveProdotto(codice: string | null, nome: string | null, marca: string | null, formato: string | null, riserva: string): string {
  if (codice) return SICURO_PER_URL.test(codice) ? `c-${codice}` : `c-${base64url(codice)}`;
  const parti = [normalizzaChiave(nome), normalizzaChiave(marca), formatoChiave(formato)];
  if (!parti.some(Boolean)) return `d-${base64url(`#${riserva}`)}`;
  return `d-${base64url(parti.join('|'))}`;
}

// ─── Meccanica ──────────────────────────────────────────────────────

interface Segnali {
  sottocosto: boolean;
  punti: boolean;
  nxm: boolean;
  fidelity: boolean;
  sconto: boolean;
  prezzo: boolean;
}

const SOTTOCOSTO = /sotto\s*-?\s*costo/i;
const NXM_TESTO = /^\s*\d+\s*[x×]\s*\d+\s*$/i;

/**
 * La meccanica dai segnali, in quest'ordine: sottocosto, punti e bollini, N×M, prezzo Fidelity,
 * sconto (barrato o percentuale), prezzo; null se il box non dice niente.
 */
export function meccanicaDaiSegnali(segnali: Segnali): MeccanicaReferenza | null {
  if (segnali.sottocosto) return 'sottocosto';
  if (segnali.punti) return 'punti';
  if (segnali.nxm) return 'nxm';
  if (segnali.fidelity) return 'fidelity';
  if (segnali.sconto) return 'sconto';
  if (segnali.prezzo) return 'prezzo';
  return null;
}

const positivo = (valore: number | null): boolean => valore !== null && valore > 0;

/** I segnali della meccanica da campi stampati, data_fields e colonna meccanica (DB1 o combinazione Istanta). */
function segnaliDi(campi: readonly CampoStampato[], dati: Dati, meccanica: string, prezzi: { prezzo: number | null; barrato: number | null; sconto: number | null }): Segnali {
  const descrizione = campoDescrizione(campi);
  const altriCampi = campi.filter(campo => campo !== descrizione);
  const meccanicaDati = dato(dati, 'meccanica') ?? '';
  const etichetteIstanta = Array.isArray(dati.allEtichette) ? dati.allEtichette.filter((voce): voce is string => typeof voce === 'string') : [];
  const testi = [meccanica, meccanicaDati, ...etichetteIstanta, ...campi.flatMap(campo => [campo.etichetta, campo.paragrafo, testoStampato(campo.contenuto)])];

  const sottocosto = testi.some(testo => SOTTOCOSTO.test(testo)) || dati.sottocosto === true;
  const punti = altriCampi.some(campo => /^x?_?(tipo_)?punti\d*$/i.test(campo.etichetta) && testoStampato(campo.contenuto) !== '')
    || altriCampi.some(campo => /punti|bollin/i.test(campo.paragrafo) && testoStampato(campo.contenuto) !== '')
    || positivo(datoNumerico(dati, 'punti1', 'punti2'))
    || /punt|bollin/i.test(meccanica) || /punt|bollin/i.test(meccanicaDati);
  const nxm = (positivo(datoNumerico(dati, 'N_MM')) && positivo(datoNumerico(dati, 'M_MM')))
    || (positivo(datoNumerico(dati, 'N_fid')) && positivo(datoNumerico(dati, 'M_fid')))
    || NXM_TESTO.test(meccanicaDati) || NXM_TESTO.test(meccanica)
    || /^NM_|_NM_|\bN[x×]M\b/i.test(meccanica)
    || altriCampi.some(campo => /^(n|m)_(mm|fid)$|n[x×]m/i.test(campo.etichetta) || /n[x×]m|(^|_)nm(_|$)/i.test(campo.paragrafo)
      || NXM_TESTO.test(testoStampato(campo.contenuto)));
  const fidelity = /fid/i.test(meccanica) || /fidelity/i.test(meccanicaDati)
    || etichetteIstanta.some(voce => /(^|_)FID(_|$)/i.test(voce))
    || altriCampi.some(campo => /fidelity|(^|_)fid(_|$)/i.test(campo.paragrafo) || (/(^|_)fid$/i.test(campo.etichetta) && testoStampato(campo.contenuto) !== ''))
    || positivo(datoNumerico(dati, 'sconto_fid'));
  const sconto = (prezzi.barrato !== null && (prezzi.prezzo === null || prezzi.barrato > prezzi.prezzo))
    || prezzi.sconto !== null
    || /^PERCENTO_/i.test(meccanica) || /scont|%/i.test(meccanicaDati);
  return { sottocosto, punti, nxm, fidelity, sconto, prezzo: prezzi.prezzo !== null };
}

// ─── Lettura della riga ─────────────────────────────────────────────

const CODICE = ['codice_referenza', 'Referenza.Codice', 'codice'];
const EAN = ['ean_referenza', 'Referenza.Ean', 'ean'];

/** Il reparto: descrizione, sigla, numero DB1, e infine il numero nello stile di paragrafo DIC_Rep_NN. */
function repartoDi(dati: Dati, campi: readonly CampoStampato[]): string | null {
  const descrizione = dato(dati, 'descrizione_reparto', 'Descrizioni.Reparto');
  if (descrizione) return comeFrase(testoStampato(descrizione));
  const sigla = dato(dati, 'sigla_reparto');
  if (sigla) return sigla.toUpperCase();
  const numero = dato(dati, 'reparto');
  if (numero) return /^\d+$/.test(numero) ? `Reparto ${numero.padStart(2, '0')}` : comeFrase(numero);
  for (const campo of campi) {
    const trovato = /DIC_Rep_(\d+)/i.exec(campo.paragrafo);
    if (trovato) return `Reparto ${trovato[1].padStart(2, '0')}`;
  }
  return null;
}

function puntiStampati(campi: readonly CampoStampato[], dati: Dati): string | null {
  const voci: string[] = [];
  for (const indice of ['1', '2']) {
    const quanti = testoStampato(stampato(campi, `punti${indice}`)?.contenuto) || dato(dati, `punti${indice}`);
    if (!quanti) continue;
    const tipo = testoStampato(stampato(campi, `tipo_punti${indice}`)?.contenuto) || dato(dati, `tipo_punti${indice}`) || 'punti';
    const con = testoStampato(stampato(campi, `range${indice}`)?.contenuto) || dato(dati, `range${indice}`);
    voci.push(con ? `${quanti} ${tipo} con ${con}` : `${quanti} ${tipo}`);
  }
  return voci.length > 0 ? voci.join(' · ') : null;
}

const UNITA: Readonly<Record<string, string>> = { kg: 'kg', chilogrammo: 'kg', litro: 'l', litri: 'l', l: 'l', lt: 'l', pezzo: 'pezzo', pz: 'pezzo' };

function prezzoAlKgDaiDati(dati: Dati): string | null {
  const offerta = prezzoValido(datoNumerico(dati, 'prezzo_offerta_kgl'));
  if (offerta === null) return null;
  const unita = UNITA[(dato(dati, 'descrizione_unita_misura', 'Descrizioni.Um', 'um') ?? 'kg').toLowerCase()] ?? 'kg';
  const euro = (valore: number) => `€ ${valore.toFixed(2).replace('.', ',')}`;
  const prima = prezzoValido(datoNumerico(dati, 'prezzo_anziche_kgl', 'anziche_kgl'));
  return prima !== null && prima > offerta ? `al ${unita} da ${euro(prima)} a ${euro(offerta)}` : `al ${unita} ${euro(offerta)}`;
}

const fotoDi = (valore: unknown): string[] => {
  if (!Array.isArray(valore)) return [];
  const guid = valore
    .map((voce: unknown) => (typeof voce === 'string' ? voce : (voce as { guidId?: unknown } | null)?.guidId))
    .filter((voce): voce is string => typeof voce === 'string' && voce.trim() !== '')
    .map(voce => voce.trim());
  return [...new Set(guid)];
};

const haDati = (dati: Dati): boolean =>
  dato(dati, ...CODICE, 'descrizione_uno', 'Descrizioni.Descrizione1', 'descrizione1', 'prezzo', 'prezzo_offerta') !== null;

const fonteDi = (codice: string | null, dati: Dati, contesto: ContestoReferenza): FonteReferenza =>
  codice || haDati(dati) ? (contesto.storico ? 'db1' : 'istanta') : 'testo';

/** I dati anagrafici del prodotto (codice, EAN, settore…), dai data_fields DB1 o Istanta. */
function datiProdotto(dati: Dati) {
  return {
    codice: dato(dati, ...CODICE),
    ean: dato(dati, ...EAN),
    settore: comeFrase(dato(dati, 'descrizione_settore', 'settore')),
    segmento: comeFrase(dato(dati, 'descrizione_segmento', 'segmento')),
    ruolo: comeFrase(dato(dati, 'ruolo')),
    tema: dato(dati, 'descrizione_tema', 'tema'),
  };
}

/** Un elemento del gruppo del box: solo i suoi dati; meccanica e, se mancano, i prezzi sono quelli del box. */
function prodottoDelGruppo(elemento: Dati, box: ProdottoStampato, contesto: ContestoReferenza, riserva: string): ProdottoStampato {
  const anagrafica = datiProdotto(elemento);
  const nome = primaMaiuscola(maiuscoleSensate(testoStampato(dato(elemento, 'descrizione_uno', 'Descrizioni.Descrizione1', 'descrizione1')) || null));
  const marca = maiuscoleSensate(testoStampato(dato(elemento, 'descrizione_due', 'Descrizioni.Descrizione2', 'descrizione2')) || null);
  const tipo = testoStampato(dato(elemento, 'descrizione_tre', 'Descrizioni.Descrizione3', 'descrizione3')) || null;
  const formato = testoStampato(dato(elemento, 'descrizione_quattro', 'Descrizioni.Descrizione4', 'descrizione4')) || null;
  const propri = {
    prezzo: prezzoValido(datoNumerico(elemento, 'prezzo', 'prezzo_offerta')),
    barrato: prezzoValido(datoNumerico(elemento, 'prezzo_anziche', 'anziche')),
  };
  const prezzi = propri.prezzo !== null ? propri : { prezzo: box.prezzo, barrato: box.barrato };
  return {
    ...anagrafica,
    chiave: chiaveProdotto(anagrafica.codice, nome, marca, formato, riserva),
    nome: nome ?? tipo ?? marca ?? box.nome,
    marca,
    formato,
    tipo,
    prezzo: prezzi.prezzo,
    barrato: prezzi.barrato,
    sconto: scontoDaiPrezzi(prezzi.prezzo, prezzi.barrato) ?? (propri.prezzo === null ? box.sconto : null),
    prezzoAlKg: prezzoAlKgDaiDati(elemento),
    punti: box.punti,
    meccanica: box.meccanica,
    sottocosto: box.sottocosto,
    reparto: repartoDi(elemento, []) ?? box.reparto,
    fonte: fonteDi(anagrafica.codice, elemento, contesto),
    foto: [],
  };
}

/** Il prodotto pilota della riga: testo stampato prima, data_fields dopo. */
function prodottoPilota(riga: RigaReferenza, campi: readonly CampoStampato[], dati: Dati, contesto: ContestoReferenza): ProdottoStampato {
  const descrizione = campoDescrizione(campi);
  const stampata = descrizione ? descrizioneStampata(descrizione.contenuto) : { nome: null, marca: null, tipo: null, formato: null };
  const anagrafica = datiProdotto(dati);
  const nome = primaMaiuscola(maiuscoleSensate(stampata.nome ?? (testoStampato(dato(dati, 'descrizione_uno', 'Descrizioni.Descrizione1', 'descrizione1')) || null)));
  const marca = maiuscoleSensate(stampata.marca ?? (testoStampato(dato(dati, 'descrizione_due', 'Descrizioni.Descrizione2', 'descrizione2')) || null));
  const tipo = stampata.tipo ?? (testoStampato(dato(dati, 'descrizione_tre', 'Descrizioni.Descrizione3', 'descrizione3')) || null);
  const formato = stampata.formato ?? (testoStampato(dato(dati, 'descrizione_quattro', 'Descrizioni.Descrizione4', 'descrizione4')) || null);

  // Prezzi: quelli stampati; i data_fields solo se il box non ne stampa nessuno
  const prezzoStampato = stampato(campi, 'prezzo_offerta', 'prezzo', 'prezzo_offerta_EURprima', 'prezzo_offerta_etto', 'X_prezzo_offerta', 'X_prezzo');
  const barratoStampato = campi.find(campo => /^(x_)?campo_offerta$/i.test(campo.etichetta)
    && (/barrato/i.test(campo.paragrafo) || /^\s*€?\s*\d+(?:[.,]\d+)?\s*€?\s*$/.test(testoStampato(campo.contenuto))));
  const conPrezziStampati = prezzoStampato !== null || barratoStampato !== undefined;
  const prezzo = prezzoValido(conPrezziStampati ? numeroStampato(prezzoStampato?.contenuto) : datoNumerico(dati, 'prezzo', 'prezzo_offerta'));
  const barrato = prezzoValido(conPrezziStampati
    ? numeroStampato(barratoStampato ? testoStampato(barratoStampato.contenuto) : null)
    : datoNumerico(dati, 'prezzo_anziche', 'anziche'));
  const scontoStampato = scontoValido(numeroStampato(testoStampato(
    stampato(campi, 'sconto_effettivo_grande', 'sconto_norm', 'sconto_fid', 'X_sconto_effettivo_grande')?.contenuto,
  ) || null));
  const sconto = scontoStampato
    ?? scontoDaiPrezzi(prezzo, barrato)
    ?? (conPrezziStampati ? null : scontoValido(datoNumerico(dati, 'sconto_effettivo', 'sconto_norm', 'sconto_fid')));

  const alKgStampato = campi.find(campo => /campo_offerta_kgl|^x_campo_offerta$/i.test(campo.etichetta)
    && /\bal\b|\ba conf/i.test(testoStampato(campo.contenuto)));
  const meccanicaColonna = (riga.meccanica ?? '').trim();
  const segnali = segnaliDi(campi, dati, meccanicaColonna, { prezzo, barrato, sconto });

  return {
    ...anagrafica,
    chiave: chiaveProdotto(anagrafica.codice, nome, marca, formato, riga.id),
    nome: nome ?? tipo ?? marca ?? DESCRIZIONE_ASSENTE,
    marca,
    formato,
    tipo,
    prezzo,
    barrato,
    sconto,
    prezzoAlKg: alKgStampato ? testoStampato(alKgStampato.contenuto) : prezzoAlKgDaiDati(dati),
    punti: puntiStampati(campi, dati),
    meccanica: meccanicaDaiSegnali(segnali),
    sottocosto: segnali.sottocosto,
    reparto: repartoDi(dati, campi),
    fonte: fonteDi(anagrafica.codice, dati, contesto),
    foto: fotoDi(riga.foto),
  };
}

// ─── Geometria ──────────────────────────────────────────────────────

function numero(valore: unknown): number | null {
  if (valore === null || valore === undefined || valore === '') return null;
  const convertito = typeof valore === 'number' ? valore : Number(valore);
  return Number.isFinite(convertito) ? convertito : null;
}

const limita = (valore: number): number => Math.min(1, Math.max(0, valore));

/** Il numero della pagina (da 1), se c'è. */
export function paginaDi(riga: Pick<RigaReferenza, 'pag'>): number | null {
  const pagina = numero(riga.pag);
  return pagina !== null && Number.isInteger(pagina) && pagina >= 1 ? pagina : null;
}

/**
 * Il box nella sua pagina, da 0 a 1 e tagliato ai bordi. Una x da w_page in su è relativa alla
 * doppia pagina (Istanta, pagine destre): si riporta alla pagina. Null senza geometria completa.
 */
export function geometriaDi(riga: RigaReferenza): GeometriaReferenza | null {
  const pagina = paginaDi(riga);
  const [x, y, w, h, larghezza, altezza] = [riga.x, riga.y, riga.w, riga.h, riga.w_page, riga.h_page].map(numero);
  if (pagina === null || x === null || y === null || w === null || h === null || larghezza === null || altezza === null) return null;
  if (w <= 0 || h <= 0 || larghezza <= 0 || altezza <= 0) return null;
  const xPagina = x >= larghezza ? x - larghezza : x;
  const x0 = limita(xPagina / larghezza);
  const x1 = limita((xPagina + w) / larghezza);
  const y0 = limita(y / altezza);
  const y1 = limita((y + h) / altezza);
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    pagina,
    x: arrotonda(x0, 4),
    y: arrotonda(y0, 4),
    w: arrotonda(x1 - x0, 4),
    h: arrotonda(y1 - y0, 4),
    spazio: arrotonda((x1 - x0) * (y1 - y0) * 100),
    proporzione: arrotonda(larghezza / altezza, 4),
  };
}

/**
 * L'ingombro della referenza in percentuale della pagina (0–100), come lo intende chi riassume le
 * pagine: dalla geometria se c'è; altrimenti da perc_ingombro, che Istanta manda come frazione
 * (fino a 1) e lo storico già in percentuale.
 */
export function percentualeIngombro(riga: Pick<RigaReferenza, 'w' | 'h' | 'w_page' | 'h_page' | 'perc_ingombro'>): number {
  const [w, h, larghezza, altezza] = [riga.w, riga.h, riga.w_page, riga.h_page].map(numero);
  if (w !== null && h !== null && larghezza !== null && altezza !== null && w > 0 && h > 0 && larghezza > 0 && altezza > 0) {
    return (w * h) / (larghezza * altezza) * 100;
  }
  const perc = numero(riga.perc_ingombro);
  if (perc === null || perc <= 0) return 0;
  return perc <= 1 ? perc * 100 : perc;
}

// ─── Lettura completa ───────────────────────────────────────────────

/** La riga di referenze letta per l'analisi: prodotto pilota, prodotti del gruppo, geometria. */
export function leggiReferenza(riga: RigaReferenza, contesto: ContestoReferenza): ReferenzaStampata {
  const campi = campiStampati(riga.compiled_fields);
  const dati = datiDi(riga.data_fields);
  const pilota = prodottoPilota(riga, campi, dati, contesto);
  const prodotti: ProdottoStampato[] = [pilota];
  const gruppo = Array.isArray(riga.group_elements) ? riga.group_elements : [];
  gruppo.forEach((elemento: unknown, indice: number) => {
    const datiElemento = datiDi(elemento);
    if (Object.keys(datiElemento).length === 0) return;
    const prodotto = prodottoDelGruppo(datiElemento, pilota, contesto, `${riga.id}#${indice}`);
    // Il gruppo di Istanta comprende anche la pilota
    if (!prodotti.some(presente => presente.chiave === prodotto.chiave)) prodotti.push(prodotto);
  });
  return {
    ...pilota,
    id: riga.id,
    codiceBox: String(riga.codice_box ?? '').trim(),
    pagina: paginaDi(riga),
    geometria: geometriaDi(riga),
    prodotti,
  };
}
