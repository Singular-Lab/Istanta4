using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json.Linq;

namespace Istanta.Utility
{
    /// La rimessa in volantino di un record dal "Fuori vol" del tracciato del Plugin.
    ///
    /// Le azioni sul box (cambioMetaRecordInLavorazione) valgono solo per un gruppo impaginato, e un
    /// gruppo fuori volantino non lo e': qui si scrive il Dato del record del tracciato. I campi del
    /// cliente (Coop: il tema con "fuori depliant") e il campo core si cambiano come nelle azioni sul
    /// box: il valore di prima finisce nelle Alterazioni, se non c'era gia'.
    public static class RimessaInVolantino
    {
        /// Il nome del campo nel Dato: nelle richieste del Plugin il punto si scrive "$".
        public static string Chiave(string campo) => (campo ?? "").Replace("$", ".");

        /// Scrive i campi e mette il record in volantino. I campi arrivano gia' convertiti con
        /// l'addestramento della lista, e con il nome del Dato.
        public static Dictionary<string, object> Applica(Dictionary<string, object> dato, IDictionary<string, object> campi)
        {
            Dictionary<string, object> alterazioni = Alterazioni(dato);

            foreach (var campo in campi)
            {
                Scrivi(dato, alterazioni, campo.Key, campo.Value ?? "");
            }
            Scrivi(dato, alterazioni, GLOBAL_VARIABLES_FICO.keyInVolantino, true);

            dato[GLOBAL_VARIABLES.keyAlterazioni] = alterazioni;
            return dato;
        }

        private static void Scrivi(Dictionary<string, object> dato, Dictionary<string, object> alterazioni, string chiave, object valore)
        {
            //Come le azioni sul box: resta il valore originale, non quello di un cambio intermedio.
            if (!alterazioni.ContainsKey(chiave))
            {
                alterazioni[chiave] = dato.TryGetValue(chiave, out object? prima) && prima != null ? prima : "";
            }
            dato[chiave] = valore;
        }

        private static Dictionary<string, object> Alterazioni(Dictionary<string, object> dato)
        {
            if (!dato.TryGetValue(GLOBAL_VARIABLES.keyAlterazioni, out object? valore) || valore == null)
            {
                return new Dictionary<string, object>();
            }
            return valore switch
            {
                Dictionary<string, object> d => d,
                JObject o => o.ToObject<Dictionary<string, object>>() ?? new Dictionary<string, object>(),
                _ => new Dictionary<string, object>(),
            };
        }
    }
}
