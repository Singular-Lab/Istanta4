using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1233: gli scambi del menabo' avanzato (timone) nel Report Correggo del Plugin. Quando il Marketing ha
/// spostato delle referenze dentro una pagina e il piano aspetta l'Agenzia (salvato, finestra chiusa, niente
/// FATTO dopo), Plugin/Correzioni porta uno scambio per referenza: il suo box va al posto del box che
/// nell'impaginato stava in quella casella. Con una griglia nuova lo scambio e' a mano. Gli scambi non si
/// chiudono uno per uno: se il Plugin li ha applicati tutti e il piano non ha altro, si registra il FATTO.
/// Database in memoria.
/// </summary>
public class TimoneScambiPluginTests
{
    private const int Lavorazione = 4321;
    private const string Promo = "0S25_26_B";

    private sealed record Volantino(int Id, long Piano, long PaginaTimone, Dictionary<string, long> Box, Dictionary<string, long> Voce);

    /// <summary>
    /// Un volantino della lavorazione con pagina 3 e quattro box (8001-8004 in ordine di lettura, due per
    /// riga: la griglia di partenza del timone e' la 2x3), il piano
    /// del timone fotografato e salvato dal Marketing, la finestra del Marketing gia' chiusa. Le voci partono
    /// tutte nella loro casella d'origine: ogni test sposta quelle che gli servono.
    /// </summary>
    private static async Task<Volantino> VolantinoAsync(FabbricaCorreggo app, bool finestraAperta = false)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;

        var marketing = new Utenti
        {
            Nome = "Mario", Cognome = "Marketing", Email = "marketing@prova.local", Username = "marketing@prova.local",
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = ServizioCorrezioni.TipoFicoMarketing, Attivo = true, DataInserimento = oggi
        };
        ctx.Utentis.Add(marketing);

        var vol = new Volantini
        {
            Titolo = Promo + "_TDM_B", Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
            IdLavorazioneIstanta = Lavorazione, UltimaPubblicazione = DateTime.UtcNow,
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();

        var pagina = new VolantiniPagine
        {
            IdVol = vol.Id, Numero = 3, Versione = 1, Path = "pag3_v1",
            PathFisico = $"{Promo}/{vol.Titolo}/pag3_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();

        var codici = new[] { "8001", "8002", "8003", "8004" };
        var elementi = codici.Select((c, i) => new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "BOX_STD_" + c, Basecode = c, Contenuto = "",
            PosizioneX = i % 2 * 110, PosizioneY = i / 2 * 110, Larghezza = 100, Altezza = 100
        }).ToList();
        ctx.VolantiniPagineElementis.AddRange(elementi);
        await ctx.SaveChangesAsync();

        var piano = new VolantiniTimone
        {
            IdVol = vol.Id, Versione = 1, Stato = ServizioTimone.PianoInLavorazione, Revisione = 2,
            DataCreazione = DateTime.UtcNow.AddDays(-1), DataSalvataggio = DateTime.UtcNow.AddHours(-2),
            IdAutore = marketing.Id, IdUltimoSalvataggio = marketing.Id
        };
        ctx.Timoni.Add(piano);
        await ctx.SaveChangesAsync();
        var tp = new VolantiniTimonePagine { IdTimone = piano.Id, Numero = 3, Ordine = 3, Attiva = true };
        ctx.TimonePagine.Add(tp);
        await ctx.SaveChangesAsync();

        var voci = elementi.Select((e, i) => new VolantiniTimoneVoci
        {
            IdTimone = piano.Id, IdElemento = e.Id, Codice = e.Basecode, Basecode = e.Basecode, Etichetta = "ref " + e.Basecode,
            IdPaginaTimone = tp.Id, Posizione = (short)(i + 1), PaginaOrigine = 3, PosizioneOrigine = (short)(i + 1),
            Stato = ServizioTimone.VoceInPagina
        }).ToList();
        ctx.TimoneVoci.AddRange(voci);

        ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
        {
            Classificazione = Promo,
            DataInizio = DateTime.UtcNow.AddDays(-3),
            DataFine = finestraAperta ? DateTime.UtcNow.AddDays(1) : DateTime.UtcNow.AddHours(-1),
            IdAutore = marketing.Id, DataModifica = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();

        return new Volantino(vol.Id, piano.Id, tp.Id,
            elementi.ToDictionary(e => e.Basecode, e => e.Id), voci.ToDictionary(v => v.Codice, v => v.Id));
    }

    /// <summary>Il Marketing mette ogni referenza indicata nella casella data, come il SALVA del timone.</summary>
    private static async Task SpostaAsync(FabbricaCorreggo app, Volantino v, params (string Codice, short Casella)[] spostamenti)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        foreach (var (codice, casella) in spostamenti)
        {
            var voce = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce[codice]);
            voce.Posizione = casella;
            voce.DataModifica = DateTime.UtcNow.AddHours(-2);
        }
        await ctx.SaveChangesAsync();
    }

    private static async Task ModificaAsync(FabbricaCorreggo app, Func<Correggo4Context, Task> modifica)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        await modifica(ctx);
        await ctx.SaveChangesAsync();
    }

    private static ServizioCorrezioni.Utente Agenzia() => new(8, Ruoli.CodiceAgenzia, null, "Agenzia Prova");

    private static async Task<CorrezioniPerPlugin> LeggiAsync(FabbricaCorreggo app)
    {
        using var scope = app.Services.CreateScope();
        var e = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().CorrezioniPerPluginAsync(Agenzia(), Lavorazione);
        Assert.True(e.Ok, e.Messaggio);
        return (CorrezioniPerPlugin)e.Dati!;
    }

    private static async Task<List<ChiusuraPlugin>> ChiudiAsync(FabbricaCorreggo app, params string[] approvate)
    {
        using var scope = app.Services.CreateScope();
        var e = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().ChiudiDalPluginAsync(Agenzia(), Lavorazione, approvate);
        Assert.True(e.Ok, e.Messaggio);
        return (List<ChiusuraPlugin>)e.Dati!;
    }

    private static async Task<VolantiniTimone> PianoAsync(FabbricaCorreggo app, Volantino v)
    {
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<Correggo4Context>().Timoni.AsNoTracking().FirstAsync(t => t.Id == v.Piano);
    }

    private static List<CorrezionePlugin> Scambi(CorrezioniPerPlugin c) => c.Correzioni.Where(x => x.Tipo == "timone").ToList();

    // ------------------------------------------------------------------ lettura

    [Fact]
    public async Task Due_referenze_scambiate_danno_due_scambi_con_il_box_di_destinazione()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var c = await LeggiAsync(app);

        var scambi = Scambi(c);
        Assert.Equal(2, scambi.Count);
        var s1 = scambi.Single(s => s.Basecode == "8001");
        Assert.Equal($"timone:{v.Voce["8001"]}", s1.Id);
        Assert.Equal((short)3, s1.Pagina);
        Assert.Equal("BOX_STD_8001", s1.LabelBox);
        Assert.Equal("8003", s1.BasecodeDestinazione);
        Assert.Equal("BOX_STD_8003", s1.LabelBoxDestinazione);
        Assert.Null(s1.DaSistemareAMano);
        Assert.Equal("Mario Marketing", s1.Autore);
        Assert.Equal("Marketing", s1.TipoAutore);
        Assert.Equal("8001", scambi.Single(s => s.Basecode == "8003").BasecodeDestinazione);
        Assert.Equal(0, c.AltreModificheTimone);
    }

    [Fact]
    public async Task Lo_scambio_porta_il_rettangolo_della_casella_nell_impaginato()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var scambi = Scambi(await LeggiAsync(app));

        // la 8001 va nella casella 3, dove nell'impaginato c'era la 8003: X 0, Y 110, 100 x 100
        Assert.Equal(new[] { 110m, 0m, 210m, 100m }, scambi.Single(s => s.Basecode == "8001").BoundsDestinazione);
        Assert.Equal(new[] { 0m, 0m, 100m, 100m }, scambi.Single(s => s.Basecode == "8003").BoundsDestinazione);
    }

    [Fact]
    public async Task Una_referenza_toccata_e_rimessa_nella_sua_casella_torna_al_suo_posto_e_non_e_un_altra_modifica()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        // un giro precedente: il Marketing aveva spostato la 8002, poi l'ha rimessa nella casella 2
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1), ("8002", 2));

        var c = await LeggiAsync(app);

        var scambi = Scambi(c);
        Assert.Equal(3, scambi.Count);
        var aCasa = scambi.Single(s => s.Basecode == "8002");
        Assert.Equal("8002", aCasa.BasecodeDestinazione);
        Assert.Equal(new[] { 0m, 110m, 100m, 210m }, aCasa.BoundsDestinazione);
        Assert.Null(aCasa.DaSistemareAMano);
        Assert.Equal(0, c.AltreModificheTimone);

        var esiti = await ChiudiAsync(app, scambi.Select(s => s.Id).ToArray());
        Assert.All(esiti, e => Assert.True(e.Ok, e.Messaggio));
        Assert.NotNull((await PianoAsync(app, v)).DataSistemato);
    }

    [Fact]
    public async Task Uno_scambio_a_mano_non_porta_il_rettangolo()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8004", 6));

        var s = Assert.Single(Scambi(await LeggiAsync(app)));

        Assert.NotNull(s.DaSistemareAMano);
        Assert.Null(s.BoundsDestinazione);
    }

    [Fact]
    public async Task Una_referenza_fatta_scorrere_sposta_anche_quelle_in_mezzo()
    {
        using var app = new FabbricaCorreggo();
        var v = await ScorrimentoAsync(app);

        var scambi = Scambi(await LeggiAsync(app));

        Assert.Equal(new[] { ("8001", "8002"), ("8002", "8003"), ("8003", "8001") },
            scambi.Select(s => (s.Basecode, s.BasecodeDestinazione!)).OrderBy(x => x.Item1).ToArray());
    }

    /// <summary>8003 trascinata sulla casella 1: 8001 e 8002 scalano di una.</summary>
    private static async Task<Volantino> ScorrimentoAsync(FabbricaCorreggo app)
    {
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8003", 1), ("8001", 2), ("8002", 3));
        return v;
    }

    [Fact]
    public async Task Con_la_griglia_di_partenza_del_timone_lo_scambio_e_automatico()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));
        // la griglia che il timone mette da solo e scrive al primo SALVA
        await ModificaAsync(app, async ctx => (await ctx.TimonePagine.FirstAsync(p => p.Id == v.PaginaTimone)).Griglia = "2x3");

        var scambi = Scambi(await LeggiAsync(app));

        Assert.Equal(2, scambi.Count);
        Assert.All(scambi, s => Assert.Null(s.DaSistemareAMano));
        Assert.Equal("8003", scambi.Single(s => s.Basecode == "8001").BasecodeDestinazione);
        Assert.Equal("8001", scambi.Single(s => s.Basecode == "8003").BasecodeDestinazione);
    }

    [Fact]
    public async Task Una_pagina_ridisegnata_con_un_altra_griglia_si_rifa_come_la_disegna_il_menabo()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));
        await ModificaAsync(app, async ctx => (await ctx.TimonePagine.FirstAsync(p => p.Id == v.PaginaTimone)).Griglia = "3x3");

        var scambi = Scambi(await LeggiAsync(app));

        // tutta la pagina, anche le referenze non toccate: nella 3x3 cambiano posto tutte
        Assert.Equal(4, scambi.Count);
        Assert.All(scambi, s => Assert.Null(s.DaSistemareAMano));
        // riquadro 0-210, caselle da 70, fra le caselle i 10 punti che c'erano fra i box
        Assert.Equal(new[] { 0m, 0m, 65m, 65m }, scambi.Single(s => s.Basecode == "8003").BoundsDestinazione);
        Assert.Equal(new[] { 0m, 75m, 65m, 135m }, scambi.Single(s => s.Basecode == "8002").BoundsDestinazione);
        Assert.Equal(new[] { 0m, 145m, 65m, 210m }, scambi.Single(s => s.Basecode == "8001").BoundsDestinazione);
        Assert.Equal(new[] { 75m, 0m, 135m, 65m }, scambi.Single(s => s.Basecode == "8004").BoundsDestinazione);
        Assert.Equal("", scambi.Single(s => s.Basecode == "8001").BasecodeDestinazione);
    }

    [Fact]
    public async Task Su_una_pagina_ridisegnata_l_allargata_prende_tutte_le_sue_caselle()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        // come pagina 13 del 13/11: 3x3, la prima referenza allargata su tutta la prima riga
        await SpostaAsync(app, v, ("8004", 1), ("8001", 4), ("8002", 5), ("8003", 6));
        await ModificaAsync(app, async ctx =>
        {
            (await ctx.TimonePagine.FirstAsync(p => p.Id == v.PaginaTimone)).Griglia = "3x3";
            (await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce["8004"])).Colonne = 3;
        });

        var scambi = Scambi(await LeggiAsync(app));

        var larga = scambi.Single(s => s.Basecode == "8004");
        Assert.Null(larga.DaSistemareAMano);
        Assert.Equal(new[] { 0m, 0m, 65m, 210m }, larga.BoundsDestinazione);
        Assert.Equal((short)3, larga.Colonne);
        Assert.Equal(new[] { 75m, 145m, 135m, 210m }, scambi.Single(s => s.Basecode == "8003").BoundsDestinazione);
    }

    [Fact]
    public async Task Una_referenza_allargata_prende_i_box_della_sua_riga()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        // la 8001 allargata su due colonne dalla casella 1: la 8002 scende nella 3, la 8003 nella 4, la 8004
        // nella 5
        await SpostaAsync(app, v, ("8001", 1), ("8002", 3), ("8003", 4), ("8004", 5));
        await ModificaAsync(app, async ctx =>
        {
            (await ctx.TimonePagine.FirstAsync(p => p.Id == v.PaginaTimone)).Griglia = "2x3";
            (await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce["8001"])).Colonne = 2;
        });

        var scambi = Scambi(await LeggiAsync(app));

        var larga = scambi.Single(s => s.Basecode == "8001");
        Assert.Null(larga.DaSistemareAMano);
        // 8001 (X 0) e 8002 (X 110) stanno sulla stessa riga: il box va da 0 a 210
        Assert.Equal(new[] { 0m, 0m, 100m, 210m }, larga.BoundsDestinazione);
        Assert.Equal((short)2, larga.Colonne);
        Assert.Equal((short)1, larga.Casella);
        Assert.Equal(new[] { 110m, 0m, 210m, 100m }, scambi.Single(s => s.Basecode == "8002").BoundsDestinazione);
    }

    [Fact]
    public async Task Una_referenza_allargata_fuori_dalla_griglia_si_sistema_a_mano()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1), ("8004", 4));
        await ModificaAsync(app, async ctx =>
        {
            (await ctx.TimonePagine.FirstAsync(p => p.Id == v.PaginaTimone)).Griglia = "2x3";
            (await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce["8004"])).Colonne = 2;
        });

        var scambi = Scambi(await LeggiAsync(app));

        Assert.Contains("esce dalla griglia 2x3", scambi.Single(s => s.Basecode == "8004").DaSistemareAMano);
        // gli altri scambi della pagina restano automatici
        Assert.Null(scambi.Single(s => s.Basecode == "8001").DaSistemareAMano);
    }

    [Fact]
    public async Task Una_pagina_che_il_menabo_disegna_diversamente_dall_impaginato_si_rifa_come_nel_disegno()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        // come pagina 13 del 13/11: in cima un box largo tutta la pagina, sotto gli altri. Il timone la
        // disegna in una 2x3 con la 8002 accanto alla 8001: la pagina si rifa' come la vede il Marketing.
        await ModificaAsync(app, async ctx =>
        {
            var e = await ctx.VolantiniPagineElementis.Where(x => v.Box.Values.Contains(x.Id)).ToListAsync();
            void Metti(string codice, decimal x, decimal y, decimal w) { var b = e.Single(k => k.Id == v.Box[codice]); b.PosizioneX = x; b.PosizioneY = y; b.Larghezza = w; }
            Metti("8001", 0, 0, 210); Metti("8002", 0, 110, 100); Metti("8003", 110, 110, 100); Metti("8004", 0, 220, 100);
            (await ctx.TimonePagine.FirstAsync(p => p.Id == v.PaginaTimone)).Griglia = "2x3";
        });
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var scambi = Scambi(await LeggiAsync(app));

        Assert.Equal(4, scambi.Count);
        Assert.All(scambi, s => Assert.Null(s.DaSistemareAMano));
        // la 8003 nella casella 1: in alto a sinistra, larga meta' riquadro meno mezzo spazio
        var b = scambi.Single(s => s.Basecode == "8003").BoundsDestinazione!;
        Assert.Equal(0m, b[0]);
        Assert.Equal(0m, b[1]);
        Assert.Equal(100m, b[3]);
    }

    [Fact]
    public async Task Le_modifiche_sistemate_con_il_FATTO_non_tornano()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        var fatto = DateTime.UtcNow.AddHours(-1);
        await ModificaAsync(app, async ctx =>
        {
            // primo giro: 8001 e 8003 scambiate, poi il FATTO
            foreach (var (codice, casella) in new[] { ("8001", (short)3), ("8003", (short)1) })
            {
                var voce = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce[codice]);
                voce.Posizione = casella; voce.DataModifica = fatto.AddMinutes(-30);
            }
            // secondo giro, dopo il FATTO: 8002 e 8004 scambiate
            foreach (var (codice, casella) in new[] { ("8002", (short)4), ("8004", (short)2) })
            {
                var voce = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce[codice]);
                voce.Posizione = casella; voce.DataModifica = fatto.AddMinutes(30);
            }
            var piano = await ctx.Timoni.FirstAsync(t => t.Id == v.Piano);
            piano.DataSistemato = fatto;
            piano.DataSalvataggio = fatto.AddMinutes(30);
        });

        var c = await LeggiAsync(app);

        Assert.Equal(new[] { "8002", "8004" }, Scambi(c).Select(s => s.Basecode).OrderBy(x => x).ToArray());
        Assert.Equal(0, c.AltreModificheTimone);
    }

    [Fact]
    public void Il_disegno_del_menabo_torna_sulle_pagine_regolari_e_non_su_quelle_irregolari()
    {
        var g = GriglieFormato.Trova("2x3")!;
        ServizioTimone.Rettangolo R(decimal x, decimal y, decimal w, decimal h) => new(x, y, x + w, y + h);

        // pagina 15 del 13/11: due per riga su tre righe, l'ultima con un box solo
        var p15 = new List<(short, ServizioTimone.Rettangolo)>
        {
            (1, R(8.5m, 30m, 93.83m, 78.25m)), (2, R(106.45m, 30m, 95.05m, 78.25m)),
            (3, R(8.5m, 109.15m, 93.83m, 81.1m)), (4, R(106.45m, 109.15m, 95.05m, 81.1m)),
            (5, R(8.5m, 190.55m, 93.83m, 82.15m))
        };
        Assert.True(ServizioTimone.PaginaDisegnataComeImpaginato(g, p15));

        // una 2x2 disegnata in una 2x3: le misure non tornano, le posizioni relative si'
        var p2x2 = new List<(short, ServizioTimone.Rettangolo)>
        {
            (1, R(0m, 0m, 100m, 100m)), (2, R(110m, 0m, 100m, 100m)), (3, R(0m, 110m, 100m, 100m)), (4, R(110m, 110m, 100m, 100m))
        };
        Assert.True(ServizioTimone.PaginaDisegnataComeImpaginato(g, p2x2));

        // pagina 13 del 13/11: il latte largo tutta la pagina in cima, l'Alce Nero nella riga sotto
        var p13 = new List<(short, ServizioTimone.Rettangolo)>
        {
            (1, R(8.5m, 26.5m, 193m, 81.81m)), (2, R(73.84m, 112.5m, 62.5m, 77.94m)), (3, R(141.17m, 112.23m, 60.33m, 78.21m)),
            (4, R(8.9m, 194.5m, 94.1m, 77.94m)), (5, R(106.43m, 194.5m, 95.11m, 78.34m))
        };
        Assert.False(ServizioTimone.PaginaDisegnataComeImpaginato(g, p13));
    }

    [Fact]
    public void Su_un_impaginato_irregolare_l_allargata_non_prende_la_riga_sotto()
    {
        // pagina 13 della prova del 13/11: in cima un box largo tutta la pagina, nella riga sotto due box
        var griglia = GriglieFormato.Trova("2x3");
        var cima = new ServizioTimone.Rettangolo(8.5m, 26.5m, 201.5m, 108.31m);
        var sotto = new ServizioTimone.Rettangolo(73.84m, 112.5m, 136.34m, 190.44m);
        var destra = new ServizioTimone.Rettangolo(141.17m, 112.23m, 201.5m, 190.44m);
        var caselle = new Dictionary<short, ServizioTimone.Rettangolo> { [1] = cima, [2] = sotto, [3] = destra };

        var (r, motivo) = ServizioTimone.RettangoloAllargato(griglia, 1, 2, 1, caselle.Values.ToList(),
            k => caselle.TryGetValue(k, out var x) ? x : null);

        Assert.Equal(cima, r);
        Assert.Equal("", motivo);
    }

    [Fact]
    public void Una_referenza_allargata_in_altezza_prende_i_box_della_sua_colonna()
    {
        var griglia = GriglieFormato.Trova("2x3");
        var caselle = new Dictionary<short, ServizioTimone.Rettangolo>
        {
            [1] = new(0m, 0m, 100m, 100m), [2] = new(110m, 0m, 210m, 100m),
            [3] = new(0m, 110m, 100m, 210m), [4] = new(110m, 110m, 210m, 210m)
        };

        var (r, _) = ServizioTimone.RettangoloAllargato(griglia, 1, 1, 2, caselle.Values.ToList(),
            k => caselle.TryGetValue(k, out var x) ? x : null);

        Assert.Equal(new ServizioTimone.Rettangolo(0m, 0m, 100m, 210m), r);
    }

    [Fact]
    public void Senza_box_da_unire_l_allargata_non_si_indovina()
    {
        // la casella accanto nell'impaginato era vuota: non si sa quanto allargare
        var griglia = GriglieFormato.Trova("2x3");
        var uno = new ServizioTimone.Rettangolo(0m, 0m, 100m, 100m);
        var tre = new ServizioTimone.Rettangolo(0m, 110m, 100m, 210m);
        var quattro = new ServizioTimone.Rettangolo(110m, 110m, 210m, 210m);
        var caselle = new Dictionary<short, ServizioTimone.Rettangolo> { [1] = uno, [3] = tre, [4] = quattro };

        var (r, motivo) = ServizioTimone.RettangoloAllargato(griglia, 1, 2, 1, caselle.Values.ToList(),
            k => caselle.TryGetValue(k, out var x) ? x : null);

        Assert.Null(r);
        Assert.Contains("non ci sono box da unire", motivo);
    }

    [Fact]
    public void La_griglia_di_partenza_e_quella_che_conta_il_timone()
    {
        // sei box, due per riga su tre righe: combacia la 2x3 (2 colonne, 3 righe)
        var seiBox = Enumerable.Range(0, 6).Select(i => ((decimal)(i % 2 * 110), (decimal)(i / 2 * 110), 100m, 100m)).ToList();
        Assert.Equal("2x3", ServizioTimone.GrigliaDiPartenza(seiBox)?.Nome);

        // due box affiancati con le Y quasi uguali (75,2 e 75,4) sono una riga sola, non due
        var affiancati = new List<(decimal, decimal, decimal, decimal)> { (0m, 75.2m, 100m, 80m), (110m, 75.4m, 100m, 80m) };
        Assert.Equal("2x3", ServizioTimone.GrigliaDiPartenza(affiancati)?.Nome);

        // tre box in colonna: la 1x3
        var colonna = Enumerable.Range(0, 3).Select(i => (0m, (decimal)(i * 110), 100m, 100m)).ToList();
        Assert.Equal("1x3", ServizioTimone.GrigliaDiPartenza(colonna)?.Nome);

        // nessun box, nessuna griglia
        Assert.Null(ServizioTimone.GrigliaDiPartenza(new List<(decimal, decimal, decimal, decimal)>()));
    }

    [Fact]
    public async Task Una_casella_che_nell_impaginato_era_vuota_si_sistema_a_mano()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8004", 6));

        var s = Assert.Single(Scambi(await LeggiAsync(app)));

        Assert.Contains("casella 6 di pagina 3", s.DaSistemareAMano);
    }

    [Fact]
    public async Task A_finestra_del_Marketing_aperta_non_ci_sono_scambi()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app, finestraAperta: true);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var c = await LeggiAsync(app);

        Assert.Empty(Scambi(c));
        Assert.Null(c.AltreModificheTimone);
    }

    [Fact]
    public async Task Dopo_il_FATTO_dell_Agenzia_non_ci_sono_scambi()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));
        await ModificaAsync(app, async ctx => (await ctx.Timoni.FirstAsync(t => t.Id == v.Piano)).DataSistemato = DateTime.UtcNow);

        Assert.Empty(Scambi(await LeggiAsync(app)));
    }

    [Fact]
    public async Task Un_piano_mai_salvato_o_senza_spostamenti_non_porta_niente()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);

        Assert.Empty(Scambi(await LeggiAsync(app)));
    }

    // ------------------------------------------------------------------ raggruppamenti

    /// <summary>Le referenze indicate entrano nel gruppo idGruppo: la prima tiene la casella, le altre le stanno
    /// dietro senza posizione, come UNISCI AL GRUPPO e il SALVA del timone.</summary>
    private static async Task UnisciAsync(FabbricaCorreggo app, Volantino v, long idGruppo, params string[] codici)
    {
        await ModificaAsync(app, async ctx =>
        {
            for (int i = 0; i < codici.Length; i++)
            {
                var voce = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce[codici[i]]);
                voce.IdGruppo = idGruppo;
                if (i > 0) voce.Posizione = null;
                voce.DataModifica = DateTime.UtcNow.AddHours(-2);
            }
        });
    }

    /// <summary>Il box della 8003 diventa una linea con la 8013, come un gruppo nato in Istanta: due voci dello
    /// stesso box con lo stesso gruppo, la seconda senza casella.</summary>
    private static async Task<long> LineaAsync(FabbricaCorreggo app, Volantino v)
    {
        long id = 0;
        await ModificaAsync(app, async ctx =>
        {
            var capo = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce["8003"]);
            capo.IdGruppo = 2;
            var seconda = new VolantiniTimoneVoci
            {
                IdTimone = v.Piano, IdElemento = v.Box["8003"], Codice = "8013", Basecode = "8003", Etichetta = "ref 8013",
                IdPaginaTimone = v.PaginaTimone, Posizione = null, PaginaOrigine = 3, PosizioneOrigine = 3,
                Stato = ServizioTimone.VoceInPagina, IdGruppo = 2
            };
            ctx.TimoneVoci.Add(seconda);
            await ctx.SaveChangesAsync();
            id = seconda.Id;
        });
        return id;
    }

    [Fact]
    public async Task Due_box_uniti_nel_timone_danno_un_raggruppamento_con_il_capogruppo_primo()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await UnisciAsync(app, v, 1, "8001", "8002");

        var c = await LeggiAsync(app);

        var r = Assert.Single(Scambi(c));
        Assert.Equal($"timone:{v.Voce["8001"]}", r.Id);
        Assert.Equal("8001", r.Basecode);
        var unisci = Assert.Single(r.Unisci!);
        Assert.Equal("8002", unisci.Basecode);
        Assert.Equal("BOX_STD_8002", unisci.LabelBox);
        Assert.Equal((short)3, unisci.Pagina);
        Assert.Equal(new[] { "8002" }, unisci.Codici);
        Assert.Equal(new[] { "8001", "8002" }, r.Codici);
        // la casella del gruppo e' la 1, dove sta il box del capogruppo
        Assert.Equal(new[] { 0m, 0m, 100m, 100m }, r.BoundsDestinazione);
        Assert.Null(r.DaSistemareAMano);
        // la 8002 segue il gruppo: non e' un'altra modifica
        Assert.Equal(0, c.AltreModificheTimone);

        var esiti = await ChiudiAsync(app, r.Id);
        Assert.True(Assert.Single(esiti).Ok);
        Assert.NotNull((await PianoAsync(app, v)).DataSistemato);
    }

    [Fact]
    public async Task Una_linea_presa_solo_in_parte_dal_gruppo_e_da_sistemare_a_mano()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        var idSeconda = await LineaAsync(app, v);
        // UNISCI AL GRUPPO della sola 8013: la 8003 resta nella sua linea
        await ModificaAsync(app, async ctx =>
        {
            var capo = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce["8001"]);
            capo.IdGruppo = 1;
            capo.DataModifica = DateTime.UtcNow.AddHours(-2);
            var presa = await ctx.TimoneVoci.FirstAsync(x => x.Id == idSeconda);
            presa.IdGruppo = 1;
            presa.DataModifica = DateTime.UtcNow.AddHours(-2);
        });

        var r = Assert.Single(Scambi(await LeggiAsync(app)));

        Assert.Equal("8001", r.Basecode);
        Assert.Contains("solo una parte del box 8003", r.DaSistemareAMano);
        Assert.Null(r.BoundsDestinazione);
    }

    [Fact]
    public async Task Un_gruppo_nato_in_Istanta_si_scambia_e_non_si_raggruppa()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await LineaAsync(app, v);
        await SpostaAsync(app, v, ("8003", 4), ("8004", 3));

        var scambi = Scambi(await LeggiAsync(app));

        Assert.Equal(2, scambi.Count);
        Assert.All(scambi, s => Assert.Null(s.Unisci));
        Assert.Equal("8004", scambi.Single(s => s.Basecode == "8003").BasecodeDestinazione);
    }

    [Fact]
    public async Task Lo_scambio_porta_le_referenze_che_servono_allo_sgruppa_del_Plugin()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var s1 = Scambi(await LeggiAsync(app)).Single(s => s.Basecode == "8001");

        Assert.Equal(new[] { "8001" }, s1.Codici);
        Assert.Equal(new[] { "8001" }, s1.CodiciDelBox);
        Assert.Equal(new[] { "8001", "8002", "8003", "8004" }, s1.CodiciTimone!.OrderBy(c => c));
    }

    [Fact]
    public async Task Una_referenza_staccata_da_una_linea_di_Istanta_e_da_sistemare_a_mano()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        var idSeconda = await LineaAsync(app, v);
        // UNGROUP & SUSPEND della 8013, poi il Marketing la mette nella casella 4
        await ModificaAsync(app, async ctx =>
        {
            var staccata = await ctx.TimoneVoci.FirstAsync(x => x.Id == idSeconda);
            staccata.IdGruppo = null;
            staccata.Posizione = 4;
            staccata.DataModifica = DateTime.UtcNow.AddHours(-2);
        });

        var s = Scambi(await LeggiAsync(app)).Single(x => x.Codice == "8013");

        Assert.Contains("8013 nel menabò è separata da 8003", s.DaSistemareAMano);
        Assert.Null(s.BoundsDestinazione);
    }

    // ------------------------------------------------------------------ chiusura: il FATTO

    [Fact]
    public async Task Con_tutti_gli_scambi_applicati_il_menabo_avanzato_risulta_FATTO()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var esiti = await ChiudiAsync(app, $"timone:{v.Voce["8001"]}", $"timone:{v.Voce["8003"]}");

        Assert.All(esiti, e => Assert.True(e.Ok, e.Messaggio));
        var piano = await PianoAsync(app, v);
        Assert.NotNull(piano.DataSistemato);
        Assert.Equal((short)8, piano.IdSistemato);
        Assert.Empty(Scambi(await LeggiAsync(app)));
    }

    [Fact]
    public async Task Con_uno_scambio_solo_non_si_registra_il_FATTO_e_lo_si_dice()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var e = Assert.Single(await ChiudiAsync(app, $"timone:{v.Voce["8001"]}"));

        Assert.False(e.Ok);
        Assert.Equal("timone_non_fatto", e.Codice);
        Assert.Contains("ne mancano 1", e.Messaggio);
        Assert.Null((await PianoAsync(app, v)).DataSistemato);
        Assert.Equal(2, Scambi(await LeggiAsync(app)).Count);
    }

    [Fact]
    public async Task Con_altre_modifiche_del_piano_il_FATTO_resta_all_Agenzia()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));
        // il Marketing ha anche mandato fuori volantino la 8004
        await ModificaAsync(app, async ctx =>
        {
            var voce = await ctx.TimoneVoci.FirstAsync(x => x.Id == v.Voce["8004"]);
            voce.Stato = ServizioTimone.VoceFuoriVolantino;
            voce.Posizione = null;
            voce.DataModifica = DateTime.UtcNow.AddHours(-2);
        });

        var c = await LeggiAsync(app);
        Assert.Equal(1, c.AltreModificheTimone);
        var esiti = await ChiudiAsync(app, Scambi(c).Select(s => s.Id).ToArray());

        Assert.All(esiti, e =>
        {
            Assert.False(e.Ok);
            Assert.Equal("timone_non_fatto", e.Codice);
            Assert.Contains("altre 1 modifiche", e.Messaggio);
        });
        Assert.Null((await PianoAsync(app, v)).DataSistemato);
    }

    [Fact]
    public async Task Uno_scambio_che_non_e_del_piano_non_si_chiude()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var e = Assert.Single(await ChiudiAsync(app, "timone:999999"));

        Assert.False(e.Ok);
        Assert.Equal("non_aperta", e.Codice);
        Assert.Null((await PianoAsync(app, v)).DataSistemato);
    }

    [Fact]
    public async Task Le_correzioni_dell_editor_si_chiudono_come_prima_anche_con_gli_scambi()
    {
        using var app = new FabbricaCorreggo();
        var v = await VolantinoAsync(app);
        await SpostaAsync(app, v, ("8001", 3), ("8003", 1));

        var esiti = await ChiudiAsync(app, "nota:123456");

        var e = Assert.Single(esiti);
        Assert.False(e.Ok);
        Assert.Equal("non_aperta", e.Codice);
        Assert.Null((await PianoAsync(app, v)).DataSistemato);
    }
}
