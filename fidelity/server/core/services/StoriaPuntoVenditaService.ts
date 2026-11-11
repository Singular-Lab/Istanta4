import { HttpStatusCode, STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../lib/enums';
import { ApplicationError, BadRequestError, NotFoundError } from '../../../lib/errors';
import type {
  EsitoCollegamento,
  EsitoScollegamento,
  PaginaCollegamentiManuali,
  RichiestaCambioCollegamento,
  RichiestaCollegamento,
} from '../../../lib/puntiVendita/analisi';
import {
  DIMENSIONI_PAGINA_STORIA,
  type EsitoFileExport,
  type EsitoImportExport,
  type PaginaVolantiniStoria,
  type RiferimentoStoria,
  type StoriaPuntoVendita,
} from '../../../lib/puntiVendita/storia';
import type {
  EsitoListaVolantino,
  FileExportPlugin,
  IStoriaPuntoVenditaService,
  ListaVolantinoDaRegistrare,
  OpzioniRiabbinamento,
} from '../interfaces/IStoriaPuntoVenditaService';
import { log } from '../logger';
import type {
  CambioAbbinamento,
  IPuntiVenditaVolantinoRepository,
  KitVolantino,
  PuntoVenditaDellaStoria,
} from '../repositories/PuntiVenditaVolantinoRepository';
import { AbbinatorePuntiVendita } from '../utils/abbinamentoPuntiVendita';
import {
  chiaviRigaVolantino,
  raggruppaPerChiavi,
  type RegolaCollegamento,
  RegoleCollegamento,
  type RigaConChiavi,
} from '../utils/chiaviRigheVolantino';
import { chiaveCombinazione } from '../utils/confrontoPuntiVendita';
import { type VoceListaPuntiVendita, vociDelVolantino } from '../utils/listaPuntiVenditaVolantino';
import { chiaveIndirizzo, chiaveTelefono } from '../utils/puntoVenditaNormalization';
import { calcolaStoria, ultimaApparizione } from '../utils/storiaPuntoVendita';
import { importPuntiVenditaJobs } from './ImportPuntiVenditaJob';

/**
 * La storia dei punti vendita dalle liste stampate nei volantini (contratto in
 * lib/puntiVendita/storia.ts): registrazione delle liste (sync del Plugin ed export JSON),
 * abbinamento delle righe all'anagrafica e letture per la scheda del punto vendita.
 *
 * L'anagrafica non si tocca mai. Le righe senza PV si riabbinano quando l'anagrafica cambia: dopo
 * una lista nuova, dopo il salvataggio di un PV (pianificaRiabbinamento, raccolto per GDO) e alla
 * fine dell'import Excel dei PV. Le righe gia' collegate a un PV restano sue anche se il PV cambia
 * indirizzo, telefono o insegna: e' proprio la sua storia. Si scollegano solo se il PV si elimina
 * (ON DELETE SET NULL), e il riabbinamento successivo le puo' collegare a un altro.
 * Un riabbinamento che fallisce si scrive nel log e basta.
 *
 * Dalla gestione dei punti vendita si collegano a mano le righe non abbinate (collega): il
 * collegamento si salva come regola della GDO (abbinamenti_manuali_pv_volantino) e il
 * riabbinamento la applica prima delle regole automatiche, anche alle righe riscritte da una nuova
 * sincronizzazione del kit. Annullato il collegamento (scollega), le sue righe si riabbinano.
 * Un collegamento fatto a mano vale solo per le righe dei volantini con la combinazione canale/area
 * del suo PV, e si fa solo verso un PV con la combinazione di uno dei volantini della riga.
 * Dalla verifica dei collegamenti si cambia il PV di un gruppo di righe, anche abbinato
 * automaticamente (cambiaCollegamento): diventa un collegamento fatto a mano.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Una chiave di RigaNonAbbinata e' corta: oltre questa lunghezza la richiesta non e' valida. */
const MASSIMA_LUNGHEZZA_CHIAVE = 1000;

/** Attesa prima di un riabbinamento pianificato: i salvataggi che arrivano intanto si uniscono. */
export const ATTESA_RIABBINAMENTO_MS = 2000;

export const MOTIVI_SCARTO_EXPORT = {
  NON_JSON: 'Sono accettati solo gli export .json del Plugin',
  JSON_NON_VALIDO: 'Il file non contiene un JSON valido',
  NON_EXPORT: "Il file non e' un export del Plugin",
  SENZA_KIT: "Manca l'id del kit (kitGuidId)",
  SENZA_PROMO: "Manca l'id della promo (promoId)",
  SENZA_AREA: "Manca l'id dell'area (areaId)",
  SENZA_CANALE: "Manca l'id del canale (canaleId)",
  KIT_NON_TROVATO: 'Kit non trovato fra quelli della GDO',
  KIT_ELIMINATO: "Il kit e' eliminato",
  PROMO_DIVERSA: "La promo dell'export non e' quella del kit",
  LISTA_VUOTA: 'Nessun punto vendita nella lista del volantino',
  ERRORE: 'Registrazione non riuscita: riprovare il file',
} as const;

export interface OpzioniStoriaPuntoVendita {
  attesaRiabbinamentoMs?: number;
  /**
   * Vero se la GDO ha un import Excel dei PV in corso in questo processo: i salvataggi dei PV non
   * riabbinano riga per riga, lo fa l'import quando finisce.
   */
  rinvia?: (idGdo: string) => boolean;
}

const messaggio = (errore: unknown): string => (errore instanceof Error ? errore.message : String(errore));

/** Le chiavi di una riga del repository, con la combinazione del suo kit. */
const chiaviDi = (riga: { riga: string; localita: string | null; chiave_indirizzo: string | null; chiave_telefono: string | null; id_canale: string | null; id_area: string | null }): RigaConChiavi => ({
  riga: riga.riga,
  localita: riga.localita,
  chiaveIndirizzo: riga.chiave_indirizzo,
  chiaveTelefono: riga.chiave_telefono,
  combinazione: chiaveCombinazione(riga.id_canale, riga.id_area),
});

/**
 * Per le righe gia' collegate a mano a un PV, il collegamento di quel PV che le riconosce, senza
 * guardare la combinazione: anche le righe collegate prima del vincolo su canale e area si contano
 * e si scollegano con il loro collegamento.
 */
class CollegamentiPerPuntoVendita {
  private readonly perPuntoVendita = new Map<string, RegoleCollegamento>();

  constructor(regole: readonly RegolaCollegamento[]) {
    const raggruppate = new Map<string, RegolaCollegamento[]>();
    for (const regola of regole) raggruppate.set(regola.idPuntoVendita, [...(raggruppate.get(regola.idPuntoVendita) ?? []), { ...regola, combinazione: null }]);
    for (const [idPuntoVendita, delPuntoVendita] of raggruppate) this.perPuntoVendita.set(idPuntoVendita, new RegoleCollegamento(delPuntoVendita));
  }

  per(riga: RigaConChiavi & { idPuntoVendita: string }): RegolaCollegamento | null {
    return this.perPuntoVendita.get(riga.idPuntoVendita)?.per({ ...riga, combinazione: undefined }) ?? null;
  }
}

/** Il PV non ha la combinazione di nessuno dei volantini delle righe: 422 con le combinazioni. */
function combinazioneDiversa(puntoVendita: PuntoVenditaDellaStoria, combinazioniRighe: readonly string[], nomi: { canali: ReadonlyMap<string, string>; aree: ReadonlyMap<string, string> }): ApplicationError {
  const nome = (combinazione: string) => {
    const [canale, area] = combinazione.split('|');
    return `${nomi.canali.get(canale) ?? 'canale sconosciuto'} · ${nomi.aree.get(area) ?? 'area sconosciuta'}`;
  };
  const delPuntoVendita = `${puntoVendita.nomeCanale ?? 'canale sconosciuto'} · ${puntoVendita.nomeArea ?? 'area sconosciuta'}`;
  const deiVolantini = combinazioniRighe.map(nome).join(', ');
  return new ApplicationError({
    name: 'CombinazioneDiversaError',
    code: 'COMBINAZIONE_DIVERSA',
    message: `Il punto vendita è di ${delPuntoVendita}, ma la riga è nei volantini di ${deiVolantini}: si collega solo a un punto vendita dello stesso canale e della stessa area`,
    httpStatus: HttpStatusCode.UNPROCESSABLE_ENTITY,
    details: { puntoVendita: delPuntoVendita, volantini: combinazioniRighe.map(nome) },
  });
}
const stessoId = (a: unknown, b: string): boolean => typeof a === 'string' && a.trim().toLowerCase() === b.toLowerCase();
const presente = (valore: unknown): boolean => typeof valore === 'string' && valore.trim() !== '';

export class StoriaPuntoVenditaService implements IStoriaPuntoVenditaService {
  private readonly attesaRiabbinamentoMs: number;
  private readonly rinvia: (idGdo: string) => boolean;
  /** Riabbinamenti pianificati, per GDO: il timer, o undefined se rimandato alla fine dell'import Excel. */
  private readonly inAttesa = new Map<string, ReturnType<typeof setTimeout> | undefined>();
  /** Ultimo riabbinamento avviato per GDO: il successivo parte quando questo finisce. */
  private readonly inCorso = new Map<string, Promise<unknown>>();

  constructor(private readonly repository: IPuntiVenditaVolantinoRepository, opzioni: OpzioniStoriaPuntoVendita = {}) {
    this.attesaRiabbinamentoMs = opzioni.attesaRiabbinamentoMs ?? ATTESA_RIABBINAMENTO_MS;
    this.rinvia = opzioni.rinvia ?? (idGdo => importPuntiVenditaJobs.inCorsoQui(idGdo));
  }

  // ─── Registrazione delle liste ─────────────────────────────────────

  async registraListaVolantino(lista: ListaVolantinoDaRegistrare): Promise<EsitoListaVolantino> {
    const voci = vociDelVolantino(lista);
    // Una lista vuota non cancella quella gia' registrata: e' piu' probabile un riquadro non trovato
    if (voci.length === 0) return { registrata: false, righe: 0, abbinate: 0, nonAbbinate: 0 };

    const kit = UUID.test(lista.idKit) ? await this.repository.trovaKit(lista.idKit) : null;
    if (!kit) throw new NotFoundError({ message: 'Kit runtime non trovato', entityType: 'RuntimeKit', entityId: lista.idKit });
    const idGdo = kit.idGdo ?? lista.idGdoRiserva ?? null;
    if (!idGdo) throw new BadRequestError({ message: `GDO del kit ${kit.id} non trovata: lista dei punti vendita non registrata` });

    await this.scriviRighe(kit, idGdo, voci, lista.nomeFile ?? null);
    // L'anagrafica non e' cambiata: basta abbinare le righe nuove
    await this.riabbinaSenzaErrori(idGdo, { soloKit: [kit.id] });
    const { righe, abbinate } = await this.repository.contaRigheKit(kit.id);
    return { registrata: true, righe, abbinate, nonAbbinate: righe - abbinate };
  }

  private async scriviRighe(kit: KitVolantino, idGdo: string, voci: VoceListaPuntiVendita[], nomeFile: string | null): Promise<void> {
    await this.repository.sostituisciRigheKit(kit.id, voci.map(voce => ({
      id_gdo: idGdo,
      id_kit_runtime: kit.id,
      id_promo: kit.idPromo,
      id_canale: kit.idCanale,
      id_area: kit.idArea,
      nome_file: nomeFile,
      posizione: voce.posizione,
      riga: voce.riga,
      regione: voce.regione,
      provincia: voce.provincia,
      gruppo: voce.gruppo,
      localita: voce.localita,
      indirizzo: voce.indirizzo,
      telefono: voce.telefono,
      chiave_indirizzo: chiaveIndirizzo(voce.indirizzo),
      chiave_telefono: chiaveTelefono(voce.telefono),
    })));
  }

  // ─── Riabbinamento ─────────────────────────────────────────────────

  riabbina(idGdo: string, opzioni: OpzioniRiabbinamento = {}): Promise<{ esaminate: number; cambiate: number }> {
    // Un riabbinamento di tutta la GDO assorbe quello pianificato
    if (!opzioni.soloKit) this.annullaPianificato(idGdo);
    const precedente = this.inCorso.get(idGdo) ?? Promise.resolve();
    const esecuzione = precedente.catch(() => undefined).then(() => this.eseguiRiabbinamento(idGdo, opzioni.soloKit));
    this.inCorso.set(idGdo, esecuzione);
    void esecuzione
      .finally(() => {
        if (this.inCorso.get(idGdo) === esecuzione) this.inCorso.delete(idGdo);
      })
      .catch(() => undefined);
    return esecuzione;
  }

  pianificaRiabbinamento(idGdo: string): void {
    try {
      if (!idGdo) return;
      this.annullaPianificato(idGdo);
      // Durante l'import Excel della GDO si riabbina una volta sola, alla fine
      if (this.rinvia(idGdo)) return;
      const timer = setTimeout(() => {
        void this.riabbinaSenzaErrori(idGdo);
      }, this.attesaRiabbinamentoMs);
      timer.unref?.();
      this.inAttesa.set(idGdo, timer);
    } catch (errore) {
      log.warn('Storia PV: riabbinamento non pianificato', { idGdo, errore: messaggio(errore) });
    }
  }

  private annullaPianificato(idGdo: string): void {
    const timer = this.inAttesa.get(idGdo);
    if (timer) clearTimeout(timer);
    this.inAttesa.delete(idGdo);
  }

  private async riabbinaSenzaErrori(idGdo: string, opzioni: OpzioniRiabbinamento = {}): Promise<void> {
    try {
      await this.riabbina(idGdo, opzioni);
    } catch (errore) {
      log.warn('Storia PV: riabbinamento delle righe dei volantini non riuscito', { idGdo, errore: messaggio(errore) });
    }
  }

  private async eseguiRiabbinamento(idGdo: string, soloKit?: readonly string[]): Promise<{ esaminate: number; cambiate: number }> {
    // Solo righe senza PV: quelle collegate restano al loro PV
    const righe = await this.repository.righeDaRiabbinare(idGdo, soloKit);
    if (righe.length === 0) return { esaminate: 0, cambiate: 0 };
    const [puntiVendita, regoleSalvate] = await Promise.all([
      this.repository.puntiVenditaGdo(idGdo),
      this.repository.regoleCollegamento(idGdo),
    ]);
    const abbinatore = new AbbinatorePuntiVendita(puntiVendita);
    const { manuali, imparate } = this.applicaCollegamenti(righe.map(riga => ({ id: riga.id, chiavi: chiaviDi(riga) })), regoleSalvate);
    const cambi: CambioAbbinamento[] = [];
    for (const riga of righe) {
      // I collegamenti fatti a mano vengono prima delle regole automatiche
      const trovato = manuali.get(riga.id) ?? abbinatore.abbina(chiaviDi(riga));
      const idPuntoVendita = trovato?.idPuntoVendita ?? null;
      const abbinamento = trovato?.tipo ?? null;
      if (idPuntoVendita !== riga.id_punto_vendita || abbinamento !== riga.abbinamento) {
        cambi.push({ id: riga.id, idPuntoVendita, abbinamento });
      }
    }
    await this.repository.aggiornaAbbinamenti(cambi);
    for (const [idCollegamento, chiavi] of imparate) await this.repository.aggiungiChiaviCollegamento(idCollegamento, chiavi);
    if (cambi.length > 0) log.info('Storia PV: righe dei volantini riabbinate', { idGdo, esaminate: righe.length, cambiate: cambi.length });
    return { esaminate: righe.length, cambiate: cambi.length };
  }

  /**
   * Le righe che i collegamenti fatti a mano riconoscono, e le chiavi nuove che i collegamenti
   * imparano da quelle righe. Si ripete finche' una chiave imparata riconosce altre righe: un
   * negozio stampato col vecchio telefono e il nuovo indirizzo collega anche le righe col solo
   * indirizzo nuovo, in qualunque ordine arrivino.
   */
  private applicaCollegamenti(
    righe: ReadonlyArray<{ id: string; chiavi: RigaConChiavi }>,
    regoleSalvate: readonly RegolaCollegamento[],
  ): { manuali: Map<string, { idPuntoVendita: string; tipo: 'manuale' }>; imparate: Map<string, string[]> } {
    const manuali = new Map<string, { idPuntoVendita: string; tipo: 'manuale' }>();
    const imparate = new Map<string, string[]>();
    const regole = new RegoleCollegamento(regoleSalvate);
    let daEsaminare = [...righe];
    let ancora = !regole.vuote;
    while (ancora) {
      ancora = false;
      const restanti: typeof daEsaminare = [];
      for (const riga of daEsaminare) {
        const regola = regole.per(riga.chiavi);
        if (!regola) {
          restanti.push(riga);
          continue;
        }
        manuali.set(riga.id, { idPuntoVendita: regola.idPuntoVendita, tipo: 'manuale' });
        const nuove = regole.impara(regola, riga.chiavi);
        if (nuove.length > 0) {
          imparate.set(regola.id, [...(imparate.get(regola.id) ?? []), ...nuove]);
          ancora = true;
        }
      }
      daEsaminare = restanti;
    }
    return { manuali, imparate };
  }

  // ─── Letture ───────────────────────────────────────────────────────

  /** Il PV, se esiste ed e' della GDO indicata: un PV di un'altra GDO risponde come inesistente. */
  private async puntoVenditaDellaGdo(idPuntoVendita: string, idGdo: string | null): Promise<PuntoVenditaDellaStoria> {
    const puntoVendita = UUID.test(idPuntoVendita) ? await this.repository.trovaPuntoVendita(idPuntoVendita) : null;
    if (!puntoVendita || (idGdo !== null && puntoVendita.idGdo !== idGdo)) {
      throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: idPuntoVendita });
    }
    return puntoVendita;
  }

  async getStoria(idPuntoVendita: string, idGdo: string | null): Promise<StoriaPuntoVendita> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const apparizioni = await this.repository.apparizioni(puntoVendita.id);
    const ultima = ultimaApparizione(apparizioni);
    const volantiniSenza = ultima
      ? await this.repository.volantiniSenzaPuntoVendita({
        idPuntoVendita: puntoVendita.id,
        idGdo: puntoVendita.idGdo,
        idCanale: ultima.canale.id,
        idArea: ultima.area.id,
        dopo: ultima.data,
      })
      : [];
    return calcolaStoria(puntoVendita, apparizioni, volantiniSenza);
  }

  async getVolantini(idPuntoVendita: string, idGdo: string | null, pagina = 1, dimensione = DIMENSIONI_PAGINA_STORIA[0]): Promise<PaginaVolantiniStoria> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const perPagina = DIMENSIONI_PAGINA_STORIA.includes(dimensione) ? dimensione : DIMENSIONI_PAGINA_STORIA[0];
    const numeroPagina = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
    const { volantini, totale } = await this.repository.paginaVolantini(puntoVendita.id, perPagina, (numeroPagina - 1) * perPagina);
    return { volantini, totale, pagina: numeroPagina, dimensione: perPagina };
  }

  // ─── Collegamenti fatti a mano ─────────────────────────────────────

  async collega(idGdo: string, richiesta: unknown, idUtente: string | null): Promise<EsitoCollegamento> {
    const { chiave, idPuntoVendita } = (richiesta ?? {}) as Partial<Record<keyof RichiestaCollegamento, unknown>>;
    if (typeof chiave !== 'string' || chiave.trim() === '' || chiave.length > MASSIMA_LUNGHEZZA_CHIAVE) {
      throw new BadRequestError({ message: 'Riga da collegare non indicata (chiave)' });
    }
    if (typeof idPuntoVendita !== 'string' || !UUID.test(idPuntoVendita)) {
      throw new BadRequestError({ message: 'Punto vendita da collegare non indicato (idPuntoVendita)' });
    }
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);

    // Il gruppo di righe senza PV che ha quella chiave, come nell'elenco delle righe non abbinate
    const righe = await this.repository.righeDaRiabbinare(idGdo);
    const gruppo = raggruppaPerChiavi(righe.map(chiaviDi)).find(candidato => candidato.chiavi.includes(chiave));
    if (!gruppo) {
      throw new ApplicationError({
        name: 'RigaGiaAbbinataError',
        code: 'RIGA_VOLANTINO_GIA_ABBINATA',
        message: "La riga non e' piu' fra quelle non abbinate: ricarica l'elenco",
        httpStatus: HttpStatusCode.CONFLICT,
        details: { chiave },
      });
    }

    await this.verificaCombinazione(idGdo, puntoVendita, gruppo.righe);

    const idCollegamento = await this.repository.creaCollegamento({
      idGdo,
      idPuntoVendita: puntoVendita.id,
      chiavi: gruppo.chiavi,
      riga: gruppo.righe[gruppo.righe.length - 1].riga,
      creatoDa: idUtente,
    });
    log.info('Storia PV: righe dei volantini collegate a mano', { idGdo, idPuntoVendita: puntoVendita.id, idCollegamento, righe: gruppo.righe.length });
    // Il riabbinamento applica il collegamento a tutte le righe senza PV con quelle chiavi
    await this.riabbina(idGdo);
    return { idCollegamento, righe: await this.righeDelCollegamento(idGdo, puntoVendita.id, idCollegamento, gruppo.chiavi) };
  }

  /** Le righe collegate a mano al PV grazie al collegamento, con le chiavi che ha imparato riabbinando. */
  private async righeDelCollegamento(idGdo: string, idPuntoVendita: string, idCollegamento: string, chiavi: readonly string[]): Promise<number> {
    const salvato = await this.repository.trovaCollegamento(idCollegamento);
    const regola = new CollegamentiPerPuntoVendita([salvato ?? { id: idCollegamento, idPuntoVendita, chiavi, creatoIl: new Date() }]);
    const collegate = await this.repository.righeCollegateAMano(idGdo, idPuntoVendita);
    return collegate.filter(riga => regola.per(riga)?.id === idCollegamento).length;
  }

  /** 422 se il PV non ha la combinazione di nessuna delle righe; righe senza canale o area non vincolano. */
  private async verificaCombinazione(idGdo: string, puntoVendita: PuntoVenditaDellaStoria, righe: readonly RigaConChiavi[]): Promise<void> {
    const combinazioni = [...new Set(righe.map(riga => riga.combinazione).filter((combinazione): combinazione is string => !!combinazione))];
    if (combinazioni.length === 0) return;
    const delPuntoVendita = chiaveCombinazione(puntoVendita.idCanale, puntoVendita.idArea);
    if (delPuntoVendita && combinazioni.includes(delPuntoVendita)) return;
    throw combinazioneDiversa(puntoVendita, combinazioni, await this.repository.nomiCanaliAree(idGdo));
  }

  async cambiaCollegamento(idGdo: string, richiesta: unknown, idUtente: string | null): Promise<EsitoCollegamento> {
    const { chiave, idPuntoVenditaAttuale, idPuntoVendita } = (richiesta ?? {}) as Partial<Record<keyof RichiestaCambioCollegamento, unknown>>;
    if (typeof chiave !== 'string' || chiave.trim() === '' || chiave.length > MASSIMA_LUNGHEZZA_CHIAVE) {
      throw new BadRequestError({ message: 'Righe da collegare non indicate (chiave)' });
    }
    if (typeof idPuntoVenditaAttuale !== 'string' || !UUID.test(idPuntoVenditaAttuale)) {
      throw new BadRequestError({ message: 'Punto vendita collegato oggi non indicato (idPuntoVenditaAttuale)' });
    }
    if (typeof idPuntoVendita !== 'string' || !UUID.test(idPuntoVendita)) {
      throw new BadRequestError({ message: 'Punto vendita da collegare non indicato (idPuntoVendita)' });
    }
    if (idPuntoVendita.toLowerCase() === idPuntoVenditaAttuale.toLowerCase()) {
      throw new BadRequestError({ message: "Le righe sono gia' collegate a questo punto vendita" });
    }
    const nuovo = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);

    // Il gruppo di righe collegate oggi al PV che ha quella chiave, come nella verifica dei collegamenti
    const righe = await this.repository.righeDelPuntoVendita(idGdo, idPuntoVenditaAttuale);
    const gruppo = raggruppaPerChiavi(righe).find(candidato => candidato.chiavi.includes(chiave));
    if (!gruppo) {
      throw new ApplicationError({
        name: 'CollegamentoCambiatoError',
        code: 'COLLEGAMENTO_CAMBIATO',
        message: "Le righe non sono piu' collegate a quel punto vendita: ricarica la verifica",
        httpStatus: HttpStatusCode.CONFLICT,
        details: { chiave, idPuntoVenditaAttuale },
      });
    }
    await this.verificaCombinazione(idGdo, nuovo, gruppo.righe);

    // Il collegamento fatto a mano del gruppo (anche piu' d'uno) diventa uno solo, con tutte le chiavi
    const chiaviGruppo = new Set(gruppo.chiavi);
    const esistenti = (await this.repository.regoleCollegamento(idGdo))
      .filter(regola => regola.idPuntoVendita.toLowerCase() === idPuntoVenditaAttuale.toLowerCase() && regola.chiavi.some(c => chiaviGruppo.has(c)))
      .sort((a, b) => new Date(b.creatoIl).getTime() - new Date(a.creatoIl).getTime());
    const chiavi = [...new Set([...gruppo.chiavi, ...esistenti.flatMap(regola => regola.chiavi)])].sort();

    // Le righe del PV con una di quelle chiavi: vanno al nuovo PV se sono della sua combinazione, le altre tornano all'abbinamento automatico
    const insieme = new Set(chiavi);
    const combinazioneNuovo = chiaveCombinazione(nuovo.idCanale, nuovo.idArea);
    const cambi: CambioAbbinamento[] = righe
      .filter(riga => chiaviRigaVolantino(riga).some(c => insieme.has(c)))
      .map(riga => (riga.combinazione === null || riga.combinazione === combinazioneNuovo
        ? { id: riga.id, idPuntoVendita: nuovo.id, abbinamento: 'manuale' as const }
        : { id: riga.id, idPuntoVendita: null, abbinamento: null }));

    const idCollegamento = await this.repository.cambiaCollegamento({
      idCollegamento: esistenti[0]?.id ?? null,
      daEliminare: esistenti.slice(1).map(regola => regola.id),
      idGdo,
      idPuntoVendita: nuovo.id,
      chiavi,
      riga: gruppo.righe[gruppo.righe.length - 1].riga,
      creatoDa: idUtente,
      cambi,
    });
    log.info('Storia PV: collegamento cambiato', {
      idGdo, idCollegamento, da: idPuntoVenditaAttuale, a: nuovo.id, righe: cambi.filter(cambio => cambio.idPuntoVendita).length,
    });
    // Le righe tornate senza PV si riabbinano con gli altri collegamenti o con le regole automatiche
    await this.riabbina(idGdo);
    return { idCollegamento, righe: cambi.filter(cambio => cambio.idPuntoVendita).length };
  }

  async collegamenti(idGdo: string, pagina = 1, dimensione = DIMENSIONI_PAGINA_STORIA[0]): Promise<PaginaCollegamentiManuali> {
    const perPagina = DIMENSIONI_PAGINA_STORIA.includes(dimensione) ? dimensione : DIMENSIONI_PAGINA_STORIA[0];
    const numeroPagina = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
    const [{ collegamenti, totale }, regole, collegate] = await Promise.all([
      this.repository.paginaCollegamenti(idGdo, perPagina, (numeroPagina - 1) * perPagina),
      this.repository.regoleCollegamento(idGdo),
      this.repository.righeCollegateAMano(idGdo),
    ]);
    // Ogni riga collegata a mano conta sotto il collegamento del suo PV che oggi la riconosce
    const indice = new CollegamentiPerPuntoVendita(regole);
    const righePerCollegamento = new Map<string, number>();
    for (const riga of collegate) {
      const regola = indice.per(riga);
      if (regola) righePerCollegamento.set(regola.id, (righePerCollegamento.get(regola.id) ?? 0) + 1);
    }
    return {
      collegamenti: collegamenti.map(collegamento => ({
        id: collegamento.id,
        riga: collegamento.riga,
        puntoVendita: collegamento.puntoVendita,
        righe: righePerCollegamento.get(collegamento.id) ?? 0,
        creatoIl: collegamento.creatoIl,
      })),
      totale,
      pagina: numeroPagina,
      dimensione: perPagina,
    };
  }

  async scollega(idGdo: string, idCollegamento: string): Promise<EsitoScollegamento> {
    const collegamento = UUID.test(idCollegamento) ? await this.repository.trovaCollegamento(idCollegamento) : null;
    if (!collegamento || collegamento.idGdo !== idGdo) {
      throw new NotFoundError({ message: 'Collegamento non trovato', entityType: 'CollegamentoPuntoVendita', entityId: idCollegamento });
    }
    await this.repository.eliminaCollegamento(collegamento.id);
    // Le righe di quel PV collegate a mano con le chiavi del collegamento tornano senza PV...
    const regola = new CollegamentiPerPuntoVendita([collegamento]);
    const daScollegare = (await this.repository.righeCollegateAMano(idGdo, collegamento.idPuntoVendita)).filter(riga => regola.per(riga));
    await this.repository.aggiornaAbbinamenti(daScollegare.map(riga => ({ id: riga.id, idPuntoVendita: null, abbinamento: null })));
    log.info('Storia PV: collegamento fatto a mano annullato', { idGdo, idCollegamento: collegamento.id, righe: daScollegare.length });
    // ...e il riabbinamento le ricollega con gli altri collegamenti o con le regole automatiche
    await this.riabbina(idGdo);
    return { righe: daScollegare.length };
  }

  // ─── Export JSON del Plugin ────────────────────────────────────────

  async importaExport(file: readonly FileExportPlugin[], idGdo: string): Promise<EsitoImportExport> {
    const esiti: Array<{ esito: EsitoFileExport; idKit?: string }> = [];
    for (const singolo of file) {
      try {
        esiti.push(await this.registraExport(singolo, idGdo));
      } catch (errore) {
        log.warn('Storia PV: export del Plugin non registrato', { nomeFile: singolo.nomeFile, errore: messaggio(errore) });
        esiti.push({ esito: { nomeFile: singolo.nomeFile, esito: 'scartato', motivo: MOTIVI_SCARTO_EXPORT.ERRORE, righe: 0, abbinate: 0 } });
      }
    }

    const registrati = esiti.filter(voce => voce.idKit !== undefined);
    if (registrati.length > 0) {
      // Un solo riabbinamento per le righe di tutti i file, poi i conteggi di ogni kit
      await this.riabbinaSenzaErrori(idGdo, { soloKit: [...new Set(registrati.map(voce => voce.idKit as string))] });
      for (const { esito, idKit } of registrati) {
        try {
          const conteggio = await this.repository.contaRigheKit(idKit as string);
          esito.righe = conteggio.righe;
          esito.abbinate = conteggio.abbinate;
        } catch (errore) {
          log.warn('Storia PV: righe del kit non contate', { idKit, errore: messaggio(errore) });
        }
      }
    }

    const elenco = esiti.map(({ esito }) => esito);
    const ok = elenco.filter(esito => esito.esito === 'registrato');
    return {
      file: elenco,
      registrati: ok.length,
      scartati: elenco.length - ok.length,
      righe: ok.reduce((totale, esito) => totale + esito.righe, 0),
      abbinate: ok.reduce((totale, esito) => totale + esito.abbinate, 0),
    };
  }

  /** Un export: stesse verifiche del sync del Plugin sul kit, poi solo la lista dei PV. Mai referenze, PDF o anagrafica. */
  private async registraExport(file: FileExportPlugin, idGdo: string): Promise<{ esito: EsitoFileExport; idKit?: string }> {
    const { nomeFile } = file;
    const scarta = (motivo: string, riferimenti: { promo?: RiferimentoStoria; kit?: RiferimentoStoria } = {}) => ({
      esito: { nomeFile, esito: 'scartato' as const, motivo, ...riferimenti, righe: 0, abbinate: 0 },
    });
    if (!/\.json$/i.test(nomeFile)) return scarta(MOTIVI_SCARTO_EXPORT.NON_JSON);

    let payload: unknown;
    try {
      payload = JSON.parse(await file.leggi());
    } catch {
      return scarta(MOTIVI_SCARTO_EXPORT.JSON_NON_VALIDO);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return scarta(MOTIVI_SCARTO_EXPORT.NON_EXPORT);
    const { kitGuidId, promoId, areaId, canaleId, pv, pvData, fileName } = payload as Record<string, unknown>;
    if (typeof kitGuidId !== 'string' || !UUID.test(kitGuidId.trim())) return scarta(MOTIVI_SCARTO_EXPORT.SENZA_KIT);
    if (!presente(promoId)) return scarta(MOTIVI_SCARTO_EXPORT.SENZA_PROMO);
    if (!presente(areaId)) return scarta(MOTIVI_SCARTO_EXPORT.SENZA_AREA);
    if (!presente(canaleId)) return scarta(MOTIVI_SCARTO_EXPORT.SENZA_CANALE);

    const kit = await this.repository.trovaKit(kitGuidId.trim());
    // Un kit di un'altra GDO risponde come inesistente
    if (!kit || kit.idGdo !== idGdo) return scarta(MOTIVI_SCARTO_EXPORT.KIT_NON_TROVATO);
    const riferimenti = { promo: { id: kit.idPromo, nome: kit.nomePromo ?? '' }, kit: { id: kit.id, nome: kit.titolo } };
    if (kit.statoLavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO) return scarta(MOTIVI_SCARTO_EXPORT.KIT_ELIMINATO, riferimenti);
    if (!stessoId(promoId, kit.idPromo)) return scarta(MOTIVI_SCARTO_EXPORT.PROMO_DIVERSA, riferimenti);
    if (!stessoId(areaId, kit.idArea) || !stessoId(canaleId, kit.idCanale)) {
      return scarta(`Il kit appartiene ad area/canale ${kit.idArea}/${kit.idCanale}, non a ${String(areaId)}/${String(canaleId)}`, riferimenti);
    }

    const voci = vociDelVolantino({ pv, pvData });
    // Come nel sync: una lista vuota non tocca le righe gia' registrate del kit
    if (voci.length === 0) return scarta(MOTIVI_SCARTO_EXPORT.LISTA_VUOTA, riferimenti);
    await this.scriviRighe(kit, idGdo, voci, presente(fileName) ? String(fileName).trim() : nomeFile);
    return { esito: { nomeFile, esito: 'registrato', ...riferimenti, righe: voci.length, abbinate: 0 }, idKit: kit.id };
  }
}
