import * as XLSX from 'xlsx';
import type { ImportPuntiVenditaAgenzia } from '../agenzia_lib/types';
import type { CreatePuntoVenditaDTO, DatiPuntoVenditaImportatoDTO, EsitoRigaImportPuntoVenditaDTO } from '../dto';
import { normalizePuntoVenditaText } from '../utils/puntoVenditaNormalization';

/** Una riga del foglio: intestazione della colonna → valore. */
export type RigaFile = Record<string, unknown>;

interface Voce { id: string; codice: string; nome: string }

/** Cio che la GDO ha gia in FP, contro cui si validano le righe. */
export interface ContestoImportPuntiVendita {
  canali: Voce[];
  aree: Voce[];
  combinazioni: Array<{ id: string; idCanale: string; idArea: string; sigla: string }>;
  esistenti: Array<{ id: string; nome: string; indirizzo: string; cap: string; meta?: Record<string, unknown>; lat?: number; lon?: number }>;
}

/** Coordinate utilizzabili: 0,0 e il valore che Istanta scrive quando mancano, non un punto in Italia. */
export const coordinateValide = (lat?: number | null, lon?: number | null): boolean =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);

/** Righe di ogni foglio del file (nome del foglio → righe), con l'intestazione sulla prima riga. */
export function leggiFogli(file: Buffer): Record<string, RigaFile[]> {
  const cartella = XLSX.read(file, { type: 'buffer' });
  return Object.fromEntries(
    cartella.SheetNames.map(nome => [nome, XLSX.utils.sheet_to_json<RigaFile>(cartella.Sheets[nome], { defval: '', raw: false })])
  );
}

/** Righe del primo foglio, con l'intestazione sulla prima riga. */
export function leggiFoglio(file: Buffer): RigaFile[] {
  return Object.values(leggiFogli(file))[0] ?? [];
}

/** Righe da importare: quelle che la libreria agenzia ricava dal file, o quelle del primo foglio. */
export function righeDaImportare(file: Buffer, importer: ImportPuntiVenditaAgenzia): RigaFile[] {
  return importer.leggiFile ? importer.leggiFile(leggiFogli(file)) : leggiFoglio(file);
}

/** Sotto questo punteggio di affidabilita (0-100) una riga non si importa da sola: va in revisione. */
export function sogliaAffidabilitaImport(): number {
  const soglia = Number(process.env.PV_IMPORT_SOGLIA_AFFIDABILITA);
  return Number.isFinite(soglia) && soglia >= 0 && soglia <= 100 ? soglia : 70;
}

// Punti tolti dai dubbi che nascono confrontando la riga con i PV gia presenti
const PENALITA_CHIAVE_DI_RISERVA = 20;
const PENALITA_RICONOSCIUTO_PER_NOME = 15;
const PENALITA_CHIAVE_CAMBIATA = 40;

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
  soglia = sogliaAffidabilitaImport(),
): EsitoRigaImportPuntoVenditaDTO[] {
  const n = normalizePuntoVenditaText;
  const { chiaveMeta, chiaveMetaRiserva } = importer;
  const valoreMeta = (campo: string | undefined, meta?: Record<string, unknown>) => (campo ? String(meta?.[campo] ?? '').trim() : '');
  const chiaveDi = (meta?: Record<string, unknown>) => valoreMeta(chiaveMeta, meta);
  const riservaDi = (meta?: Record<string, unknown>) => valoreMeta(chiaveMetaRiserva, meta);
  const doppione = (pv: { nome: string; indirizzo: string; cap: string }) => [n(pv.nome), n(pv.indirizzo), n(pv.cap)].join('|');
  const trova = (voci: Voce[], valore = '') =>
    n(valore) ? voci.find(v => n(v.codice) === n(valore) || (!importer.canaleEAreaPerCodice && n(v.nome) === n(valore))) : undefined;

  const perChiave = new Map(contesto.esistenti.filter(pv => chiaveDi(pv.meta)).map(pv => [chiaveDi(pv.meta), pv]));
  const perRiserva = new Map(contesto.esistenti.filter(pv => riservaDi(pv.meta)).map(pv => [riservaDi(pv.meta), pv]));
  // Un PV senza chiavi del cliente (la libreria non ne ha, o e stato creato prima) si riconosce da nome, indirizzo e CAP
  const perDoppione = new Map(
    contesto.esistenti.filter(pv => !chiaveDi(pv.meta) && !riservaDi(pv.meta)).map(pv => [doppione(pv), pv])
  );
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

    const avvisi = [...(letto.avvisi ?? [])];
    // Le righe che la libreria segna come gia sotto soglia si decidono in revisione: canale e area li sceglie l'utente
    const giaInRevisione = () => 100 - avvisi.reduce((somma, a) => somma + a.penalita, 0) < soglia;

    let idCombinazione: string | undefined;
    // Canale e area riconosciuti anche senza combinazione: il modale di inserimento li propone
    let idCanale: string | undefined;
    let idArea: string | undefined;
    const sigla = letto.canaleArea;
    if (sigla) {
      idCombinazione = contesto.combinazioni.find(c => c.id === sigla || n(c.sigla) === n(sigla))?.id;
      if (!idCombinazione) return scarta(`Canale/area non valido: ${sigla}`);
    } else {
      const canale = trova(contesto.canali, letto.canale);
      const area = trova(contesto.aree, letto.area);
      idCanale = canale?.id;
      idArea = area?.id;
      idCombinazione = canale && area ? contesto.combinazioni.find(c => c.idCanale === canale.id && c.idArea === area.id)?.id : undefined;
      if (!idCombinazione && !giaInRevisione()) {
        if (!canale) return scarta(`Canale non riconosciuto: ${letto.canale ?? ''}`);
        if (!area) return scarta(`Area non riconosciuta: ${letto.area ?? ''}`);
        return scarta(`Nessuna combinazione per il canale ${canale.nome} e l'area ${area.nome}`);
      }
    }

    const chiave = chiaveDi(letto.meta);
    const riserva = riservaDi(letto.meta);
    if (chiaveMeta && !chiave && !riserva) return scarta(`${chiaveMeta} mancante`);
    // Chiave principale e di riserva identificano ciascuna un solo PV nel file
    const identita = [
      chiave && `chiave:${chiave}`,
      riserva && `riserva:${riserva}`,
      !chiave && !riserva && `pv:${doppione({ nome, indirizzo, cap })}`,
    ].filter((v): v is string => Boolean(v));
    const ripetuta = identita.find(i => visti.has(i));
    if (ripetuta) {
      if (ripetuta.startsWith('chiave:')) return scarta(`${chiaveMeta} ${chiave} ripetuto nel file`);
      if (ripetuta.startsWith('riserva:')) return scarta(`${chiaveMetaRiserva} ${riserva} ripetuto nel file`);
      return scarta('Punto vendita ripetuto nel file');
    }
    identita.forEach(i => visti.add(i));

    const perNome = perDoppione.get(doppione({ nome, indirizzo, cap }));
    if (!chiaveMeta && perNome) return scarta('Punto vendita già presente');
    const perChiaveTrovato = chiave ? perChiave.get(chiave) : undefined;
    const perRiservaTrovato = !perChiaveTrovato && riserva ? perRiserva.get(riserva) : undefined;
    const esistente = perChiaveTrovato ?? perRiservaTrovato ?? perNome;
    // Un PV senza chiave preso da una riga non puo essere preso anche da un'altra
    if (perNome && esistente === perNome) perDoppione.delete(doppione(perNome));

    if (chiaveMeta && !chiave) {
      avvisi.push({ motivo: `${chiaveMeta} mancante: riconosciuto da ${chiaveMetaRiserva} ${riserva}`, penalita: PENALITA_CHIAVE_DI_RISERVA });
    }
    if (perRiservaTrovato && chiave && chiaveDi(perRiservaTrovato.meta) && chiaveDi(perRiservaTrovato.meta) !== chiave) {
      avvisi.push({
        motivo: `${chiaveMeta} cambiato da ${chiaveDi(perRiservaTrovato.meta)} a ${chiave} per lo stesso ${chiaveMetaRiserva}`,
        penalita: PENALITA_CHIAVE_CAMBIATA,
      });
    }
    if (perNome && esistente === perNome) {
      avvisi.push({ motivo: 'Punto vendita esistente riconosciuto da nome, indirizzo e CAP', penalita: PENALITA_RICONOSCIUTO_PER_NOME });
    }
    const punteggio = Math.max(0, 100 - avvisi.reduce((somma, a) => somma + a.penalita, 0));
    // Un PV gia geolocalizzato allo stesso indirizzo tiene le sue coordinate: niente nuova ricerca
    // su Nominatim, e Istanta non le riceve azzerate
    const senzaCoordinateNelFile = !Number.isFinite(letto.lat) || !Number.isFinite(letto.lon);
    const coordinateEsistenti =
      senzaCoordinateNelFile && esistente && coordinateValide(esistente.lat, esistente.lon) &&
      n(esistente.indirizzo) === n(indirizzo) && n(esistente.cap) === n(cap)
        ? { lat: esistente.lat, lon: esistente.lon }
        : { lat: letto.lat, lon: letto.lon };
    const motivi = avvisi.map(a => a.motivo);

    const dati: DatiPuntoVenditaImportatoDTO = {
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
      lat: coordinateEsistenti.lat,
      lon: coordinateEsistenti.lon,
      meta: letto.meta && { ...esistente?.meta, ...letto.meta },
    };
    if (punteggio < soglia || !idCombinazione) {
      return {
        riga: numeroRiga,
        azione: 'revisiona',
        id: esistente?.id,
        letto,
        dati,
        punteggio,
        motivi,
        chiave: chiave || riserva || doppione({ nome, indirizzo, cap }),
        idCanale,
        idArea,
      };
    }
    const completi: CreatePuntoVenditaDTO = { ...dati, id_combinazione_canale_area: idCombinazione };
    return esistente
      ? { riga: numeroRiga, azione: 'aggiorna', id: esistente.id, letto, dati: completi, punteggio, motivi }
      : { riga: numeroRiga, azione: 'crea', letto, dati: completi, punteggio, motivi };
  });
}
