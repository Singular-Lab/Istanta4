import type { Request } from 'express';
import { isAppError, NotFoundError } from '../../../lib/errors';
import {
  PALETTE_REPORT_STANDARD,
  type DatiReportVolantino,
  type IntestazioneReport,
  type PaletteReport,
  type ReportVolantino,
  type SezioneReport,
} from '../../../lib/insightVolantino/report';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import type { IAgenziaLib } from '../agenzia_lib/types';
import type { IGdoService } from '../interfaces/IGdoService';
import type { IInsightConfrontiService } from '../interfaces/IInsightConfrontiService';
import type { IReportVolantinoService } from '../interfaces/IReportVolantinoService';
import type { IVolantinoService } from '../interfaces/IVolantinoService';
import { log } from '../logger';
import { type KitInsight, kitNellAmbito } from '../repositories/InsightVolantinoRepository';
import { sezioniStandard, sottotitoloReport } from '../utils/reportVolantino';

/**
 * Report PDF del volantino (spec insight-volantino, contratto in lib/insightVolantino/report.ts):
 * raccoglie insight e confronto con l'edizione precedente, compone le sezioni standard e le passa
 * alla libreria agenzia del cliente, che puo' riordinarle o cambiarle; palette e intestazione sono
 * quelle standard con le voci del cliente sopra.
 *
 * Stesso ambito GDO degli insight: un kit di un'altra GDO, o inesistente, risponde 404. Il
 * confronto e' una parte facoltativa: se il suo servizio fallisce per un motivo diverso da un 404
 * il report esce lo stesso senza quelle sezioni, con un avviso nel log.
 */

const RISERVATEZZA_STANDARD = 'Riservato - uso interno';

/** Le letture del kit (InsightVolantinoRepository): qui per poterle sostituire nei test. */
export interface LettureKitReport {
  kitNellAmbito(idKit: string, ambito: AmbitoGdo): Promise<KitInsight | null>;
}

const LETTURE_PREDEFINITE: LettureKitReport = { kitNellAmbito };

const eNonTrovato = (error: unknown): boolean => isAppError(error) && error.httpStatus === 404;

const messaggio = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Le voci del cliente sopra quelle standard; una voce assente (undefined) lascia lo standard. */
function unisci<T extends object>(standard: T, delCliente: Partial<T> | undefined): T {
  const risultato = { ...standard };
  for (const [chiave, valore] of Object.entries(delCliente ?? {})) {
    if (valore !== undefined) (risultato as Record<string, unknown>)[chiave] = valore;
  }
  return risultato;
}

export class ReportVolantinoService implements IReportVolantinoService {
  constructor(
    private readonly volantino: Pick<IVolantinoService, 'getFlyerInsights'>,
    private readonly confronti: Pick<IInsightConfrontiService, 'edizionePrecedente'>,
    private readonly gdo: Pick<IGdoService, 'getGDOById'>,
    private readonly agenziaLib: Pick<IAgenziaLib, 'insightVolantino'>,
    private readonly letture: LettureKitReport = LETTURE_PREDEFINITE,
    private readonly adesso: () => Date = () => new Date(),
  ) {}

  async report(idKit: string, ambito: AmbitoGdo, richiesta?: Request): Promise<ReportVolantino> {
    // Il kit solo nella GDO della richiesta: per chi non la vede e' come se non esistesse
    const kit = await this.letture.kitNellAmbito(idKit, ambito);
    if (!kit) throw new NotFoundError({ message: 'Volantino non trovato', entityType: 'RuntimeKit', entityId: idKit });

    const [insight, confronto, nomeGdo] = await Promise.all([
      this.volantino.getFlyerInsights(idKit, ambito, richiesta),
      this.facoltativo("il confronto con l'edizione precedente", idKit, () => this.confronti.edizionePrecedente(idKit, ambito)),
      this.nomeGdo(kit, idKit),
    ]);

    const insightVolantino = this.agenziaLib.insightVolantino;
    const palette: PaletteReport = unisci(PALETTE_REPORT_STANDARD, insightVolantino?.palette);
    const intestazione: IntestazioneReport = unisci<IntestazioneReport>(
      { cliente: nomeGdo, sottotitolo: null, logo: null, riservatezza: RISERVATEZZA_STANDARD },
      insightVolantino?.intestazione,
    );
    // Le pagine della sintesi: quelle del PDF, o fino all'ultima con un box (come nei confronti)
    const totalePagine = insight.sintesi.pagine || insight.totalePagine;

    const dati: DatiReportVolantino = {
      contesto: {
        idKit,
        titolo: kit.titolo,
        nomeGdo,
        area: kit.area.trim() || null,
        canale: kit.canale.trim() || null,
        validitaDal: kit.validitaDal,
        validitaAl: kit.validitaAl,
      },
      insight: {
        pdf: insight.pdf,
        box: insight.box,
        sintesi: insight.sintesi,
        prezziSconti: insight.prezziSconti,
        spazio: insight.spazio,
        marche: insight.marche,
        lineeDistributore: insight.lineeDistributore ?? null,
        totalePagine,
        totaleReferenze: insight.totaleReferenze,
      },
      confronto,
      palette,
    };

    return {
      generatoIl: this.adesso().toISOString(),
      idKit,
      titolo: kit.titolo,
      sottotitolo: sottotitoloReport(dati.contesto),
      intestazione,
      palette,
      pdf: insight.pdf,
      box: insight.box,
      totalePagine,
      sezioni: this.sezioni(dati, idKit),
    };
  }

  /** Le sezioni standard, passate alla libreria del cliente; se la libreria fallisce, le standard. */
  private sezioni(dati: DatiReportVolantino, idKit: string): SezioneReport[] {
    const standard = sezioniStandard(dati);
    const insightVolantino = this.agenziaLib.insightVolantino;
    if (!insightVolantino?.sezioniReport) return standard;
    try {
      return insightVolantino.sezioniReport(dati, standard);
    } catch (error) {
      log.warn('Report volantino: sezioni del cliente non disponibili, uso quelle standard', { idKit, errore: messaggio(error) });
      return standard;
    }
  }

  /** Una parte facoltativa del report: null (con un avviso) se fallisce; un 404 vale per tutto il report. */
  private async facoltativo<T>(parte: string, idKit: string, lavoro: () => Promise<T | null>): Promise<T | null> {
    try {
      return await lavoro();
    } catch (error) {
      if (eNonTrovato(error)) throw error;
      log.warn(`Report volantino: ${parte} non e' disponibile, il report esce senza`, { idKit, errore: messaggio(error) });
      return null;
    }
  }

  /** Il nome della GDO del volantino, come lo legge GdoService; vuoto se non si legge. */
  private async nomeGdo(kit: KitInsight, idKit: string): Promise<string> {
    if (!kit.gdo) return '';
    try {
      return (await this.gdo.getGDOById(kit.gdo))?.nome.trim() ?? '';
    } catch (error) {
      log.warn('Report volantino: nome della GDO non disponibile', { idKit, errore: messaggio(error) });
      return '';
    }
  }
}
