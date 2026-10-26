using Istanta.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-9a91bbb0152342de9ba44a857d1cbef7: un import che fallisce deve registrare l'errore.
///
/// Durante l'import del volantino l'INSERT di un articolo veniva rifiutato dal database. EF lascia
/// l'articolo nel contesto ancora Added, e i catch dell'import rifacevano SaveChanges sullo stesso
/// contesto: riprovavano l'articolo, fallivano di nuovo, e ne' il log ne' lo stato dell'attivita'
/// venivano scritti. L'attivita' restava in ElaborazioneDati e occupava per sempre uno slot della coda.
///
/// Il contesto non apre mai una connessione: si lavora solo sul ChangeTracker.
/// </summary>
public class ModifichePendentiTests
{
    private static edro21_dbContext NuovoContesto() =>
        new(new DbContextOptionsBuilder<edro21_dbContext>()
            .UseNpgsql("Host=localhost;Database=nessuno")
            .Options);

    private static Attivitum AttivitaInElaborazione(edro21_dbContext ctx)
    {
        var attivita = new Attivitum { Id = 1, Titolo = "Import volantino", Contract = "{}", Stato = (byte)OperationStauts.ElaborazioneDati };
        ctx.Attivita.Attach(attivita);
        return attivita;
    }

    [Fact]
    public void L_articolo_rimasto_in_sospeso_viene_scartato()
    {
        using var ctx = NuovoContesto();
        var attivita = AttivitaInElaborazione(ctx);
        var articolo = new Articoli { Codice = "A1", Descrizione1 = "", Descrizione2 = "", Descrizione3 = "", Descrizione4 = "" };
        ctx.Articolis.Add(articolo);

        int scartate = ModifichePendenti.Scarta(ctx, attivita);

        Assert.Equal(1, scartate);
        Assert.Equal(EntityState.Detached, ctx.Entry(articolo).State);
    }

    [Fact]
    public void Anche_una_modifica_non_salvata_viene_scartata()
    {
        using var ctx = NuovoContesto();
        var attivita = AttivitaInElaborazione(ctx);
        var esistente = new Articoli { Id = 5, Codice = "B2", Descrizione1 = "", Descrizione2 = "", Descrizione3 = "", Descrizione4 = "" };
        ctx.Articolis.Attach(esistente);
        esistente.Ean = "8000000000000";
        ctx.ChangeTracker.DetectChanges();
        Assert.Equal(EntityState.Modified, ctx.Entry(esistente).State);

        ModifichePendenti.Scarta(ctx, attivita);

        Assert.Equal(EntityState.Detached, ctx.Entry(esistente).State);
    }

    [Fact]
    public void L_attivita_conserva_le_sue_modifiche()
    {
        using var ctx = NuovoContesto();
        var attivita = AttivitaInElaborazione(ctx);
        attivita.Progress = 40;
        ctx.ChangeTracker.DetectChanges();
        ctx.Articolis.Add(new Articoli { Codice = "A1", Descrizione1 = "", Descrizione2 = "", Descrizione3 = "", Descrizione4 = "" });

        ModifichePendenti.Scarta(ctx, attivita);

        Assert.Equal(EntityState.Modified, ctx.Entry(attivita).State);
        Assert.Equal((short)40, attivita.Progress);
    }

    // Lo scenario dei catch: dopo lo scarto, SaveChanges scriverebbe solo l'esito dell'attivita'
    // e il log dell'errore, e non piu' l'articolo che aveva fatto fallire tutto.
    [Fact]
    public void Dopo_lo_scarto_restano_solo_esito_e_log()
    {
        using var ctx = NuovoContesto();
        var attivita = AttivitaInElaborazione(ctx);
        ctx.Articolis.Add(new Articoli { Codice = "A1", Descrizione1 = "", Descrizione2 = "", Descrizione3 = "", Descrizione4 = "" });

        ModifichePendenti.Scarta(ctx, attivita);
        ctx.AttivitaLogs.Add(new AttivitaLog { IdAttivita = attivita.Id, DataRegistrazione = DateTime.Now, Tipo = 1, Note = "EX1: errore" });
        attivita.Stato = (byte)OperationStauts.TerminataConErrori;
        attivita.DataFine = DateTime.Now;
        ctx.ChangeTracker.DetectChanges();

        var daScrivere = ctx.ChangeTracker.Entries()
            .Where(e => e.State != EntityState.Unchanged)
            .Select(e => (e.Entity.GetType().Name, e.State))
            .OrderBy(x => x.Name)
            .ToList();

        Assert.Equal(new[] { (nameof(AttivitaLog), EntityState.Added), (nameof(Attivitum), EntityState.Modified) }, daScrivere);
    }

    [Fact]
    public void Senza_modifiche_pendenti_non_cambia_niente()
    {
        using var ctx = NuovoContesto();
        var attivita = AttivitaInElaborazione(ctx);

        int scartate = ModifichePendenti.Scarta(ctx, attivita);

        Assert.Equal(0, scartate);
        Assert.Equal(EntityState.Unchanged, ctx.Entry(attivita).State);
    }

    [Fact]
    public void Senza_attivita_da_conservare_si_scarta_tutto()
    {
        using var ctx = NuovoContesto();
        var attivita = AttivitaInElaborazione(ctx);
        attivita.Progress = 10;
        ctx.ChangeTracker.DetectChanges();

        ModifichePendenti.Scarta(ctx, null);

        Assert.Equal(EntityState.Detached, ctx.Entry(attivita).State);
    }
}
