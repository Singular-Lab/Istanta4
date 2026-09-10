import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { ValidationError } from '../../../lib/errors';
import {
  CreateStatisticheApiDTO,
  StatisticheAggregateDTO,
  StatisticheApiResponseDTO,
  StatisticheFiltersDTO,
  StatistichePaginateResponseDTO,
  parseOperatingSystem,
  toStatisticheApiAttributes,
  toStatisticheApiResponseDTO
} from '../dto/StatisticheApiDTO';
import { log } from '../logger';
import { StatisticheApi } from '../models/statistiche_api';
import type { IStatisticheApiRepository } from '../repositories/StatisticheApiRepository';
import { StatisticheApiRepository } from '../repositories/StatisticheApiRepository';

export class StatisticheApiService {
  constructor(
    private readonly statisticheApiRepository: IStatisticheApiRepository = new StatisticheApiRepository()
  ) {}

  /**
   * Registra una nuova statistica API
   */
  async registraStatistica(dto: CreateStatisticheApiDTO): Promise<StatisticheApiResponseDTO | void> {
    try {
      const attributes = toStatisticheApiAttributes(dto);

      if (attributes.ruolo_utente == "DEVELOPER") {
        return;
      }
      // Assicuriamoci che tutti i campi obbligatori siano presenti
      if (!attributes.endpoint || !attributes.metodo || attributes.codice_risposta === undefined) {
        throw new ValidationError({
          message: 'Campi obbligatori mancanti per la creazione della statistica API',
          field: 'endpoint, metodo, codice_risposta',
          constraint: 'required',
        });
      }

      const statistica = await this.statisticheApiRepository.create(attributes as any);

      log.info('Statistica API registrata', {
        id: statistica.id_statistiche_api,
        endpoint: dto.endpoint,
        metodo: dto.metodo,
        codice_risposta: dto.codice_risposta,
        tempo_risposta_ms: dto.tempo_risposta_ms
      });

      return toStatisticheApiResponseDTO(statistica);
    } catch (error) {
      log.error('Errore nella registrazione statistica API', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dto
      });
      throw error;
    }
  }

  /**
   * Ottiene le statistiche aggregate
   */
  async getStatisticheAggregate(): Promise<StatisticheAggregateDTO> {
    try {
      const oggi = dayjs().startOf('day').toDate();
      const fineOggi = dayjs().endOf('day').toDate();
      const unaSettimanaFa = dayjs().subtract(7, 'day').startOf('day').toDate();
      const unMeseFa = dayjs().subtract(1, 'month').startOf('day').toDate();
      const dueSettimaneFa = dayjs().subtract(14, 'day').startOf('day').toDate();

      // ======================================================
      // 1) Statistiche generali (count e media)
      // ======================================================

      const [
        totaleRichieste,
        richiesteRiuscite,
        richiesteFallite,
        tempoMedioRispostaRow
      ] = await Promise.all([
        StatisticheApi.count(),
        StatisticheApi.count({
          where: { codice_risposta: { [Op.gte]: 200, [Op.lt]: 300 } }
        }),
        StatisticheApi.count({
          where: { codice_risposta: { [Op.gte]: 400 } }
        }),
        StatisticheApi.findOne({
          attributes: [
            [
              StatisticheApi.sequelize!.fn(
                'AVG',
                StatisticheApi.sequelize!.col('tempo_risposta_ms')
              ),
              'tempo_medio'
            ]
          ],
          raw: true
        })
      ]);

      const tempoMedioRispostaMs = Math.round(
        (tempoMedioRispostaRow as any)?.tempo_medio ?? 0
      );

      // ======================================================
      // 2) Trend e temporali
      // ======================================================

      const [
        richiesteOggi,
        richiesteSettimanaCorrente,
        richiesteSettimanaPrecedente
      ] = await Promise.all([
        StatisticheApi.count({
          where: { timestamp_richiesta: { [Op.between]: [oggi, fineOggi] } }
        }),
        StatisticheApi.count({
          where: { timestamp_richiesta: { [Op.gte]: unaSettimanaFa } }
        }),
        StatisticheApi.count({
          where: {
            timestamp_richiesta: {
              [Op.gte]: dueSettimaneFa,
              [Op.lt]: unaSettimanaFa
            }
          }
        })
      ]);

      const crescitaSettimanalePercentuale =
        richiesteSettimanaPrecedente > 0
          ? Math.round(
            ((richiesteSettimanaCorrente - richiesteSettimanaPrecedente) /
              richiesteSettimanaPrecedente) *
            10000
          ) / 100
          : 0;

      // ======================================================
      // 3) Endpoint più utilizzati
      // ======================================================

      const endpointPiuUtilizzati = (await StatisticheApi.findAll({
        attributes: [
          'endpoint',
          [
            StatisticheApi.sequelize!.fn('COUNT', '*'),
            'richieste'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'AVG',
              StatisticheApi.sequelize!.col('tempo_risposta_ms')
            ),
            'tempo_medio_ms'
          ]
        ],
        group: ['endpoint'],
        order: [[StatisticheApi.sequelize!.fn('COUNT', '*'), 'DESC']],
        limit: 10,
        raw: true
      })) as any[];

      // ======================================================
      // 4) Attività recente
      // ======================================================

      const attivitaRecente = (await StatisticheApi.findAll({
        attributes: [
          'timestamp_richiesta',
          'endpoint',
          'metodo',
          'codice_risposta',
          'tempo_risposta_ms',
          'ip_richiedente',
          'ruolo_utente',
          'errore',
          'stack_trace'
        ],
        order: [['timestamp_richiesta', 'DESC']],
        limit: 10,
        raw: true
      })) as any[];

      // ======================================================
      // 5) Statistiche per endpoint
      // ======================================================

      const statistichePerEndpoint = (await StatisticheApi.findAll({
        attributes: [
          'endpoint',
          'metodo',
          [
            StatisticheApi.sequelize!.fn('COUNT', '*'),
            'totale_richieste'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'SUM',
              StatisticheApi.sequelize!.literal(
                'CASE WHEN codice_risposta >= 200 AND codice_risposta < 300 THEN 1 ELSE 0 END'
              )
            ),
            'richieste_riuscite'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'SUM',
              StatisticheApi.sequelize!.literal(
                'CASE WHEN codice_risposta >= 400 THEN 1 ELSE 0 END'
              )
            ),
            'richieste_fallite'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'AVG',
              StatisticheApi.sequelize!.col('tempo_risposta_ms')
            ),
            'tempo_medio_ms'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'MIN',
              StatisticheApi.sequelize!.col('tempo_risposta_ms')
            ),
            'tempo_minimo_ms'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'MAX',
              StatisticheApi.sequelize!.col('tempo_risposta_ms')
            ),
            'tempo_massimo_ms'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'MAX',
              StatisticheApi.sequelize!.col('timestamp_richiesta')
            ),
            'ultima_richiesta'
          ]
        ],
        group: ['endpoint', 'metodo'],
        order: [[StatisticheApi.sequelize!.fn('COUNT', '*'), 'DESC']],
        raw: true
      })) as any[];

      // ======================================================
      // 6) Statistiche per ruolo
      // ======================================================

      const statistichePerRuolo = (await StatisticheApi.findAll({
        attributes: [
          'ruolo_utente',
          [
            StatisticheApi.sequelize!.fn('COUNT', '*'),
            'totale_richieste'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'SUM',
              StatisticheApi.sequelize!.literal(
                'CASE WHEN codice_risposta >= 200 AND codice_risposta < 300 THEN 1 ELSE 0 END'
              )
            ),
            'richieste_riuscite'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'SUM',
              StatisticheApi.sequelize!.literal(
                'CASE WHEN codice_risposta >= 400 THEN 1 ELSE 0 END'
              )
            ),
            'richieste_fallite'
          ],
          [
            StatisticheApi.sequelize!.fn(
              'AVG',
              StatisticheApi.sequelize!.col('tempo_risposta_ms')
            ),
            'tempo_medio_ms'
          ]
        ],
        where: {
          ruolo_utente: { [Op.not]: null as any }
        },
        group: ['ruolo_utente'],
        order: [[StatisticheApi.sequelize!.fn('COUNT', '*'), 'DESC']],
        raw: true
      })) as any[];

      // ======================================================
      // 7) Statistiche dispositivi (OS)
      // - estraggo i record con UA non null
      // - eseguo parsing OS in JS
      // ======================================================

      const righeDispositivi = (await StatisticheApi.findAll({
        where: {
          user_agent: { [Op.not]: null as any }
        },
        attributes: [
          'user_agent',
          'codice_risposta',
          'tempo_risposta_ms'
        ],
        raw: true
      })) as Array<{
        user_agent: string;
        codice_risposta: number;
        tempo_risposta_ms: number;
      }>;

      // accumulator per OS
      type OsAccumulator = {
        totale: number;
        ok: number;
        ko: number;
        tempo_totale: number;
      };
      const osMap: Record<string, OsAccumulator> = {};

      for (const row of righeDispositivi) {
        const os = parseOperatingSystem(row.user_agent);

        if (!osMap[os]) {
          osMap[os] = { totale: 0, ok: 0, ko: 0, tempo_totale: 0 };
        }
        const acc = osMap[os];

        acc.totale++;
        acc.tempo_totale += row.tempo_risposta_ms;
        if (row.codice_risposta >= 200 && row.codice_risposta < 300) {
          acc.ok++;
        } else if (row.codice_risposta >= 400) {
          acc.ko++;
        }
      }

      const sistemiOperativi = Object.entries(osMap).map(([os, stats]) => ({
        os: os as any,
        totale_richieste: stats.totale,
        richieste_riuscite: stats.ok,
        richieste_fallite: stats.ko,
        tempo_medio_ms:
          stats.totale > 0
            ? Math.round(stats.tempo_totale / stats.totale)
            : 0
      }));

      // ======================================================
      // 8) Statistiche temporali dettagliate (oggi, settimana, mese)
      //    – se vuoi più granularità, estendi getStatisticheTemporali
      // ======================================================

      const [statisticheUltimoGiorno, statisticheUltimaSettimana, statisticheUltimoMese] =
        await Promise.all([
          this.getStatisticheTemporali(oggi, fineOggi),
          this.getStatisticheTemporali(unaSettimanaFa, fineOggi),
          this.getStatisticheTemporali(unMeseFa, fineOggi)
        ]);

      // ======================================================
      // 9) Ritorno del DTO
      // ======================================================

      return {
        totale_richieste: totaleRichieste,
        richieste_riuscite: richiesteRiuscite,
        richieste_fallite: richiesteFallite,
        tempo_medio_risposta_ms: tempoMedioRispostaMs,
        richieste_oggi: richiesteOggi,
        crescita_settimanale_percentuale: crescitaSettimanalePercentuale,
        endpoint_piu_utilizzati: endpointPiuUtilizzati.map(item => ({
          endpoint: item.endpoint,
          richieste: parseInt(item.richieste, 10),
          tempo_medio_ms: Math.round(item.tempo_medio_ms || 0)
        })),
        attivita_recente: attivitaRecente.map(item => ({
          orario: dayjs(item.timestamp_richiesta).format('HH:mm'),
          data: dayjs(item.timestamp_richiesta).format('DD/MM/YYYY'),
          endpoint: item.endpoint,
          metodo: item.metodo,
          stato:
            item.codice_risposta >= 200 && item.codice_risposta < 300
              ? 'success'
              : 'error',
          codice_risposta: item.codice_risposta,
          tempo_risposta_ms: item.tempo_risposta_ms,
          ip_richiedente: item.ip_richiedente,
          ruolo_utente: item.ruolo_utente || 'Sconosciuto',
          errore: item.errore || null,
          stack_trace: item.stack_trace || null
        })),
        statistiche_per_endpoint: statistichePerEndpoint.map(item => ({
          endpoint: item.endpoint,
          metodo: item.metodo,
          totale_richieste: parseInt(item.totale_richieste, 10),
          richieste_riuscite: parseInt(item.richieste_riuscite || 0, 10),
          richieste_fallite: parseInt(item.richieste_fallite || 0, 10),
          tempo_medio_ms: Math.round(item.tempo_medio_ms || 0),
          tempo_minimo_ms: item.tempo_minimo_ms || 0,
          tempo_massimo_ms: item.tempo_massimo_ms || 0,
          ultima_richiesta: item.ultima_richiesta
        })),
        statistiche_per_ruolo: statistichePerRuolo.map(item => ({
          ruolo: item.ruolo_utente || 'Sconosciuto',
          totale_richieste: parseInt(item.totale_richieste, 10),
          richieste_riuscite: parseInt(item.richieste_riuscite || 0, 10),
          richieste_fallite: parseInt(item.richieste_fallite || 0, 10),
          tempo_medio_ms: Math.round(item.tempo_medio_ms || 0)
        })),
        statistiche_temporali: {
          ultimo_giorno: statisticheUltimoGiorno,
          ultima_settimana: statisticheUltimaSettimana,
          ultimo_mese: statisticheUltimoMese,
        },
        dispositivi: {
          sistemi_operativi: sistemiOperativi
        }
      };
    } catch (error) {
      log.error('Errore nel recupero statistiche aggregate', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }


  /**
   * Ottiene le statistiche con filtri e paginazione
   */
  async getStatisticheConFiltri(filtri: StatisticheFiltersDTO): Promise<StatistichePaginateResponseDTO> {
    try {
      const where: any = {};

      if (filtri.endpoint) {
        where.endpoint = { [Op.like]: `%${filtri.endpoint}%` };
      }

      if (filtri.metodo) {
        where.metodo = filtri.metodo;
      }

      if (filtri.codice_risposta) {
        where.codice_risposta = filtri.codice_risposta;
      }

      if (filtri.ruolo_utente) {
        where.ruolo_utente = filtri.ruolo_utente;
      }

      if (filtri.data_da || filtri.data_a) {
        where.timestamp_richiesta = {};
        if (filtri.data_da) {
          where.timestamp_richiesta[Op.gte] = filtri.data_da;
        }
        if (filtri.data_a) {
          where.timestamp_richiesta[Op.lte] = filtri.data_a;
        }
      }

      const limite = filtri.limite || 50;
      const offset = filtri.offset || 0;
      const paginaCorrente = Math.floor(offset / limite) + 1;

      const [statistiche, totale] = await Promise.all([
        StatisticheApi.findAll({
          where,
          limit: limite,
          offset,
          order: [[filtri.ordina_per || 'timestamp_richiesta', filtri.direzione_ordine || 'DESC']]
        }),
        StatisticheApi.count({ where })
      ]);

      const totalePagine = Math.ceil(totale / limite);

      return {
        dati: statistiche.map(toStatisticheApiResponseDTO),
        paginazione: {
          pagina_corrente: paginaCorrente,
          elementi_per_pagina: limite,
          totale_elementi: totale,
          totale_pagine: totalePagine,
          ha_pagina_precedente: paginaCorrente > 1,
          ha_pagina_successiva: paginaCorrente < totalePagine
        },
        filtri_applicati: filtri
      };
    } catch (error) {
      log.error('Errore nel recupero statistiche con filtri', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filtri
      });
      throw error;
    }
  }

  /**
   * Helper per ottenere statistiche temporali
   */
  private async getStatisticheTemporali(dataDa: Date, dataA: Date): Promise<{
    richieste_totali: number;
    richieste_riuscite: number;
    richieste_fallite: number;
    tempo_medio_ms: number;
  }> {
    const [totale, riuscite, fallite, tempoMedio] = await Promise.all([
      StatisticheApi.count({
        where: {
          timestamp_richiesta: { [Op.between]: [dataDa, dataA] }
        }
      }),
      StatisticheApi.count({
        where: {
          timestamp_richiesta: { [Op.between]: [dataDa, dataA] },
          codice_risposta: { [Op.gte]: 200, [Op.lt]: 300 }
        }
      }),
      StatisticheApi.count({
        where: {
          timestamp_richiesta: { [Op.between]: [dataDa, dataA] },
          codice_risposta: { [Op.gte]: 400 }
        }
      }),
      StatisticheApi.findOne({
        attributes: [
          [StatisticheApi.sequelize!.fn('AVG', StatisticheApi.sequelize!.col('tempo_risposta_ms')), 'tempo_medio']
        ],
        where: {
          timestamp_richiesta: { [Op.between]: [dataDa, dataA] }
        },
        raw: true
      }) as any
    ]);

    return {
      richieste_totali: totale,
      richieste_riuscite: riuscite,
      richieste_fallite: fallite,
      tempo_medio_ms: Math.round(tempoMedio?.tempo_medio || 0)
    };
  }

  /**
   * Pulisce le statistiche vecchie (più di 90 giorni)
   */
  async pulisciStatisticheVecchie(): Promise<number> {
    try {
      const dataLimite = dayjs().subtract(90, 'day').toDate();

      const statisticheEliminate = await this.statisticheApiRepository.deleteOlderThan(dataLimite);

      log.info('Statistiche vecchie eliminate', {
        numero_eliminate: statisticheEliminate,
        data_limite: dataLimite
      });

      return statisticheEliminate;
    } catch (error) {
      log.error('Errore nella pulizia statistiche vecchie', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
