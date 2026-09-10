using System.Security.Claims;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Controllers;

public class RigaVolantino
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public DateTime ValiditaInizio { get; set; }
    public DateTime ValiditaFine { get; set; }
    public DateTime Scadenza { get; set; }
    public short Versione { get; set; }
    public int Pagine { get; set; }
    public int Box { get; set; }
    public int Note { get; set; }
}

[Authorize]
public class VolantiniController : Controller
{
    private readonly Correggo4Context ctx;
    private readonly IConfiguration config;

    public VolantiniController(Correggo4Context ctx, IConfiguration config)
    {
        this.ctx = ctx;
        this.config = config;
    }

    private short IdUtente =>
        short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short id) ? id : (short)0;

    public async Task<IActionResult> Index()
    {
        var righe = await ctx.Volantinis
            .OrderByDescending(v => v.DataValiditaInizio)
            .Select(v => new RigaVolantino
            {
                Id = v.Id,
                Titolo = v.Titolo,
                Classificazione = v.Classificazione,
                ValiditaInizio = v.DataValiditaInizio,
                ValiditaFine = v.DataValiditaFine,
                Scadenza = v.DataScadenza,
                Versione = ctx.VolantiniVersionis.Where(vv => vv.IdVol == v.Id)
                              .Max(vv => (short?)vv.Versione) ?? 0,
                Pagine = ctx.VolantiniPagines.Count(p => p.IdVol == v.Id),
                Box = ctx.VolantiniPagineElementis.Count(e => e.IdParent == null
                        && ctx.VolantiniPagines.Any(p => p.Id == e.IdPagina && p.IdVol == v.Id)),
                Note = ctx.VolantiniPagineNotes.Count(n =>
                        ctx.VolantiniPagines.Any(p => p.Id == n.IdPagina && p.IdVol == v.Id))
            })
            .ToListAsync();

        return View(righe);
    }

    public async Task<IActionResult> Dettaglio(int id)
    {
        var vol = await ctx.Volantinis.FirstOrDefaultAsync(v => v.Id == id);
        if (vol == null) return NotFound();

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == id)
                            .MaxAsync(p => (short?)p.Versione) ?? 0;

        var modello = new VolantinoInCorrezione
        {
            Id = vol.Id,
            Titolo = vol.Titolo,
            Classificazione = vol.Classificazione,
            Versione = versione,
            ValiditaInizio = vol.DataValiditaInizio,
            ValiditaFine = vol.DataValiditaFine,
            Scadenza = vol.DataScadenza,
            UrlFoto = config["Olimpo:ThumbUrl"] ?? ""
        };

        var pagine = await ctx.VolantiniPagines
            .Where(p => p.IdVol == id && p.Versione == versione)
            .OrderBy(p => p.Numero).ToListAsync();

        var idPagine = pagine.Select(p => p.Id).ToList();

        var elementi = await ctx.VolantiniPagineElementis
            .Where(e => idPagine.Contains(e.IdPagina))
            .OrderBy(e => e.Id).ToListAsync();

        var note = await (from n in ctx.VolantiniPagineNotes
                          where idPagine.Contains(n.IdPagina)
                          join u in ctx.Utentis on n.IdAutore equals u.Id into aut
                          from u in aut.DefaultIfEmpty()
                          select new
                          {
                              n.Id, n.IdElemento, n.Descrizione, n.Stato, n.DataInserimento,
                              n.Posx, n.Posy,
                              Autore = u != null ? u.Nome + " " + u.Cognome : "—"
                          }).ToListAsync();

        string radice = "/volantini/" + Uri.EscapeDataString(vol.Classificazione)
                        + "/" + Uri.EscapeDataString(vol.Titolo) + "/";

        foreach (var p in pagine)
        {
            var pc = new PaginaCorrezione
            {
                Id = p.Id,
                Numero = p.Numero,
                Larghezza = p.Larghezza,
                Altezza = p.Altezza,
                UrlImmagine = radice + $"pag{p.Numero}_v{versione}.jpg",
                UrlMiniatura = radice + $"thumbs/pag{p.Numero}_{versione}.jpg"
            };

            foreach (var e in elementi.Where(x => x.IdPagina == p.Id && x.IdParent == null))
            {
                var box = new BoxReferenza
                {
                    Id = e.Id,
                    Basecode = e.Basecode,
                    X = e.PosizioneX,
                    Y = e.PosizioneY,
                    Larghezza = e.Larghezza,
                    Altezza = e.Altezza
                };

                if (!string.IsNullOrWhiteSpace(e.Dna))
                {
                    try
                    {
                        using var d = JsonDocument.Parse(e.Dna);
                        if (d.RootElement.TryGetProperty("gruppo", out var g)) box.Gruppo = g.GetString();
                        if (d.RootElement.TryGetProperty("descrizione", out var de))
                            box.Descrizione = LettoreDescrizione.Leggi(de.GetString());
                    }
                    catch (JsonException) { }
                }

                // Campi figli: prezzo_promo, txt_sconto, prezzo_continuo, descrizione, immagine
                foreach (var f in elementi.Where(x => x.IdParent == e.Id))
                {
                    if (f.LabelInd == "immagine")
                    {
                        box.GuidFoto = f.Contenuto;
                        continue;
                    }
                    if (f.LabelInd == "descrizione")
                    {
                        if (box.Descrizione.Count == 0)
                            box.Descrizione = LettoreDescrizione.Leggi(f.Contenuto);
                        continue;
                    }
                    box.Campi.Add(new CampoReferenza { Etichetta = f.LabelInd, Valore = f.Contenuto });
                }

                // Lo schema completo della referenza, come e' arrivato nel pack.
                if (!string.IsNullOrWhiteSpace(e.Contenuto))
                {
                    try
                    {
                        using var d = JsonDocument.Parse(e.Contenuto);
                        if (d.RootElement.TryGetProperty("boxName", out var bn))
                            box.NomeBox = bn.GetString() ?? "";

                        if (d.RootElement.TryGetProperty("itemRefStringfied", out var irs))
                        {
                            string? interno = irs.GetString();
                            if (!string.IsNullOrWhiteSpace(interno))
                            {
                                using var d2 = JsonDocument.Parse(interno);
                                foreach (var prop in d2.RootElement.EnumerateObject())
                                    box.Tracciato.Add(new CampoReferenza
                                    {
                                        Etichetta = prop.Name,
                                        Valore = prop.Value.ToString()
                                    });
                            }
                        }

                        if (d.RootElement.TryGetProperty("azioni", out var az) &&
                            az.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var a in az.EnumerateArray())
                                if (a.TryGetProperty("titolo", out var t))
                                {
                                    string? titolo = t.GetString();
                                    if (!string.IsNullOrWhiteSpace(titolo) && !box.Azioni.Contains(titolo))
                                        box.Azioni.Add(titolo);
                                }
                        }
                    }
                    catch (JsonException) { }
                }

                if (string.IsNullOrWhiteSpace(box.NomeBox)) box.NomeBox = e.LabelInd;

                foreach (var n in note.Where(n => n.IdElemento == e.Id).OrderBy(n => n.Id))
                    box.Note.Add(new NotaSuBox
                    {
                        Id = n.Id, Descrizione = n.Descrizione, Autore = n.Autore,
                        Data = n.DataInserimento, Stato = n.Stato,
                        Posx = n.Posx, Posy = n.Posy
                    });

                pc.Box.Add(box);
            }

            modello.Pagine.Add(pc);
        }

        return View(modello);
    }

    [HttpPost]
    [Authorize(Roles = Ruoli.Gdo)]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AggiungiNota(int idVolantino, long idElemento,
                                                  string descrizione, double posx, double posy,
                                                  short pagina = 0)
    {
        if (string.IsNullOrWhiteSpace(descrizione))
            return Redirect($"/Volantini/Dettaglio/{idVolantino}?pag={pagina}");

        var elemento = await ctx.VolantiniPagineElementis.FirstOrDefaultAsync(e => e.Id == idElemento);
        if (elemento == null) return NotFound();

        ctx.VolantiniPagineNotes.Add(new VolantiniPagineNote
        {
            IdPagina = elemento.IdPagina,
            IdElemento = elemento.Id,
            Tipo = 1,
            Descrizione = descrizione.Trim(),
            Posx = posx,
            Posy = posy,
            Stato = 0,
            IdAutore = IdUtente,
            DataInserimento = DateTime.UtcNow
        });

        await ctx.SaveChangesAsync();
        return Redirect($"/Volantini/Dettaglio/{idVolantino}?pag={pagina}&box={idElemento}");
    }
}
