using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1148: nella colonna Promo attive, il clic su un PDF dell'elenco "PDF caricati per canale"
/// apre il volantino nell'editor, nella stessa scheda, come "Apri editor" sulla card. Prima
/// evidenziava soltanto la card. La schermata si disegna nel browser: qui si controlla il codice
/// della pagina, il clic vero lo prova l'operatore.
/// </summary>
public class ElencoPdfApreVolantinoTests
{
    private static string Home() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Index.cshtml"));

    [Fact]
    public void Il_PDF_dell_elenco_e_un_link_all_editor_del_suo_volantino()
    {
        string html = Home();

        // Lo stesso indirizzo di "Apri editor", con C4_BASE per Correggo4 in una sottocartella.
        Assert.Contains("<a class=\"pdf ${S.hl===v.id?\"on\":\"\"}\" href=\"${C4_BASE}Volantini/Dettaglio/${v.id}\"", html);
        Assert.Contains("href=\"${C4_BASE}Volantini/Dettaglio/${v.id}\">${ico(editIco)} ${editLabel}</a>", html);
        Assert.DoesNotContain("<button class=\"pdf ", html);
        // Nessun target: si apre nella stessa scheda.
        int link = html.IndexOf("<a class=\"pdf ", StringComparison.Ordinal);
        string apertura = html.Substring(link, html.IndexOf('>', link) - link);
        Assert.DoesNotContain("target=", apertura);
    }

    [Fact]
    public void Il_clic_sul_PDF_non_evidenzia_piu_la_card_e_lascia_fare_al_link()
    {
        string html = Home();

        Assert.Contains("if(e.target.closest(\".pdf\")) return;", html);
        Assert.DoesNotContain("card.classList.add(\"flash\")", html);
        Assert.DoesNotContain("S.hl = +pdf.dataset.id", html);
    }

    [Fact]
    public void Gli_altri_clic_della_colonna_restano_come_prima()
    {
        string html = Home();

        // "PDF caricati per canale" apre e chiude l'elenco
        Assert.Contains("const tog = e.target.closest(\"[data-tog]\");", html);
        // il nome del canale filtra
        Assert.Contains("const can = e.target.closest(\".pdf-can\");", html);
        // il nome della promo la sceglie
        Assert.Contains("const head = e.target.closest(\".camp-head\"); if(!head) return;", html);
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
