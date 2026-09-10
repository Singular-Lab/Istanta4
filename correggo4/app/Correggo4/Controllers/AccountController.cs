using System.Security.Claims;
using Correggo4.Auth;
using Correggo4.Data;
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

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, utente.Id.ToString()),
            new(ClaimTypes.Name, $"{utente.Nome} {utente.Cognome}"),
            new(ClaimTypes.Role, Ruoli.Nome(utente.Ruolo))
        };

        var identita = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                                      new ClaimsPrincipal(identita));

        return Redirect(string.IsNullOrWhiteSpace(returnUrl) ? "/" : returnUrl);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect("/Account/Login");
    }
}
