using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Models.Vista;
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
/// I20-1189: le voci del report delle correzioni (ServizioStorico.ReportAsync) portano il box del
/// prodotto. Nel report dell'editor non si vede (data-box in Views/Storico/_VociReport.cshtml); il
/// report del timone lo usa per mettere la miniatura del prodotto accanto a ogni correzione.
/// </summary>
public class ReportCorrezioniBoxTests
{
    private const short IdMarketing = 7;
    private const short IdAgenzia = 8;

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-report-box-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    [Fact]
    public async Task Ogni_correzione_porta_il_suo_box_e_la_nota_sulla_pagina_nessuno()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int idVol;
        long idBox;
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            var oggi = DateTime.UtcNow.Date;
            var vol = new Volantini
            {
                Titolo = "0524_26_B_TDM_B", Classificazione = "0524_26_B", Status = 1, Margini = "0,0,0,0",
                DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
            };
            ctx.Volantinis.Add(vol);
            await ctx.SaveChangesAsync();
            var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
            ctx.VolantiniVersionis.Add(versione);
            await ctx.SaveChangesAsync();
            var pagina = new VolantiniPagine
            {
                IdVol = vol.Id, IdVersione = versione.Id, Numero = 1, Versione = 1,
                Path = "pag1_v1", PathFisico = "0524_26_B/x/pag1_v1", DataVersione = DateTime.UtcNow
            };
            ctx.VolantiniPagines.Add(pagina);
            await ctx.SaveChangesAsync();
            var box = new VolantiniPagineElementi
            {
                IdPagina = pagina.Id, LabelInd = "box", Basecode = "1130891", Contenuto = "", Larghezza = 100, Altezza = 100
            };
            ctx.VolantiniPagineElementis.Add(box);
            await ctx.SaveChangesAsync();
            VolantiniPagineNote Nota(long? idElemento, string testo) => new()
            {
                IdPagina = pagina.Id, IdElemento = idElemento, Tipo = ServizioCorrezioni.TipoNotaTestuale,
                Descrizione = testo, Posx = 10, Posy = 10, Stato = ServizioCorrezioni.StatoNonVerificata,
                IdAutore = IdMarketing, DataInserimento = DateTime.UtcNow
            };
            ctx.VolantiniPagineNotes.AddRange(Nota(box.Id, "sul prodotto"), Nota(null, "sulla pagina"));
            ctx.VolantiniPagineDisegniComposizionis.Add(new VolantiniPagineDisegniComposizioni
            {
                IdPagina = pagina.Id, IdElemento = box.Id, Simbolo = "_6_1_cambia_foto",
                Stato = ServizioCorrezioni.StatoNonVerificata, IdAutore = IdMarketing, DataInserimento = DateTime.UtcNow
            });
            await ctx.SaveChangesAsync();
            idVol = vol.Id;
            idBox = box.Id;
        }

        using (var scope = app.Services.CreateScope())
        {
            var storico = scope.ServiceProvider.GetRequiredService<ServizioStorico>();
            var r = await storico.ReportAsync(new ServizioCorrezioni.Utente(IdAgenzia, Ruoli.CodiceAgenzia, null, "Agenzia Prova"),
                                              idVol, 1, tutte: false, okVisto: false);
            Assert.NotNull(r);
            Assert.Equal(idBox, r!.Voci.Single(v => v.Testo == "sul prodotto").IdBox);
            Assert.Null(r.Voci.Single(v => v.Testo == "sulla pagina").IdBox);

            // I20-1189: la nota dice «Nota:», il timbro «Timbro:» col simbolo e il nome nel suggerimento
            var nota = r.Voci.Single(v => v.Testo == "sul prodotto").Blocchi.Single();
            Assert.Equal("Nota:", nota.Titolo);
            Assert.Equal(new[] { "sul prodotto" }, nota.Righe);
            var timbro = r.Voci.Single(v => v.Tipo == "timbro").Blocchi.Single();
            Assert.Equal("Timbro:", timbro.Titolo);
            Assert.Equal("_6_1_cambia_foto", timbro.Simbolo);
            Assert.Equal("Cambia foto", timbro.NomeSimbolo);
            Assert.Empty(timbro.Righe);
        }
    }

    /// <summary>I20-1189: l'Edit avanzato a pezzi, ognuno con la sua intestazione.</summary>
    [Fact]
    public void L_edit_avanzato_dice_prezzi_azioni_descrizione_foto_e_loghi()
    {
        var e = new EditVista
        {
            Campi = new()
            {
                ["prezzo_promo"] = "3.90", ["prezzo_promo_kgl"] = "7.09", ["txt_sconto"] = "-30%", ["n_pezzi_soci"] = "2",
                ["descrizione"] = "<DESCRIZIONE_TITOLO>mele golden</DESCRIZIONE_TITOLO>"
            },
            Azioni = { new AzioneEditVista { Id = 3, Titolo = "Taglio prezzo", Campi = new() { ["prezzo_promo"] = "2,99" } } },
            Foto =
            {
                new FotoEditVista { Codice = "6562233", GuidId = "g-1", Stato = 2 },
                new FotoEditVista { Codice = "1078545", GuidId = "", Stato = 1 },
                new FotoEditVista { Codice = "BIO", GuidId = "l-1", Stato = 4 },
                new FotoEditVista { Codice = "DOP", GuidId = "l-2", Stato = 5 }
            }
        };

        var b = ServizioStorico.BlocchiEdit(e).ToDictionary(x => x.Titolo);

        Assert.Equal(new[] { "Prezzo Promo: 3.90", "Prezzo al Kg/Lt: 7.09", "Sconto: -30%", "N pezzi soci: 2" },
                     b["Prezzo cambiato in:"].Righe);
        Assert.Equal(new[] { "Taglio prezzo (Prezzo Promo: 2,99)" }, b["Azione:"].Righe);
        Assert.Equal(new[] { "mele golden" }, b["Descrizione modificata in:"].Righe);
        Assert.Equal("6562233 – secondaria", b["Foto cambiata in:"].Foto.Single().Testo);
        Assert.Equal(new[] { "1078545 – primaria (senza foto)" }, b["Foto cambiata in:"].Righe);
        Assert.Equal("BIO", b["Logo inserito:"].Foto.Single().Testo);
        Assert.Equal("DOP", b["Logo rimosso:"].Foto.Single().Testo);
    }

    [Fact]
    public void Nel_report_dell_editor_il_box_viaggia_come_attributo_invisibile()
    {
        string voci = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Storico", "_VociReport.cshtml"));
        Assert.Contains("<div class=\"rp_voce\" data-box=\"@v.IdBox\">", voci);
        // I20-1189: i pezzi con l'intestazione in grassetto
        Assert.Contains("<b class=\"rp_btit\">@b.Titolo</b>", voci);
        Assert.Contains("title=\"@b.NomeSimbolo\"", voci);
    }

    private static string RadiceApplicazione()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidata = Path.Combine(d.FullName, "Correggo4");
            if (File.Exists(Path.Combine(candidata, "Correggo4.csproj")))
                return candidata;
        }
        throw new DirectoryNotFoundException("Cartella del progetto Correggo4 non trovata sopra " + AppContext.BaseDirectory);
    }
}
