using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>Esito di una chiamata a Olimpo o Istanta: Errore e' gia' un messaggio per l'utente.</summary>
public sealed record EsitoFico<T>(bool Ok, T? Dati, string? Errore)
{
    public static EsitoFico<T> Si(T dati) => new(true, dati, null);
    public static EsitoFico<T> No(string errore) => new(false, default, errore);
}

/// <summary>Una referenza del gruppo come la vede Istanta (getSchedaRef): foto scelta, P/S, loghi.</summary>
/// <summary>
/// TUTTI I CAMPI CHE ISTANTA MANDA per ogni referenza di un gruppo (getSchedaRef, dentro
/// records[].recordInTracciato). Letti sui dati veri di Demo il 29/09 e scritti qui perche' la
/// prossima volta che serve un campo si trovi subito, invece di rifare il giro: la chiamata vuole
/// PUT e non POST, e cercarlo a tentativi costa due tentativi buttati.
///
/// Context.Promo · Context.Tracciato · Descrizioni.Descrizione1 · Descrizioni.Descrizione1Tracciato
/// Descrizioni.Descrizione2 · Descrizioni.Descrizione2Tracciato · Descrizioni.Descrizione3
/// Descrizioni.Descrizione3Tracciato · Descrizioni.Descrizione4 · Descrizioni.Descrizione4Tracciato
/// Descrizioni.Peso · Descrizioni.Um · FirmaRevisione · Foto.Extra · Foto.ExtraAuto · Foto.Hash
/// Foto.Id · Foto.Nome · Foto.guidid · HasFoto · IndiceOrdinamento · Kit.Names · Referenza
/// Referenza.Codice · Scatto.CodiceGruppo · Scatto.CodiceSottogruppo · StatoSelezione
/// Tracciato.Firma · Tracciato.Label · Tracciato.Versione · Tracciato.Xlsx · allEtichette
/// anno_evento · azione_pubblico · canale · categoria · cessione_offerta · codiceBox
/// codice_categoria · codice_evento · codice_reparto · codice_segmento · codice_settore
/// combinazioneAssegnata · combinazioneMeccanica · compiledFields · deletedFields
/// descrizione_canale · descrizione_custom · descrizione_regionale · diff · etichetteVisual
/// fine_promo · foto_canale · foto_regionale · idRec · inizio_promo · is_linea
/// meccanica_invalidata · membriGruppoFoto · nome_depliant · nome_evento · note · omnibus
/// omnibus_as400 · prezzo_continuo · prezzo_partenza · prezzo_promo · prezzo_promo_kgl
/// punti_jolly · reparto · segmento · settore · tipo_offerta · um_rp
///
/// Di questi se ne tengono pochi, quelli che servono: gli altri si aggiungono una riga per volta.
/// Non si tiene un contenitore per tutti, perche' la scheda non si salva - si richiede a Istanta
/// ogni volta - quindi non si perde niente per sempre.
/// </summary>
public sealed class FotoIstanta
{
    public string Codice { get; set; } = "";
    public string Descrizione { get; set; } = "";
    /// <summary>1 primaria, 2 secondaria, altro = non selezionata.</summary>
    public int StatoSelezione { get; set; }
    public string GuidFoto { get; set; } = "";
    public string NomeFoto { get; set; } = "";
    /// <summary>
    /// Il peso della referenza, come lo manda Istanta (Descrizioni.Peso: "0.22"). E' l'informazione
    /// che distingue una referenza dall'altra dentro un gruppo, dove descrizione, foto e prezzo del
    /// box sono uno solo (Michele, 29/09).
    /// </summary>
    public string Peso { get; set; } = "";
    /// <summary>L'unita' di misura del peso (Descrizioni.Um: "KG").</summary>
    public string Um { get; set; } = "";
    /// <summary>Il prezzo promo della singola referenza (prezzo_promo: "2.32").</summary>
    public string PrezzoPromo { get; set; } = "";
    /* LA MECCANICA della referenza (Michele, 29/09: «mettiamo anche la meccanica applicata per
       quella referenza, ad esempio BOX_STD o BOX_FID»). Istanta ne manda quattro che potrebbero
       essere quella giusta e si tengono tutte: sono stringhe, non costano niente, e la scheda non
       si salva - si richiede ogni volta - quindi non c'e' nessun dato da migrare.
       Quale delle quattro si fa vedere all'utente lo dice il collaudo di j299, che stampa i valori
       veri di un volantino vero. */
    public string CombinazioneAssegnata { get; set; } = "";
    public string CombinazioneMeccanica { get; set; } = "";
    public string MeccanicaInvalidata { get; set; } = "";
    public string TipoOfferta { get; set; } = "";
    public List<LogoIstanta> Loghi { get; set; } = new();
}

/// <summary>Logo o bollo: del catalogo (getAllFotoExtra) o presente sul prodotto (Foto.Extra / Foto.ExtraAuto).</summary>
public sealed class LogoIstanta
{
    public string GuidId { get; set; } = "";
    public string Sigla { get; set; } = "";
    public string Nome { get; set; } = "";
    public int Tipo { get; set; }
    /// <summary>Messo in automatico dalle regole del cliente (ExtraAuto).</summary>
    public bool Automatico { get; set; }
}

public sealed class FotoDelCodice
{
    public string GuidId { get; set; } = "";
    public string Nome { get; set; } = "";
}

/// <summary>
/// Una voce della correzione foto e loghi, nel formato dell'originale
/// (IService.cs EditAvanzato_RecordFotoESelezioneModifica) e di Istanta
/// (IstantaCore.cs ModificaFotoESelezioneCorreggoRequest.foto).
/// stato: 1 primaria, 2 secondaria, 3 non selezionata, 4 logo da aggiungere, 5 logo da togliere.
/// </summary>
public sealed class VoceFoto
{
    public string guidid { get; set; } = "";
    public string codice { get; set; } = "";
    public string nomeFile { get; set; } = "";
    public string md5 { get; set; } = "";
    public int stato { get; set; }
}

/// <summary>
/// Il dialogo con Olimpo e Istanta per il passo 2 dell'Edit avanzato (11/9/2026), come il Correggo
/// originale (App_Code/FicoMiddleware.cs, Service.cs askFotoDellaRefAIstanta, getAllFotoByCodiceFromIstanta,
/// askFotoExtraStore, confermaCorrezioneFieldsDellaRef):
///   1. passaporto: PUT {Olimpo}/auth/getPassport con header fico-secret, a nome dell'utente collegato;
///   2. con la publicKey come Bearer, le rotte /FicoProcess/ di Istanta.
/// Configurazione: Fico:OlimpoUrl, Fico:IstantaUrl (appsettings) e Fico:Secret (variabile d'ambiente
/// Fico__Secret, file /etc/istanta4-correggo4.env: il segreto non sta in appsettings).
/// </summary>
public sealed class ClienteFico
{
    private static readonly ConcurrentDictionary<string, (string Chiave, DateTime Scade)> Passaporti = new();
    private static (List<LogoIstanta> Lista, DateTime Scade)? catalogo;

    private readonly IHttpClientFactory http;
    private readonly IConfiguration config;
    private readonly Correggo4Context ctx;
    private readonly ILogger<ClienteFico> log;

    public ClienteFico(IHttpClientFactory http, IConfiguration config, Correggo4Context ctx, ILogger<ClienteFico> log)
    {
        this.http = http; this.config = config; this.ctx = ctx; this.log = log;
    }

    private string OlimpoUrl => (config["Fico:OlimpoUrl"] ?? "http://127.0.0.1:3005/olimpo").TrimEnd('/');
    private string IstantaUrl => (config["Fico:IstantaUrl"] ?? "http://127.0.0.1:5076").TrimEnd('/');
    private HttpClient Client() => http.CreateClient("fico");

    // ------------------------------------------------------------------ passaporto

    private async Task<EsitoFico<string>> PassaportoAsync(short idUtente, bool rinnova = false)
    {
        var u = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == idUtente);
        if (u == null) return EsitoFico<string>.No("Utente non trovato.");
        if (!rinnova && Passaporti.TryGetValue(u.Email, out var p) && p.Scade > DateTime.UtcNow)
            return EsitoFico<string>.Si(p.Chiave);

        string? segreto = config["Fico:Secret"];
        if (string.IsNullOrWhiteSpace(segreto))
            return EsitoFico<string>.No("Il collegamento con Istanta non è configurato.");

        // FicoUserType: 2 Agenzia, 4 GDO (FicoMiddleware.cs:33). Origine "CO" = Correggo.
        var corpo = new
        {
            username = u.Email,
            tipoUtente = u.Ruolo == Ruoli.CodiceAgenzia ? 2 : 4,
            origin = "CO",
            campi_aggiuntivi = new Dictionary<string, string> { ["nome"] = u.Nome, ["cognome"] = u.Cognome }
        };
        using var req = new HttpRequestMessage(HttpMethod.Put, OlimpoUrl + "/auth/getPassport")
        {
            Content = JsonContent.Create(corpo)
        };
        req.Headers.Add("fico-secret", segreto);
        try
        {
            using var r = await Client().SendAsync(req);
            string t = await r.Content.ReadAsStringAsync();
            using var d = JsonDocument.Parse(t);
            if (d.RootElement.TryGetProperty("esito", out var es) && es.ValueKind == JsonValueKind.True
                && d.RootElement.TryGetProperty("publicKey", out var pk) && pk.GetString() is { Length: > 0 } chiave)
            {
                Passaporti[u.Email] = (chiave, DateTime.UtcNow.AddMinutes(20));
                return EsitoFico<string>.Si(chiave);
            }
            log.LogWarning("getPassport rifiutato per {Utente}: HTTP {Http} {Testo}", u.Email, (int)r.StatusCode, Taglia(t));
            return EsitoFico<string>.No("Olimpo non ha concesso l'accesso a Istanta.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogWarning(ex, "getPassport non riuscito per {Utente}", u.Email);
            return EsitoFico<string>.No("Olimpo non risponde.");
        }
    }

    /// <summary>Chiamata a Istanta col Bearer; un 401 rinnova il passaporto e riprova una volta.</summary>
    private async Task<EsitoFico<string>> IstantaAsync(short idUtente, HttpMethod metodo, string percorso, object? corpo = null)
    {
        for (int tentativo = 0; tentativo < 2; tentativo++)
        {
            var pass = await PassaportoAsync(idUtente, rinnova: tentativo > 0);
            if (!pass.Ok) return EsitoFico<string>.No(pass.Errore!);

            using var req = new HttpRequestMessage(metodo, IstantaUrl + percorso);
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", pass.Dati);
            if (corpo != null) req.Content = JsonContent.Create(corpo);
            try
            {
                using var r = await Client().SendAsync(req);
                string t = await r.Content.ReadAsStringAsync();
                if (r.StatusCode == HttpStatusCode.Unauthorized && tentativo == 0) continue;
                if (!r.IsSuccessStatusCode)
                {
                    log.LogWarning("Istanta {Percorso}: HTTP {Http} {Testo}", percorso, (int)r.StatusCode, Taglia(t));
                    return EsitoFico<string>.No(ErroreIstanta(t) ?? $"Istanta ha risposto con un errore ({(int)r.StatusCode}).");
                }
                return EsitoFico<string>.Si(t);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                log.LogWarning(ex, "Istanta {Percorso} non raggiungibile", percorso);
                return EsitoFico<string>.No("Istanta non risponde.");
            }
        }
        return EsitoFico<string>.No("Istanta non accetta l'accesso.");
    }

    // ------------------------------------------------------------------ letture

    /// <summary>FicoProcess/getSchedaRef: le referenze del gruppo con foto, P/S e loghi.</summary>
    public async Task<EsitoFico<List<FotoIstanta>>> SchedaAsync(short idUtente, Guid? guidLavorazione, string codiceGruppo)
    {
        if (guidLavorazione == null)
            return EsitoFico<List<FotoIstanta>>.No("Il volantino non è collegato a una lavorazione di Istanta.");
        var r = await IstantaAsync(idUtente, HttpMethod.Put, "/FicoProcess/getSchedaRef",
                                   new { guidIdLavorazione = guidLavorazione.Value.ToString(), codiceGruppo });
        if (!r.Ok) return EsitoFico<List<FotoIstanta>>.No(r.Errore!);
        try
        {
            using var d = JsonDocument.Parse(r.Dati!);
            var rad = d.RootElement;
            if (!(rad.TryGetProperty("esito", out var es) && es.ValueKind == JsonValueKind.True))
                return EsitoFico<List<FotoIstanta>>.No("Istanta non trova il prodotto: " + Testo(rad, "error"));
            var lista = new List<FotoIstanta>();
            if (rad.TryGetProperty("records", out var recs) && recs.ValueKind == JsonValueKind.Array)
            {
                foreach (var rec in recs.EnumerateArray())
                {
                    if (!rec.TryGetProperty("recordInTracciato", out var rt) || rt.ValueKind != JsonValueKind.Object) continue;
                    var f = new FotoIstanta
                    {
                        Codice = Testo(rt, "Referenza.Codice"),
                        Descrizione = Testo(rt, "Descrizioni.Descrizione1"),
                        StatoSelezione = Intero(rt, "StatoSelezione"),
                        GuidFoto = Testo(rt, "Foto.guidid"),
                        NomeFoto = Testo(rt, "Foto.Nome"),
                        Peso = Testo(rt, "Descrizioni.Peso"),
                        Um = Testo(rt, "Descrizioni.Um"),
                        PrezzoPromo = Testo(rt, "prezzo_promo"),
                        CombinazioneAssegnata = Testo(rt, "combinazioneAssegnata"),
                        CombinazioneMeccanica = Testo(rt, "combinazioneMeccanica"),
                        MeccanicaInvalidata = Testo(rt, "meccanica_invalidata"),
                        TipoOfferta = Testo(rt, "tipo_offerta")
                    };
                    if (f.Codice == "") continue;
                    // Foto.Extra: LogoBollo_ExtraNoAuto (FicoTypes.cs:441); Foto.ExtraAuto: LogoBollo con "escluso".
                    if (rt.TryGetProperty("Foto.Extra", out var ex) && ex.ValueKind == JsonValueKind.Array)
                        foreach (var e in ex.EnumerateArray())
                            if (!(e.TryGetProperty("attiva", out var at) && at.ValueKind == JsonValueKind.False))
                                f.Loghi.Add(Logo(e, automatico: false));
                    if (rt.TryGetProperty("Foto.ExtraAuto", out var ea) && ea.ValueKind == JsonValueKind.Array)
                        foreach (var e in ea.EnumerateArray())
                            if (!(e.TryGetProperty("escluso", out var esc) && esc.ValueKind == JsonValueKind.True))
                                f.Loghi.Add(Logo(e, automatico: true));
                    f.Loghi = f.Loghi.Where(l => l.GuidId != "").GroupBy(l => l.GuidId).Select(g => g.First()).ToList();
                    lista.Add(f);
                }
            }
            return EsitoFico<List<FotoIstanta>>.Si(lista);
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException)
        {
            log.LogWarning(ex, "getSchedaRef: risposta non leggibile");
            return EsitoFico<List<FotoIstanta>>.No("Istanta ha risposto in un formato inatteso.");
        }
    }

    /// <summary>FicoProcess/getAllFotoByCodice: tutte le foto di un codice, dalla piu' recente.</summary>
    public async Task<EsitoFico<List<FotoDelCodice>>> FotoDelCodiceAsync(short idUtente, string codice)
    {
        var r = await IstantaAsync(idUtente, HttpMethod.Get, "/FicoProcess/getAllFotoByCodice/" + Uri.EscapeDataString(codice));
        if (!r.Ok) return EsitoFico<List<FotoDelCodice>>.No(r.Errore!);
        try
        {
            using var d = JsonDocument.Parse(r.Dati!);
            string err = Testo(d.RootElement, "error");
            if (err != "") return EsitoFico<List<FotoDelCodice>>.No("Istanta: " + err);
            string interno = Testo(d.RootElement, "result");   // e' una stringa JSON dentro il JSON
            var lista = new List<FotoDelCodice>();
            if (interno.TrimStart().StartsWith('['))
            {
                using var d2 = JsonDocument.Parse(interno);
                foreach (var f in d2.RootElement.EnumerateArray())
                {
                    string g = Testo(f, "GuidId");
                    if (g != "") lista.Add(new FotoDelCodice { GuidId = g, Nome = Testo(f, "Nome") });
                }
            }
            return EsitoFico<List<FotoDelCodice>>.Si(lista);
        }
        catch (JsonException ex)
        {
            log.LogWarning(ex, "getAllFotoByCodice: risposta non leggibile");
            return EsitoFico<List<FotoDelCodice>>.No("Istanta ha risposto in un formato inatteso.");
        }
    }

    /// <summary>FicoProcess/getAllFotoExtra/3: catalogo di loghi e bolli (tenuto 5 minuti in memoria).</summary>
    public async Task<EsitoFico<List<LogoIstanta>>> CatalogoLoghiAsync(short idUtente)
    {
        var c = catalogo;
        if (c != null && c.Value.Scade > DateTime.UtcNow) return EsitoFico<List<LogoIstanta>>.Si(c.Value.Lista);
        var r = await IstantaAsync(idUtente, HttpMethod.Get, "/FicoProcess/getAllFotoExtra/3");
        if (!r.Ok) return EsitoFico<List<LogoIstanta>>.No(r.Errore!);
        try
        {
            using var d = JsonDocument.Parse(r.Dati!);
            var lista = new List<LogoIstanta>();
            if (d.RootElement.TryGetProperty("list", out var l) && l.ValueKind == JsonValueKind.Array)
                foreach (var e in l.EnumerateArray())
                    if (!(e.TryGetProperty("escluso", out var es) && es.ValueKind == JsonValueKind.True))
                        lista.Add(Logo(e, automatico: false));
            lista = lista.Where(x => x.GuidId != "").OrderBy(x => x.Sigla, StringComparer.OrdinalIgnoreCase).ToList();
            catalogo = (lista, DateTime.UtcNow.AddMinutes(5));
            return EsitoFico<List<LogoIstanta>>.Si(lista);
        }
        catch (JsonException ex)
        {
            log.LogWarning(ex, "getAllFotoExtra: risposta non leggibile");
            return EsitoFico<List<LogoIstanta>>.No("Istanta ha risposto in un formato inatteso.");
        }
    }

    /// <summary>Miniatura da Olimpo (rotte /foto pubbliche, lette dal server: il browser non deve vedere Olimpo).</summary>
    public async Task<(byte[]? Dati, string Tipo)> MiniaturaAsync(Guid guid, int larghezza, int altezza)
    {
        string url = $"{OlimpoUrl}/foto/getThumbNailOnDemand?guidId={guid}&width={larghezza}&height={altezza}";
        try
        {
            using var r = await Client().GetAsync(url);
            if (!r.IsSuccessStatusCode) return (null, "");
            return (await r.Content.ReadAsByteArrayAsync(), r.Content.Headers.ContentType?.MediaType ?? "image/jpeg");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(ex, "Miniatura {Guid} non disponibile", guid);
            return (null, "");
        }
    }

    // ------------------------------------------------------------------ caricamento foto

    /// <summary>
    /// Olimpo POST /foto/uploadFoto, come UploadFotoByCodice.ashx dell'originale: parte "file" col file e
    /// parte "json_meta_foto" col meta {Id:"0", FileHash, FileName, IdRef:"", Size:0}. Olimpo risponde
    /// {record:{Id,...}}: Id e' il guid della foto in archivio. Attenzione: se FileName non coincide col
    /// nome del file caricato, Olimpo butta via il file e lascia Id a "0" (app.controller.ts:271-330).
    /// Il caricamento puo' durare: client dedicato con timeout lungo, non i 30 secondi degli altri.
    /// </summary>
    public async Task<EsitoFico<(string GuidId, string Md5)>> CaricaFotoAsync(string nomeFile, string md5, Stream contenuto, string tipo)
    {
        string meta = JsonSerializer.Serialize(new { Id = "0", FileHash = md5, FileName = nomeFile, IdRef = "", Size = 0 });
        using var form = new MultipartFormDataContent();
        var parteFile = new StreamContent(contenuto);
        parteFile.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
            string.IsNullOrWhiteSpace(tipo) ? "application/octet-stream" : tipo);
        form.Add(parteFile, "file", nomeFile);
        form.Add(new StringContent(meta, System.Text.Encoding.UTF8, "application/json"), "json_meta_foto");
        try
        {
            using var c = http.CreateClient("fico");
            c.Timeout = TimeSpan.FromMinutes(20);
            using var r = await c.PostAsync(OlimpoUrl + "/foto/uploadFoto", form);
            string t = await r.Content.ReadAsStringAsync();
            if (!r.IsSuccessStatusCode)
            {
                log.LogWarning("uploadFoto {Nome}: HTTP {Http} {Testo}", nomeFile, (int)r.StatusCode, Taglia(t));
                return EsitoFico<(string, string)>.No("Olimpo non ha accettato la foto.");
            }
            using var d = JsonDocument.Parse(t);
            string err = Testo(d.RootElement, "error");
            if (err != "") return EsitoFico<(string, string)>.No("Olimpo: " + err);
            string guid = "", hash = "";
            if (d.RootElement.TryGetProperty("record", out var rec) && rec.ValueKind == JsonValueKind.Object)
            {
                guid = Testo(rec, "Id");
                hash = Testo(rec, "FileHash");
            }
            if (guid == "" || guid == "0")
            {
                log.LogWarning("uploadFoto {Nome}: Olimpo non ha restituito un guid ({Testo})", nomeFile, Taglia(t));
                return EsitoFico<(string, string)>.No("Olimpo non ha salvato la foto: forse il formato non è accettato.");
            }
            return EsitoFico<(string, string)>.Si((guid, hash == "" ? md5 : hash));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogWarning(ex, "uploadFoto {Nome} non riuscito", nomeFile);
            return EsitoFico<(string, string)>.No("Olimpo non risponde: la foto non è stata caricata.");
        }
    }

    // ------------------------------------------------------------------ scrittura

    /// <summary>
    /// FicoProcess/correggiFotoESelezioniFromCorreggo alla conferma dell'Agenzia (Service.cs:2667-2720).
    /// Istanta applica solo il cambio di foto; P/S e loghi li ignora (FicoProcessController ~5709,
    /// "andrebbe implementata"): decisione dell'11/9, come l'originale.
    /// </summary>
    public async Task<EsitoFico<bool>> CorreggiFotoAsync(short idUtente, Guid? guidLavorazione, string codiceGruppo, List<VoceFoto> foto)
    {
        if (guidLavorazione == null)
            return EsitoFico<bool>.No("Il volantino non è collegato a una lavorazione di Istanta.");
        var r = await IstantaAsync(idUtente, HttpMethod.Put, "/FicoProcess/correggiFotoESelezioniFromCorreggo",
                                   new { guidIdLavorazione = guidLavorazione.Value.ToString(), codice = codiceGruppo, foto });
        if (!r.Ok) return EsitoFico<bool>.No(r.Errore!);
        try
        {
            using var d = JsonDocument.Parse(r.Dati!);
            string err = Testo(d.RootElement, "error");
            bool esito = d.RootElement.TryGetProperty("esito", out var es) && es.ValueKind == JsonValueKind.True;
            if (err != "" || !esito) return EsitoFico<bool>.No(err != "" ? err : "Istanta non ha confermato la modifica.");
            return EsitoFico<bool>.Si(true);
        }
        catch (JsonException)
        {
            return EsitoFico<bool>.No("Istanta ha risposto in un formato inatteso.");
        }
    }

    // ------------------------------------------------------------------ appoggio

    private static LogoIstanta Logo(JsonElement e, bool automatico) => new()
    {
        GuidId = Testo(e, "guidId"),
        Sigla = Testo(e, "sigla"),
        Nome = Testo(e, "nome"),
        Tipo = Intero(e, "tipo"),
        Automatico = automatico
    };

    private static string Testo(JsonElement e, string nome) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(nome, out var v)
            ? v.ValueKind switch
            {
                JsonValueKind.String => v.GetString() ?? "",
                JsonValueKind.Null or JsonValueKind.Undefined => "",
                _ => v.GetRawText()
            }
            : "";

    private static int Intero(JsonElement e, string nome) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(nome, out var v)
            ? (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out int n) ? n
               : int.TryParse(v.ValueKind == JsonValueKind.String ? v.GetString() : "", out int m) ? m : 0)
            : 0;

    private static string? ErroreIstanta(string t)
    {
        try
        {
            using var d = JsonDocument.Parse(t);
            string e = Testo(d.RootElement, "error");
            return e == "" ? null : "Istanta: " + e;
        }
        catch (JsonException) { return null; }
    }

    private static string Taglia(string s) => s.Length > 300 ? s[..300] + "…" : s;
}
