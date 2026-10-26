using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// La propagazione dell'**Edit avanzato** (j227), l'ultimo pezzo delle propagazioni.
/// Non passa dalle catene di `volantini_propagazioni`: nell'originale (`propagaFieldsDellaRef`,
/// `Service.cs:2447-2512`) era un meccanismo a parte, con l'elenco dei prodotti gemelli dentro la
/// finestra dell'Edit avanzato e una spunta per ognuno. Qui è lo stesso: chi scrive salva la sua
/// correzione sui campi e poi decide a mano su quali volantini gemelli portarla.
/// La riga scritta sul gemello è un **rimando**: `nuova_versione` vuota e `id_elemento_master` al box
/// pilota; i valori si leggono dalla correzione del pilota, così restano allineati e non si duplicano.
/// </summary>
public sealed partial class ServizioCorrezioni
{
    private const short StatoVolantinoInCorrezione = 1;

    /// <summary>L'elenco "Propagazioni" della finestra: i gemelli e come stanno.</summary>
    public async Task<EsitoCorrezione> GemelliEditAsync(Utente u, long idBox, string? parte)
    {
        if (parte is not (ParteOfferta or ParteDescrizione)) return NonTrovata("Parte della scheda sconosciuta.");
        var box = await ctx.VolantiniPagineElementis.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == idBox && e.IdParent == null);
        if (box == null) return NonTrovata("Prodotto non trovato.");

        var adesso = DateTime.UtcNow;
        var grezzi = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                            join p in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals p.Id
                            join v in ctx.Volantinis.AsNoTracking() on p.IdVol equals v.Id
                            where e.IdParent == null && e.Id != box.Id && e.Basecode != ""
                                  && v.Status == StatoVolantinoInCorrezione && v.DataScadenza > adesso
                                  && !ctx.VolantiniVersionis.Any(ver => ver.Id == p.IdVersione && ver.DataChiusura != null)
                            select new { Box = e, p.Numero, p.Versione, Vol = v }).ToListAsync();

        var gemelli = grezzi.Where(x => Gemelli.StessoDna(box, x.Box)).ToList();
        if (gemelli.Count == 0) return EsitoCorrezione.Fatto(new List<GemelloEditVista>());

        var idGemelli = gemelli.Select(x => x.Box.Id).ToList();
        var figli = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => e.IdParent != null && idGemelli.Contains(e.IdParent.Value))
            .Select(e => new { e.Id, Padre = e.IdParent!.Value, e.LabelInd }).ToListAsync();
        var idTutti = idGemelli.Concat(figli.Select(f => f.Id)).ToList();
        var versioni = await ctx.VolantiniPagineElementiVersionis.AsNoTracking()
            .Where(v => idTutti.Contains(v.IdElemento) && v.Stato != EaAnnullato)
            .Select(v => new { v.IdElemento, v.IdElementoMaster, v.Stato }).ToListAsync();

        var lista = new List<GemelloEditVista>();
        foreach (var g in gemelli)
        {
            var suoiFigli = figli.Where(f => f.Padre == g.Box.Id).ToList();
            var idParte = parte == ParteDescrizione
                ? suoiFigli.Where(f => f.LabelInd == SchemaReferenza.LabelDescrizione
                                       || f.LabelInd == SchemaReferenza.LabelImmagine).Select(f => f.Id).ToList()
                : suoiFigli.Where(f => f.LabelInd != SchemaReferenza.LabelDescrizione
                                       && f.LabelInd != SchemaReferenza.LabelImmagine)
                           .Select(f => f.Id).Append(g.Box.Id).ToList();
            var sue = versioni.Where(v => idParte.Contains(v.IdElemento)).ToList();
            var rimando = sue.FirstOrDefault(v => v.IdElementoMaster == box.Id);
            bool proprio = sue.Any(v => v.IdElementoMaster == null);

            var voce = new GemelloEditVista
            {
                IdBox = g.Box.Id,
                IdVolantino = g.Vol.Id,
                Promo = g.Vol.Classificazione,
                Volantino = g.Vol.Titolo,
                Pagina = g.Numero,
                Versione = g.Versione,
                Etichetta = EtichettaProdotto(g.Box),
                Propagato = rimando != null,
                Fatto = rimando != null && rimando.Stato == EaCorretto,
                Proprio = proprio,
                Bloccato = Bloccato(g.Vol, adesso),
                Scaduto = Scaduto(g.Vol, adesso)
            };
            voce.StatoTesto = voce.Fatto ? "Fatta dall'Agenzia"
                            : voce.Propagato ? "Propagata, in attesa dell'Agenzia"
                            : voce.Proprio ? "Ha una correzione sua"
                            : voce.Bloccato ? "Bloccato in ripubblicazione"
                            : voce.Scaduto ? "Volantino scaduto"
                            : "Da propagare";
            lista.Add(voce);
        }
        // ordine dell'originale: prima i gemelli della stessa promo, poi gli altri
        string promoMia = await (from p in ctx.VolantiniPagines.AsNoTracking()
                                 join v in ctx.Volantinis.AsNoTracking() on p.IdVol equals v.Id
                                 where p.Id == box.IdPagina select v.Classificazione).FirstAsync();
        return EsitoCorrezione.Fatto(lista
            .OrderByDescending(x => x.Promo == promoMia)
            .ThenBy(x => x.Promo).ThenBy(x => x.Volantino).ThenBy(x => x.Pagina).ToList());
    }

    /// <summary>propagaFieldsDellaRef dell'originale: accende o spegne la propagazione su un gemello.</summary>
    public async Task<EsitoCorrezione> PropagaEditAsync(Utente u, long idBox, string? parte,
                                                        long idGemello, bool propaga)
    {
        if (!u.Scrive) return NonAutorizzato();
        if (parte is not (ParteOfferta or ParteDescrizione)) return NonTrovata("Parte della scheda sconosciuta.");
        var (box, vol, errore) = await BoxScrivibileAsync(u, idBox);
        if (errore != null) return errore;

        var (_, capo) = await RigheParteAsync(box!.Id, parte);
        if (capo == null || capo.Stato == EaAnnullato)
            return NonTrovata("Su questo prodotto non c'è una correzione da propagare.");
        if (capo.IdElementoMaster != null)
            return EsitoCorrezione.No(409, "non_pilota",
                "Questa correzione arriva da un altro volantino: la propagazione si decide là.");

        var gemello = await ctx.VolantiniPagineElementis.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == idGemello && e.IdParent == null);
        if (gemello == null) return NonTrovata("Il prodotto gemello non esiste più.");
        if (!Gemelli.StessoDna(box, gemello))
            return EsitoCorrezione.No(400, "non_gemello", "Questo prodotto non è un gemello di quello corretto.");

        var volGemello = await (from p in ctx.Volantinis.AsNoTracking()
                               join pg in ctx.VolantiniPagines.AsNoTracking() on p.Id equals pg.IdVol
                               where pg.Id == gemello.IdPagina select p).FirstOrDefaultAsync();
        if (volGemello == null) return NonTrovata("Il volantino gemello non esiste più.");
        var adesso = DateTime.UtcNow;
        if (Bloccato(volGemello, adesso))
            return EsitoCorrezione.No(423, "volantino_bloccato",
                $"«{volGemello.Titolo}» è bloccato in ripubblicazione: riprova più tardi.");
        if (Scaduto(volGemello, adesso))
            return EsitoCorrezione.No(423, "volantino_scaduto", $"«{volGemello.Titolo}» è scaduto.");

        // dove va il rimando: sul box per i prezzi, sul figlio descrizione (o immagine) per la scheda
        long bersaglio = gemello.Id;
        if (parte == ParteDescrizione)
        {
            var figli = await ctx.VolantiniPagineElementis.AsNoTracking()
                .Where(e => e.IdParent == gemello.Id).Select(e => new { e.Id, e.LabelInd }).ToListAsync();
            var f = figli.FirstOrDefault(x => x.LabelInd == SchemaReferenza.LabelDescrizione)
                    ?? figli.FirstOrDefault(x => x.LabelInd == SchemaReferenza.LabelImmagine);
            if (f == null)
                return EsitoCorrezione.No(409, "niente_da_propagare",
                    "Il prodotto gemello non ha la descrizione: non c'è dove portare la correzione.");
            bersaglio = f.Id;
        }

        var (righeGemello, capoGemello) = await RigheParteAsync(gemello.Id, parte);
        var rimando = righeGemello.FirstOrDefault(v => v.IdElementoMaster != null && v.Stato != EaAnnullato);
        var suo = righeGemello.FirstOrDefault(v => v.IdElementoMaster == null && v.Stato != EaAnnullato);

        if (propaga)
        {
            if (rimando != null && rimando.IdElementoMaster == box.Id)
                return EsitoCorrezione.No(409, "uguale", "Era già propagata su questo volantino.");
            if (suo != null)
                return EsitoCorrezione.No(409, "ha_una_sua_correzione",
                    $"«{volGemello.Titolo}» ha già una correzione sua su questo prodotto: va annullata là prima di propagare.");
            if (rimando != null)
            {
                // arrivava da un altro pilota: si ripunta a questo, come faceva l'originale
                rimando.IdElementoMaster = box.Id;
                rimando.IdAutore = u.Id;
                rimando.DataModifica = adesso;
            }
            else
            {
                var riga = NuovaRiga(bersaglio, gemello.IdPagina, u.Id, adesso, "[]");
                riga.IdElementoMaster = box.Id;
                ctx.VolantiniPagineElementiVersionis.Add(riga);
            }
        }
        else
        {
            if (rimando == null || rimando.IdElementoMaster != box.Id)
                return EsitoCorrezione.No(409, "uguale", "Su questo volantino non era propagata.");
            if (rimando.Stato == EaCorretto)
                return EsitoCorrezione.No(409, "gia_confermata",
                    "L'Agenzia ha già eseguito la correzione su questo volantino: non si toglie più.");
            ctx.VolantiniPagineElementiVersionis.Remove(rimando);
        }
        await ctx.SaveChangesAsync();
        return EsitoCorrezione.Fatto(new { idBox = gemello.Id, propagato = propaga });
    }

    // ------------------------------------------------------------------ lettura sul gemello

    /// <summary>
    /// Le correzioni di Edit avanzato **arrivate** da un altro volantino: i valori sono quelli del
    /// pilota, le evidenze stanno sui campi di questo prodotto (l'originale apriva la scheda del
    /// derivato mostrando i dati del pilota, `correzioni.js:2540-2600`).
    /// </summary>
    private async Task<List<EditVista>> CaricaEditPropagateAsync(List<int> idPagine, Dictionary<int, short> numero,
                                                                 Func<short?, string> nome, Func<short?, string> tipo)
    {
        var righe = await (from v in ctx.VolantiniPagineElementiVersionis.AsNoTracking()
                           join e in ctx.VolantiniPagineElementis.AsNoTracking() on v.IdElemento equals e.Id
                           where idPagine.Contains(e.IdPagina) && v.IdElementoMaster != null
                                 && (v.Stato == EaRegistrato || v.Stato == EaCorretto)
                           orderby v.Id
                           select new
                           {
                               v.IdElemento, v.IdElementoMaster, v.Stato, v.IdAutore, v.DataModifica,
                               e.IdParent, e.IdPagina
                           }).ToListAsync();
        if (righe.Count == 0) return new();

        var lista = new List<EditVista>();
        foreach (var r in righe)
        {
            long idBox = r.IdParent ?? r.IdElemento;
            string parte = r.IdParent == null ? ParteOfferta : ParteDescrizione;

            var box = await ctx.VolantiniPagineElementis.AsNoTracking()
                .Where(e => e.Id == idBox)
                .Select(e => new { e.Id, e.IdPagina, e.PosizioneX, e.PosizioneY, e.Larghezza, e.Altezza })
                .FirstOrDefaultAsync();
            if (box == null) continue;
            var figli = await ctx.VolantiniPagineElementis.AsNoTracking()
                .Where(e => e.IdParent == idBox)
                .Select(e => new { e.LabelInd, e.PosizioneX, e.PosizioneY, e.Larghezza, e.Altezza }).ToListAsync();

            var master = await ctx.VolantiniPagineElementis.AsNoTracking()
                .Where(e => e.Id == r.IdElementoMaster)
                .Select(e => new { e.Id, e.IdPagina, e.Contenuto }).FirstOrDefaultAsync();
            if (master == null) continue;
            var volMaster = await (from p in ctx.VolantiniPagines.AsNoTracking()
                                   join v in ctx.Volantinis.AsNoTracking() on p.IdVol equals v.Id
                                   where p.Id == master.IdPagina
                                   select new { v.Titolo, v.Classificazione, p.Numero }).FirstOrDefaultAsync();

            // le righe della correzione del pilota, sola lettura
            var figliMaster = await ctx.VolantiniPagineElementis.AsNoTracking()
                .Where(e => e.IdParent == master.Id).Select(e => new { e.Id, e.LabelInd }).ToListAsync();
            var idParteMaster = parte == ParteDescrizione
                ? figliMaster.Where(f => f.LabelInd == SchemaReferenza.LabelDescrizione
                                         || f.LabelInd == SchemaReferenza.LabelImmagine).Select(f => f.Id).ToList()
                : figliMaster.Where(f => f.LabelInd != SchemaReferenza.LabelDescrizione
                                         && f.LabelInd != SchemaReferenza.LabelImmagine)
                             .Select(f => f.Id).Append(master.Id).ToList();
            var righeMaster = await ctx.VolantiniPagineElementiVersionis.AsNoTracking()
                .Where(v => idParteMaster.Contains(v.IdElemento) && v.IdElementoMaster == null
                            && (v.Stato == EaRegistrato || v.Stato == EaCorretto))
                .Select(v => new { v.IdElemento, v.NuovaVersione, v.IdAutore, v.DataModifica }).ToListAsync();
            if (righeMaster.Count == 0) continue;   // il pilota non ha piu' la correzione: niente da mostrare

            var schema = SchemaReferenza.Leggi(master.Contenuto);
            var capoMaster = righeMaster.FirstOrDefault(x => x.IdElemento == master.Id) ?? righeMaster[0];
            var vista = new EditVista
            {
                IdBox = idBox,
                IdPagina = r.IdPagina,
                Pagina = numero.TryGetValue(r.IdPagina, out short np) ? np : (short)0,
                Parte = parte,
                Stato = r.Stato,
                IdAutore = capoMaster.IdAutore,
                Autore = nome(capoMaster.IdAutore),
                TipoAutore = tipo(capoMaster.IdAutore),
                Data = capoMaster.DataModifica,
                Propagata = true,
                IdBoxMaster = master.Id,
                DaPromo = volMaster?.Classificazione ?? "",
                DaVolantino = volMaster?.Titolo ?? "",
                DaPagina = volMaster?.Numero ?? 0
            };

            foreach (var m in righeMaster)
            {
                string label = m.IdElemento == master.Id
                    ? SchemaReferenza.LabelBase
                    : figliMaster.FirstOrDefault(f => f.Id == m.IdElemento)?.LabelInd ?? "";
                if (label == SchemaReferenza.LabelImmagine)
                {
                    foreach (var vf in LeggiVociFoto(m.NuovaVersione))
                        vista.Foto.Add(new FotoEditVista { Codice = vf.codice, GuidId = vf.guidid, NomeFile = vf.nomeFile, Stato = vf.stato });
                }
                else
                {
                    foreach (var mod in LeggiRegistro(m.NuovaVersione))
                    {
                        if (mod.id_azione > 0)
                        {
                            var az = schema?.Azioni.FirstOrDefault(a => a.Id == mod.id_azione);
                            var ae = new AzioneEditVista { Id = mod.id_azione, Titolo = az?.Titolo ?? $"Azione {mod.id_azione}" };
                            foreach (var kv in mod.keyvalues) ae.Campi[kv.field] = kv.valore;
                            vista.Azioni.Add(ae);
                        }
                        else
                        {
                            foreach (var kv in mod.keyvalues) vista.Campi[kv.field] = kv.valore;
                        }
                    }
                }

                // l'evidenza si disegna sul campo di **questo** prodotto, non su quello del pilota
                if (label == SchemaReferenza.LabelBase)
                {
                    vista.Evidenze.Add(new EvidenzaVista
                    {
                        Label = SchemaReferenza.LabelBase, Cerchio = true,
                        X = (double)(box.PosizioneX + box.Larghezza / 2),
                        Y = (double)(box.PosizioneY + box.Altezza / 2)
                    });
                }
                else
                {
                    var mio = figli.FirstOrDefault(f => f.LabelInd == label);
                    if (mio != null)
                        vista.Evidenze.Add(new EvidenzaVista
                        {
                            Label = label,
                            X = (double)mio.PosizioneX, Y = (double)mio.PosizioneY,
                            W = (double)mio.Larghezza, H = (double)mio.Altezza
                        });
                }
            }

            if (vista.Evidenze.Count == 0)
                vista.Evidenze.Add(new EvidenzaVista
                {
                    Label = SchemaReferenza.LabelBase, Cerchio = true,
                    X = (double)(box.PosizioneX + box.Larghezza / 2),
                    Y = (double)(box.PosizioneY + box.Altezza / 2)
                });
            lista.Add(vista);
        }
        return lista;
    }

    /// <summary>L'etichetta leggibile di un prodotto: basecode piu' la descrizione dal dna.</summary>
    private static string EtichettaProdotto(VolantiniPagineElementi box)
    {
        string descr = "";
        if (!string.IsNullOrWhiteSpace(box.Dna))
        {
            try
            {
                using var d = System.Text.Json.JsonDocument.Parse(box.Dna);
                if (d.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object
                    && d.RootElement.TryGetProperty("descrizione", out var de)
                    && de.ValueKind == System.Text.Json.JsonValueKind.String)
                    descr = Tag().Replace(de.GetString() ?? "", " ").Trim();
            }
            catch (System.Text.Json.JsonException) { }
        }
        return descr == "" ? box.Basecode : $"{box.Basecode} – {descr}";
    }
}
