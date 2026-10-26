using System.IO;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1140: i loghi idms con un testo preso dal dato, che il Plugin confronta col testo del logo nel
/// box. Il confronto e' del core; qui si verifica il dato di agenzia nel SourceCustomPlugin: si legge,
/// non si perde al salvataggio, e per Edro21 dichiara il logo attributo italiano.
/// </summary>
public class LoghiConTestoTests
{
    [Fact]
    public void Un_source_senza_il_campo_si_legge_con_la_lista_vuota()
    {
        // Forma dei file gia' in esercizio prima di questa modifica.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.loghiConTesto);
    }

    [Fact]
    public void La_voce_si_legge_con_sigla_e_campo_e_sopravvive_al_salvataggio()
    {
        const string json = "{\"loghiConTesto\":[{\"sigla\":\"logo_attributo_it\",\"keyInRecordInTracciato\":\"logo_attributo_it\"}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);
        var voce = Assert.Single(agenzia!.loghiConTesto);
        Assert.Equal("logo_attributo_it", voce.sigla);
        Assert.Equal("logo_attributo_it", voce.keyInRecordInTracciato);

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));
        var voceRiletta = Assert.Single(riletto!.loghiConTesto);
        Assert.Equal("logo_attributo_it", voceRiletta.sigla);
        Assert.Equal("logo_attributo_it", voceRiletta.keyInRecordInTracciato);
    }

    [Fact]
    public void Il_source_di_Edro21_dichiara_il_logo_attributo_italiano_col_suo_testo()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSorgenteEdro21()));

        Assert.NotNull(agenzia);
        var voce = Assert.Single(agenzia!.loghiConTesto);
        Assert.Equal("logo_attributo_it", voce.sigla);
        Assert.Equal("logo_attributo_it", voce.keyInRecordInTracciato);
        // Le voci che c'erano restano.
        Assert.Single(agenzia.descrizioniInSolaLettura);
        Assert.Single(agenzia.avvisiCambioPrimario);
    }

    private static string TrovaSorgenteEdro21()
    {
        const string relativo = "Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json";

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

        throw new FileNotFoundException("SourceCustomPlugin.json di Edro21 non trovato risalendo da " + AppContext.BaseDirectory);
    }
}
