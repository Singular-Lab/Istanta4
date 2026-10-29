/**
 * Formati ammessi dal caricamento manuale dei materiali di un kit (POST /api/uploadMateriale).
 * Stessa regola di FileManagementService.uploadMateriale: per il tipo di export WEB solo .json o
 * .webpliant (le referenze del volantino digitale), per tutti gli altri solo .pdf. Il confronto
 * dell'estensione e' esatto, maiuscole comprese: il server usa path.extname senza normalizzarla.
 */

/** Codice del tipo di export dei contenuti digitali. */
export const CODICE_EXPORT_WEB = "WEB";

const ESTENSIONI_WEB: readonly string[] = [".json", ".webpliant"];
const ESTENSIONI_STAMPA: readonly string[] = [".pdf"];

/** Estensioni ammesse per il tipo di export indicato dal suo codice. */
export const estensioniAmmesse = (codiceExport: string): readonly string[] =>
    codiceExport === CODICE_EXPORT_WEB ? ESTENSIONI_WEB : ESTENSIONI_STAMPA;

/**
 * Estensione del nome come la calcola path.extname di Node: dall'ultimo punto in poi, vuota se
 * il nome non ha punti o ne ha uno solo in testa (".json" e' un nome, non un'estensione).
 */
export const estensioneFile = (nomeFile: string): string => {
    const nome = nomeFile.split(/[\\/]/).pop() ?? "";
    const punto = nome.lastIndexOf(".");
    return punto <= 0 ? "" : nome.slice(punto);
};

const elenco = (estensioni: readonly string[]) =>
    estensioni.length === 1 ? estensioni[0] : `${estensioni.slice(0, -1).join(", ")} o ${estensioni[estensioni.length - 1]}`;

/** null se il file e' ammesso per il tipo di export, altrimenti il motivo da mostrare all'operatore. */
export const motivoFileNonAmmesso = (nomeFile: string, codiceExport: string): string | null => {
    const ammesse = estensioniAmmesse(codiceExport);
    const estensione = estensioneFile(nomeFile);
    if (ammesse.includes(estensione)) {
        return null;
    }
    if (ammesse.includes(estensione.toLowerCase())) {
        return `Estensione non ammessa: per il tipo di export ${codiceExport} serve ${estensione.toLowerCase()} in minuscolo. Rinomina il file.`;
    }
    return `Formato non ammesso per il tipo di export ${codiceExport}: servono file ${elenco(ammesse)}.`;
};

/** Estensioni ammesse da almeno uno dei tipi di export, senza doppioni (per l'attributo accept). */
export const estensioniAmmessePerTipi = (codiciExport: readonly string[]): string[] =>
    [...new Set(codiciExport.flatMap((codice) => estensioniAmmesse(codice)))];
