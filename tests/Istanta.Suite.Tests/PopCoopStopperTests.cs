using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-2c279c12: le regole degli stopper (gli A7) del PoP Coop. Le linee sotto le 10 referenze escono solo a
/// singoli, senza cartello linea; da 10 in su con 10 cartelli linea, come prima. I gruppi normali con prezzo e
/// grammatura uguali escono con una copia del cartello di gruppo per referenza, senza cartello di gruppo in piu';
/// con prezzi o grammature diversi solo a singoli. I gruppi con vari/varie, a qualunque prezzo, e quelli dei
/// settori 58/56 restano come prima. Gli A3 non cambiano.
/// </summary>
public class PopCoopStopperTests
{
    private const string A7 = "A7";
    private const string A3V = "A3_VERTICALI";

    private static Coopfi.CartelliDelGruppoA7 Regola(string formato = A7, bool inGruppo = true, bool linea = false, bool lineaDa10InSu = false,
        bool prezziDiversi = false, bool pesiDiversi = false, bool vari = false, bool settore58 = false) =>
        Coopfi.cartelliDelGruppoNegliA7(formato, inGruppo, linea, lineaDa10InSu, prezziDiversi, pesiDiversi, vari, settore58);

    /* ---- la regola ---- */

    [Fact]
    public void Un_gruppo_con_prezzo_e_grammatura_uguali_esce_a_copie_del_cartello_di_gruppo()
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.SoloCopieDelGruppo, Regola());
    }

    [Fact]
    public void Un_gruppo_con_prezzi_diversi_esce_a_soli_singoli()
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.SoloSingoli, Regola(prezziDiversi: true));
    }

    [Fact]
    public void Un_gruppo_con_lo_stesso_prezzo_e_grammature_diverse_esce_a_soli_singoli()
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.SoloSingoli, Regola(pesiDiversi: true));
    }

    [Fact]
    public void Una_linea_sotto_le_10_referenze_esce_a_soli_singoli()
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.SoloSingoli, Regola(linea: true));
        //Anche a prezzo unico: la linea non diventa copie del cartello di gruppo.
        Assert.Equal(Coopfi.CartelliDelGruppoA7.SoloSingoli, Regola(linea: true, prezziDiversi: false));
    }

    [Fact]
    public void Una_linea_da_10_in_su_esce_come_prima()
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(linea: true, lineaDa10InSu: true));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void I_gruppi_con_vari_o_varie_restano_come_prima_a_qualunque_prezzo(bool prezziDiversi)
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(vari: true, prezziDiversi: prezziDiversi));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void I_gruppi_dei_settori_58_e_56_restano_come_prima(bool prezziDiversi)
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(settore58: true, prezziDiversi: prezziDiversi));
        Assert.True(Coopfi.singoliComeIlGruppo("58", "03"));
    }

    [Fact]
    public void Gli_A3_e_le_referenze_fuori_gruppo_non_cambiano()
    {
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(formato: A3V));
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(formato: "A3_ORIZZONTALI", prezziDiversi: true));
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(formato: A3V, linea: true));
        Assert.Equal(Coopfi.CartelliDelGruppoA7.ComePrima, Regola(inGruppo: false));
    }

    /* ---- i cartelli che escono ---- */

    private sealed record Referenza(string Codice, string Gruppo, decimal Prezzo = 1.99m, decimal Peso = 0.5m, bool Linea = false, bool Vari = false);

    // Il ciclo di esportaPoP negli A7 ridotto ai cartelli: per ogni referenza che esce, il suo cartello e, per la prima
    // del gruppo, il cartello di gruppo quando esce.
    private static List<string> Cartelli(params Referenza[] referenze)
    {
        var cartelliDellaLinea = Coopfi.CartelliDellaLinea.PerFormato(A7);
        var cartelliDiGruppo = new HashSet<string>();
        var usciti = new List<string>();
        foreach (var r in referenze)
        {
            var gruppo = referenze.Where(g => g.Gruppo == r.Gruppo).ToList();
            bool inGruppo = r.Codice != r.Gruppo;
            bool lineaDa10InSu = r.Linea && gruppo.Count >= 10;
            bool prezziDiversi = gruppo.Select(g => g.Prezzo).Distinct().Count() > 1;
            bool pesiDiversi = gruppo.Select(g => g.Peso).Distinct().Count() > 1;
            if (lineaDa10InSu && cartelliDellaLinea.Salta(r.Gruppo))
                continue;
            var regola = Coopfi.cartelliDelGruppoNegliA7(A7, inGruppo, r.Linea, lineaDa10InSu, prezziDiversi, pesiDiversi, r.Vari, false);
            bool gustiVariAPrezzoUnico = r.Vari && !prezziDiversi;
            bool eludi = regola == Coopfi.CartelliDelGruppoA7.SoloSingoli;
            if (!eludi && inGruppo && !lineaDa10InSu && !gustiVariAPrezzoUnico && cartelliDiGruppo.Add(r.Gruppo)
                && regola != Coopfi.CartelliDelGruppoA7.SoloCopieDelGruppo)
                usciti.Add("gruppo " + r.Gruppo);
            if (regola == Coopfi.CartelliDelGruppoA7.SoloCopieDelGruppo)
                usciti.Add("copia " + r.Gruppo);
            else if (lineaDa10InSu)
                usciti.Add("linea " + r.Gruppo);
            else
                usciti.Add(r.Codice);
        }
        return usciti;
    }

    private static Referenza[] Gruppo(string gruppo, int referenze, Func<int, decimal>? prezzo = null, Func<int, decimal>? peso = null, bool linea = false, bool vari = false) =>
        Enumerable.Range(1, referenze).Select(i => new Referenza($"{gruppo}-{i}", gruppo, prezzo?.Invoke(i) ?? 1.99m, peso?.Invoke(i) ?? 0.5m, linea, vari)).ToArray();

    [Fact]
    public void Tre_gusti_allo_stesso_prezzo_danno_tre_copie_del_cartello_di_gruppo()
    {
        Assert.Equal(new[] { "copia G", "copia G", "copia G" }, Cartelli(Gruppo("G", 3)));
    }

    [Fact]
    public void Tre_referenze_a_prezzi_diversi_danno_tre_singoli_senza_cartello_di_gruppo()
    {
        Assert.Equal(new[] { "G-1", "G-2", "G-3" }, Cartelli(Gruppo("G", 3, prezzo: i => i)));
    }

    [Fact]
    public void Lo_stesso_prezzo_con_pesi_diversi_da_i_singoli()
    {
        Assert.Equal(new[] { "G-1", "G-2" }, Cartelli(Gruppo("G", 2, peso: i => i * 0.5m)));
    }

    [Fact]
    public void Una_linea_da_9_da_9_singoli_e_nessun_cartello_linea()
    {
        var usciti = Cartelli(Gruppo("L", 9, linea: true));
        Assert.Equal(9, usciti.Count);
        Assert.DoesNotContain(usciti, c => c.StartsWith("gruppo") || c.StartsWith("linea") || c.StartsWith("copia"));
    }

    [Fact]
    public void Una_linea_da_12_da_10_cartelli_linea()
    {
        var usciti = Cartelli(Gruppo("L", 12, linea: true));
        Assert.Equal(Enumerable.Repeat("linea L", 10), usciti);
    }

    [Fact]
    public void Gusti_vari_allo_stesso_prezzo_restano_un_cartello_per_referenza_senza_cartello_di_gruppo()
    {
        Assert.Equal(new[] { "V-1", "V-2", "V-3", "V-4" }, Cartelli(Gruppo("V", 4, vari: true)));
    }

    [Fact]
    public void Gusti_vari_a_prezzi_diversi_restano_cartello_di_gruppo_piu_singoli()
    {
        Assert.Equal(new[] { "gruppo V", "V-1", "V-2", "V-3", "V-4" }, Cartelli(Gruppo("V", 4, prezzo: i => i, vari: true)));
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void EsportaPoP_applica_la_regola_degli_stopper_nei_punti_giusti()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        string pop = coop.Substring(inizio, fine - inizio);
        string volantino = coop.Substring(fine);
        int Pos(string frammento)
        {
            int p = pop.IndexOf(frammento, StringComparison.Ordinal);
            Assert.True(p > 0, frammento);
            return p;
        }

        // La regola si calcola dopo il salto delle linee da 10 in su, sul box della lista e con la descrizione di gruppo a qualunque prezzo.
        int regola = Pos("CartelliDelGruppoA7 cartelliDelGruppoA7 = cartelliDelGruppoNegliA7(formatoKit, codice_referenza != codice_gruppo,");
        Assert.True(regola > Pos("if (isLineaMaggioreUguale10 && cartelliDellaLinea.Salta(codice_gruppo))"));
        Assert.Contains("recItem[key_codiceBox].ToString() == \"BOX_LINEA\", isLineaMaggioreUguale10, prezziDiversiInGruppo, pesiDiversiInGruppo,", pop);
        Assert.Contains("recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo) && descrizioneDiGruppoConGustiVari(recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>),", pop);

        // Soli singoli: il cartello di gruppo non nasce.
        int eludi = Pos("bool eludi = cartelliDelGruppoA7 == CartelliDelGruppoA7.SoloSingoli;");
        Assert.True(eludi > regola);
        Assert.True(eludi < Pos("if (!eludi && codice_gruppo != codice_referenza && !isLineaMaggioreUguale10 && !gruppoConGustiVari)"));

        // Sole copie: il cartello di gruppo fa da modello e non esce; ogni referenza diventa il cartello di gruppo.
        int modello = Pos("_cartelliDiGruppo[codice_gruppo] = artInKit.sottogruppo;");
        Assert.True(Pos("if (cartelliDelGruppoA7 == CartelliDelGruppoA7.SoloCopieDelGruppo)\n                                artInKit.sottogruppo = null;") > modello);
        Assert.Contains("if (cartelliDelGruppoA7 == CartelliDelGruppoA7.SoloCopieDelGruppo)\n                        recItem.Remove(keySottogruppo);", pop);
        int copia = Pos("|| cartelliDelGruppoA7 == CartelliDelGruppoA7.SoloCopieDelGruppo)");
        Assert.True(copia > modello);
        Assert.True(copia < Pos("ripetiIlCartelloDiGruppo(recItem, cartelloDiGruppo);"));

        // Il volantino non cambia.
        Assert.DoesNotContain("cartelliDelGruppoNegliA7(", volantino);
    }

    private static string Sorgente(string relativo) => File.ReadAllText(Percorso(relativo.Replace('/', Path.DirectorySeparatorChar))).Replace("\r", "");

    private static string Percorso(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo);
            if (File.Exists(candidato))
                return candidato;
            cartella = cartella.Parent;
        }
        throw new FileNotFoundException(relativo);
    }
}
