using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-986: come si confrontano i codici durante il ricollegamento.
///
/// Il codice gruppo e' una lista separata da virgole. Le ricerche principali del ricollegamento
/// ignorano maiuscole e minuscole, ma due controlli lo facevano in modo diverso: lo stesso codice
/// poteva risultare presente in un passaggio e inesistente in quello dopo, e finire cosi'
/// nell'elenco di quelli da clonare. Qui si fissa la regola unica.
/// </summary>
public class RicollegamentoCodiciTests
{
    [Fact]
    public void Il_codice_si_riconosce_dentro_al_gruppo()
    {
        Assert.True(Istanta.Utility.Main.gruppoContieneCodice("6119227,6119231", "6119231"));
        Assert.True(Istanta.Utility.Main.gruppoContieneCodice("6119227", "6119227"));
    }

    [Fact]
    public void Maiuscole_e_minuscole_non_cambiano_il_codice()
    {
        Assert.True(Istanta.Utility.Main.gruppoContieneCodice("AB12,CD34", "ab12"));
        Assert.True(Istanta.Utility.Main.gruppoContieneCodice("ab12,cd34", "AB12"));
    }

    // Il pericolo del confronto per sottostringa: 100 comparirebbe dentro 1001, e il gruppo
    // sbagliato verrebbe dato per buono.
    [Fact]
    public void Un_codice_non_e_un_pezzo_di_un_altro()
    {
        Assert.False(Istanta.Utility.Main.gruppoContieneCodice("1001,1002", "100"));
        Assert.False(Istanta.Utility.Main.gruppoContieneCodice("6119227", "61192"));
    }

    [Fact]
    public void Gli_spazi_intorno_al_codice_non_contano()
    {
        Assert.True(Istanta.Utility.Main.gruppoContieneCodice("6119227, 6119231", "6119231"));
        Assert.True(Istanta.Utility.Main.gruppoContieneCodice("6119227,6119231", " 6119231 "));
    }

    [Fact]
    public void Niente_non_e_mai_contenuto()
    {
        Assert.False(Istanta.Utility.Main.gruppoContieneCodice(null, "6119227"));
        Assert.False(Istanta.Utility.Main.gruppoContieneCodice("6119227", null));
        Assert.False(Istanta.Utility.Main.gruppoContieneCodice("", ""));
    }

    [Fact]
    public void Restano_solo_i_codici_che_nessun_gruppo_copre()
    {
        var restano = Istanta.Utility.Main.codiciNonCoperti(
            new[] { "100", "200", "300" },
            new[] { "100,200" });

        Assert.Equal(new[] { "300" }, restano);
    }

    [Fact]
    public void La_sottrazione_ignora_maiuscole_e_minuscole()
    {
        var restano = Istanta.Utility.Main.codiciNonCoperti(
            new[] { "ab12", "cd34" },
            new[] { "AB12" });

        Assert.Equal(new[] { "cd34" }, restano);
    }

    [Fact]
    public void Senza_gruppi_presenti_non_si_sottrae_niente()
    {
        var restano = Istanta.Utility.Main.codiciNonCoperti(new[] { "100", "200" }, null);

        Assert.Equal(new[] { "100", "200" }, restano);
    }

    [Fact]
    public void Senza_codici_non_resta_niente()
    {
        Assert.Empty(Istanta.Utility.Main.codiciNonCoperti(null, new[] { "100" }));
    }
}
