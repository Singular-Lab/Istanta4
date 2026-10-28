import { randomUUID } from 'node:crypto';
import { STATI_LAVORO_ATTIVI, STATO_LAVORO, type LavoroInBackgroundAttributes } from '../core/models/lavori_in_background';
import {
  ePrenotazione,
  lavoroDaRiga,
  MESSAGGIO_LAVORO_INTERROTTO,
  prenotazioneValida,
  SCADENZA_BATTITO_MS,
  type AvvioLavoro,
  type EsitoLavoro,
  type Lavoro,
  type NuovoLavoro,
  type RegistroLavori,
} from '../core/services/RegistroLavori';

/**
 * Registro dei lavori in memoria, con le stesse regole di RegistroLavoriDb (tabella lavori_in_background).
 * Due gestori o servizi che condividono la stessa istanza simulano due worker del cluster che
 * condividono il DB. I valori passano da JSON come nelle colonne JSONB: nessun riferimento condiviso.
 */
export class RegistroLavoriInMemoria implements RegistroLavori {
  readonly righe = new Map<string, LavoroInBackgroundAttributes>();
  private ordine = new Map<string, number>();
  private progressivo = 0;

  /** Simula un worker fermo: il battito del lavoro e vecchio di `ms`. */
  invecchiaBattito(id: string, ms = SCADENZA_BATTITO_MS + 1000) {
    const riga = this.righe.get(id);
    if (riga) riga.heartbeat_at = new Date(Date.now() - ms);
  }

  async avvia<A>(nuovo: NuovoLavoro<A>): Promise<AvvioLavoro<A>> {
    const attivi = this.ordinate()
      .filter(r => r.tipo === nuovo.tipo && r.chiave === nuovo.chiave && STATI_LAVORO_ATTIVI.includes(r.stato));
    const inCorso = attivi.map(r => lavoroDaRiga<A>(json(r))).find(l => l.attivo);
    if (inCorso) return { avviato: false, lavoro: inCorso };
    for (const riga of attivi) {
      Object.assign(riga, { stato: STATO_LAVORO.INTERROTTO, errore: MESSAGGIO_LAVORO_INTERROTTO, concluso_at: new Date() });
    }
    const ora = new Date();
    const riga: LavoroInBackgroundAttributes = {
      id: nuovo.id ?? randomUUID(),
      tipo: nuovo.tipo,
      chiave: nuovo.chiave,
      id_utente: nuovo.idUtente ?? null,
      id_gdo: nuovo.idGdo ?? null,
      stato: STATO_LAVORO.IN_CORSO,
      avanzamento: json(nuovo.avanzamento),
      attesa: null,
      richiesta_decisione: null,
      decisione: null,
      annullamento_richiesto: false,
      risultato: null,
      errore: null,
      heartbeat_at: ora,
      concluso_at: null,
      createdat: ora,
      updatedat: ora,
    };
    this.righe.set(riga.id, riga);
    this.ordine.set(riga.id, this.progressivo++);
    return { avviato: true, lavoro: lavoroDaRiga<A>(json(riga)) };
  }

  async leggi<A = any, R = any>(id: string): Promise<Lavoro<A, R> | undefined> {
    const riga = this.righe.get(id);
    return riga ? lavoroDaRiga<A, R>(json(riga)) : undefined;
  }

  async attivo<A = any>(tipo: string, chiave: string): Promise<Lavoro<A> | undefined> {
    return this.ordinate()
      .filter(r => r.tipo === tipo && r.chiave === chiave)
      .map(r => lavoroDaRiga<A>(json(r)))
      .find(l => l.attivo);
  }

  async ultimo<A = any, R = any>(tipo: string, filtro: { chiave?: string; idUtente?: string }): Promise<Lavoro<A, R> | undefined> {
    const riga = this.ordinate().find(r =>
      r.tipo === tipo
      && (filtro.chiave === undefined || r.chiave === filtro.chiave)
      && (filtro.idUtente === undefined || r.id_utente === filtro.idUtente)
    );
    return riga ? lavoroDaRiga<A, R>(json(riga)) : undefined;
  }

  async aggiorna<A>(id: string, avanzamento?: A): Promise<{ annullamentoRichiesto: boolean }> {
    const riga = this.righe.get(id);
    if (!riga) return { annullamentoRichiesto: false };
    this.scrivi(riga, avanzamento === undefined ? { heartbeat_at: new Date() } : { avanzamento: json(avanzamento), heartbeat_at: new Date() });
    return { annullamentoRichiesto: riga.annullamento_richiesto };
  }

  async battito(id: string): Promise<void> {
    const riga = this.righe.get(id);
    if (riga && STATI_LAVORO_ATTIVI.includes(riga.stato)) this.scrivi(riga, { heartbeat_at: new Date() });
  }

  async attendiDecisione<A>(id: string, attesa: string, richiesta: unknown, avanzamento: A): Promise<void> {
    const riga = this.righe.get(id);
    if (!riga || !STATI_LAVORO_ATTIVI.includes(riga.stato)) return;
    this.scrivi(riga, {
      stato: STATO_LAVORO.IN_ATTESA_DECISIONE, attesa, richiesta_decisione: json(richiesta), decisione: null,
      avanzamento: json(avanzamento), heartbeat_at: new Date(),
    });
  }

  async prenotaDecisione(id: string, attesa: string): Promise<string | undefined> {
    const riga = this.righe.get(id);
    if (!riga || riga.stato !== STATO_LAVORO.IN_ATTESA_DECISIONE || riga.attesa !== attesa) return undefined;
    const libera = riga.decisione == null || (ePrenotazione(riga.decisione) && !prenotazioneValida(riga.decisione));
    if (!libera) return undefined;
    const prenotazione = randomUUID();
    this.scrivi(riga, { decisione: { prenotazione, il: new Date().toISOString() } });
    return prenotazione;
  }

  async rilasciaPrenotazione(id: string, attesa: string, prenotazione: string): Promise<void> {
    const riga = this.righe.get(id);
    if (riga && riga.attesa === attesa && ePrenotazione(riga.decisione) && riga.decisione.prenotazione === prenotazione) {
      this.scrivi(riga, { decisione: null });
    }
  }

  async registraDecisione<A>(id: string, attesa: string, decisione: unknown, avanzamento: A, prenotazione?: string): Promise<boolean> {
    const riga = this.righe.get(id);
    if (!riga || riga.stato !== STATO_LAVORO.IN_ATTESA_DECISIONE || riga.attesa !== attesa) return false;
    const corrisponde = prenotazione
      ? ePrenotazione(riga.decisione) && riga.decisione.prenotazione === prenotazione
      : riga.decisione == null;
    if (!corrisponde) return false;
    this.scrivi(riga, { stato: STATO_LAVORO.IN_CORSO, decisione: json(decisione), avanzamento: json(avanzamento), richiesta_decisione: null });
    return true;
  }

  async riprendi(id: string): Promise<void> {
    const riga = this.righe.get(id);
    if (riga && riga.stato === STATO_LAVORO.IN_CORSO) this.scrivi(riga, { attesa: null, richiesta_decisione: null, decisione: null });
  }

  async richiediAnnullamento(id: string): Promise<boolean> {
    const riga = this.righe.get(id);
    if (!riga || !STATI_LAVORO_ATTIVI.includes(riga.stato)) return false;
    this.scrivi(riga, { annullamento_richiesto: true });
    return true;
  }

  async concludi<A = any, R = any>(id: string, stato: EsitoLavoro, esito: { avanzamento?: A; risultato?: R; errore?: string }): Promise<void> {
    const riga = this.righe.get(id);
    if (!riga) return;
    this.scrivi(riga, {
      stato, concluso_at: new Date(), attesa: null, richiesta_decisione: null, decisione: null,
      ...(esito.avanzamento !== undefined ? { avanzamento: json(esito.avanzamento) } : {}),
      risultato: json(esito.risultato), errore: esito.errore ?? null,
    });
  }

  async pulisci(): Promise<number> {
    return 0;
  }

  private scrivi(riga: LavoroInBackgroundAttributes, valori: Partial<LavoroInBackgroundAttributes>) {
    Object.assign(riga, valori, { updatedat: new Date() });
  }

  /** Dal piu recente, come ORDER BY createdat DESC. */
  private ordinate() {
    return [...this.righe.values()].sort((a, b) => (this.ordine.get(b.id) ?? 0) - (this.ordine.get(a.id) ?? 0));
  }
}

/** Come una colonna JSONB: undefined diventa null, le proprieta undefined spariscono. */
function json<T>(valore: T): T {
  return valore === undefined ? null : JSON.parse(JSON.stringify(valore));
}
