using System.Text.RegularExpressions;
using Istanta.Models;
using Istanta.Utility;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-a77bd7b2: la pagina Archivio lenta in apertura e in ricerca.
///
/// Ogni ricerca girava cinque volte: il conteggio, la pagina con descrizioni e foto incluse (tre query,
/// perche' le due delle collezioni ripetevano filtri, ordinamento e paginazione) e il contatore delle
/// foto. Ora gira due volte: i contatori in una query, gli id della pagina in un'altra; descrizioni e
/// foto si leggono per id. La merceologia leggeva il JSON di ogni record di ogni tracciato; ora solo
/// dell'ultimo record di ogni codice. Le miniature dei Dettagli chiusi non si scaricano finche' non si
/// aprono.
///
/// Si guarda l'SQL che EF genera per PostgreSQL: il contesto non apre mai una connessione, come in
/// ModifichePendentiTests. Che i risultati siano gli stessi di prima e i tempi migliori lo dicono il
/// collaudo e il log della pagina.
/// </summary>
public class PaginaArchivioTests
{
    private static edro21_dbContext NuovoContesto() =>
        new(new DbContextOptionsBuilder<edro21_dbContext>()
            .UseNpgsql("Host=localhost;Database=nessuno")
            .Options);

    /// La ricerca come la costruisce la pagina, con un filtro di testo sul nome.
    private static IQueryable<Articoli> RicercaPerNome(edro21_dbContext ctx, string? ordinamento)
    {
        IQueryable<Articoli> query = ctx.Articolis.Where(a => a.ArticoliDescrizionis!.Any());
        query = RicercaArchivio.FiltraPerTesto(ctx, query, null, null, "salame", null, null, null);
        return RicercaArchivio.Ordina(ctx, query, ordinamento);
    }

    public static IEnumerable<object?[]> Ordinamenti() =>
        new[] { new object?[] { null }, new object?[] { "codice_desc" }, new object?[] { "recenti" }, new object?[] { "descrizione" } };

    [Theory]
    [MemberData(nameof(Ordinamenti))]
    public void I_due_contatori_sono_una_query_sola_con_la_ricerca_una_volta(string? ordinamento)
    {
        using var ctx = NuovoContesto();
        var sql = RicercaArchivio.QueryConteggi(RicercaPerNome(ctx, ordinamento)).ToQueryString();

        Assert.Single(Regex.Matches(sql, "ILIKE"));
        Assert.Equal(2, Regex.Matches(sql, @"count\(", RegexOptions.IgnoreCase).Count);
        //Il contatore delle foto guarda articoli_foto, nella stessa query.
        Assert.Contains("articoli_foto", sql);
    }

    [Theory]
    [MemberData(nameof(Ordinamenti))]
    public void La_ricerca_della_pagina_chiede_solo_gli_id_nell_ordine_scelto(string? ordinamento)
    {
        using var ctx = NuovoContesto();
        var sql = RicercaArchivio.QueryIdPagina(RicercaPerNome(ctx, ordinamento), 20, 20).ToQueryString();

        Assert.Matches(new Regex(@"SELECT \w+\.id\s+FROM articoli"), sql);
        Assert.Single(Regex.Matches(sql, "ILIKE"));
        Assert.Contains("ORDER BY", sql);
        Assert.Contains("LIMIT", sql);
        Assert.Contains("OFFSET", sql);
        if (ordinamento == "descrizione")
        {
            //La riga base delle descrizioni, quella con area e canale vuoti.
            Assert.Contains("area IS NULL", sql);
        }
    }

    [Fact]
    public void Descrizioni_e_foto_si_leggono_per_id_senza_rifare_la_ricerca()
    {
        using var ctx = NuovoContesto();
        var sql = RicercaArchivio.ArticoliConDettagli(ctx, new List<long> { 3, 1, 2 }).ToQueryString();

        Assert.Contains("ANY", sql);
        Assert.DoesNotContain("ILIKE", sql);
        Assert.DoesNotContain("LIMIT", sql);
    }

    [Fact]
    public void Gli_articoli_tornano_nell_ordine_della_pagina()
    {
        var letti = new[] { new Articoli { Id = 1, Codice = "A" }, new Articoli { Id = 2, Codice = "B" }, new Articoli { Id = 3, Codice = "C" } };

        Assert.Equal(new long[] { 3, 1, 2 }, RicercaArchivio.NellOrdineDellaPagina(letti, new long[] { 3, 1, 2 }).Select(a => a.Id));
        //Un id ripetuto conta una volta, al primo posto; un articolo fuori dalla pagina non c'e'.
        Assert.Equal(new long[] { 2, 1 }, RicercaArchivio.NellOrdineDellaPagina(letti, new long[] { 2, 1, 2 }).Select(a => a.Id));
        Assert.Empty(RicercaArchivio.NellOrdineDellaPagina(letti, Array.Empty<long>()));
    }

    [Fact]
    public void La_merceologia_legge_il_json_solo_dell_ultimo_record_di_ogni_codice()
    {
        var sql = RicercaArchivio.QueryMerceologia(suPostgres: true);

        var inizioInterna = sql.IndexOf("(SELECT codice, MAX(id) AS id FROM promo_tracciati_records", StringComparison.Ordinal);
        var fineInterna = sql.IndexOf(") ultimo", StringComparison.Ordinal);
        Assert.True(inizioInterna >= 0 && fineInterna > inizioInterna, sql);
        var interna = sql.Substring(inizioInterna, fineInterna - inizioInterna);
        //L'ultimo record di ogni codice si trova senza leggere il JSON.
        Assert.Contains("GROUP BY codice", interna);
        Assert.DoesNotContain("json", interna, StringComparison.OrdinalIgnoreCase);
        //Il JSON si legge solo dei record trovati.
        Assert.Contains("JOIN promo_tracciati_records r ON r.id = ultimo.id", sql);
        Assert.Contains("WHERE r.dato IS JSON", sql);
        Assert.Equal(3, Regex.Matches(sql, @"r\.dato::json ->> '(reparto|settore|categoria)'").Count);
        Assert.DoesNotContain("ROW_NUMBER", sql);

        //Su SQL Server resta la query di prima.
        Assert.Contains("JSON_VALUE(CAST(dato AS nvarchar(max)), '$.reparto')", RicercaArchivio.QueryMerceologia(suPostgres: false));
    }

    [Fact]
    public void La_pagina_usa_contatori_pagina_e_merceologia_nuovi_e_scrive_i_tempi_nel_log()
    {
        var controller = File.ReadAllText(TrovaFile("Istanta/Controllers/ArchivioController.cs"));

        Assert.Contains("IQueryable<Articoli> query = ctx.Articolis.Where(a => a.ArticoliDescrizionis!.Any());", controller);
        Assert.Contains("query = Utility.RicercaArchivio.Ordina(ctx, query, ordinamento);", controller);
        Assert.Contains("var conteggi = await Utility.RicercaArchivio.ContaAsync(query);", controller);
        Assert.Contains("var result = await Utility.RicercaArchivio.PaginaAsync(ctx, query, skip, recordPerPage);", controller);
        Assert.Contains("ViewBag.kpiConFoto = conteggi.ConFoto;", controller);
        Assert.Contains("cmd.CommandText = Utility.RicercaArchivio.QueryMerceologia(suPostgres);", controller);
        Assert.Contains("_cacheMerceologia ??= new Utility.CacheConRinnovo<Dictionary<string, string[]>>(", controller);
        Assert.Contains("\"Archivio: pagina {Pagina} in {Tutto} ms", controller);
        //Le query di prima, che rifacevano la ricerca.
        Assert.DoesNotContain("await query.Skip(skip).Take(recordPerPage).ToListAsync()", controller);
        Assert.DoesNotContain("await query.CountAsync(a => a.ArticoliFotos.Any())", controller);
    }

    [Fact]
    public void Le_miniature_di_Olimpo_si_scaricano_solo_quando_si_vedono()
    {
        var vista = File.ReadAllText(TrovaFile("Istanta/Views/Archivio/Index.cshtml"));

        foreach (var miniatura in new[] { "thumbnail", "thumbFotoTabNaz", "thumbFotoTabScope" })
        {
            Assert.Contains("<img src=\"@" + miniatura + "\" loading=\"lazy\"", vista);
        }
    }

    /// I20-1213: il corpo di eseguiRicerca, dove la pagina decide se cercare.
    private static string CorpoDellaRicerca(string controller)
    {
        var inizio = controller.IndexOf("private async Task<IActionResult> eseguiRicerca(", StringComparison.Ordinal);
        var fine = controller.IndexOf("return View();", controller.IndexOf("ViewBag.kpiSenzaFoto = conteggi.Totale - conteggi.ConFoto;", StringComparison.Ordinal), StringComparison.Ordinal);
        Assert.True(inizio >= 0 && fine > inizio, "eseguiRicerca non trovata nel controller");
        return controller.Substring(inizio, fine - inizio);
    }

    [Fact]
    public void I20_1213_la_pagina_si_apre_senza_ricerca_con_i_contatori_della_ricerca_a_zero()
    {
        var controller = File.ReadAllText(TrovaFile("Istanta/Controllers/ArchivioController.cs"));
        var corpo = CorpoDellaRicerca(controller);

        //La GET apre senza cercare, Cerca e il cambio pagina (POST) cercano.
        Assert.Contains("null, null, null, null, null, 0, 0, cerca: false);", controller);
        Assert.Contains("search_foto, ordinamento, Page, any_changed, cerca: true);", controller);

        //All'apertura: "In archivio" letto, poi i tre contatori a zero, nessun elenco, e si risponde
        //prima di contare e di leggere la pagina di articoli.
        var totale = corpo.IndexOf("ViewBag.totaleArchivio = await ctx.Articolis.CountAsync();", StringComparison.Ordinal);
        var apertura = corpo.IndexOf("if (!cerca)", StringComparison.Ordinal);
        var conteggi = corpo.IndexOf("Utility.RicercaArchivio.ContaAsync(query)", StringComparison.Ordinal);
        var pagina = corpo.IndexOf("Utility.RicercaArchivio.PaginaAsync(", StringComparison.Ordinal);
        Assert.True(totale >= 0 && apertura > totale && conteggi > apertura && pagina > conteggi);
        var bloccoApertura = corpo.Substring(apertura, conteggi - apertura);
        bloccoApertura = bloccoApertura.Substring(0, bloccoApertura.IndexOf("return View();", StringComparison.Ordinal));
        foreach (var riga in new[] { "ViewBag.conteggio = 0;", "ViewBag.kpiConFoto = 0;", "ViewBag.kpiSenzaFoto = 0;", "ViewBag.TotPagine = 0;", "ViewBag.lista_ricerca = null;" })
        {
            Assert.Contains(riga, bloccoApertura);
        }

        //I 27 articoli senza descrizioni restano fuori dalla ricerca, contati solo in "In archivio".
        Assert.Contains("IQueryable<Articoli> query = ctx.Articolis.Where(a => a.ArticoliDescrizionis!.Any());", corpo);
    }

    [Fact]
    public void I20_1213_senza_ricerca_la_vista_non_mostra_elenco_e_lo_zero_di_senza_foto_non_e_in_rosso()
    {
        var vista = File.ReadAllText(TrovaFile("Istanta/Views/Archivio/Index.cshtml"));

        Assert.Contains("@if (ViewBag.lista_ricerca != null)", vista);
        Assert.Contains("((int?)ViewBag.kpiSenzaFoto ?? 0) > 0 ? \"attenzione\"", vista);
    }

    [Fact]
    public void I20_1213_i_contatori_si_calcolano_prima_dell_ordinamento()
    {
        var corpo = CorpoDellaRicerca(File.ReadAllText(TrovaFile("Istanta/Controllers/ArchivioController.cs")));

        var conteggi = corpo.IndexOf("var conteggi = await Utility.RicercaArchivio.ContaAsync(query);", StringComparison.Ordinal);
        var ordinamento = corpo.IndexOf("query = Utility.RicercaArchivio.Ordina(ctx, query, ordinamento);", StringComparison.Ordinal);
        Assert.True(conteggi >= 0 && ordinamento > conteggi, "l'ordinamento deve venire dopo i contatori");
    }

    [Fact]
    public void I20_1213_ordinando_per_descrizione_non_si_perdono_gli_articoli_senza_riga_base()
    {
        using var ctx = NuovoContesto();
        var sql = RicercaArchivio.QueryIdPagina(RicercaPerNome(ctx, "descrizione"), 0, 40).ToQueryString();

        //Giunzione esterna con la riga base: un articolo senza la riga base resta nell'elenco.
        Assert.Contains("LEFT JOIN", sql);
        Assert.DoesNotContain("INNER JOIN", sql);
        Assert.Contains("area IS NULL", sql);
        //In fondo, prima della descrizione si ordina per "manca la descrizione".
        Assert.Matches(new Regex(@"ORDER BY CASE\s+WHEN"), sql);
        Assert.Matches(new Regex(@"THEN 1\s+ELSE 0\s+END,\s+\w+\.descrizione_1"), sql);
    }

    private static string TrovaFile(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
