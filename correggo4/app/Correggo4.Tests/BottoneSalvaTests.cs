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
