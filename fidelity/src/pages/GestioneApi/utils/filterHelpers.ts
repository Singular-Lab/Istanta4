import type { FilterCondition } from "../types";

/**
 * Formatta i filtri per l'API
 */
export function formatFiltersForApi(filterGroups: FilterCondition[][]): FilterCondition[][] {
  // Rimuovi i gruppi vuoti e le condizioni incomplete
  return filterGroups
    .map(group =>
      group.filter(condition =>
        condition.field &&
        condition.operator &&
        condition.value
      )
    )
    .filter(group => group.length > 0);
}

/**
 * Crea una nuova condizione di filtro vuota
 */
export function createEmptyFilterCondition(): FilterCondition {
  return {
    field: '',
    operator: 'equals',
    value: ''
  };
}

/**
 * Crea un nuovo gruppo di filtri vuoto
 */
export function createEmptyFilterGroup(): FilterCondition[] {
  return [createEmptyFilterCondition()];
}
