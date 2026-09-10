import type { FilterCondition } from "../types";

/**
 * Valida una condizione di filtro
 */
export function validateFilterCondition(condition: FilterCondition): boolean {
  if (!condition.field || !condition.operator) {
    return false;
  }

  // Gli operatori 'in' e 'not_in' richiedono valori multipli separati da virgola
  if ((condition.operator === 'in' || condition.operator === 'not_in') && !condition.value) {
    return false;
  }

  // Altri operatori richiedono un valore non vuoto
  if (!['in', 'not_in'].includes(condition.operator) && !condition.value) {
    return false;
  }

  return true;
}

/**
 * Valida un gruppo di filtri (condizioni in AND)
 */
export function validateFilterGroup(filterGroup: FilterCondition[]): boolean {
  if (!Array.isArray(filterGroup) || filterGroup.length === 0) {
    return false;
  }

  return filterGroup.every(condition => validateFilterCondition(condition));
}

/**
 * Valida tutti i gruppi di filtri (gruppi in OR)
 */
export function validateAllFilterGroups(filterGroups: FilterCondition[][]): boolean {
  if (!Array.isArray(filterGroups) || filterGroups.length === 0) {
    return true; // Nessun filtro è valido
  }

  return filterGroups.every(group => {
    // I gruppi vuoti sono ammessi
    if (!group || group.length === 0) {
      return true;
    }
    return validateFilterGroup(group);
  });
}

/**
 * Rimuove i gruppi di filtri vuoti
 */
export function removeEmptyFilterGroups(filterGroups: FilterCondition[][]): FilterCondition[][] {
  return filterGroups.filter(group =>
    Array.isArray(group) &&
    group.length > 0 &&
    group.some(condition => condition.field && condition.operator)
  );
}

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
 * Controlla se i filtri sono vuoti
 */
export function areFiltersEmpty(filterGroups: FilterCondition[][]): boolean {
  if (!Array.isArray(filterGroups) || filterGroups.length === 0) {
    return true;
  }

  return !filterGroups.some(group =>
    Array.isArray(group) &&
    group.length > 0 &&
    group.some(condition => condition.field && condition.operator && condition.value)
  );
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

/**
 * Clona i gruppi di filtri in modo sicuro
 */
export function cloneFilterGroups(filterGroups: FilterCondition[][]): FilterCondition[][] {
  return filterGroups.map(group =>
    group.map(condition => ({ ...condition }))
  );
}
