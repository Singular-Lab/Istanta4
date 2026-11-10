import type { Writable } from 'stream';
import {
  isPeriodoConsultazione,
  PeriodoConsultazione,
  periodoConsultazioneDellaPromo,
  STATI_PROMO_CONSULTABILI,
  STATI_PROMO_CONSULTAZIONE,
} from '../../../lib/consultazione/periodi';
import {
  ContenutoDigitale,
  DettaglioPromozioneVolantiniConsultazione,
  DettaglioVolantinoConsultazione,
  DIMENSIONE_MASSIMA_CONTENUTI_DIGITALI,
  DIMENSIONE_MASSIMA_VOLANTINI_CONSULTAZIONE,
  DIMENSIONE_PAGINA_CONTENUTI_DIGITALI,
  DIMENSIONE_PAGINA_VOLANTINI_CONSULTAZIONE,
  ElencoPromozioniPopConsultazione,
  FileConsultazione,
  FilePopConsultazione,
  FiltriContenutiDigitali,
  FiltriFilePopConsultazione,
  FiltriPromozioniVolantiniConsultazione,
  FiltriVolantiniConsultazione,
  FiltriZipPopConsultazione,
  FormatoPopConsultazione,
  MOTIVO_VETRINA_DEL_PERIODO,
  OpzioniContenutiDigitali,
  OpzioniFilePopConsultazione,
  PaginaContenutiDigitali,
  PaginaFilePopConsultazione,
  PaginaPromozioniVolantiniConsultazione,
  PaginaVolantiniConsultazione,
  PromoConsultazione,
  PromozioneVolantiniConsultazione,
  Riferimento,
  RichiestaZipPopConsultazione,
  RiepilogoPopConsultazione,
  VarianteConsultazione,
  VerificaZipPopConsultazione,
  VetrinaVolantiniConsultazione,
  VolantinoConsultazione,
} from '../../../lib/consultazione/tipi';
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { BadRequestError, NotFoundError, ServiceUnavailableError } from '../../../lib/errors';
import { urlOlimpo } from '../../../lib/olimpo/url';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { ErroreRispostaOlimpo, motivoFileNonScaricato, scaricaMaterialePdf } from '../http/olimpo';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IConsultazioneService, FileScaricato } from '../interfaces/IConsultazioneService';
import type { EsitoZipOlimpo } from '../interfaces/IFileManagementService';
import type { ZipPop } from '../interfaces/IMaterialiService';
import { log } from '../logger';
import type {
  IConsultazioneRepository,
  RigaContenutoDigitale,
  RigaFileConsultazione,
  RigaOpzioneContenutoDigitale,
} from '../repositories/ConsultazioneRepository';
import { kitNellAmbito, pdfDelKit, righeDelKit } from '../repositories/InsightVolantinoRepository';
import type {
  CriteriKit,
  FiltriSqlFile,
  FiltriSqlKit,
  FiltriSqlPromoVolantini,
  IMaterialiRepository,
  RigaAreaCanale,
  RigaFile,
  RigaKit,
  RigaPromo,
  RigaPuntiVenditaPromo,
  RigaVarianteVolantino,
} from '../repositories/MaterialiRepository';
import { boxDelKit } from '../utils/analisiKit';
import { sezioniInsight } from '../utils/insightVolantino';
import { aggregaPromozioneVolantini, type KitConInsight } from '../utils/promozioneVolantini';
import { leggiReferenza } from '../utils/referenzaStampata';
import { trovaConfigInstallazione } from './configPerGdo';
import { type ContestoConfig, contestoDellaGdo, type LettureKitInsight, opzioniDelKit } from './InsightConfrontiService';
import { type FonteRepartiGdo, SENZA_REPARTI_GDO } from '../utils/repartiGdo';
import {
  annoOpzionale,
  confrontaTesto,
  dataIso,
  dimensionePaginaPop,
  dimensionePaginaPromozioniVolantini,
  formatoObbligatorio,
  nomeArchivioPop,
  paginaRichiesta,
  type ScrittoreZipOlimpo,
  testoPulito,
  uuidOpzionale,
  vociZipPop,
} from './MaterialiService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un campo dei metadati configurato per la ricerca: solo nomi semplici. */
const CAMPO_METADATI = /^[\w.-]{1,100}$/;

/** Il PDF (o il file) di Olimpo; nei test si sostituisce. */
export type LettoreFileOlimpo = (idOlimpo: string) => Promise<Buffer>;
/** Campi dei metadati dei file in cui cerca Contenuti digitali (configurazione dell'installazione). */
export type FonteCampiRicerca = () => Promise<string[]>;

/** I campi `webpliant.data_fields_files` della configurazione dell'installazione. */
export const campiRicercaDaConfigurazione: FonteCampiRicerca = async () => {
  const configurazione = await trovaConfigInstallazione({ raw: true });
  const campi: unknown = configurazione?.webpliant?.data_fields_files;
  return Array.isArray(campi) ? campi.filter((campo): campo is string => typeof campo === 'string') : [];
};

/** La config degli insight del volantino (ConfigService): reparti, meccanica e marche del distributore. */
export type FonteConfigInsight = Pick<IConfigService, 'getFlyerInsightsConfig'>;

/**
 * Senza config valgono la lettura generica delle referenze e i campi predefiniti, come negli insight
 * quando la config manca: il container passa il ConfigService, i test possono non farlo.
 */
const SENZA_CONFIG_INSIGHT: FonteConfigInsight = { getFlyerInsightsConfig: async () => ({}) };

/** Le stesse letture del kit degli insight del volantino (InsightVolantinoRepository). */
const LETTURE_KIT_INSIGHT: LettureKitInsight = { kitNellAmbito, pdfDelKit, righeDelKit };

/** Kit letti insieme per gli insight del dettaglio della promozione: ognuno sono due query sulle referenze. */
const KIT_INSIGHT_IN_PARALLELO = 4;

/** Il lavoro su ogni voce, al massimo `limite` alla volta; i risultati nell'ordine delle voci. */
async function aGruppi<T, R>(voci: readonly T[], limite: number, lavoro: (voce: T) => Promise<R>): Promise<R[]> {
  const risultati: R[] = new Array<R>(voci.length);
  let prossima = 0;
  const lavoratore = async (): Promise<void> => {
    while (prossima < voci.length) {
      const indice = prossima;
      prossima += 1;
      risultati[indice] = await lavoro(voci[indice]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, voci.length) }, lavoratore));
  return risultati;
}

/* ---------- Validazione ---------- */

export function verificaPeriodoConsultazione(valore: unknown): PeriodoConsultazione {
  if (!isPeriodoConsultazione(valore)) {
    throw new BadRequestError({ message: 'Periodo mancante o non valido: usa attivi, prossimi o storico.' });
  }
  return valore;
}

function dimensioneTra(valore: unknown, predefinita: number, massima: number): number {
  return typeof valore === 'number' && Number.isFinite(valore) && valore >= 1
    ? Math.min(Math.floor(valore), massima)
    : predefinita;
}

/** Un id che non e' un UUID non esiste: 404, come un id di un'altra GDO. */
function idEsistente(valore: string, entityType: string, message: string): string {
  if (!UUID.test(valore)) throw new NotFoundError({ message, entityType, entityId: valore });
  return valore;
}

const VOLANTINO_NON_DISPONIBILE = 'Volantino non disponibile: non è pubblicato o non è della tua GDO.';
const PROMO_NON_DISPONIBILE = 'Promozione non disponibile tra quelle del periodo.';
const FILE_NON_DISPONIBILE = 'File non disponibile: non è di un materiale pubblicato della tua GDO.';
const PROMOZIONE_VOLANTINI_NON_DISPONIBILE = 'Promozione non disponibile: non ha volantini pubblicati o non è della tua GDO.';

/** promo.id_promo e' un VARCHAR(255). */
const LUNGHEZZA_MASSIMA_ID_PROMO = 255;

const carattereStampabile = (carattere: string): boolean => {
  const codice = carattere.charCodeAt(0);
  return codice >= 32 && codice !== 127;
};

/**
 * Gli id delle promo sono testo, non sempre UUID (le promo arrivano anche da Istanta): basta un testo
 * non vuoto, non piu' lungo della colonna, senza caratteri di controllo. Un id che non lo e' non
 * esiste: 404, come una promo di un'altra GDO.
 */
function idPromoEsistente(valore: unknown): string {
  const id = typeof valore === 'string' ? valore : '';
  if (id.trim() === '' || id.length > LUNGHEZZA_MASSIMA_ID_PROMO || ![...id].every(carattereStampabile)) {
    throw new NotFoundError({ message: PROMOZIONE_VOLANTINI_NON_DISPONIBILE, entityType: 'Promo', entityId: id.slice(0, LUNGHEZZA_MASSIMA_ID_PROMO) });
  }
  return id;
}

/* ---------- Conversioni ---------- */

const promoDa = (riga: RigaPromo): PromoConsultazione => ({
  id: riga.id_promo,
  nome: riga.nome_promo,
  validitaDal: dataIso(riga.validita_dal),
  validitaAl: dataIso(riga.validita_al),
});

const pagine = (valore: unknown): number | null => (Number(valore) > 0 ? Number(valore) : null);

const anteprima = (idOlimpo: string | null | undefined): string | null =>
  idOlimpo ? urlOlimpo('/materiali/getThumbnailMaterialePdfs', { id: idOlimpo }) : null;

/** Copertina di un kit volantino: il file dell'export volantino su Olimpo, se c'e'. */
function copertinaDa(riga: Pick<RigaKit, 'copertina_id_file' | 'copertina_id_olimpo' | 'copertina_nome' | 'copertina_mime' | 'copertina_pagine'>): FileConsultazione | null {
  if (!riga.copertina_id_file || !riga.copertina_id_olimpo) return null;
  return {
    id: riga.copertina_id_file,
    nome: riga.copertina_nome ?? '',
    tipoExport: EXPORT_DI_SISTEMA.VOL,
    mime: riga.copertina_mime ?? null,
    pagine: pagine(riga.copertina_pagine),
    anteprima: anteprima(riga.copertina_id_olimpo),
  };
}

export function fileDa(riga: RigaFileConsultazione): FileConsultazione {
  return {
    id: riga.id,
    nome: riga.nome_originale || riga.nome || '',
    tipoExport: riga.tipo_export || null,
    mime: riga.mime ?? null,
    pagine: pagine(riga.pagine),
    anteprima: anteprima(riga.id_olimpo_cloud),
  };
}

function volantinoDa(riga: RigaKit): VolantinoConsultazione {
  return {
    id: riga.id,
    titolo: riga.titolo,
    promo: promoDa(riga),
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    numeroFile: Number(riga.numero_file) || 0,
    copertina: copertinaDa(riga),
  };
}

function varianteDa(riga: RigaVarianteVolantino): VarianteConsultazione {
  return {
    id: riga.id,
    titolo: riga.titolo,
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    numeroFile: Number(riga.numero_file) || 0,
    numeroPuntiVendita: Number(riga.numero_punti_vendita) || 0,
    copertina: copertinaDa(riga),
  };
}

/** Per canale, area e titolo: le varianti dello stesso canale stanno vicine. */
function confrontaVarianti(a: VarianteConsultazione, b: VarianteConsultazione): number {
  return confrontaTesto(a.canale.nome, b.canale.nome)
    || confrontaTesto(a.area.nome, b.area.nome)
    || confrontaTesto(a.titolo, b.titolo)
    || a.id.localeCompare(b.id);
}

/**
 * Le promo della pagina, nel loro ordine, ciascuna con i kit che corrispondono ai filtri. Gli
 * altri contano nel totale della promo e, se nessun kit mostrato ne ha una, danno la copertina.
 * I punti vendita diversi dei kit mostrati arrivano gia' contati per promo (contaPuntiVenditaPromoVolantini):
 * non sono la somma di quelli dei kit, perche' un punto vendita stampato in piu' kit conta una volta.
 */
export function promozioniConVarianti(
  righePromo: RigaPromo[],
  righeKit: RigaVarianteVolantino[],
  righePuntiVendita: readonly RigaPuntiVenditaPromo[] = []
): PromozioneVolantiniConsultazione[] {
  const puntiVenditaPerPromo = new Map(righePuntiVendita.map(riga => [riga.id_promo, Number(riga.punti_vendita) || 0]));
  const kitPerPromo = new Map<string, RigaVarianteVolantino[]>();
  for (const riga of righeKit) {
    const dellaPromo = kitPerPromo.get(riga.id_promo);
    if (dellaPromo) dellaPromo.push(riga);
    else kitPerPromo.set(riga.id_promo, [riga]);
  }
  return righePromo.map(rigaPromo => {
    const tutti = (kitPerPromo.get(rigaPromo.id_promo) ?? [])
      .map(riga => ({ variante: varianteDa(riga), corrisponde: riga.corrisponde === true }))
      .sort((a, b) => confrontaVarianti(a.variante, b.variante));
    const mostrati = tutti.filter(kit => kit.corrisponde).map(kit => kit.variante);
    const copertina = mostrati.find(kit => kit.copertina)?.copertina
      ?? tutti.find(kit => kit.variante.copertina)?.variante.copertina
      ?? null;
    return {
      promo: promoDa(rigaPromo),
      copertina,
      numeroKit: tutti.length,
      kit: mostrati,
      numeroPuntiVendita: puntiVenditaPerPromo.get(rigaPromo.id_promo) ?? 0,
    };
  });
}

const chiave = (id: string): string => id.toLowerCase();
const perNome = (a: Riferimento, b: Riferimento): number => confrontaTesto(a.nome, b.nome) || a.id.localeCompare(b.id);

/** Riferimenti senza ripetizioni (id senza distinguere maiuscole), per nome. */
function riferimentiUnici(voci: Array<{ id: string | null; nome: string | null }>): Riferimento[] {
  const unici = new Map<string, Riferimento>();
  for (const { id, nome } of voci) {
    if (id && !unici.has(chiave(id))) unici.set(chiave(id), { id, nome: nome ?? '' });
  }
  return [...unici.values()].sort(perNome);
}

function areeECanali(righe: RigaAreaCanale[]): { aree: Riferimento[]; canali: Riferimento[] } {
  return {
    aree: riferimentiUnici(righe.map(riga => ({ id: riga.id_area, nome: riga.nome_area }))),
    canali: riferimentiUnici(righe.map(riga => ({ id: riga.id_canale, nome: riga.nome_canale }))),
  };
}

function filePopDa(riga: RigaFile): FilePopConsultazione {
  const codice = riga.codice_referenza || null;
  const descrizione = riga.descrizione_referenza || null;
  return {
    id: riga.id,
    nome: riga.nome ?? '',
    tipoExport: null,
    mime: riga.mime ?? null,
    pagine: pagine(riga.pagine),
    anteprima: anteprima(riga.id_olimpo_cloud),
    kit: { id: riga.id_kit, titolo: riga.titolo_kit },
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    referenza: codice || descrizione ? { codice, descrizione } : null,
    reparto: riga.reparto || null,
  };
}

function contenutoDa(riga: RigaContenutoDigitale): ContenutoDigitale {
  return {
    ...fileDa(riga),
    kit: { id: riga.id_kit, titolo: riga.titolo_kit },
    promo: promoDa(riga),
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    formato: { id: riga.id_formato ?? '', nome: riga.nome_formato ?? '' },
  };
}

/** Valori dei filtri dei contenuti digitali: promo dalla piu' recente, il resto per nome. */
export function opzioniContenutiDa(righe: RigaOpzioneContenutoDigitale[]): OpzioniContenutiDigitali {
  const promozioni = new Map<string, { id: string; nome: string; dal: string }>();
  for (const riga of righe) {
    if (!promozioni.has(riga.id_promo)) {
      promozioni.set(riga.id_promo, { id: riga.id_promo, nome: riga.nome_promo, dal: dataIso(riga.validita_dal) ?? '' });
    }
  }
  return {
    promozioni: [...promozioni.values()]
      .sort((a, b) => b.dal.localeCompare(a.dal) || confrontaTesto(a.nome, b.nome))
      .map(({ id, nome }) => ({ id, nome })),
    tipiExport: riferimentiUnici(righe.map(riga => ({ id: riga.id_tipo_export, nome: riga.nome_tipo_export }))),
    formati: riferimentiUnici(righe.map(riga => ({ id: riga.id_formato, nome: riga.nome_formato }))),
    aree: riferimentiUnici(righe.map(riga => ({ id: riga.id_area, nome: riga.nome_area }))),
    canali: riferimentiUnici(righe.map(riga => ({ id: riga.id_canale, nome: riga.nome_canale }))),
  };
}

function filtriSqlFilePop(filtri: FiltriZipPopConsultazione | undefined): FiltriSqlFile {
  return {
    cerca: testoPulito(filtri?.cerca),
    idArea: uuidOpzionale(filtri?.idArea, 'Area'),
    idCanale: uuidOpzionale(filtri?.idCanale, 'Canale'),
    reparto: testoPulito(filtri?.reparto),
  };
}

const nienteDaScaricare = (idFormato: string): NotFoundError =>
  new NotFoundError({ message: 'Nessun file da scaricare per questa selezione.', entityType: 'FilePop', entityId: idFormato });

/* ---------- Servizio ---------- */

export class ConsultazioneService implements IConsultazioneService {
  constructor(
    private readonly materiali: IMaterialiRepository,
    private readonly repository: IConsultazioneRepository,
    private readonly scrittoreZip: ScrittoreZipOlimpo,
    private readonly leggiFileOlimpo: LettoreFileOlimpo = scaricaMaterialePdf,
    private readonly campiRicerca: FonteCampiRicerca = campiRicercaDaConfigurazione,
    private readonly configInsight: FonteConfigInsight = SENZA_CONFIG_INSIGHT,
    private readonly lettureInsight: LettureKitInsight = LETTURE_KIT_INSIGHT,
    // Nome per il marketing e colore dei reparti della GDO (Impostazioni GDO) nell'assortimento
    private readonly repartiGdo: FonteRepartiGdo = SENZA_REPARTI_GDO
  ) { }

  /** Solo kit pubblicati del tipo indicato, nelle promo del periodo e della GDO dell'ambito. */
  private criteri(periodo: PeriodoConsultazione, tipoLavorazione: TIPO_LAVORAZIONE, ambito: AmbitoGdo): CriteriKit {
    return {
      statiPromo: STATI_PROMO_CONSULTAZIONE[periodo],
      statiKit: [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO],
      tipoLavorazione,
      ambitoGdo: ambito,
    };
  }

  async getVolantini(filtri: FiltriVolantiniConsultazione, ambito: AmbitoGdo): Promise<PaginaVolantiniConsultazione> {
    const periodo = verificaPeriodoConsultazione(filtri.periodo);
    const pagina = paginaRichiesta(filtri.pagina);
    const dimensione = dimensioneTra(filtri.dimensione, DIMENSIONE_PAGINA_VOLANTINI_CONSULTAZIONE, DIMENSIONE_MASSIMA_VOLANTINI_CONSULTAZIONE);
    const filtriKit: FiltriSqlKit = {
      cerca: testoPulito(filtri.cerca),
      idPromo: uuidOpzionale(filtri.idPromo, 'Promozione'),
      idArea: uuidOpzionale(filtri.idArea, 'Area'),
      idCanale: uuidOpzionale(filtri.idCanale, 'Canale'),
    };
    const criteri = this.criteri(periodo, TIPO_LAVORAZIONE.VOLANTINO, ambito);
    const [righe, totale] = await Promise.all([
      this.materiali.elencaKit(criteri, { filtri: filtriKit, limite: dimensione, scarto: (pagina - 1) * dimensione, conCopertina: true }),
      this.materiali.contaKit(criteri, filtriKit),
    ]);
    return { kit: righe.map(volantinoDa), totale, pagina, dimensione };
  }

  async getPromozioniVolantini(
    filtri: FiltriPromozioniVolantiniConsultazione,
    ambito: AmbitoGdo
  ): Promise<PaginaPromozioniVolantiniConsultazione> {
    const periodo = verificaPeriodoConsultazione(filtri.periodo);
    const pagina = paginaRichiesta(filtri.pagina);
    const dimensione = dimensionePaginaPromozioniVolantini(filtri.dimensione);
    const filtriPromo: FiltriSqlPromoVolantini = {
      cerca: testoPulito(filtri.cerca),
      idPromo: uuidOpzionale(filtri.idPromo, 'Promozione'),
      idArea: uuidOpzionale(filtri.idArea, 'Area'),
      idCanale: uuidOpzionale(filtri.idCanale, 'Canale'),
      anno: annoOpzionale(filtri.anno),
    };
    const criteri = this.criteri(periodo, TIPO_LAVORAZIONE.VOLANTINO, ambito);
    const conFiltri = Object.values(filtriPromo).some(valore => valore !== undefined);

    // La promo in vetrina solo senza filtri: sta fuori dall'elenco e dai totali della paginazione
    const motivo = MOTIVO_VETRINA_DEL_PERIODO[periodo];
    const rigaVetrina = conFiltri ? null : await this.materiali.trovaPromoInVetrina(criteri, motivo);
    const criteriElenco: CriteriKit = rigaVetrina ? { ...criteri, escludiPromo: rigaVetrina.id_promo } : criteri;

    const [righePromo, totali, riepilogo, righeAreeCanali, anni, promozioni] = await Promise.all([
      this.materiali.elencaPromoVolantini(criteriElenco, filtriPromo, { limite: dimensione, scarto: (pagina - 1) * dimensione }),
      this.materiali.contaPromoVolantini(criteriElenco, filtriPromo),
      // Il riepilogo e' sempre del periodo intero, vetrina compresa: le promo sono anche il totale senza filtri
      this.materiali.riepilogoPromoVolantini(criteri),
      this.materiali.elencaAreeCanaliVolantini(criteri, periodo === 'storico'),
      this.materiali.elencaAnniPromoVolantini(criteri),
      // Nello Storico le promo sono centinaia: si cercano per nome e anno, non da una tendina
      periodo === 'storico' ? Promise.resolve([] as RigaPromo[]) : this.materiali.elencaPromoVolantini(criteri),
    ]);
    // Senza filtri ogni kit corrisponde: la vetrina ha tutti i suoi kit volantino pubblicati
    const idPromoKit = righePromo.map(riga => riga.id_promo);
    if (rigaVetrina) idPromoKit.push(rigaVetrina.id_promo);
    const [righeKit, righePuntiVendita] = await Promise.all([
      this.materiali.elencaVariantiVolantini(criteri, idPromoKit, filtriPromo),
      this.materiali.contaPuntiVenditaPromoVolantini(criteri, idPromoKit, filtriPromo),
    ]);
    const vetrina: VetrinaVolantiniConsultazione | null = rigaVetrina
      ? { motivo, promozione: promozioniConVarianti([rigaVetrina], righeKit, righePuntiVendita)[0] }
      : null;

    return {
      promozioni: promozioniConVarianti(righePromo, righeKit, righePuntiVendita),
      totale: totali.promozioni,
      totaleKit: totali.kit,
      totaleSenzaFiltri: riepilogo.promozioni,
      pagina,
      dimensione,
      vetrina,
      riepilogo: { promozioni: riepilogo.promozioni, kit: riepilogo.kit, puntiVendita: riepilogo.puntiVendita },
      opzioni: {
        promozioni: promozioni.map(riga => ({ id: riga.id_promo, nome: riga.nome_promo })),
        ...areeECanali(righeAreeCanali),
        anni,
      },
    };
  }

  async getVolantino(idKit: string, ambito: AmbitoGdo): Promise<DettaglioVolantinoConsultazione> {
    const id = idEsistente(idKit, 'KitRuntime', VOLANTINO_NON_DISPONIBILE);
    const kit = await this.repository.trovaKitPubblicato(id, ambito);
    if (!kit) throw new NotFoundError({ message: VOLANTINO_NON_DISPONIBILE, entityType: 'KitRuntime', entityId: id });
    const file = await this.repository.elencaFileKit(kit.id);
    return {
      id: kit.id,
      titolo: kit.titolo,
      promo: promoDa(kit),
      area: { id: kit.id_area, nome: kit.nome_area },
      canale: { id: kit.id_canale, nome: kit.nome_canale },
      file: file.map(fileDa),
    };
  }

  /**
   * Il dettaglio di consultazione della promozione (spec volantini-pop): i suoi kit volantino
   * pubblicati, nella GDO dell'ambito, con i numeri dei loro insight e le righe dei punti vendita
   * stampate. Il periodo viene dallo stato della promo, non dalla richiesta.
   */
  async getPromozioneVolantini(idPromo: string, ambito: AmbitoGdo): Promise<DettaglioPromozioneVolantiniConsultazione> {
    const id = idPromoEsistente(idPromo);
    const nonDisponibile = () => new NotFoundError({ message: PROMOZIONE_VOLANTINI_NON_DISPONIBILE, entityType: 'Promo', entityId: id });
    const rigaPromo = await this.repository.trovaPromo(id, STATI_PROMO_CONSULTABILI, ambito);
    const periodo = periodoConsultazioneDellaPromo(rigaPromo?.stato_promo);
    if (!rigaPromo || !periodo) throw nonDisponibile();

    // Gli stessi kit dell'elenco Volantini: pubblicati, dei formati volantino, non manuali
    const criteri = this.criteri(periodo, TIPO_LAVORAZIONE.VOLANTINO, ambito);
    const righeKit = await this.materiali.elencaVariantiVolantini(criteri, [rigaPromo.id_promo]);
    if (righeKit.length === 0) throw nonDisponibile();
    const varianti = righeKit.map(varianteDa).sort(confrontaVarianti);

    // Config degli insight e reparti della GDO dei kit (tutti della GDO della promo): letti una volta
    const contesti = new Map<string, Promise<ContestoConfig>>();
    const contestoDellaGdoDelKit = (idGdo: string | null): Promise<ContestoConfig> => {
      const chiave = idGdo ?? '';
      const giaChiesto = contesti.get(chiave);
      if (giaChiesto !== undefined) return giaChiesto;
      const contesto = contestoDellaGdo(this.configInsight, this.repartiGdo, idGdo, 'Dettaglio della promozione');
      contesti.set(chiave, contesto);
      return contesto;
    };
    const [righePuntiVendita, kit] = await Promise.all([
      this.materiali.elencaPuntiVenditaVolantini(criteri, rigaPromo.id_promo),
      aGruppi(varianti, KIT_INSIGHT_IN_PARALLELO, variante => this.insightDelKit(variante, ambito, contestoDellaGdoDelKit)),
    ]);
    const { kit: kitConNumeri, numeri, puntiVendita, assortimento } = aggregaPromozioneVolantini(kit, righePuntiVendita);
    return { promo: promoDa(rigaPromo), periodo, kit: kitConNumeri, numeri, puntiVendita, assortimento };
  }

  /**
   * Le sezioni degli insight di un kit, lette come negli insight del volantino (InsightConfrontiService):
   * un kit senza referenze ha zero box. Un kit che non si trova piu' fra l'elenco e questa lettura
   * vale come un kit senza referenze.
   */
  private async insightDelKit(
    variante: VarianteConsultazione,
    ambito: AmbitoGdo,
    contestoDellaGdoDelKit: (idGdo: string | null) => Promise<ContestoConfig>
  ): Promise<KitConInsight> {
    const kit = await this.lettureInsight.kitNellAmbito(variante.id, ambito);
    if (!kit) {
      const { sintesi, box } = sezioniInsight([], { totalePagine: 0, anagraficaReparti: [], marcheDistributore: [], urlFoto: guid => guid });
      return { variante, sintesi, box };
    }
    const [righe, pdf, contesto] = await Promise.all([
      this.lettureInsight.righeDelKit(kit.id),
      this.lettureInsight.pdfDelKit(kit.id),
      contestoDellaGdoDelKit(kit.gdo),
    ]);
    const boxKit = boxDelKit(righe.map(riga => leggiReferenza(riga, { storico: kit.storico })));
    const { sintesi, box } = sezioniInsight(boxKit, opzioniDelKit(kit, righe, boxKit, pdf, contesto));
    return { variante, sintesi, box };
  }

  async getPromozioniPop(periodo: PeriodoConsultazione, ambito: AmbitoGdo): Promise<ElencoPromozioniPopConsultazione> {
    const criteri = this.criteri(verificaPeriodoConsultazione(periodo), TIPO_LAVORAZIONE.POP, ambito);
    const righe = await this.materiali.elencaPromoConKit(criteri);
    return {
      promozioni: righe.map(riga => ({
        ...promoDa(riga),
        numeroFile: Number(riga.numero_file) || 0,
        numeroFormati: Number(riga.numero_formati) || 0,
      })),
    };
  }

  /** La promo del periodo e della GDO dell'ambito, altrimenti 404. */
  private async promoDelPeriodo(idPromo: string, periodo: PeriodoConsultazione, ambito: AmbitoGdo): Promise<RigaPromo> {
    const id = idEsistente(idPromo, 'Promo', PROMO_NON_DISPONIBILE);
    const riga = await this.repository.trovaPromo(id, STATI_PROMO_CONSULTAZIONE[periodo], ambito);
    if (!riga) throw new NotFoundError({ message: PROMO_NON_DISPONIBILE, entityType: 'Promo', entityId: id });
    return riga;
  }

  async getRiepilogoPop(idPromo: string, periodo: PeriodoConsultazione, ambito: AmbitoGdo): Promise<RiepilogoPopConsultazione> {
    const periodoValido = verificaPeriodoConsultazione(periodo);
    const rigaPromo = await this.promoDelPeriodo(idPromo, periodoValido, ambito);
    const righe = await this.materiali.elencaKit({ ...this.criteri(periodoValido, TIPO_LAVORAZIONE.POP, ambito), idPromo: rigaPromo.id_promo });

    const formati = new Map<string, FormatoPopConsultazione>();
    for (const riga of righe) {
      let formato = formati.get(chiave(riga.id_formato));
      if (!formato) {
        formato = { id: riga.id_formato, nome: riga.nome_formato, numeroFile: 0, kit: [] };
        formati.set(chiave(riga.id_formato), formato);
      }
      const numeroFile = Number(riga.numero_file) || 0;
      formato.kit.push({
        id: riga.id,
        titolo: riga.titolo,
        area: { id: riga.id_area, nome: riga.nome_area },
        canale: { id: riga.id_canale, nome: riga.nome_canale },
        numeroFile,
      });
      formato.numeroFile += numeroFile;
    }
    const elenco = [...formati.values()].sort((a, b) => confrontaTesto(a.nome, b.nome));
    for (const formato of elenco) {
      formato.kit.sort((a, b) => confrontaTesto(a.area.nome, b.area.nome)
        || confrontaTesto(a.canale.nome, b.canale.nome)
        || confrontaTesto(a.titolo, b.titolo));
    }
    return {
      promo: promoDa(rigaPromo),
      totali: { file: elenco.reduce((totale, formato) => totale + formato.numeroFile, 0), formati: elenco.length },
      formati: elenco,
    };
  }

  async getFilePop(idPromo: string, filtri: FiltriFilePopConsultazione, ambito: AmbitoGdo): Promise<PaginaFilePopConsultazione> {
    const periodo = verificaPeriodoConsultazione(filtri.periodo);
    const idFormato = formatoObbligatorio(filtri.idFormato);
    const filtriFile = filtriSqlFilePop(filtri);
    const pagina = paginaRichiesta(filtri.pagina);
    const dimensione = dimensionePaginaPop(filtri.dimensione);
    const rigaPromo = await this.promoDelPeriodo(idPromo, periodo, ambito);
    const criteri: CriteriKit = { ...this.criteri(periodo, TIPO_LAVORAZIONE.POP, ambito), idPromo: rigaPromo.id_promo, idFormato };
    const [righe, totale] = await Promise.all([
      this.materiali.elencaFile(criteri, filtriFile, { limite: dimensione, scarto: (pagina - 1) * dimensione }),
      this.materiali.contaFile(criteri, filtriFile),
    ]);
    return { file: righe.map(filePopDa), totale, pagina, dimensione };
  }

  async getOpzioniFilePop(
    idPromo: string,
    filtri: Pick<FiltriFilePopConsultazione, 'periodo' | 'idFormato'>,
    ambito: AmbitoGdo
  ): Promise<OpzioniFilePopConsultazione> {
    const periodo = verificaPeriodoConsultazione(filtri.periodo);
    const idFormato = formatoObbligatorio(filtri.idFormato);
    const rigaPromo = await this.promoDelPeriodo(idPromo, periodo, ambito);
    const criteri: CriteriKit = { ...this.criteri(periodo, TIPO_LAVORAZIONE.POP, ambito), idPromo: rigaPromo.id_promo, idFormato };
    const righe = await this.materiali.elencaOpzioniFile(criteri);
    const reparti = new Set<string>();
    for (const riga of righe) if (riga.reparto) reparti.add(riga.reparto);
    return {
      aree: riferimentiUnici(righe.map(riga => ({ id: riga.id_area, nome: riga.nome_area }))),
      canali: riferimentiUnici(righe.map(riga => ({ id: riga.id_canale, nome: riga.nome_canale }))),
      reparti: [...reparti].sort(confrontaTesto),
    };
  }

  /** Regole comuni a verifica e download: periodo, promo della GDO, formato esistente, file scelti o filtri. */
  private async richiestaZip(idPromo: string, richiesta: RichiestaZipPopConsultazione, ambito: AmbitoGdo) {
    const periodo = verificaPeriodoConsultazione(richiesta.periodo);
    const idFormato = formatoObbligatorio(richiesta.idFormato);
    // Con idFile solo quei file: gli id malformati, e piu' avanti quelli fuori da promo e formato, si scartano
    const selezione = Array.isArray(richiesta.idFile) && richiesta.idFile.length > 0
      ? [...new Set(richiesta.idFile.filter((id): id is string => typeof id === 'string' && UUID.test(id)))]
      : undefined;
    const filtriFile: FiltriSqlFile = selezione ? { idFile: selezione } : filtriSqlFilePop(richiesta.filtri);
    const rigaPromo = await this.promoDelPeriodo(idPromo, periodo, ambito);
    const [formato] = await this.materiali.trovaFormati([idFormato]);
    if (!formato) {
      throw new NotFoundError({ message: 'Formato non trovato.', entityType: 'Formato', entityId: idFormato });
    }
    const criteri: CriteriKit = { ...this.criteri(periodo, TIPO_LAVORAZIONE.POP, ambito), idPromo: rigaPromo.id_promo, idFormato };
    return { idFormato, selezione, filtriFile, rigaPromo, nomeFormato: formato.nome_formati, criteri, periodo };
  }

  async verificaZipPop(idPromo: string, richiesta: RichiestaZipPopConsultazione, ambito: AmbitoGdo): Promise<VerificaZipPopConsultazione> {
    const { rigaPromo, nomeFormato, criteri, filtriFile, idFormato } = await this.richiestaZip(idPromo, richiesta, ambito);
    const file = await this.materiali.contaFile(criteri, filtriFile);
    if (file === 0) throw nienteDaScaricare(idFormato);
    return { file, nomeFile: nomeArchivioPop(rigaPromo.nome_promo, nomeFormato) };
  }

  async preparaZipPop(idPromo: string, richiesta: RichiestaZipPopConsultazione, ambito: AmbitoGdo): Promise<ZipPop> {
    const { rigaPromo, nomeFormato, criteri, filtriFile, idFormato, periodo, selezione } = await this.richiestaZip(idPromo, richiesta, ambito);
    const righe = await this.materiali.elencaFile(criteri, filtriFile);
    if (righe.length === 0) throw nienteDaScaricare(idFormato);
    log.info('ZIP POP di consultazione', {
      context: 'Consultazione', idPromo: rigaPromo.id_promo, idFormato, periodo,
      file: righe.length, selezionati: selezione?.length ?? null,
    });
    return { nomeFile: nomeArchivioPop(rigaPromo.nome_promo, nomeFormato), voci: vociZipPop(righe) };
  }

  async scriviZipPop(zip: ZipPop, destinazione: Writable): Promise<EsitoZipOlimpo> {
    return this.scrittoreZip.scriviZipDaOlimpo(zip.voci, destinazione);
  }

  async getContenutiDigitali(filtri: FiltriContenutiDigitali, ambito: AmbitoGdo): Promise<PaginaContenutiDigitali> {
    const pagina = paginaRichiesta(filtri.pagina);
    const dimensione = dimensioneTra(filtri.dimensione, DIMENSIONE_PAGINA_CONTENUTI_DIGITALI, DIMENSIONE_MASSIMA_CONTENUTI_DIGITALI);
    const cerca = testoPulito(filtri.cerca);
    const filtriSql = {
      cerca,
      campiRicerca: cerca ? (await this.campiRicerca()).filter(campo => CAMPO_METADATI.test(campo)) : [],
      idPromo: uuidOpzionale(filtri.idPromo, 'Promozione'),
      idTipoExport: uuidOpzionale(filtri.idTipoExport, 'Tipo di export'),
      idFormato: uuidOpzionale(filtri.idFormato, 'Formato'),
      idArea: uuidOpzionale(filtri.idArea, 'Area'),
      idCanale: uuidOpzionale(filtri.idCanale, 'Canale'),
    };
    const [righe, totale] = await Promise.all([
      this.repository.elencaContenutiDigitali(filtriSql, ambito, { limite: dimensione, scarto: (pagina - 1) * dimensione }),
      this.repository.contaContenutiDigitali(filtriSql, ambito),
    ]);
    return { file: righe.map(contenutoDa), totale, pagina, dimensione };
  }

  async getOpzioniContenutiDigitali(ambito: AmbitoGdo): Promise<OpzioniContenutiDigitali> {
    return opzioniContenutiDa(await this.repository.elencaOpzioniContenutiDigitali(ambito));
  }

  async scaricaFile(idFile: string, ambito: AmbitoGdo): Promise<FileScaricato> {
    const id = idEsistente(idFile, 'FileRuntime', FILE_NON_DISPONIBILE);
    const file = await this.repository.trovaFileScaricabile(id, ambito);
    if (!file?.id_olimpo_cloud) throw new NotFoundError({ message: FILE_NON_DISPONIBILE, entityType: 'FileRuntime', entityId: id });
    try {
      const contenuto = await this.leggiFileOlimpo(file.id_olimpo_cloud);
      return { nome: file.nome_originale || file.nome || 'file.pdf', mime: file.mime || 'application/pdf', contenuto };
    } catch (errore) {
      const motivo = motivoFileNonScaricato(errore);
      log.warn('File di consultazione non scaricato da Olimpo', { context: 'Consultazione', idFile: id, motivo });
      if (errore instanceof ErroreRispostaOlimpo && errore.status === 404) {
        throw new NotFoundError({ message: `File non scaricato: ${motivo}.`, entityType: 'FileRuntime', entityId: id });
      }
      throw new ServiceUnavailableError({ message: `File non scaricato: ${motivo}.`, service: 'Olimpo' });
    }
  }
}
