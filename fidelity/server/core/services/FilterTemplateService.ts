import { Op } from 'sequelize';
import { NotFoundError, ValidationError } from '../../../lib/errors';
import {
  CreateFilterTemplateDTO,
  FilterConditionDTO,
  FilterTemplateDTO,
  FilterTemplateEndpointType,
  FilterTemplateListResponseDTO,
  FilterTemplateVersionDTO,
  FilterTemplateVersionHistoryDTO,
  UpdateFilterTemplateDTO
} from '../dto';
import { log } from '../logger';
import { FilterTemplate } from '../models/filter_template';
import { Utente } from '../models/utenti';
import type { IFilterTemplateRepository } from '../repositories/FilterTemplateRepository';
import { FilterTemplateRepository } from '../repositories/FilterTemplateRepository';
import type { IUserRepository } from '../repositories/UserRepository';
import { UserRepository } from '../repositories/UserRepository';

// Re-export dei DTO per retrocompatibilità
export type {
  CreateFilterTemplateDTO,
  FilterConditionDTO,
  FilterTemplateListResponseDTO,
  FilterTemplateDTO as FilterTemplateResponseDTO,
  FilterTemplateVersionDTO,
  FilterTemplateVersionHistoryDTO,
  UpdateFilterTemplateDTO
};

// Converti modello in DTO
function toFilterTemplateResponseDTO(
  template: FilterTemplate,
  creatore?: Utente | null
): FilterTemplateDTO {
  return {
    id_filter_template: template.id_filter_template,
    nome: template.nome,
    slug: template.slug,
    descrizione: template.descrizione,
    parent_template_id: template.parent_template_id,
    template_ids: template.template_ids || [],
    export_codes: template.export_codes || [],
    filters: template.filters || [],
    endpoint_type: template.endpoint_type,
    render_type: template.render_type,
    // Opzioni di visualizzazione per il plugin
    auto_scroll: template.auto_scroll,
    scroll_speed: template.scroll_speed,
    show_indicators: template.show_indicators,
    show_nav_buttons: template.show_nav_buttons,
    meta_options: template.meta_options || {},
    is_active: template.is_active,
    is_latest: template.is_latest,
    deleted_at: template.deleted_at ? template.deleted_at.toISOString() : null,
    creatore: creatore
      ? {
        id: creatore.id_utenti,
        nome: creatore.nome_utenti || '',
        cognome: creatore.cognome_utenti || ''
      }
      : undefined,
    version: template.version,
    createdat: template.createdat.toISOString(),
    updatedat: template.updatedat.toISOString()
  };
}

export class FilterTemplateService {
  constructor(
    private readonly filterTemplateRepository: IFilterTemplateRepository = new FilterTemplateRepository(),
    private readonly userRepository: IUserRepository = new UserRepository()
  ) {}

  /**
   * Crea un nuovo template di filtri
   */
  async create(
    dto: CreateFilterTemplateDTO,
    userId: string,
    gdoId: string
  ): Promise<FilterTemplateDTO> {
    try {
      const normalizedSlug = dto.slug.toLowerCase();
      // Valida lo slug
      if (!FilterTemplate.isValidSlug(normalizedSlug)) {
        throw new ValidationError({
          message:
            'Lo slug deve essere lowercase, alfanumerico con trattini e massimo 100 caratteri'
        });
      }

      // Verifica unicità slug per GDO
      const existingTemplate = await FilterTemplate.findOne({
        where: {
          slug: normalizedSlug,
          id_gdo: gdoId
        }
      });

      if (existingTemplate) {
        throw new ValidationError({
          message: `Lo slug "${dto.slug}" è già utilizzato per questa GDO`
        });
      }

      // Valida la struttura dei filtri
      this.validateFilters(dto.filters);

      // Crea il template
      const template = await FilterTemplate.create({
        nome: dto.nome,
        slug: normalizedSlug,
        descrizione: dto.descrizione || null,
        template_ids: dto.template_ids || [],
        export_codes: dto.export_codes || [],
        filters: dto.filters,
        endpoint_type: dto.endpoint_type,
        render_type: dto.render_type,
        // Opzioni di visualizzazione con valori di default
        auto_scroll: dto.auto_scroll ?? true,
        scroll_speed: dto.scroll_speed ?? 5000,
        show_indicators: dto.show_indicators ?? true,
        show_nav_buttons: dto.show_nav_buttons ?? true,
        meta_options: dto.meta_options || {},
        id_gdo: gdoId,
        id_utente_creatore: userId,
        is_active: true,
        is_latest: true,
        version: 1,
        parent_template_id: null,
        deleted_at: null,
        deleted_by: null
      });

      if (!template.parent_template_id) {
        await template.update({ parent_template_id: template.id_filter_template });
        template.parent_template_id = template.id_filter_template;
      }

      log.info('FilterTemplate creato', {
        id: template.id_filter_template,
        slug: template.slug,
        gdoId
      });

      // Recupera il creatore per la risposta
      const creatoreRecord = await this.userRepository.findById(userId);
      const creatore = creatoreRecord ? creatoreRecord as unknown as Utente : null;

      return toFilterTemplateResponseDTO(template, creatore);
    } catch (error) {
      log.error('Errore nella creazione FilterTemplate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dto
      });
      throw error;
    }
  }

  /**
   * Aggiorna un template esistente
   */
  async update(
    id: string,
    dto: UpdateFilterTemplateDTO,
    userId: string,
    gdoId: string
  ): Promise<FilterTemplateDTO> {
    try {
      const template = await FilterTemplate.findOne({
        where: {
          id_filter_template: id,
          id_gdo: gdoId
        }
      });

      if (!template) {
        throw new NotFoundError({
          message: 'Template non trovato',
          entityType: 'FilterTemplate',
          entityId: id
        });
      }

      if (template.deleted_at) {
        throw new ValidationError({ message: 'Impossibile modificare una versione eliminata' });
      }

      if (!template.is_latest) {
        throw new ValidationError({ message: 'Solo l\'ultima versione può essere modificata' });
      }

      const lineageId = template.parent_template_id || template.id_filter_template;

      // Se si sta aggiornando lo slug, verifica validità e unicità
      let normalizedSlug = template.slug;
      if (dto.slug && dto.slug !== template.slug) {
        const slugCandidate = dto.slug.toLowerCase();
        if (!FilterTemplate.isValidSlug(slugCandidate)) {
          throw new ValidationError({
            message:
              'Lo slug deve essere lowercase, alfanumerico con trattini e massimo 100 caratteri'
          });
        }

        const existingTemplate = await FilterTemplate.findOne({
          where: {
            slug: slugCandidate,
            id_gdo: gdoId
          }
        });

        if (existingTemplate) {
          throw new ValidationError({
            message: `Lo slug "${slugCandidate}" è già utilizzato per questa GDO`
          });
        }

        await FilterTemplate.update(
          { slug: slugCandidate },
          {
            where: {
              slug: template.slug,
              id_gdo: gdoId
            }
          }
        );
        normalizedSlug = slugCandidate;
      }

      if (dto.slug && dto.slug === template.slug) {
        normalizedSlug = template.slug;
      }

      // Valida i filtri se presenti
      if (dto.filters) {
        this.validateFilters(dto.filters);
      }

      const lineagePredicate = {
        [Op.or]: [
          { parent_template_id: lineageId },
          { id_filter_template: lineageId }
        ]
      };

      await FilterTemplate.update(
        { is_latest: false },
        {
          where: {
            ...lineagePredicate,
            is_latest: true
          }
        }
      );

      const latestTemplate = await FilterTemplate.findOne({
        where: {
          ...lineagePredicate
        },
        order: [['version', 'DESC']]
      });

      const nextVersion = (latestTemplate?.version || template.version) + 1;

      const newTemplate = await FilterTemplate.create({
        nome: dto.nome ?? template.nome,
        slug: normalizedSlug,
        descrizione: dto.descrizione !== undefined ? dto.descrizione : template.descrizione,
        template_ids: dto.template_ids ?? template.template_ids,
        export_codes: dto.export_codes ?? template.export_codes,
        filters: dto.filters ?? template.filters,
        endpoint_type: dto.endpoint_type ?? template.endpoint_type,
        render_type: dto.render_type !== undefined ? dto.render_type : template.render_type,
        auto_scroll: dto.auto_scroll !== undefined ? dto.auto_scroll : template.auto_scroll,
        scroll_speed: dto.scroll_speed !== undefined ? dto.scroll_speed : template.scroll_speed,
        show_indicators: dto.show_indicators !== undefined ? dto.show_indicators : template.show_indicators,
        show_nav_buttons: dto.show_nav_buttons !== undefined ? dto.show_nav_buttons : template.show_nav_buttons,
        meta_options: dto.meta_options ?? template.meta_options,
        id_gdo: template.id_gdo,
        id_agenzia: template.id_agenzia,
        id_utente_creatore: userId,
        is_active: dto.is_active !== undefined ? dto.is_active : template.is_active,
        is_latest: true,
        version: nextVersion,
        parent_template_id: lineageId,
        deleted_at: null,
        deleted_by: null
      });

      const creatoreRecord = await this.userRepository.findById(userId);
      const creatore = creatoreRecord ? creatoreRecord as unknown as Utente : null;

      log.info('FilterTemplate aggiornato (nuova versione)', {
        id: newTemplate.id_filter_template,
        slug: newTemplate.slug,
        version: newTemplate.version
      });

      return toFilterTemplateResponseDTO(newTemplate, creatore);
    } catch (error) {
      log.error('Errore nell\'aggiornamento FilterTemplate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id,
        dto
      });
      throw error;
    }
  }

  /**
   * Elimina un template
   */
  async delete(id: string, gdoId: string, userId: string): Promise<void> {
    try {
      const template = await FilterTemplate.findOne({
        where: {
          id_filter_template: id,
          id_gdo: gdoId
        }
      });

      if (!template) {
        throw new NotFoundError({
          message: 'Template non trovato',
          entityType: 'FilterTemplate',
          entityId: id
        });
      }

      if (template.deleted_at) {
        return;
      }

      await template.update({
        deleted_at: new Date(),
        deleted_by: userId,
        is_active: false,
        is_latest: false
      });

      if (template.is_latest) {
        const nextTemplate = await FilterTemplate.findOne({
          where: {
            slug: template.slug,
            id_gdo: gdoId,
            deleted_at: null,
            id_filter_template: { [Op.ne]: template.id_filter_template }
          },
          order: [['version', 'DESC']]
        });

        if (nextTemplate) {
          await nextTemplate.update({ is_latest: true });
        }
      }

      log.info('FilterTemplate eliminato (soft)', {
        id,
        slug: template.slug,
        deleted_by: userId
      });
    } catch (error) {
      log.error('Errore nell\'eliminazione FilterTemplate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id
      });
      throw error;
    }
  }

  /**
   * Recupera un template per ID
   */
  async getById(id: string, gdoId: string): Promise<FilterTemplateDTO> {
    try {
      const template = await FilterTemplate.findOne({
        where: {
          id_filter_template: id,
          id_gdo: gdoId
        },
        include: [
          {
            model: Utente,
            as: 'creatore',
            attributes: ['id_utenti', 'nome_utenti', 'cognome_utenti']
          }
        ]
      });

      if (!template) {
        throw new NotFoundError({
          message: 'Template non trovato',
          entityType: 'FilterTemplate',
          entityId: id
        });
      }

      const creatore = (template as any).creatore as Utente | undefined;

      return toFilterTemplateResponseDTO(template, creatore);
    } catch (error) {
      log.error('Errore nel recupero FilterTemplate per ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id
      });
      throw error;
    }
  }

  /**
   * Recupera un template per slug (usato dal plugin)
   */
  async getBySlug(
    slug: string,
    gdoId: string
  ): Promise<FilterTemplateDTO | null> {
    try {
      const template = await FilterTemplate.findOne({
        where: {
          slug: slug.toLowerCase(),
          id_gdo: gdoId,
          is_active: true,
          deleted_at: null,
          is_latest: true
        }
      });

      if (!template) {
        return null;
      }

      return toFilterTemplateResponseDTO(template);
    } catch (error) {
      log.error('Errore nel recupero FilterTemplate per slug', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug
      });
      throw error;
    }
  }

  /**
   * Recupera un template per slug senza verificare la GDO (usato per accesso pubblico via plugin)
   * Gli slug sono unici per GDO, quindi questo metodo è sicuro per l'accesso esterno
   */
  async getBySlugPublic(slug: string, version?: number): Promise<FilterTemplateDTO | null> {
    try {
      const whereClause: any = {
        slug: slug.toLowerCase(),
        is_active: true,
        deleted_at: null
      };

      if (typeof version === 'number' && !Number.isNaN(version)) {
        whereClause.version = version;
      } else {
        whereClause.is_latest = true;
      }

      const template = await FilterTemplate.findOne({
        where: whereClause
      });

      if (!template) {
        return null;
      }

      return toFilterTemplateResponseDTO(template);
    } catch (error) {
      log.error('Errore nel recupero FilterTemplate per slug (pubblico)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug,
        version
      });
      throw error;
    }
  }

  /**
   * Recupera tutti i template per una GDO
   */
  async getAllForOrganization(
    gdoId: string,
    includeInactive = false
  ): Promise<FilterTemplateListResponseDTO> {
    try {
      const whereClause: any = {
        id_gdo: gdoId,
        deleted_at: null,
        is_latest: true
      };

      if (!includeInactive) {
        whereClause.is_active = true;
      }

      const templates = await FilterTemplate.findAll({
        where: whereClause,
        include: [
          {
            model: Utente,
            as: 'creatore',
            attributes: ['id_utenti', 'nome_utenti', 'cognome_utenti']
          }
        ],
        order: [['updatedat', 'DESC']]
      });

      const responseTemplates = templates.map((t) => {
        const creatore = (t as any).creatore as Utente | undefined;
        return toFilterTemplateResponseDTO(t, creatore);
      });

      return {
        templates: responseTemplates,
        totale: responseTemplates.length
      };
    } catch (error) {
      log.error('Errore nel recupero FilterTemplates per GDO', {
        error: error instanceof Error ? error.message : 'Unknown error',
        gdoId
      });
      throw error;
    }
  }

  /**
   * Recupera i template filtrati per tipo di endpoint
   */
  async getByEndpointType(
    gdoId: string,
    endpointType: FilterTemplateEndpointType
  ): Promise<FilterTemplateDTO[]> {
    try {
      const templates = await FilterTemplate.findAll({
        where: {
          id_gdo: gdoId,
          endpoint_type: endpointType,
          is_active: true,
          deleted_at: null,
          is_latest: true
        },
        include: [
          {
            model: Utente,
            as: 'creatore',
            attributes: ['id_utenti', 'nome_utenti', 'cognome_utenti']
          }
        ],
        order: [['nome', 'ASC']]
      });

      return templates.map((t) => {
        const creatore = (t as any).creatore as Utente | undefined;
        return toFilterTemplateResponseDTO(t, creatore);
      });
    } catch (error) {
      log.error('Errore nel recupero FilterTemplates per endpoint type', {
        error: error instanceof Error ? error.message : 'Unknown error',
        gdoId,
        endpointType
      });
      throw error;
    }
  }

  async getVersionHistory(
    slug: string,
    gdoId: string
  ): Promise<FilterTemplateVersionHistoryDTO> {
    try {
      const normalizedSlug = slug.toLowerCase();
      const templates = await FilterTemplate.findAll({
        where: {
          slug: normalizedSlug,
          id_gdo: gdoId
        },
        order: [['version', 'DESC']]
      });

      if (templates.length === 0) {
        throw new NotFoundError({
          message: 'Nessuna versione trovata per il template richiesto',
          entityType: 'FilterTemplate',
          entityId: slug
        });
      }

      const currentTemplate =
        templates.find((tpl) => tpl.is_latest && !tpl.deleted_at) ||
        templates.find((tpl) => !tpl.deleted_at) ||
        templates[0];

      const creatoreRecord = await this.userRepository.findById(currentTemplate.id_utente_creatore);
      const creatore = creatoreRecord ? creatoreRecord as unknown as Utente : null;

      return {
        slug: normalizedSlug,
        total_versions: templates.length,
        current_version: toFilterTemplateResponseDTO(currentTemplate, creatore || undefined),
        versions: templates.map<FilterTemplateVersionDTO>((tpl) => ({
          id_filter_template: tpl.id_filter_template,
          version: tpl.version,
          nome: tpl.nome,
          is_active: tpl.is_active,
          is_latest: tpl.is_latest,
          deleted_at: tpl.deleted_at ? tpl.deleted_at.toISOString() : null,
          createdat: tpl.createdat.toISOString()
        }))
      };
    } catch (error) {
      log.error('Errore nel recupero cronologia versioni FilterTemplate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug,
        gdoId
      });
      throw error;
    }
  }

  async restoreVersion(
    slug: string,
    targetVersion: number,
    userId: string,
    gdoId: string
  ): Promise<FilterTemplateDTO> {
    try {
      const normalizedSlug = slug.toLowerCase();

      const templateToRestore = await FilterTemplate.findOne({
        where: {
          slug: normalizedSlug,
          id_gdo: gdoId,
          version: targetVersion
        }
      });

      if (!templateToRestore) {
        throw new NotFoundError({
          message: 'Versione richiesta non trovata',
          entityType: 'FilterTemplate',
          entityId: `${slug}::${targetVersion}`
        });
      }

      const lineageId = templateToRestore.parent_template_id || templateToRestore.id_filter_template;

      await FilterTemplate.update(
        { is_latest: false },
        {
          where: {
            slug: normalizedSlug,
            id_gdo: gdoId,
            is_latest: true
          }
        }
      );

      const highestTemplate = await FilterTemplate.findOne({
        where: {
          slug: normalizedSlug,
          id_gdo: gdoId
        },
        order: [['version', 'DESC']]
      });

      const nextVersion = (highestTemplate?.version || templateToRestore.version) + 1;

      const restoredTemplate = await FilterTemplate.create({
        nome: templateToRestore.nome,
        slug: normalizedSlug,
        descrizione: templateToRestore.descrizione,
        template_ids: templateToRestore.template_ids,
        export_codes: templateToRestore.export_codes,
        filters: templateToRestore.filters,
        endpoint_type: templateToRestore.endpoint_type,
        render_type: templateToRestore.render_type,
        auto_scroll: templateToRestore.auto_scroll,
        scroll_speed: templateToRestore.scroll_speed,
        show_indicators: templateToRestore.show_indicators,
        show_nav_buttons: templateToRestore.show_nav_buttons,
        meta_options: templateToRestore.meta_options,
        id_gdo: templateToRestore.id_gdo,
        id_agenzia: templateToRestore.id_agenzia,
        id_utente_creatore: userId,
        is_active: templateToRestore.is_active,
        is_latest: true,
        version: nextVersion,
        parent_template_id: lineageId,
        deleted_at: null,
        deleted_by: null
      });

      const creatoreRecord = await this.userRepository.findById(userId);
      const creatore = creatoreRecord ? creatoreRecord as unknown as Utente : null;

      log.info('FilterTemplate ripristinato', {
        slug: normalizedSlug,
        targetVersion,
        newVersion: restoredTemplate.version,
        restoredBy: userId
      });

      return toFilterTemplateResponseDTO(restoredTemplate, creatore || undefined);
    } catch (error) {
      log.error('Errore nel ripristino della versione FilterTemplate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug,
        targetVersion,
        gdoId
      });
      throw error;
    }
  }

  /**
   * Valida la disponibilità di uno slug
   */
  async validateSlug(
    slug: string,
    gdoId: string,
    excludeId?: string
  ): Promise<{ available: boolean; suggestion?: string }> {
    try {
      const normalizedSlug = slug.toLowerCase();

      if (!FilterTemplate.isValidSlug(normalizedSlug)) {
        return {
          available: false,
          suggestion: FilterTemplate.generateSlugFromName(slug)
        };
      }

      const allowedLineageIds = new Set<string>();
      if (excludeId) {
        const excludedTemplate = await FilterTemplate.findByPk(excludeId);
        if (excludedTemplate) {
          allowedLineageIds.add(excludedTemplate.parent_template_id || excludedTemplate.id_filter_template);
        }
      }

      const isSlugAvailable = async (candidate: string): Promise<boolean> => {
        const matches = await FilterTemplate.findAll({
          where: {
            slug: candidate,
            id_gdo: gdoId
          }
        });

        if (matches.length === 0) {
          return true;
        }

        if (allowedLineageIds.size === 0) {
          return false;
        }

        return matches.every((match) => {
          const lineageId = match.parent_template_id || match.id_filter_template;
          return allowedLineageIds.has(lineageId);
        });
      };

      if (!(await isSlugAvailable(normalizedSlug))) {
        let suggestion: string | undefined;
        let counter = 1;
        while (counter <= 100) {
          const testSlug = `${normalizedSlug}-${counter}`;
          if (await isSlugAvailable(testSlug)) {
            suggestion = testSlug;
            break;
          }
          counter++;
        }

        return {
          available: false,
          suggestion
        };
      }

      return { available: true };
    } catch (error) {
      log.error('Errore nella validazione slug', {
        error: error instanceof Error ? error.message : 'Unknown error',
        slug
      });
      throw error;
    }
  }

  /**
   * Genera un suggerimento di slug dal nome
   */
  generateSlugSuggestion(nome: string): string {
    return FilterTemplate.generateSlugFromName(nome);
  }

  /**
   * Valida la struttura dei filtri
   */
  private validateFilters(filters: FilterConditionDTO[][]): void {
    if (!Array.isArray(filters)) {
      throw new ValidationError({ message: 'I filtri devono essere un array' });
    }

    const validOperators = [
      'equals',
      'not_equals',
      'greater_than',
      'less_than',
      'contains',
      'not_contains',
      'in',
      'not_in'
    ];

    for (const group of filters) {
      if (!Array.isArray(group)) {
        throw new ValidationError({
          message: 'Ogni gruppo di filtri deve essere un array'
        });
      }

      for (const condition of group) {
        if (!condition.field || typeof condition.field !== 'string') {
          throw new ValidationError({
            message: 'Ogni condizione deve avere un campo "field" valido'
          });
        }

        if (!validOperators.includes(condition.operator)) {
          throw new ValidationError({
            message: `Operatore "${condition.operator}" non valido. Operatori supportati: ${validOperators.join(', ')}`
          });
        }

        if (condition.value === undefined || condition.value === null) {
          throw new ValidationError({
            message: 'Ogni condizione deve avere un campo "value"'
          });
        }
      }
    }
  }
}

// Singleton export
export const filterTemplateService = new FilterTemplateService();
