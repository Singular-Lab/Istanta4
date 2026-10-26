using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Controllers;

public class AccountController : Controller
{
    private readonly Correggo4Context ctx;

    public AccountController(Correggo4Context ctx) => this.ctx = ctx;

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        ViewBag.ReturnUrl = returnUrl;
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(string username, string password, string? returnUrl = null)
    {
        var utente = await ctx.Utentis
            .FirstOrDefaultAsync(u => u.Username == username || u.Email == username);

        if (utente == null || !utente.Attivo || !Password.Verifica(password ?? "", utente.PswHash))
        {
            ViewBag.Errore = "Credenziali non valide.";
            ViewBag.ReturnUrl = returnUrl;
            ViewBag.Username = username;
            return View();
        }

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, Principale(utente));

        // returnUrl lo compone il cookie di autenticazione con la cartella di pubblicazione davanti
        // (/cartella/Volantini): si segue solo se resta dentro Correggo4, mai verso un altro sito.
        return !string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl)
            ? LocalRedirect(returnUrl)
            : LocalRedirect(Url.Content("~/"));
    }

    /// <summary>
    /// userNotAuthorized.aspx dell'originale (I20-1091): un Category i cui gruppi non danno una
    /// policy. Il context, cifrato con secretKeyFico, porta solo il nome da mostrare.
    /// </summary>
    [HttpGet("Account/NonAutorizzato")]
    [HttpGet("userNotAuthorized.aspx")]
    public IActionResult NonAutorizzato(string? context, [FromServices] AccessoFico accesso)
    {
        string nome = "";
        if (!string.IsNullOrWhiteSpace(context) && accesso.Chiave != null)
        {
            try
            {
                using var d = JsonDocument.Parse(Crypto.DecryptString(context, accesso.Chiave));
                if (d.RootElement.TryGetProperty("nome", out var n) && n.ValueKind == JsonValueKind.String)
                    nome = n.GetString() ?? "";
            }
            catch (Exception ex) when (ex is FormatException or CryptographicException or JsonException)
            {
                // Context illeggibile: la pagina resta senza nome.
            }
        }
        ViewBag.Nome = nome;
        return View();
    }

    /// <summary>L'identita' della sessione: la stessa per il form di login e per l'ingresso da Fidelity.</summary>
    internal static ClaimsPrincipal Principale(Utenti utente)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, utente.Id.ToString()),
            new(ClaimTypes.Name, $"{utente.Nome} {utente.Cognome}"),
            new(ClaimTypes.Role, Ruoli.Nome(utente.Ruolo))
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }
}
