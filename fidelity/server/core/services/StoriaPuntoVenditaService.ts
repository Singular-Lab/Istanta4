import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
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
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const abbinatore = new AbbinatorePuntiVendita(await this.repository.puntiVenditaGdo(idGdo));
    const cambi: CambioAbbinamento[] = [];
    for (const riga of righe) {
      const trovato = abbinatore.abbina({
        localita: riga.localita,
        chiaveIndirizzo: riga.chiave_indirizzo,
        chiaveTelefono: riga.chiave_telefono,
      });
      const idPuntoVendita = trovato?.idPuntoVendita ?? null;
      const abbinamento = trovato?.tipo ?? null;
      if (idPuntoVendita !== riga.id_punto_vendita || abbinamento !== riga.abbinamento) {
        cambi.push({ id: riga.id, idPuntoVendita, abbinamento });
      }
    }
    await this.repository.aggiornaAbbinamenti(cambi);
    if (cambi.length > 0) log.info('Storia PV: righe dei volantini riabbinate', { idGdo, esaminate: righe.length, cambiate: cambi.length });
    return { esaminate: righe.length, cambiate: cambi.length };
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
