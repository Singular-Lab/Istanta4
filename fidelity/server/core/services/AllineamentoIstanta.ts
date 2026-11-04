import type { Request } from 'express';
import { QueryTypes, type Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORIA_ATTIVITA, STATO_PROMO, TIPO_ATTIVITA } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { Promo } from '../models/promo';
import { Tracciati } from '../models/tracciati';
import { TracciatiInvioIstanta } from '../models/tracciati_invio_istanta';
import { ServerUtils } from '../utils/ServerUtils';
import { verificaRisposta } from '../utils/rispostaServizi';

/**
 * Allineamento con Istanta dei tracciati che FP ha salvato e Istanta non ha ancora: le liste
 * dell'archivio storico (POST /api/tracciati/archivio, salvate subito) e i tracciati del flusso
 * normale che Istanta non ha accettato (uploadTracciato). Stanno in tracciati_invio_istanta e si
 * inviano a Istanta uno alla volta, con lo stesso GUID e a nome di chi li ha caricati, come
 * farebbe uploadTracciato. Il giro gira solo nel worker dei servizi di background; la
 * prenotazione (inviando_dal, con SKIP LOCKED) evita comunque che il giro e "Rimanda a Istanta",
 * o due processi, mandino lo stesso tracciato.
 *
 * Esiste solo perche' c'e' Istanta: quando l'importazione dei tracciati sara' tutta in Fidelity
 * questo modulo, la coda e i loro usi vanno rivisti o tolti.
 */

/** Tempo per inviare un tracciato: scaduto, un'altra esecuzione lo riprende (il processo si e' fermato). */
export const PRENOTAZIONE_MS = 10 * 60 * 1000;
/** Fra un invio e il successivo: Istanta riceve le liste con calma. */
export const PAUSA_FRA_INVII_MS = 2 * 1000;
/** Coda vuota o tutte in pausa: si riguarda dopo. */
export const ATTESA_CODA_VUOTA_MS = 30 * 1000;
/** Pause dopo il 1°, 2°, 3°, 4° errore; poi sempre l'ultima. */
const PAUSE_DOPO_ERRORE_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];

export const pausaDopoErrore = (tentativi: number): number =>
  PAUSE_DOPO_ERRORE_MS[Math.min(Math.max(tentativi, 1), PAUSE_DOPO_ERRORE_MS.length) - 1];

const MIME_EXCEL: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
};

export type StatoIstantaTracciato = 'inviato' | 'in_attesa' | 'errore';

export interface StatoIstanta {
  stato: StatoIstantaTracciato;
  errore: string | null;
  tentativi: number;
}

interface Prenotata {
  id_tracciato: string;
  id_utente: string;
  tentativi: number;
}

/** Nessuno lo sta inviando, o chi lo inviava si e' fermato da piu' di PRENOTAZIONE_MS. */
const LIBERA = `(inviando_dal IS NULL OR inviando_dal < now() - CAST(:prenotazione AS interval))`;
const PRENOTAZIONE = { prenotazione: `${PRENOTAZIONE_MS} milliseconds` };

/** Il prossimo tracciato da inviare, prenotato; null se non ce ne sono o sono tutti in pausa. */
export async function prenotaProssima(): Promise<Prenotata | null> {
  const righe = await sequelize.query<Prenotata>(`
    UPDATE tracciati_invio_istanta SET inviando_dal = now()
    WHERE id_tracciato = (
      SELECT id_tracciato FROM tracciati_invio_istanta
      WHERE prossimo_tentativo <= now() AND ${LIBERA}
      ORDER BY prossimo_tentativo, creato_il
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id_tracciato, id_utente, tentativi`,
    { replacements: PRENOTAZIONE, type: QueryTypes.SELECT }
  );
  return righe[0] ?? null;
}

/**
 * "Rimanda a Istanta": prenota quel tracciato anche se e' in pausa. null se non e' in coda (gia'
 * in Istanta) oppure se qualcuno lo sta gia' inviando.
 */
export async function prenotaTracciato(idTracciato: string): Promise<Prenotata | null> {
  const righe = await sequelize.query<Prenotata>(`
    UPDATE tracciati_invio_istanta SET inviando_dal = now()
    WHERE id_tracciato = (
      SELECT id_tracciato FROM tracciati_invio_istanta
      WHERE id_tracciato = :idTracciato AND ${LIBERA}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id_tracciato, id_utente, tentativi`,
    { replacements: { ...PRENOTAZIONE, idTracciato }, type: QueryTypes.SELECT }
  );
  return righe[0] ?? null;
}

/**
 * Mette in coda un tracciato appena salvato in FP. Con `motivo` Istanta l'ha gia' rifiutato una
 * volta (flusso normale): si riprova dopo la prima pausa; senza (archivio) parte appena puo'.
 */
export async function accodaPerIstanta(
  voci: Array<{ idTracciato: string; idUtente: string; motivo?: string }>,
  transaction?: Transaction
): Promise<void> {
  if (!voci.length) return;
  await TracciatiInvioIstanta.bulkCreate(voci.map((v) => ({
    id_tracciato: v.idTracciato,
    id_utente: v.idUtente,
    tentativi: v.motivo ? 1 : 0,
    ultimo_errore: v.motivo ? v.motivo.slice(0, 2000) : null,
    prossimo_tentativo: new Date(Date.now() + (v.motivo ? pausaDopoErrore(1) : 0)),
  })), { transaction });
}

/** La richiesta di chi ha caricato la lista: il passaporto Olimpo verso Istanta si ricava dal suo utente. */
const richiestaDi = (idUtente: string): Request => ({ session: { id_utente: idUtente }, headers: {} }) as unknown as Request;

export type EsitoInvio = { esito: 'inviata' } | { esito: 'errore'; motivo: string; tentativi: number } | { esito: 'sparita' };

/**
 * Invia a Istanta il tracciato prenotato. Accettato: esce dalla coda e resta l'attivita' di chi
 * l'ha caricato. Rifiutato o senza risposta: resta in coda col motivo e si riprova dopo una
 * pausa che cresce coi tentativi. `req`: chi ha premuto "Rimanda a Istanta" (il passaporto e' il
 * suo); senza, quello di chi l'ha caricato.
 */
export async function inviaPrenotata(prenotata: Prenotata, req?: Request): Promise<EsitoInvio> {
  const tracciato = await Tracciati.findByPk(prenotata.id_tracciato);
  if (!tracciato) {
    await TracciatiInvioIstanta.destroy({ where: { id_tracciato: prenotata.id_tracciato } });
    return { esito: 'sparita' };
  }
  const nomeFile = tracciato.filename_tracciati;
  try {
    const form = new FormData();
    const estensione = nomeFile.split('.').pop()?.toLowerCase() ?? '';
    form.append('fileContent', new Blob([new Uint8Array(tracciato.blobfile_tracciati)], { type: MIME_EXCEL[estensione] ?? 'application/octet-stream' }), nomeFile);
    form.append('guid_id', tracciato.id_tracciati);
    form.append('idPromo', tracciato.id_promo_tracciati);
    form.append('fileName', nomeFile);
    form.append('context', JSON.stringify(tracciato.context_tracciati));
    const risposta = await ServerUtils.sendToFicoApiAxiosUploadTracciato<{ esito?: boolean }>(req ?? richiestaDi(prenotata.id_utente), form);
    // Istanta risponde 200 anche quando rifiuta il tracciato: vale solo esito true
    verificaRisposta(risposta, 'ISTANTA', '/FicoProcess/uploadTracciato', (d) => d?.esito === true);
  } catch (error) {
    const tentativi = prenotata.tentativi + 1;
    const motivo = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
    await TracciatiInvioIstanta.update(
      { tentativi, ultimo_errore: motivo, prossimo_tentativo: new Date(Date.now() + pausaDopoErrore(tentativi)), inviando_dal: null },
      { where: { id_tracciato: prenotata.id_tracciato } }
    );
    log.warn('Tracciato non accettato da Istanta: si riprova', { idTracciato: prenotata.id_tracciato, tentativi, motivo });
    return { esito: 'errore', motivo, tentativi };
  }
  await TracciatiInvioIstanta.destroy({ where: { id_tracciato: prenotata.id_tracciato } });
  await ServerUtils.CREA_ATTIVITA(prenotata.id_utente, TIPO_ATTIVITA.IMPORT_TRACCIATO, CATEGORIA_ATTIVITA.PRODUZIONE, {
    id: tracciato.id_tracciati,
    nome: nomeFile,
    idPromo: tracciato.id_promo_tracciati,
    fileName: nomeFile,
    context: tracciato.context_tracciati,
  }).catch((error) => log.warn('Attivita\' dell\'invio a Istanta non registrata', { idTracciato: tracciato.id_tracciati, motivo: String(error) }));
  return { esito: 'inviata' };
}

export interface ListaArchivio {
  nomeFile: string;
  idPromo: string;
  context: unknown;
  contenuto: Buffer;
}

export type EsitoListaArchivio =
  | { nomeFile: string; idPromo: string; esito: 'caricata'; id: string }
  | { nomeFile: string; idPromo: string; esito: 'presente' }
  | { nomeFile: string; idPromo: string; esito: 'scartata'; motivo: string };

const ESTENSIONE_EXCEL = /\.xlsx?$/i;

/** Perche' una lista non si puo' salvare, guardando solo la lista; null se va bene. */
function scartoLista(lista: Partial<ListaArchivio>): string | null {
  if (typeof lista.nomeFile !== 'string' || !lista.nomeFile.trim()) return 'nome del file mancante';
  if (!ESTENSIONE_EXCEL.test(lista.nomeFile)) return 'formato non valido: serve un file .xls o .xlsx';
  if (typeof lista.idPromo !== 'string' || !lista.idPromo.trim()) return 'promo mancante';
  if (!Array.isArray(lista.context)) return 'contesto non valido';
  const label = (lista.context as Array<{ nome_field?: unknown; user_value?: unknown }>).find((c) => c?.nome_field === 'idLabel');
  if (typeof label?.user_value === 'string' && label.user_value.length > 40) return "l'etichetta non puo' superare i 40 caratteri";
  return null;
}

/**
 * Le liste dell'archivio storico di un lotto: subito tracciati delle loro promo e in coda per
 * Istanta, in una sola transazione. Una lista col nome di un tracciato gia' nella promo (o gia'
 * nel lotto) e' presente; una non valida, o di una promo inesistente o eliminata, e' scartata.
 * L'esito e' nell'ordine delle liste.
 */
export async function salvaListeArchivio(liste: ListaArchivio[], idUtente: string): Promise<EsitoListaArchivio[]> {
  const idPromo = [...new Set(liste.map((l) => l.idPromo).filter((id): id is string => typeof id === 'string'))];
  const [promo, esistenti] = idPromo.length
    ? await Promise.all([
      Promo.findAll({ where: { id_promo: idPromo }, attributes: ['id_promo', 'stato'], raw: true }),
      Tracciati.findAll({ where: { id_promo_tracciati: idPromo }, attributes: ['id_promo_tracciati', 'filename_tracciati'], raw: true }),
    ])
    : [[], []];
  const statoPromo = new Map(promo.map((p) => [p.id_promo, p.stato]));
  const chiave = (idP: string, nome: string) => `${idP}\u0000${nome}`;
  const presenti = new Set(esistenti.map((t) => chiave(t.id_promo_tracciati, t.filename_tracciati)));

  const daSalvare: Array<ListaArchivio & { id: string }> = [];
  const esiti: EsitoListaArchivio[] = liste.map((lista) => {
    const base = { nomeFile: String(lista.nomeFile ?? ''), idPromo: String(lista.idPromo ?? '') };
    const scarto = scartoLista(lista)
      ?? (!statoPromo.has(lista.idPromo) ? 'promo inesistente'
        : statoPromo.get(lista.idPromo) === STATO_PROMO.ELIMINATA ? 'promo eliminata' : null);
    if (scarto) return { ...base, esito: 'scartata', motivo: scarto };
    const k = chiave(lista.idPromo, lista.nomeFile);
    if (presenti.has(k)) return { ...base, esito: 'presente' };
    presenti.add(k);
    const id = uuidv4();
    daSalvare.push({ ...lista, id });
    return { ...base, esito: 'caricata', id };
  });

  if (daSalvare.length) {
    await sequelize.transaction(async (transaction) => {
      const adesso = new Date();
      await Tracciati.bulkCreate(daSalvare.map((l) => ({
        id_tracciati: l.id,
        id_promo_tracciati: l.idPromo,
        filename_tracciati: l.nomeFile,
        blobfile_tracciati: l.contenuto,
        context_tracciati: l.context,
        createdat: adesso,
        updatedat: adesso,
      })), { transaction });
      await accodaPerIstanta(daSalvare.map((l) => ({ idTracciato: l.id, idUtente })), transaction);
    });
  }
  return esiti;
}

export type EsitoModificaContesto = 'aggiornato' | 'inviato' | 'in_invio' | 'inesistente';

/**
 * Nuovo contesto di un tracciato ancora in coda per Istanta, quello che gli si mandera'. Un
 * tracciato gia' in Istanta ('inviato') o che si sta inviando ('in_invio') non cambia.
 */
export async function aggiornaContestoInAttesa(idTracciato: string, context: unknown[]): Promise<EsitoModificaContesto> {
  return sequelize.transaction(async (transaction) => {
    const tracciato = await Tracciati.findByPk(idTracciato, { attributes: ['id_tracciati'], transaction });
    if (!tracciato) return 'inesistente';
    const inCoda = await TracciatiInvioIstanta.findByPk(idTracciato, { transaction, lock: transaction.LOCK.UPDATE });
    if (!inCoda) return 'inviato';
    if (inCoda.inviando_dal && inCoda.inviando_dal.getTime() > Date.now() - PRENOTAZIONE_MS) return 'in_invio';
    await Tracciati.update({ context_tracciati: context, updatedat: new Date() }, { where: { id_tracciati: idTracciato }, transaction });
    return 'aggiornato';
  });
}

/** Un passo dell'allineamento: true se c'era una lista da inviare. */
export async function allineaUna(): Promise<boolean> {
  const prenotata = await prenotaProssima();
  if (!prenotata) return false;
  await inviaPrenotata(prenotata);
  return true;
}

/** Stato verso Istanta di ogni tracciato: quelli non in coda sono gia' in Istanta. */
export async function statoIstantaTracciati(idTracciati: string[]): Promise<Map<string, StatoIstanta>> {
  const stati = new Map<string, StatoIstanta>();
  for (const id of idTracciati) stati.set(id, { stato: 'inviato', errore: null, tentativi: 0 });
  if (!idTracciati.length) return stati;
  const inCoda = await TracciatiInvioIstanta.findAll({
    where: { id_tracciato: idTracciati },
    attributes: ['id_tracciato', 'tentativi', 'ultimo_errore'],
    raw: true,
  });
  for (const riga of inCoda) {
    stati.set(riga.id_tracciato, {
      stato: riga.tentativi > 0 ? 'errore' : 'in_attesa',
      errore: riga.tentativi > 0 ? riga.ultimo_errore : null,
      tentativi: riga.tentativi,
    });
  }
  return stati;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let attivo = false;

/** Avvia il giro continuo: una lista, una pausa, la successiva; a coda vuota si riguarda piu' tardi. */
export function avviaAllineamentoIstanta(): void {
  if (attivo) return;
  attivo = true;
  const giro = async () => {
    let inviata = false;
    try {
      inviata = await allineaUna();
    } catch (error) {
      log.error('Allineamento delle liste dell\'archivio con Istanta non riuscito', error as Error);
    }
    if (attivo) timer = setTimeout(() => void giro(), inviata ? PAUSA_FRA_INVII_MS : ATTESA_CODA_VUOTA_MS);
  };
  timer = setTimeout(() => void giro(), ATTESA_CODA_VUOTA_MS);
  log.info('Allineamento con Istanta delle liste dell\'archivio storico avviato');
}

export function fermaAllineamentoIstanta(): void {
  attivo = false;
  if (timer) clearTimeout(timer);
  timer = null;
}
