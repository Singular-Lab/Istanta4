using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// OAuthLanded.ashx (I20-1091): l'ingresso dall'hub di Fidelity, allo stesso indirizzo del Correggo
/// originale. La logica sta in AccessoFico; qui solo sessione, redirect e risposta d'errore.
/// </summary>
[AllowAnonymous]
public class OAuthController : Controller
{
    private readonly AccessoFico accesso;
    private readonly ILogger<OAuthController> log;

    public OAuthController(AccessoFico accesso, ILogger<OAuthController> log)
    {
        this.accesso = accesso; this.log = log;
    }

    /// <summary>
    /// GET {Correggo}/OAuthLanded.ashx?context=... Riuscito l'ingresso, la sessione e' il cookie del
    /// login e si va all'elenco dei volantini: e' la pagina che in Correggo4 riunisce home.aspx
    /// (Superadmin e Agenzia) e ftp.aspx (gli altri) dell'originale. Altrimenti, come l'originale,
    /// un JSON { result, error_detail }.
    /// </summary>
    [HttpGet("OAuthLanded.ashx")]
    public async Task<IActionResult> Landed(string? context)
    {
        var esito = await accesso.EntraAsync(context);

        if (esito.Utente != null)
        {
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                                          AccountController.Principale(esito.Utente));
            return LocalRedirect(Url.Content("~/"));
        }

        if (esito.NonAutorizzato != null && accesso.Chiave != null)
        {
            string q = Crypto.EncryptString(JsonSerializer.Serialize(new { nome = esito.NonAutorizzato }), accesso.Chiave);
            return Redirect(Url.Content("~/Account/NonAutorizzato") + "?context=" + Uri.EscapeDataString(q));
        }

        log.LogWarning("Ingresso da Fidelity rifiutato: {Errore}", esito.Errore);
        string json = JsonSerializer.Serialize(new { result = "", error_detail = esito.Errore ?? "" });
        return Content(json, "text/json; charset=utf-8");
    }
}
