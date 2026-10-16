/**
 * Costanti dei permessi per il client: sono quelle del catalogo condiviso
 * (lib/accessi/catalogo.ts), usato anche dal server. Usarle al posto di stringhe
 * letterali: un refuso diventa un errore di compilazione.
 */
export { PERMESSI as PERMISSIONS } from '../../lib/accessi/catalogo';
export type { CodicePermesso as PermissionCode } from '../../lib/accessi/catalogo';
