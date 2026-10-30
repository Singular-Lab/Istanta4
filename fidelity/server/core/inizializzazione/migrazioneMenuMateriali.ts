import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { convertiMenuMateriali, type VoceMenuConvertibile, type VoceNuovaMenu } from '../../../lib/accessi/menuMateriali';
import { incrementaVersionePermessi } from '../accessi/versionePermessi';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';

/** Una riga di menu_items, con i campi che la migrazione legge, scrive o copia nelle voci aggiunte. */
export type RigaMenu = VoceMenuConvertibile & {
  tipo_utente: string;
  ruolo_gdo: string | null;
  id_ruolo_utente_gdo: string | null;
  id_parent: string | null;
  icona: string | null;
  pathname: string | null;
  codice_permesso: string | null;
  disabilitato: boolean;
  start_page: boolean;
};

/** I menu salvati, dentro la transazione della migrazione. */
export type MenuInTransazione = {
  leggiVoci(): Promise<RigaMenu[]>;
  aggiornaVoce(voce: RigaMenu): Promise<void>;
  inserisciVoce(voce: RigaMenu): Promise<void>;
  /** Fa ricaricare il menu a ogni worker, come ogni altro salvataggio di un menu. */
  incrementaVersione(): Promise<void>;
};

export type FonteMenuMateriali = {
  inTransazione<T>(lavoro: (menu: MenuInTransazione) => Promise<T>): Promise<T>;
};

export type EsitoMigrazioneMenuMateriali = {
  /** Menu cambiati. */
  menu: number;
  aggiornate: number;
  inserite: number;
};

const menuDb = (transaction: Transaction): MenuInTransazione => ({
  leggiVoci: () => sequelize.query<RigaMenu>(
    `SELECT id_menu_item, tipo_utente, ruolo_gdo, id_ruolo_utente_gdo, id_parent, tipo, titolo, icona,
            pathname, codice_permesso, disabilitato, start_page, ordinamento
       FROM menu_items`,
    { type: QueryTypes.SELECT, transaction }
  ),
  aggiornaVoce: async (voce) => {
    await sequelize.query(
      `UPDATE menu_items
          SET titolo = :titolo, pathname = :pathname, codice_permesso = :codice_permesso,
              ordinamento = :ordinamento, updatedat = now()
        WHERE id_menu_item = :id_menu_item`,
      {
        replacements: {
          id_menu_item: voce.id_menu_item,
          titolo: voce.titolo,
          pathname: voce.pathname,
          codice_permesso: voce.codice_permesso,
          ordinamento: voce.ordinamento,
        },
        transaction,
      }
    );
  },
  inserisciVoce: async (voce) => {
    await sequelize.query(
      `INSERT INTO menu_items (id_menu_item, tipo_utente, ruolo_gdo, id_ruolo_utente_gdo, id_parent, tipo, titolo,
                               icona, pathname, codice_permesso, disabilitato, start_page, ordinamento,
                               createdat, updatedat)
       VALUES (:id_menu_item, :tipo_utente, :ruolo_gdo, :id_ruolo_utente_gdo, :id_parent, :tipo, :titolo,
               :icona, :pathname, :codice_permesso, :disabilitato, :start_page, :ordinamento,
               now(), now())`,
      {
        replacements: {
          id_menu_item: voce.id_menu_item,
          tipo_utente: voce.tipo_utente,
          ruolo_gdo: voce.ruolo_gdo,
          id_ruolo_utente_gdo: voce.id_ruolo_utente_gdo,
          id_parent: voce.id_parent,
          tipo: voce.tipo,
          titolo: voce.titolo,
          icona: voce.icona,
          pathname: voce.pathname,
          codice_permesso: voce.codice_permesso,
          disabilitato: voce.disabilitato,
          start_page: voce.start_page,
          ordinamento: voce.ordinamento,
        },
        transaction,
      }
    );
  },
  incrementaVersione: async () => {
    await incrementaVersionePermessi(transaction);
  },
});

const fonteDb: FonteMenuMateriali = {
  inTransazione: (lavoro) => sequelize.transaction(async (transaction) => {
    // Due avvii contemporanei non aggiungono due volte le voci POP: il secondo legge i menu già convertiti.
    await sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('migrazione_menu_materiali'))`, { transaction });
    return lavoro(menuDb(transaction));
  }),
};

/**
 * Un menu è l'insieme delle voci di un tipo di utente e di un sotto-ruolo; le righe storiche con la
 * sola chiave testuale ruolo_gdo, non ancora collegate a un sotto-ruolo, formano un menu a parte.
 */
const chiaveMenu = (voce: RigaMenu): string =>
  `${voce.tipo_utente}|${voce.id_ruolo_utente_gdo ?? ''}|${voce.id_ruolo_utente_gdo ? '' : (voce.ruolo_gdo ?? '')}`;

const nomeMenu = (voce: RigaMenu): string =>
  voce.id_ruolo_utente_gdo
    ? `${voce.tipo_utente} · sotto-ruolo ${voce.id_ruolo_utente_gdo}`
    : voce.ruolo_gdo ? `${voce.tipo_utente} · ${voce.ruolo_gdo}` : voce.tipo_utente;

/**
 * Converte nei menu salvati, Superadmin compreso, le voci delle pagine Materiali nelle viste
 * Volantini, aggiunge le voci POP e divide la sezione in 'MATERIALI VOLANTINO' e 'MATERIALI POP',
 * anche nei menu già convertiti con l'intestazione unica 'VOLANTINI E POP' (regole in
 * lib/accessi/menuMateriali.ts). Tutto in una transazione: se una scrittura fallisce nessun menu
 * cambia. Si può rieseguire: un menu già convertito non cambia, e la versione dei permessi sale
 * solo se qualcosa è cambiato.
 */
export const migraMenuMateriali = async (
  fonte: FonteMenuMateriali = fonteDb,
  nuovoId: (voce: VoceNuovaMenu) => string = () => randomUUID()
): Promise<EsitoMigrazioneMenuMateriali> => {
  const { esito, righe } = await fonte.inTransazione(async (menu) => {
    const perMenu = new Map<string, RigaMenu[]>();
    for (const voce of await menu.leggiVoci()) {
      const chiave = chiaveMenu(voce);
      const voci = perMenu.get(chiave);
      if (voci) voci.push(voce);
      else perMenu.set(chiave, [voce]);
    }

    const esito: EsitoMigrazioneMenuMateriali = { menu: 0, aggiornate: 0, inserite: 0 };
    const righe: string[] = [];
    for (const voci of perMenu.values()) {
      const { aggiornate, inserite } = convertiMenuMateriali(voci, nuovoId);
      if (aggiornate.length === 0 && inserite.length === 0) continue;
      for (const voce of aggiornate) await menu.aggiornaVoce(voce);
      for (const voce of inserite) await menu.inserisciVoce(voce);
      esito.menu++;
      esito.aggiornate += aggiornate.length;
      esito.inserite += inserite.length;
      righe.push(`  ${nomeMenu(voci[0])}: ${aggiornate.length} voci aggiornate, ${inserite.length} voci aggiunte (POP e intestazioni)`);
    }
    if (esito.menu > 0) await menu.incrementaVersione();
    return { esito, righe };
  });

  if (esito.menu > 0) {
    log.info(`Menu: voci Materiali convertite in Volantini e POP in ${esito.menu} menu\n${righe.join('\n')}`);
  }
  return esito;
};
