import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { Request } from 'express';
import { STATO_PROMO, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { STATI_PROMO_PER_PERIODO } from '../../../lib/materiali/periodi';
import type { StatoKitMateriali } from '../../../lib/materiali/tipi';
import type {
  AvanzamentoProduzione,
  KitAvanzamento,
  PromoAvanzamento,
  TipoKitAvanzamento,
} from '../../../lib/produzione/avanzamento';
import type { IAvanzamentoProduzioneService } from '../interfaces/IAvanzamentoProduzioneService';
import { log } from '../logger';
import type {
  IAvanzamentoProduzioneRepository,
  RigaKitAvanzamento,
  RigaPromoAvanzamento,
} from '../repositories/AvanzamentoProduzioneRepository';
import {
  CHIAMATE_ISTANTA_IN_PARALLELO,
  type FonteKitNonAvviati,
  leggiVoceNonAvviata,
  mappaConLimite,
  type VoceNonAvviata,
} from './MaterialiService';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso del server. */
const FUSO_PROMO = 'Europe/Rome';

/**
 * Per quanto si riusano i kit non avviati chiesti a Istanta per una promo: la pagina si riapre
 * spesso e Istanta può essere lento. Un kit avviato nel frattempo non si ripete, perché i kit
 * avviati vengono sempre dal database; un kit previsto da poco compare entro questo tempo.
 */
export const DURATA_CACHE_NON_AVVIATI_MS = 60 * 1000;

interface OpzioniAvanzamento {
  ora?: () => number;
  durataCacheMs?: number;
}

const TIPO_DI: Readonly<Record<number, TipoKitAvanzamento>> = {
  [TIPO_LAVORAZIONE.VOLANTINO]: 'VOL',
  [TIPO_LAVORAZIONE.POP]: 'POP',
};

const chiaveId = (id: string): string => id.toLowerCase();

const giornoItaliano = (valore: Date | string | number | null): string | null => {
  if (valore === null || valore === '') return null;
  const data = dayjs(valore);
  return data.isValid() ? data.tz(FUSO_PROMO).format('YYYY-MM-DD') : null;
};

const giorniFra = (da: string, a: string): number => dayjs.utc(a).diff(dayjs.utc(da), 'day');

function kitAvviato(riga: RigaKitAvanzamento): KitAvanzamento {
  return {
    id: riga.id,
    idDesign: riga.id_design,
    titolo: riga.titolo,
    tipo: TIPO_DI[Number(riga.tipo_lavorazione)],
    stato: riga.stato_kit as StatoKitMateriali,
    area: { id: riga.id_area, nome: riga.nome_area },
    canale: { id: riga.id_canale, nome: riga.nome_canale },
    numeroFile: Number(riga.numero_file) || 0,
    fileAccettati: Number(riga.file_accettati) || 0,
    fileInErrore: Number(riga.file_in_errore) || 0,
    avviatoIl: giornoItaliano(riga.avviato_il),
  };
}

const kitNonAvviato = (voce: VoceNonAvviata, tipo: TipoKitAvanzamento): KitAvanzamento => ({
  id: null,
  idDesign: voce.idDesign,
  titolo: voce.titolo,
  tipo,
  stato: 'NON_AVVIATO',
  area: voce.area,
  canale: voce.canale,
  numeroFile: 0,
  fileAccettati: 0,
  fileInErrore: 0,
  avviatoIl: null,
});

export class AvanzamentoProduzioneService implements IAvanzamentoProduzioneService {
  private readonly ora: () => number;
  private readonly durataCacheMs: number;
  /** Kit non avviati per promo, solo dalle risposte riuscite di Istanta. */
  private readonly nonAvviati = new Map<string, { scade: number; voci: VoceNonAvviata[] }>();

  constructor(
    private readonly repository: IAvanzamentoProduzioneRepository,
    private readonly kitRuntimeService: FonteKitNonAvviati,
    opzioni: OpzioniAvanzamento = {}
  ) {
    this.ora = opzioni.ora ?? Date.now;
    this.durataCacheMs = opzioni.durataCacheMs ?? DURATA_CACHE_NON_AVVIATI_MS;
  }

  async getAvanzamento(idGdo: string | null, req: Request): Promise<AvanzamentoProduzione> {
    const oggi = giornoItaliano(this.ora()) as string;
    const righePromo = await this.repository.elencaPromo(STATI_PROMO_PER_PERIODO['in-corso'], idGdo);
    if (righePromo.length === 0) return { promozioni: [] };

    const [righeKit, nonAvviati] = await Promise.all([
      this.repository.elencaKit(righePromo.map(riga => riga.id_promo)),
      mappaConLimite(righePromo, CHIAMATE_ISTANTA_IN_PARALLELO, riga => this.vociNonAvviate(riga, req)),
    ]);
    const tipoDelFormato = await this.tipiDeiFormati(nonAvviati.flatMap(voci => voci ?? []));

    const kitPerPromo = new Map<string, RigaKitAvanzamento[]>();
    for (const riga of righeKit) {
      const chiave = chiaveId(riga.id_promo);
      kitPerPromo.set(chiave, [...(kitPerPromo.get(chiave) ?? []), riga]);
    }

    const promozioni = righePromo.map((riga, indice): PromoAvanzamento => {
      const avviati = (kitPerPromo.get(chiaveId(riga.id_promo)) ?? []).map(kitAvviato);
      // Un kit design già avviato compare una volta sola, come avviato
      const giaPresenti = new Set(avviati.flatMap(kit => (kit.idDesign ? [chiaveId(kit.idDesign)] : [])));
      const daAvviare: KitAvanzamento[] = [];
      for (const voce of nonAvviati[indice] ?? []) {
        const tipo = tipoDelFormato.get(chiaveId(voce.idFormato));
        if (!tipo || giaPresenti.has(chiaveId(voce.idDesign))) continue;
        giaPresenti.add(chiaveId(voce.idDesign));
        daAvviare.push(kitNonAvviato(voce, tipo));
      }
      return this.promo(riga, [...avviati, ...daAvviare], nonAvviati[indice] !== null, oggi);
    });
    return { promozioni };
  }

  private promo(riga: RigaPromoAvanzamento, kit: KitAvanzamento[], nonAvviatiDisponibili: boolean, oggi: string): PromoAvanzamento {
    const scadenza = giornoItaliano(riga.data_scadenza);
    return {
      id: riga.id_promo,
      nome: riga.nome_promo,
      stato: riga.stato_promo as STATO_PROMO,
      validitaDal: giornoItaliano(riga.validita_dal),
      validitaAl: giornoItaliano(riga.validita_al),
      scadenzaLavorazione: scadenza,
      giorniAllaScadenza: scadenza ? giorniFra(oggi, scadenza) : null,
      kit,
      nonAvviatiDisponibili,
    };
  }

  /**
   * Kit non avviati di una promo, da Istanta o dalla cache; null se Istanta non ha risposto: la
   * promo resta con i soli kit avviati e lo dice.
   */
  private async vociNonAvviate(riga: RigaPromoAvanzamento, req: Request): Promise<VoceNonAvviata[] | null> {
    const chiave = chiaveId(riga.id_promo);
    const adesso = this.ora();
    const inCache = this.nonAvviati.get(chiave);
    if (inCache && inCache.scade > adesso) return inCache.voci;
    this.nonAvviati.delete(chiave);

    try {
      const risposta = await this.kitRuntimeService.getAllKitPerGestioneLavorazione(riga.id_promo, req);
      const lavorazioni: unknown[] = Array.isArray(risposta?.lavorazioni) ? risposta.lavorazioni : [];
      const voci = lavorazioni.map(leggiVoceNonAvviata).filter((voce): voce is VoceNonAvviata => voce !== null);
      this.nonAvviati.set(chiave, { scade: adesso + this.durataCacheMs, voci });
      return voci;
    } catch (errore) {
      log.warn('Kit non avviati non disponibili: la promo resta con i soli kit avviati', {
        context: 'AvanzamentoProduzione',
        idPromo: riga.id_promo,
        errore: errore instanceof Error ? errore.message : String(errore),
      });
      return null;
    }
  }

  /** Volantino o POP per i formati dei kit non avviati, letto dal database come per i kit avviati. */
  private async tipiDeiFormati(voci: VoceNonAvviata[]): Promise<Map<string, TipoKitAvanzamento>> {
    const idFormati = [...new Set(voci.map(voce => voce.idFormato))];
    const tipi = new Map<string, TipoKitAvanzamento>();
    for (const formato of await this.repository.trovaTipiFormati(idFormati)) {
      const tipo = TIPO_DI[Number(formato.tipo_lavorazione_formati)];
      if (tipo) tipi.set(chiaveId(formato.id_formati), tipo);
    }
    return tipi;
  }
}
