using System.Text;
using Correggo4.Ingestione;
using ImageMagick;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1144: i colori delle pagine che Correggo4 ricava dal PDF di un volantino.
///
/// Il PDF Coop esportato dal Plugin era giusto, ma in Correggo le pagine erano molto piu' sature:
/// EstrattorePagine leggeva in CMYK e passava a sRGB con una formula senza profili, che rende i
/// colori di stampa come quelli puri dello schermo. Ora passa con i profili (Coated FOGRA39 -> sRGB).
///
/// Il PDF di prova lo scrive il test: una pagina 300x100 punti con un riquadro 100% ciano, uno
/// rosso Coop (0/100/100/0) e una zona vuota, in due forme. Quella di InDesign dichiara il colore
/// /DeviceCMYK, e ImageMagick la legge in CMYK in ogni caso: e' il caso del volantino Coop, che
/// una correzione sulla sola lettura non toccava. L'altra usa l'operatore k e basta.
/// Serve Ghostscript, come nell'immagine Docker di Correggo4. I file vanno in una cartella
/// temporanea, mai nello storage.
/// </summary>
public sealed class EstrattorePagineTests : IDisposable
{
    // Come Coated FOGRA39 rende in sRGB il ciano 100% e il rosso 0/100/100/0.
    private static readonly (int R, int G, int B) CianoAtteso = (0, 159, 227);
    private static readonly (int R, int G, int B) RossoAtteso = (227, 6, 20);

    private readonly string cartella = Path.Combine(Path.GetTempPath(), "correggo4-estrattore-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(cartella))
        {
            Directory.Delete(cartella, recursive: true);
        }
    }

    private EstrattorePagine Estrattore()
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:VolantiniPath"] = cartella })
            .Build();
        return new EstrattorePagine(cfg, NullLogger<EstrattorePagine>.Instance);
    }

    public static TheoryData<bool> FormeDelPdf => new() { true, false };

    /// <summary>
    /// Un PDF di una pagina 300x100 con ciano a sinistra, rosso Coop al centro e niente a destra.
    /// Con <paramref name="comeInDesign"/> il colore e' dichiarato /DeviceCMYK, altrimenti si usa k.
    /// </summary>
    internal static byte[] PdfCmyk(bool comeInDesign)
    {
        string contenuto = comeInDesign
            ? "/CS0 cs 1 0 0 0 scn 0 0 100 100 re f\n0 1 1 0 scn 100 0 100 100 re f\n"
            : "1 0 0 0 k 0 0 100 100 re f\n0 1 1 0 k 100 0 100 100 re f\n";
        string risorse = comeInDesign ? "<< /ColorSpace << /CS0 /DeviceCMYK >> >>" : "<< >>";
        var oggetti = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R /Resources {risorse} >>",
            $"<< /Length {contenuto.Length} >>\nstream\n{contenuto}endstream"
        };

        var pdf = new StringBuilder("%PDF-1.4\n");
        var posizioni = new List<int>();
        for (int i = 0; i < oggetti.Length; i++)
        {
            posizioni.Add(pdf.Length);
            pdf.Append($"{i + 1} 0 obj\n{oggetti[i]}\nendobj\n");
        }
        int xref = pdf.Length;
        pdf.Append($"xref\n0 {oggetti.Length + 1}\n0000000000 65535 f \n");
        foreach (var p in posizioni)
        {
            pdf.Append($"{p:D10} 00000 n \n");
        }
        pdf.Append($"trailer\n<< /Size {oggetti.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(pdf.ToString());
    }

    private static (int R, int G, int B) Colore(string file, double x, double y)
    {
        using var img = new MagickImage(file);
        var c = img.GetPixels().GetPixel((int)(x * img.Width), (int)(y * img.Height)).ToColor()!;
        return (c.R, c.G, c.B);
    }

    // Abbastanza stretta da escludere i colori puri della formula: (0,255,255) e (255,0,0).
    private static void Vicino((int R, int G, int B) atteso, (int R, int G, int B) letto, string cosa)
    {
        const int tolleranza = 14;
        Assert.True(Math.Abs(atteso.R - letto.R) <= tolleranza && Math.Abs(atteso.G - letto.G) <= tolleranza && Math.Abs(atteso.B - letto.B) <= tolleranza,
            $"{cosa}: atteso circa {atteso}, letto {letto}");
    }

    [Theory]
    [MemberData(nameof(FormeDelPdf))]
    public void I_colori_di_stampa_passano_allo_schermo_col_profilo_e_non_diventano_colori_puri(bool comeInDesign)
    {
        var pagine = Estrattore().Estrai(PdfCmyk(comeInDesign), "Coop", "Prova colori", 1, new byte[] { 1 });

        var pagina = Assert.Single(pagine);
        string file = Path.Combine(cartella, "Coop", "Prova colori", pagina.NomeFile);

        var ciano = Colore(file, 1.0 / 6, 0.5);
        var rosso = Colore(file, 3.0 / 6, 0.5);
        var vuoto = Colore(file, 5.0 / 6, 0.5);

        // Prima: (0,255,255) e (255,0,0), i colori puri dello schermo, molto piu' saturi del PDF.
        Assert.False(ciano.G > 230 && ciano.B > 230, $"ciano reso come ciano puro dello schermo: {ciano}");
        Assert.False(rosso.R > 245, $"rosso Coop reso come rosso puro dello schermo: {rosso}");
        Vicino(CianoAtteso, ciano, "ciano 100%");
        Vicino(RossoAtteso, rosso, "rosso Coop 0/100/100/0");
        // La carta resta bianca.
        Assert.True(vuoto.R >= 248 && vuoto.G >= 248 && vuoto.B >= 248, $"zona vuota non bianca: {vuoto}");
    }

    [Theory]
    [MemberData(nameof(FormeDelPdf))]
    public void Miniatura_e_copertina_hanno_gli_stessi_colori_e_il_PDF_resta_identico(bool comeInDesign)
    {
        byte[] pdf = PdfCmyk(comeInDesign);

        Estrattore().Estrai(pdf, "Coop", "Prova colori", 2, new byte[] { 1 });

        string volantino = Path.Combine(cartella, "Coop", "Prova colori");
        foreach (var miniatura in new[] { "pag1_2.jpg", "cover_2.jpg" })
        {
            string file = Path.Combine(volantino, "thumbs", miniatura);
            Assert.True(File.Exists(file), miniatura);
            Vicino(RossoAtteso, Colore(file, 3.0 / 6, 0.5), miniatura + ", rosso Coop");
        }
        Assert.Equal(pdf, File.ReadAllBytes(Path.Combine(volantino, EstrattorePagine.NomePdf("Prova colori", 2))));
    }
}
