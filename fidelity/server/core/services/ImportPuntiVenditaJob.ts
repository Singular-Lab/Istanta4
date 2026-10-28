import { randomUUID } from 'node:crypto';
import type {
  CreatePuntoVenditaDTO,
  DecisioneImportPuntoVenditaDTO,
  EsitoRigaImportPuntoVenditaDTO,
  RigaInAttesaImportDTO,
  StatoImportPuntiVenditaDTO,
} from '../dto';
import { log } from '../logger';
import { STATO_LAVORO } from '../models/lavori_in_background';
import { coordinateValide } from './importPuntiVendita';
import {
  decisionePresa,
  mantieniVivo,
  prenotazioneValida,
  registroLavori,
  type EsitoLavoro,
  type Lavoro,
  type RegistroLavori,
} from './RegistroLavori';

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

/** Scrittura della riga inserita a mano: la fornisce chi riceve la decisione, che puo essere un altro worker. */
export type ScritturaRigaImport = OperazioniImportPuntiVendita['scrivi'];

/** Import eseguito da questo processo: lo stato condiviso fra i worker sta nel registro dei lavori. */
interface Job {
  stato: StatoImportPuntiVenditaDTO;
  idGdo: string;
  idUtente: string;
  annullato: boolean;
  operazioni: OperazioniImportPuntiVendita;
  /** Interrompe la pausa fra due letture del registro: decisione o annullamento arrivati in questo processo. */
  sveglia?: () => void;
  /** Errori di Nominatim consecutivi: un successo o un indirizzo non trovato li azzera. */
  erroriNominatimDiFila: number;
  /** Ultimo salvataggio dell'avanzamento completo nel registro. */
  ultimoSalvataggio: number;
}

export interface OpzioniGestoreImport {
  /** Ogni quanto il job fermo su una riga rilegge il registro per vedere decisione o annullamento. */
  intervalloAttesaMs?: number;
  /** Ogni quanto al piu si salva nel registro l'avanzamento completo; l'annullamento si controlla a ogni riga. */
  intervalloSalvataggioMs?: number;
  /** Oltre questo tempo senza decisione l'import in attesa si annulla da solo e libera la GDO. */
  attesaMassimaMs?: number;
  intervalloBattitoMs?: number;
}

/** Tipo dell'import nel registro dei lavori; la chiave e la GDO: al piu un import per GDO fra tutti i worker. */
export const TIPO_LAVORO_IMPORT_PV = 'import_punti_vendita';

/** Evento socket di un import: importPV_<jobId>_progress e importPV_<jobId>_complete. */
export const eventoImportPuntiVendita = (jobId: string, tipo: 'progress' | 'complete') => `importPV_${jobId}_${tipo}`;

/** Dopo tanti errori di fila Nominatim e giu o ci blocca: l'import si ferma invece di proseguire senza coordinate. */
export const MAX_ERRORI_NOMINATIM_DI_FILA = 5;

/** Import fermo su una riga da piu di tanto: l'utente non tornera, la GDO si libera. */
export const ATTESA_MASSIMA_DECISIONE_MS = 2 * 60 * 60 * 1000;

export const MESSAGGIO_IMPORT_INTERROTTO =
  "Import interrotto: il server che lo eseguiva si e fermato. Le righe gia scritte restano, si riconoscono rifacendo l'import";

/** Import fermato perche Nominatim non risponde: la riga indicata non e stata scritta. */
export class NominatimNonRisponde extends Error {
  constructor(readonly riga: number, motivo: string) {
    super(`Import fermato: Nominatim non risponde (${MAX_ERRORI_NOMINATIM_DI_FILA} errori di fila). Ultimo errore: ${motivo}`);
  }
}

/** Errore di una decisione che non si puo applicare (import non in attesa, riga gia decisa). */
export class DecisioneNonApplicabile extends Error {}

/** Un import e gia attivo sulla GDO (anche in un altro worker): `stato` e il suo. */
export class ImportGiaInCorso extends Error {
  constructor(readonly stato: StatoImportPuntiVenditaDTO) {
    super('Un import dei punti vendita e gia in corso');
  }
}

// Un job finito resta consultabile per un'ora: chi ricarica la pagina ne vede ancora il riepilogo
const CONSERVAZIONE_JOB_MS = 60 * 60 * 1000;
// Lettura del registro durante la pausa: la decisione presa in un altro worker arriva entro un secondo
const INTERVALLO_ATTESA_MS = 1000;
// L'elenco errori cresce con le righe: salvarlo a ogni riga riscriverebbe migliaia di volte lo stesso JSON.
// Lo stato letto da un altro worker resta indietro al piu di tanto; l'utente lo segue comunque via socket.
const INTERVALLO_SALVATAGGIO_MS = 1000;

const ESITO_NEL_REGISTRO: Record<string, EsitoLavoro> = {
  completato: STATO_LAVORO.COMPLETATO,
  annullato: STATO_LAVORO.ANNULLATO,
  errore: STATO_LAVORO.ERRORE,
};

const copia = (stato: StatoImportPuntiVenditaDTO): StatoImportPuntiVenditaDTO => ({ ...stato, errori: [...stato.errori] });
const attivo = (stato: StatoImportPuntiVenditaDTO) => stato.stato === 'in_corso' || stato.stato === 'in_attesa';
const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Stato dell'import dal registro: se il worker che lo eseguiva si e fermato, e un errore e non piu in corso. */
function statoDaLavoro(lavoro: Lavoro<StatoImportPuntiVenditaDTO>): StatoImportPuntiVenditaDTO {
  const stato = copia(lavoro.avanzamento as StatoImportPuntiVenditaDTO);
  if (!lavoro.interrotto) return stato;
  return {
    ...stato,
    stato: 'errore',
    rigaInAttesa: undefined,
    terminatoIl: stato.terminatoIl ?? (lavoro.conclusoIl ?? lavoro.heartbeatAt).toISOString(),
    errori: [...stato.errori, { row: 0, error: MESSAGGIO_IMPORT_INTERROTTO }],
  };
}

/**
 * Import dei punti vendita in background, una riga alla volta. Sulla riga ambigua
 * (azione revisiona) si ferma in attesa che l'utente la inserisca a mano o la scarti.
 * Il ciclo gira nel worker che ha ricevuto l'import; stato, annullamento e decisioni stanno nel
 * registro dei lavori (DB), cosi le richieste successive possono arrivare a un worker qualsiasi.
 * A un riavvio l'import si interrompe: le righe gia scritte restano e si riconoscono rifacendo l'import.
 */
export class GestoreImportPuntiVendita {
  private locali = new Map<string, Job>();
  private readonly intervalloAttesaMs: number;
  private readonly intervalloSalvataggioMs: number;
  private readonly attesaMassimaMs: number;
  private readonly intervalloBattitoMs?: number;

  constructor(private registro: RegistroLavori = registroLavori, opzioni: OpzioniGestoreImport = {}) {
    this.intervalloAttesaMs = opzioni.intervalloAttesaMs ?? INTERVALLO_ATTESA_MS;
    this.intervalloSalvataggioMs = opzioni.intervalloSalvataggioMs ?? INTERVALLO_SALVATAGGIO_MS;
    this.attesaMassimaMs = opzioni.attesaMassimaMs ?? ATTESA_MASSIMA_DECISIONE_MS;
    this.intervalloBattitoMs = opzioni.intervalloBattitoMs;
  }

  /**
   * Avvia l'import e restituisce subito lo stato iniziale; `fine` si risolve al termine.
   * ImportGiaInCorso se sulla GDO ce n'e gia uno attivo, anche avviato da un altro worker.
   */
  async avvia(
    idGdo: string,
    idUtente: string,
    esiti: EsitoRigaImportPuntoVenditaDTO[],
    operazioni: OperazioniImportPuntiVendita
  ): Promise<{ stato: StatoImportPuntiVenditaDTO; fine: Promise<StatoImportPuntiVenditaDTO> }> {
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
    const avvio = await this.registro.avvia<StatoImportPuntiVenditaDTO>({
      id: stato.jobId, tipo: TIPO_LAVORO_IMPORT_PV, chiave: idGdo, idUtente, idGdo, avanzamento: stato,
    });
    if (!avvio.avviato) throw new ImportGiaInCorso(statoDaLavoro(avvio.lavoro));
    const job: Job = { stato, idGdo, idUtente, annullato: false, operazioni, erroriNominatimDiFila: 0, ultimoSalvataggio: Date.now() };
    this.locali.set(stato.jobId, job);
    return { stato: copia(stato), fine: this.esegui(job, esiti) };
  }

  private async esegui(job: Job, esiti: EsitoRigaImportPuntoVenditaDTO[]) {
    const { stato, operazioni } = job;
    // Il battito dice agli altri worker che l'import e vivo anche durante una riga lunga o una pausa
    const fermaBattito = mantieniVivo(this.registro, stato.jobId, this.intervalloBattitoMs);
    const errore = (riga: number, e: unknown) =>
      stato.errori.push({ row: riga, error: messaggio(e) });
    try {
      for (const esito of esiti) {
        // Lascia passare la richiesta di annullamento anche tra righe che non aspettano niente
        await new Promise(resolve => setImmediate(resolve));
        if (job.annullato) break;
        if (esito.azione === 'scarta') {
          stato.scartati++;
          errore(esito.riga, esito.errore);
        } else if (esito.azione === 'revisiona') {
          if ((await this.attendiDecisione(job, esito)) === 'annullata') break;
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
        await this.salva(job);
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
    // Prima l'esito nel registro, poi l'evento: chi rilegge lo stato dopo l'evento trova l'import concluso
    try {
      await this.registro.concludi(stato.jobId, ESITO_NEL_REGISTRO[stato.stato] ?? STATO_LAVORO.ERRORE, {
        avanzamento: copia(stato),
        errore: stato.stato === 'errore' ? stato.errori[stato.errori.length - 1]?.error : undefined,
      });
    } catch (e) {
      log.error('importPV - esito non salvato nel registro dei lavori', { jobId: stato.jobId, error: messaggio(e) });
    }
    fermaBattito();
    this.locali.delete(stato.jobId);
    log.info('importPV - terminato', { ...stato, errori: stato.errori.length });
    operazioni.notifica('complete', copia(stato));
    return copia(stato);
  }

  /** Dopo ogni riga: raccoglie l'annullamento chiesto a un altro worker e, ogni tanto, salva l'avanzamento. */
  private async salva(job: Job) {
    const ora = Date.now();
    const completo = ora - job.ultimoSalvataggio >= this.intervalloSalvataggioMs;
    try {
      const { annullamentoRichiesto } = await this.registro.aggiorna(job.stato.jobId, completo ? copia(job.stato) : undefined);
      if (completo) job.ultimoSalvataggio = ora;
      if (annullamentoRichiesto) job.annullato = true;
    } catch (e) {
      // Un registro momentaneamente irraggiungibile non ferma l'import: il salvataggio successivo recupera
      log.warn('importPV - avanzamento non salvato nel registro dei lavori', { jobId: job.stato.jobId, error: messaggio(e) });
    }
  }

  /** Riga automatica senza coordinate: le chiede a Nominatim; se non le trova si importa senza. */
  private async conCoordinate(job: Job, esito: EsitoDaScrivere): Promise<EsitoDaScrivere> {
    const { geocodifica } = job.operazioni;
    if (!geocodifica || coordinateValide(esito.dati.lat, esito.dati.lon)) return esito;
    let trovate: { lat: number; lon: number } | undefined;
    try {
      trovate = await geocodifica(esito.dati);
    } catch (e) {
      const motivo = messaggio(e);
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

  /**
   * Ferma il ciclo sulla riga finche nel registro non c'e la decisione (presa da questo o da un altro
   * worker) o l'annullamento. Senza decisione entro attesaMassimaMs l'import si annulla: la GDO non resta bloccata.
   */
  private async attendiDecisione(job: Job, riga: RigaInAttesaImportDTO): Promise<'decisa' | 'annullata'> {
    const { stato } = job;
    stato.stato = 'in_attesa';
    stato.rigaInAttesa = riga;
    // Prima il registro, poi l'evento: una decisione inviata appena arriva l'evento trova la riga gia in attesa
    try {
      await this.registro.attendiDecisione(stato.jobId, String(riga.riga), riga, copia(stato));
    } catch (e) {
      log.warn('importPV - attesa non salvata nel registro dei lavori', { jobId: stato.jobId, error: messaggio(e) });
    }
    job.operazioni.notifica('progress', copia(stato));
    const scadenza = Date.now() + this.attesaMassimaMs;
    for (;;) {
      let lavoro: Lavoro<StatoImportPuntiVenditaDTO> | undefined;
      try {
        lavoro = await this.registro.leggi<StatoImportPuntiVenditaDTO>(stato.jobId);
      } catch (e) {
        log.warn("importPV - registro dei lavori non leggibile durante l'attesa", { jobId: stato.jobId, error: messaggio(e) });
        await this.pausa(job);
        continue;
      }
      if (lavoro && decisionePresa(lavoro.decisione)) {
        // Chi ha ricevuto la decisione ha gia scritto la riga e aggiornato i contatori
        Object.assign(stato, lavoro.avanzamento, { stato: 'in_corso', rigaInAttesa: undefined });
        if (lavoro.annullamentoRichiesto) job.annullato = true;
        await this.registro.riprendi(stato.jobId)
          .catch(e => log.warn('importPV - ripresa non salvata nel registro dei lavori', { jobId: stato.jobId, error: messaggio(e) }));
        return 'decisa';
      }
      // Mentre qualcuno applica la decisione (scrittura su Istanta) non ci si ferma: la riga scritta va contata
      if (!lavoro || !prenotazioneValida(lavoro.decisione)) {
        if (!lavoro || job.annullato || lavoro.annullamentoRichiesto) {
          job.annullato = true;
          return 'annullata';
        }
        if (Date.now() >= scadenza) {
          log.warn('importPV - nessuna decisione in tempo, import annullato', { jobId: stato.jobId, riga: riga.riga });
          stato.errori.push({ row: riga.riga, error: `Nessuna decisione sulla riga entro ${Math.round(this.attesaMassimaMs / 60000)} minuti: import annullato` });
          job.annullato = true;
          return 'annullata';
        }
      }
      await this.pausa(job);
    }
  }

  /** Aspetta la prossima lettura del registro, o meno se in questo processo arriva una decisione o un annullamento. */
  private pausa(job: Job): Promise<void> {
    return new Promise(resolve => {
      const fine = () => {
        clearTimeout(timer);
        job.sveglia = undefined;
        resolve();
      };
      const timer = setTimeout(fine, this.intervalloAttesaMs);
      timer.unref?.();
      job.sveglia = fine;
    });
  }

  /**
   * Applica la decisione dell'utente sulla riga in attesa; l'import riprende dalla riga successiva.
   * Funziona da qualsiasi worker: la riga inserita a mano la scrive `scrivi`, con la richiesta di chi
   * ha deciso, cosi l'errore di Istanta risale subito e la riga resta in attesa. La prenotazione nel
   * registro impedisce che un doppio clic o due worker scrivano due volte la stessa riga.
   * undefined se il job non esiste o e di un altro utente.
   */
  async decidi(
    jobId: string,
    idUtente: string,
    decisione: DecisioneImportPuntoVenditaDTO,
    scrivi?: ScritturaRigaImport
  ): Promise<StatoImportPuntiVenditaDTO | undefined> {
    const lavoro = await this.registro.leggi<StatoImportPuntiVenditaDTO>(jobId);
    if (!lavoro || lavoro.tipo !== TIPO_LAVORO_IMPORT_PV || lavoro.idUtente !== idUtente) return undefined;
    const stato = statoDaLavoro(lavoro);
    const riga = stato.rigaInAttesa;
    const attesa = lavoro.attesa;
    if (stato.stato !== 'in_attesa' || !riga || !attesa) throw new DecisioneNonApplicabile("L'import non e in attesa di una decisione");

    // Lo stato che ne risulta: chi esegue l'import lo riprende da qui
    const nuovo: StatoImportPuntiVenditaDTO = { ...stato, errori: [...stato.errori], stato: 'in_corso', rigaInAttesa: undefined };
    if (decisione.azione === 'scarta') {
      nuovo.scartati++;
      nuovo.errori.push({ row: riga.riga, error: "Scartata dall'utente" });
      if (!(await this.registro.registraDecisione(jobId, attesa, { azione: 'scarta' }, nuovo))) {
        throw new DecisioneNonApplicabile('Decisione gia in corso per questa riga');
      }
    } else {
      const locale = this.locali.get(jobId);
      const scrittura: ScritturaRigaImport | undefined = scrivi ?? (locale && (esito => locale.operazioni.scrivi(esito)));
      if (!scrittura) throw new Error('Scrittura della riga non disponibile per la decisione');
      const prenotazione = await this.registro.prenotaDecisione(jobId, attesa);
      if (!prenotazione) throw new DecisioneNonApplicabile('Decisione gia in corso per questa riga');
      try {
        const esitoScrittura = await scrittura({ ...riga, azione: riga.id ? 'aggiorna' : 'crea', dati: decisione.dati as CreatePuntoVenditaDTO });
        if (esitoScrittura && !esitoScrittura.sincronizzato) nuovo.soloFp++;
        if (riga.id) nuovo.aggiornati++;
        else nuovo.creati++;
        nuovo.inseritiAMano++;
      } catch (e) {
        // Istanta ha rifiutato: la riga resta in attesa, l'utente la corregge e riprova
        await this.registro.rilasciaPrenotazione(jobId, attesa, prenotazione)
          .catch(errore => log.warn('importPV - prenotazione della decisione non rilasciata', { jobId, error: messaggio(errore) }));
        throw e;
      }
      if (!(await this.registro.registraDecisione(jobId, attesa, { azione: 'inserisci' }, nuovo, prenotazione))) {
        // Prenotazione scaduta e passata ad altri: la riga e scritta, ma l'import non la conta da qui
        log.warn('importPV - riga inserita ma decisione non registrata', { jobId, riga: riga.riga });
        throw new DecisioneNonApplicabile("L'import non e piu in attesa di questa riga");
      }
    }
    log.info('importPV - decisione sulla riga', { jobId, riga: riga.riga, azione: decisione.azione });
    // Se l'import gira in questo processo riparte subito, senza aspettare la prossima lettura del registro
    this.locali.get(jobId)?.sveglia?.();
    return nuovo;
  }

  /** Stato di un job dell'utente; undefined se non esiste o e di un altro utente. */
  async stato(jobId: string, idUtente: string): Promise<StatoImportPuntiVenditaDTO | undefined> {
    const lavoro = await this.registro.leggi<StatoImportPuntiVenditaDTO>(jobId);
    return lavoro && lavoro.tipo === TIPO_LAVORO_IMPORT_PV && lavoro.idUtente === idUtente ? statoDaLavoro(lavoro) : undefined;
  }

  /** Import ancora attivo (in corso o in attesa) sulla GDO: ce n'e al piu uno alla volta. */
  async inCorso(idGdo: string): Promise<StatoImportPuntiVenditaDTO | undefined> {
    const lavoro = await this.registro.attivo<StatoImportPuntiVenditaDTO>(TIPO_LAVORO_IMPORT_PV, idGdo);
    return lavoro && statoDaLavoro(lavoro);
  }

  /** L'ultimo import avviato dall'utente, per ritrovarlo dopo aver ricaricato la pagina. */
  async ultimo(idUtente: string): Promise<StatoImportPuntiVenditaDTO | undefined> {
    const lavoro = await this.registro.ultimo<StatoImportPuntiVenditaDTO>(TIPO_LAVORO_IMPORT_PV, { idUtente });
    if (!lavoro) return undefined;
    // Come quando lo stato viveva in memoria: un import finito si ritrova per un'ora
    const finitoIl = (lavoro.conclusoIl ?? lavoro.heartbeatAt).getTime();
    if (!lavoro.attivo && Date.now() - finitoIl > CONSERVAZIONE_JOB_MS) return undefined;
    return statoDaLavoro(lavoro);
  }

  /** Ferma il job dopo la riga in corso, o subito se e in attesa; undefined se il job non e dell'utente. */
  async annulla(jobId: string, idUtente: string): Promise<StatoImportPuntiVenditaDTO | undefined> {
    const locale = this.locali.get(jobId);
    if (locale && locale.idUtente === idUtente && attivo(locale.stato)) {
      // Nel processo che esegue l'import l'annullamento vale subito, senza aspettare la rilettura del registro
      locale.annullato = true;
      locale.sveglia?.();
    }
    const lavoro = await this.registro.leggi<StatoImportPuntiVenditaDTO>(jobId);
    if (!lavoro || lavoro.tipo !== TIPO_LAVORO_IMPORT_PV || lavoro.idUtente !== idUtente) return undefined;
    if (lavoro.attivo) await this.registro.richiediAnnullamento(jobId);
    return statoDaLavoro(lavoro);
  }
}

export const importPuntiVenditaJobs = new GestoreImportPuntiVendita();
