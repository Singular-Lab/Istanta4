using System;
using System.Globalization;
using Newtonsoft.Json.Linq;

namespace Istanta.Models
{
    /// <summary>
    /// TASK-13e871a5: i numeri di Istanta (regole delle etichette e dei box, importazione dei tracciati,
    /// espressioni, misure) letti allo stesso modo qualunque sia la cultura del thread. Le esportazioni di AgenziaLib
    /// lasciano it-IT sul thread, e double.TryParse nella cultura corrente leggeva il peso "0.25"
    /// come 25: le confezioni di frutta secca da 250 g prendevano l'etichetta PESO>1 di Edro21 e
    /// uscivano con il prezzo al kg in grande (ofalkg).
    /// </summary>
    public static class NumeroDiRegola
    {
        /// <summary>
        /// Il numero contenuto nel valore. Un numero vero si usa com'e'; un JValue per il suo
        /// contenuto; un testo con un solo tipo di separatore lo prende come decimale ("0,25" e
        /// "0.25" sono 0,25), con tutti e due l'ultimo e' il decimale e gli altri sono migliaia
        /// ("1.234,5" e "1,234.5" sono 1234,5). Vuoto, null o non numerico: false.
        /// </summary>
        public static bool TryLeggi(object? valore, out double numero)
        {
            numero = 0;
            switch (valore)
            {
                case null:
                case bool:
                    return false;
                case JValue jValue:
                    return TryLeggi(jValue.Value, out numero);
                case double d:
                    numero = d;
                    return !double.IsNaN(d);
                case float f:
                    numero = f;
                    return !float.IsNaN(f);
                case decimal m:
                    numero = (double)m;
                    return true;
                case int or long or short or byte or uint or ulong or ushort or sbyte:
                    numero = Convert.ToDouble(valore, CultureInfo.InvariantCulture);
                    return true;
            }

            string? testo = TestoNormalizzato(valore);
            return testo != null && double.TryParse(testo, NumberStyles.Float, CultureInfo.InvariantCulture, out numero);
        }

        /// <summary>Come TryLeggi, in decimale: prezzi e pesi senza gli arrotondamenti del double.</summary>
        public static bool TryLeggiDecimale(object? valore, out decimal numero)
        {
            numero = 0;
            switch (valore)
            {
                case null:
                case bool:
                    return false;
                case JValue jValue:
                    return TryLeggiDecimale(jValue.Value, out numero);
                case decimal m:
                    numero = m;
                    return true;
                case double or float or int or long or short or byte or uint or ulong or ushort or sbyte:
                    if (!TryLeggi(valore, out double d) || double.IsInfinity(d))
                    {
                        return false;
                    }
                    numero = Convert.ToDecimal(valore, CultureInfo.InvariantCulture);
                    return true;
            }

            string? testo = TestoNormalizzato(valore);
            return testo != null && decimal.TryParse(testo, NumberStyles.Float, CultureInfo.InvariantCulture, out numero);
        }

        /// <summary>
        /// Al posto di double.Parse e Convert.ToDouble: il numero letto da TryLeggi; se il valore non
        /// e' un numero, la conversione di prima, che lancia come prima.
        /// </summary>
        public static double ComeDouble(object? valore)
        {
            return TryLeggi(valore, out double numero) ? numero : Convert.ToDouble(valore, CultureInfo.InvariantCulture);
        }

        /// <summary>Al posto di decimal.Parse e Convert.ToDecimal, come ComeDouble.</summary>
        public static decimal ComeDecimale(object? valore)
        {
            return TryLeggiDecimale(valore, out decimal numero) ? numero : Convert.ToDecimal(valore, CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Il testo pronto per la lettura invariante: un solo separatore e' il decimale, con tutti e due
        /// l'ultimo e' il decimale e l'altro separa le migliaia. Null se e' vuoto.
        /// </summary>
        private static string? TestoNormalizzato(object valore)
        {
            string testo = (Convert.ToString(valore, CultureInfo.InvariantCulture) ?? "").Trim();
            if (testo == "")
            {
                return null;
            }

            int virgola = testo.LastIndexOf(',');
            int punto = testo.LastIndexOf('.');
            if (virgola >= 0 && punto >= 0)
            {
                char migliaia = virgola > punto ? '.' : ',';
                testo = testo.Replace(migliaia.ToString(), "");
            }
            return testo.Replace(',', '.');
        }
    }
}
