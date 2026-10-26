using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1136: l'archivio loghi e bolli si puo' scrivere dal sorgente, come Aree/Canali. La vista
/// Source della pagina Loghi e bolli manda il JSON intero a LoghiBolli/salvaSourceJsonCode, che
/// chiama DbLoghiBolli.SetJsonSource: l'elenco in memoria, letto anche dalla sincronizzazione dei
/// loghi del Plugin, cambia subito, e il file viene riscritto. Un sorgente sbagliato non tocca niente.
/// </summary>
public class LoghiBolliSourceTests : IDisposable
{
    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "LoghiBolliSourceTests_" + Guid.NewGuid().ToString("N"));

    public LoghiBolliSourceTests()
    {
        Directory.CreateDirectory(_cartella);
    }

    public void Dispose()
    {
        try { Directory.Delete(_cartella, true); } catch { }
    }

    private string File_ => Path.Combine(_cartella, "SourceLoghiBolli.json");

    private static LogoBollo Logo(string sigla, string guid) =>
        new LogoBollo { id = Guid.NewGuid().ToString(), nome = sigla + ".psd", guidId = guid, sigla = sigla, dataModifica = "23/10/2026 10:00:00", tipo = TipoFoto.Logo };

    // Un archivio con un logo, salvato su disco come lo trova Istanta all'avvio.
    private DbLoghiBolli ArchivioDiPartenza()
    {
        var db = new DbLoghiBolli();
        db.SetExternalPath(_cartella + Path.DirectorySeparatorChar);
        db.source.Add(Logo("logo_vecchio", "guid-vecchio"));
        db.SaveChanges();
        return db;
    }

    [Fact]
    public void Un_sorgente_valido_sostituisce_l_elenco_in_memoria_e_il_file()
    {
        var db = ArchivioDiPartenza();
        var incollato = JsonConvert.SerializeObject(new { source = new[] { Logo("logo_dop", "guid-1"), Logo("bollo_24", "guid-2") } });

        var esito = db.SetJsonSource(incollato);

        Assert.True(esito.Esito, esito.error);
        Assert.Equal(new[] { "logo_dop", "bollo_24" }, db.source.Select(l => l.sigla));
        var suDisco = JsonConvert.DeserializeObject<DbLoghiBolli>(File.ReadAllText(File_))!;
        Assert.Equal(new[] { "guid-1", "guid-2" }, suDisco.source.Select(l => l.guidId));
    }

    [Fact]
    public void Un_elenco_vuoto_scritto_apposta_vale()
    {
        var db = ArchivioDiPartenza();

        var esito = db.SetJsonSource("{\"source\":[]}");

        Assert.True(esito.Esito, esito.error);
        Assert.Empty(db.source);
    }

    [Theory]
    [InlineData("non e' json")]
    [InlineData("{\"source\":[{\"sigla\":")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("{\"loghi\":[]}")]
    [InlineData("{\"source\":null}")]
    [InlineData("null")]
    [InlineData("")]
    public void Un_sorgente_sbagliato_non_tocca_ne_l_elenco_ne_il_file(string sorgente)
    {
        var db = ArchivioDiPartenza();
        var fileDiPrima = File.ReadAllText(File_);

        var esito = db.SetJsonSource(sorgente);

        Assert.False(esito.Esito);
        Assert.False(string.IsNullOrWhiteSpace(esito.error));
        Assert.Equal("logo_vecchio", Assert.Single(db.source).sigla);
        Assert.Equal(fileDiPrima, File.ReadAllText(File_));
    }

    [Fact]
    public void L_endpoint_della_pagina_salva_l_archivio_in_memoria_dal_sorgente()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs")).Replace("\r", "");

        Assert.Matches(new System.Text.RegularExpressions.Regex(
            @"\[HttpPut\]\s*\[Route\(""LoghiBolli/salvaSourceJsonCode""\)\]\s*public IActionResult salvaSourceJsonCodeLoghiBolli\(\[FromBody\] SourceJsonRequest request\)\s*\{\s*BoolResult bRes = Utility\.SingletonConfiguration\.DBLOGHIBOLLI!\.SetJsonSource\(request\.jsoncode\);\s*return Ok\(bRes\);"),
            sorgente);
    }
}
