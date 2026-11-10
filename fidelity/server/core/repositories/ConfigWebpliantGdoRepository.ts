import { randomUUID } from 'node:crypto';
import { type ConfigAttributes, Config as ConfigModel } from '../models/config';
import { idGdoCliente, trovaConfigWebpliantDiGdo, trovaOCreaConfigWebpliantDiGdo } from '../services/configPerGdo';

/**
 * La riga config che WebPliant legge per una GDO (services/configPerGdo.ts), per le Impostazioni GDO:
 * si legge e si scrive la stessa riga, e ogni salvataggio cambia solo le sue chiavi (il colore, o
 * alcune chiavi di webpliant), mai la riga intera come faceva saveWebpliantConfig.
 */

export interface RigaConfigWebpliant {
  id: string;
  colore: string | null;
  webpliant: Record<string, unknown>;
}

export interface IConfigWebpliantGdoRepository {
  /** La riga letta per la GDO (con ripiego su quella dell'installazione); null se non ce n'e' nessuna. */
  leggi(idGdo: string): Promise<RigaConfigWebpliant | null>;
  /** Unisce le chiavi indicate a webpliant della riga della GDO, senza toccare le altre. */
  aggiornaWebpliant(idGdo: string, chiavi: Record<string, unknown>): Promise<void>;
  /** Il colore della GDO (colonna color) della sua riga. */
  aggiornaColore(idGdo: string, colore: string | null): Promise<void>;
}

const oggetto = (valore: unknown): Record<string, unknown> =>
  valore !== null && typeof valore === 'object' && !Array.isArray(valore) ? valore as Record<string, unknown> : {};

export class ConfigWebpliantGdoRepository implements IConfigWebpliantGdoRepository {
  async leggi(idGdo: string): Promise<RigaConfigWebpliant | null> {
    const riga = (await trovaConfigWebpliantDiGdo(idGdo, { raw: true })) as { id: string; color?: string | null; webpliant?: unknown } | null;
    if (!riga) return null;
    return { id: riga.id, colore: riga.color ?? null, webpliant: oggetto(riga.webpliant) };
  }

  /** La riga da scrivere; senza nessuna riga, ne nasce una per la GDO dell'installazione (come saveConfig). */
  private async rigaDaScrivere(idGdo: string): Promise<{ id: string; webpliant: Record<string, unknown> }> {
    const esistente = (await trovaOCreaConfigWebpliantDiGdo(idGdo)) as InstanceType<typeof ConfigModel> | null;
    const riga = esistente ?? await ConfigModel.create({ id: randomUUID(), id_gdo_config: (await idGdoCliente()) ?? idGdo, webpliant: {} });
    const valori = riga.get({ plain: true }) as { id: string; webpliant?: unknown };
    return { id: valori.id, webpliant: oggetto(valori.webpliant) };
  }

  async aggiornaWebpliant(idGdo: string, chiavi: Record<string, unknown>): Promise<void> {
    const riga = await this.rigaDaScrivere(idGdo);
    await ConfigModel.update({ webpliant: { ...riga.webpliant, ...chiavi } as ConfigAttributes['webpliant'] }, { where: { id: riga.id } });
  }

  async aggiornaColore(idGdo: string, colore: string | null): Promise<void> {
    const riga = await this.rigaDaScrivere(idGdo);
    // color e' nullable nella tabella: null toglie il colore della GDO
    await ConfigModel.update({ color: colore as string }, { where: { id: riga.id } });
  }
}
