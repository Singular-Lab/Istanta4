using Istanta.Utility;
using Xunit;
using static Istanta.Utility.RevisioneSottogruppi;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1120: la vista Sottogruppi del revisore vedeva un solo sottogruppo per referenza, quello del
/// record scelto come riga. Sulla promo 3059 l'articolo 6745551 sta in 5 sottogruppi diversi fra
/// tracciati (CN, CY, SS) ed etichette (PROMO, NOVELLO, RICORRENZE), ed e' voluto: il conteggio della
/// pagina Tracciati li contava tutti, la pagina ne mostrava uno. RevisioneSottogruppi da' a ogni riga
/// gli altri sottogruppi della sua referenza e del suo gruppo, con il record che li porta.
/// </summary>
public class SottogruppiDellaRigaTests
{
    private const string Gruppo = "6745481,6745532,6745547,6745551,6745599";

    private static RecordSottogruppo Record(long idRec, string? sottogruppo, int tracciato = 1, string label = "PROMO",
        string riferimento = "6745551", string gruppo = Gruppo)
        => new RecordSottogruppo(riferimento, gruppo, sottogruppo, idRec, tracciato, label);

    [Fact]
    public void Un_articolo_in_cinque_sottogruppi_li_porta_tutti_con_il_primo_record_di_ciascuno()
    {
        var records = new[]
        {
            Record(10, "6745481,6745532,6745547,6745551", tracciato: 1, label: "PROMO"),
            Record(11, "6745481,6745532,6745547,6745551", tracciato: 2, label: "PROMO"),
            Record(20, "6745547,6745551", tracciato: 3, label: "NOVELLO"),
            Record(30, "6745532,6745551", tracciato: 4, label: "RICORRENZE"),
            Record(40, "6745551,6745599", tracciato: 5, label: "PROMO"),
            Record(41, "6745551,6745599", tracciato: 6, label: "NOVELLO"),
            Record(50, "6745481,6745551", tracciato: 7, label: "PROMO")
        };

        var mappa = SottogruppiPerRiga(records);

        var elenco = mappa[("6745551", Gruppo)];
        Assert.Equal(
            new[] { "6745481,6745532,6745547,6745551", "6745547,6745551", "6745532,6745551", "6745551,6745599", "6745481,6745551" },
            elenco.Select(s => s.CodiceSottogruppo).ToArray());
        Assert.Equal(new long[] { 10, 20, 30, 40, 50 }, elenco.Select(s => s.IdRec).ToArray());
        Assert.Equal(new[] { 1, 3, 4, 5, 7 }, elenco.Select(s => s.IdTracciato).ToArray());
        Assert.Equal("NOVELLO", elenco[1].Label);
    }

    [Fact]
    public void Gli_altri_sottogruppi_escludono_quello_della_riga()
    {
        var mappa = SottogruppiPerRiga(new[]
        {
            Record(10, "6745481,6745551"),
            Record(20, "6745547,6745551", tracciato: 2)
        });

        var altri = AltriSottogruppi(mappa, ("6745551", Gruppo), "6745481,6745551");

        var unico = Assert.Single(altri!);
        Assert.Equal("6745547,6745551", unico.CodiceSottogruppo);
        Assert.Equal(20, unico.IdRec);
    }

    [Fact]
    public void Senza_altri_sottogruppi_la_riga_resta_come_prima()
    {
        var mappa = SottogruppiPerRiga(new[]
        {
            Record(10, "6745481,6745551"),
            Record(11, "6745481,6745551", tracciato: 2)
        });

        Assert.Null(AltriSottogruppi(mappa, ("6745551", Gruppo), "6745481,6745551"));
        //Una referenza che non ha sottogruppi non e' nemmeno nella mappa.
        Assert.Null(AltriSottogruppi(mappa, ("999", Gruppo), null));
        Assert.Null(AltriSottogruppi(null, ("6745551", Gruppo), null));
    }

    [Fact]
    public void I_sottogruppi_vuoti_non_contano()
    {
        var mappa = SottogruppiPerRiga(new[]
        {
            Record(10, null),
            Record(11, ""),
            Record(12, "   "),
            Record(13, "6745481,6745551")
        });

        var elenco = mappa[("6745551", Gruppo)];
        Assert.Equal(13, Assert.Single(elenco).IdRec);
    }

    [Fact]
    public void Referenze_e_gruppi_diversi_restano_separati()
    {
        var mappa = SottogruppiPerRiga(new[]
        {
            Record(10, "1,2", riferimento: "1", gruppo: "1,2,3"),
            Record(20, "1,3", riferimento: "1", gruppo: "1,3,4"),
            Record(30, "2,3", riferimento: "2", gruppo: "1,2,3")
        });

        Assert.Equal("1,2", Assert.Single(mappa[("1", "1,2,3")]).CodiceSottogruppo);
        Assert.Equal("1,3", Assert.Single(mappa[("1", "1,3,4")]).CodiceSottogruppo);
        Assert.Equal("2,3", Assert.Single(mappa[("2", "1,2,3")]).CodiceSottogruppo);
    }

    [Fact]
    public void Il_sottogruppo_si_confronta_senza_spazi_intorno()
    {
        var mappa = SottogruppiPerRiga(new[]
        {
            Record(10, " 6745481,6745551 "),
            Record(20, "6745481,6745551", tracciato: 2)
        });

        Assert.Equal("6745481,6745551", Assert.Single(mappa[("6745551", Gruppo)]).CodiceSottogruppo);
        Assert.Null(AltriSottogruppi(mappa, ("6745551", Gruppo), " 6745481,6745551"));
    }
}
