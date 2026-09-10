import { DatabaseError } from '../../../lib/errors';
import {
    CreateDisplayContextDTO,
    DisplayContextEndpointType,
    DisplayContextListResponseDTO,
    DisplayContextResponseDTO,
    UpdateDisplayContextDTO
} from '../dto/DisplayContextDTO';
import { log } from '../logger';
import { DisplayContextPuntoVendita, DisplayContextPuntoVenditaAttributes } from '../models/punto_vendita/display_context_punto_vendita';
import { DispositivoPuntoVendita } from '../models/punto_vendita/dispositivi_punto_vendita';

export class DisplayContextService {

    /* ======================================================
     * CRUD
     * ====================================================== */

    async createDisplayContext(data: CreateDisplayContextDTO): Promise<DisplayContextResponseDTO> {
        try {
            const created = await DisplayContextPuntoVendita.create({
                nome_display_context: data.nome,
                descrizione_display_context: data.descrizione,
                filters_display_context: data.filters,
                endpoint_type_display_context: data.endpoint_type,
                auto_scroll_display_context: data.auto_scroll ?? true,
                scroll_speed_display_context: data.scroll_speed ?? 5000,
                show_indicators_display_context: data.show_indicators ?? true,
                show_nav_buttons_display_context: data.show_nav_buttons ?? false,
                render_type_display_context: data.render_type,
                meta_options_display_context: data.meta_options ?? {},
                id_gdo_display_context: data.id_gdo,
                id_puntivendita_display_context: data.id_puntivendita,
            });

            return this.mapToDTO(created);
        } catch (error) {
            log.error('Errore creazione DisplayContext:', error);
            throw new DatabaseError({
                message: 'Errore durante la creazione del display context',
                cause: error instanceof Error ? error : undefined,
                operation: 'create',
                entity: 'DisplayContextPuntoVendita',
            });
        }
    }

    async getDisplayContextById(id: string): Promise<DisplayContextResponseDTO | null> {
        try {
            const ctx = await DisplayContextPuntoVendita.findByPk(id);
            if (!ctx) return null;

            const dispositiviCount = await DispositivoPuntoVendita.count({
                where: { id_display_context_dispositivo: id }
            });

            return this.mapToDTO(ctx, dispositiviCount);
        } catch (error) {
            log.error(`Errore recupero DisplayContext ${id}:`, error);
            throw new DatabaseError({
                message: 'Errore durante il recupero del display context',
                cause: error instanceof Error ? error : undefined,
                operation: 'get',
                entity: 'DisplayContextPuntoVendita',
            });
        }
    }

    async updateDisplayContext(id: string, data: UpdateDisplayContextDTO): Promise<DisplayContextResponseDTO | null> {
        try {
            const ctx = await DisplayContextPuntoVendita.findByPk(id);
            if (!ctx) return null;

            const updateData: Partial<DisplayContextPuntoVenditaAttributes> = {};

            if (data.nome !== undefined) updateData.nome_display_context = data.nome;
            if (data.descrizione !== undefined) updateData.descrizione_display_context = data.descrizione;
            if (data.filters !== undefined) updateData.filters_display_context = data.filters;
            if (data.endpoint_type !== undefined) updateData.endpoint_type_display_context = data.endpoint_type;
            if (data.auto_scroll !== undefined) updateData.auto_scroll_display_context = data.auto_scroll;
            if (data.scroll_speed !== undefined) updateData.scroll_speed_display_context = data.scroll_speed;
            if (data.show_indicators !== undefined) updateData.show_indicators_display_context = data.show_indicators;
            if (data.show_nav_buttons !== undefined) updateData.show_nav_buttons_display_context = data.show_nav_buttons;
            if (data.render_type !== undefined) updateData.render_type_display_context = data.render_type;
            if (data.meta_options !== undefined) updateData.meta_options_display_context = data.meta_options;
            if (data.id_puntivendita !== undefined) updateData.id_puntivendita_display_context = data.id_puntivendita ?? undefined;
            if (data.is_active !== undefined) updateData.is_active_display_context = data.is_active;

            await ctx.update(updateData);
            return this.mapToDTO(ctx);
        } catch (error) {
            log.error(`Errore aggiornamento DisplayContext ${id}:`, error);
            throw new DatabaseError({
                message: 'Errore durante l\'aggiornamento del display context',
                cause: error instanceof Error ? error : undefined,
                operation: 'update',
                entity: 'DisplayContextPuntoVendita',
            });
        }
    }

    async deleteDisplayContext(id: string): Promise<boolean> {
        try {
            const ctx = await DisplayContextPuntoVendita.findByPk(id);
            if (!ctx) return false;

            await ctx.destroy();
            return true;
        } catch (error) {
            log.error(`Errore eliminazione DisplayContext ${id}:`, error);
            throw new DatabaseError({
                message: 'Errore durante l\'eliminazione del display context',
                cause: error instanceof Error ? error : undefined,
                operation: 'delete',
                entity: 'DisplayContextPuntoVendita',
            });
        }
    }

    /* ======================================================
     * QUERY
     * ====================================================== */

    async getAllDisplayContexts(filters?: {
        id_gdo?: string;
        id_puntivendita?: string;
        endpoint_type?: DisplayContextEndpointType;
        is_active?: boolean;
    }): Promise<DisplayContextListResponseDTO> {
        try {
            const where: Record<string, unknown> = {};

            if (filters?.id_gdo) where.id_gdo_display_context = filters.id_gdo;
            if (filters?.id_puntivendita) where.id_puntivendita_display_context = filters.id_puntivendita;
            if (filters?.endpoint_type) where.endpoint_type_display_context = filters.endpoint_type;
            if (filters?.is_active !== undefined) where.is_active_display_context = filters.is_active;

            const contexts = await DisplayContextPuntoVendita.findAll({ where });

            return {
                contexts: contexts.map(ctx => this.mapToDTO(ctx)),
                total: contexts.length,
            };
        } catch (error) {
            log.error('Errore recupero DisplayContexts:', error);
            throw new DatabaseError({
                message: 'Errore durante il recupero dei display contexts',
                cause: error instanceof Error ? error : undefined,
                operation: 'get',
                entity: 'DisplayContextPuntoVendita',
            });
        }
    }

    async getDisplayContextsByGDO(id_gdo: string): Promise<DisplayContextResponseDTO[]> {
        const result = await this.getAllDisplayContexts({ id_gdo });
        return result.contexts;
    }

    async getDisplayContextsByPuntoVendita(id_pv: string): Promise<DisplayContextResponseDTO[]> {
        const result = await this.getAllDisplayContexts({ id_puntivendita: id_pv });
        return result.contexts;
    }

    /* ======================================================
     * MAPPING
     * ====================================================== */

    private mapToDTO(ctx: DisplayContextPuntoVendita, dispositiviCount?: number): DisplayContextResponseDTO {
        return {
            id: ctx.id_display_context,
            nome: ctx.nome_display_context,
            descrizione: ctx.descrizione_display_context,
            filters: ctx.filters_display_context,
            endpoint_type: ctx.endpoint_type_display_context,
            auto_scroll: ctx.auto_scroll_display_context,
            scroll_speed: ctx.scroll_speed_display_context,
            show_indicators: ctx.show_indicators_display_context,
            show_nav_buttons: ctx.show_nav_buttons_display_context,
            render_type: ctx.render_type_display_context,
            meta_options: ctx.meta_options_display_context,
            id_gdo: ctx.id_gdo_display_context,
            id_puntivendita: ctx.id_puntivendita_display_context,
            is_active: ctx.is_active_display_context,
            createdat: ctx.createdat!,
            updatedat: ctx.updatedat!,
            dispositivi_count: dispositiviCount,
        };
    }
}
