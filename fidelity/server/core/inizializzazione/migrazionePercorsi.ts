import { QueryTypes } from 'sequelize';
import { percorsoSpostato } from '../../../lib/accessi/gestioneInterna';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';

type VoceMenu = { id_menu_item: string; pathname: string };

export type FonteMenu = {
  leggiVoci(): Promise<VoceMenu[]>;
  aggiornaPercorso(idMenuItem: string, pathname: string): Promise<void>;
};

const fonteDb: FonteMenu = {
  leggiVoci: () => sequelize.query<VoceMenu>(
    `SELECT id_menu_item, pathname FROM menu_items WHERE pathname IS NOT NULL`,
    { type: QueryTypes.SELECT }
  ),
  aggiornaPercorso: async (idMenuItem, pathname) => {
    await sequelize.query(
      `UPDATE menu_items SET pathname = :pathname WHERE id_menu_item = :idMenuItem`,
      { replacements: { pathname, idMenuItem } }
    );
  },
};

/**
 * Riscrive nei menu salvati i percorsi delle pagine spostate sotto /gestione-interna,
 * altrimenti le voci punterebbero a pagine assenti dal catalogo. Si può rieseguire:
 * i percorsi già nuovi non cambiano.
 */
export const migraPercorsiSpostati = async (fonte: FonteMenu = fonteDb): Promise<number> => {
  let aggiornate = 0;
  for (const voce of await fonte.leggiVoci()) {
    const nuovo = percorsoSpostato(voce.pathname);
    if (!nuovo) continue;
    await fonte.aggiornaPercorso(voce.id_menu_item, nuovo);
    aggiornate++;
  }
  if (aggiornate) log.info(`Menu: ${aggiornate} voci spostate sotto /gestione-interna`);
  return aggiornate;
};
