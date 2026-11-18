using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1243: pulizia della home e delle testate di Correggo4.
/// - niente piu' sottotitolo «Hub correzioni»;
/// - in home solo le promo valide, senza «Mostra anche le promo non più valide»;
/// - LEGENDA tolta da home ed editor per ora (il PDF non e' sul server: si rimettera');
/// - tolto il riquadro «Notifiche email» (Correggo4 le email non le spedisce);
/// - al posto del quadratino «Co» l'icona di Correggo, la stessa dell'editor.
/// Le pagine si disegnano nel browser: qui se ne controlla il codice, come in NessunaPromoAttivaTests.
/// </summary>
public class PuliziaHomeTests
{
    private static string Leggi(params string[] percorso) =>
        File.ReadAllText(Path.Combine([RadiceApplicazione(), .. percorso])).Replace("\r\n", "\n");

    private static string Home() => Leggi("Views", "Volantini", "Index.cshtml");
    private static string Editor() => Leggi("Views", "Volantini", "Dettaglio.cshtml");

    [Fact]
    public void La_testata_della_home_non_dice_piu_Hub_correzioni()
    {
        string html = Home();

        Assert.DoesNotContain("<small>Hub correzioni</small>", html);
        Assert.Contains("<span><b>Correggo</b></span>", html);
    }

    [Fact]
    public void La_home_mostra_solo_le_promo_valide()
    {
        string html = Home();
        string controller = Leggi("Controllers", "VolantiniController.cs");

        // i link (non il commento che ricorda perche' non ci sono piu')
        Assert.DoesNotContain("<a class=\"more\"", html);
        Assert.DoesNotContain(">Mostra anche le promo non più valide", html);
        Assert.DoesNotContain(">Nascondi le promo non più valide", html);
        Assert.DoesNotContain("scadute=true", html);
        // anche il vecchio indirizzo ?scadute=true da' solo le valide: il parametro non c'e' piu'
        Assert.Contains("public async Task<IActionResult> Index()\n", controller);
        Assert.Contains("            Promo = attive\n", controller);
        // valida = almeno un PDF con la fine validita' da oggi in poi (le future restano)
        Assert.Contains("var attive = gruppi.Where(g => g.Any(x => x.Fine >= oggi)).ToList();", controller);
    }

    [Fact]
    public void Le_promo_scadute_restano_in_Consulta_tutti_i_volantini()
    {
        Assert.Contains("<a class=\"logout\" href=\"~/Storico\"", Home());
    }

    [Fact]
    public void La_LEGENDA_e_spenta_in_home_e_nell_editor()
    {
        foreach (string html in new[] { Home(), Editor() })
        {
            Assert.Contains("bool legendaAttiva = false;", html);
            Assert.Contains("@if (legendaAttiva && !User.IsInRole(\"Agenzia\"))", html);
            // il link alla legenda c'e' una volta sola, ed e' dentro quel blocco
            int blocco = html.IndexOf("@if (legendaAttiva", StringComparison.Ordinal);
            int link = html.IndexOf("href=\"~/Legenda\"", StringComparison.Ordinal);
            Assert.Equal(link, html.LastIndexOf("href=\"~/Legenda\"", StringComparison.Ordinal));
            Assert.True(blocco >= 0 && link > blocco);
            Assert.DoesNotContain("}", html[blocco..link]);
        }
        // /Legenda resta: per rimetterla basta riaccendere il pulsante
        Assert.Contains("[Route(\"Legenda\")]", Leggi("Controllers", "LegendaController.cs"));
    }

    [Fact]
    public void Il_riquadro_Notifiche_email_e_tolto_ma_lo_script_regge()
    {
        string html = Home();

        Assert.Contains("bool emailVisibili = false;", html);
        int blocco = html.IndexOf("@if (emailVisibili)\n{\n<div class=\"notif\" id=\"notif\"", StringComparison.Ordinal);
        Assert.True(blocco > 0, "il riquadro delle email deve stare dentro @if (emailVisibili)");
        Assert.Equal(blocco, html.LastIndexOf("@if (", html.IndexOf("<b>Notifiche email</b>", StringComparison.Ordinal), StringComparison.Ordinal));
        // senza il riquadro document.getElementById("notif") e' null: lo script non deve rompersi
        Assert.Contains("  if(notif){\n    notif.addEventListener(\"click\", toggleNotif);", html);
        // la campanella resta
        Assert.Contains("<button class=\"bell\" type=\"button\" id=\"bell\"", html);
    }

    [Theory]
    [InlineData("Volantini", "Index.cshtml")]
    [InlineData("Storico", "Index.cshtml")]
    [InlineData("Promo", "Gestisci.cshtml")]
    [InlineData("Promo", "Revoca.cshtml")]
    public void Le_testate_usano_l_icona_di_Correggo(string cartella, string file)
    {
        string html = Leggi("Views", cartella, file);

        Assert.Contains("<img class=\"co\" src=\"~/immagini-correggo/Icon_Correggo.png\" alt=\"\">", html);
        Assert.DoesNotContain("<span class=\"co\">Co</span>", html);
        Assert.True(File.Exists(Path.Combine(RadiceApplicazione(), "wwwroot", "immagini-correggo", "Icon_Correggo.png")));
    }

    // Come IndirizziNelleVisteTests: la cartella del progetto risalendo da quella dei test.
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
