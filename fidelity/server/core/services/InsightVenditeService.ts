import { ForbiddenError, NotFoundError, ValidationError } from '../../../lib/errors';
import type {
  PrevisioneVolantino,
  RegolePrevisione,
  RendimentoVolantino,
  RichiestaSimulazione,
  SimulazioneProdotto,
} from '../../../lib/insightVolantino/rendimento';
import { type BoxInsight, PESI_VISIBILITA, type PdfVolantino, type PesiVisibilita } from '../../../lib/insightVolantino/tipi';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import type { IAgenziaLib } from '../agenzia_lib/types';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IInsightVenditeService } from '../interfaces/IInsightVenditeService';
import { log } from '../logger';
import type { IAnalisiPuntiVenditaRepository, RigaReferenzaKit } from '../repositories/AnalisiPuntiVenditaRepository';
import type { AmbitoVendite, IInsightVenditeRepository, PeriodoDiVendita } from '../repositories/InsightVenditeRepository';
import { type KitInsight, kitNellAmbito, pdfDelKit, righeDelKit } from '../repositories/InsightVolantinoRepository';
import { boxDelKit } from '../utils/analisiKit';
import { boxInsight } from '../utils/insightVolantino';
import {
  boxCollocati,
  type DatiPrevisione,
  erroreSimulazione,
  type Osservazione,
  osservazioniDellEdizione,
  previsioneVolantino,
  regoleDelCliente,
  simulaProdotto,
} from '../utils/previsioneInsight';
import { leggiReferenza, type RigaReferenza } from '../utils/referenzaStampata';
import {
  codiciDaCercare,
  type CodiciDeiBox,
  codiciDeiBox,
  rendimentoVolantino,
  venditeDeiBox,
  type VenditeDelPeriodo,
} from '../utils/rendimentoInsight';
import { FUSO_PROMO } from '../utils/statoAutomaticoPromo';
import { CHIAVE_PRODOTTO, KIT_PER_LETTURA } from './AnalisiKitService';
import { type ContestoConfig, contestoDallaConfig, type LettureKitInsight, opzioniDelKit } from './InsightConfrontiService';

/**
 * Rendimento dalle vendite, previsione e simulazione degli insight del volantino (contratto in
 * lib/insightVolantino/rendimento.ts; spec vendite-volantino e insight-volantino).
 *
 * Il kit deve essere nell'ambito GDO della sessione: un kit di un'altra GDO, o un id che non e' un
 * UUID, risponde 404 come un kit che non esiste. Box, prodotti e reparti sono quelli della scheda
 * degli insight (lettura generica delle referenze, reparto dalla config come nei confronti); le
 * regole della previsione e i pesi della visibilita' vengono dalla libreria agenzia del cliente
 * (insightVolantino.previsione e .pesiVisibilita), con i valori standard per quello che non dice.
 *
 * Le vendite sono quelle importate nei punti vendita della stessa area e canale del volantino, nel
 * periodo di validita' della sua promo (InsightVenditeRepository). Lo storico della previsione sono
 * le ultime edizioni della stessa GDO, area e canale prima del volantino: le loro referenze si
 * leggono a blocchi e, con le vendite, restano in memoria qualche minuto (la simulazione chiede
 * molte posizioni di fila per lo stesso volantino).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Per quanto restano in memoria volantino, vendite e storico di una previsione. */
export const DURATA_CACHE_PREVISIONE_MS = 5 * 60_000;

/** Volantini tenuti in memoria al massimo: oltre, esce il piu' vecchio. */
export const MAX_VOLANTINI_IN_CACHE = 20;

const LETTURE_PREDEFINITE: LettureKitInsight = { kitNellAmbito, pdfDelKit, righeDelKit };

/** Quello che serve del repository dei punti vendita: le referenze di piu' kit in una lettura. */
export type RepositoryReferenzeKit = Pick<IAnalisiPuntiVenditaRepository, 'referenzeDeiKit'>;

/** Un volantino letto per le vendite: i box degli insight, i codici dei loro prodotti e le pagine. */
interface VolantinoLetto {
  kit: KitInsight;
  box: BoxInsight[];
  codici: CodiciDeiBox;
  totalePagine: number;
}

/** Quello che previsione e simulazione leggono di un volantino. */
interface ContestoPrevisione {
  volantino: VolantinoLetto;
  vendite: VenditeDelPeriodo | null;
  storico: Osservazione[];
}

/** Il giorno di oggi nel calendario delle promo (Roma), YYYY-MM-DD. */
export function oggiARoma(adesso: Date = new Date()): string {
  const parti = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_PROMO, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(adesso);
  const parte = (tipo: string): string => parti.find(voce => voce.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/**
 * Il periodo di validita' della promo, YYYY-MM-DD inclusi. Con una sola data vale quel giorno;
 * null senza date o con la fine prima dell'inizio.
 */
export function periodoDelKit(kit: Pick<KitInsight, 'validitaDal' | 'validitaAl'>): { dal: string; al: string } | null {
  const dal = kit.validitaDal ?? kit.validitaAl;
  const al = kit.validitaAl ?? kit.validitaDal;
  if (!dal || !al || dal > al) return null;
  return { dal, al };
}

/** GDO, area e canale delle vendite del volantino; null per un kit senza GDO (dati vecchi). */
const ambitoVendite = (kit: KitInsight): AmbitoVendite | null =>
  (kit.gdo ? { idGdo: kit.gdo, idArea: kit.idArea, idCanale: kit.idCanale } : null);

/**
 * I box degli insight e i codici dei prodotti, dalle stesse letture della scheda e dei confronti, con
 * i pesi della visibilita' del cliente.
 */
function volantinoDa(
  kit: KitInsight,
  righe: readonly RigaReferenza[],
  pdf: PdfVolantino | null,
  contesto: ContestoConfig,
  pesi: PesiVisibilita,
): VolantinoLetto {
  const box = boxDelKit(righe.map(riga => leggiReferenza(riga, { storico: kit.storico })));
  const opzioni = opzioniDelKit(kit, righe, box, pdf, contesto, pesi);
  return { kit, box: boxInsight(box, opzioni), codici: codiciDeiBox(box), totalePagine: opzioni.totalePagine };
}

/** 400 con il motivo, se la richiesta di simulazione non e' valida. */
export function validaSimulazione(richiesta: RichiestaSimulazione): void {
  const errore = erroreSimulazione(richiesta) ?? (CHIAVE_PRODOTTO.test(richiesta.chiave.trim()) ? null : 'Prodotto non valido');
  if (errore) throw new ValidationError({ message: errore, field: 'simulazione', value: richiesta });
}

export class InsightVenditeService implements IInsightVenditeService {
  private readonly cache = new Map<string, { scade: number; contesto: Promise<ContestoPrevisione> }>();

  constructor(
    private readonly repository: IInsightVenditeRepository,
    private readonly referenze: RepositoryReferenzeKit,
    private readonly config: Pick<IConfigService, 'getFlyerInsightsConfig' | 'getFunzionalita'>,
    private readonly agenziaLib: Pick<IAgenziaLib, 'insightVolantino'>,
    private readonly letture: LettureKitInsight = LETTURE_PREDEFINITE,
    private readonly orologio: () => Date = () => new Date(),
  ) {}

  // ─── API ───────────────────────────────────────────────────────────

  async rendimento(idKit: string, ambito: AmbitoGdo): Promise<RendimentoVolantino | null> {
    const kit = await this.kitNellAmbito(idKit, ambito);
    // "Vendite e previsioni" spenta per la GDO del volantino: niente vendite
    if (!(await this.venditeAttive(kit))) return null;
    const volantino = await this.leggiVolantino(kit, await this.contestoConfig());
    const vendite = await this.venditeDelVolantino(volantino);
    return vendite ? rendimentoVolantino(volantino.box, volantino.codici, vendite) : null;
  }

  async previsione(idKit: string, ambito: AmbitoGdo): Promise<PrevisioneVolantino | null> {
    const kit = await this.kitNellAmbito(idKit, ambito);
    // "Vendite e previsioni" e' da attivare per GDO (Impostazioni di produzione): spenta, niente previsione
    if (!(await this.venditeAttive(kit))) return null;
    return previsioneVolantino(await this.datiPrevisione(kit));
  }

  async simula(idKit: string, richiesta: RichiestaSimulazione, ambito: AmbitoGdo): Promise<SimulazioneProdotto> {
    validaSimulazione(richiesta);
    const kit = await this.kitNellAmbito(idKit, ambito);
    if (!(await this.venditeAttive(kit))) {
      throw new ForbiddenError({
        message: 'Vendite e previsioni non sono attive per questa GDO',
        resource: 'vendite',
        action: 'simula',
      });
    }
    return simulaProdotto(richiesta, await this.datiPrevisione(kit));
  }

  /**
   * "Vendite e previsioni" attiva per la GDO del volantino (con ripiego sulla configurazione
   * dell'installazione, come le altre funzionalita'). Se la configurazione non si legge, spenta.
   */
  private async venditeAttive(kit: KitInsight): Promise<boolean> {
    try {
      return (await this.config.getFunzionalita(kit.gdo ?? null)).vendite === true;
    } catch (error) {
      log.warn('Insight vendite: funzionalita della GDO non disponibili, vendite e previsioni spente', {
        idGdo: kit.gdo,
        errore: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // ─── Regole del cliente ────────────────────────────────────────────

  private get regole(): RegolePrevisione {
    return regoleDelCliente(this.agenziaLib.insightVolantino?.previsione);
  }

  private get pesi(): PesiVisibilita {
    return this.agenziaLib.insightVolantino?.pesiVisibilita ?? PESI_VISIBILITA;
  }

  // ─── Kit, config e volantino ───────────────────────────────────────

  /** Il kit, se esiste ed e' nell'ambito GDO; altrimenti, e per un id che non e' un UUID, 404. */
  private async kitNellAmbito(idKit: string, ambito: AmbitoGdo): Promise<KitInsight> {
    const nonTrovato = () => new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: idKit });
    if (!UUID.test(idKit)) throw nonTrovato();
    const kit = await this.letture.kitNellAmbito(idKit, ambito);
    if (!kit) throw nonTrovato();
    return kit;
  }

  /** La config degli insight; se manca o non si legge, valgono la lettura generica e nessun reparto configurato. */
  private async contestoConfig(): Promise<ContestoConfig> {
    try {
      return contestoDallaConfig(await this.config.getFlyerInsightsConfig());
    } catch (error) {
      log.warn('Insight vendite: config degli insight non disponibile, reparti dalla sola lettura generica', {
        errore: error instanceof Error ? error.message : String(error),
      });
      return contestoDallaConfig(null);
    }
  }

  private async leggiVolantino(kit: KitInsight, contesto: ContestoConfig): Promise<VolantinoLetto> {
    const [righe, pdf] = await Promise.all([this.letture.righeDelKit(kit.id), this.letture.pdfDelKit(kit.id)]);
    return volantinoDa(kit, righe, pdf, contesto, this.pesi);
  }

  /** Le vendite dei prodotti del volantino nel periodo della sua promo; null se non ce n'e' nessuna. */
  private async venditeDelVolantino(volantino: VolantinoLetto): Promise<VenditeDelPeriodo | null> {
    const ambito = ambitoVendite(volantino.kit);
    const periodo = periodoDelKit(volantino.kit);
    const codici = codiciDaCercare(volantino.box, volantino.codici);
    if (!ambito || !periodo || codici.length === 0) return null;
    const vendite = await this.repository.venditeNeiPeriodi(ambito, [{ idKit: volantino.kit.id, ...periodo }], codici);
    return vendite.get(volantino.kit.id) ?? null;
  }

  // ─── Previsione ────────────────────────────────────────────────────

  private async datiPrevisione(kit: KitInsight): Promise<DatiPrevisione> {
    const { volantino, vendite, storico } = await this.contestoPrevisione(kit);
    // Il reale dei soli box con almeno un prodotto venduto: un box senza righe puo' essere un codice
    // che il file non riporta, e non deve pesare nello scarto fra previsto e reale
    const reale = vendite
      ? new Map([...venditeDeiBox(volantino.box, volantino.codici, vendite)]
        .filter(([, venduto]) => venduto.prodottiSenzaVendite < venduto.prodotti)
        .map(([idBox, venduto]) => [idBox, venduto.pezzi] as const))
      : null;
    return {
      box: boxCollocati(volantino.box),
      totalePagine: volantino.totalePagine,
      storico,
      reale,
      promoValida: (kit.validitaDal ?? kit.data) <= oggiARoma(this.orologio()),
      regole: this.regole,
      pesi: this.pesi,
    };
  }

  /** Volantino, vendite e storico, dalla memoria se letti da poco. Un calcolo fallito non resta in memoria. */
  private contestoPrevisione(kit: KitInsight): Promise<ContestoPrevisione> {
    const adesso = this.orologio().getTime();
    for (const [idKit, voce] of this.cache) {
      if (voce.scade <= adesso) this.cache.delete(idKit);
    }
    const presente = this.cache.get(kit.id);
    if (presente) return presente.contesto;

    const contesto = this.calcolaContesto(kit);
    this.cache.set(kit.id, { scade: adesso + DURATA_CACHE_PREVISIONE_MS, contesto });
    void contesto.catch(() => {
      if (this.cache.get(kit.id)?.contesto === contesto) this.cache.delete(kit.id);
    });
    // La Map tiene l'ordine d'inserimento: il primo e' il piu' vecchio
    while (this.cache.size > MAX_VOLANTINI_IN_CACHE) {
      const piuVecchio = this.cache.keys().next().value;
      if (piuVecchio === undefined) break;
      this.cache.delete(piuVecchio);
    }
    return contesto;
  }

  private async calcolaContesto(kit: KitInsight): Promise<ContestoPrevisione> {
    const contesto = await this.contestoConfig();
    const volantino = await this.leggiVolantino(kit, contesto);
    // Senza box in pagina non c'e' niente da prevedere: lo storico non si legge
    const conBox = boxCollocati(volantino.box).length > 0;
    const [vendite, storico] = await Promise.all([
      this.venditeDelVolantino(volantino),
      conBox ? this.storico(kit, contesto) : Promise.resolve<Osservazione[]>([]),
    ]);
    return { volantino, vendite, storico };
  }

  /**
   * I box delle ultime edizioni della stessa GDO, area e canale prima del volantino, con le loro
   * vendite nel periodo della rispettiva promo. Le referenze si leggono a blocchi di
   * KIT_PER_LETTURA kit; di ogni edizione restano solo box e codici.
   */
  private async storico(kit: KitInsight, contesto: ContestoConfig): Promise<Osservazione[]> {
    const ambito = ambitoVendite(kit);
    const { edizioniStoriche } = this.regole;
    if (!ambito || edizioniStoriche === 0) return [];
    const edizioni = await this.repository.edizioniPrecedenti(kit, edizioniStoriche);
    if (edizioni.length === 0) return [];

    const pesi = this.pesi;
    const letti: VolantinoLetto[] = [];
    for (let inizio = 0; inizio < edizioni.length; inizio += KIT_PER_LETTURA) {
      const blocco = edizioni.slice(inizio, inizio + KIT_PER_LETTURA);
      const perKit = new Map<string, RigaReferenzaKit[]>();
      for (const riga of await this.referenze.referenzeDeiKit(blocco.map(edizione => edizione.kit.id))) {
        const delKit = perKit.get(riga.id_runtime_kit);
        if (delKit) delKit.push(riga);
        else perKit.set(riga.id_runtime_kit, [riga]);
      }
      for (const edizione of blocco) {
        letti.push(volantinoDa(edizione.kit, perKit.get(edizione.kit.id) ?? [], edizione.pdf, contesto, pesi));
      }
    }

    const periodi = letti.flatMap((letto): PeriodoDiVendita[] => {
      const periodo = periodoDelKit(letto.kit);
      return periodo ? [{ idKit: letto.kit.id, ...periodo }] : [];
    });
    const codici = [...new Set(letti.flatMap(letto => codiciDaCercare(letto.box, letto.codici)))];
    const vendite = await this.repository.venditeNeiPeriodi(ambito, periodi, codici);

    return letti.flatMap((letto) => {
      const delPeriodo = vendite.get(letto.kit.id);
      return osservazioniDellEdizione(
        { idKit: letto.kit.id, titolo: letto.kit.titolo, data: letto.kit.validitaDal ?? letto.kit.data, totalePagine: letto.totalePagine },
        letto.box,
        delPeriodo ? venditeDeiBox(letto.box, letto.codici, delPeriodo) : null,
        pesi,
      );
    });
  }
}
