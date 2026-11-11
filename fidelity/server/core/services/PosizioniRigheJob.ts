import { randomUUID } from 'node:crypto';
import type { StatoRicercaPosizioni } from '../../../lib/puntiVendita/analisi';
import { log } from '../logger';
import { STATO_LAVORO } from '../models/lavori_in_background';
import type { EsitoRicercaPosizione } from '../repositories/PosizioniRigheRepository';
import type { PosizioneTrovata } from '../utils/geocodifica';
import { type EsitoLavoro, type Lavoro, mantieniVivo, registroLavori, type RegistroLavori } from './RegistroLavori';

/**
 * La ricerca in background della posizione delle righe dei volantini di una GDO (contratto in
 * lib/puntiVendita/analisi.ts, StatoRicercaPosizioni): un indirizzo stampato alla volta, con
 * Nominatim dalla coda di geocodifica (una richiesta ogni 1,2 secondi). Ogni esito si salva subito,
 * così una ricerca annullata o interrotta non perde quello che ha trovato e la successiva riparte
 * dagli indirizzi che mancano.
 *
 * Come l'import dei PV: il ciclo gira nel worker che ha ricevuto la richiesta; stato e annullamento
 * stanno nel registro dei lavori (DB), con al più una ricerca attiva per GDO fra tutti i worker.
 * L'avanzamento arriva via socket all'utente che l'ha avviata.
 */

/** Tipo della ricerca nel registro dei lavori; la chiave è la GDO. */
export const TIPO_LAVORO_POSIZIONI_RIGHE = 'posizioni_righe_volantino';

/** Evento socket di una ricerca: posizioniRighe_<jobId>_progress e posizioniRighe_<jobId>_complete. */
export const eventoPosizioniRighe = (jobId: string, tipo: 'progress' | 'complete') => `posizioniRighe_${jobId}_${tipo}`;

/** Dopo tanti errori di fila Nominatim è giù o ci blocca: la ricerca si ferma. */
export const MAX_ERRORI_DI_FILA = 5;

export const MESSAGGIO_RICERCA_INTERROTTA = 'Ricerca interrotta: il server che la eseguiva si è fermato. Le posizioni trovate restano, riavviala per le altre';

// Una ricerca finita resta consultabile per un'ora: chi riapre la pagina ne vede il riepilogo
const CONSERVAZIONE_MS = 60 * 60 * 1000;
const INTERVALLO_SALVATAGGIO_MS = 1000;

/** Un indirizzo stampato da cercare, con la chiave della sua posizione. */
export interface IndirizzoDaCercare {
  chiave: string;
  indirizzo: string | null;
  localita: string | null;
  provincia: string | null;
}

/** Cosa fa la ricerca di ogni indirizzo: Nominatim e il DB stanno fuori, così il job si prova da solo. */
export interface OperazioniPosizioni {
  /** La posizione dell'indirizzo; undefined se non si trova, un errore se Nominatim non risponde. */
  cerca(indirizzo: IndirizzoDaCercare): Promise<PosizioneTrovata | undefined>;
  salva(chiave: string, esito: EsitoRicercaPosizione): Promise<void>;
  /** Invia l'avanzamento all'utente che ha avviato la ricerca. */
  notifica(evento: 'progress' | 'complete', stato: StatoRicercaPosizioni): void;
}

/** Una ricerca è già attiva sulla GDO (anche in un altro worker): `stato` è il suo. */
export class RicercaPosizioniGiaInCorso extends Error {
  constructor(readonly stato: StatoRicercaPosizioni) {
    super('Una ricerca delle posizioni è già in corso per questa GDO');
  }
}

export interface OpzioniGestorePosizioni {
  intervalloSalvataggioMs?: number;
  intervalloBattitoMs?: number;
}

interface Job {
  stato: StatoRicercaPosizioni;
  idGdo: string;
  annullato: boolean;
  erroriDiFila: number;
  ultimoSalvataggio: number;
}

const ESITO_NEL_REGISTRO: Record<string, EsitoLavoro> = {
  completato: STATO_LAVORO.COMPLETATO,
  annullato: STATO_LAVORO.ANNULLATO,
  errore: STATO_LAVORO.ERRORE,
};

const copia = (stato: StatoRicercaPosizioni): StatoRicercaPosizioni => ({ ...stato });
const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Stato dal registro: se il worker che la eseguiva si è fermato, è un errore e non è più in corso. */
function statoDaLavoro(lavoro: Lavoro<StatoRicercaPosizioni>): StatoRicercaPosizioni {
  const stato = copia(lavoro.avanzamento as StatoRicercaPosizioni);
  if (!lavoro.interrotto) return stato;
  return {
    ...stato,
    stato: 'errore',
    ultimoErrore: MESSAGGIO_RICERCA_INTERROTTA,
    terminatoIl: stato.terminatoIl ?? (lavoro.conclusoIl ?? lavoro.heartbeatAt).toISOString(),
  };
}

export class GestorePosizioniRighe {
  private readonly locali = new Map<string, Job>();
  private readonly intervalloSalvataggioMs: number;
  private readonly intervalloBattitoMs?: number;

  constructor(private readonly registro: RegistroLavori = registroLavori, opzioni: OpzioniGestorePosizioni = {}) {
    this.intervalloSalvataggioMs = opzioni.intervalloSalvataggioMs ?? INTERVALLO_SALVATAGGIO_MS;
    this.intervalloBattitoMs = opzioni.intervalloBattitoMs;
  }

  /**
   * Avvia la ricerca e restituisce subito lo stato iniziale; `fine` si risolve al termine.
   * RicercaPosizioniGiaInCorso se sulla GDO ce n'è già una attiva.
   */
  async avvia(
    idGdo: string,
    idUtente: string,
    indirizzi: readonly IndirizzoDaCercare[],
    operazioni: OperazioniPosizioni,
  ): Promise<{ stato: StatoRicercaPosizioni; fine: Promise<StatoRicercaPosizioni> }> {
    const stato: StatoRicercaPosizioni = {
      jobId: randomUUID(),
      stato: 'in_corso',
      totale: indirizzi.length,
      esaminate: 0,
      trovate: 0,
      approssimate: 0,
      nonTrovate: 0,
      errori: 0,
      avviatoIl: new Date().toISOString(),
    };
    const avvio = await this.registro.avvia<StatoRicercaPosizioni>({
      id: stato.jobId, tipo: TIPO_LAVORO_POSIZIONI_RIGHE, chiave: idGdo, idUtente, idGdo, avanzamento: stato,
    });
    if (!avvio.avviato) throw new RicercaPosizioniGiaInCorso(statoDaLavoro(avvio.lavoro));
    const job: Job = { stato, idGdo, annullato: false, erroriDiFila: 0, ultimoSalvataggio: Date.now() };
    this.locali.set(stato.jobId, job);
    return { stato: copia(stato), fine: this.esegui(job, indirizzi, operazioni) };
  }

  private async esegui(job: Job, indirizzi: readonly IndirizzoDaCercare[], operazioni: OperazioniPosizioni): Promise<StatoRicercaPosizioni> {
    const { stato } = job;
    const fermaBattito = mantieniVivo(this.registro, stato.jobId, this.intervalloBattitoMs);
    try {
      for (const indirizzo of indirizzi) {
        // Lascia passare l'annullamento anche fra indirizzi che non aspettano Nominatim
        await new Promise(resolve => setImmediate(resolve));
        if (job.annullato) break;
        await this.cercaUno(job, indirizzo, operazioni);
        stato.esaminate++;
        await this.salvaAvanzamento(job);
        operazioni.notifica('progress', copia(stato));
        if (job.erroriDiFila >= MAX_ERRORI_DI_FILA) {
          stato.stato = 'errore';
          stato.ultimoErrore = `Ricerca fermata: Nominatim non risponde (${MAX_ERRORI_DI_FILA} errori di fila). Ultimo errore: ${stato.ultimoErrore ?? ''}`;
          break;
        }
      }
      if (stato.stato === 'in_corso') stato.stato = job.annullato ? 'annullato' : 'completato';
    } catch (e) {
      log.error('posizioniRighe - ricerca interrotta', { jobId: stato.jobId, error: messaggio(e) });
      stato.stato = 'errore';
      stato.ultimoErrore = messaggio(e);
    }
    stato.terminatoIl = new Date().toISOString();
    // Prima l'esito nel registro, poi l'evento: chi rilegge lo stato dopo l'evento trova la ricerca conclusa
    try {
      await this.registro.concludi(stato.jobId, ESITO_NEL_REGISTRO[stato.stato] ?? STATO_LAVORO.ERRORE, {
        avanzamento: copia(stato),
        errore: stato.stato === 'errore' ? stato.ultimoErrore : undefined,
      });
    } catch (e) {
      log.error('posizioniRighe - esito non salvato nel registro dei lavori', { jobId: stato.jobId, error: messaggio(e) });
    }
    fermaBattito();
    this.locali.delete(stato.jobId);
    log.info('posizioniRighe - terminata', { ...stato });
    operazioni.notifica('complete', copia(stato));
    return copia(stato);
  }

  /** Un indirizzo: l'esito di Nominatim si salva subito; un errore del DB ferma la ricerca. */
  private async cercaUno(job: Job, indirizzo: IndirizzoDaCercare, operazioni: OperazioniPosizioni): Promise<void> {
    const { stato } = job;
    let trovata: PosizioneTrovata | undefined;
    try {
      trovata = await operazioni.cerca(indirizzo);
    } catch (e) {
      const motivo = messaggio(e);
      job.erroriDiFila++;
      stato.errori++;
      stato.ultimoErrore = motivo;
      log.warn('posizioniRighe - Nominatim in errore', { jobId: stato.jobId, chiave: indirizzo.chiave, motivo });
      await operazioni.salva(indirizzo.chiave, { ricerca: null, lat: null, lon: null, precisione: 'non_trovata', errore: motivo });
      return;
    }
    job.erroriDiFila = 0;
    if (trovata) {
      stato.trovate++;
      if (trovata.precisione !== 'civico') stato.approssimate++;
      await operazioni.salva(indirizzo.chiave, { ricerca: trovata.ricerca, lat: trovata.lat, lon: trovata.lon, precisione: trovata.precisione, errore: null });
    } else {
      stato.nonTrovate++;
      await operazioni.salva(indirizzo.chiave, { ricerca: null, lat: null, lon: null, precisione: 'non_trovata', errore: null });
    }
  }

  /** Dopo ogni indirizzo: raccoglie l'annullamento chiesto a un altro worker e, ogni tanto, salva l'avanzamento. */
  private async salvaAvanzamento(job: Job): Promise<void> {
    const ora = Date.now();
    const completo = ora - job.ultimoSalvataggio >= this.intervalloSalvataggioMs;
    try {
      const { annullamentoRichiesto } = await this.registro.aggiorna(job.stato.jobId, completo ? copia(job.stato) : undefined);
      if (completo) job.ultimoSalvataggio = ora;
      if (annullamentoRichiesto) job.annullato = true;
    } catch (e) {
      log.warn('posizioniRighe - avanzamento non salvato nel registro dei lavori', { jobId: job.stato.jobId, error: messaggio(e) });
    }
  }

  /** Lo stato di una ricerca della GDO; undefined se non c'è o è di un'altra GDO. */
  async stato(jobId: string, idGdo: string): Promise<StatoRicercaPosizioni | undefined> {
    const lavoro = await this.registro.leggi<StatoRicercaPosizioni>(jobId);
    return lavoro && lavoro.tipo === TIPO_LAVORO_POSIZIONI_RIGHE && lavoro.idGdo === idGdo ? statoDaLavoro(lavoro) : undefined;
  }

  /** La ricerca attiva sulla GDO o, se non ce n'è, l'ultima finita da meno di un'ora. */
  async ultima(idGdo: string): Promise<StatoRicercaPosizioni | undefined> {
    const attiva = await this.registro.attivo<StatoRicercaPosizioni>(TIPO_LAVORO_POSIZIONI_RIGHE, idGdo);
    if (attiva) return statoDaLavoro(attiva);
    const lavoro = await this.registro.ultimo<StatoRicercaPosizioni>(TIPO_LAVORO_POSIZIONI_RIGHE, { chiave: idGdo });
    if (!lavoro) return undefined;
    const finitaIl = (lavoro.conclusoIl ?? lavoro.heartbeatAt).getTime();
    if (!lavoro.attivo && Date.now() - finitaIl > CONSERVAZIONE_MS) return undefined;
    return statoDaLavoro(lavoro);
  }

  /** Ferma la ricerca dopo l'indirizzo in corso; undefined se non è della GDO. */
  async annulla(jobId: string, idGdo: string): Promise<StatoRicercaPosizioni | undefined> {
    const locale = this.locali.get(jobId);
    // Nel processo che la esegue l'annullamento vale subito
    if (locale && locale.idGdo === idGdo) locale.annullato = true;
    const lavoro = await this.registro.leggi<StatoRicercaPosizioni>(jobId);
    if (!lavoro || lavoro.tipo !== TIPO_LAVORO_POSIZIONI_RIGHE || lavoro.idGdo !== idGdo) return undefined;
    if (lavoro.attivo) await this.registro.richiediAnnullamento(jobId);
    return statoDaLavoro(lavoro);
  }
}

export const posizioniRigheJobs = new GestorePosizioniRighe(registroLavori);
