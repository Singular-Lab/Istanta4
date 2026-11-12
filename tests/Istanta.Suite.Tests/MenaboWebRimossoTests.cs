using System;
using System.IO;
using System.Linq;
using System.Reflection;
using Istanta.Controllers;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Il menabo' web di Istanta non esiste piu': la sua pagina e' stata tolta con 4826b52b (si lavora dal
/// Plugin), e con questo task tutto cio' che restava appeso senza chiamanti: la catena delle azioni
/// (inMenabo, AllInMenabo, AutoImpaginazione, ScambiaRef, leggiCsv, cambiaFormato, salvaPagina), i Multiplex,
/// le regole di impaginazione automatica, gli schemi del menabo' di MenaboSettings, il Mastro e Menabo/Index.
/// Questi test impediscono che tornino, e che qualcosa torni a dipendere da SourceMenabo.json.
/// </summary>
public class MenaboWebRimossoTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    private static bool EsisteFile(string relativo)
    {
        try
        {
            DllAgenziaLibTests.TrovaFile(relativo);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    [Theory]
    [InlineData("AllInMenabo")]
    [InlineData("inMenabo")]
    [InlineData("AutoImpaginazione")]
    [InlineData("ScambiaRef")]
    [InlineData("leggiCsv")]
    [InlineData("cambiaFormato")]
    [InlineData("RimuoviMultiplex")]
    [InlineData("AggiungiMultiplex")]
    [InlineData("getFormato")]
    [InlineData("getMastro")]
    [InlineData("getMeccaniche")]
    [InlineData("Index")]
    public void Le_azioni_del_menabo_web_non_ci_sono_piu(string azione)
    {
        var metodi = typeof(MenaboController).GetMethods(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);

        Assert.DoesNotContain(metodi, m => m.Name == azione);
    }

    [Fact]
    public void Le_rotte_del_menabo_web_e_delle_regole_non_ci_sono_piu()
    {
        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        foreach (var rotta in new[] { "Menabo/inMenabo", "Menabo/AllInMenabo", "Menabo/AutoImpaginazione", "Menabo/ScambiaRef", "Menabo/leggiCsv", "Menabo/cambiaFormato", "Menabo/salvaPagina", "Menabo/getFormato/" })
        {
            Assert.DoesNotContain("Route(\"" + rotta, menabo);
        }

        var tracciati = Sorgente("Istanta/Controllers/TracciatiController.cs");
        foreach (var rotta in new[] { "scriviRegolaMenabo", "getRegoleMenaboByIdAddestramento", "getAllRegoleMenabo", "getAllFormatiPaginaMenabo", "getAllMeccaniche" })
        {
            Assert.DoesNotContain("Tracciati/" + rotta, tracciati);
        }
    }

    [Fact]
    public void Gli_schemi_del_menabo_e_il_Mastro_non_ci_sono_piu_ma_le_pagine_vive_di_MenaboSettings_si()
    {
        Assert.False(EsisteFile("Istanta/Controllers/MastroController.cs"));
        Assert.False(EsisteFile("Istanta/Views/Mastro/Index.cshtml"));
        Assert.False(EsisteFile("Istanta/Views/MenaboSettings/Index.cshtml"));
        Assert.False(EsisteFile("Istanta/wwwroot/js/menaboSettings.js"));

        var impostazioni = typeof(MenaboSettingsController).GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly).Select(m => m.Name).ToHashSet();
        foreach (var morta in new[] { "Index", "Update", "Delete", "Insert", "salvaPaginaSchema", "eliminaPaginaSchema", "salvaFormatiPagine" })
        {
            Assert.DoesNotContain(morta, impostazioni);
        }
        //Le pagine del menu restano.
        foreach (var viva in new[] { "Ordinamento", "Formati", "TipiDiExport", "NamingConventions", "salvaSourceJsonCodeForOrdinamentoLista", "salvaSchemaOrdinamento", "creaOrdinamentoAutomatico" })
        {
            Assert.Contains(viva, impostazioni);
        }
    }

    // SourceMenabo.json non c'e' nella configurazione di base dei clienti: chiederlo al costruttore di
    // ExternalSourceClass faceva fallire chi non l'aveva (l'etichettatura restituiva i record senza
    // etichette, in silenzio). Dopo la pulizia nessuno lo legge piu'.
    [Fact]
    public void Nessuno_chiede_piu_SourceMenabo()
    {
        foreach (var file in new[] { "Istanta/Controllers/MenaboController.cs", "Istanta/Controllers/TracciatiController.cs", "Istanta/Controllers/MenaboSettingsController.cs", "Istanta/Models/ExternalSourceClass.cs" })
        {
            var righe = Sorgente(file).Split('\n').Where(r => r.Contains("SourceMenabo") && !r.TrimStart().StartsWith("//"));
            Assert.Empty(righe);
        }
    }

    [Fact]
    public void I_Multiplex_e_le_regole_di_impaginazione_non_ci_sono_piu()
    {
        foreach (var file in new[]
        {
            "Istanta/Controllers/MenaboController.cs", "Istanta/Controllers/FicoProcessController.cs", "Istanta/Models/IstantaCore.cs",
            "AgenziaLib/Trea.cs", "AgenziaLib/Tipi.cs", "Istanta/wwwroot/js/utility.js", "Istanta/wwwroot/js/revisore.js",
            "Istanta/ScriptAgenzia/navcove/agenzia.js", "Istanta/ScriptAgenzia/craiOvest/agenzia.js",
            "Istanta/ScriptAgenzia/Maiora/agenzia.js", "Istanta/ScriptAgenzia/gross/agenzia.js",
        })
        {
            Assert.DoesNotContain("multiplex", Sorgente(file), StringComparison.OrdinalIgnoreCase);
        }

        Assert.DoesNotContain("AutoImpaginazioneMeccanicaByRef", Sorgente("AgenziaLib/Trea.cs"));
        Assert.DoesNotContain("class listaSetRegole", Sorgente("Istanta/Models/IstantaCore.cs"));
        Assert.DoesNotContain("scriviRegolaMenabo", Sorgente("Istanta/wwwroot/js/addestramento.js"));
        Assert.DoesNotContain("ImpostaRegoleScheda", Sorgente("Istanta/Views/Tracciati/Training.cshtml"));
    }

    // L'unica versione di IdentificaMeccanicaRecord che qualcuno chiama (FicoProcessController) resta.
    [Fact]
    public void La_versione_viva_di_IdentificaMeccanicaRecord_resta()
    {
        var versioni = typeof(MenaboController).GetMethods().Where(m => m.Name == "IdentificaMeccanicaRecord").ToList();

        var unica = Assert.Single(versioni);
        Assert.Equal("ArticoloInRevisione", unica.GetParameters()[0].ParameterType.Name);
    }
}
