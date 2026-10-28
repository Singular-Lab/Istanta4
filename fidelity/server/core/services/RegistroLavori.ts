import { randomUUID } from 'node:crypto';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import {
  LavoroInBackground,
  STATI_LAVORO_ATTIVI,
  STATO_LAVORO,
  type LavoroInBackgroundAttributes,
  type StatoLavoro,
} from '../models/lavori_in_background';

/**
 * Registro dei lavori in background, condiviso fra i worker del cluster tramite il DB.
 * Il lavoro gira nel worker che l'ha avviato; stato, annullamento e decisioni passano di qui,
 * cosi una richiesta che arriva a un altro worker li vede e li puo cambiare.
 */

/** Senza battito da tanto il processo che eseguiva il lavoro si e fermato: il lavoro e interrotto e non blocca piu. */
export const SCADENZA_BATTITO_MS = 2 * 60 * 1000;
/** Ogni quanto chi esegue un lavoro ne rinnova il battito: ben sotto la scadenza, anche se un passo dura a lungo. */
export const INTERVALLO_BATTITO_MS = 30 * 1000;
/** Una decisione prenotata e mai registrata (il worker si e fermato a meta) dopo questo tempo si puo riprendere. */
export const SCADENZA_PRENOTAZIONE_MS = 2 * 60 * 1000;
/** I lavori conclusi da piu di tanto si cancellano: servono solo a ritrovare l'esito nei giorni successivi. */
export const CONSERVAZIONE_LAVORI_GIORNI = 30;
const INTERVALLO_PULIZIA_MS = 24 * 60 * 60 * 1000;
const GIORNO_MS = 24 * 60 * 60 * 1000;

export const MESSAGGIO_LAVORO_INTERROTTO = 'Il server che eseguiva il lavoro si e fermato prima di concluderlo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EsitoLavoro = typeof STATO_LAVORO.COMPLETATO | typeof STATO_LAVORO.ANNULLATO | typeof STATO_LAVORO.ERRORE;

export interface Lavoro<A = any, R = any> {
  id: string;
  tipo: string;
  chiave: string;
  idUtente: string | null;
  idGdo: string | null;
  stato: StatoLavoro;
  /** In corso o in attesa, con battito recente: blocca un altro lavoro con lo stesso tipo e chiave. */
  attivo: boolean;
  /** Il processo che lo eseguiva si e fermato: avanzamento e l'ultimo salvato. */
  interrotto: boolean;
  avanzamento: A | null;
  attesa: string | null;
  richiestaDecisione: unknown;
  decisione: unknown;
  annullamentoRichiesto: boolean;
  risultato: R | null;
  errore: string | null;
  heartbeatAt: Date;
  avviatoIl: Date;
  conclusoIl: Date | null;
}

export interface NuovoLavoro<A = any> {
  /** Facoltativo: serve quando l'avanzamento iniziale contiene gia l'id (es. il jobId dell'import). */
  id?: string;
  tipo: string;
  chiave: string;
  idUtente?: string | null;
  idGdo?: string | null;
  avanzamento?: A;
}

/** avviato false: c'era gia un lavoro attivo con lo stesso tipo e chiave, ed e quello restituito. */
export interface AvvioLavoro<A = any> {
  avviato: boolean;
  lavoro: Lavoro<A>;
}

/** Decisione prenotata da chi la sta applicando (es. scrittura su Istanta in corso), non ancora registrata. */
interface Prenotazione {
  prenotazione: string;
  il: string;
}

export const ePrenotazione = (decisione: unknown): decisione is Prenotazione =>
  typeof decisione === 'object' && decisione !== null && typeof (decisione as Prenotazione).prenotazione === 'string';

/** Prenotazione ancora valida: chi esegue il lavoro aspetta che venga registrata o rilasciata. */
export const prenotazioneValida = (decisione: unknown, ora = Date.now()): boolean =>
  ePrenotazione(decisione) && ora - Date.parse(decisione.il) < SCADENZA_PRENOTAZIONE_MS;

/** Decisione registrata, pronta per chi esegue il lavoro. */
export const decisionePresa = (decisione: unknown): boolean => decisione != null && !ePrenotazione(decisione);

/** Da una riga del registro al lavoro: attivo e interrotto dipendono dall'eta del battito. */
export function lavoroDaRiga<A = any, R = any>(riga: LavoroInBackgroundAttributes, ora = Date.now()): Lavoro<A, R> {
  const heartbeatAt = new Date(riga.heartbeat_at);
  const inStatoAttivo = STATI_LAVORO_ATTIVI.includes(riga.stato);
  const senzaBattito = inStatoAttivo && ora - heartbeatAt.getTime() > SCADENZA_BATTITO_MS;
  return {
    id: riga.id,
    tipo: riga.tipo,
    chiave: riga.chiave,
    idUtente: riga.id_utente ?? null,
    idGdo: riga.id_gdo ?? null,
    stato: riga.stato,
    attivo: inStatoAttivo && !senzaBattito,
    interrotto: riga.stato === STATO_LAVORO.INTERROTTO || senzaBattito,
    avanzamento: riga.avanzamento ?? null,
    attesa: riga.attesa ?? null,
    richiestaDecisione: riga.richiesta_decisione ?? null,
    decisione: riga.decisione ?? null,
    annullamentoRichiesto: Boolean(riga.annullamento_richiesto),
    risultato: riga.risultato ?? null,
    errore: riga.errore ?? null,
    heartbeatAt,
    avviatoIl: new Date(riga.createdat ?? riga.heartbeat_at),
    conclusoIl: riga.concluso_at ? new Date(riga.concluso_at) : null,
  };
}

export interface RegistroLavori {
  /** Registra un lavoro nuovo, a meno che ce ne sia gia uno attivo con lo stesso tipo e chiave (anche in un altro worker). */
  avvia<A>(nuovo: NuovoLavoro<A>): Promise<AvvioLavoro<A>>;
  leggi<A = any, R = any>(id: string): Promise<Lavoro<A, R> | undefined>;
  /** Il lavoro attivo con quel tipo e chiave; uno senza battito non conta. */
  attivo<A = any>(tipo: string, chiave: string): Promise<Lavoro<A> | undefined>;
  /** L'ultimo lavoro avviato di quel tipo, per chiave o per utente. */
  ultimo<A = any, R = any>(tipo: string, filtro: { chiave?: string; idUtente?: string }): Promise<Lavoro<A, R> | undefined>;
  /**
   * Rinnova il battito e, se indicato, salva l'avanzamento; dice se nel frattempo e stato chiesto l'annullamento.
   * Senza avanzamento la query resta piccola: serve a controllare l'annullamento a ogni passo.
   */
  aggiorna<A>(id: string, avanzamento?: A): Promise<{ annullamentoRichiesto: boolean }>;
  /** Rinnova il battito di un lavoro attivo. */
  battito(id: string): Promise<void>;
  /** Il lavoro si ferma sulla richiesta `attesa` finche qualcuno non registra una decisione. */
  attendiDecisione<A>(id: string, attesa: string, richiesta: unknown, avanzamento: A): Promise<void>;
  /**
   * Prenota la decisione sulla richiesta in attesa, prima di applicarla (es. scrivere su Istanta):
   * un secondo clic o un altro worker non la applicano due volte. undefined se gia presa o prenotata.
   */
  prenotaDecisione(id: string, attesa: string): Promise<string | undefined>;
  /** Applicazione fallita: la richiesta torna libera per un nuovo tentativo. */
  rilasciaPrenotazione(id: string, attesa: string, prenotazione: string): Promise<void>;
  /**
   * Registra la decisione e l'avanzamento che ne risulta, solo se il lavoro aspetta ancora quella richiesta
   * (e, con `prenotazione`, se la prenotazione e ancora quella). false se non applicabile.
   */
  registraDecisione<A>(id: string, attesa: string, decisione: unknown, avanzamento: A, prenotazione?: string): Promise<boolean>;
  /** Chi esegue il lavoro ha letto la decisione: libera la richiesta e prosegue. */
  riprendi(id: string): Promise<void>;
  /** Chiede a chi esegue il lavoro di fermarsi; false se il lavoro non e piu attivo. */
  richiediAnnullamento(id: string): Promise<boolean>;
  concludi<A = any, R = any>(id: string, stato: EsitoLavoro, esito: { avanzamento?: A; risultato?: R; errore?: string }): Promise<void>;
  /** Cancella i lavori conclusi (o fermi) da piu di `giorni`; restituisce quanti. */
  pulisci(giorni?: number): Promise<number>;
}

const limiteBattito = () => new Date(Date.now() - SCADENZA_BATTITO_MS);
// findByPk/findOne con raw restituiscono oggetti semplici, create un'istanza
const piana = (riga: any): LavoroInBackgroundAttributes => (typeof riga?.get === 'function' ? riga.get({ plain: true }) : riga);

export class RegistroLavoriDb implements RegistroLavori {
  private ultimaPulizia = 0;

  async avvia<A>(nuovo: NuovoLavoro<A>): Promise<AvvioLavoro<A>> {
    const avvio = await sequelize.transaction(async (t) => {
      // Lock su tipo e chiave: due avvii concorrenti, anche da worker diversi, non creano due lavori attivi
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:chiave))', {
        replacements: { chiave: `lavori:${nuovo.tipo}:${nuovo.chiave}` },
        type: QueryTypes.SELECT,
        transaction: t,
      });
      const righe = await LavoroInBackground.findAll({
        where: { tipo: nuovo.tipo, chiave: nuovo.chiave, stato: { [Op.in]: STATI_LAVORO_ATTIVI } },
        order: [['createdat', 'DESC']],
        raw: true,
        transaction: t,
      });
      const attivi = righe.map(riga => lavoroDaRiga<A>(piana(riga)));
      const inCorso = attivi.find(lavoro => lavoro.attivo);
      if (inCorso) return { avviato: false, lavoro: inCorso };

      if (attivi.length > 0) {
        // Senza battito da troppo: li ha lasciati un processo che si e fermato, non bloccano piu
        await LavoroInBackground.update(
          { stato: STATO_LAVORO.INTERROTTO, errore: MESSAGGIO_LAVORO_INTERROTTO, concluso_at: new Date() },
          {
            where: { id: { [Op.in]: attivi.map(lavoro => lavoro.id) }, stato: { [Op.in]: STATI_LAVORO_ATTIVI }, heartbeat_at: { [Op.lt]: limiteBattito() } },
            transaction: t,
          }
        );
      }
      const creato = await LavoroInBackground.create({
        ...(nuovo.id ? { id: nuovo.id } : {}),
        tipo: nuovo.tipo,
        chiave: nuovo.chiave,
        id_utente: nuovo.idUtente ?? null,
        id_gdo: nuovo.idGdo ?? null,
        stato: STATO_LAVORO.IN_CORSO,
        avanzamento: nuovo.avanzamento ?? null,
        annullamento_richiesto: false,
        heartbeat_at: new Date(),
      }, { transaction: t });
      return { avviato: true, lavoro: lavoroDaRiga<A>(piana(creato)) };
    });
    if (avvio.avviato) this.pulisciOgniTanto();
    return avvio;
  }

  async leggi<A = any, R = any>(id: string): Promise<Lavoro<A, R> | undefined> {
    // Un id che non e un UUID non esiste: niente errore di cast di Postgres (il client riceve 404, non 500)
    if (!UUID.test(id)) return undefined;
    const riga = await LavoroInBackground.findByPk(id, { raw: true });
    return riga ? lavoroDaRiga<A, R>(piana(riga)) : undefined;
  }

  async attivo<A = any>(tipo: string, chiave: string): Promise<Lavoro<A> | undefined> {
    const riga = await LavoroInBackground.findOne({
      where: { tipo, chiave, stato: { [Op.in]: STATI_LAVORO_ATTIVI }, heartbeat_at: { [Op.gte]: limiteBattito() } },
      order: [['createdat', 'DESC']],
      raw: true,
    });
    return riga ? lavoroDaRiga<A>(piana(riga)) : undefined;
  }

  async ultimo<A = any, R = any>(tipo: string, filtro: { chiave?: string; idUtente?: string }): Promise<Lavoro<A, R> | undefined> {
    const where = {
      tipo,
      ...(filtro.chiave !== undefined ? { chiave: filtro.chiave } : {}),
      ...(filtro.idUtente !== undefined ? { id_utente: filtro.idUtente } : {}),
    };
    const riga = await LavoroInBackground.findOne({ where, order: [['createdat', 'DESC']], raw: true });
    return riga ? lavoroDaRiga<A, R>(piana(riga)) : undefined;
  }

  async aggiorna<A>(id: string, avanzamento?: A): Promise<{ annullamentoRichiesto: boolean }> {
    const [, righe] = await LavoroInBackground.update(
      avanzamento === undefined ? { heartbeat_at: new Date() } : { avanzamento, heartbeat_at: new Date() },
      { where: { id }, returning: ['annullamento_richiesto'] }
    );
    return { annullamentoRichiesto: Boolean(righe?.[0] && piana(righe[0]).annullamento_richiesto) };
  }

  async battito(id: string): Promise<void> {
    await LavoroInBackground.update({ heartbeat_at: new Date() }, { where: { id, stato: { [Op.in]: STATI_LAVORO_ATTIVI } } });
  }

  async attendiDecisione<A>(id: string, attesa: string, richiesta: unknown, avanzamento: A): Promise<void> {
    await LavoroInBackground.update(
      { stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa, richiesta_decisione: richiesta, decisione: null, avanzamento, heartbeat_at: new Date() },
      { where: { id, stato: { [Op.in]: STATI_LAVORO_ATTIVI } } }
    );
  }

  async prenotaDecisione(id: string, attesa: string): Promise<string | undefined> {
    const lavoro = await this.leggi(id);
    if (!lavoro || lavoro.stato !== STATO_LAVORO.IN_ATTESA_DECISIONE || lavoro.attesa !== attesa) return undefined;
    // Compare-and-set: libera, oppure con una prenotazione scaduta di cui si conosce il codice
    let decisioneAttuale: Record<string, unknown> | null;
    if (lavoro.decisione == null) decisioneAttuale = null;
    else if (ePrenotazione(lavoro.decisione) && !prenotazioneValida(lavoro.decisione)) decisioneAttuale = { prenotazione: lavoro.decisione.prenotazione };
    else return undefined;

    const prenotazione = randomUUID();
    const [aggiornati] = await LavoroInBackground.update(
      { decisione: { prenotazione, il: new Date().toISOString() } },
      { where: { id, stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa, decisione: decisioneAttuale } }
    );
    return aggiornati === 1 ? prenotazione : undefined;
  }

  async rilasciaPrenotazione(id: string, attesa: string, prenotazione: string): Promise<void> {
    await LavoroInBackground.update({ decisione: null }, { where: { id, attesa, decisione: { prenotazione } } });
  }

  async registraDecisione<A>(id: string, attesa: string, decisione: unknown, avanzamento: A, prenotazione?: string): Promise<boolean> {
    const [aggiornati] = await LavoroInBackground.update(
      { stato: STATO_LAVORO.IN_CORSO, decisione, avanzamento, richiesta_decisione: null },
      { where: { id, stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa, decisione: prenotazione ? { prenotazione } : null } }
    );
    return aggiornati === 1;
  }

  async riprendi(id: string): Promise<void> {
    await LavoroInBackground.update(
      { attesa: null, richiesta_decisione: null, decisione: null },
      { where: { id, stato: STATO_LAVORO.IN_CORSO } }
    );
  }

  async richiediAnnullamento(id: string): Promise<boolean> {
    const [aggiornati] = await LavoroInBackground.update(
      { annullamento_richiesto: true },
      { where: { id, stato: { [Op.in]: STATI_LAVORO_ATTIVI } } }
    );
    return aggiornati === 1;
  }

  async concludi<A = any, R = any>(id: string, stato: EsitoLavoro, esito: { avanzamento?: A; risultato?: R; errore?: string }): Promise<void> {
    await LavoroInBackground.update({
      stato,
      concluso_at: new Date(),
      attesa: null,
      richiesta_decisione: null,
      decisione: null,
      ...(esito.avanzamento !== undefined ? { avanzamento: esito.avanzamento } : {}),
      risultato: esito.risultato ?? null,
      errore: esito.errore ?? null,
    }, { where: { id } });
  }

  async pulisci(giorni = CONSERVAZIONE_LAVORI_GIORNI): Promise<number> {
    const limite = new Date(Date.now() - giorni * GIORNO_MS);
    return LavoroInBackground.destroy({
      where: {
        [Op.or]: [
          { concluso_at: { [Op.lt]: limite } },
          { stato: { [Op.in]: STATI_LAVORO_ATTIVI }, heartbeat_at: { [Op.lt]: limite } },
        ],
      },
    });
  }

  // Al piu una volta al giorno per processo, dopo un avvio: niente cron per una tabella che cresce piano
  private pulisciOgniTanto() {
    if (Date.now() - this.ultimaPulizia < INTERVALLO_PULIZIA_MS) return;
    this.ultimaPulizia = Date.now();
    this.pulisci().catch(error => log.warn('Pulizia dei lavori in background non riuscita', { error: error instanceof Error ? error.message : String(error) }));
  }
}

/**
 * Rinnova il battito del lavoro finche non viene chiamata la funzione restituita.
 * Indipendente dall'avanzamento: un passo lungo (una chiamata a Olimpo) non fa sembrare il lavoro interrotto.
 */
export function mantieniVivo(registro: RegistroLavori, id: string, intervalloMs = INTERVALLO_BATTITO_MS): () => void {
  const timer = setInterval(() => {
    registro.battito(id).catch(error =>
      log.warn('Battito del lavoro in background non registrato', { id, error: error instanceof Error ? error.message : String(error) })
    );
  }, intervalloMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export const registroLavori: RegistroLavori = new RegistroLavoriDb();
