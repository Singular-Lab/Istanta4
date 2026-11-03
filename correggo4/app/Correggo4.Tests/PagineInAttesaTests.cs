using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1184: le pagine che il timone ha cambiato si oscurano con «In attesa che l'Agenzia sistemi
/// l'impaginato.» e si bloccano per tutti tranne l'Agenzia (j307). Succedeva appena il timone era
/// salvato, anche a finestra del Marketing aperta, mentre il Marketing ci stava ancora lavorando.
/// Ora velo e blocco valgono solo a finestra chiusa (o non ancora partita).
///
/// Il volantino ha due pagine e un timone salvato in cui la referenza e' passata da pagina 1 a 2.
/// </summary>
public class PagineInAttesaTests
{
    private const short IdMarketing = 7;
    private const short IdAgenzia = 8;
    private const string Promo = "0524_26_B";

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-pagine-attesa-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Volantino(int Id, int Pagina1, int Pagina2);

    private static async Task<Volantino> VolantinoConTimoneSalvatoAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = Promo + "_TDM_B", Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        VolantiniPagine Pagina(short n) => new()
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = n, Versione = 1,
            Path = $"pag{n}_v1", PathFisico = $"{Promo}/{vol.Titolo}/pag{n}_v1", DataVersione = DateTime.UtcNow
        };
        var p1 = Pagina(1);
        var p2 = Pagina(2);
        ctx.VolantiniPagines.AddRange(p1, p2);
        await ctx.SaveChangesAsync();

        // il timone salvato una volta: la referenza da pagina 1 e' andata in pagina 2
        var piano = new VolantiniTimone
        {
            IdVol = vol.Id, Versione = 1, Stato = ServizioTimone.PianoInLavorazione, Revisione = 1,
            DataCreazione = DateTime.UtcNow, DataSalvataggio = DateTime.UtcNow, IdAutore = IdAgenzia
        };
        ctx.Timoni.Add(piano);
        await ctx.SaveChangesAsync();
        var tp1 = new VolantiniTimonePagine { IdTimone = piano.Id, Numero = 1, Ordine = 1, Attiva = true };
        var tp2 = new VolantiniTimonePagine { IdTimone = piano.Id, Numero = 2, Ordine = 2, Attiva = true };
        ctx.TimonePagine.AddRange(tp1, tp2);
        await ctx.SaveChangesAsync();
        ctx.TimoneVoci.Add(new VolantiniTimoneVoci
        {
            IdTimone = piano.Id, Codice = "1078545", Basecode = "1078545", Etichetta = "mele golden",
            IdPaginaTimone = tp2.Id, Posizione = 1, PaginaOrigine = 1, PosizioneOrigine = 1,
            Stato = ServizioTimone.VoceInPagina, DataModifica = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
        return new Volantino(vol.Id, p1.Id, p2.Id);
    }

    private static async Task FinestraAsync(WebApplicationFactory<Program> app, DateTime inizio, DateTime fine)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
        {
            Classificazione = Promo, DataInizio = inizio, DataFine = fine, IdAutore = IdAgenzia, DataModifica = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
    }

    private static ServizioCorrezioni.Utente Marketing() =>
        new(IdMarketing, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "Marketing Prova");

    private static ServizioCorrezioni.Utente Agenzia() =>
        new(IdAgenzia, Ruoli.CodiceAgenzia, null, "Agenzia Prova");

    private static async Task<List<short>> PagineDaSistemareAsync(WebApplicationFactory<Program> app, int idVol)
    {
        using var scope = app.Services.CreateScope();
        var stato = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().CaricaAsync(idVol, Marketing());
        return stato.PagineDaSistemare;
    }

    private static async Task<EsitoCorrezione> NotaAsync(WebApplicationFactory<Program> app, ServizioCorrezioni.Utente u, int idPagina)
    {
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>()
            .NuovaNotaAsync(u, 0, "spostare il prezzo", 10, 10, idPagina);
    }

    [Fact]
    public async Task A_finestra_aperta_nessun_velo_e_il_Marketing_corregge()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoConTimoneSalvatoAsync(app);
        await FinestraAsync(app, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddDays(1));

        Assert.Empty(await PagineDaSistemareAsync(app, v.Id));
        var esito = await NotaAsync(app, Marketing(), v.Pagina2);
        Assert.True(esito.Ok, esito.Messaggio);
    }

    [Fact]
    public async Task A_finestra_chiusa_le_pagine_aspettano_l_Agenzia()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoConTimoneSalvatoAsync(app);
        await FinestraAsync(app, DateTime.UtcNow.AddDays(-3), DateTime.UtcNow.AddHours(-1));

        Assert.Equal(new short[] { 1, 2 }, (await PagineDaSistemareAsync(app, v.Id)).ToArray());
        var esito = await NotaAsync(app, Marketing(), v.Pagina2);
        Assert.False(esito.Ok);
        Assert.Equal("attesa_impaginato", esito.Codice);
    }

    /// <summary>
    /// L'Agenzia non scrive note, le accetta: a finestra chiusa vede le pagine da sistemare e sulle
    /// correzioni di quelle pagine continua a lavorare.
    /// </summary>
    [Fact]
    public async Task A_finestra_chiusa_l_Agenzia_vede_le_pagine_e_accetta_le_correzioni()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoConTimoneSalvatoAsync(app);
        await FinestraAsync(app, DateTime.UtcNow.AddDays(-3), DateTime.UtcNow.AddHours(-1));
        long idNota;
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            var nota = new VolantiniPagineNote
            {
                IdPagina = v.Pagina2, Tipo = ServizioCorrezioni.TipoNotaTestuale, Descrizione = "spostare il prezzo",
                Posx = 10, Posy = 10, Stato = ServizioCorrezioni.StatoNonVerificata, IdAutore = IdMarketing,
                DataInserimento = DateTime.UtcNow.AddHours(-2)
            };
            ctx.VolantiniPagineNotes.Add(nota);
            await ctx.SaveChangesAsync();
            idNota = nota.Id;
        }

        using (var scope = app.Services.CreateScope())
        {
            var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
            Assert.Equal(new short[] { 1, 2 }, (await servizio.CaricaAsync(v.Id, Agenzia())).PagineDaSistemare.ToArray());
            var esito = await servizio.AccettaNotaAsync(Agenzia(), idNota);
            Assert.True(esito.Ok, esito.Messaggio);
        }
    }

    [Fact]
    public async Task Una_finestra_che_deve_ancora_partire_non_toglie_il_velo()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoConTimoneSalvatoAsync(app);
        await FinestraAsync(app, DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(3));

        Assert.Equal(new short[] { 1, 2 }, (await PagineDaSistemareAsync(app, v.Id)).ToArray());
        Assert.Equal("attesa_impaginato", (await NotaAsync(app, Marketing(), v.Pagina1)).Codice);
    }
}
