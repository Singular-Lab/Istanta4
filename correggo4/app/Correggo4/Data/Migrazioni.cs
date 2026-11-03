using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Correggo4.Data;

/// <summary>
/// I20-1186: le migration di EF su Correggo4, come su Istanta (I20-994, I20-1106).
///
/// Fino a qui lo schema si cambiava a mano: correggo4/db/correggo4_schema.sql e un ALTER lanciato
/// su ogni database. La prima migration (Baseline) ha Up e Down vuoti: registra lo schema che i
/// database hanno gia' (le 31 tabelle di correggo4_schema.sql) senza toccarlo. Da li' in poi ogni
/// cambio viaggia con la sua migration, che Correggo4 applica all'avvio.
/// </summary>
public static class Migrazioni
{
    /// <summary>
    /// Connessione per i comandi di dotnet ef che non toccano un database: migrations add e
    /// migrations script. Non punta a niente di reale; database update riceve la connessione
    /// vera con --connection.
    /// </summary>
    public const string ConnessioneDesignTime = "Host=localhost;Database=correggo4_design_time";

    /// <summary>
    /// Chiave di configurazione che spegne l'applicazione delle migration all'avvio
    /// (variabile d'ambiente Migrazioni__ApplicaAllAvvio=false). Senza, vale true.
    /// </summary>
    public const string ChiaveApplicaAllAvvio = "Migrazioni:ApplicaAllAvvio";

    public static bool DaApplicareAllAvvio(IConfiguration configuration)
    {
        return configuration.GetValue<bool>(ChiaveApplicaAllAvvio, true);
    }

    /// <summary>
    /// Applica all'avvio le migration pendenti. Un errore ferma l'avvio: meglio che partire su uno
    /// schema diverso da quello che il codice si aspetta. Lo stesso vale se il modello non coincide
    /// con l'ultima migration: Migrate() si rifiuta per "pending model changes" senza applicare niente.
    /// Con il database in memoria dei test non c'e' schema da aggiornare e si salta.
    /// </summary>
    public static void ApplicaAllAvvio(IServiceProvider services, IConfiguration configuration, ILogger logger)
    {
        if (!DaApplicareAllAvvio(configuration))
        {
            logger.LogWarning("Migration non applicate all'avvio: {Chiave} e' false. Lo schema va aggiornato a mano.", ChiaveApplicaAllAvvio);
            return;
        }

        using var scope = services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        if (!ctx.Database.IsRelational())
            return;

        var pendenti = ctx.Database.GetPendingMigrations().ToList();
        if (pendenti.Count == 0)
        {
            logger.LogInformation("Correggo4Context: nessuna migration da applicare.");
            return;
        }

        logger.LogInformation("Correggo4Context: applico {Quante} migration: {Elenco}.", pendenti.Count, string.Join(", ", pendenti));
        ctx.Database.Migrate();
        logger.LogInformation("Correggo4Context: migration applicate.");
    }
}

/// <summary>
/// dotnet ef costruisce il contesto da qui e non dall'applicazione, che per partire vorrebbe
/// appsettings.json e il resto della configurazione.
/// </summary>
public class FabbricaDesignTime : IDesignTimeDbContextFactory<Correggo4Context>
{
    public Correggo4Context CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<Correggo4Context>();
        options.UseNpgsql(Migrazioni.ConnessioneDesignTime);
        return new Correggo4Context(options.Options);
    }
}
