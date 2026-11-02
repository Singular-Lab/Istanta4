using AgenziaLib;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1179: all'importazione delle liste Coop un gruppo e' tutto in volantino o tutto fuori. Se le
/// sue referenze hanno esattamente due prezzi promo, resta in volantino il prezzo che vince - quello
/// compilato se l'altro e' 0, altrimenti quello con piu' referenze, a parita' quello della prima in
/// lista - e le altre diventano singoli fuori volantino (campo core). Non valgono per soci (si
/// dividono per prezzo come prima), Jolly e Sprint, ne' per i gruppi gia' fuori volantino dal tema, ne'
/// per i freschissimi da 5 in su fuori dall'area A, che il gruppo non lo formano.
/// </summary>
public class GruppiDuePrezziCoopTests
{
    private static List<Dictionary<string, object>> Prezzi(params string[] prezzi) =>
        prezzi.Select((p, i) => new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = (1001 + i).ToString(),
            ["prezzo_promo"] = p,
        }).ToList();

    private static string[] Codici(IEnumerable<Dictionary<string, object>> records) =>
        records.Select(r => r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString()!).ToArray();

    /* ---- chi resta e chi esce ---- */

    [Fact]
    public void Due_referenze_con_prezzi_diversi_esce_la_seconda()
    {
        Assert.Equal(new[] { "1002" }, Codici(Coopfi.ElementiFuoriVolantinoDelGruppo(Prezzi("2,20", "3,50"))));
        Assert.Equal(new[] { "1002" }, Codici(Coopfi.ElementiFuoriVolantinoDelGruppo(Prezzi("3,50", "2,20"))));
    }

    [Theory]
    [InlineData("0", "3,50")]
    [InlineData("", "3,50")]
    public void Con_un_prezzo_a_zero_esce_quello_a_zero(string primo, string secondo)
    {
        Assert.Equal(new[] { "1001" }, Codici(Coopfi.ElementiFuoriVolantinoDelGruppo(Prezzi(primo, secondo))));
    }

    [Fact]
    public void Resta_il_prezzo_con_piu_referenze()
    {
        //L'esempio della issue: quattro a 2,20 e due a 3,50.
        var gruppo = Prezzi("3,50", "2,20", "2,20", "3,50", "2,20", "2,20");
        Assert.Equal(new[] { "1001", "1004" }, Codici(Coopfi.ElementiFuoriVolantinoDelGruppo(gruppo)));
    }

    [Fact]
    public void Il_prezzo_compilato_vince_anche_se_in_minoranza()
    {
        var gruppo = Prezzi("3,50", "0", "0", "3,50", "0", "0");
        Assert.Equal(new[] { "1002", "1003", "1005", "1006" }, Codici(Coopfi.ElementiFuoriVolantinoDelGruppo(gruppo)));
    }

    [Fact]
    public void A_parita_vince_il_prezzo_della_prima_in_lista()
    {
        Assert.Equal(new[] { "1002", "1004" }, Codici(Coopfi.ElementiFuoriVolantinoDelGruppo(Prezzi("3,50", "2,20", "3,50", "2,20"))));
    }

    [Theory]
    [InlineData("2,20", "2,20", "2,20")]
    [InlineData("1,99", "2,49", "2,99")]
    [InlineData("0", "", "0")]
    public void Con_un_prezzo_o_con_tre_non_esce_nessuno(params string[] prezzi)
    {
        Assert.Empty(Coopfi.ElementiFuoriVolantinoDelGruppo(Prezzi(prezzi)));
    }

    [Fact]
    public void Un_gruppo_vuoto_o_di_una_referenza_non_ha_niente_da_togliere()
    {
        Assert.Empty(Coopfi.ElementiFuoriVolantinoDelGruppo(null!));
        Assert.Empty(Coopfi.ElementiFuoriVolantinoDelGruppo(Prezzi("2,20")));
    }

    /* ---- l'importazione (elaboraTracciatiRecords_do) su una lista finta ----
       Stesso settore, marchio, sottomarchio e reparto, senza prestazione: l'importazione le mette nello
       stesso gruppo, come in LineaAreeAeAMenoTests. */

    private static List<Dictionary<string, object>> Lista(string tema, string settore, params string[] prezzi) =>
        prezzi.Select((p, i) => new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = (1001 + i).ToString(),
            [GLOBAL_VARIABLES_FICO.keyDescrizione2] = "MARCA PROVA",
            ["codice_settore"] = settore, ["codice_reparto"] = "20", ["codice_categoria"] = "C1",
            ["sottomarchio"] = "", ["prestazione"] = "",
            ["tema"] = tema, ["tipo_evento"] = "", ["prezzo_promo"] = p
        }).ToList();

    private static List<Dictionary<string, object>> Importa(List<Dictionary<string, object>> lista, string area) =>
        new Coopfi().elaboraTracciatiRecords_do(lista, new FicoRuntimeKit(), area);

    private static string CodiceGruppo(Dictionary<string, object> r) =>
        r.TryGetValue(GLOBAL_VARIABLES_FICO.keyCodiceGruppo, out var g) ? g?.ToString() ?? "" : "";

    private static bool InVolantino(Dictionary<string, object> r) =>
        StatoVolantino.InVolantino(r, Coopfi.RegolaPrecedenteInVolantino);

    [Theory]
    [InlineData("B")]
    [InlineData("A")]
    public void Il_gruppo_di_due_si_scioglie_e_la_seconda_va_fuori_volantino(string area)
    {
        var lista = Importa(Lista("NATALE", "10", "2,20", "3,50"), area);

        Assert.Equal(new[] { "1001", "1002" }, lista.Select(CodiceGruppo));
        Assert.True(InVolantino(lista[0]));
        Assert.False(InVolantino(lista[1]));
    }

    [Fact]
    public void Il_gruppo_di_sei_tiene_la_maggioranza_e_le_altre_sono_singoli_fuori_volantino()
    {
        var lista = Importa(Lista("NATALE", "10", "3,50", "2,20", "2,20", "3,50", "2,20", "2,20"), "B");

        Assert.Equal(new[] { "1001", "1002,1003,1005,1006", "1002,1003,1005,1006", "1004", "1002,1003,1005,1006", "1002,1003,1005,1006" },
            lista.Select(CodiceGruppo));
        Assert.Equal(new[] { false, true, true, false, true, true }, lista.Select(InVolantino));
    }

    [Theory]
    [InlineData("JOLLY")]
    [InlineData("SPRINT")]
    [InlineData("PIU VALORE SOCI")]
    public void Jolly_Sprint_e_soci_non_mandano_fuori_nessuno(string tema)
    {
        var lista = Importa(Lista(tema, "10", "2,20", "2,20", "3,50"), "B");

        Assert.All(lista, r => Assert.True(InVolantino(r)));
    }

    [Fact]
    public void I_soci_continuano_a_dividersi_per_prezzo()
    {
        var lista = Importa(Lista("PIU VALORE SOCI", "10", "2,20", "2,20", "3,50", "3,50"), "B");

        Assert.Equal(new[] { "1001,1002", "1001,1002", "1003,1004", "1003,1004" }, lista.Select(CodiceGruppo));
        Assert.All(lista, r => Assert.True(InVolantino(r)));
    }

    [Fact]
    public void Un_gruppo_gia_fuori_volantino_dal_tema_resta_intero()
    {
        var lista = Importa(Lista("FUORI DEPLIANT FOOD (OS25B)", "10", "2,20", "3,50", "3,50"), "B");

        Assert.All(lista, r => Assert.Equal("1001,1002,1003", CodiceGruppo(r)));
        Assert.All(lista, r => Assert.False(r.ContainsKey(GLOBAL_VARIABLES_FICO.keyInVolantino)));
    }

    [Theory]
    [InlineData("2,20", "3,50", "1002")]
    [InlineData("0", "3,50", "1001")]
    public void Nei_freschissimi_di_due_esce_chi_perde(string primo, string secondo, string fuori)
    {
        var lista = Importa(Lista("NATALE", "58", primo, secondo), "B");

        //Due singoli: il codice gruppo e' il proprio, o nessuno (lo completa poi l'importazione).
        Assert.All(lista, r => Assert.Contains(CodiceGruppo(r), new[] { "", r[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() }));
        Assert.Equal(new[] { fuori }, Codici(lista.Where(r => !InVolantino(r))));
    }

    [Fact]
    public void I_freschissimi_da_cinque_fuori_da_A_restano_come_prima()
    {
        var lista = Importa(Lista("NATALE", "58", "2,20", "2,20", "2,20", "3,50", "3,50"), "B");

        Assert.All(lista, r => Assert.True(InVolantino(r)));
        Assert.All(lista, r => Assert.Equal("", CodiceGruppo(r)));
    }

    [Fact]
    public void I_freschissimi_da_cinque_in_A_tengono_la_maggioranza()
    {
        var lista = Importa(Lista("NATALE", "58", "2,20", "2,20", "2,20", "3,50", "3,50"), "A");

        Assert.Equal(new[] { true, true, true, false, false }, lista.Select(InVolantino));
        Assert.Equal(new[] { "1004", "1005" }, lista.Skip(3).Select(CodiceGruppo));
        Assert.All(lista.Take(3), r => Assert.Equal(new[] { "1001", "1002", "1003" }, CodiceGruppo(r).Split(',').OrderBy(c => c)));
    }

    /* ---- il ricalcolo finale dello stato in volantino ---- */

    [Fact]
    public void Il_fuori_volantino_dei_gruppi_non_lo_cancella_il_ricalcolo_dal_tema()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");
        Assert.Contains("if (StatoVolantino.Leggi(rec) != false)\n                        rec[GLOBAL_VARIABLES_FICO.keyInVolantino] = RegolaPrecedenteInVolantino(rec);", sorgente);
    }
}
