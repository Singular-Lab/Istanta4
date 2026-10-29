/**
 * Verifica se un valore è un UUID valido oppure un ID esadecimale di 24 caratteri
 * @param value - Il valore da verificare
 * @returns true se il valore è un UUID valido o un ObjectId, false altrimenti
 */
export const isUUID = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  // UUID classico
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const objectIdRegex = /^[0-9a-f]{24}$/i;
  return uuidRegex.test(value) || objectIdRegex.test(value);
};
