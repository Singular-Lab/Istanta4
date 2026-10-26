using System.Linq;

namespace Istanta.Utility
{
    /// I20-997: quale script di agenzia serve a questa macchina, e dove sta.
    ///
    /// Prima il front-end caricava wwwroot/js/agenzia.js, che era una copia a mano dell'archivio
    /// del cliente montato, fatta da monta-cliente.sh. Due conseguenze: chi lavorava su un cliente
    /// doveva ricopiare il file per passare a un altro, e i nomi dei clienti comparivano negli
    /// indirizzi delle pagine - vedere "coop" sul server di un altro cliente e' brutto e non e'
    /// necessario. Ora lo script si chiede al server, che sa qual e' il cliente montato, e gli
    /// archivi stanno fuori da wwwroot: non essendo serviti staticamente non sono raggiungibili
    /// per indirizzo, nemmeno indovinandolo.
    public static class ScriptAgenzia
    {
        /// La cartella che contiene gli archivi, sotto la radice del contenuto. Fuori da wwwroot
        /// di proposito.
        public const string Cartella = "ScriptAgenzia";

        /// Il nome del file, uguale per tutti i clienti.
        public const string NomeFile = "agenzia.js";

        /// Un nome di cliente utilizzabile per cercare una cartella.
        ///
        /// Il valore arriva dall'ambiente, quindi si controlla prima di trasformarlo in un
        /// percorso: separatori e risalite trasformerebbero questa ricerca in un modo per leggere
        /// qualunque file della macchina.
        public static bool NomeAccettabile(string? cliente)
        {
            if (string.IsNullOrWhiteSpace(cliente))
            {
                return false;
            }

            if (cliente.Contains('/') || cliente.Contains('\\') || cliente.Contains(".."))
            {
                return false;
            }

            return cliente.All(c => char.IsLetterOrDigit(c) || c == '-' || c == '_');
        }

        /// La cartella dell'archivio, cercata fra quelle che esistono senza distinguere maiuscole
        /// e minuscole.
        ///
        /// Non e' pignoleria: ISTANTA_CLIENTE e' il nome del cliente in minuscolo, mentre le
        /// cartelle storiche hanno grafie diverse - "Maiora", "craiOvest". Su macOS il filesystem
        /// non distingue e un confronto esatto sembrerebbe funzionare; in produzione, che e'
        /// Linux, lo stesso codice non troverebbe il file.
        public static string? TrovaCartella(IEnumerable<string>? cartelleEsistenti, string? cliente)
        {
            if (!NomeAccettabile(cliente) || cartelleEsistenti == null)
            {
                return null;
            }

            return cartelleEsistenti.FirstOrDefault(
                c => string.Equals(c, cliente, StringComparison.OrdinalIgnoreCase));
        }
    }
}
