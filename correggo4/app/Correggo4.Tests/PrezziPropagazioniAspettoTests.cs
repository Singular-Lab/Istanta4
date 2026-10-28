using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1153: nella finestra del prodotto i prezzi e le propagazioni tornano all'aspetto del Correggo
/// vecchio (screenshot dell'operatore): campo prezzo arrotondato e largo un terzo della colonna,
/// pastiglie grandi con la «i» blu, uguali spuntate o no, titoli dei due elenchi senza barra.
/// Cambia solo l'aspetto, che si disegna nel browser: qui si controlla il codice della pagina.
/// </summary>
public class PrezziPropagazioniAspettoTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void Il_campo_prezzo_e_arrotondato_e_non_occupa_tutta_la_colonna()
    {
        string html = Editor();

        Assert.Contains("#mCampi .elInputVal { width: 135px; height: 24px; padding: 2px 7px; border: 2px solid #d9d9d9;", html);
        Assert.Contains("border-radius: 7px; }", html);
        Assert.Contains("#mCampi .nome_campo { font-size: 13px;", html);
    }

    [Fact]
    public void Le_pastiglie_delle_propagazioni_hanno_la_i_blu_del_vecchio()
    {
        string html = Editor();

        Assert.Contains("'<img class=\"i\" src=\"' + escA(IMG + 'infoButton.png') + '\" alt=\"\">'", html);
        Assert.DoesNotContain("'<span class=\"i\">i</span>", html);
        Assert.Contains(".ea_pill { display: flex; align-items: center; gap: 7px; border: 2px solid #8a8a8a;", html);
    }

    [Fact]
    public void Una_pastiglia_spuntata_non_cambia_colore()
    {
        string html = Editor();

        Assert.DoesNotContain(".ea_pill.on {", html);
    }

    [Fact]
    public void I_titoli_dei_due_elenchi_non_hanno_piu_la_barra_azzurra()
    {
        string html = Editor();

        Assert.Contains(".ea_prop_tit { color: #333; margin-bottom: 4px; }", html);
        Assert.DoesNotContain(".ea_prop_tit { font-weight: bold; background: #8fa7a7;", html);
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
