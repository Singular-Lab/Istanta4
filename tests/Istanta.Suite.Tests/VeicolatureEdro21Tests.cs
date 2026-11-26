using System.Text.RegularExpressions;
using AgenziaLib;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-e758bd95: "Mostra etichetta veicolata". I campi compilati portano, quando l'agenzia la
/// dichiara, la loro veicolatura: i campi del record da cui sono composti (CompiledField.veicolatoDa).
/// Edro21 la dichiara in ogni assignCompiledField; le altre agenzie no, e il loro JSON non cambia.
/// Il Plugin offre il pulsante solo se la configurazione dell'agenzia lo abilita.
/// </summary>
public class VeicolatureEdro21Tests
{
    /* ---- l'interprete ---- */

    [Fact]
    public void Il_campo_compilato_porta_la_veicolatura_dichiarata()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("prezzo_offerta", "stile", "1,99", VeicolatureEdro21.PrezzoOfferta);

        var campo = interprete.getFieldsValue("prezzo_offerta");
        Assert.Equal(new[] { "prezzo_offerta" }, campo.veicolatoDa);
    }

    [Fact]
    public void Senza_veicolatura_il_campo_resta_come_prima()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("descrizione", "stile", "Pasta");

        Assert.Null(interprete.getFieldsValue("descrizione").veicolatoDa);
    }

    [Fact]
    public void Un_contenuto_nuovo_prende_la_veicolatura_del_suo_ramo_anche_se_non_dichiarata()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("campo_offerta", "stile", "€ 2,49", VeicolatureEdro21.PrezzoAnziche);
        interprete.assignCompiledField("campo_offerta", "stile", "€ 1,99", VeicolatureEdro21.PrezzoOfferta);
        Assert.Equal(new[] { "prezzo_offerta" }, interprete.getFieldsValue("campo_offerta").veicolatoDa);

        interprete.assignCompiledField("campo_offerta", "stile", "testo");
        Assert.Null(interprete.getFieldsValue("campo_offerta").veicolatoDa);
    }

    [Fact]
    public void Voci_vuote_e_ripetute_si_tolgono()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("x", "", "v", new[] { "prezzo_offerta", "", " ", "prezzo_offerta", "sconto_MM" });
        Assert.Equal(new[] { "prezzo_offerta", "sconto_MM" }, interprete.getFieldsValue("x").veicolatoDa);
    }

    [Fact]
    public void Il_testo_fisso_e_un_elenco_vuoto_non_una_veicolatura_mancante()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("campo_offerta", "", "campo_offerta", VeicolatureEdro21.TestoFisso);
        var veicolatura = interprete.getFieldsValue("campo_offerta").veicolatoDa;
        Assert.NotNull(veicolatura);
        Assert.Empty(veicolatura);
    }

    [Fact]
    public void Il_clone_porta_la_veicolatura()
    {
        var interprete = new CompiledFieldInterpreter();
        interprete.assignCompiledField("sconto_norm", "s", "20", VeicolatureEdro21.ScontoMM);
        var clone = interprete.Clone();
        Assert.Equal(new[] { "sconto_MM" }, clone.getFieldsValue("sconto_norm").veicolatoDa);
    }

    /* ---- il JSON del campo compilato ---- */

    [Fact]
    public void Senza_veicolatura_il_JSON_del_campo_e_quello_di_prima()
    {
        var json = JsonConvert.SerializeObject(new CompiledField { labelName = "descrizione", paragraphName = "p", content = "c" });
        Assert.DoesNotContain("veicolatoDa", json);
    }

    [Fact]
    public void Con_la_veicolatura_il_JSON_la_porta_e_si_rilegge()
    {
        var json = JsonConvert.SerializeObject(new CompiledField { labelName = "PezzConf_NM", paragraphName = "p", content = "3 pezzi", veicolatoDa = new List<string> { "N_MM" } });
        var riletto = JsonConvert.DeserializeObject<CompiledField>(json)!;
        Assert.Equal(new[] { "N_MM" }, riletto.veicolatoDa);
    }

    /* ---- le regole condizionali di Edro21 ---- */

    [Theory]
    [InlineData("NM_MM", "N_MM")]
    [InlineData("NM_MIX_MM", "N_MM")]
    [InlineData("NM_FID", "N_FID")]
    [InlineData("NM_MIX_FID", "N_FID")]
    public void I_pezzi_della_meccanica_bis_vengono_dal_numero_della_meccanica(string combinazione, string pezzi)
    {
        Assert.Equal(new[] { "combinazioneAssegnata", pezzi, "Descrizioni.Descrizione4" }, VeicolatureEdro21.PezziMeccanicaBis(combinazione));
    }

    [Theory]
    [InlineData("TAGLIO_PREZZO")]
    [InlineData("")]
    [InlineData(null)]
    public void Fuori_dalle_meccaniche_bis_i_pezzi_dipendono_solo_dalla_meccanica(string? combinazione)
    {
        Assert.Equal(new[] { "combinazioneAssegnata" }, VeicolatureEdro21.PezziMeccanicaBis(combinazione));
    }

    [Fact]
    public void Lo_sconto_del_PoP_viene_dallo_sconto_fid_solo_con_le_meccaniche_fid()
    {
        Assert.Equal(new[] { "sconto_FID" }, VeicolatureEdro21.ScontoPoP("TAGLIO_FID"));
        Assert.Equal(new[] { "sconto_MM" }, VeicolatureEdro21.ScontoPoP("TAGLIO_MM"));
        Assert.Equal(new[] { "sconto_MM" }, VeicolatureEdro21.ScontoPoP(null!));
    }

    [Fact]
    public void I_nomi_sono_quelli_del_record()
    {
        Assert.Equal(new[] { "prezzo_anziche_kgl", "prezzo_offerta_kgl", "Descrizioni.Um", "Descrizioni.Peso" }, VeicolatureEdro21.PrezzoAlKgConSconto);
        Assert.Equal(new[] { "Descrizioni.Descrizione1", "Descrizioni.Descrizione2", "Descrizioni.Descrizione3", "Descrizioni.Descrizione4", "dicitura_reparto" },
            VeicolatureEdro21.Descrizione);
    }

    /* ---- Edro21.cs, sul sorgente ---- */

    [Fact]
    public void Ogni_campo_compilato_di_Edro21_dichiara_la_sua_veicolatura()
    {
        var righe = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Edro21.cs")).Replace("\r", "").Split('\n')
            .Where(r => r.Contains("assignCompiledField(") && !r.TrimStart().StartsWith("//")).ToList();

        Assert.True(righe.Count >= 150, "le chiamate attive sono " + righe.Count + ": il test va aggiornato");
        var senza = righe.Where(r => !Regex.IsMatch(r, @"assignCompiledField\(.*,\s*VeicolatureEdro21\.[A-Za-z0-9_]+(\([^;]*\))?\);")).ToList();
        Assert.True(senza.Count == 0, "senza veicolatura: " + string.Join(" | ", senza.Select(r => r.Trim())));
    }

    [Theory]
    [InlineData("\"prezzo_offerta\", paragraphName, recItem[\"prezzo_offerta\"].ToString(), VeicolatureEdro21.PrezzoOfferta")]
    [InlineData("\"sconto_norm\", paragraphName, sconto_norm, VeicolatureEdro21.ScontoMM")]
    [InlineData("\"campo_offerta\", paragraphName, campo_offerta, VeicolatureEdro21.PrezzoAnziche")]
    [InlineData("\"PezzConf_NM\", paragraphName, PezzConf_NM, VeicolatureEdro21.PezziMeccanicaBis(recItem[key_combinazioneAssegnata])")]
    [InlineData("\"descrizione\", descrizioneParagraphStyle, descrizione, VeicolatureEdro21.Descrizione")]
    public void Le_veicolature_seguono_il_contenuto(string chiamata)
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Edro21.cs"));
        Assert.Contains("assignCompiledField(" + chiamata + ");", sorgente);
    }

    [Fact]
    public void Le_altre_agenzie_non_dichiarano_veicolature()
    {
        foreach (var agenzia in new[] { "Coopfi", "Famila", "Pac", "Trea" })
        {
            var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/" + agenzia + ".cs"));
            Assert.DoesNotContain("Veicolature", sorgente);
        }
    }

    /* ---- la configurazione del pulsante ---- */

    [Fact]
    public void Il_pulsante_e_spento_di_default()
    {
        Assert.False(new AgenziaCustomPlugin().mostraEtichettaVeicolata);
    }

    [Fact]
    public void Edro21_accende_il_pulsante_e_le_altre_agenzie_no()
    {
        bool acceso(string agenzia)
        {
            string file = DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + agenzia + "/" + DbCustomPlugin.dbSourceName);
            return DbCustomPlugin.Load(Path.GetDirectoryName(file)!).DB.mostraEtichettaVeicolata;
        }

        Assert.True(acceso("Edro21"));
        Assert.False(acceso("Coopfi"));
        Assert.False(acceso("Famila"));
    }
}
