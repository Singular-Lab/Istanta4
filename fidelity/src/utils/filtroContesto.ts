// Filtro di contesto come lo salva il server: nome_field è "schema.colonna" (es. "promo.codice_area")
export const normalizzaFiltroContesto = <C extends { schemaScelto: string; colonna: string }, F extends { condizioni: C[] }>(
  filtri: F[] = []
): F[] =>
  filtri.map((filtro) => ({
    ...filtro,
    condizioni: (filtro.condizioni ?? []).map((cond) => ({ ...cond, nome_field: `${cond.schemaScelto}.${cond.colonna}` })),
  }));
