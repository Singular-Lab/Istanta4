using AgenziaLib;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop il cartello singolo di una referenza in gruppo che usa la propria descrizione ha solo la
/// propria foto. Ogni membro ereditava la foto della primaria (Foto.Nome) e l'elenco di tutte le foto del
/// gruppo (membriGruppoFoto) per il cartello di gruppo, che nasce copiando il record, e i singoli uscivano
/// con tutte le foto del gruppo. Il cartello di gruppo, i singoli con la descrizione di gruppo e quelli
/// che ripetono per intero il cartello di gruppo tengono le foto del gruppo; negli A7 niente foto.
/// </summary>
public class PopCoopFotoDelSingoloTests
{
    private static Dictionary<string, object> Membro(List<FotoElementoGruppo> fotoDelGruppo) => new()
    {
        [GLOBAL_VARIABLES_FICO.keyRefCodice] = "7793828",
        [GLOBAL_VARIABLES_FICO.keyFotoNome] = "7793827.jpg",
        [GLOBAL_VARIABLES_FICO.keyFotoHash] = "3EB97E4B",
        [GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = fotoDelGruppo
    };

    private static List<FotoElementoGruppo> FotoDelGruppo() => new()
    {
        new FotoElementoGruppo { codRef = "7793827", nomeFoto = "7793827.jpg", statoSelezione = 1, hash = "E6FF0D08" },
        new FotoElementoGruppo { codRef = "7793828", nomeFoto = "7793828.jpg", statoSelezione = 2, hash = "3EB97E4B" },
        new FotoElementoGruppo { codRef = "7793838", nomeFoto = "7793838.jpg", statoSelezione = 2, hash = "FFBB983A" }
    };

    [Fact]
    public void Il_singolo_ha_solo_la_propria_foto_come_primaria()
    {
        var gruppo = FotoDelGruppo();
        var record = Membro(gruppo);

        Coopfi.fotoDelSingolo(record, "7793828.jpg");

        Assert.Equal("7793828.jpg", record[GLOBAL_VARIABLES_FICO.keyFotoNome]);
        var foto = Assert.Single((List<FotoElementoGruppo>)record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto]);
        Assert.Equal("7793828", foto.codRef);
        Assert.Equal("7793828.jpg", foto.nomeFoto);
        Assert.Equal(1, foto.statoSelezione);
        Assert.Equal("3EB97E4B", foto.hash);

        //L'elenco del gruppo, condiviso fra i membri e usato dal cartello di gruppo, resta com'era.
        Assert.Equal(3, gruppo.Count);
        Assert.NotSame(gruppo, record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto]);
    }

    [Fact]
    public void Una_referenza_senza_foto_resta_senza_foto()
    {
        var record = Membro(FotoDelGruppo());

        Coopfi.fotoDelSingolo(record, "");

        Assert.Equal("", record[GLOBAL_VARIABLES_FICO.keyFotoNome]);
        Assert.Empty((List<FotoElementoGruppo>)record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto]);
    }

    [Fact]
    public void Chi_ripete_per_intero_il_cartello_di_gruppo_ne_prende_anche_le_foto()
    {
        Assert.Contains(GLOBAL_VARIABLES_FICO.keyFotoNome, Coopfi.chiaviDelCartelloDiGruppo);
        Assert.Contains(GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto, Coopfi.chiaviDelCartelloDiGruppo);
    }

    [Fact]
    public void Nel_PoP_la_foto_propria_si_conserva_prima_dell_eredita_e_si_rimette_dopo_il_cartello_di_gruppo()
    {
        string coop = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        string pop = coop.Substring(inizio, coop.IndexOf("public TracciatoResultKit esportaVolantino(", inizio, StringComparison.Ordinal) - inizio);

        int conservata = pop.IndexOf("string fotoPropriaDelSingolo = recItem.TryGetValue(GLOBAL_VARIABLES_FICO.keyFotoNome", StringComparison.Ordinal);
        int ereditata = pop.IndexOf("recItem[GLOBAL_VARIABLES_FICO.keyFotoNome] = curr_fotoPgroup_processed;", StringComparison.Ordinal);
        Assert.True(conservata > 0 && conservata < ereditata, "la foto propria si conserva prima dell'eredita'");

        //Solo con la propria descrizione: la regola dei singoli con la descrizione di gruppo la spegne.
        int regola = pop.IndexOf("if (singoloConDescrizioneDiGruppo(codice_referenza != codice_gruppo,", StringComparison.Ordinal);
        Assert.True(pop.IndexOf("singoloConLaPropriaDescrizione = false;", regola, StringComparison.Ordinal) > regola);

        int rimessa = pop.IndexOf("fotoDelSingolo(recItem, fotoPropriaDelSingolo);", StringComparison.Ordinal);
        Assert.Contains("if (codice_referenza != codice_gruppo && singoloConLaPropriaDescrizione)", pop);
        Assert.True(rimessa > pop.IndexOf("_cartelliDiGruppo[codice_gruppo] = artInKit.sottogruppo;", StringComparison.Ordinal), "dopo la creazione del cartello di gruppo");
        Assert.True(pop.IndexOf("togliFotoProdottoSeA7(recItem, formatoKit);", rimessa, StringComparison.Ordinal) > rimessa, "negli A7 resta senza foto");
        Assert.True(rimessa < pop.IndexOf("ripetiIlCartelloDiGruppo(recItem, cartelloDiGruppo);", StringComparison.Ordinal), "prima della copia per intero del cartello di gruppo");
    }
}
