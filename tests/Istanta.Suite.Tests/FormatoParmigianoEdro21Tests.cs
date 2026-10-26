using System.Text.RegularExpressions;
using AgenziaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1026: il formato Parmigiano Reggiano di Edro21, nella parte che decide il server.
///
/// getLoghiEBolliNew riconosce la ref dalla descrizione1 e le assegna tutti i loghi del formato,
/// piu' il bollo dei mesi letto dalla descrizione3. Prima di questo task la regola c'era ma non
/// funzionava: il numero dei mesi non veniva mai letto, e le sigle PARMIGIANO_mesiNN che scriveva
/// non esistevano nella source, che le scarta in silenzio. Qui si fissano il riconoscimento, la
/// lettura dei mesi e la concordanza delle sigle con SourceLoghiBolli.
/// </summary>
public class FormatoParmigianoEdro21Tests
{
    private sealed class VoceLogo
    {
        public string nome { get; set; } = "";
        public string sigla { get; set; } = "";
    }

    private sealed class SorgenteLoghi
    {
        public List<VoceLogo> source { get; set; } = new();
    }

    /* ---- il riconoscimento ---- */

    [Theory]
    [InlineData("PARMIGIANO REGGIANO DOP CONAD")]
    [InlineData("Parmigiano Reggiano DOP")]
    [InlineData("parmigiano reggiano")]
    [InlineData("PARMIGIANO<br>REGGIANO DOP")]
    [InlineData("Parmigiano\r\nReggiano")]
    [InlineData("Parmigiano  Reggiano")]
    public void La_descrizione1_con_parmigiano_reggiano_e_il_formato(string descrizione1)
    {
        // Il cliente chiede di non distinguere maiuscole e minuscole. A capo, <br> e spazi doppi
        // valgono come uno spazio: in una descrizione impaginata le due parole possono andare a capo.
        Assert.True(FormatoParmigianoEdro21.EParmigianoReggiano(descrizione1));
    }

    [Theory]
    [InlineData("Grana Padano DOP")]
    [InlineData("Parmigiano")]
    [InlineData("Reggiano")]
    [InlineData("")]
    [InlineData(null)]
    public void Senza_parmigiano_reggiano_nella_descrizione1_non_e_il_formato(string? descrizione1)
    {
        Assert.False(FormatoParmigianoEdro21.EParmigianoReggiano(descrizione1!));
    }

    /* ---- i mesi ---- */

    [Theory]
    [InlineData("stagionatura minima 24 mesi", 24)]
    [InlineData("Stagionatura oltre 30 MESI", 30)]
    [InlineData("stagionatura minima 24<br>mesi", 24)]
    [InlineData("stagionatura minima\r\n36 mesi", 36)]
    [InlineData("stagionatura 12mesi", 12)]
    [InlineData("250 g stagionatura minima 48 mesi", 48)]
    public void I_mesi_sono_il_numero_che_precede_mesi(string descrizione3, int attesi)
    {
        Assert.Equal(attesi, FormatoParmigianoEdro21.MesiDiStagionatura(descrizione3));
    }

    [Theory]
    [InlineData("24 mesi")]
    [InlineData("stagionatura minima")]
    [InlineData("stagionatura mesi")]
    [InlineData("stagionatura 0 mesi")]
    [InlineData("")]
    [InlineData(null)]
    public void Senza_stagionatura_mesi_e_un_numero_non_c_e_bollo(string? descrizione3)
    {
        // Servono tutte e due le parole e un numero subito prima di "mesi": il bollo dice un
        // numero di mesi, e senza numero non c'e' un bollo da scegliere.
        Assert.Null(FormatoParmigianoEdro21.MesiDiStagionatura(descrizione3!));
    }

    [Fact]
    public void La_sigla_del_bollo_si_scrive_per_qualunque_numero()
    {
        // Anche per i mesi che la source non ha ancora (47, 48, 49): l'export scarta la sigla
        // che non trova, e appena il logo viene caricato esce da solo.
        Assert.Equal("Parmigiano_24M", FormatoParmigianoEdro21.SiglaBolloMesi(24));
        Assert.Equal("Parmigiano_48M", FormatoParmigianoEdro21.SiglaBolloMesi(48));
    }

    /* ---- la concordanza con la source ---- */

    [Fact]
    public void Ogni_bollo_dei_mesi_della_source_e_raggiungibile()
    {
        // Il confronto con la source e' esatto e sensibile alle maiuscole: la sigla calcolata
        // dal numero del file deve essere proprio quella della source.
        var bolli = Voci()
            .Select(v => new { v.sigla, trovato = Regex.Match(v.nome, @"^parmigiano_mesi_(\d+)\.psd$") })
            .Where(v => v.trovato.Success)
            .ToList();

        Assert.NotEmpty(bolli);
        foreach (var bollo in bolli)
        {
            var mesi = int.Parse(bollo.trovato.Groups[1].Value);
            Assert.Equal(bollo.sigla, FormatoParmigianoEdro21.SiglaBolloMesi(mesi));
        }
    }

    [Fact]
    public void I_loghi_del_formato_esistono_nella_source_scritti_cosi()
    {
        var sigle = Voci().Select(v => v.sigla).ToList();

        foreach (var logo in FormatoParmigianoEdro21.LoghiDelFormato)
        {
            Assert.True(sigle.Count(s => s == logo.Value) == 1,
                $"la sigla '{logo.Value}' deve comparire una volta sola nel source");
        }
    }

    [Fact]
    public void Le_chiavi_dei_loghi_del_formato_non_si_scontrano_con_le_altre()
    {
        // getLoghiEBolliNew raccoglie i loghi in un Dictionary: una chiave ripetuta fa
        // fallire l'export della ref. Le chiavi degli altri loghi si leggono dal sorgente.
        var sorgente = File.ReadAllText(TrovaFile("AgenziaLib/Edro21.cs"));
        var altre = Regex.Matches(sorgente, @"loghi_e_bolli\.Add\(""([^""]+)""")
            .Select(m => m.Groups[1].Value)
            .ToHashSet();
        var delFormato = FormatoParmigianoEdro21.LoghiDelFormato.Select(l => l.Key)
            .Append(FormatoParmigianoEdro21.ChiaveBolloMesi)
            .ToList();

        Assert.Equal(delFormato.Count, delFormato.Distinct().Count());
        Assert.Empty(delFormato.Where(altre.Contains));
    }

    [Fact]
    public void La_regola_usa_il_formato_e_lo_sfondo_parmigiano_resta_disattivato()
    {
        // Lo sfondo e' stato disattivato commentandolo: lo stile della base dovrebbe sostituirlo.
        // Solo le righe di codice: i commenti raccontano anche com'era prima.
        var codice = File.ReadAllLines(TrovaFile("AgenziaLib/Edro21.cs"))
            .Where(r => !r.TrimStart().StartsWith("//") && !r.TrimStart().StartsWith("///"))
            .ToList();

        Assert.Contains(codice, r => r.Contains("FormatoParmigianoEdro21.EParmigianoReggiano(desc1)"));
        Assert.DoesNotContain(codice, r => r.Contains("sfondo = \"sfondo_parmigiano\""));
        Assert.DoesNotContain(codice, r => r.Contains("PARMIGIANO_mesi"));
    }

    private static List<VoceLogo> Voci()
    {
        var testo = File.ReadAllText(TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceLoghiBolli.json"));
        var radice = JsonConvert.DeserializeObject<SorgenteLoghi>(testo);
        Assert.NotNull(radice);
        return radice!.source;
    }

    private static string TrovaFile(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
