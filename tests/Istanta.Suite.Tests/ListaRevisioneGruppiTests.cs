using Istanta.Controllers;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1092: il revisore di Edro21 non si apriva. getListaRevisione2 teneva ogni ref singola una
/// volta sola per area e canale (chiave codice|area_canale), mentre i gruppi avevano la loro chiave
/// col codice gruppo: una ref che stava in due gruppi nella stessa area e canale entrava solo col
/// primo, e il secondo gruppo arrivava senza nessuna ref. Ora la chiave della ref singola contiene
/// anche il gruppo, e ogni gruppo arriva con le sue ref. I conteggi restano per codici distinti.
/// </summary>
public class ListaRevisioneGruppiTests
{
    private const string Gruppo = "6322946,6322965,6429946,6430002";
    private const string AltroGruppo = "6322946,7000001";

    private record Riga(string Codice, string CodiceGruppo, string Area, string Canale);

    /// I due passaggi della lista come li fa il controller: prima le ref singole, una per chiave;
    /// poi i gruppi (piu' di una ref), uno per gruppo, area e canale. Torna, per ogni gruppo, le ref
    /// singole che hanno quel codice gruppo nella stessa area e canale.
    private static Dictionary<string, List<string>> RefDeiGruppi(IEnumerable<Riga> righe, Func<Riga, string> chiaveSingolo)
    {
        var chiavi = new HashSet<string>();
        var singoli = new List<Riga>();
        foreach (var r in righe)
        {
            if (chiavi.Add(chiaveSingolo(r)))
                singoli.Add(r);
        }

        var gruppi = new Dictionary<string, List<string>>();
        foreach (var r in righe.Where(r => r.CodiceGruppo.Split(',').Length > 1))
        {
            var chiaveGruppo = $"{r.CodiceGruppo}|{r.Area}_{r.Canale}";
            if (!gruppi.ContainsKey(chiaveGruppo))
            {
                gruppi[chiaveGruppo] = singoli
                    .Where(s => s.CodiceGruppo == r.CodiceGruppo && s.Area == r.Area && s.Canale == r.Canale)
                    .Select(s => s.Codice)
                    .ToList();
            }
        }
        return gruppi;
    }

    //Le quattro ref del gruppo segnalato compaiono prima, nella stessa area e canale, anche in un altro gruppo.
    private static List<Riga> RigheDelCaso() => new()
    {
        new("6322946", AltroGruppo, "TO", "CN"),
        new("6322965", "6322965,7000002", "TO", "CN"),
        new("6429946", "6429946,7000003", "TO", "CN"),
        new("6430002", "6430002,7000004", "TO", "CN"),
        new("6322946", Gruppo, "TO", "CN"),
        new("6322965", Gruppo, "TO", "CN"),
        new("6429946", Gruppo, "TO", "CN"),
        new("6430002", Gruppo, "TO", "CN")
    };

    [Fact]
    public void La_chiave_della_ref_singola_distingue_il_gruppo_e_la_stessa_ref_nello_stesso_gruppo_e_una()
    {
        Assert.NotEqual(RevisoreController.ChiaveSingoloRevisione("6322946", Gruppo, "TO", "CN"),
            RevisoreController.ChiaveSingoloRevisione("6322946", AltroGruppo, "TO", "CN"));
        Assert.Equal(RevisoreController.ChiaveSingoloRevisione("6322946", Gruppo, "TO", "CN"),
            RevisoreController.ChiaveSingoloRevisione("6322946", Gruppo, "TO", "CN"));
        //Area e canale restano parte della chiave, anche vuoti.
        Assert.NotEqual(RevisoreController.ChiaveSingoloRevisione("6322946", Gruppo, "TO", "CN"),
            RevisoreController.ChiaveSingoloRevisione("6322946", Gruppo, "MI", "CN"));
        Assert.Equal("6322946|6322946|_", RevisoreController.ChiaveSingoloRevisione("6322946", "6322946", null, null));
    }

    [Fact]
    public void Ogni_gruppo_arriva_con_tutte_le_sue_ref_anche_quando_le_ref_stanno_in_altri_gruppi()
    {
        var gruppi = RefDeiGruppi(RigheDelCaso(), r => RevisoreController.ChiaveSingoloRevisione(r.Codice, r.CodiceGruppo, r.Area, r.Canale));

        Assert.Equal(new[] { "6322946", "6322965", "6429946", "6430002" }, gruppi[$"{Gruppo}|TO_CN"]);
        Assert.Equal(new[] { "6322946" }, gruppi[$"{AltroGruppo}|TO_CN"]);
        Assert.All(gruppi, g => Assert.NotEmpty(g.Value));
    }

    [Fact]
    public void Con_la_chiave_di_prima_il_gruppo_segnalato_arrivava_senza_ref()
    {
        // Il difetto di I20-1092, riprodotto con la chiave codice|area_canale.
        var gruppi = RefDeiGruppi(RigheDelCaso(), r => $"{r.Codice}|{r.Area}_{r.Canale}");

        Assert.Empty(gruppi[$"{Gruppo}|TO_CN"]);
    }

    [Fact]
    public void La_lista_del_revisore_usa_la_chiave_col_gruppo()
    {
        string controller = Sorgente("Istanta/Controllers/RevisoreController.cs");

        Assert.Contains("string codSingoloCache = ChiaveSingoloRevisione(cod, cod_gruppo, qItem.Area, qItem.Canale);", controller);
        Assert.DoesNotContain("string codSingoloCache = $\"{cod}|{qItem.Area}_{qItem.Canale}\";", controller);
    }

    private static string Sorgente(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return File.ReadAllText(candidato).Replace("\r", "");
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
