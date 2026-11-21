using Correggo4.Servizi;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// TASK-6c41ad00: il paracadute della griglia del menabò avanzato. Il riquadro su cui si appoggia la
/// griglia e' l'unione dei box della pagina, ritagliata ai bordi della pagina vera: un box dell'export che
/// sporge non deve mandare la griglia fuori ricalco. Vale per gli scambi del Report Correggo
/// (ServizioTimone.RiquadroNellaPagina) e per il disegno nel browser (riquadro() in wwwroot/js/timone.js),
/// che devono fare gli stessi conti.
/// </summary>
public class TimoneGrigliaNellaPaginaTests
{
    private static readonly ServizioTimone.Rettangolo A4 = new(0m, 0m, 210m, 287m);

    private static ServizioTimone.Rettangolo R(decimal x, decimal y, decimal w, decimal h) => new(x, y, x + w, y + h);

    // volantino 125, pagina 16: tre colonne vere da 8.50 a 201.57, e il box 442634 che finisce a 218.50
    private static readonly List<ServizioTimone.Rettangolo> Pagina16 = new()
    {
        R(8.50m, 35.71m, 60.33m, 70m),     // 442627
        R(9.38m, 120m, 176.62m, 60m),      // 442643
        R(36.61m, 190m, 181.89m, 82.84m),  // 442634, sporge a destra
        R(75.07m, 35.71m, 70.50m, 70m),    // 442613
        R(139.07m, 35.71m, 62.50m, 70m)    // 442620
    };

    [Fact]
    public void Un_box_che_sporge_a_destra_non_porta_la_griglia_fuori_pagina()
    {
        var q = ServizioTimone.RiquadroNellaPagina(Pagina16, A4);

        Assert.Equal(new ServizioTimone.Rettangolo(8.50m, 35.71m, 210m, 272.84m), q);
    }

    [Fact]
    public void La_terza_colonna_finisce_sul_bordo_della_pagina()
    {
        var griglia = GriglieFormato.Trova("3x3")!;

        var terza = ServizioTimone.CasellaNellaPagina(griglia, 3, 1, 1, Pagina16, 0m, A4);

        Assert.NotNull(terza);
        Assert.Equal(210m, terza!.X2);
        Assert.True(terza.X1 >= 0m);
    }

    [Fact]
    public void Un_box_che_sporge_a_sinistra_e_in_alto_fa_partire_la_griglia_da_zero()
    {
        // volantino 125, pagina 9: il box 442421 da -24.82, largo 226.32
        var box = new List<ServizioTimone.Rettangolo> { R(-24.82m, -5m, 226.32m, 90.22m), R(10m, 120m, 60m, 60m) };

        var q = ServizioTimone.RiquadroNellaPagina(box, A4);

        Assert.Equal(0m, q.X1);
        Assert.Equal(0m, q.Y1);
        Assert.Equal(201.50m, q.X2);
    }

    [Fact]
    public void Con_i_box_dentro_la_pagina_il_riquadro_non_cambia()
    {
        var box = new List<ServizioTimone.Rettangolo> { R(8.5m, 26.5m, 90m, 80m), R(110m, 120m, 91.5m, 80m) };

        Assert.Equal(new ServizioTimone.Rettangolo(8.5m, 26.5m, 201.5m, 200m), ServizioTimone.RiquadroNellaPagina(box, A4));
    }

    [Fact]
    public void Senza_le_misure_della_pagina_resta_l_unione_dei_box()
    {
        Assert.Equal(new ServizioTimone.Rettangolo(8.50m, 35.71m, 218.50m, 272.84m),
                     ServizioTimone.RiquadroNellaPagina(Pagina16, null));
    }

    [Fact]
    public void L_allargata_misura_le_caselle_sul_riquadro_ritagliato()
    {
        // due box affiancati, il secondo sporge a destra: allargata su 2 colonne della 2x3
        var griglia = GriglieFormato.Trova("2x3");
        var caselle = new Dictionary<short, ServizioTimone.Rettangolo>
        {
            [1] = R(0m, 0m, 100m, 90m), [2] = R(110m, 0m, 120m, 90m)
        };

        var (r, motivo) = ServizioTimone.RettangoloAllargato(griglia, 1, 2, 1, caselle.Values.ToList(),
            k => caselle.TryGetValue(k, out var x) ? x : null, A4);

        Assert.NotNull(r);
        Assert.Equal("", motivo);
    }

    [Fact]
    public void Il_timone_ritaglia_il_riquadro_ai_bordi_della_pagina()
    {
        string js = File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");
        int inizio = js.IndexOf("function riquadro(voci, pagina)", StringComparison.Ordinal);
        Assert.True(inizio >= 0);
        string corpo = js.Substring(inizio, js.IndexOf("function cellaDi(", inizio, StringComparison.Ordinal) - inizio);

        Assert.Contains("x1 = Math.max(0, x1); y1 = Math.max(0, y1);", corpo);
        Assert.Contains("x2 = Math.min(pl, x2); y2 = Math.min(ph, y2);", corpo);
        Assert.Contains("ServizioTimone.RiquadroNellaPagina", corpo);
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
