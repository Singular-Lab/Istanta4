using System.Text.RegularExpressions;
using Istanta.Models;
using Istanta.Utility;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-6e4320b7: la ricerca della pagina Archivio non distingue maiuscole e minuscole.
///
/// I filtri di testo (Codice, Cerca ovunque, Nome, Brand, Tipo / Gusto, Grammatura) erano
/// string.Contains, che Npgsql traduce in un confronto che distingue maiuscole e minuscole:
/// "salame" non trovava "SALAME UNGHERESE". Ora sono ILIKE (RicercaArchivio.FiltraPerTesto).
///
/// Qui si guarda l'SQL che EF genera per PostgreSQL: il contesto non apre mai una connessione,
/// come in ModifichePendentiTests. Come risponde un database vero lo dice il collaudo.
/// </summary>
public class RicercaArchivioTests
{
    private static edro21_dbContext NuovoContesto() =>
        new(new DbContextOptionsBuilder<edro21_dbContext>()
            .UseNpgsql("Host=localhost;Database=nessuno")
            .Options);

    private static string Sql(string? codice = null, string? generico = null, string? nome = null,
        string? brand = null, string? tipoGusto = null, string? grammatura = null)
    {
        using var ctx = NuovoContesto();
        return RicercaArchivio.FiltraPerTesto(ctx, ctx.Articolis, codice, generico, nome, brand, tipoGusto, grammatura)
            .ToQueryString();
    }

    /// Un LIKE che non sia ILIKE, o lo strpos con cui Npgsql traduce Contains: confronti che
    /// distinguono maiuscole e minuscole.
    private static void NessunConfrontoCheDistingueLeMaiuscole(string sql)
    {
        Assert.DoesNotMatch(new Regex(@"(?<!I)LIKE"), sql);
        Assert.DoesNotContain("strpos", sql);
    }

    [Fact]
    public void Il_modello_e_un_contiene_col_testo_alla_lettera()
    {
        Assert.Equal("%Salame%", RicercaArchivio.ModelloContiene("Salame"));
        //Quello che l'operatore scrive non fa da carattere jolly.
        Assert.Equal(@"%1\%%", RicercaArchivio.ModelloContiene("1%"));
        Assert.Equal(@"%a\_b%", RicercaArchivio.ModelloContiene("a_b"));
        Assert.Equal(@"%c\\d%", RicercaArchivio.ModelloContiene(@"c\d"));
    }

    [Theory]
    [InlineData("codice")]
    [InlineData("nome")]
    [InlineData("brand")]
    [InlineData("tipoGusto")]
    [InlineData("grammatura")]
    public void Ogni_campo_cerca_senza_distinguere_maiuscole_e_minuscole(string campo)
    {
        var sql = campo switch
        {
            "codice" => Sql(codice: "salame"),
            "nome" => Sql(nome: "salame"),
            "brand" => Sql(brand: "salame"),
            "tipoGusto" => Sql(tipoGusto: "salame"),
            _ => Sql(grammatura: "salame"),
        };

        Assert.Contains("ILIKE", sql);
        Assert.Contains(@"ESCAPE '\'", sql);
        Assert.Contains("'%salame%'", sql);
        NessunConfrontoCheDistingueLeMaiuscole(sql);
    }

    [Fact]
    public void Cerca_ovunque_guarda_il_codice_e_le_quattro_descrizioni_senza_distinguere_maiuscole()
    {
        var sql = Sql(generico: "FIORUCCI");

        //Il codice e le quattro descrizioni: cinque confronti, tutti ILIKE.
        Assert.Equal(5, Regex.Matches(sql, "ILIKE").Count);
        foreach (var colonna in new[] { "codice", "descrizione_1", "descrizione_2", "descrizione_3", "descrizione_4" })
        {
            Assert.Matches(new Regex(@"\." + colonna + @" ILIKE "), sql);
        }
        Assert.Contains("'%FIORUCCI%'", sql);
        //Resta l'unione dei due insiemi di id, la forma veloce del 7/9/2026.
        Assert.Contains("UNION", sql);
        NessunConfrontoCheDistingueLeMaiuscole(sql);
    }

    [Fact]
    public void Una_percentuale_scritta_si_cerca_alla_lettera()
    {
        var sql = Sql(tipoGusto: "1%");
        Assert.Contains(@"'%1\%%'", sql);
    }

    [Fact]
    public void I_campi_vuoti_non_filtrano()
    {
        using var ctx = NuovoContesto();
        var senzaFiltri = ctx.Articolis.ToQueryString();

        Assert.Equal(senzaFiltri, Sql());
        Assert.Equal(senzaFiltri, Sql(codice: "", generico: "", nome: "", brand: "", tipoGusto: "", grammatura: ""));
    }

    [Fact]
    public void Piu_campi_compilati_devono_valere_tutti()
    {
        var sql = Sql(nome: "salame", brand: "fiorucci");
        Assert.Equal(2, Regex.Matches(sql, "ILIKE").Count);
        Assert.Contains("'%salame%'", sql);
        Assert.Contains("'%fiorucci%'", sql);
    }

    [Fact]
    public void La_pagina_Archivio_usa_la_ricerca_senza_maiuscole()
    {
        var controller = File.ReadAllText(TrovaFile("Istanta/Controllers/ArchivioController.cs"));
        Assert.Contains("query = Utility.RicercaArchivio.FiltraPerTesto(ctx, query, search_codice, search_generic,", controller);
        Assert.Contains("search_nome, search_brand, search_tipogusto, search_gramm);", controller);
        Assert.DoesNotContain("Contains(search_", controller);
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
