import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { Request } from 'express';
import type { Writable } from 'stream';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, STATO_PROMO, TIPO_KIT_DESIGN, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import {
  ETICHETTA_PERIODO,
  isPeriodoMateriali,
  PeriodoMateriali,
  soloKitPubblicati,
  STATI_PROMO_PER_PERIODO,
} from '../../../lib/materiali/periodi';
import {
  AvvisoNonAvviati,
  DIMENSIONI_PAGINA_POP,
  ElencoPromozioniPop,
  FiltriFilePop,
  FiltriKitVolantini,
  FilePop,
  FormatoPop,
  KitPop,
  OpzioniFiltroKit,
  PaginaFilePop,
  PaginaKitVolantini,
  PromoMateriali,
  Riferimento,
  RichiestaZipPop,
  RiepilogoPop,
  SchedaKitVolantino,
  STATI_KIT_MATERIALI,
  StatoKitMateriali,
} from '../../../lib/materiali/tipi';
import type { EsitoZipOlimpo, IFileManagementService, VoceZipOlimpo } from '../interfaces/IFileManagementService';
import type { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import type { IMaterialiService, ZipPop } from '../interfaces/IMaterialiService';
import { log } from '../logger';
import type {
  CriteriKit,
  FiltriSqlFile,
  FiltriSqlKit,
  IMaterialiRepository,
  RigaFile,
  RigaKit,
  RigaOpzioneFile,
  RigaPromo,
} from '../repositories/MaterialiRepository';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso del server. */
const FUSO_PROMO = 'Europe/Rome';

export const DIMENSIONE_PAGINA_VOLANTINI = 24;
export const DIMENSIONE_MASSIMA_VOLANTINI = 96;
export const DIMENSIONE_PAGINA_POP = 100;
/** Oltre, l'OFFSET non serve a niente e il numero non entrerebbe nella query come intero. */
const PAGINA_MASSIMA = 1_000_000;
/** Chiamate a Istanta contemporanee per i kit non avviati delle promo in corso. */
export const CHIAMATE_ISTANTA_IN_PARALLELO = 4;
export const MOTIVO_NON_AVVIATI_NON_DISPONIBILI =
  'Istanta non ha risposto: i kit non ancora avviati di questa promozione non sono nell\'elenco.';

const STATI_KIT_NON_ELIMINATI: readonly string[] = Object.values(STATO_LAVORAZIONE_KIT_RUNTIME)
  .filter(stato => stato !== STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO);
const STATI_LOG_FILE: readonly string[] = Object.values(STATO_LOG_FILE);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dal servizio dei kit runtime basta il calcolo dei kit della promo, compresi quelli non avviati. */
export type FonteKitNonAvviati = Pick<IKitRuntimeService, 'getAllKitPerGestioneLavorazione'>;
/** Dal servizio dei file basta la scrittura dello ZIP di Olimpo in uno stream. */
export type ScrittoreZipOlimpo = Pick<IFileManagementService, 'scriviZipDaOlimpo'>;

/** Kit previsto (kit design) senza runtime, letto dalla risposta di getAllKitPerGestioneLavorazione. */
export interface VoceNonAvviata {
  idDesign: string;
  titolo: string;
  tipo: TIPO_KIT_DESIGN | null;
  area: Riferimento;
  canale: Riferimento;
  idFormato: string;
}

interface KitNonAvviato extends VoceNonAvviata {
  promo: PromoMateriali;
  formato: Riferimento;
}

/* ---------- Validazione dei parametri ---------- */

export function verificaPeriodo(valore: unknown): PeriodoMateriali {
  if (!isPeriodoMateriali(valore)) {
    throw new BadRequestError({ message: 'Periodo mancante o non valido: usa in-corso, attivi o storico.' });
  }
  return valore;
}

const testoPulito = (valore: unknown): string | undefined =>
  typeof valore === 'string' && valore.trim() !== '' ? valore.trim() : undefined;

function uuidOpzionale(valore: unknown, campo: string): string | undefined {
  const testo = testoPulito(valore);
  if (testo === undefined) return undefined;
  if (!UUID.test(testo)) throw new BadRequestError({ message: `${campo} non valido.` });
  return testo;
}

function formatoObbligatorio(valore: unknown): string {
  const idFormato = uuidOpzionale(valore, 'Formato');
  if (!idFormato) throw new BadRequestError({ message: 'Formato mancante: indica idFormato.' });
  return idFormato;
}

export function paginaRichiesta(valore: unknown): number {
  return typeof valore === 'number' && Number.isFinite(valore) && valore >= 1
    ? Math.min(Math.floor(valore), PAGINA_MASSIMA)
    : 1;
}

export function dimensionePaginaVolantini(valore: unknown): number {
  return typeof valore === 'number' && Number.isFinite(valore) && valore >= 1
    ? Math.min(Math.floor(valore), DIMENSIONE_MASSIMA_VOLANTINI)
    : DIMENSIONE_PAGINA_VOLANTINI;
}

/** Solo le dimensioni previste (100, 250, 500); ogni altro valore vale 100. */
export function dimensionePaginaPop(valore: unknown): number {
  return typeof valore === 'number' && DIMENSIONI_PAGINA_POP.includes(valore) ? valore : DIMENSIONE_PAGINA_POP;
}

function statoKitOpzionale(valore: unknown): StatoKitMateriali | undefined {
  const stato = testoPulito(valore);
  if (stato === undefined) return undefined;
  if (!(STATI_KIT_MATERIALI as readonly string[]).includes(stato)) {
    throw new BadRequestError({ message: 'Stato del kit non valido.' });
  }
  return stato as StatoKitMateriali;
}

function filtriSqlFile(filtri: RichiestaZipPop['filtri'] | undefined): FiltriSqlFile {
  const stato = testoPulito(filtri?.stato);
  if (stato !== undefined && !STATI_LOG_FILE.includes(stato)) {
    throw new BadRequestError({ message: 'Stato del file non valido.' });
  }
  return {
    cerca: testoPulito(filtri?.cerca),
    stato,
    idArea: uuidOpzionale(filtri?.idArea, 'Area'),
    idCanale: uuidOpzionale(filtri?.idCanale, 'Canale'),
    reparto: testoPulito(filtri?.reparto),
  };
}

/* ---------- Conversioni ---------- */

/** Regole del periodo: stati delle promo e dei kit ammessi, tipo di formato della vista. */
export function criteriDelPeriodo(periodo: PeriodoMateriali, tipoLavorazione: TIPO_LAVORAZIONE): CriteriKit {
  return {
    statiPromo: STATI_PROMO_PER_PERIODO[periodo],
    statiKit: soloKitPubblicati(periodo) ? [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO] : STATI_KIT_NON_ELIMINATI,
    tipoLavorazione,
  };
}

function dataIso(valore: Date | string | null): string | null {
  if (!valore) return null;
  const data = dayjs(valore);
  return data.isValid() ? data.tz(FUSO_PROMO).format('YYYY-MM-DD') : null;
}

const promoDa = (riga: RigaPromo): PromoMateriali => ({
  id: riga.id_promo,
  nome: riga.nome_promo,
  stato: riga.stato_promo as STATO_PROMO,
  validitaDal: dataIso(riga.validita_dal),
  validitaAl: dataIso(riga.validita_al),
});

const confrontaTesto = (a: string, b: string): number => a.localeCompare(b, 'it', { sensitivity: 'base' });

/** Dalla validita' piu' recente (senza data in fondo), poi per nome. */
function confrontaPromo(a: PromoMateriali, b: PromoMateriali): number {
  return (b.validitaDal ?? '').localeCompare(a.validitaDal ?? '') || confrontaTesto(a.nome, b.nome) || a.id.localeCompare(b.id);
}

function confrontaSchede(a: SchedaKitVolantino, b: SchedaKitVolantino): number {
  return confrontaPromo(a.promo, b.promo)
    || confrontaTesto(a.titolo, b.titolo)
    || (a.id ?? a.idDesign ?? '').localeCompare(b.id ?? b.idDesign ?? '');
}

function confrontaKitPop(a: KitPop, b: KitPop): number {
  return confrontaTesto(a.area.nome, b.area.nome)
    || confrontaTesto(a.canale.nome, b.canale.nome)
    || confrontaTesto(a.titolo, b.titolo);
}

const chiaveId = (id: string): string => id.toLowerCase();

const tipoKit = (valore: unknown): TIPO_KIT_DESIGN | null =>
  (Object.values(TIPO_KIT_DESIGN) as unknown[]).includes(valore) ? valore as TIPO_KIT_DESIGN : null;

function schedaVolantino(riga: RigaKit): SchedaKitVolantino {
  return {
    id: riga.id,
    idDesign: riga.id_design,
    titolo: riga.titolo,
    stato: riga.stato_kit as StatoKitMateriali,
    tipo: tipoKit(riga.tipo),
    promo: promoDa(riga),
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    formato: { id: riga.id_formato, nome: riga.nome_formato },
    numeroFile: Number(riga.numero_file) || 0,
    copertina: riga.copertina_id_olimpo
      ? {
        idOlimpoCloud: riga.copertina_id_olimpo,
        nome: riga.copertina_nome ?? '',
        mime: riga.copertina_mime ?? null,
        pagine: riga.copertina_pagine ?? null,
      }
      : null,
  };
}

const schedaNonAvviata = (kit: KitNonAvviato): SchedaKitVolantino => ({
  id: null,
  idDesign: kit.idDesign,
  titolo: kit.titolo,
  stato: 'NON_AVVIATO',
  tipo: kit.tipo,
  promo: kit.promo,
  area: kit.area,
  canale: kit.canale,
  formato: kit.formato,
  numeroFile: 0,
  copertina: null,
});

/**
 * Kit non avviato da una voce di getAllKitPerGestioneLavorazione: un kit design senza runtime.
 * I kit avviati, i manuali e le voci senza id o formato non contano.
 */
export function leggiVoceNonAvviata(voce: unknown): VoceNonAvviata | null {
  if (!voce || typeof voce !== 'object') return null;
  const campi = voce as Record<string, unknown>;
  if (campi.isDesignKit !== true || campi.lavorazioneStarted === true) return null;
  const testo = (valore: unknown): string => (typeof valore === 'string' ? valore : '');
  const idDesign = testo(campi.guidId);
  const idFormato = testo(campi.guidFormato);
  const tipo = tipoKit(campi.tipo);
  if (!idDesign || !idFormato || tipo === TIPO_KIT_DESIGN.MANUALE) return null;
  return {
    idDesign,
    titolo: testo(campi.titolo),
    tipo,
    area: { id: testo(campi.guidArea), nome: testo(campi.nomeArea) },
    canale: { id: testo(campi.guidCanale), nome: testo(campi.nomeCanale) },
    idFormato,
  };
}

/** Id dei kit design gia' avviati, per promo: i loro kit non avviati non vanno ripetuti. */
function designAvviati(righe: RigaKit[]): Map<string, Set<string>> {
  const avviati = new Map<string, Set<string>>();
  for (const riga of righe) {
    if (!riga.id_design) continue;
    const dellaPromo = avviati.get(riga.id_promo) ?? new Set<string>();
    dellaPromo.add(chiaveId(riga.id_design));
    avviati.set(riga.id_promo, dellaPromo);
  }
  return avviati;
}

/** Valori delle tendine, ognuno una volta: promo dalla piu' recente, aree e canali per nome. */
function opzioniKit(voci: Array<{ promo: PromoMateriali; area: Riferimento; canale: Riferimento }>): OpzioniFiltroKit {
  const promozioni = new Map<string, PromoMateriali>();
  const aree = new Map<string, Riferimento>();
  const canali = new Map<string, Riferimento>();
  for (const { promo, area, canale } of voci) {
    if (!promozioni.has(promo.id)) promozioni.set(promo.id, promo);
    if (area.id && !aree.has(chiaveId(area.id))) aree.set(chiaveId(area.id), area);
    if (canale.id && !canali.has(chiaveId(canale.id))) canali.set(chiaveId(canale.id), canale);
  }
  const perNome = (a: Riferimento, b: Riferimento) => confrontaTesto(a.nome, b.nome);
  return {
    promozioni: [...promozioni.values()].sort(confrontaPromo).map(({ id, nome }) => ({ id, nome })),
    aree: [...aree.values()].sort(perNome),
    canali: [...canali.values()].sort(perNome),
  };
}

function corrispondeAiFiltri(scheda: SchedaKitVolantino, filtri: FiltriSqlKit & { stato?: StatoKitMateriali }): boolean {
  const cerca = filtri.cerca?.toLocaleLowerCase('it');
  if (cerca
    && !scheda.titolo.toLocaleLowerCase('it').includes(cerca)
    && !scheda.promo.nome.toLocaleLowerCase('it').includes(cerca)) return false;
  if (filtri.idPromo && scheda.promo.id !== filtri.idPromo) return false;
  if (filtri.idArea && chiaveId(scheda.area.id) !== chiaveId(filtri.idArea)) return false;
  if (filtri.idCanale && chiaveId(scheda.canale.id) !== chiaveId(filtri.idCanale)) return false;
  if (filtri.stato && scheda.stato !== filtri.stato) return false;
  return true;
}

const contatoreStati = (): Record<StatoKitMateriali, number> =>
  Object.fromEntries(STATI_KIT_MATERIALI.map(stato => [stato, 0])) as Record<StatoKitMateriali, number>;

function filePop(riga: RigaFile): FilePop {
  const codice = riga.codice_referenza || null;
  const descrizione = riga.descrizione_referenza || null;
  return {
    id: riga.id,
    nome: riga.nome ?? '',
    idOlimpoCloud: riga.id_olimpo_cloud || null,
    mime: riga.mime ?? null,
    kit: { id: riga.id_kit, titolo: riga.titolo_kit, stato: riga.stato_kit as StatoKitMateriali },
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    referenza: codice || descrizione ? { codice, descrizione } : null,
    reparto: riga.reparto || null,
    stato: (riga.stato_log as STATO_LOG_FILE | null) ?? null,
    versione: riga.versione_log ?? null,
  };
}

function opzioniFile(righe: RigaOpzioneFile[]): PaginaFilePop['opzioni'] {
  const aree = new Map<string, Riferimento>();
  const canali = new Map<string, Riferimento>();
  const reparti = new Set<string>();
  for (const riga of righe) {
    if (!aree.has(chiaveId(riga.id_area))) aree.set(chiaveId(riga.id_area), { id: riga.id_area, nome: riga.nome_area });
    if (!canali.has(chiaveId(riga.id_canale))) canali.set(chiaveId(riga.id_canale), { id: riga.id_canale, nome: riga.nome_canale });
    if (riga.reparto) reparti.add(riga.reparto);
  }
  const perNome = (a: Riferimento, b: Riferimento) => confrontaTesto(a.nome, b.nome);
  return {
    aree: [...aree.values()].sort(perNome),
    canali: [...canali.values()].sort(perNome),
    reparti: [...reparti].sort(confrontaTesto),
  };
}

/** Nome utilizzabile come file o cartella su ogni sistema: niente separatori ne' caratteri riservati. */
export function nomeSicuro(testo: string): string {
  const senzaRiservati = [...testo.replace(/[<>:"/\\|?*]/g, '_')]
    .filter(carattere => carattere.charCodeAt(0) >= 32)
    .join('');
  return senzaRiservati.trim().replace(/[. ]+$/, '').slice(0, 150).trim();
}

/** `nome`, o `nome (2)`, `nome (3)`... se c'e' gia' (senza distinguere maiuscole: Windows non lo fa). */
function nomeLibero(nome: string, usati: Set<string>): string {
  let candidato = nome;
  const punto = nome.lastIndexOf('.');
  const base = punto > 0 ? nome.slice(0, punto) : nome;
  const estensione = punto > 0 ? nome.slice(punto) : '';
  for (let numero = 2; usati.has(candidato.toLowerCase()); numero++) {
    candidato = `${base} (${numero})${estensione}`;
  }
  usati.add(candidato.toLowerCase());
  return candidato;
}

/** Una cartella per kit, come lo ZIP della promo; il nome del file perde il suffisso della lavorazione. */
export function vociZipPop(righe: RigaFile[]): VoceZipOlimpo[] {
  const cartellaDelKit = new Map<string, { nome: string; file: Set<string> }>();
  const cartelleUsate = new Set<string>();
  return righe.map(riga => {
    let cartella = cartellaDelKit.get(riga.id_kit);
    if (!cartella) {
      cartella = { nome: nomeLibero(nomeSicuro(riga.titolo_kit) || 'Kit senza nome', cartelleUsate), file: new Set<string>() };
      cartellaDelKit.set(riga.id_kit, cartella);
    }
    const nomeFile = nomeLibero(nomeSicuro((riga.nome ?? '').split(' (Lavorazione:')[0]) || `file-${riga.id}`, cartella.file);
    return { file: { id_olimpo_cloud: riga.id_olimpo_cloud }, nome: `${cartella.nome}/${nomeFile}` };
  });
}

export const nomeArchivioPop = (nomePromo: string, nomeFormato: string): string =>
  `${nomeSicuro(`${nomePromo} - ${nomeFormato}`) || 'POP'}.zip`;

/** Esegue `lavoro` su tutti gli elementi, al piu' `limite` alla volta; i risultati nell'ordine degli elementi. */
async function mappaConLimite<T, R>(elementi: readonly T[], limite: number, lavoro: (elemento: T) => Promise<R>): Promise<R[]> {
  const risultati: R[] = new Array<R>(elementi.length);
  let prossimo = 0;
  const esecutore = async () => {
    while (prossimo < elementi.length) {
      const indice = prossimo++;
      risultati[indice] = await lavoro(elementi[indice]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, elementi.length) }, esecutore));
  return risultati;
}

/* ---------- Servizio ---------- */

export class MaterialiService implements IMaterialiService {
  constructor(
    private readonly repository: IMaterialiRepository,
    private readonly kitRuntimeService: FonteKitNonAvviati,
    private readonly fileManagementService: ScrittoreZipOlimpo
  ) { }

  async getVolantini(filtri: FiltriKitVolantini, req: Request): Promise<PaginaKitVolantini> {
    const periodo = verificaPeriodo(filtri.periodo);
    const pagina = paginaRichiesta(filtri.pagina);
    const dimensione = dimensionePaginaVolantini(filtri.dimensione);
    const filtriKit: FiltriSqlKit = {
      cerca: testoPulito(filtri.cerca),
      idPromo: testoPulito(filtri.idPromo),
      idArea: uuidOpzionale(filtri.idArea, 'Area'),
      idCanale: uuidOpzionale(filtri.idCanale, 'Canale'),
    };
    const stato = statoKitOpzionale(filtri.stato);
    const criteri = criteriDelPeriodo(periodo, TIPO_LAVORAZIONE.VOLANTINO);

    if (!soloKitPubblicati(periodo)) {
      return this.volantiniInCorso(criteri, { ...filtriKit, stato }, pagina, dimensione, req);
    }

    // Attivi e Storico: solo kit pubblicati, paginati dal database. Lo stato non filtra: sono tutti pubblicati
    const conFiltri = Object.values(filtriKit).some(valore => valore !== undefined);
    const [righe, totale, totaleSenzaFiltri, combinazioni] = await Promise.all([
      this.repository.elencaKit(criteri, { filtri: filtriKit, limite: dimensione, scarto: (pagina - 1) * dimensione, conCopertina: true }),
      this.repository.contaKit(criteri, filtriKit),
      conFiltri ? this.repository.contaKit(criteri) : Promise.resolve(undefined),
      this.repository.elencaCombinazioniKit(criteri),
    ]);
    return {
      kit: righe.map(schedaVolantino),
      totale,
      totaleSenzaFiltri: totaleSenzaFiltri ?? totale,
      pagina,
      dimensione,
      opzioni: opzioniKit(combinazioni.map(riga => ({
        promo: promoDa(riga),
        area: { id: riga.id_area, nome: riga.nome_area },
        canale: { id: riga.id_canale, nome: riga.nome_canale },
      }))),
      avvisi: [],
    };
  }

  /**
   * In corso: ogni kit non eliminato e i kit non ancora avviati, che non stanno nel database e si
   * chiedono a Istanta promo per promo. Le promo in corso sono poche: unione, filtri e pagina in memoria.
   */
  private async volantiniInCorso(
    criteri: CriteriKit,
    filtri: FiltriSqlKit & { stato?: StatoKitMateriali },
    pagina: number,
    dimensione: number,
    req: Request
  ): Promise<PaginaKitVolantini> {
    const [righe, promozioni] = await Promise.all([
      this.repository.elencaKit(criteri, { conCopertina: true }),
      this.repository.elencaPromo(criteri.statiPromo),
    ]);
    const { kit: nonAvviati, avvisi } = await this.kitNonAvviati(promozioni, req, criteri.tipoLavorazione, designAvviati(righe));
    const tutti = [...righe.map(schedaVolantino), ...nonAvviati.map(schedaNonAvviata)].sort(confrontaSchede);
    const corrispondenti = tutti.filter(scheda => corrispondeAiFiltri(scheda, filtri));
    const inizio = (pagina - 1) * dimensione;
    return {
      kit: corrispondenti.slice(inizio, inizio + dimensione),
      totale: corrispondenti.length,
      totaleSenzaFiltri: tutti.length,
      pagina,
      dimensione,
      opzioni: opzioniKit(tutti),
      avvisi,
    };
  }

  async getPromozioniPop(periodo: PeriodoMateriali): Promise<ElencoPromozioniPop> {
    const periodoValido = verificaPeriodo(periodo);
    // In corso compaiono tutte le promo del periodo, anche quelle con soli kit non avviati;
    // in Attivi e Storico solo quelle con almeno un kit POP pubblicato
    const righe = await this.repository.elencaPromoConKit(
      criteriDelPeriodo(periodoValido, TIPO_LAVORAZIONE.POP),
      soloKitPubblicati(periodoValido)
    );
    return {
      promozioni: righe
        .map(riga => ({ ...promoDa(riga), numeroFile: Number(riga.numero_file) || 0, numeroFormati: Number(riga.numero_formati) || 0 }))
        .sort(confrontaPromo),
    };
  }

  async getRiepilogoPop(idPromo: string, periodo: PeriodoMateriali, req: Request): Promise<RiepilogoPop> {
    const periodoValido = verificaPeriodo(periodo);
    const rigaPromo = await this.promoNelPeriodo(idPromo, periodoValido);
    const criteri: CriteriKit = { ...criteriDelPeriodo(periodoValido, TIPO_LAVORAZIONE.POP), idPromo: rigaPromo.id_promo };
    const righe = await this.repository.elencaKit(criteri);
    const { kit: nonAvviati, avvisi } = soloKitPubblicati(periodoValido)
      ? { kit: [], avvisi: [] }
      : await this.kitNonAvviati([rigaPromo], req, TIPO_LAVORAZIONE.POP, designAvviati(righe));

    const formati = new Map<string, FormatoPop>();
    const formatoDi = (formato: Riferimento): FormatoPop => {
      const esistente = formati.get(chiaveId(formato.id));
      if (esistente) return esistente;
      const nuovo: FormatoPop = { id: formato.id, nome: formato.nome, numeroFile: 0, filePerStatoKit: contatoreStati(), kit: [] };
      formati.set(chiaveId(formato.id), nuovo);
      return nuovo;
    };
    for (const riga of righe) {
      const formato = formatoDi({ id: riga.id_formato, nome: riga.nome_formato });
      const stato = riga.stato_kit as StatoKitMateriali;
      const numeroFile = Number(riga.numero_file) || 0;
      formato.kit.push({
        id: riga.id,
        idDesign: riga.id_design,
        titolo: riga.titolo,
        stato,
        area: { id: riga.id_area, nome: riga.nome_area },
        canale: { id: riga.id_canale, nome: riga.nome_canale },
        numeroFile,
      });
      formato.numeroFile += numeroFile;
      if (stato in formato.filePerStatoKit) formato.filePerStatoKit[stato] += numeroFile;
    }
    for (const kit of nonAvviati) {
      formatoDi(kit.formato).kit.push({
        id: null,
        idDesign: kit.idDesign,
        titolo: kit.titolo,
        stato: 'NON_AVVIATO',
        area: kit.area,
        canale: kit.canale,
        numeroFile: 0,
      });
    }

    const elenco = [...formati.values()].sort((a, b) => confrontaTesto(a.nome, b.nome));
    for (const formato of elenco) formato.kit.sort(confrontaKitPop);
    const somma = (valore: (formato: FormatoPop) => number) => elenco.reduce((totale, formato) => totale + valore(formato), 0);
    return {
      promo: promoDa(rigaPromo),
      totali: {
        file: somma(formato => formato.numeroFile),
        formati: elenco.length,
        pubblicati: somma(formato => formato.filePerStatoKit[STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO]),
        inRevisione: somma(formato => formato.filePerStatoKit[STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE]),
        conErrori: somma(formato => formato.filePerStatoKit[STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI]),
      },
      formati: elenco,
      avvisi,
    };
  }

  async getFilePop(idPromo: string, filtri: FiltriFilePop): Promise<PaginaFilePop> {
    const periodo = verificaPeriodo(filtri.periodo);
    const idFormato = formatoObbligatorio(filtri.idFormato);
    const filtriFile = filtriSqlFile(filtri);
    const pagina = paginaRichiesta(filtri.pagina);
    const dimensione = dimensionePaginaPop(filtri.dimensione);
    const rigaPromo = await this.promoNelPeriodo(idPromo, periodo);
    const criteri: CriteriKit = { ...criteriDelPeriodo(periodo, TIPO_LAVORAZIONE.POP), idPromo: rigaPromo.id_promo, idFormato };

    const [righe, totale, opzioni] = await Promise.all([
      this.repository.elencaFile(criteri, filtriFile, { limite: dimensione, scarto: (pagina - 1) * dimensione }),
      this.repository.contaFile(criteri, filtriFile),
      this.repository.elencaOpzioniFile(criteri),
    ]);
    return { file: righe.map(filePop), totale, pagina, dimensione, opzioni: opzioniFile(opzioni) };
  }

  async preparaZipPop(idPromo: string, richiesta: RichiestaZipPop): Promise<ZipPop> {
    const periodo = verificaPeriodo(richiesta.periodo);
    const idFormato = formatoObbligatorio(richiesta.idFormato);
    // Con idFile solo quei file: gli id malformati, e piu' avanti quelli di altre promo o formati, si scartano
    const selezione = Array.isArray(richiesta.idFile) && richiesta.idFile.length > 0
      ? [...new Set(richiesta.idFile.filter((id): id is string => typeof id === 'string' && UUID.test(id)))]
      : undefined;
    const filtriFile: FiltriSqlFile = selezione ? { idFile: selezione } : filtriSqlFile(richiesta.filtri);
    const rigaPromo = await this.promoNelPeriodo(idPromo, periodo);
    const [formato] = await this.repository.trovaFormati([idFormato]);
    if (!formato) {
      throw new NotFoundError({ message: 'Formato non trovato.', entityType: 'Formato', entityId: idFormato });
    }

    const criteri: CriteriKit = { ...criteriDelPeriodo(periodo, TIPO_LAVORAZIONE.POP), idPromo: rigaPromo.id_promo, idFormato };
    const righe = await this.repository.elencaFile(criteri, filtriFile);
    if (righe.length === 0) {
      throw new NotFoundError({ message: 'Nessun file da scaricare per questa selezione.', entityType: 'FilePop', entityId: idFormato });
    }
    log.info('ZIP POP', {
      context: 'Materiali', idPromo: rigaPromo.id_promo, idFormato, periodo,
      file: righe.length, selezionati: selezione?.length ?? null,
    });
    return { nomeFile: nomeArchivioPop(rigaPromo.nome_promo, formato.nome_formati), voci: vociZipPop(righe) };
  }

  async scriviZipPop(zip: ZipPop, destinazione: Writable): Promise<EsitoZipOlimpo> {
    return this.fileManagementService.scriviZipDaOlimpo(zip.voci, destinazione);
  }

  /** La promo, se esiste e il suo stato e' nel periodo; altrimenti 404. */
  private async promoNelPeriodo(idPromo: string, periodo: PeriodoMateriali): Promise<RigaPromo> {
    const riga = idPromo ? await this.repository.trovaPromo(idPromo) : null;
    if (!riga || !(STATI_PROMO_PER_PERIODO[periodo] as readonly string[]).includes(riga.stato_promo)) {
      throw new NotFoundError({
        message: `Promozione non trovata tra quelle del periodo "${ETICHETTA_PERIODO[periodo]}".`,
        entityType: 'Promo',
        entityId: idPromo,
      });
    }
    return riga;
  }

  /**
   * Kit non avviati delle promo indicate, del tipo di formato della vista: una chiamata per promo,
   * al piu' CHIAMATE_ISTANTA_IN_PARALLELO alla volta. Se la chiamata di una promo fallisce, la
   * promo resta con i soli kit del database e un avviso: la risposta non fallisce per questo.
   */
  private async kitNonAvviati(
    promozioni: RigaPromo[],
    req: Request,
    tipoLavorazione: TIPO_LAVORAZIONE,
    avviati: Map<string, Set<string>>
  ): Promise<{ kit: KitNonAvviato[]; avvisi: AvvisoNonAvviati[] }> {
    const esiti = await mappaConLimite(promozioni, CHIAMATE_ISTANTA_IN_PARALLELO, async (rigaPromo) => {
      try {
        const risposta = await this.kitRuntimeService.getAllKitPerGestioneLavorazione(rigaPromo.id_promo, req);
        const lavorazioni: unknown[] = Array.isArray(risposta?.lavorazioni) ? risposta.lavorazioni : [];
        const voci = lavorazioni.map(leggiVoceNonAvviata).filter((voce): voce is VoceNonAvviata => voce !== null);
        return { rigaPromo, voci, avviso: null };
      } catch (errore) {
        log.warn('Kit non avviati non disponibili: la promo resta con i soli kit avviati', {
          context: 'Materiali',
          idPromo: rigaPromo.id_promo,
          errore: errore instanceof Error ? errore.message : String(errore),
        });
        const avviso: AvvisoNonAvviati = {
          promo: { id: rigaPromo.id_promo, nome: rigaPromo.nome_promo },
          motivo: MOTIVO_NON_AVVIATI_NON_DISPONIBILI,
        };
        return { rigaPromo, voci: [] as VoceNonAvviata[], avviso };
      }
    });

    // Volantino o POP lo decide il formato, letto dal database come per i kit avviati
    const idFormati = [...new Set(esiti.flatMap(esito => esito.voci.map(voce => voce.idFormato)))];
    const formati = new Map(
      (idFormati.length > 0 ? await this.repository.trovaFormati(idFormati) : []).map(formato => [chiaveId(formato.id_formati), formato])
    );

    const kit: KitNonAvviato[] = [];
    for (const { rigaPromo, voci } of esiti) {
      const promo = promoDa(rigaPromo);
      const giaPresenti = new Set(avviati.get(rigaPromo.id_promo) ?? []);
      for (const voce of voci) {
        const formato = formati.get(chiaveId(voce.idFormato));
        if (!formato || Number(formato.tipo_lavorazione_formati) !== tipoLavorazione) continue;
        if (giaPresenti.has(chiaveId(voce.idDesign))) continue;
        giaPresenti.add(chiaveId(voce.idDesign));
        kit.push({ ...voce, promo, formato: { id: formato.id_formati, nome: formato.nome_formati } });
      }
    }
    return { kit, avvisi: esiti.flatMap(esito => (esito.avviso ? [esito.avviso] : [])) };
  }
}
