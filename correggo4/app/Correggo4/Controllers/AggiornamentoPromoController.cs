using System.Globalization;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// Quello che nel Correggo originale era UpdateVolData.ashx (I20-1076), lasciato fuori dal porting:
/// fidelity-promotion lo chiama quando l'operatore modifica una promo (PromoController.updatePromo) per
/// allineare nome e date dei volantini gia' in Correggo. Il vecchio percorso .ashx non si espone: le
/// installazioni della nuova suite nascono gia' con fidelity che chiama Promo/AggiornaDaFidelity.
///
/// Stesso contratto dell'originale: form con guid_id, nomePromo, validitaDal, validitaAl, dataScadenza
/// (date ISO), Bearer di Olimpo nell'header Authorization, risposta { esito, error_detail }.
/// error_detail porta solo il motivo, senza stack trace; "volantino_non_trovato" vuol dire che la promo
/// non ha volantini qui, e fidelity non lo tratta come errore.
/// </summary>
public class AggiornamentoPromoController : Controller
{
    private readonly IdentitaOlimpo identita;
    private readonly ServizioPromo promo;
    private readonly ILogger<AggiornamentoPromoController> log;

    public AggiornamentoPromoController(IdentitaOlimpo identita, ServizioPromo promo,
                                        ILogger<AggiornamentoPromoController> log)
    {
        this.identita = identita;
        this.promo = promo;
        this.log = log;
    }

    [HttpPost]
    [Route("Promo/AggiornaDaFidelity")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Aggiorna([FromForm(Name = "guid_id")] string? guidId,
                                              [FromForm] string? nomePromo,
                                              [FromForm] string? validitaDal,
                                              [FromForm] string? validitaAl,
                                              [FromForm] string? dataScadenza)
    {
        var (utente, errore) = await identita.VerificaAsync(Request.Headers.Authorization.ToString());
        if (utente == null) return Esito(errore);

        if (!Guid.TryParse(guidId, out var idPromo))
            return Esito($"guid_id non valido: '{guidId}'");

        if (!Data(validitaDal, out var dal)) return Esito($"validitaDal non valida: '{validitaDal}'");
        if (!Data(validitaAl, out var al)) return Esito($"validitaAl non valida: '{validitaAl}'");
        if (!Data(dataScadenza, out var scadenza)) return Esito($"dataScadenza non valida: '{dataScadenza}'");

        errore = await promo.AggiornaDaFidelityAsync(utente, idPromo, nomePromo, dal, al, scadenza);
        if (errore == null)
            log.LogInformation("Promo {Promo} aggiornata da fidelity: nome {Nome}, {Dal} - {Al}, scadenza {Scadenza}",
                               idPromo, nomePromo, dal, al, scadenza);
        return Esito(errore);
    }

    private IActionResult Esito(string? errore)
    {
        if (errore != null && errore != "volantino_non_trovato")
            log.LogWarning("Aggiornamento promo da fidelity rifiutato: {Errore}", errore);
        return Ok(new { esito = errore == null, error_detail = errore ?? "" });
    }

    /// <summary>
    /// Data ISO come la manda fidelity (dayjs().toISOString(), in UTC). Assente = non si cambia;
    /// presente ma illeggibile = errore, come DateTime.Parse dell'originale.
    /// </summary>
    private static bool Data(string? testo, out DateTime? data)
    {
        data = null;
        if (string.IsNullOrWhiteSpace(testo)) return true;
        if (!DateTime.TryParse(testo, CultureInfo.InvariantCulture,
                               DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var d))
            return false;
        data = DateTime.SpecifyKind(d, DateTimeKind.Utc);
        return true;
    }
}
