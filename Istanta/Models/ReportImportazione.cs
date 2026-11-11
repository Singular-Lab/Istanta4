using System.Globalization;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Istanta.Models
{
    /// <summary>
    /// TASK-c4fdc17b: le regole del report di un'importazione (Report.json, ReportAttivita) che il server
    /// decide da solo, fuori da OperationsController.importaVolantino perche' si possano provare.
    ///
    /// - Ogni riga porta l'etichetta con cui la lista e' stata caricata (KeyEtichetta), anche le uscite.
    /// - Dalle alterazioni si tolgono i campi che il cliente esclude dal report (campiEsclusiDalReport di
    ///   SourceConfronto): una referenza che cambia solo quelli risulta inalterata.
    /// - "Salva e fai report" che porta l'etichetta alla prima versione in ogni tracciato non scrive il
    ///   report: e' un "Salva" (ScriveReport).
    /// - A fine "Salva e fai report" riuscito, accanto a Report.json c'e' Report.csv (Csv).
    /// </summary>
    public static class ReportImportazione
    {
        public const string NomeFileCsv = "Report.csv";

        /// <summary>La chiave dell'etichetta del tracciato nelle righe del report. Non e' un campo del
        /// dato: integrazioneMirataInTracciato non la copia nel record.</summary>
        public const string KeyEtichetta = "EtichettaTracciato";

        public const string StatoNuovo = "Nuovo";
        public const string StatoUscito = "Uscito";
        public const string StatoCambiato = "Cambiato";
        public const string StatoInalterato = "Inalterato";

        public static string PercorsoCsv(string pathToImport, int idAttivita)
        {
            return Path.Combine(pathToImport, idAttivita.ToString(), NomeFileCsv);
        }

        /// <summary>Se l'attivita' ha un report da leggere.</summary>
        public static bool HaReport(string pathToImport, int idAttivita)
        {
            return File.Exists(ReportAttivita.Percorso(pathToImport, idAttivita));
        }

        /// <summary>Se l'importazione scrive Report.json: solo se il report e' chiesto e ha righe, e non
        /// quando un "Salva e fai report" porta l'etichetta alla prima versione in ogni tracciato.</summary>
        public static bool ScriveReport(bool persistent, bool askReport, int righe, bool primaVersioneOvunque)
        {
            return askReport && righe > 0 && !(persistent && primaVersioneOvunque);
        }

        /// <summary>Le alterazioni senza i campi esclusi dal report. Non tocca il dato della referenza.</summary>
        public static Dictionary<string, object> SenzaCampiEsclusi(Dictionary<string, object> alterazioni, IEnumerable<string>? esclusi)
        {
            var fuori = new HashSet<string>((esclusi ?? Enumerable.Empty<string>()).Where(e => !string.IsNullOrWhiteSpace(e)));
            return alterazioni.Where(a => !fuori.Contains(a.Key)).ToDictionary(a => a.Key, a => a.Value);
        }

        /// <summary>Lo stato della riga come lo mostra il report (promo.js consultaReport): nuova
        /// (versione 1), uscita (versione -1), cambiata se ha alterazioni, altrimenti inalterata.</summary>
        public static string Stato(IDictionary<string, object> riga)
        {
            if (Alterazioni(riga).Count > 0)
            {
                return StatoCambiato;
            }
            int versione = riga.TryGetValue("versione", out object? v) && int.TryParse(Convert.ToString(v, CultureInfo.InvariantCulture), out int n) ? n : 0;
            return versione == 1 ? StatoNuovo : versione == -1 ? StatoUscito : StatoInalterato;
        }

        /// <summary>Il CSV del report completo: separatore ;, una riga per campo alterato con il valore
        /// precedente e quello attuale, una riga sola per le referenze senza alterazioni. Le colonne del
        /// cliente le conosce solo la pagina: qui ci sono quelle del core.</summary>
        public static string Csv(IEnumerable<IDictionary<string, object>> report)
        {
            var testo = new StringBuilder();
            testo.Append(Riga(new[] { "Stato", "Area/canale", "Codice", "Etichetta", "Campo", "Prima", "Dopo" }));
            foreach (var riga in report)
            {
                string[] inizio = { Stato(riga), Valore(riga, "AC"), Valore(riga, "Referenza.Codice"), Valore(riga, KeyEtichetta) };
                var alterazioni = Alterazioni(riga);
                if (alterazioni.Count == 0)
                {
                    testo.Append(Riga(inizio.Concat(new[] { "", "", "" })));
                    continue;
                }
                foreach (var campo in alterazioni)
                {
                    testo.Append(Riga(inizio.Concat(new[] { campo.Key, Testo(campo.Value), Valore(riga, campo.Key) })));
                }
            }
            return testo.ToString();
        }

        /// <summary>Scrive Report.csv accanto a Report.json, in UTF-8 con BOM perche' Excel lo apra giusto.</summary>
        public static Task ScriviCsvAsync(string pathAttivita, IEnumerable<IDictionary<string, object>> report)
        {
            return File.WriteAllTextAsync(Path.Combine(pathAttivita, NomeFileCsv), Csv(report), new UTF8Encoding(true));
        }

        private static Dictionary<string, object?> Alterazioni(IDictionary<string, object> riga)
        {
            if (!riga.TryGetValue(GLOBAL_VARIABLES.keyAlterazioni, out object? valore) || valore == null)
            {
                return new Dictionary<string, object?>();
            }
            if (valore is JObject oggetto)
            {
                return oggetto.Properties().ToDictionary(p => p.Name, p => (object?)p.Value);
            }
            if (valore is IDictionary<string, object> dizionario)
            {
                return dizionario.ToDictionary(d => d.Key, d => (object?)d.Value);
            }
            return new Dictionary<string, object?>();
        }

        private static string Valore(IDictionary<string, object> riga, string campo)
        {
            return riga.TryGetValue(campo, out object? v) ? Testo(v) : "";
        }

        private static string Testo(object? valore)
        {
            if (valore == null)
            {
                return "";
            }
            if (valore is JValue jv)
            {
                return jv.Value == null ? "" : Convert.ToString(jv.Value, CultureInfo.InvariantCulture) ?? "";
            }
            return Convert.ToString(valore, CultureInfo.InvariantCulture) ?? "";
        }

        private static string Riga(IEnumerable<string> celle)
        {
            return string.Join(";", celle.Select(Cella)) + "\r\n";
        }

        private static string Cella(string valore)
        {
            if (valore.IndexOfAny(new[] { ';', '"', '\n', '\r' }) < 0)
            {
                return valore;
            }
            return "\"" + valore.Replace("\"", "\"\"") + "\"";
        }
    }
}
