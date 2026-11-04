using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1193: le regole degli A3 del PoP Coop, verticali e orizzontali. Ogni gruppo, linee comprese, esce
/// con il cartello di gruppo e una copia; le linee da 10 in su con 2 cartelli linea; i separatori hanno le
/// diciture dei reparti accorpati; senza prezzo promo nessun cartello; il prezzo al kg calcolato dei fuori
/// volantino si arrotonda con il mezzo per eccesso. Negli A7 non cambia niente.
/// </summary>
public class PopCoopA3RegoleTests
{
    private const string A3V = "A3_VERTICALI";
    private const string A3O = "A3_ORIZZONTALI";
    private const string A7 = "A7";

    private sealed record Referenza(string Codice, string Gruppo, decimal PrezzoPromo, bool LineaDa10InSu = false);

    // Il ciclo di esportaPoP ridotto ai cartelli: per ogni referenza che esce, il suo cartello e, per la
    // prima del gruppo, anche il cartello di gruppo. Negli A7 qui conta solo cosa salta.
    private static List<string> Cartelli(string formato, params Referenza[] referenze)
    {
        var cartelliDellaLinea = Coopfi.CartelliDellaLinea.PerFormato(formato);
        var cartelliDiGruppo = new HashSet<string>();
        var usciti = new List<string>();
        foreach (var r in referenze)
        {
            if (Coopfi.senzaPrezzoPromoNegliA3(r.PrezzoPromo, formato))
                continue;
            bool inGruppo = r.Codice != r.Gruppo;
            if (r.LineaDa10InSu && cartelliDellaLinea.Salta(r.Gruppo))
                continue;
            if (Coopfi.altroMembroDelGruppoNegliA3(formato, inGruppo, r.LineaDa10InSu, cartelliDiGruppo.Contains(r.Gruppo)))
                continue;
            if (inGruppo && !r.LineaDa10InSu && cartelliDiGruppo.Add(r.Gruppo))
                usciti.Add("gruppo " + r.Gruppo);
            bool copia = inGruppo && cartelliDiGruppo.Contains(r.Gruppo) && Coopfi.singoloCopiaDelGruppo(formato, "1", "1");
            usciti.Add(copia ? "copia " + r.Gruppo : r.Codice);
        }
        return usciti;
    }

    private static Referenza[] Gruppo(string gruppo, int referenze, decimal prezzo = 1.99m, bool lineaDa10InSu = false) =>
        Enumerable.Range(1, referenze).Select(i => new Referenza($"{gruppo}-{i}", gruppo, prezzo, lineaDa10InSu)).ToArray();

    [Theory]
    [InlineData(A3V)]
    [InlineData(A3O)]
    public void Negli_A3_un_gruppo_di_3_esce_con_il_cartello_di_gruppo_e_una_copia(string formato)
    {
        Assert.Equal(new[] { "gruppo G", "copia G" }, Cartelli(formato, Gruppo("G", 3)));
    }

    [Fact]
    public void Negli_A3_una_linea_da_25_esce_con_2_cartelli_linea()
    {
        Assert.Equal(2, Cartelli(A3V, Gruppo("L", 25, lineaDa10InSu: true)).Count);
        Assert.Equal(2, Coopfi.CartelliDellaLinea.MassimoNegliA3);
    }

    [Fact]
    public void Negli_A7_le_linee_da_10_in_su_restano_a_10_cartelli()
    {
        Assert.Equal(10, Cartelli(A7, Gruppo("L", 25, lineaDa10InSu: true)).Count);
    }

    [Fact]
    public void Negli_A7_il_gruppo_esce_ancora_con_tutti_i_singoli()
    {
        Assert.Equal(new[] { "gruppo G", "G-1", "G-2", "G-3" }, Cartelli(A7, Gruppo("G", 3)));
    }

    [Fact]
    public void Negli_A3_un_singolo_fuori_gruppo_esce_una_volta()
    {
        Assert.Equal(new[] { "S" }, Cartelli(A3V, new Referenza("S", "S", 2.50m)));
    }

    [Fact]
    public void Negli_A3_la_copia_non_dipende_da_settore_e_reparto()
    {
        Assert.True(Coopfi.singoloCopiaDelGruppo(A3V, "10", "1"));
        Assert.True(Coopfi.singoloCopiaDelGruppo(A3O, null, null));
        Assert.False(Coopfi.singoloCopiaDelGruppo(A7, "10", "1"));
        Assert.True(Coopfi.singoloCopiaDelGruppo(A7, "58", "02"));
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData("", true)]
    [InlineData(null, true)]
    [InlineData("0", true)]
    [InlineData("1,99", false)]
    public void Negli_A3_senza_prezzo_promo_nessun_cartello(object prezzo, bool salta)
    {
        Assert.Equal(salta, Coopfi.senzaPrezzoPromoNegliA3(prezzo, A3V));
        Assert.Equal(salta, Coopfi.senzaPrezzoPromoNegliA3(prezzo, A3O));
        Assert.False(Coopfi.senzaPrezzoPromoNegliA3(prezzo, A7));
    }

    [Fact]
    public void Negli_A3_il_cartello_di_gruppo_nasce_dalla_prima_referenza_con_prezzo()
    {
        var referenze = new[] { new Referenza("G-1", "G", 0m), new Referenza("G-2", "G", 1.99m), new Referenza("G-3", "G", 1.99m) };
        Assert.Equal(new[] { "gruppo G", "copia G" }, Cartelli(A3V, referenze));
    }

    [Fact]
    public void Negli_A3_un_gruppo_tutto_senza_prezzo_non_esce()
    {
        Assert.Empty(Cartelli(A3V, Gruppo("G", 3, prezzo: 0m)));
    }

    [Theory]
    [InlineData("CARNI ROSSE", "MACELLERIA")]
    [InlineData("CARNI BIANCHE", "MACELLERIA")]
    [InlineData("ELABORATI", "MACELLERIA")]
    [InlineData("CUCINA", "NO FOOD")]
    [InlineData("GASTRONOMIA E PROD. GASTRONOM.", "GASTRONOMIA")]
    [InlineData("SALUMI E FORMAGGI", "GASTRONOMIA")]
    [InlineData("IGIENE AMBIENTI", "IGIENE CASA")]
    [InlineData("USA E GETTA E AVVOLGENTI", "IGIENE CASA")]
    [InlineData("IGIENE PERSONA", "CURA PERSONA")]
    [InlineData("PANE", "FORNERIA")]
    [InlineData("PASTICCERIA", "FORNERIA")]
    [InlineData("PESCE", "PESCHERIA")]
    [InlineData(" carni bianche ", "MACELLERIA")]
    public void Negli_A3_il_separatore_ha_la_dicitura_della_issue(string reparto, string dicitura)
    {
        Assert.Equal(dicitura, Coopfi.separatoreDelReparto(reparto, A3V));
        Assert.Equal(dicitura, Coopfi.separatoreDelReparto(reparto, A3O));
    }

    [Fact]
    public void Un_reparto_non_accorpato_tiene_il_suo_nome()
    {
        Assert.Equal("ORTOFRUTTA", Coopfi.separatoreDelReparto("ORTOFRUTTA", A3V));
        Assert.Equal("", Coopfi.separatoreDelReparto(null, A3V));
    }

    [Fact]
    public void Negli_A7_il_separatore_resta_il_reparto()
    {
        Assert.Equal("CARNI BIANCHE", Coopfi.separatoreDelReparto("CARNI BIANCHE", A7));
    }

    // L'ordinamento di esportaPoP: per dicitura del separatore, poi per reparto.
    private static List<string> Ordinati(string formato, params string[] reparti) =>
        reparti.OrderBy(r => Coopfi.separatoreDelReparto(r, formato)).ThenBy(r => r).ToList();

    [Fact]
    public void Negli_A3_i_reparti_della_macelleria_stanno_insieme()
    {
        var ordine = Ordinati(A3V, "CARNI ROSSE", "LIQUIDI", "ELABORATI", "IGIENE PERSONA", "CARNI BIANCHE");
        int primo = ordine.IndexOf("CARNI BIANCHE");
        Assert.Equal(new[] { "CARNI BIANCHE", "CARNI ROSSE", "ELABORATI" }, ordine.Skip(primo).Take(3));
    }

    [Fact]
    public void Negli_A7_l_ordine_resta_per_reparto()
    {
        var reparti = new[] { "PESCE", "CARNI ROSSE", "ELABORATI", "ALIMENTARI" };
        Assert.Equal(reparti.OrderBy(r => r).ToList(), Ordinati(A7, reparti));
    }

    [Theory]
    [InlineData(4.515, 4.52)]
    [InlineData(12.345, 12.35)]
    [InlineData(12.344, 12.34)]
    public void Negli_A3_il_prezzo_al_kg_dei_fuori_volantino_si_arrotonda_col_mezzo_per_eccesso(decimal calcolato, decimal atteso)
    {
        Assert.Equal(atteso, Coopfi.prezzoAlKgDelPoP(calcolato, false, A3V));
        Assert.Equal(atteso, Coopfi.prezzoAlKgDelPoP(calcolato, false, A3O));
    }

    [Fact]
    public void La_meta_del_1_piu_1_fuori_volantino_negli_A3_e_4_52()
    {
        Assert.Equal(4.52m, Coopfi.prezzoAlKgDelPoP(9.03m / 2, false, A3V));
    }

    [Fact]
    public void In_volantino_e_negli_A7_il_prezzo_al_kg_resta_com_e()
    {
        Assert.Equal(4.515m, Coopfi.prezzoAlKgDelPoP(4.515m, true, A3V));
        Assert.Equal(4.515m, Coopfi.prezzoAlKgDelPoP(4.515m, false, A7));
    }

    [Fact]
    public void EsportaPoP_applica_le_regole_degli_A3_nei_punti_giusti()
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

        // Senza prezzo promo: prima del gruppo, cosi' la referenza non conta nel gruppo e non ne fa nascere il cartello.
        int senzaPrezzo = Pos("if (senzaPrezzoPromoNegliA3(recItem[\"prezzo_promo\"], formatoKit))");
        Assert.True(senzaPrezzo < Pos("if (contatoreDelGruppo.Salta(codice_gruppo))"));
        Assert.Contains("&& !senzaPrezzoPromoNegliA3(it.recordInTracciato[\"prezzo_promo\"], formatoKit)).ToList();", pop);

        // Gli altri membri del gruppo: dopo il salto delle linee, prima del separatore e del cartello di gruppo.
        int altroMembro = Pos("if (altroMembroDelGruppoNegliA3(formatoKit, codice_referenza != codice_gruppo, isLineaMaggioreUguale10, _cacheSottogruppi.Contains(codice_gruppo)))");
        Assert.True(altroMembro > Pos("if (isLineaMaggioreUguale10 && cartelliDellaLinea.Salta(codice_gruppo))"));
        Assert.True(altroMembro < Pos("if (separatore != curr_reparto)"));
        Assert.True(altroMembro < Pos("_cacheSottogruppi.Add(codice_gruppo);"));

        // Separatore e ordinamento per dicitura.
        Assert.Contains("tracciato = tracciato.OrderBy(o => separatoreDelReparto(o.recordInTracciato[\"reparto\"].ToString(), formatoKit))", pop);
        Assert.Contains("interpreteXSegmento.assignCompiledField(\"titolo\", \"SEPARATORE_REPARTO\", separatore);", pop);

        // Prezzo al kg: lo stato in volantino core, e l'arrotondamento nei due valori calcolati.
        Assert.Contains("bool inVolantino = StatoVolantino.InVolantino(recItem, RegolaPrecedenteInVolantino);", pop);
        Assert.Contains("prezzo_promo_kgl = prezzoAlKgDelPoP(prezzo_promo_kgl / 2, inVolantino, formatoKit);", pop);
        Assert.Contains("prezzo_promo_kgl_soci = prezzoAlKgDelPoP(recItem[\"prezzo_promo_kgl_soci_doppia\"].ToDecimal(), inVolantino, formatoKit);", pop);

        // Il volantino non cambia.
        Assert.DoesNotContain("formatoA3(", volantino);
        Assert.DoesNotContain("prezzoAlKgDelPoP(", volantino);
        Assert.DoesNotContain("separatoreDelReparto(", volantino);
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
