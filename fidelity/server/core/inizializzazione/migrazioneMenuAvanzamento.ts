import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { aggiungiVoceAvanzamento } from '../../../lib/accessi/menuAvanzamento';
import { SCRIPT_DATI, TABELLA_SCRIPT_DATI } from '../db/migrazioni/scriptDati';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { chiaveMenu, menuDb, type MenuInTransazione, nomeMenu, type RigaMenu } from './migrazioneMenuMateriali';

/** L'esecuzione della migrazione nel registro degli script di dati: c'è già, o si scrive ora. */
export type RegistroMigrazione = {
  eseguita(): Promise<boolean>;
  registra(esito: EsitoMigrazioneMenuAvanzamento): Promise<void>;
};

export type FonteMenuAvanzamento = {
  inTransazione<T>(lavoro: (menu: MenuInTransazione, registro: RegistroMigrazione) => Promise<T>): Promise<T>;
};

export type EsitoMigrazioneMenuAvanzamento = {
  /** gia-eseguita e senza-menu non cambiano nulla e non si registrano. */
  stato: 'gia-eseguita' | 'senza-menu' | 'eseguita';
  /** Menu cambiati. */
  menu: number;
  aggiornate: number;
  inserite: number;
};

const { nome: NOME_NEL_REGISTRO, ripetibile: RIPETIBILE } = SCRIPT_DATI.menuAvanzamento;

const registroDb = (transaction: Transaction): RegistroMigrazione => ({
  eseguita: async () => {
    const righe = await sequelize.query<{ nome: string }>(
      `SELECT nome FROM public.${TABELLA_SCRIPT_DATI} WHERE nome = :nome`,
      { type: QueryTypes.SELECT, replacements: { nome: NOME_NEL_REGISTRO }, transaction }
    );
    return righe.length > 0;
  },
  registra: async (esito) => {
    await sequelize.query(
      `INSERT INTO public.${TABELLA_SCRIPT_DATI} (nome, ripetibile, ultima_esecuzione, esecuzioni, esito)
       VALUES (:nome, :ripetibile, now(), 1, CAST(:esito AS JSONB))`,
      { replacements: { nome: NOME_NEL_REGISTRO, ripetibile: RIPETIBILE, esito: JSON.stringify(esito) }, transaction }
    );
  },
});

const fonteDb: FonteMenuAvanzamento = {
  inTransazione: (lavoro) => sequelize.transaction(async (transaction) => {
    // Due avvii contemporanei non aggiungono due volte la voce: il secondo trova la migrazione registrata.
    await sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('migrazione_menu_avanzamento'))`, { transaction });
    return lavoro(menuDb(transaction), registroDb(transaction));
  }),
};

/**
 * Aggiunge la voce 'Avanzamento produzione' subito prima di 'Promozioni in corso' in ogni menu
 * salvato che ha quella voce (regole in lib/accessi/menuAvanzamento.ts), Superadmin compreso.
 *
 * Una volta sola: l'esecuzione si scrive nel registro degli script di dati, nella stessa
 * transazione delle voci, così un amministratore che poi toglie la voce non se la ritrova al
 * riavvio. Un database ancora senza menu (installazione nuova, prima del seed) non la registra:
 * la migrazione si farà all'avvio dopo il seed.
 */
export const migraMenuAvanzamento = async (
  fonte: FonteMenuAvanzamento = fonteDb,
  nuovoId: () => string = () => randomUUID()
): Promise<EsitoMigrazioneMenuAvanzamento> => {
  const { esito, righe } = await fonte.inTransazione(async (menu, registro) => {
    const esito: EsitoMigrazioneMenuAvanzamento = { stato: 'gia-eseguita', menu: 0, aggiornate: 0, inserite: 0 };
    const righe: string[] = [];
    if (await registro.eseguita()) return { esito, righe };

    const voci = await menu.leggiVoci();
    if (voci.length === 0) return { esito: { ...esito, stato: 'senza-menu' as const }, righe };

    const perMenu = new Map<string, RigaMenu[]>();
    for (const voce of voci) {
      const chiave = chiaveMenu(voce);
      perMenu.set(chiave, [...(perMenu.get(chiave) ?? []), voce]);
    }

    esito.stato = 'eseguita';
    for (const vociDelMenu of perMenu.values()) {
      const { aggiornate, inserite } = aggiungiVoceAvanzamento(vociDelMenu, nuovoId);
      if (inserite.length === 0) continue;
      for (const voce of aggiornate) await menu.aggiornaVoce(voce);
      for (const voce of inserite) await menu.inserisciVoce(voce);
      esito.menu++;
      esito.aggiornate += aggiornate.length;
      esito.inserite += inserite.length;
      righe.push(`  ${nomeMenu(vociDelMenu[0])}: voce aggiunta, ${aggiornate.length} voci scese di un posto`);
    }
    if (esito.menu > 0) await menu.incrementaVersione();
    await registro.registra(esito);
    return { esito, righe };
  });

  if (esito.stato === 'eseguita') {
    log.info(`Menu: voce Avanzamento produzione aggiunta prima di Promozioni in corso in ${esito.menu} menu${righe.length ? `\n${righe.join('\n')}` : ''}`);
  }
  return esito;
};
