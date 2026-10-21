import * as XLSX from 'xlsx';
import type { ImportPuntiVenditaAgenzia } from '../agenzia_lib/types';
import type { CreatePuntoVenditaDTO, EsitoRigaImportPuntoVenditaDTO } from '../dto';
import { normalizePuntoVenditaText } from '../utils/puntoVenditaNormalization';

/** Una riga del foglio: intestazione della colonna → valore. */
export type RigaFile = Record<string, unknown>;

interface Voce { id: string; codice: string; nome: string }

/** Cio che la GDO ha gia in FP, contro cui si validano le righe. */
export interface ContestoImportPuntiVendita {
  canali: Voce[];
  aree: Voce[];
  combinazioni: Array<{ id: string; idCanale: string; idArea: string; sigla: string }>;
  esistenti: Array<{ id: string; nome: string; indirizzo: string; cap: string; meta?: Record<string, unknown> }>;
}

/** Righe del primo foglio, con l'intestazione sulla prima riga. */
export function leggiFoglio(file: Buffer): RigaFile[] {
  const cartella = XLSX.read(file, { type: 'buffer' });
  const foglio = cartella.Sheets[cartella.SheetNames[0]];
  // ponytail: primo foglio e intestazione in riga 1; se il file reale di una GDO ha titoli o piu fogli, si estende l'hook
  return foglio ? XLSX.utils.sheet_to_json<RigaFile>(foglio, { defval: '', raw: false }) : [];
}

/** Valore della colonna con una delle intestazioni, confrontate senza maiuscole, accenti, punteggiatura e spazi. */
export function cella(riga: RigaFile, ...intestazioni: string[]): string {
  const cercate = intestazioni.map(normalizePuntoVenditaText);
  const colonna = Object.keys(riga).find(k => cercate.includes(normalizePuntoVenditaText(k)));
  return colonna === undefined ? '' : String(riga[colonna] ?? '').trim();
}

/** Numero anche con la virgola decimale; vuoto o non numerico e undefined. */
export function numero(valore: string): number | undefined {
  const n = Number(valore.replace(',', '.'));
  return valore.trim() && Number.isFinite(n) ? n : undefined;
}

/** Il tracciato che la pagina Punti Vendita ha sempre chiesto, per le GDO senza un tracciato proprio. */
export const importPuntiVenditaGenerico: ImportPuntiVenditaAgenzia = {
  leggiRiga: riga => ({
    nome: cella(riga, 'nome'),
    indirizzo: cella(riga, 'indirizzo'),
    citta: cella(riga, 'citta'),
    cap: cella(riga, 'cap'),
    canaleArea: cella(riga, 'canaleArea'),
    ragioneSociale: cella(riga, 'ragioneSociale', 'ragione sociale') || undefined,
    provincia: cella(riga, 'provincia') || undefined,
    regione: cella(riga, 'regione') || undefined,
    telefono: cella(riga, 'telefono') || undefined,
    lat: numero(cella(riga, 'lat')),
    lon: numero(cella(riga, 'lon')),
  }),
};

// Stessa regola del modello punti_vendita
const TELEFONO = /^[\+]?[0-9\s\-\(\)]{8,20}$/;

/**
 * Decide di ogni riga se crea un PV, ne aggiorna uno o va scartata, senza scrivere niente.
 * Le regole del modello punti_vendita si controllano qui: una riga che FP rifiuterebbe
 * non deve arrivare a Istanta, dove resterebbe orfana.
 */
export function preparaImportPuntiVendita(
  righe: RigaFile[],
  importer: ImportPuntiVenditaAgenzia,
  contesto: ContestoImportPuntiVendita,
  idGdo: string,
): EsitoRigaImportPuntoVenditaDTO[] {
  const n = normalizePuntoVenditaText;
  const { chiaveMeta } = importer;
  const chiaveDi = (meta?: Record<string, unknown>) => (chiaveMeta ? String(meta?.[chiaveMeta] ?? '').trim() : '');
  const doppione = (pv: { nome: string; indirizzo: string; cap: string }) => [n(pv.nome), n(pv.indirizzo), n(pv.cap)].join('|');
  const trova = (voci: Voce[], valore = '') => (n(valore) ? voci.find(v => n(v.codice) === n(valore) || n(v.nome) === n(valore)) : undefined);

  const perChiave = new Map(contesto.esistenti.filter(pv => chiaveDi(pv.meta)).map(pv => [chiaveDi(pv.meta), pv]));
  // Un PV senza chiave del cliente (la libreria non ne ha, o e stato creato prima) si riconosce da nome, indirizzo e CAP
  const perDoppione = new Map(contesto.esistenti.filter(pv => !chiaveDi(pv.meta)).map(pv => [doppione(pv), pv]));
  const visti = new Set<string>();

  return righe.map((riga, i): EsitoRigaImportPuntoVenditaDTO => {
    const numeroRiga = typeof riga.__rowNum__ === 'number' ? riga.__rowNum__ + 1 : i + 2;
    const letto = importer.leggiRiga(riga);
    if (typeof letto === 'string') return { riga: numeroRiga, azione: 'scarta', errore: letto };
    const scarta = (errore: string): EsitoRigaImportPuntoVenditaDTO => ({ riga: numeroRiga, azione: 'scarta', errore, letto });

    const nome = letto.nome.trim();
    const indirizzo = letto.indirizzo.trim();
    const citta = letto.citta.trim();
    // Excel toglie gli zeri iniziali ai CAP scritti come numero (00100 → 100)
    const cap = /^\d{1,4}$/.test(letto.cap.trim()) ? letto.cap.trim().padStart(5, '0') : letto.cap.trim();
    const provincia = letto.provincia?.trim() || undefined;
    const telefono = letto.telefono?.replace(/[/.]/g, ' ').trim() || undefined;

    const mancanti = Object.entries({ nome, indirizzo, citta, cap }).filter(([, v]) => !v).map(([campo]) => campo);
    if (mancanti.length) return scarta(`Campi mancanti: ${mancanti.join(', ')}`);
    if (nome.length < 2) return scarta(`Nome troppo corto: ${nome}`);
    if (citta.length < 2) return scarta(`Città non valida: ${citta}`);
    if (indirizzo.length < 5) return scarta(`Indirizzo troppo corto: ${indirizzo}`);
    if (!/^\d{5}$/.test(cap)) return scarta(`CAP non valido: ${letto.cap}`);
    if (provincia && (provincia.length < 2 || provincia.length > 10)) return scarta(`Provincia non valida: ${provincia}`);
    if (telefono && !TELEFONO.test(telefono)) return scarta(`Telefono non valido: ${letto.telefono}`);
    if (Math.abs(letto.lat ?? 0) > 90 || Math.abs(letto.lon ?? 0) > 180) return scarta('Coordinate non valide');

    let idCombinazione: string | undefined;
    const sigla = letto.canaleArea;
    if (sigla) {
      idCombinazione = contesto.combinazioni.find(c => c.id === sigla || n(c.sigla) === n(sigla))?.id;
      if (!idCombinazione) return scarta(`Canale/area non valido: ${sigla}`);
    } else {
      const canale = trova(contesto.canali, letto.canale);
      if (!canale) return scarta(`Canale non riconosciuto: ${letto.canale ?? ''}`);
      const area = trova(contesto.aree, letto.area);
      if (!area) return scarta(`Area non riconosciuta: ${letto.area ?? ''}`);
      idCombinazione = contesto.combinazioni.find(c => c.idCanale === canale.id && c.idArea === area.id)?.id;
      if (!idCombinazione) return scarta(`Nessuna combinazione per il canale ${canale.nome} e l'area ${area.nome}`);
    }

    const chiave = chiaveDi(letto.meta);
    if (chiaveMeta && !chiave) return scarta(`${chiaveMeta} mancante`);
    const identita = chiave || doppione({ nome, indirizzo, cap });
    if (visti.has(identita)) return scarta(chiave ? `${chiaveMeta} ${chiave} ripetuto nel file` : 'Punto vendita ripetuto nel file');
    visti.add(identita);

    const perNome = perDoppione.get(doppione({ nome, indirizzo, cap }));
    if (!chiaveMeta && perNome) return scarta('Punto vendita già presente');
    const esistente = perChiave.get(chiave) ?? perNome;
    // Un PV senza chiave preso da una riga non puo essere preso anche da un'altra
    if (perNome && esistente === perNome) perDoppione.delete(doppione(perNome));

    const dati: CreatePuntoVenditaDTO = {
      nome,
      indirizzo,
      citta,
      cap,
      id_combinazione_canale_area: idCombinazione,
      id_gdo: idGdo,
      ragionesociale: letto.ragioneSociale?.trim() || undefined,
      provincia,
      regione: letto.regione?.trim() || undefined,
      telefono,
      lat: letto.lat,
      lon: letto.lon,
      meta: letto.meta && { ...esistente?.meta, ...letto.meta },
    };
    return esistente
      ? { riga: numeroRiga, azione: 'aggiorna', id: esistente.id, letto, dati }
      : { riga: numeroRiga, azione: 'crea', letto, dati };
  });
}
