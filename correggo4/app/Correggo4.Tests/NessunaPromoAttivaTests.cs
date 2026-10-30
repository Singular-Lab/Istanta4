using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1173: senza promo da vedere (il caso tipico e' un Category con le finestre chiuse) la home
/// mostrava due riquadri vuoti, «Nessuna promo» e «Seleziona una promo», e sopra l'avviso giallo
/// del volantino fuori finestra. Ora resta solo «Nessuna promo attiva», per chiunque (scelta
/// dell'utente). Lo disegna la vista: qui se ne controlla il codice, come in ElencoPdfApreVolantinoTests.
/// </summary>
public class NessunaPromoAttivaTests
{
    private static string Leggi(params string[] percorso) =>
        File.ReadAllText(Path.Combine([RadiceApplicazione(), .. percorso])).Replace("\r\n", "\n");

    private static string Home() => Leggi("Views", "Volantini", "Index.cshtml");

    [Fact]
    public void Senza_promo_c_e_solo_Nessuna_promo_attiva()
    {
        string html = Home();

        Assert.Contains("bool nessunaPromo = Model.Promo.Count == 0;", html);
        Assert.Contains("@if (nessunaPromo)\n{\n    <div class=\"nessuna-promo\">\n" +
                        "      <div class=\"empty\"><b>Nessuna promo attiva</b></div>", html);
    }

    [Fact]
    public void Ricerca_e_colonne_si_nascondono_solo_senza_promo()
    {
        string html = Home();

        Assert.Contains("<nav class=\"bar\" aria-label=\"Filtri\" hidden=\"@nessunaPromo\">", html);
        Assert.Contains("<main class=\"main\" hidden=\"@nessunaPromo\">", html);
        // senza questa regola il display:grid della .main batterebbe hidden
        Assert.Contains(".bar[hidden],.main[hidden]{display:none}", html);
    }

    [Fact]
    public void Il_link_alle_promo_non_piu_valide_resta_anche_senza_promo()
    {
        string html = Home();
        int inizio = html.IndexOf("<div class=\"nessuna-promo\">", StringComparison.Ordinal);
        int fine = html.IndexOf("<main class=\"main\"", inizio, StringComparison.Ordinal);
        Assert.True(inizio >= 0 && fine > inizio);

        string riquadro = html[inizio..fine];
        Assert.Contains("Mostra anche le promo non più valide (@Model.PromoScadute)", riquadro);
        Assert.Contains("Nascondi le promo non più valide", riquadro);
    }

    [Fact]
    public void L_avviso_del_Category_fuori_finestra_compare_solo_con_altre_promo()
    {
        string html = Home();
        string controller = Leggi("Controllers", "VolantiniController.cs");

        Assert.Contains("@if (TempData[\"AvvisoCategory\"] is string avvisoCategory && !nessunaPromo)", html);
        // Dettaglio e Affiancata lo scrivono sulla sua chiave, non piu' su quella generica
        Assert.Equal(2, controller.Split("TempData[\"AvvisoCategory\"] = $\"La promo {vol.Classificazione} non è aperta ai Category").Length - 1);
        Assert.DoesNotContain("TempData[\"Avviso\"] = $\"La promo {vol.Classificazione} non è aperta ai Category", controller);
        // gli altri avvisi della home (per esempio la versione 0) restano visibili sempre
        Assert.Contains("@if (TempData[\"Avviso\"] is string avvisoHome)\n{", html);
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
