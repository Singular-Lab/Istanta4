using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// La pagina «come impaginata» nel menabò avanzato (spec timone-volantino, «Pagina come impaginata
/// nel menabò avanzato»; spec report-correggo, «Scambi del menabò avanzato nel Report Correggo»).
/// Una pagina con tre box nella prima riga e due nella seconda e nella terza (la 14 di
/// 0S26_26_B_UFI_B) non la disegna nessuna griglia a sistema: in una 2x4 le referenze finivano
/// lontano da dove stanno, e il Report Correggo rifaceva la pagina come la griglia. Come impaginata
/// la pagina ha una casella per box, sul box: gli scambi arrivano al Plugin nel rettangolo del box
/// vero. Il server si prova sul database in memoria; il timone, che sta nel browser, sul sorgente,
/// come negli altri test del timone.
/// </summary>
public class TimoneRicalcoTests
{
    private const string Promo = "0526_26_B";

    // ------------------------------------------------------------------ la griglia della pagina

    [Fact]
    public void Come_impaginata_la_pagina_ha_una_casella_per_box()
    {
        var g = GriglieFormato.DellaPagina("impaginata", 7)!;
        Assert.Equal(GriglieFormato.Impaginata, g.Nome);
        Assert.Equal(1, g.Righe);
        Assert.Equal(7, g.Colonne);
        Assert.Equal(7, g.Posti);

        // il nome si riconosce come lo scrive il browser, anche con maiuscole o spazi
        Assert.Equal(5, GriglieFormato.DellaPagina(" Impaginata ", 5)!.Posti);
        // senza box suoi la pagina non puo' essere come impaginata
        Assert.Null(GriglieFormato.DellaPagina("impaginata", 0));
        // le griglie a sistema restano quelle, e «impaginata» non e' una di loro
        Assert.Equal(GriglieFormato.Trova("2x3"), GriglieFormato.DellaPagina("2x3", 7));
        Assert.Null(GriglieFormato.Trova("impaginata"));
        Assert.DoesNotContain(GriglieFormato.Ammesse(), x => GriglieFormato.EImpaginata(x.Nome));
    }

    [Fact]
    public void Una_pagina_tre_due_due_parte_come_impaginata_e_una_regolare_no()
    {
        var pagina14 = BoxDiPagina14().Select(b => (b.X, b.Y, b.W, b.H)).ToList();
        var g = ServizioTimone.GrigliaDiPartenza(pagina14)!;
        Assert.True(GriglieFormato.EImpaginata(g.Nome));
        Assert.Equal(7, g.Posti);

        // sei box, due per riga su tre righe: la 2x3, come prima
        var seiBox = Enumerable.Range(0, 6).Select(i => ((decimal)(i % 2 * 110), (decimal)(i / 2 * 110), 100m, 100m)).ToList();
        Assert.Equal("2x3", ServizioTimone.GrigliaDiPartenza(seiBox)?.Nome);
    }

    // ------------------------------------------------------------------ il salvataggio

    [Fact]
    public async Task Il_piano_manda_al_timone_una_riga_di_tante_caselle_quanti_box()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);
        Assert.True((await SalvaAsync(p, "impaginata", Scambia34)).Ok);

        using var ctx = Contesto(p.Db);
        var e = await new ServizioTimone(ctx).PianoAsync(p.Marketing, p.IdVol);
        Assert.True(e.Ok, e.Messaggio);
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(e.Dati));
        var pagina = doc.RootElement.GetProperty("pagine").EnumerateArray().Single(x => x.GetProperty("numero").GetInt16() == 1);
        Assert.Equal("impaginata", pagina.GetProperty("griglia").GetString());
        Assert.Equal(1, pagina.GetProperty("righe").GetInt32());
        Assert.Equal(7, pagina.GetProperty("colonne").GetInt32());
        Assert.Equal(7, pagina.GetProperty("capienza").GetInt32());
    }

    [Fact]
    public async Task Come_impaginata_si_salva_con_una_casella_per_box()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);

        var e = await SalvaAsync(p, "impaginata", Scambia34);
        Assert.True(e.Ok, e.Messaggio);

        using var ctx = Contesto(p.Db);
        var pagina = await ctx.TimonePagine.AsNoTracking().SingleAsync(x => x.Numero == 1);
        Assert.Equal("impaginata", pagina.Griglia);
        Assert.Equal(7, pagina.Capienza);
    }

    [Fact]
    public async Task Come_impaginata_non_c_e_una_casella_oltre_i_box()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);

        var e = await SalvaAsync(p, "impaginata", posizioni => { posizioni["9007"] = 8; });

        Assert.False(e.Ok);
        Assert.Equal("posizione_non_valida", e.Codice);
    }

    [Fact]
    public async Task Come_impaginata_una_referenza_non_si_allarga()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);

        // la 9006 larga due caselle, con la 9007 fuori volantino: la 7 e' libera, ma in una pagina
        // come impaginata un box non si allarga
        var e = await SalvaAsync(p, "impaginata", posizioni => { posizioni.Remove("9007"); }, larga: "9006");

        Assert.False(e.Ok);
        Assert.Equal("ingombro_su_impaginata", e.Codice);
    }

    [Fact]
    public async Task Una_pagina_senza_box_non_puo_essere_come_impaginata()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);

        var e = await SalvaAsync(p, "impaginata", Scambia34, grigliaPagina2: "impaginata");

        Assert.False(e.Ok);
        Assert.Equal("impaginata_senza_box", e.Codice);
    }

    // ------------------------------------------------------------------ gli scambi per il Plugin

    [Fact]
    public async Task Su_una_pagina_come_impaginata_lo_scambio_va_nel_box_vero()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);
        Assert.True((await SalvaAsync(p, "impaginata", Scambia34)).Ok);
        await ChiudiFinestraAsync(p);

        var scambi = await ScambiAsync(p);

        // solo le due referenze scambiate: la pagina non e' ridisegnata
        Assert.NotNull(scambi);
        Assert.Equal(new[] { "9003", "9004" }, scambi!.Scambi.Select(s => s.Codice).OrderBy(c => c).ToArray());
        Assert.All(scambi.Scambi, s => Assert.Null(s.DaSistemareAMano));
        // nel rettangolo del box che nell'impaginato stava nell'altra casella (Y1, X1, Y2, X2)
        Assert.Equal(new[] { 112m, 8.5m, 192m, 103.5m }, scambi.Scambi.Single(s => s.Codice == "9003").BoundsDestinazione);
        Assert.Equal(new[] { 26m, 138.7m, 108m, 230.5m }, scambi.Scambi.Single(s => s.Codice == "9004").BoundsDestinazione);
        Assert.Equal("9004", scambi.Scambi.Single(s => s.Codice == "9003").BasecodeDestinazione);
    }

    [Fact]
    public async Task La_stessa_pagina_in_una_griglia_a_sistema_si_rifa_tutta_come_la_griglia()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);
        Assert.True((await SalvaAsync(p, "2x4", Scambia34)).Ok);
        await ChiudiFinestraAsync(p);

        var scambi = await ScambiAsync(p);

        // la 2x4 non disegna la pagina come l'impaginato: arriva tutta, ridisegnata
        Assert.NotNull(scambi);
        Assert.Equal(7, scambi!.Scambi.Count);
    }

    // ------------------------------------------------------------------ il timone, nel browser

    [Fact]
    public void Nel_timone_la_casella_di_una_pagina_come_impaginata_e_il_suo_box_dentro_la_pagina()
    {
        string js = Timone();

        Assert.Contains("if (eImpaginata(pagina.griglia)) return postoImpaginato(pagina, posizione);",
            Funzione(js, "function cellaDi("));
        // una referenza allargata non ha un posto vero: un box non si allarga
        Assert.Contains("return colonne === 1 && righe === 1 && posizione ? postoImpaginato(pagina, posizione) : null;",
            Funzione(js, "function rettangoloDi("));
        // il box si ritaglia ai bordi della pagina: quello di pagina 14 arrivava al 109%
        string posto = Funzione(js, "function postoImpaginato(");
        Assert.Contains("Math.min(pw, b.x + b.w)", posto);
        Assert.Contains("Math.min(ph, b.y + b.h)", posto);
        // le caselle sono i box nati sulla pagina, in ordine di lettura (posizioneOrigine)
        Assert.Contains("v.paginaOrigine !== pagina.numero || !v.posizioneOrigine", Funzione(js, "function boxDellaPagina("));
    }

    [Fact]
    public void Nel_timone_la_pagina_parte_come_impaginata_con_la_stessa_regola_del_server()
    {
        string js = Timone();

        string partenza = Funzione(js, "function grigliaDiPartenza(");
        int indovina = partenza.IndexOf("var g = indovinaGriglia(nativi, quante);", StringComparison.Ordinal);
        int ricalco = partenza.IndexOf("g = ricalcoSeServe(pagina, g, quante || nativi.length);", StringComparison.Ordinal);
        int ripiego = partenza.IndexOf("if (!g && quante > 0) g = piuPiccolaCheBasta(quante);", StringComparison.Ordinal);
        Assert.True(indovina >= 0 && ricalco > indovina && ripiego > ricalco,
            "prima la griglia a sistema, poi il ricalco, poi il ripiego della pagina vuota");

        string regola = Funzione(js, "function ricalcoSeServe(");
        Assert.Contains("if (!box.length || box.length < quante) return g;", regola);
        Assert.Contains("if (g && disegnataComeImpaginato(g, box)) return g;", regola);
        Assert.Contains("return grigliaImpaginata(pagina);", regola);

        // lo stesso confronto a due a due di ServizioTimone.PaginaDisegnataComeImpaginato
        string confronto = Funzione(js, "function disegnataComeImpaginato(");
        Assert.Contains("if (!stessaRiga(a, b)) return false;", confronto);
        Assert.Contains("if ((ra < rb) !== (cya < cyb)) return false;", confronto);
        Assert.Contains("if (xa === xb && !stessaColonna(a, b)) return false;", confronto);
    }

    [Fact]
    public void Nel_timone_come_impaginata_non_si_allarga_non_si_scende_e_da_piena_si_passa_a_una_griglia()
    {
        string js = Timone();

        // niente maniglie, e l'allargamento si ferma con un messaggio
        Assert.Contains("if (!eImpaginata(pagina.griglia)) {\n                maniglia('largo'", js);
        Assert.Contains("if (eImpaginata(g.nome)) {\n            messaggio('Pagina come impaginata'", Funzione(js, "function allarga("));
        // non scende da sola in una griglia a sistema
        Assert.Contains("if (eImpaginata(g.nome)) return null;", Funzione(js, "function riadattaGiu("));
        // piena, passa alla piu' piccola griglia a sistema che basta, in ordine di lettura
        Assert.Contains("if (g && eImpaginata(g.nome)) return amm.filter(function (x) { return x.posti >= area; })[0] || null;",
            Funzione(js, "function grigliaPiuGrande("));
        Assert.Contains("var nuova = grigliaPiuGrande(g, serveCol, serveRig, area);", Funzione(js, "function spostaInPagina("));
        Assert.Contains("var nuova = grigliaPiuGrande(g, serveCol, serveRig, area);", Funzione(js, "function bloccaCasella("));
        // la griglia si puo' scegliere anche come impaginata, ma non con referenze allargate
        string scegli = Funzione(js, "function scegliGriglia(");
        Assert.Contains("var g = eImpaginata(nome) ? grigliaImpaginata(pagina)", scegli);
        Assert.Contains("if (eImpaginata(g.nome) && qualcunoAllargato(dentro)) {", scegli);
    }

    // ------------------------------------------------------------------ la prova

    private sealed record Box(string Codice, decimal X, decimal Y, decimal W, decimal H);

    /// <summary>
    /// Pagina 14 di 0S26_26_B_UFI_B, ridisegnata con numeri tondi: tre box nella prima riga (il terzo
    /// sborda a destra, come quello di Negroni), due nella seconda e due nella terza. Pagina larga 210.
    /// </summary>
    private static List<Box> BoxDiPagina14() => new()
    {
        new("9001", 8.5m, 26m, 64.5m, 82m), new("9002", 76.2m, 26m, 62.5m, 82m), new("9003", 138.7m, 26m, 91.8m, 82m),
        new("9004", 8.5m, 112m, 95m, 80m), new("9005", 106.5m, 112m, 95m, 80m),
        new("9006", 8.5m, 196m, 93m, 78m), new("9007", 106.5m, 196m, 95m, 78m),
    };

    private sealed record Prova(string Db, int IdVol, ServizioTimone.Chi Agenzia, ServizioTimone.Chi Marketing);

    private static Correggo4Context Contesto(string nomeDb) =>
        new(new DbContextOptionsBuilder<Correggo4Context>()
            .UseInMemoryDatabase(nomeDb)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    /// <summary>Agenzia, Marketing e un volantino con la pagina 1 come la 14 e la pagina 2 senza box.</summary>
    private static async Task<Prova> ProvaAsync()
    {
        string db = "correggo4-timone-ricalco-" + Guid.NewGuid().ToString("N");
        using var ctx = Contesto(db);
        var agenzia = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local", Username = "agenzia-prova",
            Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        var marketing = new Utenti
        {
            Nome = "Marketing", Cognome = "Prova", Email = "marketing@prova.local", Username = "marketing-prova",
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = ServizioTimone.TipoFicoMarketing, Attivo = true,
            DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.AddRange(agenzia, marketing);

        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = "Volantino", Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();

        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        VolantiniPagine Pagina(short numero) => new()
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = numero, Versione = 1,
            Path = $"pag{numero}_v1", PathFisico = $"{Promo}/Volantino/pag{numero}_v1", DataVersione = DateTime.UtcNow
        };
        var pagina = Pagina(1);
        ctx.VolantiniPagines.AddRange(pagina, Pagina(2));
        await ctx.SaveChangesAsync();
        ctx.VolantiniPagineElementis.AddRange(BoxDiPagina14().Select(b => new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "BOX_STD_" + b.Codice, Basecode = b.Codice, Contenuto = "",
            PosizioneX = b.X, PosizioneY = b.Y, Larghezza = b.W, Altezza = b.H
        }));
        await ctx.SaveChangesAsync();

        return new Prova(db, vol.Id,
            new ServizioTimone.Chi(agenzia.Id, agenzia.Ruolo, null, "Agenzia Prova"),
            new ServizioTimone.Chi(marketing.Id, marketing.Ruolo, marketing.TipoUtenteFico, "Marketing Prova"));
    }

    private static async Task ApriFinestraAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        var e = await new ServizioTimone(ctx).SalvaFinestraAsync(p.Agenzia, Promo,
            DateTime.UtcNow.AddMinutes(-5), DateTime.UtcNow.AddHours(1));
        Assert.True(e.Ok, e.Messaggio);
    }

    private static async Task ChiudiFinestraAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        var e = await new ServizioTimone(ctx).ChiudiFinestraAsync(p.Agenzia, Promo);
        Assert.True(e.Ok, e.Messaggio);
    }

    /// <summary>Le referenze delle caselle 3 e 4 si scambiano di posto.</summary>
    private static void Scambia34(Dictionary<string, short> posizioni)
    {
        posizioni["9003"] = 4;
        posizioni["9004"] = 3;
    }

    /// <summary>
    /// Il Marketing salva la pagina 1 con «griglia» e le referenze nelle loro caselle d'origine,
    /// cambiate da «sposta» (tolta da «sposta» = fuori volantino); «larga» e' una referenza
    /// allargata su due caselle.
    /// </summary>
    private static async Task<ServizioTimone.Esito> SalvaAsync(Prova p, string griglia,
        Action<Dictionary<string, short>> sposta, string? larga = null, string? grigliaPagina2 = null)
    {
        using var ctx = Contesto(p.Db);
        var piano = await ctx.Timoni.AsNoTracking().SingleAsync(t => t.IdVol == p.IdVol);
        var pagine = await ctx.TimonePagine.AsNoTracking().Where(x => x.IdTimone == piano.Id).ToListAsync();
        var voci = await ctx.TimoneVoci.AsNoTracking().Where(v => v.IdTimone == piano.Id).ToListAsync();
        Assert.Equal(7, voci.Count);

        var posizioni = voci.ToDictionary(v => v.Codice, v => v.PosizioneOrigine!.Value);
        sposta(posizioni);
        // chi non ha piu' una casella va fuori volantino
        var salvate = voci.Select(v => posizioni.TryGetValue(v.Codice, out var k)
            ? new ServizioTimone.VoceSalvata(v.Id, v.IdPaginaTimone, k, ServizioTimone.VoceInPagina, null,
                                             v.Codice == larga ? (short)2 : null)
            : new ServizioTimone.VoceSalvata(v.Id, null, null, ServizioTimone.VoceFuoriVolantino, null)).ToList();
        var salvatePagine = pagine.Select(x => new ServizioTimone.PaginaSalvata(
            x.Id, x.Numero == 1 ? griglia : grigliaPagina2, null, null, null)).ToList();
        return await new ServizioTimone(ctx).SalvaAsync(p.Marketing, p.IdVol, piano.Revisione, salvatePagine, salvate);
    }

    private static async Task<ScambiTimone?> ScambiAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        return await new ServizioTimone(ctx).ScambiPerPluginAsync(p.IdVol);
    }

    private static string Timone() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");

    private static string Funzione(string sorgente, string firma)
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata in timone.js: il test va aggiornato");
        int fine = sorgente.IndexOf("\n    }\n", inizio, StringComparison.Ordinal);
        Assert.True(fine > inizio, $"fine di «{firma}» non trovata");
        return sorgente.Substring(inizio, fine - inizio);
    }

    private static string RadiceApplicazione()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Correggo4", "Correggo4.csproj")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return Path.Combine(dir!.FullName, "Correggo4");
    }
}
