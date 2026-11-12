using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1221: il Report Correggo del Plugin. Istanta chiama Correggo4 per conto dell'operatore, con il suo
/// Bearer di Olimpo: Plugin/Correzioni/{idLavorazione} restituisce le correzioni aperte dell'ultima
/// versione del volantino della lavorazione, Plugin/Correzioni/{idLavorazione}/Chiudi chiude quelle che il
/// Plugin ha approvato e applicato. Le altre restano come sono. Olimpo e' finto, il database in memoria.
/// </summary>
public class CorrezioniPluginTests
{
    private const int Lavorazione = 3242;
    private const string TokenAgenzia = "token-agenzia";
    private const string TokenCategory = "token-category";
    private const string EmailCategory = "category@prova.local";

    // ------------------------------------------------------------------ allestimento

    private static FabbricaCorreggo App(List<string>? chiamate = null)
    {
        var app = new FabbricaCorreggo();
        app.OlimpoFinto = req =>
        {
            chiamate?.Add(req.RequestUri!.AbsolutePath);
            if (req.RequestUri!.AbsolutePath != "/olimpo/auth/checkIdentity")
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            string? username = req.Headers.Authorization?.Parameter switch
            {
                TokenAgenzia => "agenzia@prova.local",
                TokenCategory => EmailCategory,
                _ => null
            };
            if (username == null) return new HttpResponseMessage(HttpStatusCode.Unauthorized);
            string json = JsonSerializer.Serialize(new { origin = "PL", username, autorizzato = true });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        };
        return app;
    }

    private sealed record Volantino(int Id, long Box, long Box2, long Nota, long NotaAccettata, long Promemoria,
                                    long NotaVecchiaVersione, long Timbro, long NotaRecente);

    /// <summary>
    /// Un volantino agganciato alla lavorazione, con due versioni. Sull'ultima: un box con una nota di un
    /// Category, una gia' accettata, un promemoria, un timbro Al kg e le due parti dell'Edit avanzato; un
    /// secondo box con una nota appena scritta. Sulla versione 1 una nota rimasta aperta.
    /// </summary>
    private static async Task<Volantino> VolantinoAsync(FabbricaCorreggo app, int? lavorazione = Lavorazione)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;

        var category = new Utenti
        {
            Nome = "Carla", Cognome = "Category", Email = EmailCategory, Username = EmailCategory,
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = ServizioCorrezioni.TipoFicoCategory, Attivo = true, DataInserimento = oggi
        };
        var marketing = new Utenti
        {
            Nome = "Mario", Cognome = "Marketing", Email = "marketing@prova.local", Username = "marketing@prova.local",
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = ServizioCorrezioni.TipoFicoMarketing, Attivo = true, DataInserimento = oggi
        };
        ctx.Utentis.AddRange(category, marketing);

        var vol = new Volantini
        {
            Titolo = "0S24_26_B_TDM_B", Classificazione = "0S24_26_B", Status = 1, Margini = "0,0,0,0",
            IdLavorazioneIstanta = lavorazione, UltimaPubblicazione = DateTime.UtcNow,
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();

        VolantiniPagine Pagina(short versione) => new()
        {
            IdVol = vol.Id, Numero = 3, Versione = versione, Path = $"pag3_v{versione}",
            PathFisico = $"0S24_26_B/0S24_26_B_TDM_B/pag3_v{versione}", DataVersione = DateTime.UtcNow
        };
        var vecchia = Pagina(1);
        var pagina = Pagina(2);
        ctx.VolantiniPagines.AddRange(vecchia, pagina);
        await ctx.SaveChangesAsync();

        VolantiniPagineElementi Elemento(int idPagina, string label, string basecode, long? padre = null) => new()
        {
            IdPagina = idPagina, IdParent = padre, LabelInd = label, Basecode = basecode, Contenuto = "",
            Larghezza = 100, Altezza = 100
        };
        var boxVecchio = Elemento(vecchia.Id, "BOX_STD_8001", "8001");
        var box = Elemento(pagina.Id, "BOX_STD_8001", "8001");
        var box2 = Elemento(pagina.Id, "BOX_STD_8002", "8002");
        ctx.VolantiniPagineElementis.AddRange(boxVecchio, box, box2);
        await ctx.SaveChangesAsync();
        var descr = Elemento(pagina.Id, SchemaReferenza.LabelDescrizione, "8001", box.Id);
        var imm = Elemento(pagina.Id, SchemaReferenza.LabelImmagine, "8001", box.Id);
        ctx.VolantiniPagineElementis.AddRange(descr, imm);
        await ctx.SaveChangesAsync();

        var unOraFa = DateTime.UtcNow.AddHours(-1);
        VolantiniPagineNote Nota(int idPagina, long idBox, string testo, short stato = ServizioCorrezioni.StatoNonVerificata,
                                 short tipo = ServizioCorrezioni.TipoNotaTestuale, DateTime? data = null) => new()
        {
            IdPagina = idPagina, IdElemento = idBox, Tipo = tipo, Descrizione = testo, Stato = stato, IdAutore = category.Id,
            DataInserimento = data ?? unOraFa, DataModifica = data ?? unOraFa
        };
        var nota = Nota(pagina.Id, box.Id, "sgruppare");
        var accettata = Nota(pagina.Id, box.Id, "gia' fatta", ServizioCorrezioni.StatoAccettata);
        var promemoria = Nota(pagina.Id, box.Id, "ricordarsi", tipo: ServizioCorrezioni.TipoNotaPromemoria);
        var notaVecchia = Nota(vecchia.Id, boxVecchio.Id, "versione superata");
        var recente = Nota(pagina.Id, box2.Id, "appena scritta", data: DateTime.UtcNow);
        ctx.VolantiniPagineNotes.AddRange(nota, accettata, promemoria, notaVecchia, recente);

        var timbro = new VolantiniPagineDisegniComposizioni
        {
            IdPagina = pagina.Id, IdElemento = box.Id, Simbolo = "_4_2_alkg", Color = "yellow", Border = 5,
            Stato = ServizioCorrezioni.StatoNonVerificata, IdAutore = marketing.Id, DataInserimento = unOraFa
        };
        ctx.VolantiniPagineDisegniComposizionis.Add(timbro);

        VolantiniPagineElementiVersioni Riga(long idElemento, string nuovaVersione) => new()
        {
            IdElemento = idElemento, IdPagina = pagina.Id, IdAutore = marketing.Id, DataModifica = unOraFa,
            Stato = ServizioCorrezioni.EaRegistrato, NuovaVersione = nuovaVersione
        };
        ctx.VolantiniPagineElementiVersionis.AddRange(
            Riga(box.Id, "[{\"id_utente\":1,\"register_date\":\"2026-11-12T09:00:00Z\",\"id_azione\":-1,\"keyvalues\":[{\"field\":\"prezzo_promo\",\"valore\":\"3.90\"}]}," +
                         "{\"id_utente\":1,\"register_date\":\"2026-11-12T09:00:00Z\",\"id_azione\":3,\"keyvalues\":[{\"field\":\"force_infopack\",\"valore\":\"al kg\"}]}]"),
            Riga(descr.Id, "{\"id_utente\":1,\"register_date\":\"2026-11-12T09:00:00Z\",\"id_azione\":-1,\"keyvalues\":[{\"field\":\"descrizione\",\"valore\":\"<DESCR_1>Mela golden</DESCR_1>\"}]}"),
            Riga(imm.Id, JsonSerializer.Serialize(new[]
            {
                new VoceFoto { guidid = "foto-8001", codice = "8001", nomeFile = "8001_1.psd", stato = 2 },
                new VoceFoto { guidid = "logo-bio", codice = "BIO", nomeFile = "bio.png", stato = 4 }
            })));
        await ctx.SaveChangesAsync();

        return new Volantino(vol.Id, box.Id, box2.Id, nota.Id, accettata.Id, promemoria.Id, notaVecchia.Id, timbro.Id, recente.Id);
    }

    private static async Task<(HttpStatusCode Http, JsonDocument Json)> GetAsync(FabbricaCorreggo app, string? token,
                                                                                 int lavorazione = Lavorazione)
    {
        using var client = app.Client();
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/Plugin/Correzioni/{lavorazione}");
        if (token != null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var r = await client.SendAsync(req);
        return (r.StatusCode, JsonDocument.Parse(await r.Content.ReadAsStringAsync()));
    }

    private static async Task<(HttpStatusCode Http, JsonDocument Json)> ChiudiAsync(FabbricaCorreggo app, string token,
                                                                                    params string[] approvate)
    {
        using var client = app.Client();
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/Plugin/Correzioni/{Lavorazione}/Chiudi")
        {
            Content = JsonContent.Create(new { approvate })
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var r = await client.SendAsync(req);
        return (r.StatusCode, JsonDocument.Parse(await r.Content.ReadAsStringAsync()));
    }

    private static List<JsonElement> Correzioni(JsonDocument json) =>
        json.RootElement.GetProperty("dati").GetProperty("correzioni").EnumerateArray().ToList();

    private static JsonElement Correzione(JsonDocument json, string id) =>
        Correzioni(json).Single(c => c.GetProperty("id").GetString() == id);

    private static async Task<T> LeggiAsync<T>(FabbricaCorreggo app, Func<Correggo4Context, Task<T>> leggi)
    {
        using var scope = app.Services.CreateScope();
        return await leggi(scope.ServiceProvider.GetRequiredService<Correggo4Context>());
    }

    private static Task<short> StatoNotaAsync(FabbricaCorreggo app, long id) =>
        LeggiAsync(app, c => c.VolantiniPagineNotes.AsNoTracking().Where(n => n.Id == id).Select(n => n.Stato).FirstAsync());

    private static Task<short> StatoTimbroAsync(FabbricaCorreggo app, long id) =>
        LeggiAsync(app, c => c.VolantiniPagineDisegniComposizionis.AsNoTracking().Where(n => n.Id == id).Select(n => n.Stato).FirstAsync());

    private static Task<List<short>> StatiEditAsync(FabbricaCorreggo app) =>
        LeggiAsync(app, c => c.VolantiniPagineElementiVersionis.AsNoTracking().OrderBy(v => v.Id).Select(v => v.Stato).ToListAsync());

    // ------------------------------------------------------------------ lettura

    [Fact]
    public async Task L_Agenzia_legge_le_correzioni_aperte_dell_ultima_versione()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        var (http, json) = await GetAsync(app, TokenAgenzia);

        Assert.Equal(HttpStatusCode.OK, http);
        var ids = Correzioni(json).Select(c => c.GetProperty("id").GetString()).ToList();
        Assert.Equal(new[]
        {
            $"edit:{v.Box}:descrizione", $"edit:{v.Box}:offerta", $"nota:{v.Nota}", $"timbro:{v.Timbro}", $"nota:{v.NotaRecente}"
        }, ids);
        //Fuori: la nota accettata, il promemoria, la nota della versione superata.
        Assert.DoesNotContain($"nota:{v.NotaAccettata}", ids);
        Assert.DoesNotContain($"nota:{v.Promemoria}", ids);
        Assert.DoesNotContain($"nota:{v.NotaVecchiaVersione}", ids);

        var dati = json.RootElement.GetProperty("dati");
        Assert.Equal(v.Id, dati.GetProperty("idVolantino").GetInt32());
        Assert.Equal(2, dati.GetProperty("versione").GetInt32());
    }

    [Fact]
    public async Task Ogni_correzione_porta_box_autore_e_contenuto()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        var (_, json) = await GetAsync(app, TokenAgenzia);

        var nota = Correzione(json, $"nota:{v.Nota}");
        Assert.Equal("nota", nota.GetProperty("tipo").GetString());
        Assert.Equal("sgruppare", nota.GetProperty("testo").GetString());
        Assert.Equal("BOX_STD_8001", nota.GetProperty("labelBox").GetString());
        Assert.Equal("8001", nota.GetProperty("basecode").GetString());
        Assert.Equal(3, nota.GetProperty("pagina").GetInt32());
        Assert.Equal("Category", nota.GetProperty("tipoAutore").GetString());

        var timbro = Correzione(json, $"timbro:{v.Timbro}");
        Assert.Equal("_4_2_alkg", timbro.GetProperty("simbolo").GetString());
        Assert.Equal("Al kg", timbro.GetProperty("nomeTimbro").GetString());
        Assert.Equal("Marketing", timbro.GetProperty("tipoAutore").GetString());

        var offerta = Correzione(json, $"edit:{v.Box}:offerta");
        Assert.Equal("3.90", offerta.GetProperty("campi").GetProperty("prezzo_promo").GetString());
        var azione = Assert.Single(offerta.GetProperty("azioni").EnumerateArray());
        Assert.Equal(3, azione.GetProperty("id").GetInt32());
        Assert.Equal("al kg", azione.GetProperty("campi").GetProperty("force_infopack").GetString());

        var descrizione = Correzione(json, $"edit:{v.Box}:descrizione");
        Assert.Equal("<DESCR_1>Mela golden</DESCR_1>", descrizione.GetProperty("descrizione").GetString());
        Assert.False(descrizione.GetProperty("campi").TryGetProperty("descrizione", out _));
        var foto = Assert.Single(descrizione.GetProperty("foto").EnumerateArray());
        Assert.Equal(2, foto.GetProperty("stato").GetInt32());
        var logo = Assert.Single(descrizione.GetProperty("loghi").EnumerateArray());
        Assert.Equal("BIO", logo.GetProperty("codice").GetString());
    }

    [Fact]
    public async Task L_azione_dell_Edit_avanzato_porta_il_titolo_dello_schema_del_box()
    {
        using var app = App();
        var v = await VolantinoAsync(app);
        //Lo schema che il Plugin scrive all'export (ficoProcess.processCorreggoExport): l'id e' la posizione
        //dell'azione nel box, il titolo e' quello del cliente. Il Plugin ritrova l'azione per titolo.
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            var box = await ctx.VolantiniPagineElementis.FirstAsync(e => e.Id == v.Box);
            box.Contenuto = JsonSerializer.Serialize(new
            {
                boxName = "BOX_STD_8001",
                itemRefStringfied = "{}",
                azioni = new object[]
                {
                    new { id = 1, titolo = "Cambia prezzo promo", labelIndd = "prezzo_promo",
                          istruzioni = new[] { new { field = "prezzo_promo", valore = Array.Empty<string>() } } },
                    new { id = 3, titolo = "Cambia prezzo info pack", labelIndd = "prezzo_info_pack",
                          istruzioni = new[] { new { field = "force_infopack", valore = Array.Empty<string>() } } }
                }
            });
            await ctx.SaveChangesAsync();
        }

        var (_, json) = await GetAsync(app, TokenAgenzia);

        var azione = Assert.Single(Correzione(json, $"edit:{v.Box}:offerta").GetProperty("azioni").EnumerateArray());
        Assert.Equal(3, azione.GetProperty("id").GetInt32());
        Assert.Equal("Cambia prezzo info pack", azione.GetProperty("titolo").GetString());
        Assert.Equal("al kg", azione.GetProperty("campi").GetProperty("force_infopack").GetString());
    }

    [Fact]
    public async Task Senza_lo_schema_del_box_l_azione_ha_un_titolo_che_il_Plugin_non_conosce()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        var (_, json) = await GetAsync(app, TokenAgenzia);

        //Il Plugin non la trova fra le azioni del cliente e la lascia aperta, dicendolo.
        var azione = Assert.Single(Correzione(json, $"edit:{v.Box}:offerta").GetProperty("azioni").EnumerateArray());
        Assert.Equal("Azione 3", azione.GetProperty("titolo").GetString());
    }

    [Fact]
    public async Task Leggere_non_cambia_niente_in_Correggo4()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        await GetAsync(app, TokenAgenzia);

        Assert.Equal(ServizioCorrezioni.StatoNonVerificata, await StatoNotaAsync(app, v.Nota));
        Assert.Equal(ServizioCorrezioni.StatoNonVerificata, await StatoTimbroAsync(app, v.Timbro));
        Assert.All(await StatiEditAsync(app), s => Assert.Equal(ServizioCorrezioni.EaRegistrato, s));
    }

    [Fact]
    public async Task Una_lavorazione_senza_volantino_lo_dice()
    {
        using var app = App();
        await VolantinoAsync(app);

        var (http, json) = await GetAsync(app, TokenAgenzia, lavorazione: 9999);

        Assert.Equal(HttpStatusCode.NotFound, http);
        Assert.Equal("volantino_non_trovato", json.RootElement.GetProperty("codice").GetString());
        Assert.Contains("9999", json.RootElement.GetProperty("messaggio").GetString());
    }

    [Fact]
    public async Task Senza_Bearer_o_con_un_Bearer_sconosciuto_non_si_entra()
    {
        using var app = App();
        await VolantinoAsync(app);

        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAsync(app, null)).Http);
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAsync(app, "sconosciuto")).Http);
    }

    [Fact]
    public async Task Un_Category_non_legge_ne_chiude_le_correzioni_per_il_Plugin()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        var (http, json) = await GetAsync(app, TokenCategory);
        var (httpChiudi, _) = await ChiudiAsync(app, TokenCategory, $"nota:{v.Nota}");

        Assert.Equal(HttpStatusCode.Forbidden, http);
        Assert.Equal("non_autorizzato", json.RootElement.GetProperty("codice").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, httpChiudi);
        Assert.Equal(ServizioCorrezioni.StatoNonVerificata, await StatoNotaAsync(app, v.Nota));
    }

    // ------------------------------------------------------------------ chiusura

    [Fact]
    public async Task Si_chiudono_solo_le_approvate_le_altre_restano_come_sono()
    {
        var chiamate = new List<string>();
        using var app = App(chiamate);
        var v = await VolantinoAsync(app);

        var (http, json) = await ChiudiAsync(app, TokenAgenzia,
            $"nota:{v.Nota}", $"edit:{v.Box}:offerta", $"edit:{v.Box}:descrizione");

        Assert.Equal(HttpStatusCode.OK, http);
        var esiti = json.RootElement.GetProperty("dati").EnumerateArray().ToList();
        Assert.Equal(3, esiti.Count);
        Assert.All(esiti, e => Assert.True(e.GetProperty("ok").GetBoolean(), e.ToString()));

        Assert.Equal(ServizioCorrezioni.StatoAccettata, await StatoNotaAsync(app, v.Nota));
        Assert.All(await StatiEditAsync(app), s => Assert.Equal(ServizioCorrezioni.EaCorretto, s));
        //Il timbro non e' stato mandato: resta aperto, come le rifiutate.
        Assert.Equal(ServizioCorrezioni.StatoNonVerificata, await StatoTimbroAsync(app, v.Timbro));
        //Le foto le applica il Plugin: Correggo4 non le rimanda a Istanta.
        Assert.DoesNotContain(chiamate, c => c.Contains("FicoProcess", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Dopo_la_chiusura_le_approvate_non_si_reimportano()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        await ChiudiAsync(app, TokenAgenzia, $"timbro:{v.Timbro}");
        var (_, json) = await GetAsync(app, TokenAgenzia);

        var ids = Correzioni(json).Select(c => c.GetProperty("id").GetString()).ToList();
        Assert.DoesNotContain($"timbro:{v.Timbro}", ids);
        Assert.Contains($"nota:{v.Nota}", ids);
    }

    [Fact]
    public async Task Una_correzione_che_non_e_aperta_in_questo_volantino_non_si_chiude()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        var (_, json) = await ChiudiAsync(app, TokenAgenzia,
            $"nota:{v.NotaVecchiaVersione}", $"nota:{v.NotaAccettata}", "nota:abc", $"nota:{v.Nota}");

        var esiti = json.RootElement.GetProperty("dati").EnumerateArray()
            .ToDictionary(e => e.GetProperty("id").GetString()!, e => e);
        Assert.False(esiti[$"nota:{v.NotaVecchiaVersione}"].GetProperty("ok").GetBoolean());
        Assert.Equal("non_aperta", esiti[$"nota:{v.NotaVecchiaVersione}"].GetProperty("codice").GetString());
        Assert.False(esiti[$"nota:{v.NotaAccettata}"].GetProperty("ok").GetBoolean());
        Assert.False(esiti["nota:abc"].GetProperty("ok").GetBoolean());
        //Le altre non fermano quella buona.
        Assert.True(esiti[$"nota:{v.Nota}"].GetProperty("ok").GetBoolean());
        Assert.Equal(ServizioCorrezioni.StatoNonVerificata, await StatoNotaAsync(app, v.NotaVecchiaVersione));
    }

    [Fact]
    public async Task Una_nota_appena_scritta_non_si_chiude_e_lo_dice()
    {
        using var app = App();
        var v = await VolantinoAsync(app);

        var (_, json) = await ChiudiAsync(app, TokenAgenzia, $"nota:{v.NotaRecente}");

        var esito = Assert.Single(json.RootElement.GetProperty("dati").EnumerateArray());
        Assert.False(esito.GetProperty("ok").GetBoolean());
        Assert.Equal("in_battitura", esito.GetProperty("codice").GetString());
        Assert.Equal(ServizioCorrezioni.StatoNonVerificata, await StatoNotaAsync(app, v.NotaRecente));
    }
}
