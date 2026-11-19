using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-0ba7d005: in Coop la lavorazione 1220 (B TDM) non impaginava piu' niente, con "Primario non
/// trovato" sul gruppo 2945098,2945116,2945121. Il gruppo non era impaginato li', e le sue P/S venivano
/// ereditate da una lavorazione passata della stessa area e canale il cui meta, scritto dal vecchio
/// salvataggio parziale delle P/S, le aveva tutte a "nessuna". Ora le P/S ereditate (dal passato, o
/// nel POP dal volantino) valgono solo se indicano una primaria, e il server rifiuta di salvare P/S
/// senza esattamente una primaria, qualunque client le mandi.
/// </summary>
public class PrimarieEreditateTests
{
    private const string Gruppo = "2945098,2945116,2945121";

    private static RevisioneSelezioneFotoFromIndd Ps(string codRef, int stato) =>
        new() { codRef = codRef, stato = (StatoSelezioneFoto)stato };

    //Il meta della lavorazione passata di Coop: tutte e tre a "nessuna".
    private static List<RevisioneSelezioneFotoFromIndd> SenzaPrimaria() =>
        new() { Ps("2945098", 3), Ps("2945116", 3), Ps("2945121", 3) };

    private static List<RevisioneSelezioneFotoFromIndd> ConPrimaria() =>
        new() { Ps("2945098", 1), Ps("2945116", 3), Ps("2945121", 3) };

    [Fact]
    public void P_S_ereditate_senza_primaria_non_si_applicano()
    {
        Assert.Null(MetaPromoLavorazioni.selezioniDaEreditare(SenzaPrimaria()));
        //Solo secondarie e "nessuna": ancora nessuna primaria.
        Assert.Null(MetaPromoLavorazioni.selezioniDaEreditare(new() { Ps("2945098", 2), Ps("2945116", 3) }));
        Assert.Null(MetaPromoLavorazioni.selezioniDaEreditare(new List<RevisioneSelezioneFotoFromIndd>()));
        Assert.Null(MetaPromoLavorazioni.selezioniDaEreditare(null));
    }

    [Fact]
    public void P_S_ereditate_con_la_primaria_si_applicano_come_sono()
    {
        var ps = ConPrimaria();
        Assert.Same(ps, MetaPromoLavorazioni.selezioniDaEreditare(ps));
    }

    [Fact]
    public void Si_salvano_solo_P_S_con_una_sola_primaria()
    {
        Assert.Null(MetaPromoLavorazioni.erroreDelleSelezioniFoto(ConPrimaria(), Gruppo));
        Assert.Null(MetaPromoLavorazioni.erroreDelleSelezioniFoto(new() { Ps("2945116", 1), Ps("2945098", 2), Ps("2945121", 3) }, Gruppo));
    }

    [Fact]
    public void P_S_senza_primaria_o_con_due_primarie_non_si_salvano()
    {
        Assert.Equal($"il gruppo {Gruppo} deve avere una sola primaria: ne sono arrivate 0.",
            MetaPromoLavorazioni.erroreDelleSelezioniFoto(SenzaPrimaria(), Gruppo));
        Assert.Equal($"il gruppo {Gruppo} deve avere una sola primaria: ne sono arrivate 2.",
            MetaPromoLavorazioni.erroreDelleSelezioniFoto(new() { Ps("2945098", 1), Ps("2945116", 1), Ps("2945121", 3) }, Gruppo));
        Assert.Equal($"il gruppo {Gruppo} deve avere una sola primaria: ne sono arrivate 0.",
            MetaPromoLavorazioni.erroreDelleSelezioniFoto(new List<RevisioneSelezioneFotoFromIndd>(), Gruppo));
    }

    [Fact]
    public void Il_passato_e_il_volantino_del_POP_passano_le_P_S_dal_controllo()
    {
        string lettura = Tratto(Sorgente(Fico), "public List<ArticoloInKit> updateDatiFromMetaPromoLavorazioni(", "if (storeField.noRender != null");

        //POP: il ps del corrispettivo passa dal controllo, la foto no.
        Assert.Contains("storeField = new RevisioneMetaPromoLavorazioni { ps = MetaPromoLavorazioni.selezioniDaEreditare(ereditati.ps), foto = ereditati.foto };", lettura);
        Assert.DoesNotContain("ps = ereditati.ps,", lettura);

        //Passato: si usano solo le P/S controllate.
        Assert.Contains("var psDelPassato = MetaPromoLavorazioni.selezioniDaEreditare(recPassato.ps);", lettura);
        Assert.Contains("var psItem = psDelPassato.FirstOrDefault(", lettura);
        Assert.DoesNotContain("recPassato.ps.FirstOrDefault(", lettura);
    }

    [Fact]
    public void Il_salvataggio_delle_P_S_si_rifiuta_prima_di_registrare()
    {
        string metodo = Tratto(Sorgente(Menabo), "\n        public async Task<IActionResult> modificaPrimarieSecondarie(", "public class InddObjNoRenderRequest");

        int controllo = metodo.IndexOf("string? erroreSelezioni = MetaPromoLavorazioni.erroreDelleSelezioniFoto(ps, dato.CodiceGruppo);", StringComparison.Ordinal);
        int rifiuto = metodo.IndexOf("throw new ErroreIstanta(\"controllo delle primarie\", erroreSelezioni);", StringComparison.Ordinal);
        int registrazione = metodo.IndexOf("registraAttivitaMenabo(", StringComparison.Ordinal);
        Assert.True(controllo > 0, "manca il controllo delle primarie");
        Assert.True(rifiuto > controllo, "manca il rifiuto dopo il controllo");
        Assert.True(registrazione > rifiuto, "il controllo deve venire prima della registrazione");
    }

    /* ---- strumenti ---- */

    private const string Menabo = "Istanta/Controllers/MenaboController.cs";
    private const string Fico = "Istanta/Controllers/FicoProcessController.cs";

    /// Il testo fra inizio e fine, senza le righe commentate: i controller tengono anche il codice
    /// vecchio, commentato.
    private static string Tratto(string sorgente, string inizio, string fine)
    {
        int da = sorgente.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, "manca " + inizio);
        int a = sorgente.IndexOf(fine, da + inizio.Length, StringComparison.Ordinal);
        Assert.True(a > da, "manca " + fine + " dopo " + inizio);
        string corpo = sorgente.Substring(da, a - da);
        return string.Join("\n", corpo.Split('\n').Where(riga => !riga.TrimStart().StartsWith("//")));
    }

    private static string Sorgente(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return File.ReadAllText(candidato).Replace("\r", "");
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
