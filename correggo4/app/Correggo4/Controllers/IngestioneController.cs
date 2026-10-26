using System.Text.Json;
using Correggo4.Ingestione;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

public class IngestioneController : Controller
{
    private readonly ImportatorePack importatore;
    private readonly ILogger<IngestioneController> log;

    public IngestioneController(ImportatorePack importatore, ILogger<IngestioneController> log)
    {
        this.importatore = importatore;
        this.log = log;
    }

    /// <summary>
    /// Riceve un .pack binario, il formato che fidelity-promotion consegna oggi
    /// al vecchio handler UploadVolFromFP.ashx.
    /// </summary>
    [HttpPost]
    [Route("Ingestione/pack")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Pack(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { esito = false, errore = "Nessun file ricevuto" });

        try
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var contenuto = LettorePack.Leggi(ms.ToArray(), file.FileName);
            return Ok(Risposta(await importatore.ImportaAsync(contenuto), contenuto.IdUtente, contenuto.Pdf.Length));
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Ingestione .pack fallita per {Nome}", file.FileName);
            return Ok(new { esito = false, errore = ex.Message });
        }
    }

    /// <summary>
    /// Riceve il materiale nella forma in cui Istanta lo produce davvero
    /// (FicoProcessController.esportaMateriale): PDF nel campo "file" e il JSON
    /// completo di PacchettoCorreggoPerFP nel campo "meta".
    ///
    /// E' il contratto piu' sensato dei due: l'incapsulamento binario del .pack
    /// serve solo a fidelity-promotion per consegnare al vecchio handler, e non
    /// aggiunge nulla. Qui si salta.
    /// </summary>
    [HttpPost]
    [Route("Ingestione/materiale")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Materiale(IFormFile? file, [FromForm] string? meta,
                                               [FromForm] string? guidKitRuntime, [FromForm] string? nomeFile)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { esito = false, errore = "Nessun PDF ricevuto nel campo 'file'" });
        if (string.IsNullOrWhiteSpace(meta))
            return BadRequest(new { esito = false, errore = "Nessun JSON ricevuto nel campo 'meta'" });

        try
        {
            var pacchetto = JsonSerializer.Deserialize<PacchettoCorreggoPerFP>(meta,
                                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                            ?? throw new InvalidDataException("Il campo 'meta' non contiene un pacchetto leggibile");

            if (pacchetto.promo == null)
                throw new InvalidDataException(
                    "Il pacchetto non ha la sezione 'promo': la aggiunge Istanta in esportaMateriale, " +
                    "quindi questo materiale non e' passato di li'");

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            byte[] pdf = ms.ToArray();

            log.LogInformation("Materiale ricevuto: {Nome}, kit {Kit}, {Byte} byte di PDF",
                               nomeFile ?? file.FileName, guidKitRuntime, pdf.Length);

            var contenuto = new ContenutoPack(pacchetto, pdf, 0);
            return Ok(Risposta(await importatore.ImportaAsync(contenuto), 0, pdf.Length));
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Ingestione materiale fallita per {Nome}", nomeFile ?? file.FileName);
            return Ok(new { esito = false, errore = ex.Message });
        }
    }

    /// <summary>
    /// Compatibilita' col vecchio handler di Correggo: fidelity-promotion fa
    /// POST {CORREGGO_IP_ADDRESS}/UploadVolFromFP.ashx con il .pack binario e
    /// legge una risposta {result, errorDetails}. Puntando FP qui, Correggo4
    /// prende il posto del Correggo legacy senza toccare FP.
    ///
    /// Il vecchio handler rispondeva con "error_detail"; FP legge "errorDetails".
    /// Li restituiamo entrambi: il disallineamento esiste nell'originale e in
    /// caso di errore FP leggerebbe undefined.
    /// </summary>
    [HttpPost]
    [Route("UploadVolFromFP.ashx")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadVolFromFP(IFormFile? file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return Ok(new { result = "error", errorDetails = "empty file", error_detail = "empty file" });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);

            var contenuto = LettorePack.Leggi(ms.ToArray(), file.FileName);
            var esito = await importatore.ImportaAsync(contenuto);

            if (!esito.Esito)
            {
                log.LogWarning("UploadVolFromFP: importazione fallita -> {Errore}", esito.Errore);
                return Ok(new { result = "error", errorDetails = esito.Errore, error_detail = esito.Errore });
            }

            log.LogInformation("UploadVolFromFP: {Titolo} v{Ver} ({Pag} pagine, {Box} box)",
                               esito.Titolo, esito.Versione, esito.Pagine, esito.Box);

            return Ok(new { result = "ok", errorDetails = "", error_detail = "" });
        }
        catch (Exception ex)
        {
            log.LogError(ex, "UploadVolFromFP fallita per {Nome}", file?.FileName);
            return Ok(new { result = "error", errorDetails = ex.Message, error_detail = ex.Message });
        }
    }

    private static object Risposta(EsitoImportazione e, short idUtente, int bytePdf) => new
    {
        esito = e.Esito,
        errore = e.Errore,
        idVolantino = e.IdVolantino,
        titolo = e.Titolo,
        classificazione = e.Classificazione,
        volantinoCreato = e.VolantinoCreato,
        versione = e.Versione,
        pagine = e.Pagine,
        box = e.Box,
        campi = e.Campi,
        idUtente,
        bytePdf,
        avvisi = e.Avvisi
    };
}
