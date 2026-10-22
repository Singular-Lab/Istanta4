import { FindOptions } from 'sequelize';
import { Funzionalita } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { Config as ConfigModel } from '../models/config';
import { GDO } from '../models/gdo';

/**
 * La tabella config ha una riga per GDO (colonna id_gdo_config). Le letture qui sotto scelgono
 * sempre la stessa riga: un findOne() senza filtro, con piu' righe, restituirebbe una riga
 * qualsiasi e il WebPliant pubblico potrebbe leggere la configurazione di un'altra GDO.
 */

// A parita' di GDO vale la riga piu' vecchia
const ORDINE: FindOptions['order'] = [['createdAt', 'ASC'], ['id', 'ASC']];

let gdoClienteInCache: string | null = null;

/** id della GDO di CLIENT_ID, null se CLIENT_ID e' vuoto, 'default' o la GDO non esiste ancora. */
export const idGdoCliente = async (clientId: string = config.CLIENT_ID): Promise<string | null> => {
  const nome = (clientId ?? '').trim().toLowerCase();
  if (!nome || nome === 'default') return null;
  if (gdoClienteInCache && clientId === config.CLIENT_ID) return gdoClienteInCache;

  const gdo = await GDO.findOne({
    where: sequelize.where(sequelize.fn('lower', sequelize.col('nome_gdo')), nome),
    raw: true,
  }) as { id_gdo?: string } | null;
  const id = gdo?.id_gdo ?? null;
  // Solo un esito trovato va in cache: la GDO puo' nascere dopo (inizializzazione)
  if (id && clientId === config.CLIENT_ID) gdoClienteInCache = id;
  return id;
};

/** Per i test: dimentica la GDO del cliente messa in cache. */
export const dimenticaGdoCliente = (): void => {
  gdoClienteInCache = null;
};

/** Configurazione di una GDO: la sua riga piu' vecchia, null se non ne ha. */
export const trovaConfigDiGdo = async (idGdo: string, opzioni: FindOptions = {}): Promise<any> =>
  ConfigModel.findOne({ ...opzioni, where: { id_gdo_config: idGdo }, order: ORDINE });

/**
 * Configurazione dell'installazione: quella della GDO del cliente, altrimenti la riga senza GDO,
 * altrimenti la piu' vecchia. Con una sola riga e' sempre quella, come prima del collegamento.
 */
export const trovaConfigInstallazione = async (opzioni: FindOptions = {}): Promise<any> => {
  const idGdo = await idGdoCliente();
  if (idGdo) {
    const delCliente = await trovaConfigDiGdo(idGdo, opzioni);
    if (delCliente) return delCliente;
  }
  const senzaGdo = await ConfigModel.findOne({ ...opzioni, where: { id_gdo_config: null }, order: ORDINE });
  if (senzaGdo) return senzaGdo;
  return ConfigModel.findOne({ ...opzioni, order: ORDINE });
};

/** Configurazione di una GDO, con ripiego su quella dell'installazione se la GDO non ne ha una. */
export const trovaConfigPerGdo = async (idGdo: string | null | undefined, opzioni: FindOptions = {}): Promise<any> => {
  if (idGdo) {
    const propria = await trovaConfigDiGdo(idGdo, opzioni);
    if (propria) return propria;
  }
  return trovaConfigInstallazione(opzioni);
};

/** Funzionalita' di una riga config: una funzione mai attivata e' spenta. */
export const funzionalitaDa = (riga: { funzionalita?: Partial<Funzionalita> | null } | null | undefined): Funzionalita => ({
  momenti: riga?.funzionalita?.momenti === true,
  menabo: riga?.funzionalita?.menabo === true,
});
