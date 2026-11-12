using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Istanta.Utility
{
    /// I20-1221: la risposta di Istanta al Report Correggo del Plugin. Esito falso con error e codice
    /// quando Correggo4 non e' configurato, non risponde o rifiuta; dati e' quello che restituisce Correggo4.
    public sealed class RispostaCorreggo4
    {
        public bool esito { get; set; }
        public string error { get; set; } = "";
        public string codice { get; set; } = "";
        public JToken? dati { get; set; }

        public static RispostaCorreggo4 No(string codice, string error) => new RispostaCorreggo4 { esito = false, codice = codice, error = error };
    }

    /// I20-1221: Istanta chiama Correggo4 per il Report Correggo del Plugin, con il Bearer di Olimpo
    /// dell'operatore (il passaporto che Istanta chiede per lui). Correggo4 risponde
    /// { ok, codice, messaggio, dati } (PluginCorrezioniController):
    ///   GET  {correggo4}/Plugin/Correzioni/{idLavorazione}
    ///   POST {correggo4}/Plugin/Correzioni/{idLavorazione}/Chiudi  { approvate: [...] }
    /// L'indirizzo e' fico:correggoServerUrl, lo stesso con cui Istanta apre Correggo all'operatore.
    public sealed class ClienteCorreggo4
    {
        private readonly HttpClient http;
        private readonly string indirizzo;

        public ClienteCorreggo4(HttpClient http, string? indirizzo)
        {
            this.http = http;
            this.indirizzo = (indirizzo ?? "").Trim().TrimEnd('/');
        }

        public Task<RispostaCorreggo4> CorrezioniAsync(int idLavorazione, string bearer) =>
            ChiamaAsync(HttpMethod.Get, $"/Plugin/Correzioni/{idLavorazione}", null, bearer);

        public Task<RispostaCorreggo4> ChiudiAsync(int idLavorazione, IEnumerable<string>? approvate, string bearer) =>
            ChiamaAsync(HttpMethod.Post, $"/Plugin/Correzioni/{idLavorazione}/Chiudi",
                        new { approvate = (approvate ?? Enumerable.Empty<string>()).ToList() }, bearer);

        private async Task<RispostaCorreggo4> ChiamaAsync(HttpMethod metodo, string percorso, object? corpo, string bearer)
        {
            if (indirizzo == "")
                return RispostaCorreggo4.No("correggo4_non_configurato",
                    "Istanta non conosce l'indirizzo di Correggo4: manca fico:correggoServerUrl nella configurazione.");

            string url = indirizzo + percorso;
            string testo;
            int stato;
            try
            {
                using var req = new HttpRequestMessage(metodo, url);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
                if (corpo != null)
                    req.Content = new StringContent(JsonConvert.SerializeObject(corpo), Encoding.UTF8, "application/json");
                using var r = await http.SendAsync(req);
                stato = (int)r.StatusCode;
                testo = await r.Content.ReadAsStringAsync();
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                return RispostaCorreggo4.No("correggo4_non_risponde", $"Correggo4 non risponde ({url}): {ex.Message}");
            }

            JObject? json;
            try
            {
                json = JsonConvert.DeserializeObject<JObject>(testo);
            }
            catch (JsonException)
            {
                json = null;
            }
            if (json == null || json["ok"]?.Type != JTokenType.Boolean)
                return RispostaCorreggo4.No("risposta_inattesa",
                    $"Correggo4 ha risposto in un formato inatteso (HTTP {stato}) a {percorso}.");

            if (!json.Value<bool>("ok"))
                return RispostaCorreggo4.No(json.Value<string>("codice") ?? "",
                    "Correggo4: " + (json.Value<string>("messaggio") ?? $"richiesta rifiutata (HTTP {stato})."));

            return new RispostaCorreggo4 { esito = true, dati = json["dati"] };
        }
    }
}
