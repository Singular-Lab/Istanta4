using System.Security.Claims;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

public sealed class RichiestaNota
{
    public long IdBox { get; set; }
    public string? Testo { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
}

public sealed class RichiestaTesto
{
    public string? Testo { get; set; }
}

public sealed class RichiestaTimbro
{
    public long IdBox { get; set; }
    public string? Simbolo { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
}

public sealed class RichiestaOk
{
    public bool Attivo { get; set; }
}

/// <summary>Attivazione di un gemello o di tutta la catena (j223).</summary>
public sealed class RichiestaAttiva
{
    public bool Attiva { get; set; }
}

/// <summary>Propagazione dell'Edit avanzato su un prodotto gemello (j227).</summary>
public sealed class RichiestaPropagaEdit
{
    public long IdGemello { get; set; }
    public bool Propaga { get; set; }
}

/// <summary>
/// Conferma dell'Agenzia sulle propagazioni (j224): le righe spuntate e se confermare anche la
/// correzione di partenza. "Conferma tutti" e' la selezione di tutte le righe con AncheIlPilota.
/// </summary>
public sealed class RichiestaConferma
{
    public List<long>? Selezionati { get; set; }
    public bool AncheIlPilota { get; set; }
}

/// <summary>Un commento generico su un volantino (j241).</summary>
public sealed class RichiestaCommento
{
    public string? Testo { get; set; }
}

/// <summary>
/// API JSON dell'editor per note, timbri e OK visto. Le regole stanno in ServizioCorrezioni;
/// qui solo utente, antiforgery (header RequestVerificationToken) e traduzione dell'esito in HTTP.
/// Ogni risposta positiva restituisce lo stato completo delle correzioni del volantino, cosi'
/// il client ridisegna senza ricaricare la pagina.
/// </summary>
[Authorize]
[ApiController]
[Route("Correzioni")]
[AutoValidateAntiforgeryToken]
public sealed class CorrezioniController : ControllerBase
{
    private readonly ServizioCorrezioni servizio;

    public CorrezioniController(ServizioCorrezioni servizio) => this.servizio = servizio;

    [HttpPost("Nota")]
    public Task<IActionResult> NuovaNota([FromBody] RichiestaNota r) =>
        Esegui(u => servizio.NuovaNotaAsync(u, r.IdBox, r.Testo, r.X, r.Y));

    [HttpPost("Nota/{id:long}")]
    public Task<IActionResult> ModificaNota(long id, [FromBody] RichiestaTesto r) =>
        Esegui(u => servizio.ModificaNotaAsync(u, id, r.Testo));

    [HttpPost("Nota/{id:long}/Elimina")]
    public Task<IActionResult> EliminaNota(long id) =>
        Esegui(u => servizio.EliminaNotaAsync(u, id));

    [HttpPost("Nota/{id:long}/Accetta")]
    public Task<IActionResult> AccettaNota(long id) =>
        Esegui(u => servizio.AccettaNotaAsync(u, id));

    [HttpPost("Timbro")]
    public Task<IActionResult> NuovoTimbro([FromBody] RichiestaTimbro r) =>
        Esegui(u => servizio.NuovoTimbroAsync(u, r.IdBox, r.Simbolo, r.X, r.Y));

    [HttpPost("Timbro/{id:long}/Elimina")]
    public Task<IActionResult> EliminaTimbro(long id) =>
        Esegui(u => servizio.EliminaTimbroAsync(u, id));

    [HttpPost("Timbro/{id:long}/Accetta")]
    public Task<IActionResult> AccettaTimbro(long id) =>
        Esegui(u => servizio.AccettaTimbroAsync(u, id));

    [HttpPost("Box/{id:long}/Ok")]
    public Task<IActionResult> Ok(long id, [FromBody] RichiestaOk r) =>
        Esegui(u => servizio.ImpostaOkAsync(u, id, r.Attivo));

    // ---- Edit avanzato (j200): {parte} = offerta | descrizione

    [HttpPost("Edit/{id:long}/Offerta")]
    public Task<IActionResult> EditOfferta(long id, [FromBody] RichiestaEditOfferta r) =>
        Esegui(u => servizio.SalvaEditOffertaAsync(u, id, r));

    [HttpPost("Edit/{id:long}/Descrizione")]
    public Task<IActionResult> EditDescrizione(long id, [FromBody] RichiestaEditScheda r) =>
        Esegui(u => servizio.SalvaEditDescrizioneAsync(u, id, r));

    // ---- Passo 2 (j206): letture da Istanta per la scheda

    [HttpGet("Edit/{id:long}/Scheda")]
    public Task<IActionResult> EditScheda(long id) =>
        Esegui(u => servizio.SchedaFotoAsync(u, id));

    [HttpGet("Foto/{codice}")]
    public Task<IActionResult> FotoDelCodice(string codice) =>
        Esegui(u => servizio.FotoDelCodiceAsync(u, codice));

    [HttpGet("Loghi")]
    public Task<IActionResult> Loghi() =>
        Esegui(u => servizio.CatalogoLoghiAsync(u));

    // ---- Passo 3 (j217): carica una nuova foto per una referenza (va in archivio su Olimpo)

    [HttpPost("Edit/{id:long}/Foto/{codice}")]
    [DisableRequestSizeLimit]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue, ValueLengthLimit = int.MaxValue)]
    public Task<IActionResult> CaricaFoto(long id, string codice, [FromForm] IFormFile? file) =>
        Esegui(u => servizio.CaricaFotoNuovaAsync(u, id, codice, file == null ? null
            : new FotoDaCaricare(file.FileName, file.ContentType, file.Length, file.OpenReadStream)));

    // ---- Propagazioni (j223): il megafono e la finestra dei gemelli

    /// <summary>Lo stato delle correzioni del volantino, per aggiornare i megafoni senza ricaricare.</summary>
    [HttpGet("Stato/{idVol:int}")]
    public Task<IActionResult> Stato(int idVol) =>
        Esegui(async u => EsitoCorrezione.Fatto(new { stato = await servizio.CaricaAsync(idVol, u) }));

    // ---- Commenti del volantino (j241): il bottone "Commenti" della home

    /// <summary>L'elenco dei commenti di un volantino.</summary>
    [HttpGet("Commenti/{idVol:int}")]
    public Task<IActionResult> Commenti(int idVol) =>
        Esegui(_ => servizio.CommentiAsync(idVol));

    /// <summary>Quanti commenti ha ogni volantino: serve ai pallini della home.</summary>
    [HttpGet("Commenti")]
    public Task<IActionResult> ContiCommenti() =>
        Esegui(_ => servizio.ContiCommentiAsync());

    /// <summary>Scrive un commento sul volantino.</summary>
    [HttpPost("Commenti/{idVol:int}")]
    public Task<IActionResult> AggiungiCommento(int idVol, [FromBody] RichiestaCommento r) =>
        Esegui(u => servizio.AggiungiCommentoAsync(u, idVol, r.Testo));

    /// <summary>
    /// Il lucchetto del pannello pagine (j235): per ogni pagina dice se chi guarda ha almeno un
    /// prodotto che la sua policy gli permette di correggere (getPolicyPag dell'originale).
    /// </summary>
    [HttpGet("PolicyPagine/{idVol:int}")]
    public Task<IActionResult> PolicyPagine(int idVol) =>
        Esegui(u => servizio.PaginePermesseAsync(u, idVol));

    [HttpGet("Propagazione/{idCatena:long}")]
    public Task<IActionResult> Propagazione(long idCatena, [FromServices] ServizioPropagazione prop) =>
        Esegui(u => prop.CaricaCatenaAsync(u, idCatena));

    [HttpPost("Propagazione/Elemento/{idPropagato:long}/Attiva")]
    public Task<IActionResult> AttivaPropagato(long idPropagato, [FromBody] RichiestaAttiva r,
                                               [FromServices] ServizioPropagazione prop) =>
        Esegui(u => prop.AttivaAsync(u, idPropagato, r.Attiva));

    [HttpPost("Propagazione/{idCatena:long}/AttivaTutti")]
    public Task<IActionResult> AttivaTuttiPropagati(long idCatena, [FromBody] RichiestaAttiva r,
                                                    [FromServices] ServizioPropagazione prop) =>
        Esegui(u => prop.AttivaTuttiAsync(u, idCatena, r.Attiva));

    /// <summary>
    /// «ELIMINA DEFINITIVAMENTE» (j230): questa correzione non si propaga. Spegne la catena,
    /// la correzione resta solo sul suo volantino (eliminaPropagazione dell'originale, S:4666).
    /// </summary>
    [HttpPost("Propagazione/{idCatena:long}/Elimina")]
    public Task<IActionResult> EliminaPropagazione(long idCatena, [FromServices] ServizioPropagazione prop) =>
        Esegui(u => prop.EliminaAsync(u, idCatena));

    /// <summary>I prodotti gemelli per la finestra dell'Edit avanzato (j227).</summary>
    [HttpGet("Edit/{id:long}/Gemelli/{parte}")]
    public Task<IActionResult> GemelliEdit(long id, string parte) =>
        Esegui(u => servizio.GemelliEditAsync(u, id, parte.ToLowerInvariant()));

    /// <summary>Accende o spegne la propagazione dell'Edit avanzato su un gemello (j227).</summary>
    [HttpPost("Edit/{id:long}/Propaga/{parte}")]
    public Task<IActionResult> PropagaEdit(long id, string parte, [FromBody] RichiestaPropagaEdit r) =>
        Esegui(u => servizio.PropagaEditAsync(u, id, parte.ToLowerInvariant(), r.IdGemello, r.Propaga));

    /// <summary>La conferma dell'Agenzia: una riga, le righe spuntate o tutte (j224).</summary>
    [HttpPost("Propagazione/{idCatena:long}/Conferma")]
    public Task<IActionResult> ConfermaPropagazioni(long idCatena, [FromBody] RichiestaConferma r) =>
        Esegui(u => servizio.ConfermaPropagazioniAsync(u, idCatena, r.Selezionati, r.AncheIlPilota));

    [HttpPost("Edit/{id:long}/{parte}/Annulla")]
    public Task<IActionResult> EditAnnulla(long id, string parte) =>
        Esegui(u => servizio.AnnullaEditAsync(u, id, parte.ToLowerInvariant()));

    [HttpPost("Edit/{id:long}/{parte}/Conferma")]
    public Task<IActionResult> EditConferma(long id, string parte) =>
        Esegui(u => servizio.ConfermaEditAsync(u, id, parte.ToLowerInvariant()));

    private async Task<IActionResult> Esegui(Func<ServizioCorrezioni.Utente, Task<EsitoCorrezione>> azione)
    {
        if (!short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short idUtente))
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Sessione scaduta: rientra." });

        var utente = await servizio.UtenteAsync(idUtente);
        if (utente == null)
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Utente non attivo." });

        var e = await azione(utente);
        return StatusCode(e.Http, new { ok = e.Ok, codice = e.Codice, messaggio = e.Messaggio, dati = e.Dati });
    }
}
