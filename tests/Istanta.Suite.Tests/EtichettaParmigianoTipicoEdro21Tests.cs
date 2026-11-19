using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-2e79b332: l'etichetta PARMIGIANO TIPICO di Edro21. Una ref la cui descrizione1 revisionata dice
/// Parmigiano Reggiano e la cui distintivita' e' esattamente TIPICO esce nel format tipico con il bollo dei
/// mesi, invece del formato Parmigiano; TIPICO_ seguito da un brand resta Parmigiano. La regola sta in
/// Istanta/wwwroot/external_source/Edro21/SourceEtichetteRef.json e la valuta l'etichettatura vera del
/// MenaboController, per lista e per singolo record. Con l'occasione: una revisione senza Descrizione1 non
/// deve far perdere al record le altre etichette (getPercorso restituiva null).
/// </summary>
public class EtichettaParmigianoTipicoEdro21Tests : IDisposable
{
    private const string Etichetta = "PARMIGIANO TIPICO";

    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "task-2e79b332-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_cartella))
        {
            Directory.Delete(_cartella, true);
        }
    }

    private sealed class FabbricaSenzaConnessione<T> : IDbContextFactory<T> where T : DbContext
    {
        private readonly Func<T> _crea;
        public FabbricaSenzaConnessione(Func<T> crea) => _crea = crea;
        public T CreateDbContext() => _crea();
    }

    /// Il controller vero, con contesti che non aprono mai una connessione e l'external source in una
    /// cartella temporanea con le etichette di Edro21 (come EtichettaSfGaEdro21Tests).
    private MenaboController Controller()
    {
        Directory.CreateDirectory(_cartella);
        File.Copy(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceEtichetteRef.json"),
            Path.Combine(_cartella, "SourceEtichetteRef.json"), true);
        return new MenaboController(
            null,
            new ConfigurationBuilder().Build(),
            Options.Create(new PathExternal { pathSource = _cartella + Path.DirectorySeparatorChar, pathLib = _cartella + Path.DirectorySeparatorChar }),
            null,
            null,
            null,
            null,
            Options.Create(new FicoConfig()),
            new FabbricaSenzaConnessione<edro21_dbContext>(() => new edro21_dbContext(
                new DbContextOptionsBuilder<edro21_dbContext>().UseNpgsql("Host=localhost;Database=nessuno").Options)),
            new FabbricaSenzaConnessione<Edro21_DbContext2>(() => new Edro21_DbContext2(
                new DbContextOptionsBuilder<Edro21_DbContext2>().UseNpgsql("Host=localhost;Database=nessuno").Options)));
    }

    /// Una ref con la distintivita', la descrizione1 del tracciato e quella revisionata (null: nessuna revisione).
    private static ArticoloInRevisione Referenza(string distintivita, string? revisionata, string delTracciato = "Parmigiano Reggiano DOP", string settore = "2401", bool conRevisione = true) => new ArticoloInRevisione
    {
        recordInTracciato = new Dictionary<string, object>
        {
            ["Referenza.Codice"] = "1234567",
            ["reparto"] = settore.Substring(0, 2),
            ["settore"] = settore,
            ["distintivita"] = distintivita,
            ["Descrizioni.Descrizione1"] = delTracciato
        },
        recordRevisionato = conRevisione ? new ArticoliDescrizioni { Descrizione1 = revisionata } : null,
        allEtichette = new List<string>(),
        etichetteVisual = new List<string>()
    };

    /// Le etichette che le due Etichettatura (per lista e per singolo record) danno alla referenza:
    /// tutte (allEtichette) e quelle visibili (etichetteVisual).
    private List<List<string>> Etichette(Func<ArticoloInRevisione> referenza)
    {
        var controller = Controller();
        var perLista = controller.Etichettatura(new List<ArticoloInRevisione> { referenza() }).Single();
        var perRecord = controller.Etichettatura(referenza());
        return new List<List<string>> { perLista.allEtichette!, perRecord.allEtichette! };
    }

    [Theory]
    [InlineData("TIPICO", "PARMIGIANO REGGIANO DOP 24 MESI")]
    [InlineData("tipico", "Parmigiano Reggiano")]
    [InlineData(" Tipico ", "parmigiano  reggiano dop")]
    public void Distintivita_TIPICO_e_descrizione_revisionata_Parmigiano_danno_l_etichetta(string distintivita, string revisionata)
    {
        foreach (var etichette in Etichette(() => Referenza(distintivita, revisionata)))
        {
            Assert.Contains(Etichetta, etichette);
        }
    }

    [Theory]
    //TIPICO_ seguito da un brand, qualsiasi brand: resta il formato Parmigiano.
    [InlineData("TIPICO_BRAND")]
    [InlineData("TIPICO_CONAD")]
    [InlineData("TIPICO_SAPORI&DINTORNI")]
    [InlineData("")]
    [InlineData("BENESSERE")]
    public void Le_altre_distintivita_non_danno_l_etichetta(string distintivita)
    {
        foreach (var etichette in Etichette(() => Referenza(distintivita, "Parmigiano Reggiano DOP")))
        {
            Assert.DoesNotContain(Etichetta, etichette);
        }
    }

    [Fact]
    public void Conta_la_descrizione_revisionata_non_quella_del_tracciato()
    {
        //Il tracciato dice Parmigiano, la revisione no: niente etichetta.
        foreach (var etichette in Etichette(() => Referenza("TIPICO", "Grana Padano DOP", delTracciato: "Parmigiano Reggiano DOP")))
        {
            Assert.DoesNotContain(Etichetta, etichette);
        }
        //La revisione dice Parmigiano, il tracciato no: l'etichetta c'e'.
        foreach (var etichette in Etichette(() => Referenza("TIPICO", "Parmigiano Reggiano DOP", delTracciato: "Formaggio stagionato")))
        {
            Assert.Contains(Etichetta, etichette);
        }
    }

    [Fact]
    public void Senza_revisione_niente_etichetta()
    {
        foreach (var etichette in Etichette(() => Referenza("TIPICO", null, conRevisione: false)))
        {
            Assert.DoesNotContain(Etichetta, etichette);
        }
    }

    [Fact]
    public void Una_revisione_senza_Descrizione1_non_fa_perdere_le_altre_etichette()
    {
        //Settore 2501: la ref deve avere comunque SF (GA). Prima la Descrizione1 null faceva saltare tutte le
        //etichette del record.
        foreach (var etichette in Etichette(() => Referenza("TIPICO", null, settore: "2501")))
        {
            Assert.DoesNotContain(Etichetta, etichette);
            Assert.Contains("SF (GA)", etichette);
            Assert.Contains("DIS.TIPICO", etichette);
        }
    }

    [Fact]
    public void L_etichetta_sta_nel_gruppo_Default_con_il_testo_visibile_e_un_Id_nuovo()
    {
        var json = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceEtichetteRef.json")));
        var voce = Assert.Single(json["source"]!, e => (string?)e["Etichetta"] == Etichetta);

        Assert.Equal("", (string?)voce["Raccolta"]);
        Assert.Equal("Parmigiano tipico", (string?)voce["Visual"]);
        Assert.Single(json["source"]!, e => (int)e["Id"]! == (int)voce["Id"]!);
        //Lo stesso nome che leggono il server (FormatoParmigianoEdro21.EtichettaTipico) e il custom del Plugin.
        Assert.Equal(Etichetta, AgenziaLib.FormatoParmigianoEdro21.EtichettaTipico);
    }
}
