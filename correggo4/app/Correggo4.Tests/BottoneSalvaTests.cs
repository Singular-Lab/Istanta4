using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1158: nella finestra del prodotto chi corregge salva con SALVA, come nel Correggo vecchio.
/// Il bottone si chiamava «CONFERMA CORREZIONE» come quello verde con cui l'Agenzia conferma, e
/// chi correggeva non trovava il salvataggio. Il bottone si disegna nel browser: qui si controlla
/// il codice della pagina.
/// </summary>
public class BottoneSalvaTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void Chi_corregge_salva_con_SALVA()
    {
        string html = Editor();

        Assert.Contains("<button class=\"bottone grande\" type=\"button\" data-ea=\"salva\">SALVA</button>", html);
        Assert.DoesNotContain("data-ea=\"salva\">CONFERMA CORREZIONE</button>", html);
    }

    [Fact]
    public void L_Agenzia_conferma_ancora_con_CONFERMA_CORREZIONE()
    {
        string html = Editor();

        int conferme = html.Split("<button class=\"bottone accetta grande\" type=\"button\" data-ea=\"conferma\">CONFERMA CORREZIONE</button>").Length - 1;
        Assert.Equal(2, conferme);   // la correzione propria e quella arrivata da un altro volantino
    }

    /// <summary>
    /// I20-1160: dopo il SALVA di una correzione in attesa resta solo ANNULLA CORREZIONE; SALVA torna
    /// accanto ad ANNULLA quando la parte e' diversa da com'era al salvataggio.
    /// </summary>
    [Fact]
    public void Dopo_il_salvataggio_SALVA_compare_solo_se_la_correzione_cambia()
    {
        string html = Editor();

        // SALVA si nasconde quando la parte e' uguale a com'era al salvataggio di una correzione in attesa
        Assert.Contains("improntaSalvata[parte] = (ed && ed.stato === 0 && el.querySelector('[data-ea=\"salva\"]')) ? improntaParte(parte) : null;", html);
        Assert.Contains("bt.classList.toggle('nascosto', improntaSalvata[parte] !== null && improntaParte(parte) === improntaSalvata[parte]);", html);
        // l'impronta e' quello che SALVA manderebbe al server, per prezzi e per descrizione
        Assert.Contains("JSON.stringify(parte === 'offerta' ? raccogliOfferta() : raccogliScheda())", html);
        // si ricontrolla dopo ogni modifica: campi, descrizione, foto e loghi passano da ombreRitaglio, le azioni no
        Assert.Contains("function ombreRitaglio() {\n        aggiornaSalva();", html.Replace("\r\n", "\n"));
        Assert.Contains("azioniScelte[Number(e.dataset.az)].campi[e.dataset.campo] = e.value; aggiornaSalva();", html);
        // ANNULLA CORREZIONE resta per la correzione in attesa
        Assert.Contains("if (ed && ed.stato === 0) bottoni.push('<button class=\"bottone pericolo\" type=\"button\" data-ea=\"annulla\">ANNULLA CORREZIONE</button>');", html);
    }

    [Fact]
    public void Senza_correzione_in_attesa_SALVA_non_si_nasconde()
    {
        string html = Editor();

        // l'impronta c'e' solo con una correzione in attesa (stato 0): senza, aggiornaSalva lascia SALVA visibile
        Assert.Contains("improntaSalvata[parte] !== null &&", html);
        Assert.DoesNotContain("<button class=\"bottone grande nascosto\" type=\"button\" data-ea=\"salva\">", html);
    }

    /// <summary>
    /// I20-1160: sotto i bottoni non compare mai il riquadro giallo «In attesa dell'Agenzia»;
    /// quello verde della correzione confermata resta.
    /// </summary>
    [Fact]
    public void Niente_riquadro_giallo_resta_quello_verde()
    {
        string html = Editor();

        Assert.DoesNotContain("'In attesa dell\\'Agenzia'", html);
        Assert.DoesNotContain("ea_stato ' + (ed.stato === 2 ? 'confermata' : 'registrata')", html);
        Assert.Contains("if (ed && ed.stato === 2) {", html);
        Assert.Contains("<div class=\"ea_stato confermata\"><b>Confermata dall\\'Agenzia</b><br>", html);
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
