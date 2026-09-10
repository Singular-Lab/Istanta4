import { Colorize } from "../../../../lib/Colorize.js";
import { TIPO_UTENTI } from "../../../../lib/enums.js";
import { NotFoundError } from "../../../../lib/errors/index.js";
import type { AnalisiMomentoTracciato, DataFields, GlobalUserFilter, KpiCardItem, MenaboDivisioneParams, MenaboLayoutDivisioneSalvata, MenaboRisultato, RisultatoConfrontoMomento, TracciatoReport, TracciatoWidgetPriceDiffRow, UtentiMeta } from "../../../../lib/types.js";
import type { OidcUserClaims } from "../../interfaces/IOidcService.js";
import type { IUserService } from "../../interfaces/IUserService.js";
import { UtentiGDO } from "../../models/utenti_gdo.js";
import type {
  CellaConfronto, FieldChange, IAgenziaLib, MatricePromo, ParsedOIDCUtente, PromoScoreboardInput
} from "../types.js";

const TIPI_CON_GDO = [
  TIPO_UTENTI.GDO,
  TIPO_UTENTI.SUPERADMIN,
  TIPO_UTENTI.AGENZIA,
  TIPO_UTENTI.CATEGORY,
  TIPO_UTENTI.IT,
];

/**
 * Implementazione default di AgenziaLib.
 * Cerca l'utente per email, risolve tipo e id_gdo.
 */
export class DefaultAgenziaLib implements IAgenziaLib {
  constructor(private userService: IUserService) {
    console.log(Colorize.bgRed("Caricato Default Agenzia lib"))
  }
  calcolaIntensitaTerremoto(_cella: CellaConfronto, _storia: CellaConfronto[]): number {
    return 0;
  }

  async calcolaTerremotoPerMatriceDiValori(matrice: MatricePromo): Promise<MatricePromo> {
    return matrice;
  }


  async elaboraDatoPerAgenzia(data: RisultatoConfrontoMomento): Promise<TracciatoReport> {
    const tracciati = data.primario.tracciati;

    const totals = tracciati.reduce(
      (acc, t) => {
        acc.uscenti += t.uscenti ?? 0;
        acc.entranti += t.entranti ?? 0;
        acc.inalterati += t.inalterati ?? 0;
        acc.alterati += t.alterati ?? 0;
        return acc;
      },
      { uscenti: 0, entranti: 0, inalterati: 0, alterati: 0 }
    );
    const totaleMovimenti = totals.uscenti + totals.entranti + totals.alterati;
    const totaleProdotti = totaleMovimenti + totals.inalterati;

    const kpiItems: KpiCardItem[] = [
      { label: 'Prodotti uscenti', value: totals.uscenti, color: 'red', icon: 'TrendingDown' },
      { label: 'Prodotti entranti', value: totals.entranti, color: 'green', icon: 'TrendingUp' },
      { label: 'Prodotti inalterati', value: totals.inalterati, color: 'slate', icon: 'Minus' },
      { label: 'Prodotti alterati', value: totals.alterati, color: 'amber', icon: 'Pencil' },
    ];

    const tableRows = tracciati.map((t) => {
      const uscenti = t.uscenti ?? 0;
      const entranti = t.entranti ?? 0;
      const inalterati = t.inalterati ?? 0;
      const alterati = t.alterati ?? 0;
      const totaleItem = uscenti + entranti + inalterati + alterati;
      return {
        area: t.guidArea,
        canale: t.guidCanale,
        entranti,
        uscenti,
        alterati,
        inalterati,
        stabilita: totaleItem > 0
          ? `${Math.round((inalterati / totaleItem) * 100)}%`
          : '—',
      };
    });

    const subtitleParts: string[] = [];
    if (tracciati.length > 0) subtitleParts.push(`${tracciati.length} combinazioni area/canale`);
    if (totaleProdotti > 0) subtitleParts.push(`${totaleProdotti.toLocaleString('it-IT')} prodotti analizzati`);

    // ── Callout insight ─────────────────────────────────────────────────────
    const stabilitaPercent = totaleProdotti > 0
      ? Math.round((totals.inalterati / totaleProdotti) * 100)
      : 0;

    const calloutSeverity: 'success' | 'info' | 'warning' | 'error' =
      stabilitaPercent >= 80 ? 'success' :
        stabilitaPercent >= 60 ? 'info' :
          stabilitaPercent >= 40 ? 'warning' :
            'error';

    const calloutTitle =
      calloutSeverity === 'success' ? 'Confronto stabile' :
        calloutSeverity === 'info' ? 'Variazioni moderate rilevate' :
          calloutSeverity === 'warning' ? 'Variazioni significative rilevate' :
            'Variazioni critiche rilevate';

    const calloutParts: string[] = [
      `Il ${stabilitaPercent}% dei prodotti è rimasto inalterato rispetto al tracciato precedente.`,
    ];

    const saldo = totals.entranti - totals.uscenti;
    if (saldo > 0) {
      calloutParts.push(`Saldo positivo di ${saldo.toLocaleString('it-IT')} prodotti: il catalogo è cresciuto.`);
    } else if (saldo < 0) {
      calloutParts.push(`Saldo negativo di ${Math.abs(saldo).toLocaleString('it-IT')} prodotti: il catalogo si è ridotto.`);
    } else if (totals.uscenti > 0) {
      calloutParts.push('Saldo neutro: i prodotti entranti pareggiano gli uscenti.');
    }

    // ── Classificazione Singoli vs Gruppi ──────────────────────────────────
    const getReferenzaCodice = (record: Record<string, unknown>): string | null => {
      const d = record['Referenza.Codice'];
      if (typeof d === 'string' && d.trim()) return d.trim();
      const ref = record.Referenza as Record<string, unknown> | undefined;
      const n = ref?.Codice;
      if (typeof n === 'string' && n.trim()) return n.trim();
      return null;
    };
    const getCodiceReparto = (record: Record<string, unknown>): string => {
      const v = record['codice_reparto'];
      return typeof v === 'string' && v.trim() ? v.trim() : '—';
    };
    const classifyReferenza = (record: Record<string, unknown>): 'singolo' | 'gruppo' => {
      const cg = record['Scatto.CodiceGruppo'];
      if (!cg || typeof cg !== 'string' || !cg.trim()) return 'singolo';
      const codice = getReferenzaCodice(record);
      return cg.trim() === codice ? 'singolo' : 'gruppo';
    };

    const primarioRecords = tracciati.flatMap(t => t.records);
    const secondarioRecords = data.secondario.tracciati.flatMap(t => t.records);

    const singoli: Record<string, string | number>[] = [];
    const gruppi: Record<string, string | number>[] = [];
    for (const record of primarioRecords) {
      const codice = getReferenzaCodice(record) ?? '—';
      const reparto = getCodiceReparto(record);
      const tipo = classifyReferenza(record);
      const codiceGruppo = typeof record['Scatto.CodiceGruppo'] === 'string'
        ? (record['Scatto.CodiceGruppo'] as string).trim()
        : '—';
      const row: Record<string, string | number> = {
        codice, reparto,
        tipo: tipo === 'singolo' ? 'Singolo' : 'Gruppo',
        codiceGruppo,
      };
      if (tipo === 'singolo') singoli.push(row);
      else gruppi.push(row);
    }

    // ── Dual pie chart ─────────────────────────────────────────────────────
    const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    const countByReparto = (recs: Record<string, unknown>[]): Map<string, number> => {
      const m = new Map<string, number>();
      for (const r of recs) { const rep = getCodiceReparto(r); m.set(rep, (m.get(rep) ?? 0) + 1); }
      return m;
    };
    const primRepartoCount = countByReparto(primarioRecords);
    const secRepartoCount = countByReparto(secondarioRecords);
    const dualPieLabels = Array.from(
      new Set([...primRepartoCount.keys(), ...secRepartoCount.keys()])
    ).sort();
    const dualPieColors = dualPieLabels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);

    // ── Price diff ─────────────────────────────────────────────────────────
    const getPrezzoPromo = (record: Record<string, unknown>): string => {
      const v = record['prezzo'];
      if (v === null || v === undefined) return '—';
      return String(v).trim() || '—';
    };
    const parsePrice = (v: string): number | null => {
      if (v === '—') return null;
      const n = parseFloat(v.replace(',', '.'));
      return isNaN(n) ? null : n;
    };
    const secByCodice = new Map<string, Record<string, unknown>>();
    for (const r of secondarioRecords) { const c = getReferenzaCodice(r); if (c) secByCodice.set(c, r); }
    const priceDiffRows: TracciatoWidgetPriceDiffRow[] = [];
    for (const record of primarioRecords) {
      const codice = getReferenzaCodice(record);
      if (!codice) continue;
      const secRecord = secByCodice.get(codice);
      if (!secRecord) continue;
      const prezzoA = getPrezzoPromo(record);
      const prezzoB = getPrezzoPromo(secRecord);
      if (prezzoA === prezzoB) continue;
      const numA = parsePrice(prezzoA);
      const numB = parsePrice(prezzoB);
      const delta = numA !== null && numB !== null ? numB - numA : null;
      const deltaPercent = delta !== null && numA !== null && numA !== 0
        ? `${delta >= 0 ? '+' : ''}${Math.round((delta / numA) * 100)}%`
        : null;
      priceDiffRows.push({
        codice,
        reparto: getCodiceReparto(record),
        tipo: classifyReferenza(record),
        changes: [{ campo: 'prezzo', label: 'Prezzo Promo', valoreA: prezzoA, valoreB: prezzoB, isNumeric: true, delta, deltaPercent }],
      });
    }

    return {
      title: 'Report Confronto Tracciati',
      subtitle: subtitleParts.join(' · '),
      generatedAt: new Date().toISOString(),
      widgets: [
        {
          id: 'kpi-summary',
          type: 'kpi_grid',
          title: 'Riepilogo variazioni',
          description: `${totaleMovimenti.toLocaleString('it-IT')} movimenti rilevati su ${totaleProdotti.toLocaleString('it-IT')} prodotti totali`,
          badge: 'Globale',
          gridSpan: 4,
          items: kpiItems,
        },
        {
          id: 'callout-insight',
          type: 'callout',
          title: calloutTitle,
          message: calloutParts.join(' '),
          severity: calloutSeverity,
          badge: `Stabilità ${stabilitaPercent}%`,
        },
        {
          id: 'table-detail',
          type: 'table',
          title: 'Dettaglio per area e canale',
          description: 'Riepilogo delle variazioni con indice di stabilità per ogni combinazione area/canale',
          badge: 'Dettaglio',
          gridSpan: 4,
          columns: [
            { key: 'area', label: 'Area' },
            { key: 'canale', label: 'Canale' },
            { key: 'entranti', label: 'Entranti' },
            { key: 'uscenti', label: 'Uscenti' },
            { key: 'alterati', label: 'Alterati' },
            { key: 'inalterati', label: 'Inalterati' },
            { key: 'stabilita', label: 'Stabilità' },
          ],
          rows: tableRows,
        },
        {
          id: 'referenze-split-table',
          type: 'referenze_split_table' as const,
          title: 'Referenze per tipo',
          description: `${singoli.length} singoli · ${gruppi.length} gruppi`,
          badge: `${primarioRecords.length} ref.`,
          gridSpan: 4,
          columns: [
            { key: 'codice', label: 'Codice' },
            { key: 'reparto', label: 'Reparto' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'codiceGruppo', label: 'Cod. Gruppo' },
          ],
          singoli,
          gruppi,
        },
        {
          id: 'dual-pie-reparto',
          type: 'dual_pie_chart' as const,
          title: 'Distribuzione referenze per reparto',
          description: 'Confronto della presenza di referenze per reparto tra momento primario e secondario',
          badge: `${dualPieLabels.length} reparti`,
          gridSpan: 4,
          labelA: data.primario.nomeMomento,
          labelB: data.secondario.nomeMomento,
          labels: dualPieLabels,
          colors: dualPieColors,
          dataA: dualPieLabels.map(l => primRepartoCount.get(l) ?? 0),
          dataB: dualPieLabels.map(l => secRepartoCount.get(l) ?? 0),
        },
        ...(priceDiffRows.length > 0 ? [{
          id: 'price-diff',
          type: 'price_diff' as const,
          title: 'Variazioni prezzo promo',
          description: 'Referenze con prezzo modificato',
          badge: `${priceDiffRows.length} variazioni`,
          gridSpan: 4 as const,
          labelA: data.primario.nomeMomento,
          labelB: data.secondario.nomeMomento,
          rows: priceDiffRows,
        }] : []),
      ],
    };
  }

  async normalizzaDatoConfrontoPerScore(confrontiData: PromoScoreboardInput): Promise<PromoScoreboardInput> {
    throw new Error("Method not implemented.");
  }
  computeContributo(): { contributoRaw: number; hasTerremoto: boolean } {
    throw new Error("Method not implemented.");
  }
  getChangedFields(_a: DataFields, _b: DataFields): FieldChange[] {
    throw new Error("Method not implemented.");
  }

  async buildScoreboardReport(_matrice: MatricePromo, _confrontiData: PromoScoreboardInput): Promise<TracciatoReport> {
    throw new Error("Method not implemented.");
  }
  CHIAVE_CAMPO_MENABO = '';
  CHIAVE_DEDUP_MENABO = '';

  getReportOptions(): import('../types.js').ReportOption[] {
    return [];
  }

  getGlobalFiltersForUser(_utente: { tipo: TIPO_UTENTI; meta?: UtentiMeta }): GlobalUserFilter {
    return { isRestricted: false, settoriFinali: [], settori: [], settoriNomi: [], aree: [], ruolo: null };
  }

  async getDatoPerMenabo(_risultati: AnalisiMomentoTracciato[], _params: MenaboDivisioneParams): Promise<MenaboRisultato> {
    throw new Error("getDatoPerMenabo non implementato nell'agenzia lib di default.");
  }

  async exportMenaboExcel(_layout: MenaboLayoutDivisioneSalvata): Promise<Buffer> {
    throw new Error("exportMenaboExcel non implementato nell'agenzia lib di default.");
  }

  buildIndesignPluginJson(_layout: MenaboLayoutDivisioneSalvata): import("../../../../lib/types.js").IndesignPluginExport {
    throw new Error("buildIndesignPluginJson non implementato nell'agenzia lib di default.");
  }

  async parseUtenteOIDC(
    email: string,
    _claims: OidcUserClaims
  ): Promise<ParsedOIDCUtente> {
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      throw new NotFoundError({
        message: `Nessun account associato all'email ${email}`,
        entityType: "Utente",
      });
    }

    const tipoUtente = user.tipo;
    let idGdo = user.id_gdo;

    // Se l'utente è GDO/Superadmin/Agenzia/Category, verifica associazione GDO
    if (TIPI_CON_GDO.includes(tipoUtente as TIPO_UTENTI) && !idGdo) {
      const hasGdo = await UtentiGDO.findOne({
        where: { id_utente_utentegdo: user.id },
      });
      if (hasGdo) {
        idGdo = hasGdo.id_gdo_utentegdo;
      }
    }

    return {
      id: user.id,
      private_key: user.private_key,
      id_gdo: idGdo,
      email: user.email,
      tipo_utente: tipoUtente as TIPO_UTENTI,
    };
  }
}
