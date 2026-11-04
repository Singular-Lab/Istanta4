using Correggo4.Servizi;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1192: ESPORTA PDF del report del timone rispondeva 500 «motore_mancante» sul server, perche'
/// l'immagine Docker di Correggo4 non aveva chrome-headless-shell. Qui si tiene insieme il patto fra
/// il Dockerfile e ServizioPdf (stesso posto, versione fissata e verificata, prova di stampa nella
/// build) e il modo in cui ServizioPdf sceglie il motore, compreso il Chrome del computer in locale.
/// </summary>
public class MotorePdfTests
{
    private const string Variabile = "ISTANTA4_CHROME_PDF";

    [Fact]
    public void Il_Dockerfile_mette_il_motore_dove_ServizioPdf_lo_cerca()
    {
        string docker = System.IO.File.ReadAllText(DockerfileDiCorreggo4());

        Assert.Contains("chrome-headless-shell-linux64.zip", docker);
        Assert.Contains("ln -s /opt/chrome-pdf/chrome-headless-shell " + ServizioPdf.MotoreDiSerie, docker);
        // versione fissata e archivio verificato: niente «l'ultima che c'e'» al momento della build
        Assert.Matches(@"ARG CHROME_PDF_VERSION=\d+\.\d+\.\d+\.\d+", docker);
        Assert.Matches(@"ARG CHROME_PDF_SHA256=[0-9a-f]{64}", docker);
        Assert.Contains("sha256sum -c", docker);
        // la prova di stampa nella build: una libreria che manca ferma l'immagine, non il primo export
        Assert.Contains("--print-to-pdf=/tmp/prova.pdf", docker);
    }

    [Fact]
    public void Senza_variabile_si_usa_quello_di_serie()
    {
        string? m = ServizioPdf.TrovaMotore(null, p => true, new[] { "/browser/chrome" });

        Assert.Equal(ServizioPdf.MotoreDiSerie, m);
    }

    [Fact]
    public void Senza_quello_di_serie_si_usa_il_primo_browser_del_computer_che_c_e()
    {
        var presenti = new HashSet<string> { "/b/chromium", "/b/edge" };

        string? m = ServizioPdf.TrovaMotore("", presenti.Contains, new[] { "/b/chrome", "/b/chromium", "/b/edge" });

        Assert.Equal("/b/chromium", m);
    }

    [Fact]
    public void La_variabile_decide_da_sola_anche_quando_manca()
    {
        Assert.Equal("/mio/chrome", ServizioPdf.TrovaMotore("/mio/chrome", p => true, new[] { "/b/chrome" }));
        // la variabile punta a un motore che non c'e': non si ripiega su un altro
        Assert.Null(ServizioPdf.TrovaMotore("/mio/chrome", p => p != "/mio/chrome", new[] { "/b/chrome" }));
    }

    [Fact]
    public void Nessun_motore_da_nessuna_parte()
    {
        Assert.Null(ServizioPdf.TrovaMotore(null, p => false, new[] { "/b/chrome" }));
    }

    [Fact]
    public void I_browser_del_computer_sono_percorsi_completi()
    {
        var motori = ServizioPdf.MotoriDelComputer();

        Assert.NotEmpty(motori);
        Assert.All(motori, m => Assert.True(Path.IsPathRooted(m), m));
    }

    [Fact]
    public async Task Senza_motore_risponde_motore_mancante_e_non_lancia()
    {
        string? prima = Environment.GetEnvironmentVariable(Variabile);
        string inesistente = Path.Combine(Path.GetTempPath(), "correggo4-test-" + Guid.NewGuid().ToString("N"), "chrome-pdf");
        Environment.SetEnvironmentVariable(Variabile, inesistente);
        try
        {
            Assert.False(ServizioPdf.MotoreCe());

            var esito = await ServizioPdf.DaHtmlAsync("<p>prova</p>");

            Assert.False(esito.Ok);
            Assert.Equal("motore_mancante", esito.Codice);
            Assert.Empty(esito.Dati);
        }
        finally
        {
            Environment.SetEnvironmentVariable(Variabile, prima);
        }
    }

    private static string DockerfileDiCorreggo4()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidato = Path.Combine(d.FullName, "Dockerfile");
            if (System.IO.File.Exists(candidato) && Directory.Exists(Path.Combine(d.FullName, "app", "Correggo4")))
                return candidato;
        }
        throw new FileNotFoundException("correggo4/Dockerfile non trovato sopra " + AppContext.BaseDirectory);
    }
}
