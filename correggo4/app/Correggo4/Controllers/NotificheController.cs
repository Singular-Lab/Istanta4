using System.Security.Claims;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>L'interruttore delle email di notifica della home (j243).</summary>
public sealed class RichiestaEmailNotifiche
{
    public bool Attive { get; set; }
}

/// <summary>
/// API della campanella (j243): l'elenco delle notifiche, il «segna tutte come lette», il giro
/// ogni minuto che fa suonare il semaforo e l'interruttore delle email.
/// Come gli altri controller: utente dal cookie, antiforgery sull'header RequestVerificationToken,
/// risposta sempre nella busta { ok, codice, messaggio, dati }.
/// </summary>
[Authorize]
[ApiController]
[Route("Notifiche")]
[AutoValidateAntiforgeryToken]
public sealed class NotificheController : ControllerBase
{
    private readonly ServizioNotifiche servizio;

    public NotificheController(ServizioNotifiche servizio) => this.servizio = servizio;

    /// <summary>La tendina della campanella.</summary>
    [HttpGet("")]
    public Task<IActionResult> Elenco() => Esegui(id => servizio.ElencoAsync(id));

    /// <summary>Il giro della pagina: cosa e' arrivato dopo la notifica numero `dopo`.</summary>
    [HttpGet("Nuove")]
    public Task<IActionResult> Nuove(long dopo = 0) => Esegui(id => servizio.NuoveAsync(id, dopo));

    /// <summary>«Segna tutte come lette».</summary>
    [HttpPost("Lette")]
    public Task<IActionResult> Lette() => Esegui(id => servizio.SegnaLetteAsync(id));

    /// <summary>Lo stato dell'interruttore delle email.</summary>
    [HttpGet("Email")]
    public Task<IActionResult> LeggiEmail() => Esegui(id => servizio.LeggiEmailAsync(id));

    /// <summary>Accende o spegne le email di notifica per chi sta guardando.</summary>
    [HttpPost("Email")]
    public Task<IActionResult> SalvaEmail([FromBody] RichiestaEmailNotifiche r) =>
        Esegui(id => servizio.SalvaEmailAsync(id, r.Attive));

    private async Task<IActionResult> Esegui(Func<short, Task<object>> azione)
    {
        if (!short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short idUtente))
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Sessione scaduta: rientra." });

        var dati = await azione(idUtente);
        return Ok(new { ok = true, codice = (string?)null, messaggio = (string?)null, dati });
    }
}
