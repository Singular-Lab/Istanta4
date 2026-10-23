using System.IO;
using System.Linq;
using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1132: gli scatti con confezioni di Edro21. Quando la primaria di un gruppo e' una confezione
/// (codice_vv diverso da 1, codice ...vv2/...vv3) la grammatura del box deve essere la sua, non quella
/// della descrizione di gruppo, che e' del pezzo singolo. La regola riscrive la Descrizione4 di
/// descrizione_gruppo di ogni membro e marca i record con grammatura_da_confezione, prima che
/// esportaVolantino componga i box: cosi' box, scheda ref e segnalazioni vedono lo stesso dato.
/// </summary>
public class GrammaturaConfezioneEdro21Tests
{
    private const string Gruppo = "32711,32711vv2";

    [Theory]
    [InlineData("2", "32711vv2", true)]
    [InlineData("3", "32711vv3", true)]
    [InlineData(" 2 ", "32711", true)]
    [InlineData("1", "32711", false)]
    [InlineData("1", "32711vv2", false)]
    //Senza codice_vv decide il suffisso del codice, come GetPriority.
    [InlineData("", "32711vv2", true)]
    [InlineData(null, "32711VV3", true)]
    [InlineData(null, "32711", false)]
    [InlineData(null, "32711vv1", false)]
    public void La_confezione_si_riconosce_da_codice_vv_o_dal_suffisso(string? codiceVv, string codice, bool atteso)
    {
        var record = new Dictionary<string, object> { ["Referenza.Codice"] = codice };
        if (codiceVv != null)
        {
            record["codice_vv"] = codiceVv;
        }

        Assert.Equal(atteso, GrammaturaConfezioneEdro21.EConfezione(record));
    }

    [Fact]
    public void Un_record_nullo_non_e_una_confezione_ne_una_primaria()
    {
        Assert.False(GrammaturaConfezioneEdro21.EConfezione(null));
        Assert.False(GrammaturaConfezioneEdro21.EPrimaria(null));
        Assert.Equal(0, GrammaturaConfezioneEdro21.Applica(null));
    }

    [Fact]
    public void Con_la_primaria_confezione_la_grammatura_di_gruppo_diventa_quella_della_confezione_in_tutti_i_membri()
    {
        var singolo = Membro("32711", "1", 0, "1 l");
        var confezione = Membro("32711vv2", "2", 1, "conf. 6 x 1 l");
        var records = new List<Dictionary<string, object>> { singolo, confezione };

        var applicati = GrammaturaConfezioneEdro21.Applica(records);

        Assert.Equal(1, applicati);
        foreach (var membro in records)
        {
            var dg = (Dictionary<string, object>)membro["descrizione_gruppo"];
            Assert.Equal("conf. 6 x 1 l", dg["Descrizioni.Descrizione4"]);
            //Le altre descrizioni del gruppo restano.
            Assert.Equal("BISCOTTI", dg["Descrizioni.Descrizione1"]);
            Assert.Equal("32711vv2", membro["grammatura_da_confezione"]);
        }
        //La Descrizione4 individuale del pezzo singolo non si tocca.
        Assert.Equal("1 l", singolo["Descrizioni.Descrizione4"]);
    }

    [Fact]
    public void La_grammatura_e_quella_revisionata_sulla_singola_quando_il_record_la_porta()
    {
        //Istanta scrive in Descrizioni.Descrizione4 la descrizione individuale revisionata, se c'e'.
        var records = new List<Dictionary<string, object>> { Membro("32711", "1", 0, "1 l"), Membro("32711vv2", "2", 1, "conf. 6 x 1 l revisionata") };

        GrammaturaConfezioneEdro21.Applica(records);

        Assert.All(records, m => Assert.Equal("conf. 6 x 1 l revisionata", ((Dictionary<string, object>)m["descrizione_gruppo"])["Descrizioni.Descrizione4"]));
    }

    [Fact]
    public void Con_la_primaria_pezzo_singolo_non_cambia_niente_e_il_marcatore_se_ne_va()
    {
        var singolo = Membro("32711", "1", 1, "1 l");
        var confezione = Membro("32711vv2", "2", 0, "conf. 6 x 1 l");
        //Un marcatore rimasto da un giro precedente.
        singolo["grammatura_da_confezione"] = "32711vv2";
        var records = new List<Dictionary<string, object>> { singolo, confezione };

        var applicati = GrammaturaConfezioneEdro21.Applica(records);

        Assert.Equal(0, applicati);
        Assert.All(records, m => Assert.Equal("1 l", ((Dictionary<string, object>)m["descrizione_gruppo"])["Descrizioni.Descrizione4"]));
        Assert.All(records, m => Assert.False(m.ContainsKey("grammatura_da_confezione")));
    }

    [Fact]
    public void Un_singolo_e_un_gruppo_senza_descrizione_di_gruppo_sono_ignorati()
    {
        //Singolo: codice gruppo uguale al codice, anche se confezione e primario.
        var singolo = Membro("45000vv2", "2", 1, "conf. 4 x 500 g");
        singolo["Scatto.CodiceGruppo"] = "45000vv2";
        //Gruppo senza descrizione_gruppo: niente da riscrivere.
        var senzaDg1 = Membro("32711", "1", 0, "1 l");
        var senzaDg2 = Membro("32711vv2", "2", 1, "conf. 6 x 1 l");
        senzaDg1.Remove("descrizione_gruppo");
        senzaDg2.Remove("descrizione_gruppo");
        var records = new List<Dictionary<string, object>> { singolo, senzaDg1, senzaDg2 };

        var applicati = GrammaturaConfezioneEdro21.Applica(records);

        Assert.Equal(0, applicati);
        Assert.All(records, m => Assert.False(m.ContainsKey("grammatura_da_confezione")));
        //La descrizione di gruppo del singolo resta quella di partenza.
        Assert.Equal("1 l", ((Dictionary<string, object>)singolo["descrizione_gruppo"])["Descrizioni.Descrizione4"]);
    }

    [Fact]
    public void I_gruppi_si_trattano_ognuno_per_se()
    {
        var a1 = Membro("32711", "1", 0, "1 l");
        var a2 = Membro("32711vv2", "2", 1, "conf. 6 x 1 l");
        var b1 = Membro("40000", "1", 1, "500 g");
        var b2 = Membro("40000vv2", "2", 0, "conf. 2 x 500 g");
        b1["Scatto.CodiceGruppo"] = "40000,40000vv2";
        b2["Scatto.CodiceGruppo"] = "40000,40000vv2";
        var records = new List<Dictionary<string, object>> { a1, b1, a2, b2 };

        var applicati = GrammaturaConfezioneEdro21.Applica(records);

        Assert.Equal(1, applicati);
        Assert.Equal("conf. 6 x 1 l", ((Dictionary<string, object>)a1["descrizione_gruppo"])["Descrizioni.Descrizione4"]);
        //Il gruppo B ha la primaria pezzo singolo: la sua descrizione di gruppo resta quella di partenza.
        Assert.Equal("1 l", ((Dictionary<string, object>)b2["descrizione_gruppo"])["Descrizioni.Descrizione4"]);
        Assert.False(b1.ContainsKey("grammatura_da_confezione"));
    }

    /// <summary>
    /// La regola vale solo se esportaVolantino la applica, prima di comporre i box.
    /// </summary>
    [Fact]
    public void EsportaVolantino_applica_la_regola_dopo_aver_letto_i_record()
    {
        var sorgente = File.ReadAllText(TrovaFile("AgenziaLib/Edro21.cs"));
        var inizioVolantino = sorgente.IndexOf("public TracciatoResultKit esportaVolantino(");
        var inizioPop = sorgente.IndexOf("public TracciatoResultKit esportaPoP(");
        Assert.True(inizioVolantino > 0 && inizioPop > inizioVolantino);

        var corpoVolantino = sorgente.Substring(inizioVolantino, inizioPop - inizioVolantino);
        var lettura = corpoVolantino.IndexOf("lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();");
        var applica = corpoVolantino.IndexOf("GrammaturaConfezioneEdro21.Applica(lista_tracciato);");
        Assert.True(lettura > 0, "esportaVolantino non legge piu' lista_tracciato come prima: il test va aggiornato");
        Assert.True(applica > lettura, "esportaVolantino non applica GrammaturaConfezioneEdro21 dopo aver letto i record");
    }

    private static Dictionary<string, object> Membro(string codice, string codiceVv, int statoSelezione, string descrizione4)
    {
        return new Dictionary<string, object>
        {
            ["Referenza.Codice"] = codice,
            ["Scatto.CodiceGruppo"] = Gruppo,
            ["codice_vv"] = codiceVv,
            ["StatoSelezione"] = statoSelezione,
            ["Descrizioni.Descrizione4"] = descrizione4,
            ["descrizione_gruppo"] = new Dictionary<string, object>
            {
                ["Descrizioni.Descrizione1"] = "BISCOTTI",
                ["Descrizioni.Descrizione2"] = "CONAD",
                ["Descrizioni.Descrizione3"] = "petit, per latte",
                ["Descrizioni.Descrizione4"] = "1 l"
            }
        };
    }

    private static string TrovaFile(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException(relativo + " non trovato risalendo da " + AppContext.BaseDirectory);
    }
}
