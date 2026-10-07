using System.Security.Claims;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>CONSULTA TUTTI I VOLANTINI (j213): per tutti i ruoli, in sola lettura. Regole in ServizioStorico.</summary>
[Authorize]
[Route("Storico")]
public sealed class StoricoController : Controller
{
    private readonly ServizioStorico storico;
    private readonly ServizioCorrezioni correzioni;

    public StoricoController(ServizioStorico storico, ServizioCorrezioni correzioni)
    {
        this.storico = storico;
        this.correzioni = correzioni;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(string? cerca, int pagina = 1)
    {
        ViewBag.Nome = User.Identity?.Name ?? "";
        return View(await storico.ElencoAsync(cerca, pagina));
    }

    [HttpGet("Pdf/{idVol:int}/{versione:int}")]
    public async Task<IActionResult> Pdf(int idVol, short versione, bool scarica = false)
    {
        var (dati, nome, errore) = await storico.PdfAsync(idVol, versione);
        if (dati == null) return NotFound(errore);
        // Senza "scarica" il browser lo apre in una scheda, come il link dell'originale (target=_blank).
        return scarica ? File(dati, "application/pdf", nome) : File(dati, "application/pdf");
    }

    [HttpPost("Zip")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Zip([FromForm] List<string>? voci, string? cerca, int pagina = 1)
    {
        var (dati, errore) = await storico.ZipAsync(voci ?? new());
        if (dati == null)
        {
            TempData["Errore"] = errore;
            return RedirectToAction(nameof(Index), new { cerca, pagina });
        }
        return File(dati, "application/zip", $"volantini_{DateTime.Now:yyyyMMdd_HHmm}.zip");
    }

    [HttpGet("Report/{idVol:int}/{versione:int}")]
    public async Task<IActionResult> Report(int idVol, short versione, bool tutte = false, bool ok = false,
                                            long? box = null, bool incorporato = false)
    {
        if (!short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short id)) return RedirectToAction("Login", "Account");
        var u = await correzioni.UtenteAsync(id);
        if (u == null) return RedirectToAction("Login", "Account");
        var r = await storico.ReportAsync(u, idVol, versione, tutte, ok, box);
        if (r == null) return NotFound();
        // incorporato (j214): solo le voci, per la finestra REPORT CORREZIONI dell'editor.
        return incorporato ? PartialView("_VociReport", r) : View(r);
    }
}
