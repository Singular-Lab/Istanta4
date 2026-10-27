using Correggo4.Ingestione;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1151: l'a capo forzato di InDesign (Maiusc+Invio) arriva nella descrizione come
/// FORCED_LINE_BREAK e Correggo4 lo mostrava in chiaro ("FORCED_LINE_BREAKCOOP"). Ora si vede come
/// un invio dentro la sua fascia, nella stessa pillola (scelta dell'operatore): nella sola lettura
/// (LettoreDescrizione) e nella descrizione che si corregge (Views/Volantini/Dettaglio), dove alla
/// ricomposizione torna FORCED_LINE_BREAK com'era.
/// </summary>
public class AcapoForzatoTests
{
    private const string Avocado =
        "<DESCRIZIONE_TITOLO>AVOCADO HASS</DESCRIZIONE_TITOLO>\n<DESCRIZIONE_BRAND>FORCED_LINE_BREAKCOOP</DESCRIZIONE_BRAND>\n" +
        "<DESCRIZIONE_GRAMMATURA>FORCED_LINE_BREAKconf. da 550 g</DESCRIZIONE_GRAMMATURA>";

    [Fact]
    public void Nella_sola_lettura_l_a_capo_forzato_e_un_invio_dentro_la_sua_fascia()
    {
        var pezzi = LettoreDescrizione.Leggi(Avocado);

        Assert.Equal(3, pezzi.Count);
        Assert.Equal(("DESCRIZIONE_BRAND", "\nCOOP"), (pezzi[1].Tag, pezzi[1].Testo));
        Assert.Equal(("DESCRIZIONE_GRAMMATURA", "\nconf. da 550 g"), (pezzi[2].Tag, pezzi[2].Testo));
        Assert.DoesNotContain(pezzi, p => p.Testo.Contains("FORCED_LINE_BREAK"));
    }

    [Fact]
    public void Gli_a_capo_normali_agli_estremi_si_tolgono_come_prima()
    {
        var pezzo = Assert.Single(LettoreDescrizione.Leggi("<DESCRIZIONE_GRAMMATURA>\n al kgFORCED_LINE_BREAKcat. I \n</DESCRIZIONE_GRAMMATURA>"));

        Assert.Equal("al kg\ncat. I", pezzo.Testo);
    }

    [Fact]
    public void Nell_editor_e_un_a_capo_nella_stessa_pillola_e_alla_ricomposizione_torna_uguale()
    {
        string html = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

        Assert.Contains("var ACAPO_FORZATO = 'FORCED_LINE_BREAK';", html);
        // disegnando: l'a capo forzato diventa un a capo dentro la riga, non una riga nuova
        Assert.Contains("esc(r.split(ACAPO_FORZATO).join('\\n'))", html);
        // ricomponendo: l'a capo dentro la riga torna FORCED_LINE_BREAK, non si butta via
        Assert.Contains("p.textContent.replace(/[<>\\r]/g, '').replace(/\\n/g, ACAPO_FORZATO)", html);
        Assert.DoesNotContain("p.textContent.replace(/[<>\\r\\n]/g, '')", html);
        // la pillola va a capo con l'a capo (pre-wrap) e anche la fascia in sola lettura (pre-line)
        Assert.Contains("white-space: pre-wrap", html);
        Assert.Contains(".fascia { padding: 5px 8px; border-radius: 10px; margin-bottom: 7px; white-space: pre-line; }", html);
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
