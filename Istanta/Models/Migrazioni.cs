using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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

        /// <summary>
        /// I20-1106: gli switch di Npgsql che l'applicazione ha sempre impostato all'avvio, in un
        /// posto solo. Il primo cambia il modello: con il comportamento legacy un DateTime senza
        /// HasColumnType e' "timestamp without time zone" invece di "timestamp with time zone".
        /// Devono valere anche per dotnet ef (le fabbriche qui sotto) e per i test, altrimenti gli
        /// snapshot descrivono un modello diverso da quello che gira e Migrate() all'avvio si ferma
        /// per "pending model changes". Npgsql li legge una volta sola: vanno impostati prima che
        /// un contesto venga creato.
        /// </summary>
        public static void ImpostaComportamentoNpgsql()
        {
            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
            AppContext.SetSwitch("Npgsql.DisableDateTimeInfinityConversions", true);
        }

        /// <summary>
        /// I20-1106: chiave di configurazione che spegne l'applicazione delle migration all'avvio
        /// (variabile d'ambiente Migrazioni__ApplicaAllAvvio=false). Senza, vale true.
        /// </summary>
        public const string ChiaveApplicaAllAvvio = "Migrazioni:ApplicaAllAvvio";

        public static bool DaApplicareAllAvvio(IConfiguration configuration)
        {
            return configuration.GetValue<bool>(ChiaveApplicaAllAvvio, true);
        }

        /// <summary>
        /// I20-1106: applica all'avvio le migration pendenti dei due contesti, nell'ordine in cui
        /// Program.cs li registra. Fino a qui le migration si applicavano a mano con
        /// dotnet ef database update, che sul compilato distribuito in produzione non c'e': il
        /// bundle crea lo schema della Baseline e nessuna migration successiva lo raggiungeva.
        /// Un errore ferma l'avvio: meglio che partire su uno schema diverso da quello che il
        /// codice si aspetta, come gia' si fa per il file di configurazione del cliente.
        /// </summary>
        public static void ApplicaAllAvvio(IServiceProvider services, IConfiguration configuration, ILogger logger)
        {
            if (!DaApplicareAllAvvio(configuration))
            {
                logger.LogWarning("Migration non applicate all'avvio: {Chiave} e' false. Lo schema va aggiornato a mano.", ChiaveApplicaAllAvvio);
                return;
            }

            Applica(services.GetRequiredService<IDbContextFactory<edro21_dbContext>>().CreateDbContext(), logger);
            Applica(services.GetRequiredService<IDbContextFactory<Edro21_DbContext2>>().CreateDbContext(), logger);
        }

        private static void Applica(DbContext ctx, ILogger logger)
        {
            using (ctx)
            {
                string nome = ctx.GetType().Name;
                var pendenti = ctx.Database.GetPendingMigrations().ToList();
                if (pendenti.Count == 0)
                {
                    logger.LogInformation("{Contesto}: nessuna migration da applicare.", nome);
                    return;
                }

                logger.LogInformation("{Contesto}: applico {Quante} migration: {Elenco}.", nome, pendenti.Count, string.Join(", ", pendenti));
                ctx.Database.Migrate();
                logger.LogInformation("{Contesto}: migration applicate.", nome);
            }
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
            Migrazioni.ImpostaComportamentoNpgsql();
            var options = new DbContextOptionsBuilder<edro21_dbContext>();
            Migrazioni.UsaPostgres(options, Migrazioni.ConnessioneDesignTime, Migrazioni.StoricoContesto1);
            return new edro21_dbContext(options.Options);
        }
    }

    public class FabbricaDesignTimeContesto2 : IDesignTimeDbContextFactory<Edro21_DbContext2>
    {
        public Edro21_DbContext2 CreateDbContext(string[] args)
        {
            Migrazioni.ImpostaComportamentoNpgsql();
            var options = new DbContextOptionsBuilder<Edro21_DbContext2>();
            Migrazioni.UsaPostgres(options, Migrazioni.ConnessioneDesignTime, Migrazioni.StoricoContesto2);
            return new Edro21_DbContext2(options.Options);
        }
    }
}
