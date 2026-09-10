/**
 * Verifica se un valore è un UUID valido
 * @param value - Il valore da verificare
 * @returns true se il valore è un UUID valido, false altrimenti
 */
/**
 * Verifica se un valore è un UUID valido oppure un ID esadecimale di 24 caratteri (tipo MongoDB ObjectId)
 * @param value - Il valore da verificare
 * @returns true se il valore è un UUID valido o un ObjectId, false altrimenti
 */
export const isUUID = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  // UUID classico
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // ObjectId MongoDB (24 caratteri esadecimali)
  const objectIdRegex = /^[0-9a-f]{24}$/i;
  return uuidRegex.test(value) || objectIdRegex.test(value);
};

/**
 * Verifica se un valore è un ID valido (UUID o altro formato)
 * @param value - Il valore da verificare
 * @returns true se il valore sembra essere un ID, false altrimenti
 */
export const isId = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  
  // UUID
  if (isUUID(value)) return true;
  
  // ID numerico
  if (/^\d+$/.test(value)) return true;
  
  // ID alfanumerico (almeno 8 caratteri)
  if (/^[a-zA-Z0-9]{8,}$/.test(value)) return true;
  
  return false;
};

/**
 * Formatta un ID per la visualizzazione (tronca se troppo lungo)
 * @param id - L'ID da formattare
 * @param maxLength - Lunghezza massima (default: 8)
 * @returns L'ID formattato
 */
export const formatId = (id: string, maxLength: number = 8): string => {
  if (id.length <= maxLength) return id;
  return `${id.substring(0, maxLength)}...`;
}; 