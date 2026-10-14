using Istanta.Models;
using Istanta.Utility;
using Microsoft.Extensions.Options;

/// Ogni notte, all'ora di sync_options.oraPuliziaEstrazioni (default le 3, ora di Roma), elimina
/// dalla cartella delle estrazioni di SyncFoto i pacchetti piu' vecchi di
/// sync_options.mesiConservazioneEstrazioni (default un mese). Le regole stanno in PuliziaEstrazioni.
///
/// Un pacchetto eliminato non si puo' piu' riscaricare dal registro delle sincronizzazioni:
/// SyncFoto/downloadPacchettoFoto risponde che e' scaduto.
public class PuliziaEstrazioniService : BackgroundService
{
    private readonly ILogger<PuliziaEstrazioniService> _logger;
    private readonly string cartella;
    private readonly int ora;
    private readonly int mesi;

    public PuliziaEstrazioniService(ILogger<PuliziaEstrazioniService> logger, IOptions<SyncOptions> sync_options)
    {
        _logger = logger;
        cartella = sync_options.Value.extractPath;
        ora = PuliziaEstrazioni.Ora(sync_options.Value.oraPuliziaEstrazioni);
        mesi = PuliziaEstrazioni.Mesi(sync_options.Value.mesiConservazioneEstrazioni);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        TimeZoneInfo fuso = PuliziaEstrazioni.Fuso();
        _logger.LogInformation("Pulizia estrazioni: ogni notte alle {ora}:00 ({fuso}), conserva {mesi} mesi in {cartella}", ora, fuso.Id, mesi, cartella);

        while (!stoppingToken.IsCancellationRequested)
        {
            DateTime adesso = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, fuso);
            DateTime prossima = PuliziaEstrazioni.ProssimaEsecuzione(adesso, ora);

            try
            {
                await Task.Delay(prossima - adesso, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            DateTime scadenza = PuliziaEstrazioni.Scadenza(DateTime.UtcNow, mesi);
            EsitoPuliziaEstrazioni esito = PuliziaEstrazioni.Elimina(cartella, scadenza,
                (voce, ex) => _logger.LogWarning(ex, "Pulizia estrazioni: non riesco a eliminare {voce}", voce));

            _logger.LogInformation("Pulizia estrazioni: eliminate {eliminate} voci create prima del {scadenza:u}, {errori} errori",
                esito.Eliminate, scadenza, esito.Errori);
        }
    }
}
