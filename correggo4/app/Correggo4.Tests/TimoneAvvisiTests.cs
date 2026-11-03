using System.Text.RegularExpressions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1185: unendo nel timone due referenze con prezzi promo diversi, l'avviso «I prezzi promo sono
/// diversi» finiva sotto la finestra del gruppo da cui nasceva: #tim_messaggio stava a z-index 106 e
/// le finestrelle a 107. Si confrontano i numeri del foglio di stile di wwwroot/js/timone.js, non il
/// testo: l'ordine e' quello che conta.
/// </summary>
public class TimoneAvvisiTests
{
    private static string Timone() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");

    /// <summary>Lo z-index della prima regola che comincia con il selettore indicato.</summary>
    private static int Livello(string js, string selettore)
    {
        var m = Regex.Match(js, "\n" + Regex.Escape(selettore) + @"\s*\{[^}]*?z-index:\s*(\d+)");
        Assert.True(m.Success, $"z-index di «{selettore}» non trovato in timone.js: il test va aggiornato");
        return int.Parse(m.Groups[1].Value);
    }

    [Theory]
    [InlineData("#tim_gruppo")]
    [InlineData("#tim_cestino")]
    [InlineData("#tim_pagine")]
    public void L_avviso_sta_sopra_le_finestrelle_del_timone(string finestrella)
    {
        string js = Timone();
        Assert.True(Livello(js, "#tim_messaggio") > Livello(js, finestrella),
            $"#tim_messaggio deve stare sopra {finestrella}");
    }

    [Theory]
    [InlineData("body.tim_on .modale")]
    [InlineData("#tim_report")]
    public void L_avviso_resta_sotto_l_Edit_avanzato_e_il_report(string sopra)
    {
        string js = Timone();
        Assert.True(Livello(js, "#tim_messaggio") < Livello(js, sopra),
            $"#tim_messaggio deve restare sotto {sopra}");
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
