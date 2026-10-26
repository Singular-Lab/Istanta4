import { randomUUID } from 'node:crypto';
import type {
  CreatePuntoVenditaDTO,
  DecisioneImportPuntoVenditaDTO,
  EsitoRigaImportPuntoVenditaDTO,
  RigaInAttesaImportDTO,
  StatoImportPuntiVenditaDTO,
} from '../dto';
import { log } from '../logger';
import { coordinateValide } from './importPuntiVendita';

type EsitoDaScrivere = Extract<EsitoRigaImportPuntoVenditaDTO, { azione: 'crea' | 'aggiorna' }>;

/** Cio che il job fa di ogni riga: le scritture vere stanno fuori, cosi il job si prova senza Istanta. */
export interface OperazioniImportPuntiVendita {
  /**
   * Scrive il PV prima su Istanta e poi in FP; un'eccezione e l'errore della riga.
   * `sincronizzato: false` se e rimasto solo in FP (Istanta non raggiungibile in development).
   */
  scrivi(esito: EsitoDaScrivere): Promise<{ sincronizzato: boolean } | void>;
  /**
   * Coordinate dell'indirizzo del PV (Nominatim), per le righe automatiche che non le hanno;
   * undefined se l'indirizzo non si trova. Le chiamate sono distanziate dalla coda di geocodifica.
   */
  geocodifica?(dati: CreatePuntoVenditaDTO): Promise<{ lat: number; lon: number } | undefined>;
  /** Invia l'avanzamento all'utente che ha avviato l'import. */
  notifica(evento: 'progress' | 'complete', stato: StatoImportPuntiVenditaDTO): void;
  /** Al termine (anche se annullato), se almeno un PV e stato scritto. */
  alTermine?(stato: StatoImportPuntiVenditaDTO): Promise<void>;
}

interface Job {
  stato: StatoImportPuntiVenditaDTO;
  idGdo: string;
  idUtente: string;
  annullato: boolean;
  operazioni: OperazioniImportPuntiVendita;
  /** Sblocca il ciclo fermo sulla riga in attesa (decisione presa o import annullato). */
  riprendi?: () => void;
  /** Una decisione alla volta: un doppio clic non scrive due volte la stessa riga. */
  decisioneInCorso: boolean;
  /** Errori di Nominatim consecutivi: un successo o un indirizzo non trovato li azzera. */
  erroriNominatimDiFila: number;
}

/** Evento socket di un import: importPV_<jobId>_progress e importPV_<jobId>_complete. */
export const eventoImportPuntiVendita = (jobId: string, tipo: 'progress' | 'complete') => `importPV_${jobId}_${tipo}`;

/** Dopo tanti errori di fila Nominatim e giu o ci blocca: l'import si ferma invece di proseguire senza coordinate. */
export const MAX_ERRORI_NOMINATIM_DI_FILA = 5;

/** Import fermato perche Nominatim non risponde: la riga indicata non e stata scritta. */
export class NominatimNonRisponde extends Error {
  constructor(readonly riga: number, motivo: string) {
    super(`Import fermato: Nominatim non risponde (${MAX_ERRORI_NOMINATIM_DI_FILA} errori di fila). Ultimo errore: ${motivo}`);
  }
}

/** Errore di una decisione che non si puo applicare (import non in attesa, riga gia decisa). */
export class DecisioneNonApplicabile extends Error {}

// Un job finito resta consultabile per un'ora: chi ricarica la pagina ne vede ancora il riepilogo
const CONSERVAZIONE_JOB_MS = 60 * 60 * 1000;

const copia = (stato: StatoImportPuntiVenditaDTO): StatoImportPuntiVenditaDTO => ({ ...stato, errori: [...stato.errori] });
const attivo = (stato: StatoImportPuntiVenditaDTO) => stato.stato === 'in_corso' || stato.stato === 'in_attesa';

/**
 * Import dei punti vendita in background, una riga alla volta. Sulla riga ambigua
 * (azione revisiona) si ferma in attesa che l'utente la inserisca a mano o la scarti.
 * ponytail: lo stato vive in memoria nel processo che ha ricevuto la richiesta; a un riavvio
 * l'import si interrompe (le righe gia scritte restano, si riconoscono rifacendo l'import).
 */
export class GestoreImportPuntiVendita {
  private jobs = new Map<string, Job>();

  /** Avvia l'import e restituisce subito lo stato iniziale; `fine` si risolve al termine. */
  avvia(
    idGdo: string,
    idUtente: string,
    esiti: EsitoRigaImportPuntoVenditaDTO[],
    operazioni: OperazioniImportPuntiVendita
  ): { stato: StatoImportPuntiVenditaDTO; fine: Promise<StatoImportPuntiVenditaDTO> } {
    const stato: StatoImportPuntiVenditaDTO = {
      jobId: randomUUID(),
      stato: 'in_corso',
      totale: esiti.length,
      elaborate: 0,
      creati: 0,
      aggiornati: 0,
      scartati: 0,
      inseritiAMano: 0,
      soloFp: 0,
      geolocalizzati: 0,
      senzaCoordinate: 0,
      erroriNominatim: 0,
      nonElaborate: esiti.length,
      errori: [],
      avviatoIl: new Date().toISOString(),
    };
    const job: Job = { stato, idGdo, idUtente, annullato: false, operazioni, decisioneInCorso: false, erroriNominatimDiFila: 0 };
    this.jobs.set(stato.jobId, job);
    return { stato: copia(stato), fine: this.esegui(job, esiti) };
  }

  private async esegui(job: Job, esiti: EsitoRigaImportPuntoVenditaDTO[]) {
    const { stato, operazioni } = job;
    const errore = (riga: number, e: unknown) =>
      stato.errori.push({ row: riga, error: e instanceof Error ? e.message : String(e) });
    try {
      for (const esito of esiti) {
        // Lascia passare la richiesta di annullamento anche tra righe che non aspettano niente
        await new Promise(resolve => setImmediate(resolve));
        if (job.annullato) break;
        if (esito.azione === 'scarta') {
          stato.scartati++;
          errore(esito.riga, esito.errore);
        } else if (esito.azione === 'revisiona') {
          await this.attendiDecisione(job, esito);
          if (job.annullato) break;
        } else {
          // Fuori dal try della riga: Nominatim che non risponde ferma l'import, non solo la riga
          const conCoordinate = await this.conCoordinate(job, esito);
          try {
            await this.scrivi(job, conCoordinate);
          } catch (e) {
            log.error('importPV - riga non importata', { riga: esito.riga, error: e });
            stato.scartati++;
            errore(esito.riga, e);
          }
        }
        stato.elaborate++;
        stato.nonElaborate = stato.totale - stato.elaborate;
        operazioni.notifica('progress', copia(stato));
      }
      stato.stato = job.annullato ? 'annullato' : 'completato';
    } catch (e) {
      log.error('importPV - job interrotto', { jobId: stato.jobId, error: e });
      stato.stato = 'errore';
      errore(e instanceof NominatimNonRisponde ? e.riga : 0, e);
    }
    stato.rigaInAttesa = undefined;
    stato.terminatoIl = new Date().toISOString();
    if (stato.creati + stato.aggiornati > 0 && operazioni.alTermine) {
      await operazioni.alTermine(copia(stato)).catch(e => log.warn('importPV - operazioni finali non riuscite', { error: e }));
    }
    log.info('importPV - terminato', { ...stato, errori: stato.errori.length });
    operazioni.notifica('complete', copia(stato));
    setTimeout(() => this.jobs.delete(stato.jobId), CONSERVAZIONE_JOB_MS).unref?.();
    return copia(stato);
  }

  /** Riga automatica senza coordinate: le chiede a Nominatim; se non le trova si importa senza. */
  private async conCoordinate(job: Job, esito: EsitoDaScrivere): Promise<EsitoDaScrivere> {
    const { geocodifica } = job.operazioni;
    if (!geocodifica || coordinateValide(esito.dati.lat, esito.dati.lon)) return esito;
    let trovate: { lat: number; lon: number } | undefined;
    try {
      trovate = await geocodifica(esito.dati);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      log.error('importPV - Nominatim in errore', { jobId: job.stato.jobId, riga: esito.riga, motivo });
      job.stato.erroriNominatim++;
      job.stato.ultimoErroreNominatim = motivo;
      if (++job.erroriNominatimDiFila >= MAX_ERRORI_NOMINATIM_DI_FILA) throw new NominatimNonRisponde(esito.riga, motivo);
      job.stato.senzaCoordinate++;
      job.stato.errori.push({ row: esito.riga, error: `${motivo}: importato senza coordinate` });
      return esito;
    }
    job.erroriNominatimDiFila = 0;
    if (trovate) {
      job.stato.geolocalizzati++;
      return { ...esito, dati: { ...esito.dati, lat: trovate.lat, lon: trovate.lon } };
    }
    job.stato.senzaCoordinate++;
    job.stato.errori.push({ row: esito.riga, error: 'Indirizzo non trovato da Nominatim: importato senza coordinate' });
    return esito;
  }

  private async scrivi(job: Job, esito: EsitoDaScrivere) {
    const esitoScrittura = await job.operazioni.scrivi(esito);
    if (esitoScrittura && !esitoScrittura.sincronizzato) job.stato.soloFp++;
    if (esito.azione === 'aggiorna') job.stato.aggiornati++;
    else job.stato.creati++;
  }

  /** Ferma il ciclo sulla riga finche decidi() o annulla() non lo sbloccano. */
  private attendiDecisione(job: Job, riga: RigaInAttesaImportDTO): Promise<void> {
    return new Promise(resolve => {
      job.stato.stato = 'in_attesa';
      job.stato.rigaInAttesa = riga;
      job.riprendi = () => {
        job.riprendi = undefined;
        job.stato.rigaInAttesa = undefined;
        if (!job.annullato) job.stato.stato = 'in_corso';
        resolve();
      };
      job.operazioni.notifica('progress', copia(job.stato));
    });
  }

  /**
   * Applica la decisione dell'utente sulla riga in attesa e fa ripartire l'import.
   * Se la scrittura fallisce (Istanta rifiuta) l'errore risale e la riga resta in attesa.
   * undefined se il job non esiste o e di un altro utente.
   */
  async decidi(jobId: string, idUtente: string, decisione: DecisioneImportPuntoVenditaDTO): Promise<StatoImportPuntiVenditaDTO | undefined> {
    const job = this.jobs.get(jobId);
    if (!job || job.idUtente !== idUtente) return undefined;
    const riga = job.stato.rigaInAttesa;
    if (job.stato.stato !== 'in_attesa' || !riga || !job.riprendi) throw new DecisioneNonApplicabile("L'import non e in attesa di una decisione");
    if (job.decisioneInCorso) throw new DecisioneNonApplicabile('Decisione gia in corso per questa riga');
    job.decisioneInCorso = true;
    try {
      if (decisione.azione === 'scarta') {
        job.stato.scartati++;
        job.stato.errori.push({ row: riga.riga, error: "Scartata dall'utente" });
      } else {
        await this.scrivi(job, { ...riga, azione: riga.id ? 'aggiorna' : 'crea', dati: decisione.dati as CreatePuntoVenditaDTO });
        job.stato.inseritiAMano++;
      }
      log.info('importPV - decisione sulla riga', { jobId, riga: riga.riga, azione: decisione.azione });
      job.riprendi?.();
      return copia(job.stato);
    } finally {
      job.decisioneInCorso = false;
    }
  }

  /** Stato di un job dell'utente; undefined se non esiste o e di un altro utente. */
  stato(jobId: string, idUtente: string): StatoImportPuntiVenditaDTO | undefined {
    const job = this.jobs.get(jobId);
    return job && job.idUtente === idUtente ? copia(job.stato) : undefined;
  }

  /** Import ancora attivo (in corso o in attesa) sulla GDO: ce n'e al piu uno alla volta. */
  inCorso(idGdo: string): StatoImportPuntiVenditaDTO | undefined {
    const job = [...this.jobs.values()].find(j => j.idGdo === idGdo && attivo(j.stato));
    return job && copia(job.stato);
  }

  /** L'ultimo import avviato dall'utente, per ritrovarlo dopo aver ricaricato la pagina. */
  ultimo(idUtente: string): StatoImportPuntiVenditaDTO | undefined {
    const job = [...this.jobs.values()]
      .filter(j => j.idUtente === idUtente)
      .sort((a, b) => b.stato.avviatoIl.localeCompare(a.stato.avviatoIl))[0];
    return job && copia(job.stato);
  }

  /** Ferma il job dopo la riga in corso, o subito se e in attesa; undefined se il job non e dell'utente. */
  annulla(jobId: string, idUtente: string): StatoImportPuntiVenditaDTO | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.idUtente !== idUtente) return undefined;
    if (attivo(job.stato)) {
      job.annullato = true;
      job.riprendi?.();
    }
    return copia(job.stato);
  }
}

export const importPuntiVenditaJobs = new GestoreImportPuntiVendita();
