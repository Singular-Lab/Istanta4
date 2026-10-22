using System.Text.RegularExpressions;
using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1125: il logo attributo italiano di Edro21 (quello con la bandiera) porta sotto la bandiera
/// la parola che comincia con "italian" e quella che la precede, prese dalla descrizione e tagliate
/// al primo spazio o a capo. Con le descrizioni che ora hanno le virgole ("prodotto italiano,
/// categoria I, calibro 24/26") la virgola restava attaccata, e il logo usciva "PRODOTTO ITALIANO,".
/// getLoghiEBolliNew passa le due parole da LogoAttributoItalianoEdro21.SenzaPunteggiatura.
/// </summary>
public class LogoAttributoItalianoEdro21Tests
{
    [Theory]
    [InlineData("italiano,", "italiano")]
    [InlineData("italiana;", "italiana")]
    [InlineData("italiani.", "italiani")]
    [InlineData("italiano:", "italiano")]
    [InlineData("italiano,;", "italiano")]
    public void La_punteggiatura_che_segue_la_parola_non_va_nel_logo(string parola, string atteso)
    {
        Assert.Equal(atteso, LogoAttributoItalianoEdro21.SenzaPunteggiatura(parola));
    }

    [Theory]
    [InlineData("italiano")]
    [InlineData("Italiano")]
    [InlineData("prodotto")]
    [InlineData("100%")]
    public void Una_parola_senza_punteggiatura_resta_com_e(string parola)
    {
        Assert.Equal(parola, LogoAttributoItalianoEdro21.SenzaPunteggiatura(parola));
    }

    [Fact]
    public void Una_parola_di_sola_punteggiatura_resta_vuota_e_il_nulla_resta_nulla()
    {
        Assert.Equal("", LogoAttributoItalianoEdro21.SenzaPunteggiatura(","));
        Assert.Equal("", LogoAttributoItalianoEdro21.SenzaPunteggiatura(""));
        Assert.Null(LogoAttributoItalianoEdro21.SenzaPunteggiatura(null));
    }

    [Fact]
    public void La_punteggiatura_dentro_la_parola_resta()
    {
        //Si toglie solo quella in fondo: "24/26" o "d.o.p" non si toccano.
        Assert.Equal("d.o.p", LogoAttributoItalianoEdro21.SenzaPunteggiatura("d.o.p."));
    }

    [Fact]
    public void Il_logo_passa_tutte_e_due_le_parole_dalla_funzione()
    {
        var sorgente = File.ReadAllText(TrovaFile("AgenziaLib/Edro21.cs")).Replace("\r", "");

        Assert.Matches(new Regex(@"logo_attributo_it = LogoAttributoItalianoEdro21\.SenzaPunteggiatura\(el\.LastOrDefault\(\)\);"), sorgente);
        Assert.Matches(new Regex(@"logo_attributo_it \+= ""<br>"" \+ LogoAttributoItalianoEdro21\.SenzaPunteggiatura\(italian\);"), sorgente);
        //Le altre strade del logo restano com'erano.
        Assert.Matches(new Regex(@"logo_attributo_it = ""\?\?\?"";"), sorgente);
        Assert.Matches(new Regex(@"logo_attributo_it = ""PRODOTTO<br>IN ITALIA"";"), sorgente);
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
