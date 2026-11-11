/**
 * Il nome con cui un file della consultazione compare negli elenchi e si salva scaricandolo (spec
 * dati-consultazione, "Download dei file pubblicati dalla Visualizzazione"): il nome leggibile del
 * file nel kit (files_runtime.nome, es. "SS_LI_24-09-26") con la sua estensione. Il nome con cui il
 * file e' archiviato su Olimpo (files_runtime.nome_originale, per i volantini di Istanta un GUID)
 * vale solo quando il nome leggibile manca. Funzione pura.
 */

/** Le estensioni riconosciute in fondo al nome: "Volantino 24.09.26" non ha l'estensione "26". */
const ESTENSIONI_NOTE = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'svg', 'zip', 'mp4', 'mov', 'html', 'htm',
  'indd', 'idml', 'ai', 'eps', 'psd', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json', 'xml',
]);

/** L'estensione dei tipi di file piu' comuni, quando il nome archiviato non la dice. */
const ESTENSIONE_DEL_TIPO: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/tiff': 'tif',
  'image/svg+xml': 'svg',
  'application/zip': 'zip',
  'video/mp4': 'mp4',
  'text/html': 'html',
};

/** Il nome usato quando non c'e' altro. */
export const NOME_FILE_DI_RISERVA = 'file.pdf';

/** L'estensione nota in fondo a un nome, in minuscolo; null se non ce n'e' una. */
export function estensioneNota(nome: string | null | undefined): string | null {
  const trovata = /\.([a-z0-9]{1,5})$/i.exec(nome?.trim() ?? '');
  const estensione = trovata?.[1].toLowerCase();
  return estensione && ESTENSIONI_NOTE.has(estensione) ? estensione : null;
}

/**
 * "SS_LI_24-09-26" archiviato come "29357a16-….pdf" diventa "SS_LI_24-09-26.pdf". Un nome che ha gia'
 * la sua estensione resta com'e'; senza un'estensione nota si prende quella del nome archiviato, poi
 * quella del tipo del file. Senza nome leggibile vale il nome archiviato, poi "file.pdf".
 */
export function nomeFileLeggibile(nome: string | null | undefined, nomeOriginale: string | null | undefined, mime?: string | null): string {
  const leggibile = nome?.trim() ?? '';
  const archiviato = nomeOriginale?.trim() ?? '';
  if (!leggibile) return archiviato || NOME_FILE_DI_RISERVA;
  if (estensioneNota(leggibile)) return leggibile;
  const tipo = mime?.split(';')[0].trim().toLowerCase() ?? '';
  const estensione = estensioneNota(archiviato) ?? ESTENSIONE_DEL_TIPO[tipo] ?? null;
  return estensione ? `${leggibile}.${estensione}` : leggibile;
}
