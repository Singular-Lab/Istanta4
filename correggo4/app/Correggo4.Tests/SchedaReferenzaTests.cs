using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1152: nella finestra del prodotto la scheda della referenza ("Foto e primario/secondari")
/// mostrava tutti i campi del box impaginato con il loro nome tecnico (prezzo_promo,
/// prezzo_info_pack, n_bruciature...). Ora mostra, come il Correggo vecchio, Prezzo promo, Prezzo
/// continuo, Sconto e Peso, dal box o dal record del prodotto. La scheda si disegna nel browser:
/// qui si controlla il codice della pagina.
/// </summary>
public class SchedaReferenzaTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void La_scheda_mostra_i_quattro_dati_in_quest_ordine()
    {
        string html = Editor();

        int promo = html.IndexOf("{ etichetta: 'Prezzo promo', campi: ['prezzo_promo'], prezzo: true }", StringComparison.Ordinal);
        int continuo = html.IndexOf("{ etichetta: 'Prezzo continuo', campi: ['prezzo_continuo'], prezzo: true }", StringComparison.Ordinal);
        int sconto = html.IndexOf("{ etichetta: 'Sconto', campi: ['txt_sconto', 'azione_pubblico'] }", StringComparison.Ordinal);
        int peso = html.IndexOf("{ etichetta: 'Peso', campi: ['Descrizioni.Peso'], unita: 'Descrizioni.Um' }", StringComparison.Ordinal);

        Assert.True(promo > 0 && continuo > promo && sconto > continuo && peso > sconto,
            "i quattro dati devono esserci, nell'ordine Prezzo promo, Prezzo continuo, Sconto, Peso");
    }

    [Fact]
    public void Il_valore_viene_dal_box_poi_dal_record_e_se_manca_e_un_trattino()
    {
        string html = Editor();

        Assert.Contains("v = cerca(b.campi, d.campi[i]) || cerca(b.tracciato, d.campi[i]);", html);
        Assert.Contains("return esc(d.etichetta) + ': ' + (v ? esc(v) : '&ndash;');", html);
    }

    [Fact]
    public void Non_mostra_piu_tutti_i_campi_del_box()
    {
        string html = Editor();

        Assert.Contains("var sintesi = sintesiReferenza(b);", html);
        Assert.DoesNotContain("var sintesi = b.campi.map(", html);
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
