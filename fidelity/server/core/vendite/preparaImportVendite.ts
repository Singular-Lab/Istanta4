import * as XLSX from 'xlsx';
import { BadRequestError } from '../../../lib/errors';
import {
  MAX_SCARTATE_ANTEPRIMA,
  normalizzaCodiceProdotto,
  type AnteprimaImportVendite,
  type RigaScartata,
} from '../../../lib/vendite/tipi';
import type { IAgenziaLib, ImportVenditeAgenzia } from '../agenzia_lib/types';
import { normalizePuntoVenditaText } from '../utils/puntoVenditaNormalization';
import { mostraValore, validaRigaVendita, type RigaFileVendite } from './valori';

/**
 * Dal file delle vendite alle righe da scrivere, senza scrivere nulla: lettura del file (xlsx, xls,
 * csv) con il tracciato della libreria agenzia o quello generico, controlli di FP, riconoscimento del
 * punto vendita della GDO, righe ripetute. Serve all'anteprima e all'import.
 */

/** Un punto vendita della GDO, con i meta in cui cercare la chiave del cliente. */
export interface PuntoVenditaGdo {
  id: string;
  nome: string;
  meta: Record<string, unknown> | null;
}

/** Campi dei meta del PV con cui riconoscere il punto vendita del file; senza, vale il nome. */
export interface ChiaviPuntoVendita {
  chiave?: string;
  riserva?: string;
}

/** Una vendita pronta da scrivere: punto vendita riconosciuto, codice normalizzato. */
export interface VenditaDaScrivere {
  /** Numero di riga come in Excel (l'intestazione e' la riga 1). */
  riga: number;
  codiceProdotto: string;
  idPuntoVendita: string;
  dal: string;
  al: string;
  pezzi: number;
  valore: number | null;
}

export interface ImportVenditePreparato {
  /** Righe del file, scartate comprese. */
  totale: number;
  /** Una per prodotto, punto vendita e periodo, nell'ordine del file. */
  vendite: VenditaDaScrivere[];
  /** In ordine di riga, con il motivo. */
  scartate: RigaScartata[];
}

// ── Lettura del file ──────────────────────────────────────────────────────────

const ZIP = [0x50, 0x4b]; // xlsx
const CFB = [0xd0, 0xcf, 0x11, 0xe0]; // xls
const inizia = (file: Buffer, firma: number[]) => firma.every((byte, i) => file[i] === byte);

/** Testo di un CSV: UTF-8 (senza BOM) o, se non lo e', Windows-1252 come lo salva Excel in italiano. */
function testoCsv(file: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(file);
  } catch {
    return new TextDecoder('windows-1252').decode(file);
  }
}

/**
 * Righe di ogni foglio (nome del foglio -> righe con l'intestazione in riga 1), con i valori grezzi:
 * numeri come numeri, date di Excel come numero seriale, testo come testo. Un CSV (anche con ; come
 * separatore) arriva tutto come testo: niente interpretazioni di date e numeri in formato americano.
 * Le righe vuote non ci sono; ogni riga ha __rowNum__ (non enumerabile), la sua posizione da 0.
 */
export function leggiFileVendite(file: Buffer): Record<string, RigaFileVendite[]> {
  let cartella: XLSX.WorkBook;
  try {
    cartella = inizia(file, ZIP) || inizia(file, CFB)
      ? XLSX.read(file, { type: 'buffer' })
      : XLSX.read(testoCsv(file), { type: 'string', raw: true });
  } catch {
    throw new BadRequestError({ message: 'File non leggibile: usa un file .xlsx, .xls o .csv' });
  }
  return Object.fromEntries(
    cartella.SheetNames.map(nome => [nome, XLSX.utils.sheet_to_json<RigaFileVendite>(cartella.Sheets[nome], { defval: '', raw: true })])
  );
}

/** Righe da importare: quelle che il tracciato ricava da tutti i fogli, o quelle del primo foglio. */
export function righeFileVendite(file: Buffer, tracciato: ImportVenditeAgenzia): RigaFileVendite[] {
  const fogli = leggiFileVendite(file);
  return tracciato.leggiFile ? tracciato.leggiFile(fogli) : Object.values(fogli)[0] ?? [];
}

// ── Riconoscimento del punto vendita ──────────────────────────────────────────

/**
 * Campi dei meta del PV con cui riconoscere il punto vendita del file: quello del tracciato delle
 * vendite; senza, la chiave del cliente dell'import dei punti vendita (e la sua di riserva).
 */
export function chiaviPuntoVendita(agenziaLib: Pick<IAgenziaLib, 'importVendite' | 'importPuntiVendita'>): ChiaviPuntoVendita {
  const perVendite = agenziaLib.importVendite?.chiaveMetaPuntoVendita;
  if (perVendite) return { chiave: perVendite };
  const { chiaveMeta, chiaveMetaRiserva } = agenziaLib.importPuntiVendita ?? {};
  return { chiave: chiaveMeta || undefined, riserva: chiaveMetaRiserva || undefined };
}

/** Le chiavi del cliente si confrontano come i codici prodotto: "000123" e "123" sono lo stesso PV. */
const normalizzaChiave = (valore: unknown): string => normalizzaCodiceProdotto(valore);

type Indice = Map<string, string[]>;

function indicizza(puntiVendita: PuntoVenditaGdo[], valoreDi: (pv: PuntoVenditaGdo) => string): Indice {
  const indice: Indice = new Map();
  for (const pv of puntiVendita) {
    const valore = valoreDi(pv);
    if (!valore) continue;
    const ids = indice.get(valore);
    if (ids) ids.push(pv.id);
    else indice.set(valore, [pv.id]);
  }
  return indice;
}

export type PuntoVenditaRiconosciuto = { idPuntoVendita: string } | { motivo: string };

/**
 * Riconosce il punto vendita scritto nel file fra quelli della GDO. Con le chiavi del cliente
 * dichiarate: il PV con quel valore nella chiave, poi nella chiave di riserva. Senza: il PV con quel
 * nome (senza maiuscole, accenti e punteggiatura). Due PV con lo stesso valore: ambiguo, si scarta.
 */
export function riconoscitorePuntoVendita(
  puntiVendita: PuntoVenditaGdo[],
  chiavi: ChiaviPuntoVendita,
): (valore: string) => PuntoVenditaRiconosciuto {
  const meta = (campo: string) => (pv: PuntoVenditaGdo) => normalizzaChiave(pv.meta?.[campo]);
  const indici: Array<{ indice: Indice; normalizza: (valore: string) => string; descrizione: string }> = [];
  if (chiavi.chiave) indici.push({ indice: indicizza(puntiVendita, meta(chiavi.chiave)), normalizza: normalizzaChiave, descrizione: chiavi.chiave });
  if (chiavi.riserva) indici.push({ indice: indicizza(puntiVendita, meta(chiavi.riserva)), normalizza: normalizzaChiave, descrizione: chiavi.riserva });
  if (indici.length === 0) {
    indici.push({ indice: indicizza(puntiVendita, pv => normalizePuntoVenditaText(pv.nome)), normalizza: normalizePuntoVenditaText, descrizione: 'nome' });
  }
  const giaVisti = new Map<string, PuntoVenditaRiconosciuto>();

  return valore => {
    const noto = giaVisti.get(valore);
    if (noto) return noto;
    let esito: PuntoVenditaRiconosciuto = { motivo: `Punto vendita non trovato: ${mostraValore(valore)}` };
    for (const { indice, normalizza, descrizione } of indici) {
      const ids = indice.get(normalizza(valore)) ?? [];
      if (ids.length === 1) {
        esito = { idPuntoVendita: ids[0] };
        break;
      }
      if (ids.length > 1) {
        esito = { motivo: `Punto vendita ambiguo: ${ids.length} punti vendita della GDO hanno ${descrizione} ${mostraValore(valore)}` };
        break;
      }
    }
    giaVisti.set(valore, esito);
    return esito;
  };
}

// ── Preparazione ──────────────────────────────────────────────────────────────

const chiaveVendita = (v: Pick<VenditaDaScrivere, 'codiceProdotto' | 'idPuntoVendita' | 'dal' | 'al'>) =>
  `${v.codiceProdotto}\u0000${v.idPuntoVendita}\u0000${v.dal}\u0000${v.al}`;

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Esito di ogni riga, senza scrivere: la vendita pronta o il motivo dello scarto. Una riga che ripete
 * prodotto, punto vendita e periodo di una successiva viene sostituita da quella: vale l'ultima, come
 * reimportando il file (il dato si sostituisce, non si somma).
 */
export function preparaImportVendite(
  righe: RigaFileVendite[],
  tracciato: ImportVenditeAgenzia,
  riconosci: (valore: string) => PuntoVenditaRiconosciuto,
): ImportVenditePreparato {
  const scartate: RigaScartata[] = [];
  const perChiave = new Map<string, VenditaDaScrivere>();

  righe.forEach((rigaFile, i) => {
    const riga = typeof rigaFile.__rowNum__ === 'number' ? rigaFile.__rowNum__ + 1 : i + 2;
    let letta: ReturnType<ImportVenditeAgenzia['leggiRiga']>;
    try {
      letta = tracciato.leggiRiga(rigaFile);
    } catch (e) {
      // Un errore della libreria agenzia su una riga non ferma le altre
      scartate.push({ riga, motivo: `Riga non leggibile: ${messaggio(e)}` });
      return;
    }
    const vendita = typeof letta === 'string' ? letta : validaRigaVendita(letta);
    if (typeof vendita === 'string') {
      scartate.push({ riga, motivo: vendita });
      return;
    }
    const puntoVendita = riconosci(vendita.puntoVendita);
    if ('motivo' in puntoVendita) {
      scartate.push({ riga, motivo: puntoVendita.motivo });
      return;
    }
    const daScrivere: VenditaDaScrivere = {
      riga,
      codiceProdotto: vendita.codiceProdotto,
      idPuntoVendita: puntoVendita.idPuntoVendita,
      dal: vendita.dal,
      al: vendita.al,
      pezzi: vendita.pezzi,
      valore: vendita.valore,
    };
    const chiave = chiaveVendita(daScrivere);
    const precedente = perChiave.get(chiave);
    if (precedente) {
      scartate.push({
        riga: precedente.riga,
        motivo: `Sostituita dalla riga ${riga}: stesso prodotto, punto vendita e periodo (vale l'ultima)`,
      });
      // Rimessa in fondo: le vendite restano nell'ordine in cui vengono lette per l'ultima volta
      perChiave.delete(chiave);
    }
    perChiave.set(chiave, daScrivere);
  });

  scartate.sort((a, b) => a.riga - b.riga);
  return { totale: righe.length, vendite: [...perChiave.values()], scartate };
}

/** Cosa farebbe l'import del file, per l'anteprima: conteggi, periodo coperto, prime righe scartate. */
export function anteprimaImportVendite(preparato: ImportVenditePreparato, tracciato: ImportVenditeAgenzia): AnteprimaImportVendite {
  const { vendite, scartate, totale } = preparato;
  let dal: string | null = null;
  let al: string | null = null;
  for (const vendita of vendite) {
    if (dal === null || vendita.dal < dal) dal = vendita.dal;
    if (al === null || vendita.al > al) al = vendita.al;
  }
  return {
    tracciato: { nome: tracciato.nome, colonne: [...tracciato.colonne] },
    righe: totale,
    importabili: vendite.length,
    scartate: scartate.length,
    dettaglioScartate: scartate.slice(0, MAX_SCARTATE_ANTEPRIMA),
    periodo: dal !== null && al !== null ? { dal, al } : null,
    prodotti: new Set(vendite.map(v => v.codiceProdotto)).size,
    puntiVendita: new Set(vendite.map(v => v.idPuntoVendita)).size,
  };
}
