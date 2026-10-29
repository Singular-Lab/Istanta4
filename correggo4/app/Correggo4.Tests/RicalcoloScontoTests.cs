using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1162: nella finestra del prodotto, cambiando lo sconto si ricalcolano prezzo promo e prezzo al
/// kg/lt, e cambiando i prezzi si ricalcola lo sconto. Il ricalcolo conosceva solo lo sconto di Famila
/// (azione_pubblico, "30%"); in CoopFi lo sconto e' txt_sconto ("-30%") e non scattava. Il ricalcolo
/// gira nel browser: qui si controlla il codice della pagina, come in BottoneSalvaTests.
/// </summary>
public class RicalcoloScontoTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void Lo_sconto_di_CoopFi_e_quello_di_Famila_fanno_scattare_il_ricalcolo()
    {
        string html = Editor();

        Assert.Contains("var CAMPI_SCONTO = ['txt_sconto', 'azione_pubblico'];", html);
        Assert.Contains("} else if (campoSconto && cambiato === campoSconto) {", html);
        // prezzo promo e kg/lt nella stessa proporzione, a partire dai valori originali
        Assert.Contains("var nuovo = oPromo * (100 - nuovoSc) / (100 - oSc);", html);
        Assert.Contains("scrivi('prezzo_promo_kgl', (oKgl * nuovo / oPromo).toFixed(2));", html);
        // nessun campo sconto scritto a nome fisso
        Assert.DoesNotContain("scrivi('azione_pubblico'", html);
    }

    [Fact]
    public void Il_segno_meno_non_blocca_il_calcolo_e_lo_sconto_resta_nella_sua_forma()
    {
        string html = Editor();

        // "-20%" si legge 20, non -20 (che il controllo nuovoSc >= 0 scartava)
        Assert.Contains("var nuovoSc = Math.abs(percentoEa(val(campoSconto))), oSc = Math.abs(percentoEa(old(campoSconto)));", html);
        // "-20%" diventa "-30%", "20%" diventa "30%"
        Assert.Contains("return /\\d/.test(forma) ? forma.replace(/\\d+([.,]\\d+)?/, String(s)) : s + '%';", html);
    }

    [Fact]
    public void Lo_sconto_di_CoopFi_si_chiama_Sconto()
    {
        Assert.Contains("txt_sconto: 'Sconto'", Editor());
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
