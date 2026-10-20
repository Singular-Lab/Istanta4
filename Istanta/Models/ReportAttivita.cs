namespace Istanta.Models
{
    /// <summary>
    /// Il Report.json che un'importazione con askReport scrive nella cartella della sua attivita',
    /// dentro path_to_import (OperationsController).
    ///
    /// Il browser lo chiedeva come file statico, imported_files/&lt;id&gt;/Report.json di wwwroot: in
    /// Docker path_to_import e' /data/imported_files/, fuori da wwwroot, e la risposta era 404.
    /// Ora lo restituisce Tracciati/reportAttivita, che lo legge da qui.
    /// </summary>
    public static class ReportAttivita
    {
        public const string NomeFile = "Report.json";

        // idAttivita e' un intero: il percorso non puo' uscire dalla cartella delle importazioni.
        public static string Percorso(string pathToImport, int idAttivita)
        {
            return Path.Combine(pathToImport, idAttivita.ToString(), NomeFile);
        }

        /// <summary>Il contenuto del report, oppure null se l'attivita' non ne ha uno.</summary>
        public static async Task<string?> LeggiAsync(string pathToImport, int idAttivita)
        {
            string percorso = Percorso(pathToImport, idAttivita);
            if (!File.Exists(percorso))
            {
                return null;
            }

            return await File.ReadAllTextAsync(percorso);
        }
    }
}
