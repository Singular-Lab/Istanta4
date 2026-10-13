using System.Text.Json;
using Correggo4.Servizi;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// Il PolicyManager.CoopFi del Correggo originale: dai reparti che Olimpo associa all'utente (albero
/// `ruoli` di checkIdentity, come lo costruisce buildCoopfiPolicyFromCodeV2 di Fidelity) alla policy
/// di correzione di utenti_policy.
/// </summary>
public class PolicyManagerTests
{
    /// <summary>L'albero di Olimpo: un Settore (il ruolo) con i Reparti indicati, e un'Area sotto il primo.</summary>
    internal static JsonElement Ruoli(params string[] reparti)
    {
        var albero = new[]
        {
            new
            {
                nodeType = "Settore", nodeValue = "BC", codificaFICO = "BC",
                children = reparti.Select((r, i) => new
                {
                    nodeType = "Reparto", nodeValue = r, codificaFICO = r,
                    children = i == 0
                        ? new object[] { new { nodeType = "Area", nodeValue = "A1", codificaFICO = "A1", children = Array.Empty<object>() } }
                        : Array.Empty<object>()
                }).ToArray()
            }
        };
        return JsonSerializer.SerializeToElement(albero);
    }

    private static SchemaReferenza Prodotto(string settore, string reparto) =>
        SchemaReferenza.Leggi(JsonSerializer.Serialize(new
        {
            boxName = "box",
            itemRefStringfied = JsonSerializer.Serialize(new { codice_settore = settore, codice_reparto = reparto })
        }))!;

    // ------------------------------------------------------------------ parseGruppi

    [Fact]
    public void Un_reparto_conosciuto_da_i_suoi_settori_reparti()
    {
        var g = PolicyManager.ParseGruppi(Ruoli("OCFOPLSGS"));

        Assert.Equal(new[] { "56-03", "56-04" }, g.Valori);
        Assert.Empty(g.Ignorati);
        Assert.False(g.NessunoRiconosciuto);
    }

    [Fact]
    public void Piu_reparti_si_sommano_senza_ripetizioni()
    {
        var g = PolicyManager.ParseGruppi(Ruoli("GS", "OCFOPLSGS", "GV"));

        Assert.Equal(new[] { "56-03", "56-04", "52-01", "52-02" }, g.Valori);
    }

    [Fact]
    public void Un_reparto_sconosciuto_si_ignora()
    {
        var g = PolicyManager.ParseGruppi(Ruoli("GV", "MKTGANAP"));

        Assert.Equal(new[] { "52-01", "52-02" }, g.Valori);
        Assert.Equal(new[] { "MKTGANAP" }, g.Ignorati);
        Assert.False(g.NessunoRiconosciuto);
    }

    [Theory]
    [InlineData("MKTGANAP")]
    [InlineData("PRFICOM")]   // nel dizionario, ma senza valori
    public void Soli_reparti_non_riconosciuti_non_danno_niente(string reparto)
    {
        var g = PolicyManager.ParseGruppi(Ruoli(reparto));

        Assert.Empty(g.Valori);
        Assert.True(g.NessunoRiconosciuto);
    }

    [Fact]
    public void Senza_ruoli_nessun_reparto_e_nessun_rifiuto()
    {
        foreach (var ruoli in new[] { default, JsonSerializer.SerializeToElement(Array.Empty<object>()), Ruoli() })
        {
            var g = PolicyManager.ParseGruppi(ruoli);
            Assert.Empty(g.Valori);
            Assert.False(g.NessunoRiconosciuto);
        }
    }

    [Fact]
    public void Il_dizionario_ha_58_05_senza_spazio_e_66_06_com_era()
    {
        Assert.Contains("58-05", PolicyManager.Reparti["GSPEFO"]);
        Assert.Contains("58-05", PolicyManager.Reparti["FRSS"]);
        Assert.DoesNotContain(PolicyManager.Reparti.Values.SelectMany(v => v), v => v != v.Trim());
        Assert.Equal(new[] { "58-01", "66-06" }, PolicyManager.Reparti["OF"]);
    }

    // ------------------------------------------------------------------ create

    [Fact]
    public void Senza_valori_nessuna_policy()
    {
        Assert.Null(PolicyManager.Crea(Array.Empty<string>()));
    }

    [Fact]
    public void La_policy_generata_si_rilegge_e_limita_ai_settori_reparti()
    {
        var creata = PolicyManager.Crea(new[] { "56-03", "66" })!;
        var policy = PolicyCorrezione.Leggi(PolicyManager.Json(creata))!;

        Assert.Equal(1, policy.MinVersion);
        Assert.Equal(2, policy.Regole.Count);
        Assert.True(policy.Check(Prodotto("56", "03"), 1));
        Assert.True(policy.Check(Prodotto("66", "99"), 1));    // "66": solo settore, ogni reparto
        Assert.False(policy.Check(Prodotto("56", "04"), 1));
        Assert.False(policy.Check(Prodotto("52", "03"), 1));
        foreach (string t in PolicyManager.TimbriDimensione)
            Assert.False(policy.StrumentoPermesso("timbro", t));
        Assert.True(policy.StrumentoPermesso("timbro", "_1_2_elimina"));
    }

    [Fact]
    public void Il_json_usa_i_nomi_dell_originale()
    {
        string json = PolicyManager.Json(PolicyManager.Crea(new[] { "56-03" })!);

        using var d = JsonDocument.Parse(json);
        var regola = d.RootElement.GetProperty("regole")[0][1];
        Assert.Equal("codice_reparto", regola.GetProperty("field").GetString());
        Assert.True(regola.GetProperty("inclusione").GetBoolean());
        Assert.Equal("03", regola.GetProperty("valori")[0].GetString());
        Assert.Equal("timbro", d.RootElement.GetProperty("tool")[0].GetProperty("tipo").GetString());
        Assert.Equal(1, d.RootElement.GetProperty("minVersion").GetInt32());
    }
}
