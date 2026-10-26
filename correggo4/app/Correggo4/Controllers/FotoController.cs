using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// Miniature delle foto per la scheda di Edit avanzato (passo 2, j206). Le legge da Olimpo sul server,
/// come thumbnailFico.aspx dell'originale: il browser parla solo con Correggo4.
/// </summary>
[Authorize]
[Route("Foto")]
public sealed class FotoController : Controller
{
    private readonly ClienteFico fico;

    public FotoController(ClienteFico fico) => this.fico = fico;

    [HttpGet("Miniatura")]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Client)]
    public async Task<IActionResult> Miniatura(string? guidId, int width = 120, int height = 0)
    {
        if (!Guid.TryParse(guidId, out var guid)) return NotFound();
        width = Math.Clamp(width, 0, 1200);
        height = Math.Clamp(height, 0, 1200);
        if (width == 0 && height == 0) width = 120;
        var (dati, tipo) = await fico.MiniaturaAsync(guid, width, height);
        return dati == null ? NotFound() : File(dati, tipo);
    }
}
