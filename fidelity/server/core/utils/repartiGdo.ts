import type { RepartiDaSalvare, RepartoGdo } from '../../../lib/impostazioniGdo/tipi';
import type { RepartoInsight } from '../../../lib/insightVolantino/tipi';
import { type RepartoAnagrafica, stessoCodice, testoNormalizzato } from './campiInsights';
import { comeFrase } from './referenzaStampata';

/**
 * I reparti della GDO come li vede il marketing (Impostazioni GDO, spec impostazioni-gdo): nome per
 * il marketing e colore salvati per codice, applicati a ogni lettura dei reparti (insight del
 * volantino, dettaglio della promozione, report PDF, pagine dei punti vendita).
 *
 * - Un reparto si riconosce dal codice come negli insight ("1" e "01" sono lo stesso, anche
 *   "Reparto 01" della lettura generica), poi dal nome nei dati o dalla descrizione dell'anagrafica.
 * - Con un nome per il marketing il reparto prende quel nome; piu' codici con lo stesso nome (senza
 *   maiuscole e spazi doppi) sono UN reparto: codice il piu' basso del gruppo, nome come e' scritto
 *   per quel codice, colore il primo impostato nel gruppo (dal codice piu' basso).
 * - Senza nome per il marketing resta il reparto di sempre, con il colore salvato se c'e'.
 *
 * Funzioni pure: niente database, niente configurazione.
 */

export type RepartoSalvato = RepartiDaSalvare['reparti'][number];

/** Un reparto trovato nelle referenze dei volantini della GDO, come lo scrivono i dati. */
export interface RepartoNelleReferenze {
  codice: string | null;
  descrizione: string | null;
  referenze: number;
}

const NUMERO_REPARTO = /^Reparto (\d+)$/i;

const NUMERICO = /^\d+$/;

/** Ordine dei codici: numerici come numeri ("3" prima di "21"), poi come testo. */
export function confrontaCodici(a: string, b: string): number {
  const primo = a.trim();
  const secondo = b.trim();
  if (NUMERICO.test(primo) && NUMERICO.test(secondo)) return Number(primo) - Number(secondo) || primo.localeCompare(secondo);
  if (NUMERICO.test(primo) !== NUMERICO.test(secondo)) return NUMERICO.test(primo) ? -1 : 1;
  return primo.localeCompare(secondo, 'it');
}

/** Chiave del nome per il marketing: stesso nome senza distinguere maiuscole e spazi. */
const chiaveNome = (nome: string): string => testoNormalizzato(nome);

const pulito = (testo: string | null | undefined): string => (typeof testo === 'string' ? testo.trim() : '');

export interface RisolutoreReparti {
  /** Nessun reparto salvato per la GDO: risolvi e nome restituiscono quello che ricevono. */
  readonly vuoto: boolean;
  /** Il reparto con nome per il marketing e colore della GDO. */
  risolvi(reparto: RepartoInsight): RepartoInsight;
  /**
   * Il nome da mostrare per un reparto letto come testo (descrizione, sigla o "Reparto NN", come
   * lo scrive la lettura generica nei riepiloghi dei kit): il nome per il marketing, o il testo
   * scritto come frase quando e' tutto maiuscolo ("DROGHERIA ALIMENTARE" -> "Drogheria alimentare").
   */
  nome(letto: string): string;
}

/**
 * Il nome di un reparto senza nome per il marketing: la descrizione dell'anagrafica, che arriva in
 * maiuscolo, scritta come frase ("DROGHERIA ALIMENTARE" -> "Drogheria alimentare", spec
 * insight-volantino, "Reparti e meccaniche leggibili per ogni fonte del volantino"). Un codice o una
 * sigla senza una parola vera ("99", "PC") restano come sono.
 */
export const nomeRepartoLeggibile = (testo: string): string => (/\p{L}{4,}/u.test(testo) ? comeFrase(testo) ?? testo : testo);

export const RISOLUTORE_NEUTRO: RisolutoreReparti = {
  vuoto: true,
  risolvi: reparto => reparto,
  nome: nomeRepartoLeggibile,
};

/** Il risolutore dei reparti di una GDO: le voci salvate e l'anagrafica della sua configurazione degli insight. */
export function risolutoreReparti(salvati: readonly RepartoSalvato[], anagrafica: readonly RepartoAnagrafica[] = []): RisolutoreReparti {
  const voci = salvati.filter(voce => pulito(voce.codice) !== '');
  if (voci.length === 0) return RISOLUTORE_NEUTRO;

  // I gruppi con lo stesso nome per il marketing, dal codice piu' basso
  const gruppi = new Map<string, RepartoSalvato[]>();
  for (const voce of voci) {
    const marketing = pulito(voce.nomeMarketing);
    if (!marketing) continue;
    gruppi.set(chiaveNome(marketing), [...(gruppi.get(chiaveNome(marketing)) ?? []), voce]);
  }
  for (const gruppo of gruppi.values()) gruppo.sort((a, b) => confrontaCodici(a.codice, b.codice));

  const perCodice = (codice: string): RepartoSalvato | undefined => voci.find(voce => stessoCodice(voce.codice, codice));

  /** La voce salvata: dal codice (anche "Reparto NN"), poi dal nome nei dati, poi dall'anagrafica. */
  const trova = (codice: string, descrizione: string): RepartoSalvato | undefined => {
    const codiceLetto = codice.trim();
    if (codiceLetto !== '') {
      const numero = NUMERO_REPARTO.exec(codiceLetto)?.[1];
      const trovata = perCodice(codiceLetto) ?? (numero ? perCodice(numero) : undefined);
      if (trovata) return trovata;
    }
    const descrizioneLetta = descrizione.trim();
    if (descrizioneLetta === '') return undefined;
    const normalizzata = testoNormalizzato(descrizioneLetta);
    const perNome = voci.find(voce => testoNormalizzato(pulito(voce.nomeDati)) === normalizzata);
    if (perNome) return perNome;
    const inAnagrafica = anagrafica.find(reparto => testoNormalizzato(reparto.descrizione) === normalizzata);
    return inAnagrafica ? perCodice(inAnagrafica.codice) : undefined;
  };

  /** Il primo del gruppo (codice piu' basso), con il colore del primo che ne ha uno. */
  const delGruppo = (voce: RepartoSalvato): RepartoInsight | null => {
    const marketing = pulito(voce.nomeMarketing);
    if (!marketing) return null;
    const gruppo = gruppi.get(chiaveNome(marketing)) ?? [voce];
    const primo = gruppo[0];
    return {
      codice: primo.codice.trim(),
      descrizione: pulito(primo.nomeMarketing) || marketing,
      colore: gruppo.find(membro => !!membro.colore)?.colore ?? null,
      marketing: true,
    };
  };

  return {
    vuoto: false,
    risolvi(reparto) {
      const voce = trova(reparto.codice, reparto.descrizione);
      if (!voce) return reparto;
      const gruppo = delGruppo(voce);
      if (gruppo) return gruppo;
      return voce.colore ? { ...reparto, colore: voce.colore } : reparto;
    },
    nome(letto) {
      const testo = letto.trim();
      if (testo === '') return letto;
      const voce = trova(testo, testo);
      return (voce && delGruppo(voce)?.descrizione) || nomeRepartoLeggibile(letto);
    },
  };
}

// ─── Impostazioni GDO: l'elenco dei reparti ────────────────────────

interface VoceInCostruzione {
  codice: string;
  nomeDati: string;
  nomeMarketing: string | null;
  colore: string | null;
  referenze: number;
  trovato: boolean;
}

/** Il dizionario delle traduzioni (config/dictionary_translation.json) con le chiavi normalizzate. */
export function dizionarioNormalizzato(dizionario: unknown): Map<string, string> {
  const normalizzato = new Map<string, string>();
  if (dizionario === null || typeof dizionario !== 'object' || Array.isArray(dizionario)) return normalizzato;
  for (const [chiave, valore] of Object.entries(dizionario as Record<string, unknown>)) {
    if (typeof valore === 'string' && valore.trim() !== '') normalizzato.set(testoNormalizzato(chiave), valore.trim());
  }
  return normalizzato;
}

/**
 * L'elenco dei reparti delle Impostazioni GDO: l'anagrafica della configurazione degli insight, le
 * voci salvate e i reparti trovati nelle referenze dei volantini della GDO, riconosciuti dal codice
 * come negli insight ("1" = "01") o, senza codice, dal nome. Il nome nei dati e' quello
 * dell'anagrafica, altrimenti quello salvato, altrimenti quello delle referenze. Da nominare: trovato
 * nelle referenze e senza nome per il marketing. Il suggerimento viene dal dizionario delle
 * traduzioni, sul nome nei dati. Per codice.
 */
export function repartiDellaGdo(
  anagrafica: readonly RepartoAnagrafica[],
  salvati: readonly RepartoSalvato[],
  nelleReferenze: readonly RepartoNelleReferenze[],
  dizionario: ReadonlyMap<string, string> = new Map(),
): RepartoGdo[] {
  const voci: VoceInCostruzione[] = [];
  const perCodice = (codice: string): VoceInCostruzione | undefined => voci.find(voce => stessoCodice(voce.codice, codice));
  const perNome = (nome: string): VoceInCostruzione | undefined => {
    const normalizzato = testoNormalizzato(nome);
    return voci.find(voce => voce.nomeDati !== '' && testoNormalizzato(voce.nomeDati) === normalizzato);
  };
  const nuova = (codice: string, nomeDati: string): VoceInCostruzione => {
    const voce: VoceInCostruzione = { codice, nomeDati, nomeMarketing: null, colore: null, referenze: 0, trovato: false };
    voci.push(voce);
    return voce;
  };

  for (const reparto of anagrafica) {
    if (!perCodice(reparto.codice)) nuova(reparto.codice, reparto.descrizione);
  }

  for (const salvato of salvati) {
    const codice = pulito(salvato.codice);
    if (codice === '') continue;
    const voce = perCodice(codice) ?? nuova(codice, pulito(salvato.nomeDati));
    if (voce.nomeDati === '') voce.nomeDati = pulito(salvato.nomeDati);
    voce.nomeMarketing = pulito(salvato.nomeMarketing) || null;
    voce.colore = salvato.colore ?? null;
  }

  for (const trovato of nelleReferenze) {
    const codice = pulito(trovato.codice);
    const descrizione = pulito(trovato.descrizione);
    if (codice === '' && descrizione === '') continue;
    const voce = (codice !== '' ? perCodice(codice) : undefined)
      ?? (descrizione !== '' ? perNome(descrizione) : undefined)
      ?? nuova(codice || descrizione, descrizione);
    voce.referenze += trovato.referenze;
    voce.trovato = voce.trovato || trovato.referenze > 0;
    if (voce.nomeDati === '') voce.nomeDati = descrizione;
  }

  return voci
    .map((voce): RepartoGdo => {
      const nomeDati = voce.nomeDati || voce.codice;
      return {
        codice: voce.codice,
        nomeDati,
        nomeMarketing: voce.nomeMarketing,
        colore: voce.colore,
        referenze: voce.referenze,
        daNominare: voce.trovato && voce.nomeMarketing === null,
        suggerimento: dizionario.get(testoNormalizzato(nomeDati)) ?? null,
      };
    })
    .sort((a, b) => confrontaCodici(a.codice, b.codice));
}

// ─── Validazione dei reparti da salvare ────────────────────────────

export const COLORE_ESADECIMALE = /^#[0-9a-f]{6}$/i;

export interface EsitoReparti {
  reparti: RepartoSalvato[];
  errori: string[];
}

/**
 * I reparti da salvare, controllati: codice testo non vuoto e senza doppioni ("1" e "01" sono lo
 * stesso), colore #rrggbb o null, nome per il marketing senza spazi ai lati o null se vuoto.
 */
export function verificaRepartiDaSalvare(valore: unknown): EsitoReparti {
  const errori: string[] = [];
  const reparti: RepartoSalvato[] = [];
  const elenco = valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? (valore as { reparti?: unknown }).reparti : undefined;
  if (!Array.isArray(elenco)) return { reparti, errori: ['reparti deve essere un elenco'] };

  elenco.forEach((voce: unknown, indice) => {
    const posizione = `reparti.${indice}`;
    if (voce === null || typeof voce !== 'object' || Array.isArray(voce)) {
      errori.push(`${posizione}: deve essere un oggetto`);
      return;
    }
    const { codice, nomeDati, nomeMarketing, colore } = voce as Record<string, unknown>;
    if (typeof codice !== 'string' || codice.trim() === '') {
      errori.push(`${posizione}.codice: deve essere un testo non vuoto`);
      return;
    }
    if (reparti.some(salvato => stessoCodice(salvato.codice, codice))) {
      errori.push(`${posizione}.codice: il reparto ${codice.trim()} compare piu' di una volta`);
      return;
    }
    if (colore !== null && colore !== undefined && (typeof colore !== 'string' || !COLORE_ESADECIMALE.test(colore))) {
      errori.push(`${posizione}.colore: deve essere un colore #rrggbb o null`);
      return;
    }
    if (nomeMarketing !== null && nomeMarketing !== undefined && typeof nomeMarketing !== 'string') {
      errori.push(`${posizione}.nomeMarketing: deve essere un testo o null`);
      return;
    }
    if (nomeDati !== null && nomeDati !== undefined && typeof nomeDati !== 'string') {
      errori.push(`${posizione}.nomeDati: deve essere un testo`);
      return;
    }
    reparti.push({
      codice: codice.trim(),
      nomeDati: typeof nomeDati === 'string' ? nomeDati.trim() : '',
      nomeMarketing: typeof nomeMarketing === 'string' && nomeMarketing.trim() !== '' ? nomeMarketing.trim() : null,
      colore: typeof colore === 'string' ? colore : null,
    });
  });

  return { reparti, errori };
}

// ─── Fonte dei reparti salvati ─────────────────────────────────────

/** I reparti salvati di una GDO (Impostazioni GDO): il repository, o niente nei test. */
export interface FonteRepartiGdo {
  repartiSalvati(idGdo: string): Promise<RepartoSalvato[]>;
}

export const SENZA_REPARTI_GDO: FonteRepartiGdo = { repartiSalvati: async () => [] };
