import { TIPO_UTENTI } from '../../../lib/enums';
import { log } from '../logger';
import { Permesso, PermessoRuolo, PermessoRuoloGdo, UtentiGDO } from '../models';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';
import type { IPermessiService, PermessoConStatoDTO, PermessoDTO } from '../interfaces/IPermessiService';
import { PermessiRepository } from '../repositories/PermessiRepository';
import { PERMESSI_SEED, PERMESSI_RUOLO_DEFAULTS } from '../scripts/seedPermessi';

export class PermessiService implements IPermessiService {
  private repository: PermessiRepository;
  private seedChecked = false;

  constructor(repository: PermessiRepository) {
    this.repository = repository;
  }

  /**
   * Verifica se i permessi esistono nel catalogo, altrimenti esegue il seed automatico.
   * Viene eseguito una sola volta per istanza del service.
   */
  private async ensureSeeded(): Promise<void> {
    if (this.seedChecked) return;
    try {
      // Migra automaticamente i vincoli legacy se presenti
      const migrated = await this.repository.migrateLegacyConstraint();
      if (migrated) {
        log.info('Vincolo legacy permessi_ruolo migrato con successo (2 → 3 colonne).');
      }

      const migratedGdo = await this.repository.migrateLegacyGdoConstraint();
      if (migratedGdo) {
        log.info('Vincolo legacy permessi_ruolo_gdo migrato con successo (3 → 4 colonne con COALESCE).');
      }

      const count = await Permesso.count();
      if (count === 0) {
        log.info('Nessun permesso trovato nel catalogo. Eseguo seed automatico...');
        await this.seedPermessiIniziali();
      }
    } catch (error) {
      log.warn('Impossibile verificare/eseguire seed permessi:', error);
    }
    this.seedChecked = true;
  }

  async getAllPermessi(): Promise<PermessoDTO[]> {
    await this.ensureSeeded();
    const permessi = await this.repository.findAllPermessi();
    return permessi.map(p => ({
      id_permesso: p.getDataValue('id_permesso'),
      codice: p.getDataValue('codice'),
      nome: p.getDataValue('nome'),
      descrizione: p.getDataValue('descrizione'),
      categoria: p.getDataValue('categoria'),
      risorsa: p.getDataValue('risorsa'),
    }));
  }

  async getPermessiPerRuolo(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string): Promise<PermessoConStatoDTO[]> {
    await this.ensureSeeded();
    const tuttIPermessi = await this.repository.findAllPermessi();
    const permessiRuolo = await this.repository.findPermessiPerRuolo(tipoUtente, idRuoloGdo);

    const ruoloMap = new Map<string, boolean>();
    for (const pr of permessiRuolo) {
      ruoloMap.set(pr.id_permesso, pr.abilitato);
    }

    return tuttIPermessi.map(p => {
      const id = p.getDataValue('id_permesso');
      return {
        id_permesso: id,
        codice: p.getDataValue('codice'),
        nome: p.getDataValue('nome'),
        descrizione: p.getDataValue('descrizione'),
        categoria: p.getDataValue('categoria'),
        risorsa: p.getDataValue('risorsa'),
        abilitato: ruoloMap.get(id) ?? false,
      };
    });
  }

  /**
   * Risolve i permessi effettivi con logica a 4 livelli (priorita crescente):
   * 1. permessi_ruolo base (tipo_utente, id_ruolo_utente_gdo IS NULL)
   * 2. permessi_ruolo per sotto-ruolo GDO (tipo_utente, id_ruolo_utente_gdo = X) - solo se idRuoloGdo
   * 3. permessi_ruolo_gdo base (id_gdo, tipo_utente, id_ruolo_utente_gdo IS NULL) - solo se idGdo
   * 4. permessi_ruolo_gdo per sotto-ruolo (id_gdo, tipo_utente, id_ruolo_utente_gdo = X) - solo se idGdo + idRuoloGdo
   */
  async getPermessiEffettivi(tipoUtente: TIPO_UTENTI, idGdo?: string, idRuoloGdo?: string): Promise<string[]> {
    await this.ensureSeeded();
    // Superadmin bypass: tutti i permessi
    if (tipoUtente === TIPO_UTENTI.SUPERADMIN) {
      const tutti = await this.repository.findAllPermessi();
      return tutti.map(p => p.getDataValue('codice'));
    }

    // Livello 1: permessi base del tipo_utente (id_ruolo_utente_gdo IS NULL)
    const permessiBase = await this.repository.findPermessiPerRuolo(tipoUtente);

    const mappa = new Map<string, { codice: string; abilitato: boolean }>();
    for (const pr of permessiBase) {
      if (pr.codice) {
        mappa.set(pr.id_permesso, { codice: pr.codice, abilitato: pr.abilitato });
      }
    }

    // Livello 2: override sotto-ruolo GDO (sovrascrive livello 1)
    if (idRuoloGdo) {
      const permessiRuoloGdo = await this.repository.findPermessiPerRuolo(tipoUtente, idRuoloGdo);
      for (const pr of permessiRuoloGdo) {
        if (pr.codice) {
          mappa.set(pr.id_permesso, { codice: pr.codice, abilitato: pr.abilitato });
        }
      }
    }

    // Livello 3: override GDO base (sovrascrive livelli 1-2)
    if (idGdo) {
      const overridesBase = await this.repository.findPermessiOverrideGdo(idGdo, tipoUtente);
      for (const ovr of overridesBase) {
        if (ovr.codice) {
          mappa.set(ovr.id_permesso, { codice: ovr.codice, abilitato: ovr.abilitato });
        }
      }
    }

    // Livello 4: override GDO + sotto-ruolo (sovrascrive tutto)
    if (idGdo && idRuoloGdo) {
      const overridesRuolo = await this.repository.findPermessiOverrideGdo(idGdo, tipoUtente, idRuoloGdo);
      for (const ovr of overridesRuolo) {
        if (ovr.codice) {
          mappa.set(ovr.id_permesso, { codice: ovr.codice, abilitato: ovr.abilitato });
        }
      }
    }

    return Array.from(mappa.values())
      .filter(v => v.abilitato)
      .map(v => v.codice);
  }

  async getPermessiEffettiviConDettagli(tipoUtente: TIPO_UTENTI, idGdo?: string, idRuoloGdo?: string): Promise<PermessoConStatoDTO[]> {
    await this.ensureSeeded();
    const tuttIPermessi = await this.repository.findAllPermessi();

    // Livello 1: base tipo_utente
    const permessiBase = await this.repository.findPermessiPerRuolo(tipoUtente);
    const baseMap = new Map<string, boolean>();
    for (const pr of permessiBase) {
      baseMap.set(pr.id_permesso, pr.abilitato);
    }

    // Livello 2: sotto-ruolo GDO
    const ruoloGdoMap = new Map<string, boolean>();
    if (idRuoloGdo) {
      const permessiRuoloGdo = await this.repository.findPermessiPerRuolo(tipoUtente, idRuoloGdo);
      for (const pr of permessiRuoloGdo) {
        ruoloGdoMap.set(pr.id_permesso, pr.abilitato);
      }
    }

    // Livello 3: override GDO base
    const overrideBaseMap = new Map<string, boolean>();
    if (idGdo) {
      const overridesBase = await this.repository.findPermessiOverrideGdo(idGdo, tipoUtente);
      for (const ovr of overridesBase) {
        overrideBaseMap.set(ovr.id_permesso, ovr.abilitato);
      }
    }

    // Livello 4: override GDO + sotto-ruolo
    const overrideRuoloMap = new Map<string, boolean>();
    if (idGdo && idRuoloGdo) {
      const overridesRuolo = await this.repository.findPermessiOverrideGdo(idGdo, tipoUtente, idRuoloGdo);
      for (const ovr of overridesRuolo) {
        overrideRuoloMap.set(ovr.id_permesso, ovr.abilitato);
      }
    }

    return tuttIPermessi.map(p => {
      const id = p.getDataValue('id_permesso');

      // Risolvi dal livello piu specifico al meno specifico
      let abilitato = baseMap.get(id) ?? false;
      let is_override = false;

      if (ruoloGdoMap.has(id)) {
        abilitato = ruoloGdoMap.get(id)!;
        is_override = true;
      }
      if (overrideBaseMap.has(id)) {
        abilitato = overrideBaseMap.get(id)!;
        is_override = true;
      }
      if (overrideRuoloMap.has(id)) {
        abilitato = overrideRuoloMap.get(id)!;
        is_override = true;
      }

      return {
        id_permesso: id,
        codice: p.getDataValue('codice'),
        nome: p.getDataValue('nome'),
        descrizione: p.getDataValue('descrizione'),
        categoria: p.getDataValue('categoria'),
        risorsa: p.getDataValue('risorsa'),
        abilitato,
        is_override,
      };
    });
  }

  async getPermessiUtente(userId: string): Promise<string[]> {
    const { Utente } = await import('../models');
    const utente = await Utente.findByPk(userId);
    if (!utente) return [];

    const tipoUtente = utente.tipo_utenti;

    // Superadmin bypass
    if (tipoUtente === TIPO_UTENTI.SUPERADMIN) {
      const tutti = await this.repository.findAllPermessi();
      return tutti.map(p => p.getDataValue('codice'));
    }

    // Cerca id_gdo e id_ruolo_utente_gdo
    let idGdo: string | undefined;
    let idRuoloGdo: string | undefined;
    const utenteGdo = await UtentiGDO.findOne({ where: { id_utente_utentegdo: userId } });
    if (utenteGdo) {
      idGdo = utenteGdo.id_gdo_utentegdo;
      idRuoloGdo = utenteGdo.id_ruolo_utente_gdo ?? undefined;
    }

    return this.getPermessiEffettivi(tipoUtente, idGdo, idRuoloGdo);
  }

  async setPermessiRuolo(tipoUtente: TIPO_UTENTI, permessi: { id_permesso: string; abilitato: boolean }[], idRuoloGdo?: string): Promise<void> {
    await this.ensureSeeded();
    await this.repository.bulkUpsertPermessiRuolo(tipoUtente, permessi, idRuoloGdo);
    log.info(`Permessi ruolo aggiornati per ${tipoUtente}${idRuoloGdo ? ` (ruolo GDO: ${idRuoloGdo})` : ''}: ${permessi.length} permessi`);
  }

  async setPermessiRuoloGdo(idGdo: string, tipoUtente: TIPO_UTENTI, permessi: { id_permesso: string; abilitato: boolean }[], idRuoloGdo?: string): Promise<void> {
    await this.ensureSeeded();
    await this.repository.bulkUpsertPermessiRuoloGdo(idGdo, tipoUtente, permessi, idRuoloGdo);
    log.info(`Override GDO aggiornati per ${tipoUtente} in GDO ${idGdo}${idRuoloGdo ? ` (ruolo GDO: ${idRuoloGdo})` : ''}: ${permessi.length} permessi`);
  }

  async resetOverrideGdo(idGdo: string, tipoUtente?: TIPO_UTENTI, idRuoloGdo?: string): Promise<void> {
    await this.repository.deleteOverrideGdo(idGdo, tipoUtente, idRuoloGdo);
    log.info(`Override GDO rimossi per GDO ${idGdo}${tipoUtente ? ` ruolo ${tipoUtente}` : ''}${idRuoloGdo ? ` (ruolo GDO: ${idRuoloGdo})` : ''}`);
  }

  /**
   * Svuota tutte e 3 le tabelle dei permessi e riesegue il seed completo.
   * Utile quando il catalogo dei permessi cambia (nuove pagine/azioni).
   */
  async reseedPermessi(): Promise<void> {
    log.info('Reseed permessi: pulizia tabelle...');
    await PermessoRuoloGdo.destroy({ where: {} });
    await PermessoRuolo.destroy({ where: {} });
    await Permesso.destroy({ where: {} });
    this.seedChecked = false;
    await this.seedPermessiIniziali();
    log.info('Reseed permessi completato.');
  }

  async seedPermessiIniziali(): Promise<void> {
    log.info('Seed permessi iniziali...');

    // Migra vincolo legacy se presente (idempotente)
    await this.repository.migrateLegacyConstraint();

    // 1. Inserisci i permessi nel catalogo
    await this.repository.bulkCreatePermessi(PERMESSI_SEED);
    log.info(`Seed: ${PERMESSI_SEED.length} permessi inseriti nel catalogo`);

    // 2. Per ogni tipo_utente, inserisci i permessi di default (id_ruolo_utente_gdo = NULL)
    const tuttIPermessi = await this.repository.findAllPermessi();
    const codiceToId = new Map<string, string>();
    for (const p of tuttIPermessi) {
      codiceToId.set(p.getDataValue('codice'), p.getDataValue('id_permesso'));
    }

    for (const [tipoUtente, codiciAbilitati] of Object.entries(PERMESSI_RUOLO_DEFAULTS)) {
      const permessi = Array.from(codiceToId.entries()).map(([codice, id_permesso]) => ({
        id_permesso,
        abilitato: codiciAbilitati.includes(codice),
      }));

      await this.repository.bulkUpsertPermessiRuolo(tipoUtente as TIPO_UTENTI, permessi);
      log.info(`Seed: permessi default per ${tipoUtente} configurati (${codiciAbilitati.length} abilitati)`);
    }

    // 3. Per ogni sotto-ruolo GDO, crea permessi basati sui default GDO
    try {
      const ruoliGdo = await RuoloUtenteGDO.findAll();
      const gdoDefaults = PERMESSI_RUOLO_DEFAULTS[TIPO_UTENTI.GDO] || [];

      for (const ruolo of ruoliGdo) {
        const idRuolo = ruolo.id_ruolo_utente_gdo;
        const permessi = Array.from(codiceToId.entries()).map(([codice, id_permesso]) => ({
          id_permesso,
          abilitato: gdoDefaults.includes(codice),
        }));

        await this.repository.bulkUpsertPermessiRuolo(TIPO_UTENTI.GDO, permessi, idRuolo);
        log.info(`Seed: permessi default per sotto-ruolo GDO "${ruolo.ruolo_ruolo_utente_gdo}" configurati`);
      }
    } catch (error) {
      log.warn('Impossibile eseguire seed per sotto-ruoli GDO:', error);
    }

    log.info('Seed permessi completato.');
  }
}
