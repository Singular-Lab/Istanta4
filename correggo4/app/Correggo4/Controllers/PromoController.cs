using System.Globalization;
using System.Security.Claims;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// GESTISCI PROMO (j209): solo Agenzia, come Home.aspx dell'originale. Form classici con redirect e
/// messaggio (TempData), antiforgery sui POST. Le regole stanno in ServizioPromo.
/// </summary>
[Authorize(Roles = "Agenzia")]
[Route("Promo")]
[AutoValidateAntiforgeryToken]
public sealed class PromoController : Controller
{
    private readonly ServizioPromo promo;
    private readonly ServizioCorrezioni correzioni;
    // j253: la finestra del Marketing sul timone si apre anche da qui, non solo dalla barra
    // dell'editor. Il servizio del timone e' lo stesso: la regola sta scritta in un posto solo.
    private readonly ServizioTimone timone;

    public PromoController(ServizioPromo promo, ServizioCorrezioni correzioni, ServizioTimone timone)
    {
        this.promo = promo;
        this.correzioni = correzioni;
        this.timone = timone;
    }

    [HttpGet("Gestisci")]
    public async Task<IActionResult> Gestisci(string? promo)
    {
        ViewBag.Nome = User.Identity?.Name ?? "";
        var vista = await this.promo.CaricaAsync(promo);
        // j253: lo stato della finestra del Marketing, letto a parte per non toccare
        // ServizioPromo ne' il modello della pagina
        ViewBag.FinestraTimone = await timone.LeggiFinestraAsync(vista.Scelta);
        return View(vista);
    }

    /// <summary>j253: apre o risistema la finestra del Marketing sul timone di una promo.</summary>
    [HttpPost("FinestraTimone")]
    public async Task<IActionResult> FinestraTimone(string? promo, string? inizio, string? fine)
    {
        var chi = await ChiTimone();
        if (chi == null) return RedirectToAction("Login", "Account");
        var e = await timone.SalvaFinestraAsync(chi, promo, DataOra(inizio), DataOra(fine));
        if (e.Ok) TempData["Fatto"] = "Finestra del Marketing salvata: adesso il timone lo sistema il Marketing.";
        else TempData["Errore"] = e.Messaggio;
        return RedirectToAction(nameof(Gestisci), new { promo });
    }

    /// <summary>j253: chiude subito la finestra del Marketing e restituisce il timone all'Agenzia.</summary>
    [HttpPost("FinestraTimone/Chiudi")]
    public async Task<IActionResult> FinestraTimoneChiudi(string? promo)
    {
        var chi = await ChiTimone();
        if (chi == null) return RedirectToAction("Login", "Account");
        var e = await timone.ChiudiFinestraAsync(chi, promo);
        if (e.Ok) TempData["Fatto"] = "Finestra del Marketing chiusa: il timone torna all'Agenzia.";
        else TempData["Errore"] = e.Messaggio;
        return RedirectToAction(nameof(Gestisci), new { promo });
    }

    private async Task<ServizioTimone.Chi?> ChiTimone() =>
        short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short id)
            ? await timone.ChiAsync(id) : null;

    [HttpPost("Finestra")]
    public Task<IActionResult> Finestra(string? promo, string? inizio, string? fine) =>
        Esegui(promo, u => this.promo.SalvaFinestraAsync(u, promo, DataOra(inizio), DataOra(fine)),
               "Finestra dei Category salvata.");

    [HttpPost("Date")]
    public Task<IActionResult> Date(string? promo, int idVol, string? inizio, string? fine, string? scadenza, bool estendi = false) =>
        Esegui(promo, u => this.promo.SalvaDateAsync(u, idVol, Data(inizio), Data(fine), Data(scadenza), estendi),
               estendi ? "Date salvate su tutti i volantini della promo." : "Date salvate.");

    [HttpPost("Blocco")]
    public Task<IActionResult> Blocco(string? promo, int? idVol, bool blocca, bool tutta = false) =>
        Esegui(promo, u => this.promo.BloccoAsync(u, tutta ? null : idVol, tutta ? promo : null, blocca),
               blocca ? $"Bloccato per {ServizioPromo.MinutiBlocco} minuti." : "Sbloccato.");

    [HttpGet("Revoca/{idVol:int}")]
    public async Task<IActionResult> Revoca(int idVol)
    {
        var u = await Utente();
        if (u == null) return RedirectToAction("Login", "Account");
        var (ant, errore) = await promo.AnteprimaRevocaAsync(u, idVol);
        if (errore != null)
        {
            TempData["Errore"] = errore;
            return RedirectToAction(nameof(Gestisci));
        }
        ViewBag.Nome = User.Identity?.Name ?? "";
        return View(ant);
    }

    [HttpPost("Revoca/{idVol:int}")]
    public async Task<IActionResult> RevocaConferma(int idVol, short versione, string? promo)
    {
        var u = await Utente();
        if (u == null) return RedirectToAction("Login", "Account");
        string? errore = await this.promo.RevocaAsync(u, idVol, versione);
        if (errore != null) TempData["Errore"] = errore;
        else TempData["Fatto"] = $"Versione {versione} revocata: il volantino è tornato alla versione precedente.";
        return RedirectToAction(nameof(Gestisci), new { promo });
    }

    private async Task<IActionResult> Esegui(string? promoScelta, Func<ServizioCorrezioni.Utente, Task<string?>> azione, string ok)
    {
        var u = await Utente();
        if (u == null) return RedirectToAction("Login", "Account");
        string? errore = await azione(u);
        if (errore != null) TempData["Errore"] = errore;
        else TempData["Fatto"] = ok;
        return RedirectToAction(nameof(Gestisci), new { promo = promoScelta });
    }

    private async Task<ServizioCorrezioni.Utente?> Utente() =>
        short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short id) ? await correzioni.UtenteAsync(id) : null;

    private static DateTime? DataOra(string? s) =>
        DateTime.TryParseExact(s, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;

    private static DateTime? Data(string? s) =>
        DateTime.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
}
