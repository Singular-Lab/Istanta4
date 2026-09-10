import { Op } from 'sequelize';
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { wrapDatabaseError } from '../../../lib/errors';
import { FileItemKit } from '../../../lib/types';
import config from '../config';
import { DashboardFilterParams, FileAnteprima, IDashboardService, KitVolantino, StoricoVolantiniDTO, type VolantiniInCorsoDTO, type VolantiniInLavorazioneDTO, type VolantiniPubblicatiInLavorazioneDTO } from '../interfaces/IDashboardService';
import { FilesRuntime } from '../models/files_runtime';
import { RuntimeKit } from '../models/runtime_kit';
import { TipiDiExport } from '../models/tipi_di_export';
import type { IFormatiRepository } from '../repositories/FormatiRepository';
import type { IPromoRepository } from '../repositories/PromoRepository';

export class DashboardService implements IDashboardService {
    constructor(
        private readonly promoRepository: IPromoRepository,
        private readonly formatiRepository: IFormatiRepository
    ) { }

    /**
     * Converte i file runtime in FileAnteprima con URL thumbnail
     */
    private mapFilesToAnteprima(files: FileItemKit[]): FileAnteprima[] {
        return files.map(f => ({
            id: f.id,
            nome: f.nome,
            nome_originale: f.nome_originale,
            tipo_export: f.tipo_export,
            id_olimpo_cloud: f.id_olimpo_cloud,
            thumbnailUrl: f.id_olimpo_cloud
                ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${f.id_olimpo_cloud}`
                : undefined,
            mime: f.mime,
            pages: f.pages
        }));
    }

    /**
     * Costruisce un KitVolantino a partire da un kit runtime PG
     */
    private async buildKitVolantino(kit: any, validita_dal?: Date, validita_al?: Date, tipoExportFilter?: string): Promise<KitVolantino> {
        const fileWhere: any = { id_runtime: kit.id };
        if (tipoExportFilter) {
            fileWhere.tipo_export = tipoExportFilter;
        }
        const files = await FilesRuntime.findAll({ where: fileWhere, raw: true }) as unknown as FileItemKit[];
        const promo = kit.id_promo ? await this.promoRepository.findById(kit.id_promo) : null;
        const nome_promo = promo ? (promo.getDataValue("nome_promo") || '') : '';
        return {
            id: kit.id,
            titolo: kit.titolo,
            nome_area: kit.nome_area,
            nome_canale: kit.nome_canale,
            stato_lavorazione: kit.stato_lavorazione,
            nome_promo,
            id_promo: kit.id_promo,
            validita_dal,
            validita_al,
            files: this.mapFilesToAnteprima(files)
        };
    }

    /**
     * Recupera gli ID dei formati con tipo_lavorazione = VOLANTINO (1)
     */
    private async getFormatoVolantinoIds(): Promise<string[]> {
        return this.formatiRepository.findIdsByTipoLavorazione(TIPO_LAVORAZIONE.VOLANTINO);
    }

    /**
     * Recupera l'UUID del tipo di export a partire dal codice (es. EXPORT_DI_SISTEMA.VOL)
     */
    private async getTipoExportIdByCodice(codice: string): Promise<string | null> {
        const tipoExport = await TipiDiExport.findOne({
            where: { codice_tipiexport: codice },
            attributes: ['id_tipiexport'],
            raw: true
        });
        return tipoExport?.id_tipiexport ?? null;
    }

    /**
     * Recupera gli id_runtime dei kit che hanno almeno un file con il tipo_export specificato (UUID)
     */
    private async getKitIdsConTipoExport(tipoExportId: string): Promise<string[]> {
        const filesGroups = await FilesRuntime.findAll({
            where: { tipo_export: tipoExportId },
            attributes: ['id_runtime'],
            group: ['id_runtime'],
            raw: true
        });
        return (filesGroups as any[]).map(f => f.id_runtime).filter(Boolean);
    }

    /**
     * Recupera i volantini in validità e quelli in scadenza nei prossimi 7 giorni
     */
    async getVolantiniInCorso(filters?: DashboardFilterParams): Promise<VolantiniInCorsoDTO> {
        try {
            const [formatoIds, volExportId] = await Promise.all([
                this.getFormatoVolantinoIds(),
                this.getTipoExportIdByCodice(EXPORT_DI_SISTEMA.VOL)
            ]);

            if (formatoIds.length === 0 || !volExportId) {
                return { totale: 0, inScadenza: 0, kit: [] };
            }

            const promoInCorso = await this.promoRepository.findActive();
            const promoInCorsoIds = promoInCorso.map(p => p.getDataValue('id_promo'));

            const volKitIds = await this.getKitIdsConTipoExport(volExportId);
            if (volKitIds.length === 0) {
                return { totale: 0, inScadenza: 0, kit: [] };
            }

            const whereQuery: any = {
                stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
                id_formato: { [Op.in]: formatoIds },
                id_promo: { [Op.in]: promoInCorsoIds },
                id: { [Op.in]: volKitIds }
            };

            if (filters?.id_area && filters.id_area.length > 0) {
                whereQuery.id_area = { [Op.in]: filters.id_area };
            }
            if (filters?.id_canale && filters.id_canale.length > 0) {
                whereQuery.id_canale = { [Op.in]: filters.id_canale };
            }

            const kitPubblicati = await RuntimeKit.findAll({ where: whereQuery, raw: true }) as any[];

            if (!kitPubblicati || kitPubblicati.length === 0) {
                return { totale: 0, inScadenza: 0, kit: [] };
            }

            const oggi = new Date();
            const dataLimite = new Date();
            dataLimite.setDate(oggi.getDate() + 7);

            const promoIds = Array.from(new Set(kitPubblicati.map(kit => kit.id_promo).filter(Boolean)));
            const promoMap = new Map<string, { validita_dal?: Date; validita_al?: Date }>();

            if (promoIds.length > 0) {
                const promoList = await this.promoRepository.findByIds(promoIds, {
                    attributes: ['id_promo', 'validita_dal', 'validita_al']
                });

                promoList.forEach(promo => {
                    const validitaDal = promo.getDataValue('validita_dal');
                    const validitaAl = promo.getDataValue('validita_al');
                    promoMap.set(promo.getDataValue('id_promo'), {
                        validita_dal: validitaDal ? new Date(validitaDal) : undefined,
                        validita_al: validitaAl ? new Date(validitaAl) : undefined
                    });
                });
            }

            const kitVolantini: KitVolantino[] = await Promise.all(
                kitPubblicati.map(kit => {
                    const promoDates = promoMap.get(kit.id_promo);
                    return this.buildKitVolantino(kit, promoDates?.validita_dal, promoDates?.validita_al, volExportId);
                })
            );

            const totale = kitVolantini.length;
            const inScadenza = kitVolantini.filter(kit => {
                if (!kit.validita_al) return false;
                return kit.validita_al >= oggi && kit.validita_al <= dataLimite;
            }).length;

            return { totale, inScadenza, kit: kitVolantini };
        } catch (error) {
            throw wrapDatabaseError(error as Error, {
                message: 'Errore durante il recupero dei volantini in corso',
                operation: 'getVolantiniInCorso',
                entity: 'Dashboard'
            });
        }
    }

    /**
     * Recupera i volantini in lavorazione e quelli in attesa di approvazione
     */
    async getVolantiniInLavorazione(filters?: DashboardFilterParams): Promise<VolantiniInLavorazioneDTO> {
        try {
            const [formatoIds, volExportId] = await Promise.all([
                this.getFormatoVolantinoIds(),
                this.getTipoExportIdByCodice(EXPORT_DI_SISTEMA.VOL)
            ]);

            if (formatoIds.length === 0 || !volExportId) {
                return { totale: 0, inAttesa: 0, kit: [] };
            }

            const volKitIds = await this.getKitIdsConTipoExport(volExportId);
            if (volKitIds.length === 0) {
                return { totale: 0, inAttesa: 0, kit: [] };
            }

            const promoInCorso = await this.promoRepository.findByStato(STATO_PROMO.IN_LAVORAZIONE);
            const promoInScadenza = await this.promoRepository.findByStato(STATO_PROMO.IN_SCADENZA);
            const promoInCorsoIds = promoInCorso.map(p => p.getDataValue('id_promo'))
                .concat(promoInScadenza.map(p => p.getDataValue('id_promo')));

            if (promoInCorsoIds.length === 0) {
                return { totale: 0, inAttesa: 0, kit: [] };
            }

            const whereLavorazione: any = {
                stato_lavorazione: {
                    [Op.in]: [
                        STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
                        STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI
                    ]
                },
                id_formato: { [Op.in]: formatoIds },
                id_promo: { [Op.in]: promoInCorsoIds },
                id: { [Op.in]: volKitIds }
            };

            const whereRevisione: any = {
                stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
                id_formato: { [Op.in]: formatoIds },
                id: { [Op.in]: volKitIds }
            };

            if (filters?.id_area && filters.id_area.length > 0) {
                whereLavorazione.id_area = { [Op.in]: filters.id_area };
                whereRevisione.id_area = { [Op.in]: filters.id_area };
            }
            if (filters?.id_canale && filters.id_canale.length > 0) {
                whereLavorazione.id_canale = { [Op.in]: filters.id_canale };
                whereRevisione.id_canale = { [Op.in]: filters.id_canale };
            }

            const [kitInLavorazione, kitInRevisione] = await Promise.all([
                RuntimeKit.findAll({ where: whereLavorazione, raw: true }) as Promise<any[]>,
                RuntimeKit.findAll({ where: whereRevisione, raw: true }) as Promise<any[]>
            ]);

            const tuttiIKit = [...kitInLavorazione, ...kitInRevisione];

            const kitVolantini: KitVolantino[] = await Promise.all(
                tuttiIKit.map(kit => this.buildKitVolantino(kit, undefined, undefined, volExportId))
            );

            return {
                totale: kitInLavorazione.length,
                inAttesa: kitInRevisione.length,
                kit: kitVolantini
            };
        } catch (error) {
            throw wrapDatabaseError(error as Error, {
                message: 'Errore durante il recupero dei volantini in lavorazione',
                operation: 'getVolantiniInLavorazione',
                entity: 'Dashboard'
            });
        }
    }

    /**
     * Recupera i volantini pubblicati ma con promozione ancora in lavorazione
     */
    async getVolantiniPubblicatiInLavorazione(filters?: DashboardFilterParams): Promise<VolantiniPubblicatiInLavorazioneDTO> {
        try {
            const [formatoIds, volExportId] = await Promise.all([
                this.getFormatoVolantinoIds(),
                this.getTipoExportIdByCodice(EXPORT_DI_SISTEMA.VOL)
            ]);

            if (formatoIds.length === 0 || !volExportId) {
                return { totale: 0, kit: [] };
            }

            const volKitIds = await this.getKitIdsConTipoExport(volExportId);
            if (volKitIds.length === 0) {
                return { totale: 0, kit: [] };
            }

            const promoInLavorazione = await this.promoRepository.findByStato(STATO_PROMO.IN_LAVORAZIONE);
            const promoInLavorazioneIds = promoInLavorazione.map(p => p.getDataValue('id_promo'));

            if (promoInLavorazioneIds.length === 0) {
                return { totale: 0, kit: [] };
            }

            const whereQuery: any = {
                stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
                id_formato: { [Op.in]: formatoIds },
                id_promo: { [Op.in]: promoInLavorazioneIds },
                id: { [Op.in]: volKitIds }
            };

            if (filters?.id_area && filters.id_area.length > 0) {
                whereQuery.id_area = { [Op.in]: filters.id_area };
            }
            if (filters?.id_canale && filters.id_canale.length > 0) {
                whereQuery.id_canale = { [Op.in]: filters.id_canale };
            }

            const kitPubblicati = await RuntimeKit.findAll({ where: whereQuery, raw: true }) as any[];

            if (!kitPubblicati || kitPubblicati.length === 0) {
                return { totale: 0, kit: [] };
            }

            const promoIds = Array.from(new Set(kitPubblicati.map(kit => kit.id_promo).filter(Boolean)));
            const promoMap = new Map<string, { validita_dal?: Date; validita_al?: Date }>();

            if (promoIds.length > 0) {
                const promoList = await this.promoRepository.findByIds(promoIds, {
                    attributes: ['id_promo', 'validita_dal', 'validita_al']
                });

                promoList.forEach(promo => {
                    const validitaDal = promo.getDataValue('validita_dal');
                    const validitaAl = promo.getDataValue('validita_al');
                    promoMap.set(promo.getDataValue('id_promo'), {
                        validita_dal: validitaDal ? new Date(validitaDal) : undefined,
                        validita_al: validitaAl ? new Date(validitaAl) : undefined
                    });
                });
            }

            const kitVolantini: KitVolantino[] = await Promise.all(
                kitPubblicati.map(kit => {
                    const promoDates = promoMap.get(kit.id_promo);
                    return this.buildKitVolantino(kit, promoDates?.validita_dal, promoDates?.validita_al, volExportId);
                })
            );

            return { totale: kitVolantini.length, kit: kitVolantini };
        } catch (error) {
            throw wrapDatabaseError(error as Error, {
                message: 'Errore durante il recupero dei volantini pubblicati in lavorazione',
                operation: 'getVolantiniPubblicatiInLavorazione',
                entity: 'Dashboard'
            });
        }
    }

    /**
     * Recupera lo storico dei volantini pubblicati (promo scadute)
     */
    async getStoricoVolantini(filters?: DashboardFilterParams, limit?: number): Promise<StoricoVolantiniDTO> {
        try {
            const formatoIds = await this.getFormatoVolantinoIds();
            const now = new Date();

            if (formatoIds.length === 0) {
                return { totale: 0, kit: [] };
            }

            const promoScadute = await this.promoRepository.findExpiredBefore(now, 'desc');
            const promoScaduteIds = promoScadute.map(p => p.getDataValue('id_promo'));

            if (promoScaduteIds.length === 0) {
                return { totale: 0, kit: [] };
            }

            const whereQuery: any = {
                stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
                id_formato: { [Op.in]: formatoIds },
                id_promo: { [Op.in]: promoScaduteIds }
            };

            if (filters?.id_area && filters.id_area.length > 0) {
                whereQuery.id_area = { [Op.in]: filters.id_area };
            }
            if (filters?.id_canale && filters.id_canale.length > 0) {
                whereQuery.id_canale = { [Op.in]: filters.id_canale };
            }

            let kitPubblicati = await RuntimeKit.findAll({ where: whereQuery, raw: true }) as any[];

            if (!kitPubblicati || kitPubblicati.length === 0) {
                return { totale: 0, kit: [] };
            }

            const promoMap = new Map<string, { validita_dal?: Date; validita_al?: Date }>();
            promoScadute.forEach(promo => {
                const validitaDal = promo.getDataValue('validita_dal');
                const validitaAl = promo.getDataValue('validita_al');
                promoMap.set(promo.getDataValue('id_promo'), {
                    validita_dal: validitaDal ? new Date(validitaDal) : undefined,
                    validita_al: validitaAl ? new Date(validitaAl) : undefined
                });
            });

            kitPubblicati.sort((a, b) => {
                const dateA = promoMap.get(a.id_promo)?.validita_al || new Date(0);
                const dateB = promoMap.get(b.id_promo)?.validita_al || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });

            const totale = kitPubblicati.length;

            if (limit && limit > 0) {
                kitPubblicati = kitPubblicati.slice(0, limit);
            }

            const kitVolantini: KitVolantino[] = await Promise.all(
                kitPubblicati.map(kit => {
                    const promoDates = promoMap.get(kit.id_promo);
                    return this.buildKitVolantino(kit, promoDates?.validita_dal, promoDates?.validita_al);
                })
            );

            return { totale, kit: kitVolantini };
        } catch (error) {
            throw wrapDatabaseError(error as Error, {
                message: 'Errore durante il recupero dello storico volantini',
                operation: 'getStoricoVolantini',
                entity: 'Dashboard'
            });
        }
    }
}
