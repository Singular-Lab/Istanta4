using Correggo4.Servizi;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

public sealed class RichiestaChiusuraPlugin
{
    /// <summary>Gli id delle correzioni approvate e applicate dal Plugin ("nota:12", "edit:31:offerta"...).</summary>
    public List<string>? Approvate { get; set; }
}

/// <summary>
/// I20-1221: le rotte del Report Correggo del Plugin, chiamate da Istanta per conto dell'operatore.
/// Come Promo/AggiornaDaFidelity: il Bearer di Olimpo dell'operatore nell'header Authorization, verificato
/// su Olimpo (IdentitaOlimpo); le correzioni le legge e le chiude solo l'Agenzia.
///
///   GET  Plugin/Correzioni/{idLavorazione}         le correzioni aperte del volantino della lavorazione
///   POST Plugin/Correzioni/{idLavorazione}/Chiudi  chiude quelle approvate: { approvate: [id...] }
///
/// Risposta { ok, codice, messaggio, dati }, come le rotte delle correzioni dell'editor.
/// </summary>
[IgnoreAntiforgeryToken]
public sealed class PluginCorrezioniController : Controller
{
    private readonly IdentitaOlimpo identita;
    private readonly ServizioCorrezioni servizio;

    public PluginCorrezioniController(IdentitaOlimpo identita, ServizioCorrezioni servizio)
    {
        this.identita = identita;
        this.servizio = servizio;
    }

    [HttpGet]
    [Route("Plugin/Correzioni/{idLavorazione:int}")]
    public Task<IActionResult> Correzioni(int idLavorazione) =>
        Esegui(u => servizio.CorrezioniPerPluginAsync(u, idLavorazione));

    [HttpPost]
    [Route("Plugin/Correzioni/{idLavorazione:int}/Chiudi")]
    public Task<IActionResult> Chiudi(int idLavorazione, [FromBody] RichiestaChiusuraPlugin? r) =>
        Esegui(u => servizio.ChiudiDalPluginAsync(u, idLavorazione, r?.Approvate));

    private async Task<IActionResult> Esegui(Func<ServizioCorrezioni.Utente, Task<EsitoCorrezione>> azione)
    {
        var (utente, errore) = await identita.VerificaAsync(Request.Headers.Authorization.ToString());
        if (utente == null)
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = errore });

        var e = await azione(utente);
        return StatusCode(e.Http, new { ok = e.Ok, codice = e.Codice, messaggio = e.Messaggio, dati = e.Dati });
    }
}
