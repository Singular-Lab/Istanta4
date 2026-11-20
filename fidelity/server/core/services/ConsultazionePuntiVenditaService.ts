import { validate as isUuid } from 'uuid';
import { NotFoundError } from '../../../lib/errors';
import { MESI_ASSENZE_IN_ELENCO, type AssenzeInElenco, type StoriaInElenco } from '../../../lib/puntiVendita/analisi';
import type { PuntoVenditaConsultazione, RiferimentoCodificato } from '../../../lib/puntiVendita/consultazione';
import type { VolantinoAttivoDTO } from '../dto/PuntoVenditaDTO';
import type { IConsultazionePuntiVenditaService } from '../interfaces/IConsultazionePuntiVenditaService';
import type { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import { log } from '../logger';
import type {
  IConsultazionePuntiVenditaRepository,
  RigaAssenzeInElenco,
  RigaPuntoVenditaConsultazione,
  RigaStoriaInElenco,
} from '../repositories/ConsultazionePuntiVenditaRepository';
import { chiaveCombinazione } from '../utils/confrontoPuntiVendita';
import { oggiARoma } from './AnalisiPuntoVenditaService';

const testo = (valore: string | null | undefined): string | null => valore?.trim() || null;

const coordinata = (valore: number | string | null): number | null => {
  if (valore === null || valore === '') return null;
  const numero = typeof valore === 'number' ? valore : Number(valore);
  return Number.isFinite(numero) ? numero : null;
};

const riferimento = (id: string | null, nome: string | null, codice: string | null): RiferimentoCodificato | null =>
  id ? { id, nome: testo(nome) ?? testo(codice) ?? id, codice: testo(codice) } : null;

/** La riga del database nel DTO della consultazione: solo i campi dell'anagrafica, nient'altro. */
export function inConsultazione(riga: RigaPuntoVenditaConsultazione): PuntoVenditaConsultazione {
  const lat = coordinata(riga.lat);
  const lon = coordinata(riga.lon);
  return {
    id: riga.id,
    nome: riga.nome,
    ragioneSociale: testo(riga.ragione_sociale),
    indirizzo: testo(riga.indirizzo),
    cap: testo(riga.cap),
    citta: testo(riga.citta),
    provincia: testo(riga.provincia),
    regione: testo(riga.regione),
    telefono: testo(riga.telefono),
    canale: riferimento(riga.id_canale, riga.nome_canale, riga.codice_canale),
    area: riferimento(riga.id_area, riga.nome_area, riga.codice_area),
    meta: riga.meta ?? {},
    // Senza una delle due la mappa non ha un punto: 0,0 sarebbe in mare
    coordinate: lat !== null && lon !== null ? { lat, lon } : null,
  };
}

const confronta = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Il primo giorno della finestra delle assenze dell'elenco: lo stesso giorno di 12 mesi prima (ISO). */
export const inizioAssenzeInElenco = (oggi: string): string => {
  const [anno, mese, giorno] = oggi.split('-').map(Number);
  const data = new Date(Date.UTC(anno, mese - 1 - MESI_ASSENZE_IN_ELENCO, giorno));
  return data.toISOString().slice(0, 10);
};

/** Le assenze dell'elenco per PV, dalle righe del repository. */
export function assenzeInElenco(righe: readonly RigaAssenzeInElenco[]): Map<string, AssenzeInElenco> {
  return new Map(righe.map(riga => [riga.id_punto_vendita, {
    volantini: riga.volantini,
    mancanti: Math.max(0, riga.volantini - riga.presenze),
    nonNellUltimo: riga.assente_ultimo,
  }]));
}

/**
 * La storia di ogni PV per l'elenco: quanti volantini, l'insegna (canale) con piu' volantini di
 * ogni anno e se ha cambiato insegna. Il cambio viene da `conCambioInsegna`, con la regola delle
 * insegne nel tempo della scheda (repository.puntiVenditaConCambioInsegna): l'insegna prevalente
 * di ogni anno conterebbe anche la lista ripetuta nei kit di altre aree. Le assenze, quando ci sono,
 * vengono da `assenze` (repository.assenzeInElenco). Solo i PV che compaiono in almeno un volantino.
 */
export function storiaInElenco(
  righe: readonly RigaStoriaInElenco[],
  conCambioInsegna: ReadonlySet<string> = new Set(),
  assenze: ReadonlyMap<string, AssenzeInElenco> = new Map(),
): Map<string, StoriaInElenco> {
  const perPuntoVendita = new Map<string, Map<number, RigaStoriaInElenco[]>>();
  for (const riga of righe) {
    const perAnno = perPuntoVendita.get(riga.id_punto_vendita) ?? new Map<number, RigaStoriaInElenco[]>();
    perAnno.set(riga.anno, [...(perAnno.get(riga.anno) ?? []), riga]);
    perPuntoVendita.set(riga.id_punto_vendita, perAnno);
  }
  const storie = new Map<string, StoriaInElenco>();
  for (const [idPuntoVendita, perAnno] of perPuntoVendita) {
    const insegnePerAnno = [...perAnno.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([anno, canali]) => {
        // A parita' di volantini, per nome: la scelta non dipende dall'ordine delle righe
        const [prevalente] = [...canali].sort((a, b) => b.volantini - a.volantini
          || confronta(a.nome_canale, b.nome_canale) || confronta(a.id_canale ?? '', b.id_canale ?? ''));
        return { anno, canale: prevalente.id_canale ? { id: prevalente.id_canale, nome: prevalente.nome_canale } : null };
      });
    const volantini = [...perAnno.values()].flat().reduce((totale, riga) => totale + riga.volantini, 0);
    if (volantini === 0) continue;
    const storia: StoriaInElenco = { volantini, insegnePerAnno, cambioInsegna: conCambioInsegna.has(idPuntoVendita) };
    const assenzeDelPv = assenze.get(idPuntoVendita);
    if (assenzeDelPv) storia.assenze = assenzeDelPv;
    storie.set(idPuntoVendita, storia);
  }
  return storie;
}

export class ConsultazionePuntiVenditaService implements IConsultazionePuntiVenditaService {
  constructor(
    private readonly repository: IConsultazionePuntiVenditaRepository,
    private readonly puntoVenditaService: Pick<IPuntoVenditaService, 'getVolantiniAttivi'>,
    /** Oggi a Roma (ISO): da qui le assenze recenti dell'elenco. */
    private readonly oggi: () => string = () => oggiARoma(),
  ) { }

  async elenca(idGdo: string): Promise<PuntoVenditaConsultazione[]> {
    const [righe, storie, combinazioni] = await Promise.all([
      this.repository.elencaDellaGdo(idGdo),
      this.storie(idGdo),
      this.combinazioniDeiVolantini(idGdo),
    ]);
    return righe.map((riga) => {
      const puntoVendita: PuntoVenditaConsultazione = inConsultazione(riga);
      const storia = storie.get(riga.id);
      if (storia) puntoVendita.storia = storia;
      if (combinazioni) {
        const chiave = chiaveCombinazione(riga.id_canale, riga.id_area);
        puntoVendita.combinazioneConVolantini = chiave !== null && combinazioni.has(chiave);
      }
      return puntoVendita;
    });
  }

  /**
   * Le chiavi delle combinazioni canale/area con volantini. Se non si leggono l'elenco esce senza
   * l'indicazione e la consultazione mostra tutti i punti vendita, invece di nessuno.
   */
  private async combinazioniDeiVolantini(idGdo: string): Promise<Set<string> | null> {
    try {
      const righe = await this.repository.combinazioniDeiVolantini(idGdo);
      return new Set(righe.map(r => chiaveCombinazione(r.id_canale, r.id_area)).filter((chiave): chiave is string => chiave !== null));
    } catch (errore) {
      log.warn('Consultazione PV: combinazioni dei volantini non lette per l\'elenco', { idGdo, errore: errore instanceof Error ? errore.message : String(errore) });
      return null;
    }
  }

  /** La storia nell'elenco e' un di piu': se non si legge, l'elenco esce senza. */
  private async storie(idGdo: string): Promise<Map<string, StoriaInElenco>> {
    try {
      const [righe, conCambio, assenze] = await Promise.all([
        this.repository.storiaInElenco(idGdo),
        this.conCambioInsegna(idGdo),
        this.assenze(idGdo),
      ]);
      return storiaInElenco(righe, conCambio, assenze);
    } catch (errore) {
      log.warn('Consultazione PV: storia dei volantini non letta per l\'elenco', { idGdo, errore: errore instanceof Error ? errore.message : String(errore) });
      return new Map();
    }
  }

  /** Chi ha cambiato insegna: se non si legge, l'elenco esce senza l'indicazione ma con la storia. */
  private async conCambioInsegna(idGdo: string): Promise<Set<string>> {
    try {
      return new Set(await this.repository.puntiVenditaConCambioInsegna(idGdo));
    } catch (errore) {
      log.warn('Consultazione PV: cambi di insegna non letti per l\'elenco', { idGdo, errore: errore instanceof Error ? errore.message : String(errore) });
      return new Set();
    }
  }

  /** Le assenze recenti dei PV: se non si leggono, l'elenco esce con la storia ma senza le assenze. */
  private async assenze(idGdo: string): Promise<Map<string, AssenzeInElenco>> {
    try {
      return assenzeInElenco(await this.repository.assenzeInElenco(idGdo, inizioAssenzeInElenco(this.oggi())));
    } catch (errore) {
      log.warn('Consultazione PV: assenze dei volantini non lette per l\'elenco', { idGdo, errore: errore instanceof Error ? errore.message : String(errore) });
      return new Map();
    }
  }

  async dettaglio(idGdo: string, idPuntoVendita: string): Promise<PuntoVenditaConsultazione> {
    return inConsultazione(await this.trovaDellaGdo(idGdo, idPuntoVendita));
  }

  async volantiniAttivi(idGdo: string, idPuntoVendita: string): Promise<VolantinoAttivoDTO[]> {
    await this.trovaDellaGdo(idGdo, idPuntoVendita);
    return this.puntoVenditaService.getVolantiniAttivi(idPuntoVendita);
  }

  /** Un id che non e' un UUID, un punto vendita inesistente o di un'altra GDO: sempre 404. */
  private async trovaDellaGdo(idGdo: string, idPuntoVendita: string): Promise<RigaPuntoVenditaConsultazione> {
    const riga = isUuid(idPuntoVendita) ? await this.repository.trovaDellaGdo(idGdo, idPuntoVendita) : null;
    if (!riga) {
      throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: idPuntoVendita });
    }
    return riga;
  }
}
