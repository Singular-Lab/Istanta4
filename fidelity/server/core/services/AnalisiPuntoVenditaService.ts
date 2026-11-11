import type {
  AnalisiPuntoVendita,
  CorrezionePosizione,
  DettaglioReferenzaPv,
  DettaglioVolantinoPv,
  EsitoVerifica,
  PaginaRigheNonAbbinate,
  PaginaVerificaCollegamenti,
  PosizioneRiga,
  QualitaPuntiVendita,
  ReteInsegne,
  TipoCollegamento,
  VolantiniRigaNonAbbinata,
} from '../../../lib/puntiVendita/analisi';
import { ESITI_VERIFICA } from '../../../lib/puntiVendita/analisi';
import { DIMENSIONI_PAGINA_STORIA } from '../../../lib/puntiVendita/storia';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import type { IAnalisiPuntoVenditaService } from '../interfaces/IAnalisiPuntoVenditaService';
import type { IConfigService } from '../interfaces/IConfigService';
import { log } from '../logger';
import type { IAnalisiPuntiVenditaRepository } from '../repositories/AnalisiPuntiVenditaRepository';
import type { EsitoRicercaPosizione, IPosizioniRigheRepository } from '../repositories/PosizioniRigheRepository';
import type { IPuntiVenditaVolantinoRepository, PuntoVenditaDellaStoria } from '../repositories/PuntiVenditaVolantinoRepository';
import { AGGREGATI_VUOTI, type AggregatiKit, boxDelKit, riassumiKit } from '../utils/analisiKit';
import { AnalisiKitService, CHIAVE_PRODOTTO, leggiReferenzeKit as leggi } from './AnalisiKitService';
import {
  calcolaAnalisiPuntoVendita,
  calcolaReteInsegne,
  chiaveDescrizione,
  coperturaDi,
  coppieDaDescrivere,
  descrizioniRicorrenti,
  dettaglioReferenza,
  type EdizionePuntoVendita,
  edizioniDelPuntoVendita,
  kitDaDescrivere,
  MARCHE_IN_EVIDENZA,
  NUMERO_PRODOTTI_RICORRENTI,
  numeroPagine,
  pagineDelVolantino,
  presenzeDelProdotto,
  rigaDelPuntoVendita,
  scontoMedio,
  SOGLIA_PRODOTTO_FREQUENTE,
  spazioPerMeccanica,
} from '../utils/analisiPuntoVendita';
import { leggiAnagraficaReparti, type RepartoAnagrafica } from '../utils/campiInsights';
import { chiavePosizione, localitaDaCercare } from '../utils/confrontoPuntiVendita';
import {
  MINUTI_DISPOSITIVO_OFFLINE,
  raggruppaRigheNonAbbinate,
  type RigaSenzaPuntoVendita,
  righeDaRevisionare,
  volantiniDelGruppo,
} from '../utils/gestionePuntiVendita';
import { contaPerEsito, verificaCollegamenti } from '../utils/verificaCollegamenti';
import { coordinateValide } from './importPuntiVendita';
import type { IndirizzoDaCercare } from './PosizioniRigheJob';
import { type FonteRepartiGdo, type RisolutoreReparti, SENZA_REPARTI_GDO } from '../utils/repartiGdo';
import { caricaRisolutoreReparti } from './risolutoreRepartiGdo';

/**
 * Le pagine del punto vendita costruite sulla timeline dei volantini (contratto in
 * lib/puntiVendita/analisi.ts): scheda del PV, volantino, referenza, rete per insegna e qualita'
 * dei dati nella gestione.
 *
 * I volantini del PV sono le sue apparizioni nelle liste (storia del PV, stessi kit validi e stessa
 * data dell'edizione). Ogni kit ha il suo riepilogo in analisi_kit; quelli che mancano o non valgono
 * piu' si calcolano dalle referenze, a blocchi, e si salvano prima di rispondere (AnalisiKitService,
 * condiviso con il viaggio del prodotto negli insight del volantino): prodotti e marche si aggregano
 * in SQL sui riepiloghi salvati. La prima scheda di un PV con molti volantini mai letti e' lenta, le
 * altre (e quelle dei PV con gli stessi volantini) no. Un salvataggio che non riesce fa fallire la
 * richiesta: senza, le statistiche dei prodotti sarebbero incomplete.
 *
 * Della scheda escono dal database solo gli aggregati di ogni kit, i risultati delle aggregazioni
 * e le descrizioni dei prodotti ricorrenti (un PV con 250 volantini: qualche centinaio di KB).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kit le cui referenze si leggono in una volta quando i riepiloghi mancano (ora in AnalisiKitService). */
export { KIT_PER_LETTURA } from './AnalisiKitService';

export interface OpzioniAnalisiPuntoVendita {
  /** Il campo dei meta con cui la GDO riconosce i suoi PV (agenzia lib, import dei PV); senza, conta se i meta sono vuoti. */
  chiaveMetaPuntoVendita?: string | null;
  /** Il giorno di oggi nel calendario di Roma (YYYY-MM-DD). */
  oggi?: () => string;
  /** Reparti salvati della GDO (Impostazioni GDO): nome per il marketing dei reparti dei riepiloghi. */
  repartiGdo?: FonteRepartiGdo;
  /** La config degli insight della GDO, per l'anagrafica dei reparti. */
  configInsight?: Pick<IConfigService, 'getFlyerInsightsConfig'>;
  /** Le posizioni delle righe dei volantini; senza, nessuna posizione e nessuna correzione. */
  posizioni?: IPosizioniRigheRepository;
  /** I collegamenti fatti a mano, per la verifica; senza, nessun collegamento si può annullare dalla verifica. */
  collegamenti?: Pick<IPuntiVenditaVolantinoRepository, 'regoleCollegamento'>;
}

/** Filtri della verifica dei collegamenti. */
export interface FiltriVerifica {
  esito?: unknown;
  tipo?: unknown;
  pagina?: number;
  dimensione?: number;
}

/** Senza repository delle posizioni (prove): nessuna posizione. */
const SENZA_POSIZIONI: IPosizioniRigheRepository = {
  posizioni: async () => new Map(),
  salvaRicerca: async () => undefined,
  correggi: async () => {
    throw new BadRequestError({ message: 'Posizioni delle righe non disponibili' });
  },
};

const MASSIMA_LUNGHEZZA_CHIAVE = 1000;

/** Le righe dalla più recente: per data dell'edizione, kit e posizione nella lista. */
const dallaPiuRecente = <T extends RigaSenzaPuntoVendita>(righe: readonly T[]): T[] =>
  [...righe].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0) || (a.idKit < b.idKit ? 1 : a.idKit > b.idKit ? -1 : 0) || a.posizione - b.posizione);

export const oggiARoma = (adesso: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);

export class AnalisiPuntoVenditaService implements IAnalisiPuntoVenditaService {
  private readonly chiaveMeta: string | null;
  private readonly oggi: () => string;
  private readonly riepiloghi: AnalisiKitService;
  private readonly repartiGdo: FonteRepartiGdo;
  private readonly configInsight: Pick<IConfigService, 'getFlyerInsightsConfig'> | null;
  private readonly posizioni: IPosizioniRigheRepository;
  private readonly collegamenti: Pick<IPuntiVenditaVolantinoRepository, 'regoleCollegamento'> | null;

  constructor(
    private readonly repository: IAnalisiPuntiVenditaRepository,
    private readonly storia: Pick<IPuntiVenditaVolantinoRepository, 'trovaPuntoVendita' | 'apparizioni'>,
    opzioni: OpzioniAnalisiPuntoVendita = {},
  ) {
    this.chiaveMeta = opzioni.chiaveMetaPuntoVendita?.trim() || null;
    this.oggi = opzioni.oggi ?? (() => oggiARoma());
    this.riepiloghi = new AnalisiKitService(repository);
    this.repartiGdo = opzioni.repartiGdo ?? SENZA_REPARTI_GDO;
    this.configInsight = opzioni.configInsight ?? null;
    this.posizioni = opzioni.posizioni ?? SENZA_POSIZIONI;
    this.collegamenti = opzioni.collegamenti ?? null;
  }

  /**
   * I reparti della GDO del PV con il nome per il marketing (Impostazioni GDO): i riepiloghi salvati
   * hanno il reparto come lo scrive la lettura generica e si traducono qui, alla lettura, riconoscendo
   * il testo dalla descrizione o dal codice dell'anagrafica della GDO.
   */
  private async repartiDellaGdo(idGdo: string): Promise<RisolutoreReparti> {
    let anagrafica: RepartoAnagrafica[] = [];
    if (this.configInsight) {
      try {
        anagrafica = leggiAnagraficaReparti((await this.configInsight.getFlyerInsightsConfig(idGdo))?.dataMapping?.reparti);
      } catch (error) {
        log.debug('Pagine del punto vendita: anagrafica dei reparti non disponibile', {
          idGdo,
          errore: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return caricaRisolutoreReparti(this.repartiGdo, idGdo, anagrafica, 'Pagine del punto vendita');
  }

  // ─── PV e kit ──────────────────────────────────────────────────────

  /** Il PV, se esiste ed e' della GDO indicata: un PV di un'altra GDO risponde come inesistente. */
  private async puntoVenditaDellaGdo(idPuntoVendita: string, idGdo: string | null): Promise<PuntoVenditaDellaStoria> {
    const puntoVendita = UUID.test(idPuntoVendita) ? await this.storia.trovaPuntoVendita(idPuntoVendita) : null;
    if (!puntoVendita || (idGdo !== null && puntoVendita.idGdo !== idGdo)) {
      throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: idPuntoVendita });
    }
    return puntoVendita;
  }

  private async edizioni(idPuntoVendita: string): Promise<EdizionePuntoVendita[]> {
    return edizioniDelPuntoVendita(await this.storia.apparizioni(idPuntoVendita));
  }

  /**
   * Gli aggregati dei kit: quelli dei riepiloghi salvati e validi, gli altri da riepiloghi calcolati
   * ora e salvati. All'uscita ogni kit indicato ha il suo riepilogo valido in analisi_kit.
   */
  private aggregati(idKit: readonly string[]): Promise<Map<string, AggregatiKit>> {
    return this.riepiloghi.aggregati(idKit);
  }

  // ─── Scheda, volantino, referenza ──────────────────────────────────

  async analisi(idPuntoVendita: string, idGdo: string | null): Promise<AnalisiPuntoVendita> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const edizioni = await this.edizioni(puntoVendita.id);
    const aggregati = await this.aggregati(edizioni.map(edizione => edizione.idKit));
    const statistiche = await this.repository.statisticheProdotti(
      edizioni.map(edizione => ({ idKit: edizione.idKit, data: edizione.data })),
      { soglia: SOGLIA_PRODOTTO_FREQUENTE, ricorrenti: NUMERO_PRODOTTI_RICORRENTI, marche: MARCHE_IN_EVIDENZA },
    );
    const descrizioni = descrizioniRicorrenti(statistiche.ricorrenti, await this.repository.descrizioniProdotti(coppieDaDescrivere(statistiche.ricorrenti)));
    const reparti = await this.repartiDellaGdo(puntoVendita.idGdo);
    return calcolaAnalisiPuntoVendita(puntoVendita.id, edizioni, aggregati, statistiche, descrizioni, this.oggi(), reparto => reparti.nome(reparto));
  }

  async volantino(idPuntoVendita: string, idKit: string, idGdo: string | null): Promise<DettaglioVolantinoPv> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const edizioni = UUID.test(idKit) ? await this.edizioni(puntoVendita.id) : [];
    const indice = edizioni.findIndex(edizione => edizione.idKit.toLowerCase() === idKit.toLowerCase());
    const nonTrovato = () => new NotFoundError({ message: 'Volantino non trovato nella storia del punto vendita', entityType: 'RuntimeKit', entityId: idKit });
    if (indice < 0) throw nonTrovato();
    const edizione = edizioni[indice];
    const precedente = indice > 0 ? edizioni[indice - 1] : null;
    const successivo = indice < edizioni.length - 1 ? edizioni[indice + 1] : null;

    const [kit, righe, lista, riepiloghiPrecedente, reparti] = await Promise.all([
      this.repository.kitDelVolantino(edizione.idKit),
      this.repository.referenzeDeiKit([edizione.idKit]),
      this.repository.listaDelVolantino(edizione.idKit),
      precedente ? this.aggregati([precedente.idKit]) : Promise.resolve(new Map<string, AggregatiKit>()),
      this.repartiDellaGdo(puntoVendita.idGdo),
    ]);
    if (!kit) throw nonTrovato();
    const referenze = leggi(righe);
    const box = boxDelKit(referenze);
    const { dati: riepilogo } = riassumiKit(referenze, box);
    const pagine = numeroPagine(kit.pdf?.pagine ?? null, box);
    const manuali = kit.storico ? kit.manuali ?? 0 : null;

    return {
      kit: { id: kit.id, titolo: kit.titolo },
      promo: edizione.promo,
      canale: edizione.canale,
      area: edizione.area,
      pdf: kit.pdf,
      numeri: {
        pagine,
        referenze: riepilogo.referenze,
        // Import precedenti senza il conteggio: dal listino sono quelle non compilate a mano
        daListino: kit.storico ? kit.daListino ?? Math.max(0, riepilogo.referenze - (manuali ?? 0)) : null,
        manuali,
        scontoMedio: scontoMedio(riepilogo.sconto),
        scontoMedioPrecedente: precedente ? scontoMedio((riepiloghiPrecedente.get(precedente.idKit) ?? AGGREGATI_VUOTI).sconto) : null,
        fidelity: riepilogo.fidelity,
        puntiVenditaInLista: lista.length,
        puntiVenditaAbbinati: lista.filter(riga => riga.idPuntoVendita !== null).length,
      },
      pagine: pagineDelVolantino(box, pagine).map(pagina => (reparti.vuoto ? pagina : {
        ...pagina,
        boxes: pagina.boxes.map(singolo => (singolo.reparto ? { ...singolo, reparto: reparti.nome(singolo.reparto) } : singolo)),
      })),
      meccaniche: spazioPerMeccanica(box),
      rigaPuntoVendita: rigaDelPuntoVendita(lista, puntoVendita.id),
      precedente: precedente ? { idKit: precedente.idKit, dal: precedente.promo.validitaDal ?? precedente.data } : null,
      successivo: successivo ? { idKit: successivo.idKit, dal: successivo.promo.validitaDal ?? successivo.data } : null,
      copertura: coperturaDi(riepilogo.copertura, riepilogo.referenze),
    };
  }

  async referenza(idPuntoVendita: string, chiave: string, idGdo: string | null): Promise<DettaglioReferenzaPv> {
    const puntoVendita = await this.puntoVenditaDellaGdo(idPuntoVendita, idGdo);
    const nonTrovata = () => new NotFoundError({ message: 'Referenza non trovata nei volantini del punto vendita', entityType: 'Referenza', entityId: chiave });
    if (!CHIAVE_PRODOTTO.test(chiave)) throw nonTrovata();
    const edizioni = await this.edizioni(puntoVendita.id);
    const idKit = edizioni.map(edizione => edizione.idKit);
    // I riepiloghi di tutti i volantini del PV, poi solo il prodotto cercato in ognuno
    await this.aggregati(idKit);
    const presenze = presenzeDelProdotto(edizioni, await this.repository.presenzeProdotto(idKit, chiave));
    if (presenze.length === 0) throw nonTrovata();

    // Intestazione e posizione dall'ultimo volantino che la contiene, riletto per intero; le foto
    // delle presenze dalle descrizioni dei volantini piu' recenti che ne hanno una
    const ultimo = presenze[0].edizione.idKit;
    const [righe, kit, trovate, reparti] = await Promise.all([
      this.repository.referenzeDeiKit([ultimo]),
      this.repository.kitDelVolantino(ultimo),
      this.repository.descrizioniProdotti(kitDaDescrivere(presenze).map(id => ({ idKit: id, chiave }))),
      this.repartiDellaGdo(puntoVendita.idGdo),
    ]);
    const descrizioni = new Map(presenze.flatMap(({ edizione }) => {
      const descrizione = trovate.get(chiaveDescrizione(edizione.idKit, chiave));
      return descrizione ? [[edizione.idKit, descrizione] as const] : [];
    }));
    const box = boxDelKit(leggi(righe));
    const dettaglio = dettaglioReferenza(chiave, presenze, { box, pagine: numeroPagine(kit?.pdf?.pagine ?? null, box) }, descrizioni);
    if (reparti.vuoto || !dettaglio.dati.reparto) return dettaglio;
    return { ...dettaglio, dati: { ...dettaglio.dati, reparto: reparti.nome(dettaglio.dati.reparto) } };
  }

  // ─── Elenco e gestione ─────────────────────────────────────────────

  async reteInsegne(idGdo: string): Promise<ReteInsegne> {
    const [canali, liste] = await Promise.all([
      this.repository.canaliConPuntiVendita(idGdo),
      this.repository.puntiVenditaNelleListe(idGdo),
    ]);
    return calcolaReteInsegne(canali, liste);
  }

  async qualita(idGdo: string): Promise<QualitaPuntiVendita> {
    const grezza = await this.repository.qualita(idGdo, this.chiaveMeta, MINUTI_DISPOSITIVO_OFFLINE);
    return {
      totale: grezza.totale,
      senzaCoordinate: grezza.senzaCoordinate,
      senzaCodice: grezza.senzaCodice,
      righeDaRevisionare: righeDaRevisionare(grezza.ultimoImport),
      conStoria: grezza.conStoria,
      dispositiviOffline: grezza.dispositiviOffline,
    };
  }

  async volantiniRigaNonAbbinata(idGdo: string, chiave: unknown): Promise<VolantiniRigaNonAbbinata> {
    if (typeof chiave !== 'string' || chiave.trim() === '' || chiave.length > 1000) {
      throw new BadRequestError({ message: 'Riga non indicata (chiave)' });
    }
    const volantini = volantiniDelGruppo(await this.repository.righeSenzaPuntoVendita(idGdo), chiave);
    if (!volantini) {
      throw new NotFoundError({ message: "La riga non e' piu' fra quelle non abbinate", entityType: 'RigaNonAbbinata', entityId: chiave });
    }
    return { chiave, volantini };
  }

  async righeNonAbbinate(idGdo: string, pagina = 1, dimensione = DIMENSIONI_PAGINA_STORIA[0]): Promise<PaginaRigheNonAbbinate> {
    const perPagina = DIMENSIONI_PAGINA_STORIA.includes(dimensione) ? dimensione : DIMENSIONI_PAGINA_STORIA[0];
    const numeroPagina = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
    const [righe, edizioni, puntiVendita, posizioni] = await Promise.all([
      this.repository.righeSenzaPuntoVendita(idGdo),
      this.repository.edizioniConLista(idGdo),
      this.repository.puntiVenditaPerSuggerimenti(idGdo),
      this.posizioni.posizioni(idGdo),
    ]);
    const gruppi = raggruppaRigheNonAbbinate(righe, edizioni, puntiVendita, posizioni);
    return {
      righe: gruppi.slice((numeroPagina - 1) * perPagina, numeroPagina * perPagina),
      totale: gruppi.length,
      pagina: numeroPagina,
      dimensione: perPagina,
    };
  }

  // ─── Verifica dei collegamenti e posizioni delle righe ─────────────

  async verificaCollegamenti(idGdo: string, filtri: FiltriVerifica = {}): Promise<PaginaVerificaCollegamenti> {
    const esito = ESITI_VERIFICA.includes(filtri.esito as EsitoVerifica) ? (filtri.esito as EsitoVerifica) : undefined;
    const tipo = filtri.tipo === 'manuale' || filtri.tipo === 'automatico' ? (filtri.tipo as TipoCollegamento) : undefined;
    const perPagina = DIMENSIONI_PAGINA_STORIA.includes(filtri.dimensione ?? 0) ? (filtri.dimensione as number) : DIMENSIONI_PAGINA_STORIA[0];
    const numeroPagina = Number.isInteger(filtri.pagina) && (filtri.pagina as number) >= 1 ? (filtri.pagina as number) : 1;
    const [collegate, senza, puntiVendita, posizioni, regole] = await Promise.all([
      this.repository.righeCollegate(idGdo),
      this.repository.righeSenzaPuntoVendita(idGdo),
      this.repository.puntiVenditaPerSuggerimenti(idGdo),
      this.posizioni.posizioni(idGdo),
      this.collegamenti ? this.collegamenti.regoleCollegamento(idGdo) : Promise.resolve([]),
    ]);
    const gruppi = verificaCollegamenti(collegate, puntiVendita, posizioni, regole);
    const delTipo = tipo ? gruppi.filter(gruppo => gruppo.tipo === tipo) : gruppi;
    const filtrati = esito ? delTipo.filter(gruppo => gruppo.esito === esito) : delTipo;
    const chiavi = new Set([...collegate, ...senza].map(chiavePosizione).filter((chiave): chiave is string => chiave !== null));
    let posizioniDaCercare = 0;
    let posizioniNonTrovate = 0;
    for (const chiave of chiavi) {
      const posizione = posizioni.get(chiave);
      if (!posizione) posizioniDaCercare++;
      else if (posizione.precisione === 'non_trovata') posizioniNonTrovate++;
    }
    return {
      gruppi: filtrati.slice((numeroPagina - 1) * perPagina, numeroPagina * perPagina),
      totale: filtrati.length,
      pagina: numeroPagina,
      dimensione: perPagina,
      conteggi: contaPerEsito(delTipo),
      posizioniDaCercare,
      posizioniNonTrovate,
    };
  }

  /**
   * Gli indirizzi stampati della GDO la cui posizione non è ancora stata cercata (con ancheNonTrovate
   * anche quelli non trovati o in errore), uno per chiave con la riga più recente: prima quelli delle
   * righe collegate, che servono alla verifica, poi quelli delle righe non abbinate. Mai quelli
   * corretti a mano.
   */
  async indirizziDaCercare(idGdo: string, ancheNonTrovate = false): Promise<IndirizzoDaCercare[]> {
    const [collegate, senza, posizioni] = await Promise.all([
      this.repository.righeCollegate(idGdo),
      this.repository.righeSenzaPuntoVendita(idGdo),
      this.posizioni.posizioni(idGdo),
    ]);
    const daCercare = new Map<string, IndirizzoDaCercare>();
    for (const riga of [...dallaPiuRecente(collegate), ...dallaPiuRecente(senza)]) {
      const chiave = chiavePosizione(riga);
      if (!chiave || daCercare.has(chiave)) continue;
      const salvata = posizioni.get(chiave);
      const daRifare = salvata && ancheNonTrovate && salvata.fonte !== 'manuale' && salvata.precisione === 'non_trovata';
      if (salvata && !daRifare) continue;
      daCercare.set(chiave, {
        chiave,
        indirizzo: chiave.startsWith('ind:') ? riga.indirizzo : null,
        localita: localitaDaCercare(riga.localita),
        provincia: riga.provincia ?? null,
      });
    }
    return [...daCercare.values()];
  }

  async salvaRicercaPosizione(idGdo: string, chiave: string, esito: EsitoRicercaPosizione, idUtente: string | null): Promise<void> {
    await this.posizioni.salvaRicerca(idGdo, chiave, esito, idUtente);
  }

  /** La posizione di una riga corretta a mano (coordinate di Google Maps). */
  async correggiPosizione(idGdo: string, richiesta: unknown, idUtente: string | null): Promise<PosizioneRiga> {
    const { chiave, lat, lon } = (richiesta ?? {}) as Partial<Record<keyof CorrezionePosizione, unknown>>;
    if (typeof chiave !== 'string' || !/^(ind|loc):/.test(chiave) || chiave.length > MASSIMA_LUNGHEZZA_CHIAVE) {
      throw new BadRequestError({ message: 'Posizione da correggere non indicata (chiave)' });
    }
    const latitudine = typeof lat === 'number' ? lat : Number.NaN;
    const longitudine = typeof lon === 'number' ? lon : Number.NaN;
    if (!coordinateValide(latitudine, longitudine) || Math.abs(latitudine) > 90 || Math.abs(longitudine) > 180) {
      throw new BadRequestError({ message: 'Coordinate non valide: servono latitudine (fra -90 e 90) e longitudine (fra -180 e 180)' });
    }
    const [collegate, senza] = await Promise.all([this.repository.righeCollegate(idGdo), this.repository.righeSenzaPuntoVendita(idGdo)]);
    if (![...collegate, ...senza].some(riga => chiavePosizione(riga) === chiave)) {
      throw new NotFoundError({ message: 'Nessuna riga dei volantini con questa posizione', entityType: 'PosizioneRiga', entityId: chiave });
    }
    const corretta = await this.posizioni.correggi(idGdo, chiave, { lat: latitudine, lon: longitudine }, idUtente);
    log.info('Posizione di una riga dei volantini corretta a mano', { idGdo, chiave });
    return corretta;
  }
}
