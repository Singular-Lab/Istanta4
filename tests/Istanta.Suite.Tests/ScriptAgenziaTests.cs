using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-997: quale archivio di agenzia serve a questa macchina.
///
/// Il nome del cliente arriva dall'ambiente e diventa un percorso, quindi le due cose che
/// contano sono che non ci si possa uscire dalla cartella e che la ricerca funzioni anche dove
/// il filesystem distingue maiuscole e minuscole - cioe' in produzione, che e' Linux, e non sul
/// portatile di chi sviluppa.
/// </summary>
public class ScriptAgenziaTests
{
    private static readonly string[] Cartelle = { "edro21", "coopfi", "famila", "Maiora", "craiOvest" };

    [Fact]
    public void Il_cliente_montato_trova_il_suo_archivio()
    {
        Assert.Equal("edro21", ScriptAgenzia.TrovaCartella(Cartelle, "edro21"));
    }

    [Theory]
    [InlineData("maiora", "Maiora")]
    [InlineData("MAIORA", "Maiora")]
    [InlineData("craiovest", "craiOvest")]
    public void La_ricerca_non_distingue_maiuscole_e_minuscole(string cliente, string atteso)
    {
        // ISTANTA_CLIENTE e' il nome in minuscolo, ma le cartelle storiche hanno grafie diverse.
        // Su macOS un confronto esatto sembrerebbe funzionare; su Linux no, e il file sparirebbe
        // solo in produzione.
        Assert.Equal(atteso, ScriptAgenzia.TrovaCartella(Cartelle, cliente));
    }

    [Fact]
    public void Un_cliente_senza_archivio_non_trova_niente()
    {
        Assert.Null(ScriptAgenzia.TrovaCartella(Cartelle, "conad"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Senza_cliente_non_si_cerca(string? cliente)
    {
        Assert.False(ScriptAgenzia.NomeAccettabile(cliente));
        Assert.Null(ScriptAgenzia.TrovaCartella(Cartelle, cliente));
    }

    [Theory]
    [InlineData("../../etc/passwd")]
    [InlineData("..")]
    [InlineData("edro21/../../altro")]
    [InlineData("cartella\\altra")]
    [InlineData("edro21 ")]
    [InlineData("edro21;rm")]
    public void Un_nome_che_esce_dalla_cartella_viene_rifiutato(string cliente)
    {
        // Il valore arriva dall'ambiente: senza questo controllo diventerebbe un modo per farsi
        // servire qualunque file della macchina.
        Assert.False(ScriptAgenzia.NomeAccettabile(cliente));
        Assert.Null(ScriptAgenzia.TrovaCartella(Cartelle, cliente));
    }

    [Theory]
    [InlineData("edro21")]
    [InlineData("crai-ovest")]
    [InlineData("crai_ovest")]
    [InlineData("Maiora")]
    public void Un_nome_normale_va_bene(string cliente)
    {
        Assert.True(ScriptAgenzia.NomeAccettabile(cliente));
    }

    [Fact]
    public void Senza_cartelle_non_si_trova_niente()
    {
        Assert.Null(ScriptAgenzia.TrovaCartella(null, "edro21"));
        Assert.Null(ScriptAgenzia.TrovaCartella(new string[0], "edro21"));
    }
}
