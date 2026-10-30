using AgenziaLib;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1175: all'importazione delle liste Coop un gruppo diventava linea con almeno 5 referenze e
/// almeno 3 prezzi promo diversi, in ogni area. Nelle aree A e A- bastano 4 referenze; nelle altre
/// restano 5. La stessa soglia vale per il gruppo soci che resta unito e per l'etichetta LINEA?? dei
/// Jolly e degli Sprint (decisione dell'utente: ovunque ci sia la regola 5 + 3).
/// </summary>
public class LineaAreeAeAMenoTests
{
    // Un gruppo di referenze con i prezzi promo dati, tutte con lo stesso tema.
    private static List<Dictionary<string, object>> Gruppo(string tema, params string[] prezzi) =>
        prezzi.Select(p => new Dictionary<string, object> { ["prezzo_promo"] = p, ["tema"] = tema }).ToList();

    [Theory]
    [InlineData("A", 4)]
    [InlineData("A-", 4)]
    [InlineData("B", 5)]
    [InlineData("B1", 5)]
    [InlineData("", 5)]
    public void La_soglia_e_4_in_A_e_A_meno_e_5_altrove(string area, int attesa)
    {
        Assert.Equal(attesa, Coopfi.MinimoElementiLinea(area));
    }

    [Theory]
    [InlineData("A", true)]
    [InlineData("A-", true)]
    [InlineData("B", false)]
    [InlineData("B1", false)]
    public void Quattro_referenze_con_tre_prezzi_sono_linea_solo_in_A_e_A_meno(string area, bool linea)
    {
        var gruppo = Gruppo("", "1,99", "2,49", "2,99", "2,99");

        Assert.Equal(linea, Coopfi.EUnaLinea(gruppo, area));
    }

    [Fact]
    public void Nelle_altre_aree_cinque_referenze_con_tre_prezzi_restano_linea()
    {
        Assert.True(Coopfi.EUnaLinea(Gruppo("", "1,99", "2,49", "2,99", "2,99", "1,99"), "B"));
    }

    [Theory]
    [InlineData("A")]
    [InlineData("A-")]
    public void Con_due_soli_prezzi_non_e_linea(string area)
    {
        Assert.False(Coopfi.EUnaLinea(Gruppo("", "1,99", "2,49", "2,49", "1,99"), area));
    }

    [Fact]
    public void Tre_referenze_in_A_non_sono_linea()
    {
        Assert.False(Coopfi.EUnaLinea(Gruppo("", "1,99", "2,49", "2,99"), "A"));
    }

    [Theory]
    [InlineData("JOLLY")]
    [InlineData("sprint settimana")]
    public void Jolly_e_Sprint_non_sono_linea(string tema)
    {
        Assert.False(Coopfi.EUnaLinea(Gruppo(tema, "1,99", "2,49", "2,99", "2,99"), "A"));
    }

    /* ---------- L'importazione intera (elaboraTracciatiRecords_do) su una lista finta ----------
       Referenze dello stesso settore, marchio, sottomarchio e reparto, senza prestazione: e' cosi' che
       l'importazione le mette nello stesso gruppo. Settore 10: non freschissimi, non no food. */

    private static List<Dictionary<string, object>> Lista(string tema, params string[] prezzi) =>
        prezzi.Select((p, i) => new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = (1001 + i).ToString(),
            [GLOBAL_VARIABLES_FICO.keyDescrizione2] = "MARCA PROVA",
            ["codice_settore"] = "10", ["codice_reparto"] = "20", ["codice_categoria"] = "C1",
            ["sottomarchio"] = "", ["prestazione"] = "",
            ["tema"] = tema, ["tipo_evento"] = "", ["prezzo_promo"] = p
        }).ToList();

    private static List<Dictionary<string, object>> Importa(List<Dictionary<string, object>> lista, string area) =>
        new Coopfi().elaboraTracciatiRecords_do(lista, new FicoRuntimeKit(), area);

    private static string CodiceGruppo(Dictionary<string, object> r) =>
        r.TryGetValue(GLOBAL_VARIABLES_FICO.keyCodiceGruppo, out var g) ? g?.ToString() ?? "" : "";

    [Theory]
    [InlineData("A", "x")]
    [InlineData("A-", "x")]
    [InlineData("B", "")]
    [InlineData("B1", "")]
    public void Importando_un_gruppo_di_4_con_3_prezzi_e_linea_solo_in_A_e_A_meno(string area, string isLinea)
    {
        var risultato = Importa(Lista("", "1,99", "2,49", "2,99", "2,99"), area);

        Assert.All(risultato, r => Assert.Equal("1001,1002,1003,1004", CodiceGruppo(r)));
        Assert.All(risultato, r => Assert.Equal(isLinea, r["is_linea"]?.ToString()));
    }

    [Fact]
    public void Importando_in_B_un_gruppo_di_5_con_3_prezzi_resta_linea()
    {
        var risultato = Importa(Lista("", "1,99", "2,49", "2,99", "2,99", "1,99"), "B");

        Assert.All(risultato, r => Assert.Equal("x", r["is_linea"]?.ToString()));
    }

    [Fact]
    public void Importando_in_A_un_gruppo_di_4_con_2_prezzi_non_e_linea()
    {
        var risultato = Importa(Lista("", "1,99", "2,49", "2,49", "1,99"), "A");

        Assert.All(risultato, r => Assert.Equal("", r["is_linea"]?.ToString()));
    }

    [Fact]
    public void Importando_in_A_un_gruppo_Jolly_di_4_con_3_prezzi_non_e_linea()
    {
        var risultato = Importa(Lista("JOLLY", "1,99", "2,49", "2,99", "2,99"), "A");

        Assert.All(risultato, r => Assert.Equal("1001,1002,1003,1004", CodiceGruppo(r)));
        Assert.All(risultato, r => Assert.Equal("", r["is_linea"]?.ToString()));
    }

    /// <summary>
    /// Il gruppo soci (tema NEW SOCI) di 4 referenze con 3 prezzi: in A resta unito ed e' una linea; in B
    /// si divide per prezzo come prima (le due da 2,99 insieme, le altre singole).
    /// </summary>
    [Fact]
    public void Il_gruppo_soci_di_4_con_3_prezzi_resta_unito_in_A_e_si_divide_in_B()
    {
        var inA = Importa(Lista("NEW SOCI", "1,99", "2,49", "2,99", "2,99"), "A");
        var inB = Importa(Lista("NEW SOCI", "1,99", "2,49", "2,99", "2,99"), "B");

        Assert.All(inA, r => Assert.Equal("1001,1002,1003,1004", CodiceGruppo(r)));
        Assert.All(inA, r => Assert.Equal("x", r["is_linea"]?.ToString()));

        Assert.Equal(new[] { "1001", "1002", "1003,1004", "1003,1004" }, inB.Select(CodiceGruppo));
        Assert.All(inB, r => Assert.Equal("", r["is_linea"]?.ToString()));
    }

    [Fact]
    public void L_importazione_e_le_altre_regole_usano_la_soglia_dell_area()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");

        // is_linea dell'importazione
        Assert.Contains("if (EUnaLinea(elementiGruppo, siglaAreaKit))\n                {\n                    //E' un linea\n" +
                        "                    elementiGruppo.ForEach(f => f[\"is_linea\"] = \"x\");", sorgente);
        // gruppo soci che resta unito
        Assert.Contains("(_sorgenteFiltrata.Count >= MinimoElementiLinea(siglaAreaKit) && (casistica != 1 || countVariazionePrezziPromo >= 3))", sorgente);
        // etichetta LINEA?? dei Jolly e degli Sprint
        Assert.Contains("if (recordsDelGruppo.Count >= MinimoElementiLinea(siglaAreaKit))", sorgente);
        // la vecchia soglia fissa non c'e' piu'
        Assert.DoesNotContain("elementiGruppo.Count >= 5", sorgente);
        Assert.DoesNotContain("recordsDelGruppo.Count >= 5", sorgente);
        Assert.DoesNotContain("(_sorgenteFiltrata.Count >= 5 && (casistica != 1", sorgente);
    }
}
