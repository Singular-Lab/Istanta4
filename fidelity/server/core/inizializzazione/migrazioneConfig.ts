import { Funzionalita } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { Config as ConfigModel } from '../models/config';
import { idGdoCliente } from '../services/configPerGdo';

/**
 * Passaggio automatico della configurazione al modello per GDO, a ogni avvio del server e prima
 * dei worker, senza script da lanciare a mano:
 * - le righe config senza GDO vengono collegate alla GDO del cliente (CLIENT_ID);
 * - le righe senza funzionalita' le ricevono da VITE_MOMENTI_ATTIVI / VITE_MENABO_ATTIVO, le
 *   variabili con cui finora si accendevano momenti e menabo'. Succede una volta sola: da li' in
 *   poi vale quello che si imposta dalle Impostazioni di produzione.
 *
 * Rilanciarla non cambia nulla. Senza GDO del cliente (CLIENT_ID vuoto o 'default', oppure GDO non
 * ancora creata) il collegamento si rimanda all'avvio successivo.
 */

export interface EsitoMigrazioneConfig {
  idGdo: string | null;
  collegate: number;
  conFunzionalita: number;
  funzionalita: Funzionalita;
}

export interface OpzioniMigrazioneConfig {
  clientId?: string;
  ambiente?: NodeJS.ProcessEnv;
}

/** Funzionalita' indicate dalle vecchie variabili di build: solo 'true' accende. */
export const funzionalitaDaAmbiente = (ambiente: NodeJS.ProcessEnv): Funzionalita => ({
  momenti: ambiente.VITE_MOMENTI_ATTIVI === 'true',
  menabo: ambiente.VITE_MENABO_ATTIVO === 'true',
});

export const migraConfig = async (opzioni: OpzioniMigrazioneConfig = {}): Promise<EsitoMigrazioneConfig> => {
  const clientId = opzioni.clientId ?? config.CLIENT_ID;
  const funzionalita = funzionalitaDaAmbiente(opzioni.ambiente ?? process.env);

  // Le colonne id_gdo_config e funzionalita le porta la migrazione 0001: qui niente DDL

  return sequelize.transaction(async (transaction) => {
    // Un solo processo alla volta, anche con piu' container sullo stesso database
    await sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('migrazione_config'))`, { transaction });

    const idGdo = await idGdoCliente(clientId);
    let collegate = 0;
    // validate:false: il validatore di modello di Config controlla webpliant, che in un update di
    // sole due colonne non c'e', e faceva fallire sempre questa migrazione
    if (idGdo) {
      [collegate] = await ConfigModel.update({ id_gdo_config: idGdo } as any, { where: { id_gdo_config: null } as any, transaction, validate: false });
    }

    const [conFunzionalita] = await ConfigModel.update({ funzionalita } as any, { where: { funzionalita: null } as any, transaction, validate: false });

    return { idGdo, collegate, conFunzionalita, funzionalita };
  });
};

/** Avvio del server: un errore finisce nel log e non ferma Fidelity, le funzioni restano spente. */
export const preparaConfigAllAvvio = async (): Promise<void> => {
  try {
    const esito = await migraConfig();
    if (!esito.idGdo)
      log.warn('Config: GDO del cliente assente, collegamento della configurazione rimandato');
    else if (esito.collegate > 0)
      log.info(`Config: ${esito.collegate} configurazioni collegate alla GDO del cliente ${esito.idGdo}`);
    if (esito.conFunzionalita > 0)
      log.info(`Config: funzionalità inizializzate su ${esito.conFunzionalita} configurazioni`, { momenti: esito.funzionalita.momenti, menabo: esito.funzionalita.menabo });
  } catch (error) {
    log.error('Config: migrazione al modello per GDO non riuscita', error);
  }
};
