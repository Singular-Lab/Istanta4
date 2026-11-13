import { BadRequestError, NotFoundError } from '../../../lib/errors';
import {
  type ConfrontoEdizione,
  MAX_TAPPE_VIAGGIO,
  type PdfVolantino,
  type RepartoInsight,
  type TappaProdotto,
  type ViaggioProdotto,
  type VolantinoDiRiferimento,
} from '../../../lib/insightVolantino/tipi';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import type { InsightVolantinoAgenzia } from '../agenzia_lib/types';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IInsightConfrontiService } from '../interfaces/IInsightConfrontiService';
import { log } from '../logger';
import type { IAnalisiPuntiVenditaRepository } from '../repositories/AnalisiPuntiVenditaRepository';
import type { IInsightConfrontiRepository } from '../repositories/InsightConfrontiRepository';
import { type KitInsight, kitNellAmbito, pdfDelKit, righeDelKit } from '../repositories/InsightVolantinoRepository';
import { boxDelKit, type BoxKit, type ProdottoNelKit } from '../utils/analisiKit';
import { chiaveDescrizione, trovaNeiBox } from '../utils/analisiPuntoVendita';
import {
  applicaAnagraficaReparti,
  leggiAnagraficaReparti,
  type PercorsoCampo,
  type RepartoAnagrafica,
  valoreCampo,
} from '../utils/campiInsights';
import { confrontoSintesi, confrontoSpazioPerReparto, prodottiAssenti } from '../utils/diffVarianti';
import { opzioniDellAgenzia } from '../utils/insightAgenzia';
import { type OpzioniInsight, sezioniInsight } from '../utils/insightVolantino';
import { DESCRIZIONE_ASSENTE, leggiReferenza, type RigaReferenza, scontoDaiPrezzi } from '../utils/referenzaStampata';
import { type FonteRepartiGdo, SENZA_REPARTI_GDO } from '../utils/repartiGdo';
import { urlFotoOlimpo } from '../utils/urlOlimpo';
import { AnalisiKitService, CHIAVE_PRODOTTO, type RepositoryRiepiloghiKit } from './AnalisiKitService';
import { caricaRisolutoreReparti } from './risolutoreRepartiGdo';

/**
 * Confronti degli insight del volantino (contratto in lib/insightVolantino/tipi.ts): l'edizione
 * precedente della stessa area e canale, per il report PDF, e il viaggio di un prodotto nei volantini
 * della GDO. La pagina degli insight non confronta il volantino con altri (decisione dell'utente). Per
 * ogni GDO e per i kit di Istanta e dello storico: prezzi, sconti, marche e meccaniche vengono dalla
 * lettura generica delle referenze (referenzaStampata), la config degli insight della GDO del kit
 * aggiunge solo l'anagrafica dei reparti, la meccanica come la scrive la fonte e le marche del
 * distributore; le Impostazioni GDO il nome per il marketing e il colore dei reparti.
 *
 * Il kit di partenza deve essere nell'ambito GDO della sessione: altrimenti 404, come un kit che non
 * esiste. Gli altri volantini sono sempre della sua GDO.
 *
 * Il viaggio legge i riepiloghi dei kit in analisi_kit (gli stessi delle pagine del punto vendita):
 * quelli che mancano si calcolano e si salvano alla prima apertura, che per questo puo' essere lenta.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Volantini da cui leggere nome e foto del prodotto quando il kit di partenza non li ha. */
const KIT_PER_FOTO_VIAGGIO = 4;

/** Le letture del kit degli insight (InsightVolantinoRepository): qui per poterle sostituire nei test. */
export interface LettureKitInsight {
  kitNellAmbito(idKit: string, ambito: AmbitoGdo): Promise<KitInsight | null>;
  pdfDelKit(idKit: string): Promise<PdfVolantino | null>;
  righeDelKit(idKit: string): Promise<RigaReferenza[]>;
}

const LETTURE_PREDEFINITE: LettureKitInsight = { kitNellAmbito, pdfDelKit, righeDelKit };

export type RepositoryAnalisiViaggio = RepositoryRiepiloghiKit & Pick<IAnalisiPuntiVenditaRepository, 'presenzeProdotto' | 'descrizioniProdotti'>;

/** Quello che serve della config degli insight; tutto facoltativo, la pagina funziona anche senza. */
export interface ContestoConfig {
  anagraficaReparti: RepartoAnagrafica[];
  marcheDistributore: string[];
  percorsoReparto: PercorsoCampo | null;
  percorsoDescrizioneReparto: PercorsoCampo | null;
  percorsoMeccanica: PercorsoCampo | null;
  /** Nome per il marketing e colore dei reparti della GDO (Impostazioni GDO); senza, i reparti dei dati. */
  risolviReparto?: (reparto: RepartoInsight) => RepartoInsight;
}

/** Un volantino letto: le sue referenze in box e le opzioni con cui gli insight le descrivono. */
interface KitLetto {
  kit: KitInsight;
  pdf: PdfVolantino | null;
  box: BoxKit[];
  opzioni: OpzioniInsight;
}

const oggetto = (valore: unknown): Record<string, unknown> | null =>
  valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : null;

const testo = (valore: unknown): string => {
  if (typeof valore === 'string') return valore.trim();
  if (typeof valore === 'number' && Number.isFinite(valore)) return String(valore);
  return '';
};

/** Un percorso della config: un testo o un elenco di testi (alternative in ordine). */
function percorso(valore: unknown): PercorsoCampo | null {
  if (typeof valore === 'string' && valore.trim() !== '') return valore;
  if (Array.isArray(valore)) {
    const alternative = valore.filter((voce): voce is string => typeof voce === 'string' && voce.trim() !== '');
    return alternative.length > 0 ? alternative : null;
  }
  return null;
}

/**
 * Gli stessi campi che legge la scheda degli insight (VolantinoService): reparto e meccanica dai campi
 * indicati in reparti.groupBy e meccaniche.groupBy, letti con i percorsi di dataMapping.referenzaFields.
 */
export function contestoDallaConfig(config: unknown): ContestoConfig {
  const radice = oggetto(config) ?? {};
  const mappatura = oggetto(radice.dataMapping) ?? {};
  const campi = oggetto(mappatura.referenzaFields) ?? {};
  // Senza groupBy valgono i campi predefiniti della scheda degli insight
  const gruppoReparti: Record<string, unknown> = oggetto(oggetto(radice.reparti)?.groupBy) ?? { field: 'reparto', descriptionField: 'descrizioneReparto' };
  const gruppoMeccaniche: Record<string, unknown> = oggetto(oggetto(radice.meccaniche)?.groupBy) ?? { field: 'meccanica' };
  const campo = (nome: unknown): PercorsoCampo | null => (typeof nome === 'string' && nome !== '' ? percorso(campi[nome]) : null);
  const distributore = oggetto(radice.marche)?.distributore;
  return {
    anagraficaReparti: leggiAnagraficaReparti(mappatura.reparti),
    marcheDistributore: Array.isArray(distributore)
      ? distributore.filter((voce): voce is string => typeof voce === 'string' && voce.trim() !== '').map(voce => voce.trim())
      : [],
    percorsoReparto: campo(gruppoReparti.field),
    percorsoDescrizioneReparto: campo(gruppoReparti.descriptionField),
    percorsoMeccanica: campo(gruppoMeccaniche.field),
  };
}

/** La riga come la vedono i percorsi della config: data_fields anche come dataFields. */
const sorgenteConfig = (riga: RigaReferenza): Record<string, unknown> => ({ ...riga, dataFields: riga.data_fields });

/** Il reparto della riga secondo la config, ricondotto all'anagrafica ("1" e "01" sono lo stesso). */
function repartoConfigurato(riga: RigaReferenza, contesto: ContestoConfig): RepartoInsight | null {
  if (!contesto.percorsoReparto) return null;
  const sorgente = sorgenteConfig(riga);
  const voce: Record<string, unknown> = {
    codice: testo(valoreCampo(sorgente, contesto.percorsoReparto)),
    descrizione: contesto.percorsoDescrizioneReparto ? testo(valoreCampo(sorgente, contesto.percorsoDescrizioneReparto)) : '',
  };
  applicaAnagraficaReparti(voce, contesto.anagraficaReparti, 'codice', 'descrizione');
  // Come la scheda (VolantinoService): senza codice la config non dice il reparto, vale la lettura generica
  const codice = testo(voce.codice);
  if (codice === '') return null;
  return { codice, descrizione: testo(voce.descrizione) || codice };
}

function meccanicaOriginale(riga: RigaReferenza, contesto: ContestoConfig): string | null {
  if (!contesto.percorsoMeccanica) return null;
  return testo(valoreCampo(sorgenteConfig(riga), contesto.percorsoMeccanica)) || null;
}

/** I codici box delle referenze compilate a mano nell'import dallo storico. */
function codiciFuoriListino(kit: KitInsight): Set<string> {
  const voci = kit.importStorico?.fuoriListino;
  if (!Array.isArray(voci)) return new Set();
  return new Set(voci.map(voce => testo(voce?.codiceBox)).filter(Boolean));
}

/**
 * Le pagine del volantino come nella scheda degli insight: quelle del PDF, o la pagina piu' alta con
 * un box se il file non le dice. Cosi' i numeri del confronto sono quelli delle card della sintesi.
 */
export function pagineDelKit(pdf: PdfVolantino | null, box: readonly BoxKit[]): number {
  if (pdf && pdf.pagine > 0) return pdf.pagine;
  return box.reduce((massimo, singolo) => Math.max(massimo, singolo.pagina ?? 0), 0);
}

/**
 * Le opzioni degli insight di un kit dalla config della sua GDO; con la libreria agenzia del cliente
 * anche linee del distributore, descrizione del box, ruoli e menabò, come nella pagina degli insight.
 */
export function opzioniDelKit(
  kit: KitInsight,
  righe: readonly RigaReferenza[],
  box: readonly BoxKit[],
  pdf: PdfVolantino | null,
  contesto: ContestoConfig,
  agenzia?: InsightVolantinoAgenzia,
): OpzioniInsight {
  const reparti = new Map(righe.map(riga => [riga.id, repartoConfigurato(riga, contesto)] as const));
  const meccaniche = new Map(righe.map(riga => [riga.id, meccanicaOriginale(riga, contesto)] as const));
  const fuoriListino = codiciFuoriListino(kit);
  return {
    totalePagine: pagineDelKit(pdf, box),
    anagraficaReparti: contesto.anagraficaReparti,
    marcheDistributore: contesto.marcheDistributore,
    repartoConfigurato: idReferenza => reparti.get(idReferenza) ?? null,
    meccanicaOriginale: idReferenza => meccaniche.get(idReferenza) ?? null,
    urlFoto: guid => urlFotoOlimpo(guid, { performante: true }),
    origine: kit.storico ? codiceBox => (fuoriListino.has(codiceBox) ? 'fuori_listino' : 'listino') : undefined,
    risolviReparto: contesto.risolviReparto,
    ...opzioniDellAgenzia(agenzia, righe),
  };
}

/** La config degli insight letta, come ContestoConfig: ConfigService.getFlyerInsightsConfig. */
export type FonteConfigInsightGdo = Pick<IConfigService, 'getFlyerInsightsConfig'>;

/**
 * Il contesto degli insight per la GDO di un kit: la sua config degli insight (o quella del file
 * dell'installazione) e i suoi reparti salvati. Se la config manca o non si legge si prosegue con
 * la sola lettura generica, con un avviso nel log.
 */
export async function contestoDellaGdo(
  config: FonteConfigInsightGdo,
  reparti: FonteRepartiGdo,
  idGdo: string | null,
  chi: string,
): Promise<ContestoConfig> {
  let contesto: ContestoConfig;
  try {
    contesto = contestoDallaConfig(await config.getFlyerInsightsConfig(idGdo));
  } catch (error) {
    log.warn(`${chi}: config degli insight non disponibile, si usa la sola lettura generica`, {
      idGdo,
      errore: error instanceof Error ? error.message : String(error),
    });
    contesto = contestoDallaConfig(null);
  }
  const risolutore = await caricaRisolutoreReparti(reparti, idGdo, contesto.anagraficaReparti, chi);
  return risolutore.vuoto ? contesto : { ...contesto, risolviReparto: reparto => risolutore.risolvi(reparto) };
}

export const riferimentoDelKit = (kit: KitInsight): VolantinoDiRiferimento => ({
  idKit: kit.id,
  titolo: kit.titolo,
  idPromo: kit.idPromo,
  nomePromo: kit.nomePromo,
  area: kit.area,
  canale: kit.canale,
  validitaDal: kit.validitaDal,
  validitaAl: kit.validitaAl,
  storico: kit.storico,
});

const confrontaTesti = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Dall'edizione piu' recente, come l'SQL: data, poi la promo che finisce dopo, titolo e id. */
const dalPiuRecente = (a: KitInsight, b: KitInsight): number =>
  confrontaTesti(b.data, a.data)
  || confrontaTesti(b.validitaAl ?? '', a.validitaAl ?? '')
  || confrontaTesti(a.titolo, b.titolo)
  || confrontaTesti(a.id, b.id);

const stessoId = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Al massimo MAX_TAPPE_VIAGGIO tappe dalla piu' recente. Il volantino da cui si e' aperto il viaggio
 * resta sempre: se e' piu' vecchio delle altre prende il posto dell'ultima, cosi' chi lo apre da un
 * volantino di anni fa lo ritrova nel grafico.
 */
export function limitaTappe(tappe: readonly TappaProdotto[], massimo = MAX_TAPPE_VIAGGIO): TappaProdotto[] {
  if (tappe.length <= massimo) return [...tappe];
  const prime = tappe.slice(0, massimo);
  if (prime.some(tappa => tappa.questoVolantino)) return prime;
  const questa = tappe.find(tappa => tappa.questoVolantino);
  return questa ? [...prime.slice(0, massimo - 1), questa] : prime;
}

export class InsightConfrontiService implements IInsightConfrontiService {
  private readonly riepiloghi: AnalisiKitService;

  constructor(
    private readonly repository: IInsightConfrontiRepository,
    private readonly analisi: RepositoryAnalisiViaggio,
    private readonly config: FonteConfigInsightGdo,
    private readonly letture: LettureKitInsight = LETTURE_PREDEFINITE,
    private readonly reparti: FonteRepartiGdo = SENZA_REPARTI_GDO,
  ) {
    this.riepiloghi = new AnalisiKitService(analisi, 'Insight volantino');
  }

  // ─── Kit e config ──────────────────────────────────────────────────

  /** Il kit, se esiste ed e' nell'ambito GDO; un id che non e' un UUID e' una richiesta non valida. */
  private async kitNellAmbito(idKit: string, ambito: AmbitoGdo): Promise<KitInsight> {
    if (!UUID.test(idKit)) throw new BadRequestError({ message: "Volantino non valido: serve l'id del kit" });
    const kit = await this.letture.kitNellAmbito(idKit, ambito);
    if (!kit) throw new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: idKit });
    return kit;
  }

  /** La config degli insight e i reparti della GDO del kit; senza config, la sola lettura generica. */
  private contestoConfig(kit: KitInsight): Promise<ContestoConfig> {
    return contestoDellaGdo(this.config, this.reparti, kit.gdo, 'Insight volantino');
  }

  private async leggiKit(kit: KitInsight, contesto: ContestoConfig): Promise<KitLetto> {
    const [righe, pdf] = await Promise.all([this.letture.righeDelKit(kit.id), this.letture.pdfDelKit(kit.id)]);
    const box = boxDelKit(righe.map(riga => leggiReferenza(riga, { storico: kit.storico })));
    return { kit, pdf, box, opzioni: opzioniDelKit(kit, righe, box, pdf, contesto) };
  }

  // ─── Edizione precedente (report PDF) ──────────────────────────────

  async edizionePrecedente(idKit: string, ambito: AmbitoGdo): Promise<ConfrontoEdizione | null> {
    const kit = await this.kitNellAmbito(idKit, ambito);
    const precedente = await this.repository.edizionePrecedente(kit);
    return precedente ? this.confrontoEdizione(kit, precedente) : null;
  }

  private async confrontoEdizione(kit: KitInsight, precedente: KitInsight): Promise<ConfrontoEdizione> {
    // Le due edizioni sono della stessa GDO: stessa config e stessi reparti
    const contesto = await this.contestoConfig(kit);
    const [attuale, prima] = await Promise.all([this.leggiKit(kit, contesto), this.leggiKit(precedente, contesto)]);
    const sezioniAttuale = sezioniInsight(attuale.box, attuale.opzioni);
    const sezioniPrima = sezioniInsight(prima.box, prima.opzioni);
    return {
      edizione: riferimentoDelKit(precedente),
      sintesi: confrontoSintesi(sezioniAttuale.sintesi, sezioniPrima.sintesi),
      spazioPerReparto: confrontoSpazioPerReparto(sezioniAttuale.spazio.perReparto, sezioniPrima.spazio.perReparto),
      prodottiEntrati: prodottiAssenti(attuale.box, prima.box),
      prodottiUsciti: prodottiAssenti(prima.box, attuale.box),
    };
  }

  // ─── Viaggio del prodotto ──────────────────────────────────────────

  async viaggioProdotto(idKit: string, chiave: string, ambito: AmbitoGdo): Promise<ViaggioProdotto> {
    if (!CHIAVE_PRODOTTO.test(chiave)) throw new BadRequestError({ message: 'Prodotto non valido' });
    const kit = await this.kitNellAmbito(idKit, ambito);
    const nonTrovato = () => new NotFoundError({ message: 'Prodotto non trovato nei volantini della GDO', entityType: 'Referenza', entityId: chiave });

    // Il kit di partenza c'e' sempre, anche se e' piu' vecchio dei volantini letti per il viaggio
    const dellaGdo = await this.repository.kitDellaGdoPerViaggio(kit);
    const volantini = [...dellaGdo, ...(dellaGdo.some(voce => stessoId(voce.id, kit.id)) ? [] : [kit])].sort(dalPiuRecente);
    const idVolantini = volantini.map(voce => voce.id);

    // Prima i riepiloghi di tutti (calcolati e salvati se mancano), poi solo il prodotto in ognuno
    const [, righe] = await Promise.all([this.riepiloghi.aggregati(idVolantini), this.letture.righeDelKit(kit.id)]);
    const presenze = await this.analisi.presenzeProdotto(idVolantini, chiave);
    const nelKit = trovaNeiBox(chiave, boxDelKit(righe.map(riga => leggiReferenza(riga, { storico: kit.storico }))));

    const tutte = volantini.flatMap((volantino): TappaProdotto[] => {
      const prodotto = presenze.get(volantino.id);
      if (!prodotto) return [];
      const questoVolantino = stessoId(volantino.id, kit.id);
      // Il riepilogo salvato non ha lo sconto stampato: dai prezzi, per tutte le tappe allo stesso modo
      const sconto = scontoDaiPrezzi(prodotto.prezzo, prodotto.barrato) ?? (questoVolantino ? nelKit?.prodotto.sconto ?? null : null);
      return [tappaDi(volantino, prodotto, sconto, questoVolantino)];
    });
    const tappe = limitaTappe(tutte);
    if (tappe.length === 0) throw nonTrovato();

    if (nelKit && nelKit.prodotto.foto.length > 0) {
      const { nome, marca, formato, foto } = nelKit.prodotto;
      return { chiave, nome, marca, formato, foto: foto.map(guid => urlFotoOlimpo(guid, { performante: true })), tappe };
    }

    // Nome e foto dalle descrizioni dei volantini piu' recenti (un elemento del gruppo non ha foto proprie)
    const conFoto = tutte.filter(tappa => presenze.get(tappa.idKit)?.conFoto).slice(0, KIT_PER_FOTO_VIAGGIO).map(tappa => tappa.idKit);
    const daDescrivere = [...new Set([tutte[0].idKit, ...conFoto])];
    const trovate = await this.analisi.descrizioniProdotti(daDescrivere.map(id => ({ idKit: id, chiave })));
    const descrizioni = daDescrivere.flatMap(id => {
      const descrizione = trovate.get(chiaveDescrizione(id, chiave));
      return descrizione ? [descrizione] : [];
    });
    const intestazione = nelKit?.prodotto ?? descrizioni[0] ?? null;
    const foto = [...new Set(descrizioni.flatMap(descrizione => (descrizione.foto ? [descrizione.foto] : [])))];
    return {
      chiave,
      nome: intestazione?.nome ?? DESCRIZIONE_ASSENTE,
      marca: intestazione?.marca ?? null,
      formato: intestazione?.formato ?? null,
      foto: foto.map(guid => urlFotoOlimpo(guid, { performante: true })),
      tappe,
    };
  }
}

function tappaDi(volantino: KitInsight, prodotto: ProdottoNelKit, sconto: number | null, questoVolantino: boolean): TappaProdotto {
  return {
    idKit: volantino.id,
    titolo: volantino.titolo,
    data: volantino.data,
    area: volantino.area,
    canale: volantino.canale,
    prezzo: prodotto.prezzo,
    barrato: prodotto.barrato,
    sconto,
    sottocosto: prodotto.sottocosto,
    meccanica: prodotto.meccanica,
    pagina: prodotto.pagina,
    spazio: prodotto.spazio,
    questoVolantino,
  };
}
