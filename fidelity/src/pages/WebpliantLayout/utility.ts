import { PaginaWebPliant } from '../../../lib/types';
import { applyFiltriPolicyVisualizzazione } from '../WebPliant/utils';


/**
 * Tipizzazione minima della sitemap
 */
type SitemapItem = {
  id: string;
  titolo: string;
  pagine_collegate: {
    id: string;
    titolo: string;
  }[];
  link_esterno?: string;
};

/**
 * Tipizzazione minima di una pagina
 */

/**
 * Parametri contestuali (id del PV corrente, canale, area, ecc.)
 */
type FilterContext = {
  idPV?: string;
  idCanale?: string;
  idArea?: string;
};

/**
 * Funzione principale:
 * - itera la sitemap
 * - filtra le pagine collegate in base alla policy di ogni pagina
 */
export function filtroSitemMap(
  sitemap: SitemapItem[] = [],
  pagine: PaginaWebPliant[] = [],
  contesto: FilterContext = {},
  date: string,
): SitemapItem[] {
  const { idPV, idCanale, idArea } = contesto;

  const sitemapFiltrata = sitemap
    .filter((sezione) => {
      // Filtra la sezione in base alla policy
      if (sezione.pagine_collegate == undefined) return true;
      if (sezione.pagine_collegate.length > 1) return true;
      const pagina = pagine.find((pp) => pp.id === sezione.pagine_collegate[0]?.id);
      if (!pagina) return true;
      const res = applyFiltriPolicyVisualizzazione(
        pagina?.settings ?? {},
        idArea ?? null,
        idCanale ?? null,
        idPV ?? null,
        [],
        date,
      );
      return res;
    })
    .map((sezione) => {
      if (sezione.pagine_collegate == undefined) return sezione;
      const pagine_collegate_filtrate = sezione.pagine_collegate.filter((pLink) => {
        // Trova la pagina corrispondente
        const pagina = pagine.find((pp) => pp.id === pLink.id);
        if (!pagina) return false;
        // Verifica se la pagina è ammessa dalla sua policy
        const res = applyFiltriPolicyVisualizzazione(
          pagina.settings ?? {},
          idArea ?? null,
          idCanale ?? null,
          idPV ?? null,
          [],
          date,
        );
        return res;
      });

      return {
        ...sezione,
        pagine_collegate: pagine_collegate_filtrate,
      };
    });

  return sitemapFiltrata;
}
