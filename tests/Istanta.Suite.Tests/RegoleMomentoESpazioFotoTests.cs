using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Momento di esecuzione delle regole e scelta dello spazio delle foto.
/// Entrambe viaggiano nel SourceFrameworkCss del cliente: vanno lette dai file gia' in
/// esercizio, che non le hanno, senza cambiare il comportamento di quelli.
/// </summary>
public class RegoleMomentoESpazioFotoTests
{
    [Fact]
    public void Le_regole_gia_scritte_non_hanno_fase_e_valgono_come_prima()
    {
        // Forma dei file gia' in esercizio: nessuna regola dichiara un momento.
        const string json = "{\"nomiBox\":[\"BOX41\"],\"allineamenti\":[{\"nomeGruppo\":\"descr_All\"}],"
            + "\"ridimensionamenti\":[{\"nomeGruppo\":\"base\"}],"
            + "\"postRidimensionamenti\":[{\"nomeGruppo\":\"boxetto\"}]}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(json);

        Assert.Equal("", box!.allineamenti.Single().fase);
        Assert.Equal("", box.ridimensionamenti.Single().fase);
        Assert.Equal("", box.postRidimensionamenti.Single().fase);
    }

    [Fact]
    public void Una_regola_puo_chiedere_di_essere_eseguita_dopo_la_sistemazione_delle_foto()
    {
        const string json = "{\"nomiBox\":[\"BOX41\"],\"allineamenti\":[{\"nomeGruppo\":\"ombre_alle_foto\","
            + "\"fase\":\"dopoFixFoto\"}]}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(json);

        Assert.Equal("dopoFixFoto", box!.allineamenti.Single().fase);
    }

    [Fact]
    public void Un_box_senza_scelta_dello_spazio_foto_usa_il_criterio_di_sempre()
    {
        const string json = "{\"nomiBox\":[\"BOX1\"]}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(json);

        // Null significa area massima: nessun file esistente cambia comportamento.
        Assert.Null(box!.sceltaSpazioFoto);
    }

    [Fact]
    public void La_scelta_centrata_si_legge_con_la_sua_tolleranza()
    {
        const string json = "{\"nomiBox\":[\"BOX41\"],\"sceltaSpazioFoto\":{\"modo\":\"centrato\","
            + "\"tolleranzaArea\":0.7,\"asseCentratura\":\"x\"}}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(json);

        Assert.Equal("centrato", box!.sceltaSpazioFoto!.modo);
        Assert.Equal(0.7, box.sceltaSpazioFoto.tolleranzaArea);
        Assert.Equal("x", box.sceltaSpazioFoto.asseCentratura);
    }

    [Fact]
    public void Un_salvataggio_non_perde_ne_la_fase_ne_la_scelta_dello_spazio()
    {
        var originale = new modificheCssBox
        {
            nomiBox = new List<string> { "BOX41" },
            allineamenti = new List<Allineamento>
            {
                new() { nomeGruppo = "ombre_alle_foto", fase = "dopoFixFoto" }
            },
            sceltaSpazioFoto = new SceltaSpazioFotoObj
            {
                modo = "centrato",
                tolleranzaArea = 0.55,
                asseCentratura = "x"
            }
        };

        var riletto = JsonConvert.DeserializeObject<modificheCssBox>(JsonConvert.SerializeObject(originale));

        Assert.Equal("dopoFixFoto", riletto!.allineamenti.Single().fase);
        Assert.Equal(0.55, riletto.sceltaSpazioFoto!.tolleranzaArea);
        Assert.Equal("x", riletto.sceltaSpazioFoto.asseCentratura);
    }

    /// <summary>
    /// Nel BOX41 di Edro21 le foto stanno dentro le parentesi: se la regola non arrivasse
    /// al Plugin, una foto continuerebbe a finire di lato per guadagnare qualche millimetro.
    /// </summary>
    [Fact]
    public void Il_box41_di_Edro21_chiede_le_foto_il_piu_al_centro_possibile()
    {
        var percorso = TrovaSorgenteEdro21();
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(percorso));

        var boxConRegola = root!.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .SelectMany(m => m.operazioniPerBox)
            .Where(op => op.nomiBox.Contains("BOX41"))
            .ToList();

        Assert.NotEmpty(boxConRegola);

        foreach (var box in boxConRegola)
        {
            Assert.NotNull(box.sceltaSpazioFoto);
            Assert.Equal("centrato", box.sceltaSpazioFoto!.modo);
            Assert.Equal("x", box.sceltaSpazioFoto.asseCentratura);
            Assert.InRange(box.sceltaSpazioFoto.tolleranzaArea, 0.01, 1.0);
        }
    }

    /// <summary>
    /// Gli altri box non devono aver preso la regola per sbaglio: la centratura vale solo
    /// dove il disegno la richiede.
    /// </summary>
    [Fact]
    public void Gli_altri_box_di_Edro21_restano_sul_criterio_dell_area_massima()
    {
        var percorso = TrovaSorgenteEdro21();
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(percorso));

        var altriBox = root!.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .SelectMany(m => m.operazioniPerBox)
            .Where(op => !op.nomiBox.Contains("BOX41"));

        Assert.All(altriBox, box => Assert.Null(box.sceltaSpazioFoto));
    }

    private static string TrovaSorgenteEdro21()
    {
        const string relativo = "Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json";

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

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
