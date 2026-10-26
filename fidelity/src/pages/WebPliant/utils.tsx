// utils/filters.ts

import dayjs from 'dayjs';
import { Events, GRAVITA_PROBLEMA } from '@/stores/errorSlice';
import { FilterCondition, FilterConditionContesto, FilterConstruzioneCarosello, PageLayoutItem, ReferenzeIstanta } from '../../../lib/types';
import { Colorize } from '../../../lib/Colorize';
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

export function applyFiltriContesto(
  filters: FilterConditionContesto[] | undefined,
  refs: ReferenzeIstanta[]
): any[] {
  // Early return if no filters
  if (!filters || filters.length === 0) {
    return refs;
  }

  // Better handling of invalid filters
  const validFilters = filters.filter(filter => 
    filter?.nome_field && filter?.user_value !== undefined);
  
  if (validFilters.length === 0) {
    return refs;
  }

  // Group filters by field name for efficient processing
  const groupedFilters = validFilters.reduce((accumulator: any, filter: FilterConditionContesto) => {
    const fieldName = filter.nome_field.toLowerCase().trim();
    if (!accumulator[fieldName]) {
      accumulator[fieldName] = [];
    }
    accumulator[fieldName].push(filter);
    return accumulator;
  }, {});

  // Helper function to convert boolean strings
  const convertBooleanString = (value: any): any => {
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  };

  // Filter referenze based on context filters
  const result = refs.filter((referenza) => {
    // Skip if referenza is not visible
    if (referenza.visibile === false) {
      return false;
    }

    return Object.keys(groupedFilters).every((fieldName) => {
      const fieldFilters = groupedFilters[fieldName];
      
      // For each field, any matching filter passes the condition
      return fieldFilters.some((filter: FilterConditionContesto) => {
        const filterValue = typeof filter.user_value === 'string' 
          ? filter.user_value.toLowerCase().trim() 
          : filter.user_value;
        
        // Convert boolean values for comparison
        const convertedFilterValue = convertBooleanString(filterValue);
        
        // Check if arrays are empty or don't exist
        const contextPromoEmpty = !referenza?.dataFields.context_promo || 
                                 !Array.isArray(referenza.dataFields.context_promo) ||
                                 referenza.dataFields.context_promo.length === 0;
                                 
        const contextTracciatoEmpty = !referenza?.dataFields.context_tracciato || 
                                     !Array.isArray(referenza.dataFields.context_tracciato) ||
                                     referenza.dataFields.context_tracciato.length === 0;
        
        // Special case: For "not_equals", empty context should pass the filter
        if (filter.operator === 'not_equals' && contextPromoEmpty && contextTracciatoEmpty) {
          return true;
        }
        
        // Function to check if a specific context item matches the current filter
        const matchesFilter = (contextItem: any): boolean => {
          const itemField = contextItem.nome_field.toLowerCase().trim();
          
          // Skip if field doesn't match
          if (itemField !== fieldName.toLowerCase().trim()) {
            return false;
          }
          
          const itemValue = typeof contextItem.user_value === 'string' 
            ? contextItem.user_value.toLowerCase().trim() 
            : contextItem.user_value;
          
          // Convert item value for consistent comparison
          const convertedItemValue = convertBooleanString(itemValue);
          
          switch (filter.operator) {
            case 'equals':
              // Handle boolean comparison specifically
              if (typeof convertedItemValue === 'boolean' || typeof convertedFilterValue === 'boolean') {
                return convertedItemValue === convertedFilterValue;
              }
              
              // Handle string comparison
              if (typeof itemValue === 'string') {
                return itemValue === filterValue;
              }
              // Handle array comparison
              else if (Array.isArray(itemValue)) {
                return itemValue.some((el: string) => 
                  typeof el === 'string' ? el.toLowerCase() === filterValue : el === filterValue
                );
              }
              // Handle number comparison
              else if (typeof itemValue === 'number') {
                return itemValue === (typeof filterValue === 'string' ? parseInt(filterValue, 10) : filterValue);
              }
              return false;
              
            case 'not_equals':
              // Handle boolean comparison
              if (typeof convertedItemValue === 'boolean' || typeof convertedFilterValue === 'boolean') {
                return convertedItemValue !== convertedFilterValue;
              }
              
              // Handle string comparison
              if (typeof itemValue === 'string') {
                return itemValue !== filterValue;
              }
              // Handle array comparison
              else if (Array.isArray(itemValue)) {
                return itemValue.some((el: string) => 
                  typeof el === 'string' ? el.toLowerCase() !== filterValue : el !== filterValue
                );
              }
              // Handle number comparison
              else if (typeof itemValue === 'number') {
                return itemValue !== (typeof filterValue === 'string' ? parseInt(filterValue, 10) : filterValue);
              }
              return false;
              
            case 'greater_than':
              // Boolean values don't support greater than comparison
              if (typeof convertedItemValue === 'boolean' || typeof convertedFilterValue === 'boolean') {
                return false;
              }
              
              // Handle string comparison (convert to number)
              if (typeof itemValue === 'string') {
                return !isNaN(Number(itemValue)) && 
                       !isNaN(Number(filterValue)) && 
                       Number(itemValue) > Number(filterValue);
              }
              // Handle array comparison
              else if (Array.isArray(itemValue)) {
                return itemValue.some((el: string) => 
                  !isNaN(Number(el)) && !isNaN(Number(filterValue)) && Number(el) > Number(filterValue)
                );
              }
              // Handle number comparison
              else if (typeof itemValue === 'number') {
                return itemValue > (typeof filterValue === 'string' ? Number(filterValue) : filterValue);
              }
              return false;
              
            case 'less_than':
              // Boolean values don't support less than comparison
              if (typeof convertedItemValue === 'boolean' || typeof convertedFilterValue === 'boolean') {
                return false;
              }
              
              // Handle string comparison (convert to number)
              if (typeof itemValue === 'string') {
                return !isNaN(Number(itemValue)) && 
                       !isNaN(Number(filterValue)) && 
                       Number(itemValue) < Number(filterValue);
              }
              // Handle array comparison
              else if (Array.isArray(itemValue)) {
                return itemValue.some((el: string) => 
                  !isNaN(Number(el)) && !isNaN(Number(filterValue)) && Number(el) < Number(filterValue)
                );
              }
              // Handle number comparison
              else if (typeof itemValue === 'number') {
                return itemValue < (typeof filterValue === 'string' ? Number(filterValue) : filterValue);
              }
              return false;
              
            default:
              return false;
          }
        };
        
        // Check in contextPromo if it exists
        const contextPromoMatch = !contextPromoEmpty && 
          (referenza.dataFields.context_promo as any[]).some(matchesFilter);
        
        // Check in contextTracciato if it exists
        const contextTracciatoMatch = !contextTracciatoEmpty && 
          (referenza.dataFields.context_tracciato as any[]).some(matchesFilter);
        
        // If we're checking for NOT equals and no matches in any context, return true
        if (filter.operator === 'not_equals') {
          // Count how many matching fields we found in the contexts
          let matchingFieldsCount = 0;
          
          // Check if any context item has the field we're looking for (regardless of its value)
          if (!contextPromoEmpty) {
            const promoFieldExists = (referenza.dataFields.context_promo as any[]).some(item => 
              item.nome_field.toLowerCase().trim() === fieldName.toLowerCase().trim()
            );
            if (promoFieldExists) matchingFieldsCount++;
          }
          
          if (!contextTracciatoEmpty) {
            const tracciatoFieldExists = (referenza.dataFields.context_tracciato as any[]).some(item => 
              item.nome_field.toLowerCase().trim() === fieldName.toLowerCase().trim()
            );
            if (tracciatoFieldExists) matchingFieldsCount++;
          }
          
          // If the field doesn't exist in any context, or no matching values were found
          if (matchingFieldsCount === 0 || (contextPromoMatch || contextTracciatoMatch)) {
            return true;
          }
          return false;
        }
        
        // For other operators, return true if there's a match in either context
        return contextPromoMatch || contextTracciatoMatch;
      });
    });
  });

  return result;
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
   Policy di CONTENUTO
-------------------------------------------------------- */

function isInInclusioneContenuto(field: FieldType, value: string, ref: any, area: string | null, canale: string | null, pv: string | null) {
  switch (field) {
    case FieldType.VUOTO:
      return true;
    case FieldType.REFERENZE:
      return ref.codice === value;
    case FieldType.DATA_SCADENZA:
      return dayjs(value).isSameOrAfter(dayjs());
    case FieldType.RICORRENZA:
      return true;
    case FieldType.AREA:
      return area === value;
    case FieldType.CANALE:
      return canale === value;
    case FieldType.PUNTO_VENDITA:
      return pv === value;
    case FieldType.CONTESTO_KIT:
      return true;
    default:
      return false;
  }
}

function isInEsclusioneContenuto(field: FieldType, value: string, ref: any, area: string | null, canale: string | null, pv: string | null) {
  switch (field) {
    case FieldType.VUOTO:
      return false;
    case FieldType.REFERENZE:
      return ref.codice === value;
    case FieldType.DATA_SCADENZA:
      return dayjs(value).isBefore(dayjs());
    case FieldType.RICORRENZA:
      return false;
    case FieldType.AREA:
      return area === value;
    case FieldType.CANALE:
      return canale === value;
    case FieldType.PUNTO_VENDITA:
      return pv === value;
    case FieldType.CONTESTO_KIT:
      return true;
    default:
      return false;
  }
}

/**
 * Per ogni referenza di un carosello, controlla la policy di contenuto.
 * Se il "filtro contenuto" non è soddisfatto, la referenza non va mostrata.
 */
export function applyFiltriPolicyContenuto(
  item: any,
  ref: ReferenzeIstanta,
  area: string | null,
  canale: string | null,
  pv: string | null
): boolean {
  if (!item?.policy) return true;
  if (item.policy.locked === false) return true;

  const filtriContenuto = item.policy.filtri_contenuto;
  if (!filtriContenuto || filtriContenuto.length === 0) return true;

  return filtriContenuto.every((condition: any) => {
    const inclusioneValid = condition.inclusione?.every((inclusione: any) => {
      const result = isInInclusioneContenuto(inclusione.tipo, inclusione.valore, ref, area, canale, pv);
      return result;
    });
    const esclusioneValid = condition.esclusione?.every((esclusione: any) => {
      const result = !isInEsclusioneContenuto(esclusione.tipo, esclusione.valore, ref, area, canale, pv);
      return result;
    });
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
    console.log(Colorize.bgBlue(from))
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