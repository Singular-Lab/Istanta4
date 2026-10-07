namespace Correggo4.Servizi;

/// <summary>
/// Il demone delle propagazioni: prende i lavori in coda e costruisce le catene, come il servizio
/// Windows CorreggoWebDeamon dell'originale (Service1.cs:71-410).
/// Fedele all'originale anche negli orari (decisione di Michele del 14/9): niente di domenica e solo
/// dalle 6 alle 20, ora italiana (Service1.cs:76-82). Fuori da quella fascia il giro salta e le
/// correzioni restano "in costruzione" fino al mattino dopo.
/// Intervallo: 10 secondi, come l'originale.
///
/// j243 - SECONDO MESTIERE: IL SEMAFORO DELLE NOTIFICHE
/// Ogni minuto lo stesso demone guarda anche le finestre dei Category e scrive gli avvisi del
/// "semaforo verde" (finestra aperta -> Category e Marketing; chiusa -> Agenzia).
/// Questo giro NON rispetta la fascia 6-20 ne' il riposo della domenica: una finestra che si apre
/// alle 21 va annunciata subito, altrimenti l'avviso arriverebbe il mattino dopo, quando non serve
/// piu' a nessuno. La fascia resta com'era per le propagazioni, che sono lavoro vero sui dati.
/// </summary>
public sealed class DemonePropagazioni : BackgroundService
{
    public static readonly TimeSpan Intervallo = TimeSpan.FromSeconds(10);
    public const int OraInizio = 6;
    public const int OraFine = 20;

    /// <summary>Ogni quanti giri si guarda il semaforo: 6 x 10s = un minuto.</summary>
    public const int GiriPerSemaforo = 6;

    private readonly IServiceScopeFactory fabbrica;
    private readonly ILogger<DemonePropagazioni> log;

    public DemonePropagazioni(IServiceScopeFactory fabbrica, ILogger<DemonePropagazioni> log)
    {
        this.fabbrica = fabbrica; this.log = log;
    }

    /// <summary>Fascia di lavoro dell'originale: lunedì-sabato, dalle 6 alle 20 comprese.</summary>
    public static bool OrarioBuono(DateTime adessoLocale) =>
        adessoLocale.DayOfWeek != DayOfWeek.Sunday && adessoLocale.Hour >= OraInizio && adessoLocale.Hour <= OraFine;

    protected override async Task ExecuteAsync(CancellationToken ferma)
    {
        log.LogInformation("Demone delle propagazioni avviato (ogni {Secondi}s, {Da}-{A} escluse le domeniche; semaforo notifiche ogni {Giri} giri)",
            Intervallo.TotalSeconds, OraInizio, OraFine, GiriPerSemaforo);
        using var orologio = new PeriodicTimer(Intervallo);
        long giro = 0;
        while (!ferma.IsCancellationRequested)
        {
            try
            {
                await orologio.WaitForNextTickAsync(ferma);
                giro++;

                // 1) il semaforo delle notifiche: sempre, anche fuori orario e di domenica
                if (giro % GiriPerSemaforo == 0)
                {
                    using var ambitoN = fabbrica.CreateScope();
                    var notifiche = ambitoN.ServiceProvider.GetRequiredService<ServizioNotifiche>();
                    int avvisi = await notifiche.SemaforoAsync(ferma);
                    if (avvisi > 0) log.LogInformation("Semaforo: {Avvisi} notifiche scritte", avvisi);
                }

                // 2) le propagazioni: solo nella fascia dell'originale
                if (!OrarioBuono(FinestreCategory.Locale(DateTime.UtcNow))) continue;

                using var ambito = fabbrica.CreateScope();
                var servizio = ambito.ServiceProvider.GetRequiredService<ServizioPropagazione>();
                int fatte = await servizio.ElaboraCodaAsync(20, ferma);
                if (fatte > 0) log.LogInformation("Demone: {Fatte} catene costruite", fatte);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Giro del demone non riuscito: riprovo al prossimo");
            }
        }
    }
}
