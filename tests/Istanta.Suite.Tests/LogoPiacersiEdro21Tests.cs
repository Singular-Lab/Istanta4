using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.RegularExpressions;
using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1145: il logo Conad Piacersi di Edro21. getLoghiEBolliNew non lo assegna alle ref di un tema
/// focus, e cosi' le ref benessere della sezione Scelte di Benessere, che escono col box normale
/// (I20-1053) e quindi senza logo SDB, restavano anche senza logo Piacersi. Nel volantino quelle ref
/// ora lo ricevono; gli altri temi focus e il PoP restano come prima.
/// </summary>
public class LogoPiacersiEdro21Tests
{
    private const int Volantino = 1;
    private const int PoP = 2;

    private static Dictionary<string, object> Ref(string tipoTema, string sezione, string distintivita, string combinazione)
    {
        return new Dictionary<string, object>
        {
            [Edro21Context.Meta.tipo_tema] = tipoTema,
            [Edro21Context.Meta.sezione] = sezione,
            [Edro21Context.Meta.distintivita] = distintivita,
            [Edro21Context.Meta.keyCombinazioneAssegnata] = combinazione,
        };
    }

    [Theory]
    [InlineData("FOCUS_focus", "SCELTE DI BENESSERE")]
    [InlineData("FOCUS", "Scelte di Benessere")]
    public void Nel_volantino_la_ref_benessere_della_sezione_Scelte_di_Benessere_ha_il_logo(string tipoTema, string sezione)
    {
        var record = Ref(tipoTema, sezione, "BENESSERE", "TP_MM_KgL_sdb");

        Assert.True(SceltaDiBenessereEdro21.LogoPiacersiAmmesso(record, Volantino));
    }

    [Fact]
    public void Nel_PoP_la_stessa_ref_resta_senza_logo()
    {
        var record = Ref("FOCUS_focus", "SCELTE DI BENESSERE", "BENESSERE", "TP_MM_KgL_sdb");

        Assert.False(SceltaDiBenessereEdro21.LogoPiacersiAmmesso(record, PoP));
    }

    [Theory]
    // Tema focus in un'altra sezione.
    [InlineData("FOCUS", "FRESCHISSIMI", "BENESSERE", "TP_MM_KgL_sdb")]
    // Sezione Scelte di Benessere, ma la ref non e' benessere: esce col box SDB.
    [InlineData("FOCUS_focus", "SCELTE DI BENESSERE", "CONVENIENZA", "TP_MM_KgL_sdb")]
    // Sezione Scelte di Benessere senza meccanica sdb.
    [InlineData("FOCUS", "SCELTE DI BENESSERE", "BENESSERE", "TP_MM_KgL")]
    // Il focus scritto nella sezione.
    [InlineData("VOLANTINO", "FOCUS LATTICINI", "BENESSERE", "TP_MM_KgL")]
    public void Gli_altri_temi_focus_restano_senza_logo(string tipoTema, string sezione, string distintivita, string combinazione)
    {
        var record = Ref(tipoTema, sezione, distintivita, combinazione);

        Assert.False(SceltaDiBenessereEdro21.LogoPiacersiAmmesso(record, Volantino));
    }

    [Theory]
    [InlineData(Volantino)]
    [InlineData(PoP)]
    public void Fuori_dai_temi_focus_il_logo_c_e_come_prima(int tipoLavorazione)
    {
        var record = Ref("VOLANTINO", "LATTICINI", "", "TP_MM_KgL");

        Assert.True(SceltaDiBenessereEdro21.LogoPiacersiAmmesso(record, tipoLavorazione));
    }

    [Fact]
    public void Il_ramo_Piacersi_di_getLoghiEBolliNew_passa_dalla_regola()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Edro21.cs")).Replace("\r", "");
        var inizio = sorgente.IndexOf("protected Dictionary<string, string> getLoghiEBolliNew(", StringComparison.Ordinal);
        Assert.True(inizio > 0, "getLoghiEBolliNew non c'e' piu'");
        var ramo = sorgente.IndexOf("else if (gusto.Contains(\"piacersi\")", inizio, StringComparison.Ordinal);
        Assert.True(ramo > 0, "il ramo Piacersi non c'e' piu'");
        var fine = sorgente.IndexOf("prodotto_conad = \"conad_piacersi\";", ramo, StringComparison.Ordinal);
        var testo = sorgente.Substring(ramo, fine - ramo);

        Assert.Matches(new Regex(@"if \(SceltaDiBenessereEdro21\.LogoPiacersiAmmesso\(oItem, tipo_lavorazione\)\)"), testo);
    }

    [Fact]
    public void La_dll_committata_ha_la_regola()
    {
        // Istanta in locale carica la DLL di external_lib, che la build non aggiorna (I20-1023).
        using var flusso = File.OpenRead(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_lib/AgenziaLib.dll"));
        using var pe = new PEReader(flusso);
        var metadati = pe.GetMetadataReader();

        var tipo = metadati.TypeDefinitions
            .Select(metadati.GetTypeDefinition)
            .Single(t => metadati.GetString(t.Namespace) == "AgenziaLib" && metadati.GetString(t.Name) == "SceltaDiBenessereEdro21");

        Assert.Contains(tipo.GetMethods().Select(metadati.GetMethodDefinition), m => metadati.GetString(m.Name) == "LogoPiacersiAmmesso");
    }
}
