using System.Globalization;
using Istanta.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Istanta.Handlers
{
    /// <summary>
    /// Il limite di dimensione dei file di LoghiBolli/salva. Prima non ce n'era uno esplicito e in
    /// Release valeva quello predefinito di Kestrel (30.000.000 byte, circa 28,6 MB): Program.cs lo
    /// alza solo in DEBUG. Lo stesso limite lo controlla anche la pagina (loghibolli.js,
    /// DIMENSIONE_MASSIMA_BYTE), che deve restare allineata.
    /// </summary>
    public static class LimiteLoghiBolli
    {
        /// 50 MB per il file.
        public const long DimensioneMassimaFileByte = 50L * 1024 * 1024;

        /// La richiesta porta anche sigla, tipo, id e i separatori del multipart: un margine di 1 MB
        /// fa arrivare all'azione un file appena oltre i 50 MB, dove validaLogoBollo lo ferma col
        /// suo messaggio, invece di rifiutare la richiesta per pochi byte di intestazioni.
        public const long DimensioneMassimaRichiestaByte = DimensioneMassimaFileByte + 1024 * 1024;

        /// Il codice che il client riconosce, nella risposta 413 come in quella 200 con esito negativo.
        public const string CodiceFileTroppoGrande = "FILE_TROPPO_GRANDE";

        private static readonly CultureInfo italiano = CultureInfo.GetCultureInfo("it-IT");

        public static bool Supera(long byteFile) => byteFile > DimensioneMassimaFileByte;

        /// Il peso in MB con un decimale, come lo scrive la pagina: 63,2 MB.
        public static string InMegabyte(long byteFile) =>
            (byteFile / (1024d * 1024d)).ToString("0.0", italiano) + " MB";

        public static string Messaggio(string? nomeFile, long byteFile)
        {
            string chi = string.IsNullOrEmpty(nomeFile) ? "Il file" : $"Il file \"{nomeFile}\"";
            return $"{chi} pesa {InMegabyte(byteFile)}: il limite per loghi e bolli e' {DimensioneMassimaFileByte / (1024 * 1024)} MB.";
        }

        /// Senza il nome del file: la richiesta e' stata fermata prima di leggerla, il nome non si sa.
        public static string MessaggioRichiesta(long byteRichiesta) =>
            $"Il file caricato e' troppo grande ({InMegabyte(byteRichiesta)}): il limite per loghi e bolli e' {DimensioneMassimaFileByte / (1024 * 1024)} MB.";

        public static LogoBolloOperationResult Rifiuto(string messaggio) => new LogoBolloOperationResult
        {
            esito = false,
            error = messaggio,
            codice = CodiceFileTroppoGrande,
            limiteByte = DimensioneMassimaFileByte,
        };
    }

    /// <summary>
    /// Applica a un'azione il limite di LimiteLoghiBolli. E' un filtro di risorsa perche' deve
    /// agire prima del model binding, che e' quello che legge il corpo della richiesta:
    /// - fissa il limite della sola richiesta, al posto di quello predefinito di Kestrel;
    /// - se la richiesta dichiara gia' un Content-Length oltre il limite, risponde subito 413 con lo
    ///   stesso JSON di LoghiBolli/salva (esito, error, codice, limiteByte). Senza, Kestrel
    ///   solleverebbe l'eccezione durante il binding e la pagina avrebbe solo un errore generico.
    /// Una richiesta senza Content-Length (in streaming) resta comunque fermata dal limite, ma con la
    /// risposta generica del server: i browser lo dichiarano sempre.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public class LimiteLoghiBolliAttribute : Attribute, IResourceFilter
    {
        public void OnResourceExecuting(ResourceExecutingContext context)
        {
            var http = context.HttpContext;

            var limite = http.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limite != null && !limite.IsReadOnly)
                limite.MaxRequestBodySize = LimiteLoghiBolli.DimensioneMassimaRichiestaByte;

            long? dichiarato = http.Request.ContentLength;
            if (dichiarato.HasValue && dichiarato.Value > LimiteLoghiBolli.DimensioneMassimaRichiestaByte)
            {
                context.Result = new ObjectResult(LimiteLoghiBolli.Rifiuto(LimiteLoghiBolli.MessaggioRichiesta(dichiarato.Value)))
                {
                    StatusCode = StatusCodes.Status413PayloadTooLarge,
                };
            }
        }

        public void OnResourceExecuted(ResourceExecutedContext context) { }
    }
}
