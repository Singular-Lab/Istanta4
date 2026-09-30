using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Istanta.Models_2;

namespace Istanta.Models
{
    /// <summary>
    /// I20-994: le migration di EF sui due contesti.
    ///
    /// I due contesti sono nati database-first e condividono la stessa connessione: con la
    /// tabella di storico predefinita (__EFMigrationsHistory) ognuno leggerebbe anche le
    /// migration dell'altro e proverebbe ad applicarle. Per questo ognuno ha la sua.
    /// La prima migration di ciascuno (Baseline) ha Up e Down vuoti: registra lo schema che i
    /// database hanno gia', creato da pg-ctx1.sql e pg-ctx2.sql, senza toccarlo.
    /// </summary>
    public static class Migrazioni
    {
        public const string StoricoContesto1 = "__EFMigrationsHistory_ctx1";
        public const string StoricoContesto2 = "__EFMigrationsHistory_ctx2";

        /// <summary>
        /// Connessione per i comandi di dotnet ef che non toccano un database: migrations add e
        /// migrations script. Non punta a niente di reale; database update riceve la connessione
        /// vera con --connection.
        /// </summary>
        public const string ConnessioneDesignTime = "Host=localhost;Database=istanta_design_time";

        public static DbContextOptionsBuilder UsaPostgres(DbContextOptionsBuilder options, string? connessione, string tabellaStorico)
        {
            return options.UseNpgsql(connessione, npgsql => npgsql.MigrationsHistoryTable(tabellaStorico));
        }
    }

    /// <summary>
    /// I20-994: le lunghezze delle colonne che il codice deve rispettare prima di scrivere.
    /// Il modello le usa per HasMaxLength, i controller per non mandare al database un valore
    /// che rifiuterebbe: un solo posto, cosi' colonna e controllo non si separano piu'.
    /// </summary>
    public static class LimitiColonne
    {
        /// <summary>Articoli.ean: era 30 fino a I20-994.</summary>
        public const int Ean = 300;

        /// <summary>Attivita.contract: era 500 fino a I20-994.</summary>
        public const int Contract = 5000;

        /// <summary>L'EAN nei limiti della colonna. Oltre si tronca, come si faceva a 30.</summary>
        public static string TroncaEan(string valore)
        {
            if (valore == null || valore.Length <= Ean)
                return valore!;
            return valore.Substring(0, Ean);
        }
    }

    /// <summary>
    /// I20-994: dotnet ef costruisce i contesti da qui e non dall'applicazione, che per
    /// partire vorrebbe appsettings.&lt;cliente&gt;.json e il resto della configurazione.
    /// </summary>
    public class FabbricaDesignTimeContesto1 : IDesignTimeDbContextFactory<edro21_dbContext>
    {
        public edro21_dbContext CreateDbContext(string[] args)
        {
            var options = new DbContextOptionsBuilder<edro21_dbContext>();
            Migrazioni.UsaPostgres(options, Migrazioni.ConnessioneDesignTime, Migrazioni.StoricoContesto1);
            return new edro21_dbContext(options.Options);
        }
    }

    public class FabbricaDesignTimeContesto2 : IDesignTimeDbContextFactory<Edro21_DbContext2>
    {
        public Edro21_DbContext2 CreateDbContext(string[] args)
        {
            var options = new DbContextOptionsBuilder<Edro21_DbContext2>();
            Migrazioni.UsaPostgres(options, Migrazioni.ConnessioneDesignTime, Migrazioni.StoricoContesto2);
            return new Edro21_DbContext2(options.Options);
        }
    }
}
