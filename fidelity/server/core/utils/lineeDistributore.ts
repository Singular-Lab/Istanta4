import type { BoxInsight, BolloInsight, LineaBox, LineaInsight, LineeDistributore } from '../../../lib/insightVolantino/tipi';
import type { LineeDistributoreAgenzia, TestiPerLinea } from '../agenzia_lib/types';
import { urlOlimpo } from './urlOlimpo';

/**
 * Linee di marca del distributore e bolli negli insight del volantino (spec insight-volantino,
 * "Linee del distributore con loghi e bolli"), con le linee e i bolli dichiarati dalla libreria
 * agenzia del cliente:
 * - la linea di un box e' quella della sua referenza pilota: il primo logo attivo assegnato da
 *   Istanta (referenze.foto_extra) che e' una linea dichiarata; altrimenti quella ricavata dai testi
 *   stampati con la regola della libreria (volantini dello storico, che i loghi non li hanno);
 * - i bolli del box sono i loghi attivi della pilota che sono bolli dichiarati;
 * - le sigle si confrontano senza maiuscole (il catalogo di Istanta ha conad_11P, le regole conad_11p).
 *
 * Funzioni pure: il catalogo dei loghi arriva gia' letto, come funzione dalla sigla all'URL.
 */

/** Larghezza in pixel dei loghi delle linee e dei bolli, se non indicata. */
export const LARGHEZZA_LOGO_PREDEFINITA = 96;

/** URL dell'immagine di un file Olimpo, dal proxy di Fidelity, alla larghezza data (altezza in proporzione). */
export const urlImmagineLogo = (guidId: string, larghezza = LARGHEZZA_LOGO_PREDEFINITA): string =>
  urlOlimpo('/foto/getThumbNailOnDemand', { guidId, width: larghezza, height: 0 });

interface LineaDichiarata {
  sigla: string;
  nome: string;
  colore: string | null;
  ordine: number;
}

interface BolloDichiarato {
  sigla: string;
  nome: string;
  ordine: number;
}

/** Le linee e i bolli della libreria agenzia, per sigla in minuscolo. */
export interface RegoleLinee {
  linee: ReadonlyMap<string, LineaDichiarata>;
  bolli: ReadonlyMap<string, BolloDichiarato>;
  lineaDaTesti: ((testi: TestiPerLinea) => string | null) | null;
}

const chiaveSigla = (sigla: string): string => sigla.trim().toLowerCase();

/** Le regole delle linee dalla libreria agenzia; null se non ne dichiara (la sezione non compare). */
export function regoleLinee(agenzia: LineeDistributoreAgenzia | null | undefined): RegoleLinee | null {
  if (!agenzia || !Array.isArray(agenzia.linee)) return null;
  const linee = new Map<string, LineaDichiarata>();
  agenzia.linee.forEach((linea, ordine) => {
    const chiave = chiaveSigla(linea.sigla);
    if (chiave !== '' && !linee.has(chiave)) linee.set(chiave, { sigla: linea.sigla, nome: linea.nome, colore: linea.colore ?? null, ordine });
  });
  const bolli = new Map<string, BolloDichiarato>();
  (agenzia.bolli ?? []).forEach((bollo, ordine) => {
    const chiave = chiaveSigla(bollo.sigla);
    if (chiave !== '' && !bolli.has(chiave)) bolli.set(chiave, { sigla: bollo.sigla, nome: bollo.nome, ordine });
  });
  return { linee, bolli, lineaDaTesti: typeof agenzia.lineaDaTesti === 'function' ? agenzia.lineaDaTesti : null };
}

/**
 * Le sigle dei loghi attivi assegnati da Istanta alla referenza (foto_extra: { guidId o guid_id,
 * attiva, sigla, tipo }), nell'ordine in cui sono salvati. Un logo con attiva false non conta.
 */
export function sigleAssegnate(fotoExtra: unknown): string[] {
  if (!Array.isArray(fotoExtra)) return [];
  return fotoExtra.flatMap((voce: unknown) => {
    if (voce === null || typeof voce !== 'object') return [];
    const { sigla, attiva } = voce as { sigla?: unknown; attiva?: unknown };
    if (attiva === false || typeof sigla !== 'string' || sigla.trim() === '') return [];
    return [sigla.trim()];
  });
}

/** Linea e bolli della referenza pilota di un box. */
export function lineaEBolli(
  assegnate: readonly string[],
  testi: TestiPerLinea,
  regole: RegoleLinee,
): { linea: LineaBox | null; bolli: string[] } {
  const daIstanta = assegnate.map(chiaveSigla).find(chiave => regole.linee.has(chiave));
  let linea = daIstanta ? regole.linee.get(daIstanta) : undefined;
  if (!linea && regole.lineaDaTesti) {
    try {
      const sigla = regole.lineaDaTesti(testi);
      linea = sigla ? regole.linee.get(chiaveSigla(sigla)) : undefined;
    } catch {
      // Una regola del cliente che fallisce non toglie gli insight: il box resta senza linea
      linea = undefined;
    }
  }
  const bolli = [...new Set(assegnate.map(chiaveSigla))]
    .flatMap(chiave => {
      const bollo = regole.bolli.get(chiave);
      return bollo ? [bollo] : [];
    })
    .sort((a, b) => a.ordine - b.ordine)
    .map(bollo => bollo.sigla);
  return { linea: linea ? { sigla: linea.sigla, nome: linea.nome } : null, bolli };
}

// ─── Sezione degli insight ──────────────────────────────────────────

const arrotonda = (valore: number, cifre = 1): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

const somma = (valori: readonly number[]): number => valori.reduce((totale, valore) => totale + valore, 0);

const quota = (parte: number, totale: number): number => (totale > 0 ? arrotonda((parte / totale) * 100) : 0);

const spazioDi = (box: readonly BoxInsight[]): number => somma(box.map(singolo => singolo.spazio));

const referenzeDi = (box: readonly BoxInsight[]): number => somma(box.map(singolo => singolo.idReferenze.length));

function scontoMedio(box: readonly BoxInsight[]): number | null {
  const sconti = box.flatMap(singolo => (singolo.sconto === null ? [] : [singolo.sconto]));
  return sconti.length > 0 ? arrotonda(somma(sconti) / sconti.length) : null;
}

/**
 * Le linee del distributore nel volantino: per linea box, referenze, quota dello spazio di tutti i
 * box (come marche e spazio) e sconto medio, nell'ordine dichiarato e solo quelle presenti; tutte
 * insieme, quota di spazio e di box; i bolli presenti, dal piu' frequente. urlLogo: l'immagine
 * della sigla nel catalogo di Istanta, null se non c'e'.
 */
export function lineeDelVolantino(
  box: readonly BoxInsight[],
  regole: RegoleLinee,
  urlLogo: (sigla: string) => string | null = () => null,
): LineeDistributore {
  const totaleSpazio = spazioDi(box);
  const conLinea = box.filter(singolo => !!singolo.linea);

  const linee: LineaInsight[] = [...regole.linee.values()]
    .sort((a, b) => a.ordine - b.ordine)
    .flatMap((linea) => {
      const dellaLinea = conLinea.filter(singolo => chiaveSigla(singolo.linea?.sigla ?? '') === chiaveSigla(linea.sigla));
      if (dellaLinea.length === 0) return [];
      return [{
        sigla: linea.sigla,
        nome: linea.nome,
        colore: linea.colore,
        logo: urlLogo(linea.sigla),
        box: dellaLinea.length,
        referenze: referenzeDi(dellaLinea),
        quotaSpazio: quota(spazioDi(dellaLinea), totaleSpazio),
        scontoMedio: scontoMedio(dellaLinea),
      }];
    });

  const bolli: BolloInsight[] = [...regole.bolli.values()]
    .map(bollo => ({
      bollo,
      box: box.filter(singolo => (singolo.bolli ?? []).some(sigla => chiaveSigla(sigla) === chiaveSigla(bollo.sigla))).length,
    }))
    .filter(voce => voce.box > 0)
    .sort((a, b) => b.box - a.box || a.bollo.ordine - b.bollo.ordine)
    .map(({ bollo, box: quanti }) => ({ sigla: bollo.sigla, nome: bollo.nome, logo: urlLogo(bollo.sigla), box: quanti }));

  return {
    quotaSpazio: quota(spazioDi(conLinea), totaleSpazio),
    quotaBox: quota(conLinea.length, box.length),
    box: conLinea.length,
    linee,
    bolli,
  };
}
