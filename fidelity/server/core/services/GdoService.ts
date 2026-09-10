import { wrapDatabaseError } from '../../../lib/errors';
import { GDOResponseDTO, RuoloUtenteGDOResponseDTO } from '../dto';
import { IGdoService } from '../interfaces/IGdoService';
import type { IGdoRepository } from '../repositories/GdoRepository';
import { GdoRepository } from '../repositories/GdoRepository';
import type { IRuoloUtenteGdoRepository } from '../repositories/RuoloUtenteGdoRepository';
import { RuoloUtenteGdoRepository } from '../repositories/RuoloUtenteGdoRepository';

export class GdoService implements IGdoService {
  constructor(
    private readonly gdoRepository: IGdoRepository = new GdoRepository(),
    private readonly ruoloUtenteGdoRepository: IRuoloUtenteGdoRepository = new RuoloUtenteGdoRepository()
  ) {}



  async getGDOById(id: string): Promise<GDOResponseDTO | null> {
    try {
      // Optimized: Single query with children count via include
      const gdo = await this.gdoRepository.findByIdWithChildren(id);

      if (!gdo) {
        return null;
      }

      const children = (gdo as any).children || [];
      const hasChildren = children.length > 0;

      const gdoResponse: GDOResponseDTO = {
        id: gdo.id_gdo ?? '',
        nome: gdo.nome_gdo ?? '',
        id_parent: gdo.idparent_gdo ?? '',
        createdat: gdo.createdat ?? undefined,
        updatedat: gdo.updatedat ?? undefined,
        is_parent: hasChildren,
        has_children: hasChildren,
      };
      return gdoResponse;
    } catch (error) {
      throw wrapDatabaseError(error, {
        operation: 'find',
        entity: 'GDO',
        message: `Errore nella ricerca del GDO ${id}`,
      });
    }
  }

  async getGDOByUtenteId(id: string): Promise<GDOResponseDTO | null> {
    try {
      if (id === null || id === undefined) {
        return null;
      }

      // Optimized: Single query with nested includes (N+1 -> 1 query)
      const gdo = await this.gdoRepository.findByUtenteIdWithChildren(id);
      if (!gdo) {
        return null;
      }

      const children = (gdo as any).children || [];
      const hasChildren = children.length > 0;

      const gdoResponse: GDOResponseDTO = {
        id: gdo.id_gdo ?? '',
        nome: gdo.nome_gdo ?? '',
        id_parent: gdo.idparent_gdo ?? '',
        createdat: gdo.createdat ?? undefined,
        updatedat: gdo.updatedat ?? undefined,
        is_parent: hasChildren,
        has_children: hasChildren,
      };
      return gdoResponse;
    } catch (error) {
      throw wrapDatabaseError(error, {
        operation: 'findOne',
        entity: 'UtentiGDO',
        message: `Errore nella ricerca dell'utente GDO ${id}`,
        details: { userId: id },
      });
    }
  }

  async getAllGDO(): Promise<GDOResponseDTO[]> {
    try {
      const gdoList = await this.gdoRepository.findAll();
      return gdoList.map((gdo) => ({
        id: gdo.id_gdo ?? '',
        nome: gdo.nome_gdo ?? '',
        id_parent: gdo.idparent_gdo ?? '',
        ragione_sociale: gdo.ragione_sociale_gdo,
        createdat: gdo.createdat ?? undefined,
        updatedat: gdo.updatedat ?? undefined,
      }));
    } catch (error) {
      throw wrapDatabaseError(error, {
        operation: 'findAll',
        entity: 'GDO',
        message: 'Errore nella ricerca di tutte le GDO',
      });
    }
  }

  async getAllRuoliGDO(): Promise<RuoloUtenteGDOResponseDTO[]> {
    try {
      const ruoli = await this.ruoloUtenteGdoRepository.findAll();
      return ruoli.map((ruolo) => ({
        id: ruolo.id_ruolo_utente_gdo,
        ruolo: ruolo.ruolo_ruolo_utente_gdo,
        api_key: ruolo.api_key_ruolo_utente_gdo,
        createdat: ruolo.createdat,
        updatedat: ruolo.updatedat,
      }));
    } catch (error) {
      throw wrapDatabaseError(error, {
        operation: 'findAll',
        entity: 'RuoloUtenteGDO',
        message: `Errore nella ricerca dei ruoli utente GDO`,
      });
    }
  }
}
