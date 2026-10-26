using Correggo4.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// LEGENDA (j216): il "Manuale Correggo per Category" in PDF, richiesto da Michele il 14/9.
/// Solo Category e Marketing (ruolo GDO): l'Agenzia non corregge e non lo vede.
/// Il file sta nello storage, non in wwwroot, cosi' non e' scaricabile senza essere entrati.
/// </summary>
[Authorize(Roles = Ruoli.Gdo)]
[Route("Legenda")]
public sealed class LegendaController : Controller
{
    public const string NomeFile = "Legenda Correggo.pdf";
    public const string NomeSulDisco = "legenda-correggo.pdf";

    private readonly IConfiguration cfg;

    public LegendaController(IConfiguration cfg) => this.cfg = cfg;

    /// <summary>Cartella dei documenti: Storage:DocumentiPath, oppure "documenti" accanto ai volantini.</summary>
    public static string Cartella(IConfiguration cfg)
    {
        string? scelta = cfg["Storage:DocumentiPath"];
        if (!string.IsNullOrWhiteSpace(scelta)) return scelta;
        string volantini = cfg["Storage:VolantiniPath"] ?? "/srv/istanta4/correggo4/storage/volantini";
        string? padre = Path.GetDirectoryName(volantini.TrimEnd('/', '\\'));
        return Path.Combine(padre ?? "/srv/istanta4/correggo4/storage", "documenti");
    }

    [HttpGet("")]
    public IActionResult Index(bool scarica = false)
    {
        string file = Path.Combine(Cartella(cfg), NomeSulDisco);
        // System.IO.File: dentro un Controller "File" e' il metodo che restituisce i file (CS0119).
        if (!System.IO.File.Exists(file)) return NotFound("La legenda non è ancora stata caricata.");

        // Senza "scarica" il browser lo apre nella sua scheda; il nome serve comunque, perche' e' quello
        // che il visualizzatore PDF propone quando l'utente lo salva.
        Response.Headers.ContentDisposition =
            new System.Net.Mime.ContentDisposition { FileName = NomeFile, Inline = !scarica }.ToString();
        return PhysicalFile(file, "application/pdf");
    }
}
