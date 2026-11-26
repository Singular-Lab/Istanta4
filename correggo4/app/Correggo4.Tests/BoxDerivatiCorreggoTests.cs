using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1257: i box derivati in Correggo4. Un derivato e' una seconda impaginazione dello stesso record,
/// con lo stesso codice del suo originale: arriva con l'esportazione segnato come tale (idLavRec), si
/// vede (e solo lui, I20-1274), porta all'originale, si corregge solo con note e OK, e le propagazioni
/// non lo raggiungono.
/// </summary>
public class BoxDerivatiCorreggoTests
{
    private const string Promo = "0S24_26_B";
    private const string Basecode = "8001234567890";
    private const short IdAutore = 7;
    private const int IdLavorazione = 4242;

    private static string Dna(long idRec, long idLavRec) => JsonSerializer.Serialize(new
    {
        codice = Basecode, gruppo = "G1", descrizione = "Avocado Hass",
        idRec, idLavRec, derivato = idLavRec > 0
    });

    // ------------------------------------------------------------------ identita' del box

    [Fact]
    public void L_identita_arriva_dal_tracciato_e_si_rilegge_dal_dna()
    {
        var campi = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
            "{\"Referenza.Codice\":\"" + Basecode + "\",\"Correggo.Box\":{\"idRec\":5,\"idLavRec\":99,\"derivato\":true,\"originale\":{\"codiceGruppo\":\"G1\",\"idRec\":5}}}")!;

        var dalTracciato = InterpreteDna.IdentitaDaTracciato(campi);
        Assert.Equal(new InterpreteDna.IdentitaBox(5, 99), dalTracciato);
        Assert.True(dalTracciato.Derivato);

        Assert.Equal(new InterpreteDna.IdentitaBox(5, 99), InterpreteDna.IdentitaDelBox(Dna(5, 99)));
        Assert.False(InterpreteDna.IdentitaDelBox(Dna(5, 0)).Derivato);
    }

    [Fact]
    public void Un_box_esportato_prima_della_regola_vale_come_originale()
    {
        var vecchio = InterpreteDna.IdentitaDelBox("{\"codice\":\"" + Basecode + "\",\"gruppo\":\"G1\",\"descrizione\":\"\"}");
        Assert.Equal(InterpreteDna.IdentitaBox.Nessuna, vecchio);
        Assert.False(vecchio.Derivato);
        Assert.Equal(InterpreteDna.IdentitaBox.Nessuna, InterpreteDna.IdentitaDelBox(null));
        Assert.Equal(InterpreteDna.IdentitaBox.Nessuna, InterpreteDna.IdentitaDelBox("non e' json"));
        Assert.Equal(InterpreteDna.IdentitaBox.Nessuna,
            InterpreteDna.IdentitaDaTracciato(new Dictionary<string, JsonElement>()));
    }

    [Fact]
    public void L_originale_e_il_box_con_lo_stesso_idRec_senza_idLavRec()
    {
        var derivato = new InterpreteDna.IdentitaBox(5, 99);
        Assert.True(new InterpreteDna.IdentitaBox(5, 0).EOriginaleDi(derivato));
        Assert.False(new InterpreteDna.IdentitaBox(6, 0).EOriginaleDi(derivato));      // un altro record
        Assert.False(new InterpreteDna.IdentitaBox(5, 98).EOriginaleDi(derivato));     // un altro derivato
        Assert.True(InterpreteDna.IdentitaBox.Nessuna.EOriginaleDi(derivato));         // esportato senza idRec
    }

    [Fact]
    public void Un_derivato_non_e_il_gemello_di_nessuno()
    {
        var originale = new VolantiniPagineElementi { Basecode = Basecode, Dna = Dna(5, 0) };
        var altroVolantino = new VolantiniPagineElementi { Basecode = Basecode, Dna = Dna(5, 0) };
        var derivato = new VolantiniPagineElementi { Basecode = Basecode, Dna = Dna(5, 99) };

        Assert.True(Gemelli.StessoDna(originale, altroVolantino));
        Assert.False(Gemelli.StessoDna(originale, derivato));   // la propagazione non gli arriva
        Assert.False(Gemelli.StessoDna(derivato, originale));   // e da lui non parte
    }

    // ------------------------------------------------------------------ correzioni e propagazioni

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-box-derivati-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Prodotto(long Box, long Descrizione, int IdPagina);

    /// <summary>Un volantino aperto con una pagina; i prodotti si aggiungono con <see cref="ProdottoAsync"/>.</summary>
    private static async Task<int> PaginaAsync(WebApplicationFactory<Program> app, string titolo, int? idLavorazione = null)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = titolo, Classificazione = Promo, Status = 1, Margini = "0,0,0,0", IdLavorazioneIstanta = idLavorazione,
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        var pagina = new VolantiniPagine
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = 1, Versione = 1,
            Path = "pag1_v1", PathFisico = $"{Promo}/{titolo}/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        return pagina.Id;
    }

    private static async Task<Prodotto> ProdottoAsync(WebApplicationFactory<Program> app, int idPagina, long idLavRec)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var box = new VolantiniPagineElementi
        {
            IdPagina = idPagina, LabelInd = Basecode, Basecode = Basecode, Dna = Dna(5, idLavRec),
            Contenuto = "", Larghezza = 100, Altezza = 100
        };
        ctx.VolantiniPagineElementis.Add(box);
        await ctx.SaveChangesAsync();
        var descr = new VolantiniPagineElementi
        {
            IdPagina = idPagina, IdParent = box.Id, LabelInd = SchemaReferenza.LabelDescrizione, Basecode = Basecode,
            Contenuto = "Avocado Hass", Larghezza = 50, Altezza = 10
        };
        ctx.VolantiniPagineElementis.Add(descr);
        await ctx.SaveChangesAsync();
        return new Prodotto(box.Id, descr.Id, idPagina);
    }

    private static ServizioCorrezioni.Utente Marketing() =>
        new(IdAutore, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "Marketing Prova");

    private static ServizioCorrezioni.Utente Agenzia() => new(8, Ruoli.CodiceAgenzia, null, "Agenzia Prova");

    private static async Task<T> ConServizioAsync<T>(WebApplicationFactory<Program> app, Func<ServizioCorrezioni, Task<T>> fai)
    {
        using var scope = app.Services.CreateScope();
        return await fai(scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>());
    }

    private static async Task<int> RigheDiAsync(WebApplicationFactory<Program> app, long idElemento)
    {
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<Correggo4Context>()
            .VolantiniPagineElementiVersionis.AsNoTracking().CountAsync(v => v.IdElemento == idElemento);
    }

    [Fact]
    public async Task La_descrizione_salvata_sull_originale_non_arriva_al_derivato()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int pagina = await PaginaAsync(app, "0S24_26_B_TDM_B");
        var originale = await ProdottoAsync(app, pagina, 0);
        var derivato = await ProdottoAsync(app, pagina, 99);
        var gemello = await ProdottoAsync(app, await PaginaAsync(app, "0S24_26_B_TDM_B1"), 0);

        var esito = await ConServizioAsync(app, s => s.SalvaEditDescrizioneAsync(Marketing(), originale.Box,
            new RichiestaEditScheda { Testo = "Avocado Hass maturo", Sezione = "descrizione" }));

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(1, await RigheDiAsync(app, gemello.Descrizione));   // il gemello dell'altro volantino si'
        Assert.Equal(0, await RigheDiAsync(app, derivato.Descrizione));  // il derivato no
    }

    [Fact]
    public async Task Il_derivato_non_compare_fra_i_gemelli_dell_originale()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int pagina = await PaginaAsync(app, "0S24_26_B_TDM_B");
        var originale = await ProdottoAsync(app, pagina, 0);
        var derivato = await ProdottoAsync(app, pagina, 99);

        var esito = await ConServizioAsync(app, s => s.GemelliEditAsync(Marketing(), originale.Box, ServizioCorrezioni.ParteDescrizione));

        Assert.True(esito.Ok, esito.Messaggio);
        var gemelli = Assert.IsType<List<GemelloEditVista>>(esito.Dati);
        Assert.DoesNotContain(gemelli, g => g.IdBox == derivato.Box);
    }

    [Fact]
    public async Task Sul_derivato_le_correzioni_si_rifiutano_con_il_motivo()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int pagina = await PaginaAsync(app, "0S24_26_B_TDM_B");
        var derivato = await ProdottoAsync(app, pagina, 99);

        var descrizione = await ConServizioAsync(app, s => s.SalvaEditDescrizioneAsync(Marketing(), derivato.Box,
            new RichiestaEditScheda { Testo = "Avocado", Sezione = "descrizione" }));
        var offerta = await ConServizioAsync(app, s => s.SalvaEditOffertaAsync(Marketing(), derivato.Box, new RichiestaEditOfferta()));
        var timbro = await ConServizioAsync(app, s => s.NuovoTimbroAsync(Marketing(), derivato.Box, "_1_1_fvol", 10, 10));

        foreach (var esito in new[] { descrizione, offerta, timbro })
        {
            Assert.False(esito.Ok);
            Assert.Equal(409, esito.Http);
            Assert.Equal("box_derivato", esito.Codice);
            Assert.Equal(ServizioCorrezioni.MessaggioBoxDerivato, esito.Messaggio);
        }
        Assert.Contains("box originale", ServizioCorrezioni.MessaggioBoxDerivato);
        Assert.Equal(0, await RigheDiAsync(app, derivato.Descrizione));
    }

    [Fact]
    public async Task Sul_derivato_la_nota_si_mette_e_arriva_al_Plugin_sul_derivato()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int pagina = await PaginaAsync(app, "0S24_26_B_TDM_B", IdLavorazione);
        var originale = await ProdottoAsync(app, pagina, 0);
        var derivato = await ProdottoAsync(app, pagina, 99);

        var nota = await ConServizioAsync(app, s => s.NuovaNotaAsync(Marketing(), derivato.Box, "il prezzo e' storto", 10, 10, pagina));
        Assert.True(nota.Ok, nota.Messaggio);

        var perPlugin = await ConServizioAsync(app, s => s.CorrezioniPerPluginAsync(Agenzia(), IdLavorazione));
        Assert.True(perPlugin.Ok, perPlugin.Messaggio);
        var correzione = Assert.Single(Assert.IsType<CorrezioniPerPlugin>(perPlugin.Dati).Correzioni);
        Assert.Equal(derivato.Box, correzione.IdBox);
        Assert.Equal(99, correzione.IdLavRec);
        Assert.Equal(5, correzione.IdRec);
        Assert.True(correzione.Derivato);
        Assert.NotEqual(originale.Box, correzione.IdBox);
    }

    // ------------------------------------------------------------------ importazione ed eredita'

    [Fact]
    public void L_importazione_scrive_nel_dna_chi_e_il_box_e_l_eredita_separa_il_derivato()
    {
        string importatore = Sorgente("Ingestione", "ImportatorePack.cs");
        Assert.Contains("identita = InterpreteDna.IdentitaDaTracciato(campi);", importatore);
        Assert.Contains("idRec = identita.IdRec, idLavRec = identita.IdLavRec, derivato = identita.Derivato", importatore);

        string eredita = Sorgente("Servizi", "ServizioPropagazione.Eredita.cs");
        Assert.Contains("e.LabelInd + \"*\" + Correggo4.Ingestione.InterpreteDna.IdentitaDelBox(e.Dna).IdLavRec", eredita);
        Assert.Contains("perEtichetta.TryGetValue(ChiaveEredita(nuovo), out var vecchio)", eredita);
        Assert.DoesNotContain("GroupBy(e => e.LabelInd)", eredita);
    }

    // ------------------------------------------------------------------ editor

    [Fact]
    public void L_editor_segna_il_derivato_e_porta_all_originale()
    {
        string html = Sorgente("Views", "Volantini", "Dettaglio.cshtml");

        // a colpo d'occhio sulla pagina, solo sui derivati (I20-1274: valore 1, non la sola presenza)
        Assert.Contains("title=\"@b.Basecode\" data-derivato=\"@(b.Derivato ? \"1\" : \"0\")\"", html);
        Assert.Contains(".zona[data-derivato=\"1\"]::before", html);
        Assert.DoesNotContain(".zona[data-derivato]", html);
        Assert.Contains("content: \"DERIVATO\";", html);
        // nella scheda: riquadro, bottone, avviso se l'originale manca
        Assert.Contains("id=\"mVaiOriginale\">VAI AL BOX ORIGINALE</button>", html);
        Assert.Contains("var MESSAGGIO_ORIGINALE_ASSENTE = 'Il box originale non è presente in questa lavorazione.';", html);
        Assert.Contains("if (!k || !dati[k]) {", html);
        Assert.Contains("vaiAPagina(dati[k].pagina);", html);
        // correzioni spente, note e OK no
        Assert.Contains("if (eDerivato(id)) return false;   // I20-1257", html);
        Assert.Contains("if (eDerivato(idBox)) { suggerisci(MESSAGGIO_BOX_DERIVATO, 4000); return; }", html);
        Assert.Contains("if (strumento === 'nota') { popNuovaNota(idBox, p.x, p.y, ev); return; }", html);
        Assert.Contains("if (strumento === 'ok') { cambiaOk(idBox, ev); return; }", html);
        // i dati del box
        Assert.Contains("derivato = x.b.Derivato,", html);
        Assert.Contains("idOriginale = x.b.IdOriginale,", html);
    }

    /// <summary>
    /// I20-1274: il bordo arancione con DERIVATO compariva su tutti i box, perche' Razor scrive
    /// sempre gli attributi data-* (data-derivato="" anche con valore null) e la regola guardava la
    /// sola presenza. Qui si apre l'editor vero e si guarda l'HTML che arriva al browser: il segno
    /// scatta solo sul derivato, e i dati della finestra del prodotto li distinguono.
    /// </summary>
    [Fact]
    public async Task Sulla_pagina_solo_il_derivato_e_segnato_come_derivato()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = AppConUtente(fabbrica);
        short agenzia = await AgenziaAsync(app);
        int idPagina = await PaginaAsync(app, "0S24_26_B_TDM_B", IdLavorazione);
        var originale = await ProdottoAsync(app, idPagina, idLavRec: 0);
        var derivato = await ProdottoAsync(app, idPagina, idLavRec: 99);
        int idVol;
        using (var scope = app.Services.CreateScope())
        {
            // l'editor disegna i box solo su una pagina con le misure
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            var pagina = await ctx.VolantiniPagines.FirstAsync(p => p.Id == idPagina);
            pagina.Larghezza = 1000;
            pagina.Altezza = 1400;
            await ctx.SaveChangesAsync();
            idVol = pagina.IdVol;
        }

        var c = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add(HeaderUtente, agenzia.ToString());
        var r = await c.GetAsync($"/Volantini/Dettaglio/{idVol}");
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
        string html = await r.Content.ReadAsStringAsync();

        Assert.Contains($"data-box=\"{originale.Box}\" title=\"{Basecode}\" data-derivato=\"0\"", html);
        Assert.Contains($"data-box=\"{derivato.Box}\" title=\"{Basecode}\" data-derivato=\"1\"", html);
        Assert.DoesNotContain("data-derivato=\"\"", html);
        // il bordo e l'etichetta scattano solo sul valore 1
        Assert.Contains(".zona[data-derivato=\"1\"] {", html);
        Assert.Contains(".zona[data-derivato=\"1\"]::before", html);
        Assert.DoesNotContain(".zona[data-derivato]", html);

        // la finestra del prodotto sa ancora chi e' il derivato
        const string apri = "<script id=\"datiBox\" type=\"application/json\">";
        int inizio = html.IndexOf(apri, StringComparison.Ordinal) + apri.Length;
        string json = html[inizio..html.IndexOf("</script>", inizio, StringComparison.Ordinal)];
        var dati = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json)!;
        Assert.True(dati[derivato.Box.ToString()].GetProperty("derivato").GetBoolean());
        Assert.False(dati[originale.Box.ToString()].GetProperty("derivato").GetBoolean());
    }

    private const string SchemaProva = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";

    /// <summary>Come <see cref="App"/>, con l'utente letto da un header (come in TestaFinestraProdottoTests).</summary>
    private static WebApplicationFactory<Program> AppConUtente(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-box-derivati-editor-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
            s.AddAuthentication(SchemaProva).AddScheme<AuthenticationSchemeOptions, AutenticazioneDiProva>(SchemaProva, _ => { });
            s.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = SchemaProva;
                o.DefaultAuthenticateScheme = SchemaProva;
                o.DefaultChallengeScheme = SchemaProva;
                o.DefaultForbidScheme = SchemaProva;
            });
        }));
    }

    private static async Task<short> AgenziaAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var u = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local", Username = "agenzia-prova",
            Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.Add(u);
        await ctx.SaveChangesAsync();
        return u.Id;
    }

    /// <summary>L'utente e' quello dell'header, col ruolo letto dal database.</summary>
    private sealed class AutenticazioneDiProva(IOptionsMonitor<AuthenticationSchemeOptions> o, ILoggerFactory l, UrlEncoder e)
        : AuthenticationHandler<AuthenticationSchemeOptions>(o, l, e)
    {
        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!short.TryParse(Request.Headers[HeaderUtente], out short id))
                return AuthenticateResult.NoResult();
            var ctx = Context.RequestServices.GetRequiredService<Correggo4Context>();
            var u = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (u == null)
                return AuthenticateResult.Fail("utente di prova sconosciuto");
            var identita = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()),
                new Claim(ClaimTypes.Name, $"{u.Nome} {u.Cognome}"),
                new Claim(ClaimTypes.Role, Ruoli.Nome(u.Ruolo))
            }, SchemaProva);
            return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identita), SchemaProva));
        }
    }

    [Fact]
    public void Il_controller_collega_il_derivato_al_suo_originale()
    {
        string controller = Sorgente("Controllers", "VolantiniController.cs");
        Assert.Contains("identita[o.Id].EOriginaleDi(identita[e.Id])", controller);
        Assert.Contains("if (box.Derivato) box.IdOriginale = OriginaleDi(e);", controller);
        // chi e' il box non finisce fra i campi della referenza
        Assert.Contains("if (prop.Name == InterpreteDna.ChiaveIdentitaBox) continue;", controller);
    }

    private static string Sorgente(params string[] parti) =>
        File.ReadAllText(Path.Combine(new[] { RadiceApplicazione() }.Concat(parti).ToArray())).Replace("\r\n", "\n");

    private static string RadiceApplicazione()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidata = Path.Combine(d.FullName, "Correggo4");
            if (File.Exists(Path.Combine(candidata, "Correggo4.csproj")))
                return candidata;
        }
        throw new DirectoryNotFoundException("Cartella del progetto Correggo4 non trovata sopra " + AppContext.BaseDirectory);
    }
}
