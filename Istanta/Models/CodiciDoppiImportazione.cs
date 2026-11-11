using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Istanta.Models
{
    /// <summary>
    /// TASK-f434bd2f: i codici che una lista importata porta piu' volte con la stessa label, nello stesso
    /// canale e nella stessa area. Canale e area li decide la libreria d'agenzia, quindi il controllo si fa
    /// sulle liste che restituisce: i codici ripetuti nei Records, piu' quelli di cui l'agenzia ha scartato
    /// le righe doppie (ImportResult.codiciDoppi). Le fusioni volute dal cliente l'agenzia non le segnala.
    ///
    /// Se ce ne sono, importaVolantino si ferma prima di salvare e li scrive in CodiciDoppi.json, nella
    /// cartella dell'attivita' accanto a Report.json; la pagina Tracciati li legge da
    /// Tracciati/codiciDoppiAttivita e chiede all'operatore se annullare o continuare.
    /// </summary>
    public static class CodiciDoppiImportazione
    {
        public const string NomeFile = "CodiciDoppi.json";

        public const string MessaggioAttivita = "Codici doppi nella lista: in attesa di decisione";

        // idAttivita e' un intero: il percorso non puo' uscire dalla cartella delle importazioni.
        public static string Percorso(string pathToImport, long idAttivita)
        {
            return Path.Combine(pathToImport, idAttivita.ToString(), NomeFile);
        }

        /// <summary>
        /// I codici doppi delle liste date, uno per codice, canale e area, ordinati per canale, area e codice.
        /// liste: le liste dell'agenzia (chiavi Canale, Area e Records); keyCodice: la chiave del codice nei record.
        /// </summary>
        public static List<CodiceDoppioInLista> Trova(IEnumerable<Dictionary<string, object>>? liste, string label,
            IEnumerable<CodiceDoppioInLista>? segnalatiDallAgenzia, string keyCodice)
        {
            var doppi = new List<CodiceDoppioInLista>();
            foreach (var lista in liste ?? Enumerable.Empty<Dictionary<string, object>>())
            {
                if (lista == null)
                {
                    continue;
                }
                string canale = Testo(lista, GLOBAL_VARIABLES.keyCanale);
                string area = Testo(lista, GLOBAL_VARIABLES.keyArea);
                if (!lista.TryGetValue("Records", out object? records) || records == null)
                {
                    continue;
                }
                var codici = JToken.FromObject(records).Children<JObject>()
                    .Select(r => r[keyCodice]?.ToString() ?? "")
                    .Where(c => c != "");
                foreach (var codice in codici.GroupBy(c => c).Where(g => g.Count() > 1))
                {
                    doppi.Add(new CodiceDoppioInLista { codice = codice.Key, label = label, canale = canale, area = area });
                }
            }
            foreach (var segnalato in segnalatiDallAgenzia ?? Enumerable.Empty<CodiceDoppioInLista>())
            {
                if (segnalato != null && !string.IsNullOrEmpty(segnalato.codice))
                {
                    doppi.Add(new CodiceDoppioInLista { codice = segnalato.codice, label = label, canale = segnalato.canale ?? "", area = segnalato.area ?? "" });
                }
            }

            return doppi
                .GroupBy(d => (d.canale, d.area, d.codice))
                .Select(g => g.First())
                .OrderBy(d => d.canale, StringComparer.Ordinal)
                .ThenBy(d => d.area, StringComparer.Ordinal)
                .ThenBy(d => d.codice, StringComparer.Ordinal)
                .ToList();
        }

        public static async Task ScriviAsync(string pathToImport, long idAttivita, List<CodiceDoppioInLista> codiciDoppi)
        {
            await File.WriteAllTextAsync(Percorso(pathToImport, idAttivita), JsonConvert.SerializeObject(codiciDoppi));
        }

        /// <summary>Quando l'importazione prosegue, l'elenco di una fermata precedente non vale piu'.</summary>
        public static void Togli(string pathToImport, long idAttivita)
        {
            string percorso = Percorso(pathToImport, idAttivita);
            if (File.Exists(percorso))
            {
                File.Delete(percorso);
            }
        }

        /// <summary>I codici doppi della fermata dell'attivita', oppure null se l'attivita' non si e' fermata per questo.</summary>
        public static async Task<List<CodiceDoppioInLista>?> LeggiAsync(string pathToImport, long idAttivita)
        {
            string percorso = Percorso(pathToImport, idAttivita);
            if (!File.Exists(percorso))
            {
                return null;
            }
            return JsonConvert.DeserializeObject<List<CodiceDoppioInLista>>(await File.ReadAllTextAsync(percorso));
        }

        private static string Testo(Dictionary<string, object> lista, string chiave)
        {
            return lista.TryGetValue(chiave, out object? valore) ? valore?.ToString() ?? "" : "";
        }
    }
}
