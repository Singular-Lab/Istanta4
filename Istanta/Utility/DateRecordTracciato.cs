using System.Globalization;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json.Linq;

namespace Istanta.Utility
{
    /// Le tre date di un record del tracciato (data_registrazione, data_modifica,
    /// data_modifica_strutturale): quando cambia la data di modifica e come arrivano al Plugin.
    ///
    /// La data di modifica e' l'ultima importazione che ha cambiato il dato. Il confronto
    /// dell'importazione (le Alterazioni) non basta: prima di confrontare Istanta mette nel dato
    /// contesto e versione del tracciato, e la versione cambia a ogni reimportazione, quindi ogni
    /// referenza risulterebbe cambiata. Qui quelle chiavi non contano.
    public static class DateRecordTracciato
    {
        /// Le chiavi delle tre date nel dato della lista del kit. Non stanno nel Dato del database:
        /// le aggiunge lo scarico della lista, come idRec.
        public const string ChiaveDataRegistrazione = "Tracciato.DataRegistrazione";
        public const string ChiaveDataModifica = "Tracciato.DataModifica";
        public const string ChiaveDataModificaStrutturale = "Tracciato.DataModificaStrutturale";

        /// Il formato delle date per il Plugin: al minuto, come lo legge il criterio data e ora dei filtri.
        public const string FormatoPlugin = "dd/MM/yyyy HH:mm";

        /// Le chiavi che Istanta aggiunge da se' al dato di un record: non vengono dal tracciato.
        public static readonly HashSet<string> ChiaviDiIstanta = new HashSet<string>
        {
            GLOBAL_VARIABLES.keyContextPromo,
            GLOBAL_VARIABLES.keyContextTracciato,
            GLOBAL_VARIABLES_FICO.keyVersioneTracciato,
            GLOBAL_VARIABLES.keyAlterazioni,
            GLOBAL_VARIABLES.keySyncIndd,
            GLOBAL_VARIABLES.keyRefIdRec,
            ChiaveDataRegistrazione,
            ChiaveDataModifica,
            ChiaveDataModificaStrutturale,
        };

        /// Vero se il dato nuovo di un'importazione cambia quello di prima: un campo del tracciato con un
        /// valore diverso, o che prima non c'era. I campi che il dato nuovo non porta non contano: la
        /// reimportazione non li tocca.
        public static bool CambiatoDaImportazione(IDictionary<string, object>? prima, IDictionary<string, object> dopo)
        {
            if (prima == null)
            {
                return true;
            }

            foreach (var campo in dopo)
            {
                if (ChiaviDiIstanta.Contains(campo.Key))
                {
                    continue;
                }

                if (!prima.TryGetValue(campo.Key, out var valorePrima) || !Uguali(valorePrima, campo.Value))
                {
                    return true;
                }
            }

            return false;
        }

        static bool Uguali(object? a, object? b)
        {
            var tokenA = a != null ? JToken.FromObject(a) : JValue.CreateNull();
            var tokenB = b != null ? JToken.FromObject(b) : JValue.CreateNull();
            return JToken.DeepEquals(tokenA, tokenB);
        }

        /// Aggiunge al dato di un record della lista del kit le sue tre date. Un record nato prima della
        /// data di modifica ha come data di modifica quella di registrazione. Una data che manca non
        /// diventa una chiave: per i filtri del Plugin il campo non c'e', e il criterio non lo trova.
        public static void AggiungiAlDato(IDictionary<string, object> recordInTracciato, DateTime? dataRegistrazione, DateTime? dataModifica, DateTime? dataModificaStrutturale)
        {
            Aggiungi(recordInTracciato, ChiaveDataRegistrazione, dataRegistrazione);
            Aggiungi(recordInTracciato, ChiaveDataModifica, dataModifica ?? dataRegistrazione);
            Aggiungi(recordInTracciato, ChiaveDataModificaStrutturale, dataModificaStrutturale);
        }

        static void Aggiungi(IDictionary<string, object> recordInTracciato, string chiave, DateTime? data)
        {
            var valore = PerIlPlugin(data);
            if (valore != null)
            {
                recordInTracciato[chiave] = valore;
            }
        }

        /// Una data del database come la legge il Plugin: in ora italiana, al minuto. Le date sono scritte
        /// con DateTime.Now del server, cioe' nel suo fuso: nel container e' UTC, su una postazione
        /// italiana e' gia' l'ora italiana. Null resta null.
        public static string? PerIlPlugin(DateTime? data)
        {
            return PerIlPlugin(data, TimeZoneInfo.Local, FusoItaliano());
        }

        /// Come sopra, con i fusi espliciti: per i test.
        public static string? PerIlPlugin(DateTime? data, TimeZoneInfo fusoDelServer, TimeZoneInfo? fusoItaliano)
        {
            if (data == null)
            {
                return null;
            }

            var valore = DateTime.SpecifyKind(data.Value, DateTimeKind.Unspecified);
            if (fusoItaliano != null && !fusoDelServer.HasSameRules(fusoItaliano))
            {
                try
                {
                    valore = TimeZoneInfo.ConvertTime(valore, fusoDelServer, fusoItaliano);
                }
                catch (ArgumentException)
                {
                    //Ora che nel fuso del server non esiste (il salto dell'ora legale): resta com'e'.
                }
            }

            return valore.ToString(FormatoPlugin, CultureInfo.InvariantCulture);
        }

        static TimeZoneInfo? fusoItaliano;

        /// Europe/Rome, o il nome Windows se il sistema non conosce quello IANA. Senza nessuno dei due
        /// le date restano nel fuso del server.
        public static TimeZoneInfo? FusoItaliano()
        {
            if (fusoItaliano != null)
            {
                return fusoItaliano;
            }

            foreach (var id in new[] { "Europe/Rome", "W. Europe Standard Time" })
            {
                try
                {
                    fusoItaliano = TimeZoneInfo.FindSystemTimeZoneById(id);
                    return fusoItaliano;
                }
                catch (TimeZoneNotFoundException)
                {
                }
                catch (InvalidTimeZoneException)
                {
                }
            }

            return null;
        }
    }
}
