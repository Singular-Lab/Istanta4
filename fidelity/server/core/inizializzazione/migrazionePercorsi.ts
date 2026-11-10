import { QueryTypes } from 'sequelize';
import { percorsoSpostato, titoloSpostato } from '../../../lib/accessi/gestioneInterna';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';

type VoceMenu = { id_menu_item: string; pathname: string; titolo?: string | null };

export type FonteMenu = {
  leggiVoci(): Promise<VoceMenu[]>;
  aggiornaPercorso(idMenuItem: string, pathname: string): Promise<void>;
  /** Facoltativo: senza, i titoli restano come sono. */
  aggiornaTitolo?(idMenuItem: string, titolo: string): Promise<void>;
};

const fonteDb: FonteMenu = {
  leggiVoci: () => sequelize.query<VoceMenu>(
    `SELECT id_menu_item, pathname, titolo FROM menu_items WHERE pathname IS NOT NULL`,
    { type: QueryTypes.SELECT }
  ),
  aggiornaPercorso: async (idMenuItem, pathname) => {
    await sequelize.query(
      `UPDATE menu_items SET pathname = :pathname WHERE id_menu_item = :idMenuItem`,
      { replacements: { pathname, idMenuItem } }
    );
  },
  aggiornaTitolo: async (idMenuItem, titolo) => {
    await sequelize.query(
      `UPDATE menu_items SET titolo = :titolo WHERE id_menu_item = :idMenuItem`,
      { replacements: { titolo, idMenuItem } }
    );
  },
};

/**
 * Riscrive nei menu salvati i percorsi delle pagine spostate (sotto /gestione-interna, e le pagine
 * WebPliant: Workspace WebPliant e Impostazioni GDO), altrimenti le voci punterebbero a pagine
 * assenti dal catalogo. Si può rieseguire: i percorsi già nuovi non cambiano.
 */
export const migraPercorsiSpostati = async (fonte: FonteMenu = fonteDb): Promise<number> => {
  let aggiornate = 0;
  for (const voce of await fonte.leggiVoci()) {
    const nuovo = percorsoSpostato(voce.pathname);
    if (!nuovo) continue;
    await fonte.aggiornaPercorso(voce.id_menu_item, nuovo);
    // La voce col titolo predefinito di prima prende quello della pagina nuova
    const titolo = titoloSpostato(voce.pathname, voce.titolo);
    if (titolo) await fonte.aggiornaTitolo?.(voce.id_menu_item, titolo);
    aggiornate++;
  }
  if (aggiornate) log.info(`Menu: ${aggiornate} voci portate al nuovo percorso della pagina`);
  return aggiornate;
};
