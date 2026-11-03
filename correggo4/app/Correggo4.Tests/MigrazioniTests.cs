using Correggo4.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1186: lo schema di Correggo4 si aggiorna con le migration di EF, applicate all'avvio come in
/// Istanta. Niente database: il contesto punta a un indirizzo finto, e i controlli leggono solo il
/// modello e le migration compilate.
/// </summary>
public class MigrazioniTests
{
    private static Correggo4Context Contesto() =>
        new(new DbContextOptionsBuilder<Correggo4Context>().UseNpgsql("Host=non-usato;Database=nessuno").Options);

    private static string Script(Correggo4Context ctx, string da, string a) =>
        ctx.GetService<IMigrator>().GenerateScript(da, a);

    private static string Nome(string idMigration) => idMigration[(idMigration.IndexOf('_') + 1)..];

    [Fact]
    public void Il_modello_coincide_con_l_ultima_migration()
    {
        // se fallisce, manca una migration: dotnet ef migrations add <Nome> -o Migrations
        using var ctx = Contesto();
        Assert.False(ctx.Database.HasPendingModelChanges());
    }

    [Fact]
    public void Le_migration_sono_la_Baseline_e_poi_la_modifica_del_gruppo()
    {
        using var ctx = Contesto();
        var elenco = ctx.Database.GetMigrations().ToList();
        Assert.True(elenco.Count >= 2);
        Assert.Equal("Baseline", Nome(elenco[0]));
        Assert.Equal("AggiungiModificaGruppo", Nome(elenco[1]));
    }

    [Fact]
    public void La_Baseline_non_tocca_lo_schema()
    {
        using var ctx = Contesto();
        string baseline = ctx.Database.GetMigrations().First();
        string sql = Script(ctx, Migration.InitialDatabase, baseline);
        Assert.DoesNotContain("CREATE TABLE volantini", sql);
        Assert.DoesNotContain("ALTER TABLE", sql);
        Assert.Contains("__EFMigrationsHistory", sql);
    }

    [Fact]
    public void AggiungiModificaGruppo_aggiunge_solo_la_colonna()
    {
        using var ctx = Contesto();
        var elenco = ctx.Database.GetMigrations().ToList();
        string sql = Script(ctx, elenco[0], elenco[1]);
        Assert.Contains("ALTER TABLE volantini_timone_voci ADD modifica_gruppo jsonb;", sql);
        Assert.DoesNotContain("CREATE TABLE", sql);
        Assert.DoesNotContain("DROP", sql);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("true", true)]
    [InlineData("false", false)]
    public void Applicare_all_avvio_vale_se_non_e_spento(string? valore, bool atteso)
    {
        var dati = new Dictionary<string, string?>();
        if (valore != null) dati[Migrazioni.ChiaveApplicaAllAvvio] = valore;
        var conf = new ConfigurationBuilder().AddInMemoryCollection(dati).Build();
        Assert.Equal(atteso, Migrazioni.DaApplicareAllAvvio(conf));
    }

    [Fact]
    public void Con_il_database_in_memoria_l_avvio_non_tenta_migration()
    {
        var servizi = new ServiceCollection()
            .AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase("correggo4-migrazioni-" + Guid.NewGuid().ToString("N")))
            .BuildServiceProvider();
        var conf = new ConfigurationBuilder().Build();

        var errore = Record.Exception(() => Migrazioni.ApplicaAllAvvio(servizi, conf, NullLogger.Instance));
        Assert.Null(errore);
    }
}
