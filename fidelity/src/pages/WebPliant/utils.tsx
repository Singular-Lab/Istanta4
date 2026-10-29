// utils/filters.ts

import dayjs from 'dayjs';
import { Events, GRAVITA_PROBLEMA } from '@/stores/errorSlice';
import { FilterCondition, FilterConstruzioneCarosello, PageLayoutItem, ReferenzeIstanta } from '../../../lib/types';
import { FieldType } from '../../../lib/enums';
type Operator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';

interface OperatorValue {
  operator: Operator;
  value: any;
  date?: string; // For date-specific operations
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Optimized boolean conversion utility
 */
const convertBooleanString = (value: any): any => {
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true') return true;
    if (lowerValue === 'false') return false;
  }
  return value;
};

/**
 * Normalize field value for comparison
 */
const normalizeFieldValue = (value: any): any => {
  return typeof value === 'string' ? value.toLowerCase() : value;
};

/**
 * Check if a field exists in referenza data fields
 */
const hasDataField = (referenza: ReferenzeIstanta, field: string): boolean => {
  const normalizedField = field.toLowerCase().trim();
  return normalizedField in referenza.dataFields && referenza.dataFields[normalizedField] !== undefined;
};

/**
 * Get data field value with normalization
 */
const getDataFieldValue = (referenza: ReferenzeIstanta, field: string): any => {
  const normalizedField = field.toLowerCase().trim();
  return referenza.dataFields[normalizedField];
};

// =============================================
// FILTER CONDITION EVALUATORS
// =============================================

/**
 * Evaluate a single filter condition against a referenza
 */
const evaluateFilterCondition = (
  referenza: ReferenzeIstanta,
  filter: FilterConstruzioneCarosello,
  addErrore: (errore: any) => void
): boolean => {
  const field = filter.field.toLowerCase().trim();
  const filterValue = filter.value.toLowerCase().trim();
  
  if (!hasDataField(referenza, field)) {
    addErrore({
      event: Events.CAMPO_ERRATO_FILTRO_CAROSELLO,
      type: 'FILTRO_CAROSELLO',
      id: referenza.dataFields?.codice_referenza?.toString() || '???',
      data: { field, value: filterValue },
      message: `Il campo ${field} con valore ${filterValue} non è presente nella referenza.`,
      gravita: GRAVITA_PROBLEMA.CRITICA,
    });
    return false;
  }

  const dataField = normalizeFieldValue(getDataFieldValue(referenza, field));
  const convertedDataField = convertBooleanString(dataField);
  const convertedFilterValue = convertBooleanString(filterValue);

  switch (filter.operator) {
    case 'equals':
      return evaluateEqualsCondition(dataField, filterValue, convertedDataField, convertedFilterValue);
    case 'not_equals':
      return evaluateNotEqualsCondition(dataField, filterValue, convertedDataField, convertedFilterValue);
    case 'greater_than':
      return evaluateGreaterThanCondition(dataField, filterValue, convertedDataField, convertedFilterValue);
    case 'less_than':
      return evaluateLessThanCondition(dataField, filterValue, convertedDataField, convertedFilterValue);
    case "contains":
      return evaluateContainsCondition(dataField, filterValue, convertedDataField, convertedFilterValue);
    case "not_contains":
      return evaluateNotContainsCondition(dataField, filterValue, convertedDataField, convertedFilterValue);
    default:
      return false;
  }
};

/**
 * Evaluate equals condition
 */
const evaluateEqualsCondition = (dataField: any, filterValue: string, convertedDataField: any, convertedFilterValue: any): boolean => {
  if (typeof convertedDataField === 'boolean' || typeof convertedFilterValue === 'boolean') {
    return convertedDataField === convertedFilterValue;
  }

  if (typeof dataField === 'string') {
    return dataField === filterValue;
  }
  
  if (Array.isArray(dataField)) {
    return dataField.some((el: string) => el?.toLowerCase().includes(filterValue));
  }
  
  if (typeof dataField === 'number') {
    return dataField === parseInt(filterValue, 10);
  }
  
  return false;
};

/**
 * Evaluate not equals condition
 */
const evaluateNotEqualsCondition = (dataField: any, filterValue: string, convertedDataField: any, convertedFilterValue: any): boolean => {
  if (typeof convertedDataField === 'boolean' || typeof convertedFilterValue === 'boolean') {
    return convertedDataField !== convertedFilterValue;
  }

  if (typeof dataField === 'string') {
    return dataField !== filterValue;
  }
  
  if (Array.isArray(dataField)) {
    return dataField.some((el: string) => el.toLowerCase() !== filterValue);
  }
  
  if (typeof dataField === 'number') {
    return dataField !== parseInt(filterValue, 10);
  }
  
  return false;
};

/**
 * Evaluate greater than condition
 */
const evaluateGreaterThanCondition = (dataField: any, filterValue: string, convertedDataField: any, convertedFilterValue: any): boolean => {
  if (typeof convertedDataField === 'boolean' || typeof convertedFilterValue === 'boolean') {
    return false;
  }

  if (typeof dataField === 'string') {
    const numDataField = parseInt(dataField);
    const numFilterValue = parseInt(filterValue);
    return !isNaN(numDataField) && !isNaN(numFilterValue) && numDataField > numFilterValue;
  }
  
  if (Array.isArray(dataField)) {
    return dataField.some((el: string) => {
      const numEl = parseInt(el);
      const numFilterValue = parseInt(filterValue);
      return !isNaN(numEl) && !isNaN(numFilterValue) && numEl > numFilterValue;
    });
  }
  
  if (typeof dataField === 'number') {
    return dataField > parseInt(filterValue, 10);
  }
  
  return false;
};

/**
 * Evaluate less than condition
 */
const evaluateLessThanCondition = (dataField: any, filterValue: string, convertedDataField: any, convertedFilterValue: any): boolean => {
  if (typeof convertedDataField === 'boolean' || typeof convertedFilterValue === 'boolean') {
    return false;
  }

  if (typeof dataField === 'string') {
    const numDataField = parseInt(dataField);
    const numFilterValue = parseInt(filterValue);
    return !isNaN(numDataField) && !isNaN(numFilterValue) && numDataField < numFilterValue;
  }
  
  if (Array.isArray(dataField)) {
    return dataField.some((el: string) => {
      const numEl = parseInt(el);
      const numFilterValue = parseInt(filterValue);
      return !isNaN(numEl) && !isNaN(numFilterValue) && numEl < numFilterValue;
    });
  }
  
  if (typeof dataField === 'number') {
    return dataField < parseInt(filterValue, 10);
  }
  
  return false;
};

const evaluateContainsCondition = (dataField: any, filterValue: string, convertedDataField: any, convertedFilterValue: any): boolean => {
  if (typeof convertedDataField === 'boolean' || typeof convertedFilterValue === 'boolean') {
    return false;
  }

  if (typeof dataField === 'string') {
    return dataField.toLowerCase().includes(filterValue.toLowerCase());
  } 
  if(Array.isArray(dataField)){
    return dataField.some((el: string) => el.toLowerCase().includes(filterValue.toLowerCase()));
  }
  return false;
};

const evaluateNotContainsCondition = (dataField: any, filterValue: string, convertedDataField: any, convertedFilterValue: any): boolean => {
  if (typeof convertedDataField === 'boolean' || typeof convertedFilterValue === 'boolean') {
    return false;   
  }

  if (typeof dataField === 'string') {
    return !dataField.toLowerCase().includes(filterValue.toLowerCase());
  }
  if(Array.isArray(dataField)){
    return dataField.some((el: string) => !el.toLowerCase().includes(filterValue.toLowerCase()));
  }
  return false;
};

// =============================================
// MAIN FILTER FUNCTIONS
// =============================================

/**
 * Optimized filter application for legacy filters
 */
export function applyFilters(
  filters: FilterCondition[],
  refs: ReferenzeIstanta[],
  addErrore: (errore: any) => void
): ReferenzeIstanta[] {
  if (!filters?.length) return refs;

  // Group filters by field for efficient processing
  const groupedFilters = filters.reduce((acc: Record<string, FilterCondition[]>, filter) => {
    const key = filter.field.toLowerCase().trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(filter);
    return acc;
  }, {});

  return refs.filter((referenza) => {
    if (referenza.visibile === false) return false;

    // Normalize data fields once per referenza
    const normalizedReferenza = {
      ...referenza,
      dataFields: Object.fromEntries(
        Object.entries(referenza.dataFields).map(([key, value]) => [key.toLowerCase(), value])
      )
    };

    return Object.entries(groupedFilters).every(([fieldKey, fieldFilters]) => {
      return fieldFilters.some((filter) => 
        evaluateFilterCondition(normalizedReferenza, filter as FilterConstruzioneCarosello, addErrore)
      );
    });
  });
}

/**
 * Optimized filter application for new filter format
 */
export function applyFiltersNew(
  filters: Array<FilterCondition[]>,
  refs: ReferenzeIstanta[],
  addErrore: (errore: any) => void
): ReferenzeIstanta[] {
  if (!filters?.length) return refs;

  return refs.filter((referenza) => {
    if (referenza.visibile === false) return false;

    // Normalize data fields once per referenza
    const normalizedReferenza = {
      ...referenza,
      dataFields: Object.fromEntries(
        Object.entries(referenza.dataFields).map(([key, value]) => [key.toLowerCase(), value])
      )
    };

    // Each group represents an OR condition, all groups must be satisfied (AND)
    return filters.every((filterGroup) => {
      return filterGroup.some((filter) => 
        evaluateFilterCondition(normalizedReferenza, filter as FilterConstruzioneCarosello, addErrore)
      );
    });
  });
}

/* -------------------------------------------------------
   Policy di VISUALIZZAZIONE
-------------------------------------------------------- */

/**
 * Evaluates if conditions are met for inclusion visualization
 */
function isInInclusioneVisualizzazione(
  field: FieldType, 
  value: any, 
  area: string | null, 
  canale: string | null, 
  pv: string | null, 
  referenze: any[], 
  date: string | null
) {
  // Check if value is an operator object
  const isOperatorObject = typeof value === 'object' && value !== null && 'operator' in value;
  const operator = isOperatorObject ? value.operator : 'equals';
  const actualValue = isOperatorObject ? value : value;
  switch (field) {
    case FieldType.VUOTO:
      return true;
      
    case FieldType.REFERENZE:
      return evaluateCondition(
        referenze.map(ref => ref.codice),
        actualValue,
        operator
      );
      
    case FieldType.DATA_SCADENZA:
      if (!date) return false;
      const result = evaluateDateCondition(date, actualValue, operator,"inclusione");
      return result;
    case FieldType.RICORRENZA:
      return true;
      
    case FieldType.AREA:
      return evaluateCondition(area, actualValue, operator);
      
    case FieldType.CANALE:
      return evaluateCondition(canale, actualValue, operator);
      
    case FieldType.PUNTO_VENDITA:
      return evaluateCondition(pv, actualValue, operator);
      
    case FieldType.CONTESTO_KIT:
      return true;
      
    default:
      return false;
  }
}

/**
 * Evaluates if conditions are met for exclusion visualization
 */
function isInEsclusioneVisualizzazione(
  field: FieldType, 
  value: any, 
  area: string | null, 
  canale: string | null, 
  pv: string | null, 
  referenze: any[], 
  date: string | null
) {
  // Check if value is an operator object
  const isOperatorObject = typeof value === 'object' && value !== null && 'operator' in value;
  const operator = isOperatorObject ? value.operator : 'equals';
  const actualValue = isOperatorObject ? value : value;
  switch (field) {
    case FieldType.VUOTO:
      return false;
      
    case FieldType.REFERENZE:
      return evaluateCondition(
        referenze.map(ref => ref.codice),
        actualValue,
        operator
      );
      
    case FieldType.DATA_SCADENZA:
      if (!date) return false;
      return evaluateDateCondition(date, actualValue, operator,"esclusione");
    case FieldType.RICORRENZA:
      return false;
      
    case FieldType.AREA:
      return evaluateCondition(area, actualValue, operator);
      
    case FieldType.CANALE:
      return evaluateCondition(canale, actualValue, operator);
      
    case FieldType.PUNTO_VENDITA:
      return evaluateCondition(pv, actualValue, operator);
      
    case FieldType.CONTESTO_KIT:
      return true;
      
    default:
      return false;
  }
}

/**
 * Se l'item è `policy.locked = true`, allora controlla i filtri di "visualizzazione".
 * Se non soddisfatti, l'item non viene renderizzato.
 */
export function applyFiltriPolicyVisualizzazione(
  item: any,
  area: string | null,
  canale: string | null,
  pv: string | null,
  referenze: any[],
  date: string | null
): boolean {
  if (!item?.policy) return true;
  if (item.policy.locked === false) return true;

  const visualizzazione = item.policy.visualizzazione;
  if (!visualizzazione || visualizzazione.length === 0) return true;

  // Se un item ha più "blocchi" di inclusione/esclusione, vanno tutti soddisfatti
  // (sulla base del tuo codice, sembra un "every")
  return visualizzazione.some((condition: any) => {
    const inclusioneValid = Array.isArray(condition.inclusione) && condition.inclusione.length > 0
      ? condition.inclusione.every((inclusione: any) => 
          isInInclusioneVisualizzazione(inclusione.tipo, inclusione.valore, area, canale, pv, referenze, date)
        )
      : true;

    const esclusioneValid = Array.isArray(condition.esclusione) && condition.esclusione.length > 0
      ? condition.esclusione.every((esclusione: any) => 
          !isInEsclusioneVisualizzazione(esclusione.tipo, esclusione.valore, area, canale, pv, referenze, date)
        )
      : true;
    return inclusioneValid && esclusioneValid;
  });
}



/* -------------------------------------------------------
   Altra function "applyFiltersAvviso"
-------------------------------------------------------- */
export function applyFiltersAvviso(
  filters: FilterCondition[],
  refs: any[],
): any[] {


  if (!filters || filters.length === 0) return refs;
  const res = applyFilters(filters, refs, ()=>{});
  return res;
}



/**
 * Helper function to evaluate general conditions based on operator
 */
function evaluateCondition(
  fieldValue: any, 
  conditionValue: any, 
  operator: Operator = 'equals'
): boolean {
  // Handle array of values (like referenze)
  if (Array.isArray(fieldValue)) {
    switch (operator) {
      case 'equals':
        return fieldValue.includes(conditionValue);
      case 'not_equals':
        return !fieldValue.includes(conditionValue);
      case 'contains':
        return fieldValue.some(item => 
          String(item).toLowerCase().includes(String(conditionValue).toLowerCase())
        );
      case 'not_contains':
        return !fieldValue.some(item => 
          String(item).toLowerCase().includes(String(conditionValue).toLowerCase())
        );
      // For arrays, greater_than/less_than could check if any value meets the condition
      case 'greater_than':
        return fieldValue.some(item => item > conditionValue);
      case 'less_than':
        return fieldValue.some(item => item < conditionValue);
      default:
        return false;
    }
  }
  
  // Handle null values
  if (fieldValue === null) {
    switch (operator) {
      case 'equals':
        return conditionValue === null;
      case 'not_equals':
        return conditionValue !== null;
      default:
        return false;
    }
  }
  
  // Standard conditions for non-null single values
  switch (operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'greater_than':
      return fieldValue > conditionValue;
    case 'less_than':
      return fieldValue < conditionValue;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
    default:
      return false;
  }
}

/**
 * Helper function specifically for date comparisons
 */
function evaluateDateCondition(
  dateField: string,
  conditionValue: any,
  operator: Operator = 'equals',
  from:string
): boolean {
  // Handle date objects specifically
  const fieldDate = dayjs(dateField);
  // Handle complex date comparison object
  if (typeof conditionValue === 'object' && conditionValue !== null && conditionValue.date) {
    const compareDate = dayjs(conditionValue.date);
    switch (operator) {
      case 'equals':
        return fieldDate.isSame(compareDate, 'day');
      case 'not_equals':
        return !fieldDate.isSame(compareDate, 'day');
      case 'greater_than':
        return fieldDate.isAfter(compareDate);
      case 'less_than':
        return fieldDate.isBefore(compareDate);
      default:
        return false;
    }
  }
  return false
  // // Handle simple date string
  // const compareDate = moment(conditionValue);
  
  // switch (operator) {
  //   case 'equals':
  //     return fieldDate.isSame(compareDate, 'day');
  //   case 'not_equals':
  //     return !fieldDate.isSame(compareDate, 'day');
  //   case 'greater_than':
  //     console.log(
  //       "Comparing greater than",
  //       "Field date:", fieldDate.format('YYYY-MM-DD'),
  //       "Compare date:", compareDate.format('YYYY-MM-DD'),
  //       "Result:", fieldDate.isAfter(compareDate)
  //     );
  //     return fieldDate.isAfter(compareDate);
  //   case 'less_than':
  //     return fieldDate.isBefore(compareDate);
  //   // Contains/not_contains aren't typically used with dates, but could check date parts
  //   case 'contains':
  //   case 'not_contains':
  //     // This implementation would depend on what "containing" means for dates
  //     // Perhaps checking if month or year matches?
  //     return false;
  //   default:
  //     return false;
  // }
}