using System.Security.Claims;
using System.Text;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// LA ROTTA CHE SCARICA IL REPORT IN PDF (j315).
///
/// Michele, 29/09: «quando faccio esporta pdf deve andare direttamente nei download.. fine non
/// devi fare nient'altro».
///
/// Sta in un file suo e non dentro TimoneController per due motivi: e' l'unica rotta del timone
/// che NON risponde con la busta { ok, codice, messaggio, dati } - risponde con un file, che e'
/// proprio il punto - e cosi' il controller del timone non si tocca.
///
/// COME FUNZIONA, tutto in fila: il browser disegna il report (e' lui che ha il piano e le foto),
/// ci mette dentro le immagini come data:, e manda l'HTML qui. Qui si controlla chi chiede, si
/// passa l'HTML al motore di stampa (Servizi/ServizioPdf.cs) e si rimanda il PDF come ALLEGATO:
/// e' quello che fa scendere il file nei Download senza aprire nessuna finestra.
///
/// PERCHE' L'HTML LO MANDA IL BROWSER e non lo rifa' il server: il report e' disegnato da
/// wwwroot/js/timone.js. Se lo rifacesse anche il server, da domani ci sarebbero due report che si
/// allontanano a ogni ritocco. Cosi' invece quello che si scarica e' esattamente quello che si
/// vede a schermo, sempre, per costruzione.
/// </summary>
[Authorize]
[ApiController]
[Route("Timone")]
[AutoValidateAntiforgeryToken]
public sealed class TimonePdfController : ControllerBase
{
    private readonly ServizioTimone servizio;

    public TimonePdfController(ServizioTimone servizio) => this.servizio = servizio;

    /// <summary>Il foglio da mettere nel PDF e come si deve chiamare il file.</summary>
    public sealed record Richiesta(string? Html, string? Nome);

    [HttpPost("{idVol:int}/Pdf")]
    [RequestSizeLimit(26 * 1024 * 1024)]
    public async Task<IActionResult> Pdf(int idVol, [FromBody] Richiesta? corpo)
    {
        if (!short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short idUtente))
            return StatusCode(401, new { ok = false, codice = "non_autenticato",
                                         messaggio = "Sessione scaduta: rientra." });

        var chi = await servizio.ChiAsync(idUtente);
        if (chi == null)
            return StatusCode(401, new { ok = false, codice = "non_autenticato",
                                         messaggio = "Utente non attivo." });

        // Il report delle modifiche e' dell'Agenzia (j312): il pulsante lo vede solo lei, e anche
        // la rotta lo chiede. Un pulsante nascosto non e' una serratura.
        if (!chi.Agenzia)
            return StatusCode(403, new { ok = false, codice = "non_autorizzato",
                                         messaggio = "Il report del timone lo scarica l'Agenzia." });

        // Si riusa il controllo che c'e' gia': PianoAsync risponde 404 se il volantino non
        // esiste e 403 se chi chiede non c'entra niente col timone. NON garantisce che un piano
        // sia stato aperto - per un volantino senza timone risponde «esiste: false» e va bene
        // cosi' - ma il pulsante, in quel caso, non c'e' nemmeno (vedi carica() in timone.js).
        var piano = await servizio.PianoAsync(chi, idVol);
        if (!piano.Ok)
            return StatusCode(piano.Http, new { ok = false, codice = piano.Codice,
                                                messaggio = piano.Messaggio });

        var esito = await ServizioPdf.DaHtmlAsync(corpo?.Html, HttpContext.RequestAborted);
        if (!esito.Ok)
            return StatusCode(esito.Codice == "html_troppo_grande" ? 413 : 500,
                              new { ok = false, codice = esito.Codice, messaggio = esito.Messaggio });

        return File(esito.Dati, "application/pdf", NomeFile(corpo?.Nome));
    }

    /// <summary>
    /// Il nome del file come lo propone il browser. Arriva dal browser (lo costruisce timone.js:
    /// «Report timone - volantino - v1 - 29-09-2026»), ma non si fida: si tengono solo caratteri
    /// buoni per un nome di file. Senza questa pulizia un titolo con uno slash dentro spezzerebbe
    /// l'intestazione Content-Disposition.
    /// </summary>
    private static string NomeFile(string? proposto)
    {
        string n = (proposto ?? "").Trim();
        var buono = new StringBuilder(n.Length);
        foreach (char c in n)
        {
            if (char.IsControl(c)) continue;
            if (c == '/' || c == '\\' || c == ':' || c == '*' || c == '?' || c == '"' ||
                c == '<' || c == '>' || c == '|') { buono.Append(' '); continue; }
            buono.Append(c);
        }
        n = buono.ToString().Trim();
        while (n.Contains("  ")) n = n.Replace("  ", " ");
        if (n.Length == 0) n = "Report timone";
        if (n.Length > 120) n = n.Substring(0, 120).Trim();
        return n.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? n : n + ".pdf";
    }
}
