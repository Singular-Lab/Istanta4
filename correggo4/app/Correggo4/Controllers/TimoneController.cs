using System.Globalization;
using System.Security.Claims;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Correggo4.Controllers;

/// <summary>
/// Le rotte del TIMONE (j251). Stesso stile degli altri controller: utente dal cookie,
/// antiforgery sull'header RequestVerificationToken, risposta sempre nella busta
/// { ok, codice, messaggio, dati }.
///
/// Per adesso: le due rotte che servono a vedere il piano (aprirlo, cioe' fotografarlo dal
/// volantino impaginato, e rileggerlo) e le due che aprono e chiudono la finestra del Marketing
/// (j253). Il salvataggio e le sei operazioni vengono nel pezzo dopo.
/// </summary>
[Authorize]
[ApiController]
[Route("Timone")]
[AutoValidateAntiforgeryToken]
public sealed class TimoneController : ControllerBase
{
    private readonly ServizioTimone servizio;

    public TimoneController(ServizioTimone servizio) => this.servizio = servizio;

    /// <summary>Il piano salvato di un volantino. Se non c'e' ancora, lo dice.</summary>
    [HttpGet("{idVol:int}/Piano")]
    public Task<IActionResult> Piano(int idVol) => Esegui(chi => servizio.PianoAsync(chi, idVol));

    /// <summary>Fotografa il piano dal volantino impaginato. Solo Agenzia, una volta sola.</summary>
    [HttpPost("{idVol:int}/Apri")]
    public Task<IActionResult> Apri(int idVol) => Esegui(chi => servizio.ApriAsync(chi, idVol));

    /// <summary>Il corpo con cui l'editor apre la finestra: basta la data di chiusura.</summary>
    public sealed record FinestraRichiesta(string? Fine, string? Inizio);

    /// <summary>
    /// DEPRECATA (j255, 28/09). Apre la finestra del Marketing sulla promo di questo volantino.
    ///
    /// Cosa si e' scoperto: nata in j253 perche' l'Agenzia potesse aprire la finestra dalla barra
    /// del timone, senza uscire dal volantino. Lo stesso giorno Michele ha fatto togliere quel
    /// bottone: lo stesso comando in due posti rendeva tutto confusionario, e la finestra vale per
    /// TUTTA LA PROMO mentre il bottone stava dentro un singolo volantino. Adesso la finestra si
    /// governa solo da Gestisci promo (POST /Promo/FinestraTimone), che agisce su una promo per
    /// volta e non trae in inganno.
    ///
    /// Quindi oggi NESSUNO la chiama: in wwwroot/js/timone.js non c'e' piu' nessun bottone che la
    /// usi. La rotta e' rimasta perche' funziona ed e' collaudata (j253, 57/58), e perche' la
    /// logica vera sta tutta in ServizioTimone.SalvaFinestraAsync, che e' la stessa che usa
    /// Gestisci promo: non e' codice duplicato, e' solo una porta d'ingresso in piu'.
    ///
    /// Cosa succederebbe riattivandola: niente di storto lato server (i controlli di ruolo e di
    /// data sono quelli), ma tornerebbe il doppio comando che Michele ha chiesto di togliere.
    /// Prima di rimetterla in piedi, chiederglielo.
    /// </summary>
    [HttpPost("{idVol:int}/Finestra/Apri")]
    public Task<IActionResult> ApriFinestra(int idVol, [FromBody] FinestraRichiesta? corpo) =>
        Esegui(async chi =>
        {
            string? promo = await servizio.PromoDelVolantinoAsync(idVol);
            if (promo == null)
                return ServizioTimone.Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");
            return await servizio.SalvaFinestraAsync(chi, promo, DataOra(corpo?.Inizio), DataOra(corpo?.Fine));
        });

    /// <summary>
    /// DEPRECATA (j255, 28/09), per lo stesso motivo della sorella qui sopra: il bottone che la
    /// chiamava e' stato tolto dalla barra del timone, la finestra si chiude da Gestisci promo
    /// (POST /Promo/FinestraTimone/Chiudi). Chiude subito la finestra del Marketing sulla promo
    /// di questo volantino.
    /// </summary>
    [HttpPost("{idVol:int}/Finestra/Chiudi")]
    public Task<IActionResult> ChiudiFinestra(int idVol) =>
        Esegui(async chi =>
        {
            string? promo = await servizio.PromoDelVolantinoAsync(idVol);
            if (promo == null)
                return ServizioTimone.Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");
            return await servizio.ChiudiFinestraAsync(chi, promo);
        });

    /// <summary>Il corpo con cui si sceglie la griglia di una pagina. Vuoto o null = nessuna griglia.</summary>
    public sealed record GrigliaRichiesta(string? Griglia);

    /// <summary>
    /// DEPRECATA (j256, 28/09). Metteva (o toglieva) la griglia a una pagina del piano scrivendo
    /// subito in banca dati. Michele, provando, si e' ritrovato le griglie addosso riaprendo il
    /// timone senza aver mai salvato: da j256 la griglia sta nella bozza del browser e si scrive
    /// solo con POST /Timone/{idVol}/Salva. Nessuno la chiama piu' (timone.js non la usa).
    /// Il perche' per esteso sta sopra ScegliGrigliaAsync, in ServizioTimone.Griglie.cs.
    /// </summary>
    [HttpPost("{idVol:int}/Pagina/{idPagina:long}/Griglia")]
    public Task<IActionResult> Griglia(int idVol, long idPagina, [FromBody] GrigliaRichiesta? corpo) =>
        Esegui(chi => servizio.ScegliGrigliaAsync(chi, idVol, idPagina, corpo?.Griglia));

    /// <summary>
    /// Tutto il piano come lo manda il browser. <c>Blocchi</c> (j279) sono le caselle dove non
    /// deve andare niente: se non arriva proprio, quelle gia' salvate restano dove sono; se arriva
    /// - anche vuota - sostituisce tutte quelle del piano.
    /// </summary>
    public sealed record SalvataggioRichiesta(
        int? Revisione,
        List<ServizioTimone.PaginaSalvata>? Pagine,
        List<ServizioTimone.VoceSalvata>? Voci,
        List<ServizioTimone.BloccoSalvato>? Blocchi = null);

    /// <summary>
    /// Salva il piano tutto in una volta (j256). E' l'unico punto in cui il server scrive il
    /// timone e l'unico in cui controlla le regole: se una sola non torna, non si salva niente.
    /// La puo' chiamare chi in quel momento ha il timone.
    /// </summary>
    [HttpPost("{idVol:int}/Salva")]
    public Task<IActionResult> Salva(int idVol, [FromBody] SalvataggioRichiesta? corpo) =>
        Esegui(chi => servizio.SalvaAsync(chi, idVol, corpo?.Revisione, corpo?.Pagine, corpo?.Voci,
                                          corpo?.Blocchi));

    /// <summary>
    /// DEPRECATA (j263, 28/09). Rimette il piano com'era all'inizio: rifa' la fotografia dal
    /// volantino impaginato e butta via tutto il lavoro, salvataggi compresi.
    ///
    /// Cosa si e' scoperto: era il bottone «rimetti com'era all'inizio» nella barra del timone.
    /// Michele, guardando la barra: «qui ci sono troppi pulsanti, si fa casino». Restano i tre
    /// che servono tutti i giorni (ANNULLA LE MODIFICHE, SALVA, CHIUDI) e questo, che si usa una
    /// volta ogni tanto, e' stato tolto. Oggi NESSUNO la chiama: in wwwroot/js/timone.js non
    /// c'e' piu' nessun bottone che la usi.
    ///
    /// La rotta non e' stata cancellata perche' funziona ed e' collaudata (j256, 54/54), e perche'
    /// e' l'unico modo di tornare indietro quando un piano e' stato salvato storto. Se serve
    /// rimetterla a portata di mano, il posto giusto e' un menu «altro» o la pagina Gestisci
    /// promo, non la barra del timone. Riattivandola lato server non cambia niente: i controlli
    /// di ruolo e di finestra sono quelli di sempre.
    /// </summary>
    [HttpPost("{idVol:int}/RimettiComeEra")]
    public Task<IActionResult> RimettiComeEra(int idVol) =>
        Esegui(chi => servizio.RimettiComeEraAsync(chi, idVol));

    /// <summary>
    /// I volantini su cui l'Agenzia ha del lavoro di timone da fare adesso (j317). La home la
    /// chiama una volta sola, al caricamento, e accende la casella «TIMONE» lampeggiante sulle
    /// righe dei PDF che tornano in questo elenco.
    ///
    /// A chi non e' l'Agenzia risponde con un elenco vuoto: la regola sta nel servizio, non qui,
    /// e non e' scritta due volte. Non ha {idVol} perche' la home chiede di tutti insieme: una
    /// chiamata sola invece di una per volantino.
    /// </summary>
    [HttpGet("DaSistemare")]
    public Task<IActionResult> DaSistemare() => Esegui(async chi =>
        ServizioTimone.Esito.Fatto(new { volantini = await servizio.VolantiniDaSistemareAsync(chi) }));

    /// <summary>
    /// L'Agenzia dice «FATTO»: ho riportato sull'impaginato quello che il Marketing ha chiesto
    /// col timone (j317). Spegne la casella lampeggiante nella home.
    /// </summary>
    [HttpPost("{idVol:int}/Sistemato")]
    public Task<IActionResult> Sistemato(int idVol) =>
        Esegui(chi => servizio.SistematoAsync(chi, idVol));

    /// <summary>
    /// Scarica il pacchetto dei filtri per il plug-in (j324). Solo Agenzia, solo a finestra
    /// chiusa: i due controlli stanno nel servizio, non qui, perche' la regola e' una sola e va
    /// scritta in un posto solo.
    ///
    /// E' l'UNICA rotta del timone che non risponde nella busta { ok, codice, messaggio, dati }:
    /// quando va bene manda un file, e un browser che scarica un file non legge nessuna busta.
    /// Quando va male la busta torna, cosi' il messaggio si vede comunque: e' quello che il
    /// browser legge nel ramo d'errore di esportaFiltri(), in wwwroot/js/timone.js.
    ///
    /// E' una GET e non scrive niente: si puo' rifare dieci volte di seguito. Il perche' sta
    /// sopra EsportaAsync, in Servizi/ServizioTimone.Esporta.cs.
    /// </summary>
    [HttpGet("{idVol:int}/Esporta")]
    public async Task<IActionResult> Esporta(int idVol)
    {
        if (!short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short idUtente))
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Sessione scaduta: rientra." });

        var chi = await servizio.ChiAsync(idUtente);
        if (chi == null)
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Utente non attivo." });

        var (errore, pacchetto) = await servizio.EsportaAsync(chi, idVol);
        if (pacchetto == null)
            return StatusCode(errore?.Http ?? 500, new
            {
                ok = false,
                codice = errore?.Codice ?? "errore",
                messaggio = errore?.Messaggio ?? "Non si e' riusciti a fare il pacchetto dei filtri."
            });

        return File(pacchetto.Contenuto, "application/zip", pacchetto.NomeFile);
    }

    /// <summary>Le date arrivano come le scrive un campo datetime-local: 2026-10-05T18:30.</summary>
    private static DateTime? DataOra(string? s) =>
        DateTime.TryParseExact(s, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture,
                               DateTimeStyles.None, out var d) ? d : null;

    private async Task<IActionResult> Esegui(Func<ServizioTimone.Chi, Task<ServizioTimone.Esito>> azione)
    {
        if (!short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short idUtente))
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Sessione scaduta: rientra." });

        var chi = await servizio.ChiAsync(idUtente);
        if (chi == null)
            return StatusCode(401, new { ok = false, codice = "non_autenticato", messaggio = "Utente non attivo." });

        var e = await azione(chi);
        return StatusCode(e.Http, new { ok = e.Ok, codice = e.Codice, messaggio = e.Messaggio, dati = e.Dati });
    }
}
