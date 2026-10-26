using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.RegularExpressions;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1023: Istanta in locale carica AgenziaLib da Istanta/wwwroot/external_lib/, e quella DLL
/// sta in git. La build di AgenziaLib non la aggiorna da sola: era rimasta al 21/09, prima che
/// I20-990 desse a CompiledFieldInterpreter finalizeFields e i controlli sui campi, e chi girava
/// con lei vedeva prezzo_offerta sia fra i campi compilati sia fra gli eliminati, pur con il
/// sorgente gia' corretto.
/// Qui si confronta la DLL committata con il sorgente: ogni metodo di CompiledFieldInterpreter
/// deve esserci. Se il test fallisce, la DLL va ricompilata e ricommittata.
/// </summary>
public class DllAgenziaLibTests
{
    [Fact]
    public void La_dll_committata_ha_tutti_i_metodi_di_CompiledFieldInterpreter()
    {
        var metodiNelSorgente = MetodiPubbliciNelSorgente(File.ReadAllText(TrovaFile("AgenziaLib/CompiledFieldInterpreter.cs")));
        var metodiNellaDll = MetodiDelTipoNellaDll(TrovaFile("Istanta/wwwroot/external_lib/AgenziaLib.dll"), "AgenziaLib", "CompiledFieldInterpreter");

        // I metodi che servono a I20-990 e a questo task, perche' il confronto non passi a vuoto.
        Assert.Contains("finalizeFields", metodiNelSorgente);
        Assert.Contains("compiledContainsKey", metodiNelSorgente);
        Assert.Contains("deletedContainsKey", metodiNelSorgente);

        var mancanti = metodiNelSorgente.Except(metodiNellaDll).ToList();
        Assert.True(mancanti.Count == 0,
            "La AgenziaLib.dll in Istanta/wwwroot/external_lib/ e' piu' vecchia del sorgente: mancano " +
            string.Join(", ", mancanti) + ". Ricompilarla (dotnet build AgenziaLib.csproj -c Release) e ricommitterla.");
    }

    [Fact]
    public void La_dll_committata_passa_il_SourceCustomPlugin_al_filtro_del_conteggio()
    {
        // I20-1051: Istanta riempie pathCustomPlugin per nome. Con la DLL di prima il metodo ha due
        // soli parametri, la chiamata riesce lo stesso e il conteggio resta sul filtro vecchio.
        var parametri = ParametriDelMetodoNellaDll(
            TrovaFile("Istanta/wwwroot/external_lib/AgenziaLib.dll"), "AgenziaLib", "Edro21", "FiltraRecordsPerConteggioRevisione");

        Assert.Equal(new[] { "records", "utente", "pathCustomPlugin" }, parametri);
    }

    private static List<string> ParametriDelMetodoNellaDll(string percorsoDll, string spazioDeiNomi, string nomeTipo, string nomeMetodo)
    {
        using var flusso = File.OpenRead(percorsoDll);
        using var pe = new PEReader(flusso);
        var metadati = pe.GetMetadataReader();

        var tipo = metadati.TypeDefinitions
            .Select(metadati.GetTypeDefinition)
            .Single(t => metadati.GetString(t.Namespace) == spazioDeiNomi && metadati.GetString(t.Name) == nomeTipo);

        var metodo = tipo.GetMethods()
            .Select(metadati.GetMethodDefinition)
            .Single(m => metadati.GetString(m.Name) == nomeMetodo);

        return metodo.GetParameters()
            .Select(metadati.GetParameter)
            .OrderBy(p => p.SequenceNumber)
            .Where(p => p.SequenceNumber > 0)
            .Select(p => metadati.GetString(p.Name))
            .ToList();
    }

    private static HashSet<string> MetodiPubbliciNelSorgente(string sorgente)
    {
        // "public void finalizeFields()", "public CompiledField getFieldsValue(string labelName)"...
        // Il costruttore e i membri della classe annidata fields non sono metodi di questo tipo.
        return Regex.Matches(sorgente, @"^\s*public\s+(?!class\b)[\w<>\.\[\]]+\s+(\w+)\s*\(", RegexOptions.Multiline)
            .Select(m => m.Groups[1].Value)
            .ToHashSet();
    }

    private static HashSet<string> MetodiDelTipoNellaDll(string percorsoDll, string spazioDeiNomi, string nomeTipo)
    {
        using var flusso = File.OpenRead(percorsoDll);
        using var pe = new PEReader(flusso);
        var metadati = pe.GetMetadataReader();

        var tipo = metadati.TypeDefinitions
            .Select(metadati.GetTypeDefinition)
            .Single(t => metadati.GetString(t.Namespace) == spazioDeiNomi && metadati.GetString(t.Name) == nomeTipo);

        return tipo.GetMethods()
            .Select(h => metadati.GetString(metadati.GetMethodDefinition(h).Name))
            .ToHashSet();
    }

    internal static string TrovaFile(string relativo)
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

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
