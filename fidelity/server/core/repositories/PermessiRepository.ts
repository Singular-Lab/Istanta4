import { QueryTypes } from 'sequelize';
import { TIPO_UTENTI } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { PermessoAttributes } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';
import { Permesso, PermessoRuolo, PermessoRuoloGdo } from '../models';

export class PermessiRepository {
  private legacyPermessiRuoloConstraint: boolean | null = null;
  private migrationDone = false;
  private gdoMigrationDone = false;

  private dedupePermessi(permessi: { id_permesso: string; abilitato: boolean }[]): { id_permesso: string; abilitato: boolean }[] {
    const uniqueByPermesso = new Map<string, boolean>();
    for (const permesso of permessi) {
      uniqueByPermesso.set(permesso.id_permesso, permesso.abilitato);
    }
    return Array.from(uniqueByPermesso.entries()).map(([id_permesso, abilitato]) => ({
      id_permesso,
      abilitato,
    }));
  }

  private async lockScope(transaction: any, lockKey: string): Promise<void> {
    await sequelize.query(
      `SELECT pg_advisory_xact_lock(hashtext(:lockKey))`,
      {
        replacements: { lockKey },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
  }

  private async hasLegacyPermessiRuoloConstraint(): Promise<boolean> {
    if (this.legacyPermessiRuoloConstraint !== null) {
      return this.legacyPermessiRuoloConstraint;
    }

    const result = await sequelize.query<{ is_legacy: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'permessi_ruolo'
          AND c.contype = 'u'
          AND c.conname = 'permessi_ruolo_tipo_utente_id_permesso'
      ) AS is_legacy
    `, {
      type: QueryTypes.SELECT,
    });

    this.legacyPermessiRuoloConstraint = Boolean(result[0]?.is_legacy);
    return this.legacyPermessiRuoloConstraint;
  }

  /**
   * Migra automaticamente il vincolo legacy a 2 colonne (tipo_utente, id_permesso)
   * al nuovo vincolo a 3 colonne (tipo_utente, id_permesso, id_ruolo_utente_gdo).
   * Idempotente: non fa nulla se il vincolo legacy non esiste.
   */
  async migrateLegacyConstraint(): Promise<boolean> {
    if (this.migrationDone) return false;
    this.migrationDone = true;

    const isLegacy = await this.hasLegacyPermessiRuoloConstraint();
    if (!isLegacy) return false;

    await sequelize.query(`
      ALTER TABLE permessi_ruolo
        DROP CONSTRAINT IF EXISTS permessi_ruolo_tipo_utente_id_permesso
    `);

    // Rimuovi eventuali duplicati prima di creare il nuovo vincolo
    await sequelize.query(`
      DELETE FROM permessi_ruolo a
      USING permessi_ruolo b
      WHERE a.ctid < b.ctid
        AND a.tipo_utente = b.tipo_utente
        AND a.id_permesso = b.id_permesso
        AND a.id_ruolo_utente_gdo IS NOT DISTINCT FROM b.id_ruolo_utente_gdo
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo
      ON permessi_ruolo (tipo_utente, id_permesso, COALESCE(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'))
    `);

    // Reset cache
    this.legacyPermessiRuoloConstraint = false;
    return true;
  }

  /**
   * Migra il vincolo legacy a 3 colonne (id_gdo, tipo_utente, id_permesso) su permessi_ruolo_gdo
   * al nuovo vincolo a 4 colonne con COALESCE su id_ruolo_utente_gdo.
   * Idempotente: non fa nulla se la migrazione è già stata eseguita.
   */
  async migrateLegacyGdoConstraint(): Promise<boolean> {
    if (this.gdoMigrationDone) return false;
    this.gdoMigrationDone = true;

    // Controlla se esiste il vincolo legacy a 3 colonne
    const result = await sequelize.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'permessi_ruolo_gdo'
          AND indexname = 'permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso'
      ) AS exists
    `, { type: QueryTypes.SELECT });

    if (!result[0]?.exists) {
      // Assicura comunque che l'indice COALESCE esista
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS permessi_ruolo_gdo_unique_override
        ON permessi_ruolo_gdo (id_gdo, tipo_utente, id_permesso, COALESCE(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'))
      `);
      return false;
    }

    // Drop vecchio vincolo a 3 colonne
    await sequelize.query(`
      DROP INDEX IF EXISTS permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso
    `);

    // Drop eventuale indice Sequelize a 4 colonne (senza COALESCE, non gestisce NULL)
    await sequelize.query(`
      DROP INDEX IF EXISTS permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_utente_gdo
    `);

    // Rimuovi eventuali duplicati prima di creare il nuovo vincolo
    await sequelize.query(`
      DELETE FROM permessi_ruolo_gdo a
      USING permessi_ruolo_gdo b
      WHERE a.ctid < b.ctid
        AND a.id_gdo = b.id_gdo
        AND a.tipo_utente = b.tipo_utente
        AND a.id_permesso = b.id_permesso
        AND a.id_ruolo_utente_gdo IS NOT DISTINCT FROM b.id_ruolo_utente_gdo
    `);

    // Crea nuovo indice univoco con COALESCE per gestire NULL
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS permessi_ruolo_gdo_unique_override
      ON permessi_ruolo_gdo (id_gdo, tipo_utente, id_permesso, COALESCE(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'))
    `);

    return true;
  }

  private async ensureSubRoleSupported(idRuoloGdo?: string): Promise<void> {
    if (!idRuoloGdo) return;

    const isLegacyConstraint = await this.hasLegacyPermessiRuoloConstraint();
    if (!isLegacyConstraint) return;

    throw new BadRequestError({
      message: 'Lo schema database attuale non supporta i permessi per sotto-ruolo GDO. Aggiorna il vincolo univoco di permessi_ruolo includendo id_ruolo_utente_gdo.',
      details: {
        constraint: 'permessi_ruolo_tipo_utente_id_permesso',
        table: 'permessi_ruolo',
      },
    });
  }

  async findAllPermessi(): Promise<typeof Permesso extends { new(): infer T } ? T[] : any[]> {
    return Permesso.findAll({ order: [['risorsa', 'ASC'], ['codice', 'ASC']] });
  }

  async findPermessoByCodice(codice: string) {
    return Permesso.findOne({ where: { codice } });
  }

  async findPermessiPerRuolo(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string) {
    return sequelize.query<any>(`
      SELECT pr.*, p.codice, p.nome, p.descrizione, p.categoria, p.risorsa
      FROM permessi_ruolo pr
      JOIN permessi p ON p.id_permesso = pr.id_permesso
      WHERE pr.tipo_utente = :tipoUtente
        AND pr.id_ruolo_utente_gdo IS NOT DISTINCT FROM :idRuoloGdo
    `, {
      replacements: { tipoUtente, idRuoloGdo: idRuoloGdo ?? null },
      type: QueryTypes.SELECT,
    });
  }

  async findPermessiOverrideGdo(idGdo: string, tipoUtente: TIPO_UTENTI, idRuoloGdo?: string) {
    return sequelize.query<any>(`
      SELECT prg.*, p.codice, p.nome, p.descrizione, p.categoria, p.risorsa
      FROM permessi_ruolo_gdo prg
      JOIN permessi p ON p.id_permesso = prg.id_permesso
      WHERE prg.id_gdo = :idGdo
        AND prg.tipo_utente = :tipoUtente
        AND prg.id_ruolo_utente_gdo IS NOT DISTINCT FROM :idRuoloGdo
    `, {
      replacements: { idGdo, tipoUtente, idRuoloGdo: idRuoloGdo ?? null },
      type: QueryTypes.SELECT,
    });
  }

  async upsertPermessoRuolo(tipoUtente: TIPO_UTENTI, idPermesso: string, abilitato: boolean, idRuoloGdo?: string) {
    const where: any = {
      tipo_utente: tipoUtente,
      id_permesso: idPermesso,
      id_ruolo_utente_gdo: idRuoloGdo ?? null,
    };
    const existing = await PermessoRuolo.findOne({ where });
    if (existing) {
      existing.abilitato = abilitato;
      existing.updatedat = new Date();
      await existing.save();
      return existing;
    }
    return PermessoRuolo.create({
      tipo_utente: tipoUtente,
      id_permesso: idPermesso,
      id_ruolo_utente_gdo: idRuoloGdo ?? null,
      abilitato,
      createdat: new Date(),
      updatedat: new Date(),
    } as any);
  }

  async upsertPermessoRuoloGdo(idGdo: string, tipoUtente: TIPO_UTENTI, idPermesso: string, abilitato: boolean, idRuoloGdo?: string) {
    const where: any = {
      id_gdo: idGdo,
      tipo_utente: tipoUtente,
      id_permesso: idPermesso,
      id_ruolo_utente_gdo: idRuoloGdo ?? null,
    };
    const existing = await PermessoRuoloGdo.findOne({ where });
    if (existing) {
      existing.abilitato = abilitato;
      existing.updatedat = new Date();
      await existing.save();
      return existing;
    }
    return PermessoRuoloGdo.create({
      id_gdo: idGdo,
      tipo_utente: tipoUtente,
      id_permesso: idPermesso,
      id_ruolo_utente_gdo: idRuoloGdo ?? null,
      abilitato,
      createdat: new Date(),
      updatedat: new Date(),
    } as any);
  }

  async deleteOverrideGdo(idGdo: string, tipoUtente?: TIPO_UTENTI, idRuoloGdo?: string) {
    const where: any = { id_gdo: idGdo };
    if (tipoUtente) where.tipo_utente = tipoUtente;
    if (idRuoloGdo !== undefined) {
      where.id_ruolo_utente_gdo = idRuoloGdo || null;
    }
    return PermessoRuoloGdo.destroy({ where });
  }

  async bulkUpsertPermessiRuolo(tipoUtente: TIPO_UTENTI, permessi: { id_permesso: string; abilitato: boolean }[], idRuoloGdo?: string) {
    await this.ensureSubRoleSupported(idRuoloGdo);
    const normalizedPermessi = this.dedupePermessi(permessi);
    if (normalizedPermessi.length === 0) return [];

    const t = await sequelize.transaction();
    try {
      await this.lockScope(
        t,
        `permessi_ruolo:${tipoUtente}:${idRuoloGdo ?? '_base_'}`
      );

      await PermessoRuolo.destroy({
        where: {
          tipo_utente: tipoUtente,
          id_ruolo_utente_gdo: idRuoloGdo ?? null,
          id_permesso: normalizedPermessi.map(p => p.id_permesso),
        },
        transaction: t,
      });

      const records = normalizedPermessi.map(p => ({
        tipo_utente: tipoUtente,
        id_permesso: p.id_permesso,
        id_ruolo_utente_gdo: idRuoloGdo ?? null,
        abilitato: p.abilitato,
        createdat: new Date(),
        updatedat: new Date(),
      }));

      const result = await PermessoRuolo.bulkCreate(records, { transaction: t });
      await t.commit();
      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async bulkUpsertPermessiRuoloGdo(idGdo: string, tipoUtente: TIPO_UTENTI, permessi: { id_permesso: string; abilitato: boolean }[], idRuoloGdo?: string) {
    const normalizedPermessi = this.dedupePermessi(permessi);
    if (normalizedPermessi.length === 0) return [];

    const t = await sequelize.transaction();
    try {
      await this.lockScope(
        t,
        `permessi_ruolo_gdo:${idGdo}:${tipoUtente}:${idRuoloGdo ?? '_base_'}`
      );

      // Delete existing records for this combination, then re-insert
      await PermessoRuoloGdo.destroy({
        where: {
          id_gdo: idGdo,
          tipo_utente: tipoUtente,
          id_ruolo_utente_gdo: idRuoloGdo ?? null,
          id_permesso: normalizedPermessi.map(p => p.id_permesso),
        },
        transaction: t,
      });

      const records = normalizedPermessi.map(p => ({
        id_gdo: idGdo,
        tipo_utente: tipoUtente,
        id_permesso: p.id_permesso,
        id_ruolo_utente_gdo: idRuoloGdo ?? null,
        abilitato: p.abilitato,
        createdat: new Date(),
        updatedat: new Date(),
      }));

      const result = await PermessoRuoloGdo.bulkCreate(records, { transaction: t });
      await t.commit();
      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async bulkCreatePermessi(permessi: Omit<PermessoAttributes, 'id_permesso'>[]) {
    return Permesso.bulkCreate(
      permessi.map(p => ({ ...p, createdat: new Date(), updatedat: new Date() })) as any[],
      { ignoreDuplicates: true }
    );
  }
}
