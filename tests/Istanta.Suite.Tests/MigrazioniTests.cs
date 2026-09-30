using Istanta.Models;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-994: i due contesti passano alle migration di EF, partendo da una Baseline vuota,
/// e la prima migration vera allarga articoli.ean a 300 e Attivita.contract a 5000.
/// Nessun test si connette a un database: i contesti si costruiscono dalle fabbriche di
/// design time, con una connessione che non punta a niente.
/// </summary>
public class MigrazioniTests
{
    private static edro21_dbContext Contesto1() => new FabbricaDesignTimeContesto1().CreateDbContext(Array.Empty<string>());
    private static Edro21_DbContext2 Contesto2() => new FabbricaDesignTimeContesto2().CreateDbContext(Array.Empty<string>());

    [Fact]
    public void Nel_modello_ean_e_lungo_300_e_contract_5000()
    {
        using var ctx = Contesto1();

        Assert.Equal(300, ctx.Model.FindEntityType(typeof(Articoli))!.FindProperty(nameof(Articoli.Ean))!.GetMaxLength());
        Assert.Equal(5000, ctx.Model.FindEntityType(typeof(Attivitum))!.FindProperty(nameof(Attivitum.Contract))!.GetMaxLength());
    }

    // Condividono la connessione: con la tabella predefinita ognuno leggerebbe le migration dell'altro.
    [Fact]
    public void I_due_contesti_hanno_ognuno_la_sua_tabella_di_storico()
    {
        using var ctx1 = Contesto1();
        using var ctx2 = Contesto2();

        var storico1 = RelationalOptionsExtension.Extract(ctx1.GetService<IDbContextOptions>()).MigrationsHistoryTableName;
        var storico2 = RelationalOptionsExtension.Extract(ctx2.GetService<IDbContextOptions>()).MigrationsHistoryTableName;

        Assert.Equal("__EFMigrationsHistory_ctx1", storico1);
        Assert.Equal("__EFMigrationsHistory_ctx2", storico2);
    }

    // Program.cs registra i contesti con lo stesso metodo delle fabbriche: la tabella di
    // storico dell'applicazione e quella di dotnet ef non possono separarsi.
    [Fact]
    public void L_applicazione_registra_i_contesti_con_le_stesse_tabelle_di_storico()
    {
        var programma = File.ReadAllText(TrovaFile("Istanta/Program.cs"));

        Assert.Contains("AddDbContextFactory<edro21_dbContext>(options => Migrazioni.UsaPostgres(", programma);
        Assert.Contains("Migrazioni.StoricoContesto1", programma);
        Assert.Contains("AddDbContextFactory<Edro21_DbContext2>(options => Migrazioni.UsaPostgres(", programma);
        Assert.Contains("Migrazioni.StoricoContesto2", programma);
    }

    [Fact]
    public void Le_migration_sono_quelle_attese_e_in_ordine()
    {
        using var ctx1 = Contesto1();
        using var ctx2 = Contesto2();

        var nomi1 = ctx1.GetService<IMigrationsAssembly>().Migrations.Keys.Select(NomeSenzaData).ToList();
        var nomi2 = ctx2.GetService<IMigrationsAssembly>().Migrations.Keys.Select(NomeSenzaData).ToList();

        Assert.Equal(new[] { "Baseline", "EanA300ContractA5000" }, nomi1);
        Assert.Equal(new[] { "Baseline" }, nomi2);
    }

    // Lo schema c'e' gia' su ogni database: la Baseline lo registra e basta.
    [Fact]
    public void Le_due_Baseline_non_toccano_lo_schema()
    {
        foreach (var ctx in new DbContext[] { Contesto1(), Contesto2() })
        {
            using (ctx)
            {
                var baseline = CreaMigration(ctx, "Baseline");

                Assert.Empty(baseline.UpOperations);
                Assert.Empty(baseline.DownOperations);
            }
        }
    }

    [Fact]
    public void La_migration_allarga_soltanto_ean_e_contract()
    {
        using var ctx = Contesto1();

        var operazioni = CreaMigration(ctx, "EanA300ContractA5000").UpOperations;

        Assert.Equal(2, operazioni.Count);
        Assert.All(operazioni, o => Assert.IsType<AlterColumnOperation>(o));

        var contract = operazioni.Cast<AlterColumnOperation>().Single(o => o.Table == "Attivita" && o.Name == "contract");
        Assert.Equal(5000, contract.MaxLength);
        Assert.Equal(500, contract.OldColumn.MaxLength);
        Assert.False(contract.IsNullable);

        var ean = operazioni.Cast<AlterColumnOperation>().Single(o => o.Table == "articoli" && o.Name == "ean");
        Assert.Equal(300, ean.MaxLength);
        Assert.Equal(30, ean.OldColumn.MaxLength);
        Assert.True(ean.IsNullable);
    }

    // Se qualcuno cambia il modello senza generare la migration, questo test lo dice prima che
    // un database resti indietro senza che nessuno lo sappia.
    [Fact]
    public void Il_modello_non_ha_modifiche_senza_migration()
    {
        foreach (var ctx in new DbContext[] { Contesto1(), Contesto2() })
        {
            using (ctx)
            {
                var snapshot = ctx.GetService<IMigrationsAssembly>().ModelSnapshot!.Model;
                if (snapshot is IMutableModel modificabile)
                {
                    snapshot = modificabile.FinalizeModel();
                }
                snapshot = ctx.GetService<IModelRuntimeInitializer>().Initialize(snapshot);

                var differenze = ctx.GetService<IMigrationsModelDiffer>().GetDifferences(
                    snapshot.GetRelationalModel(),
                    ctx.GetService<IDesignTimeModel>().Model.GetRelationalModel());

                Assert.Empty(differenze);
            }
        }
    }

    [Theory]
    [InlineData(30)]
    [InlineData(31)]
    [InlineData(300)]
    public void Un_ean_entro_i_300_caratteri_non_si_tronca(int lunghezza)
    {
        var ean = new string('8', lunghezza);

        Assert.Equal(ean, LimitiColonne.TroncaEan(ean));
    }

    [Fact]
    public void Un_ean_oltre_i_300_caratteri_si_tronca_a_300()
    {
        var ean = new string('8', 301);

        Assert.Equal(new string('8', 300), LimitiColonne.TroncaEan(ean));
    }

    [Fact]
    public void Un_ean_mancante_resta_mancante()
    {
        Assert.Null(LimitiColonne.TroncaEan(null!));
        Assert.Equal("", LimitiColonne.TroncaEan(""));
    }

    private static Migration CreaMigration(DbContext ctx, string nome)
    {
        var assembly = ctx.GetService<IMigrationsAssembly>();
        var voce = assembly.Migrations.Single(m => NomeSenzaData(m.Key) == nome);
        return assembly.CreateMigration(voce.Value, ctx.Database.ProviderName!);
    }

    // Gli identificativi sono "20260930090246_Baseline": la data dipende da quando e' stata generata.
    private static string NomeSenzaData(string id) => id.Substring(id.IndexOf('_') + 1);

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
