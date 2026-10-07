using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// DEPRECATO (j256, 28/09). La scelta della griglia di una pagina del timone, scritta subito.
///
/// Cosa si e' scoperto: nata in j254, scriveva la griglia in banca dati appena la si sceglieva.
/// Michele se n'e' accorto subito provando: riapriva il timone e si ritrovava addosso le prove
/// fatte, pur non avendo mai salvato niente. Aveva ragione: la specifica (10bis) dice che la
/// bozza sta nel browser e che sul server non si scrive finche' non si preme SALVA.
///
/// Quindi da j256 la griglia si cambia solo nella bozza del browser e finisce in banca dati
/// insieme a tutto il resto dentro SalvaAsync (ServizioTimone.Salva.cs), che e' anche l'unico
/// punto dove si controllano le regole. Oggi NESSUNO chiama questo metodo: la rotta
/// POST /Timone/{idVol}/Pagina/{id}/Griglia e' segnata deprecata anche lei e timone.js non la
/// usa piu'.
///
/// Cosa succederebbe riattivandolo: tornerebbe esattamente il difetto che Michele ha segnalato,
/// cioe' una scrittura fuori dal SALVA. In piu' non fa i controlli che fa SalvaAsync (gruppi a
/// cavallo, caselle doppie, elementi in sospeso) e non tocca la revisione, quindi due persone
/// potrebbero sovrascriversi senza accorgersene. Non va riacceso: se serve cambiare la griglia da
/// un'altra parte, si passa da SalvaAsync.
/// </summary>
public sealed partial class ServizioTimone
{
    /// <summary>
    /// Sceglie (o toglie, con griglia = null) la griglia di una pagina del piano. La puo' fare
    /// chi in questo momento ha il timone: il Marketing a finestra aperta, l'Agenzia a finestra
    /// chiusa.
    /// </summary>
    public async Task<Esito> ScegliGrigliaAsync(Chi chi, int idVolantino, long idPaginaTimone, string? griglia)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVolantino);
        if (vol == null) return Esito.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        var no = await PuoScrivereAsync(chi, vol.Classificazione);
        if (no != null) return no;

        var pagina = await ctx.TimonePagine.FirstOrDefaultAsync(p => p.Id == idPaginaTimone);
        if (pagina == null)
            return Esito.No(404, "pagina_non_trovata", "Questa pagina non e' nel piano.");

        var piano = await ctx.Timoni.AsNoTracking().FirstOrDefaultAsync(t => t.Id == pagina.IdTimone);
        if (piano == null || piano.IdVol != idVolantino)
            return Esito.No(400, "pagina_di_un_altro", "Questa pagina non e' di questo volantino.");

        var voci = await ctx.TimoneVoci
            .Where(v => v.IdPaginaTimone == idPaginaTimone && v.Stato == VoceInPagina)
            .ToListAsync();

        // togliere la griglia: la pagina torna "come era impaginata", le referenze restano tutte
        if (string.IsNullOrWhiteSpace(griglia))
        {
            pagina.Griglia = null;
            pagina.Capienza = 0;
            Rinumera(voci);
            piano.DataModifica = DateTime.UtcNow;
            ctx.Timoni.Update(piano);
            await ctx.SaveChangesAsync();
            return await PianoAsync(chi, idVolantino);
        }

        var g = GriglieFormato.Trova(griglia);
        if (g == null)
            return Esito.No(400, "griglia_sconosciuta",
                $"«{griglia}» non e' una delle griglie a sistema ({string.Join(", ", GriglieFormato.Ammesse().Select(x => x.Nome))}).");

        if (voci.Count > g.Posti)
        {
            var basta = GriglieFormato.PiuPiccolaCheBasta(voci.Count);
            string consiglio = basta == null
                ? "Nessuna griglia a sistema e' abbastanza grande: vanno prima tolte delle referenze."
                : $"La piu' piccola che le contiene tutte e' la {basta.Nome} ({basta.Posti} posti).";
            return Esito.No(409, "griglia_troppo_piccola",
                $"In pagina {pagina.Numero} ci sono {voci.Count} referenze e nella {g.Nome} ce ne stanno {g.Posti}. {consiglio}");
        }

        pagina.Griglia = g.Nome;
        pagina.Capienza = (short)g.Posti;
        Rinumera(voci);
        piano.DataModifica = DateTime.UtcNow;
        ctx.Timoni.Update(piano);
        await ctx.SaveChangesAsync();

        return await PianoAsync(chi, idVolantino);
    }

    /// <summary>
    /// Le posizioni tornano 1, 2, 3… senza buchi, tenendo l'ordine che hanno adesso. Serve perche'
    /// la casella della griglia e' proprio il numero di posizione: con un buco, una casella
    /// resterebbe vuota in mezzo senza motivo.
    /// </summary>
    private static void Rinumera(List<Models.VolantiniTimoneVoci> voci)
    {
        short n = 1;
        foreach (var v in voci.OrderBy(v => v.Posizione ?? short.MaxValue).ThenBy(v => v.Id))
            v.Posizione = n++;
    }
}
