using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Cache di un valore ricavato da un file: regge l'ottimizzazione dell'export di agenzia,
/// dove sette source del cliente (circa 9,9 MB per Edro) venivano riletti e riparsati a
/// ogni chiamata. Qui si verifica che risparmi il lavoro finche' il file non cambia e che
/// lo rifaccia appena cambia, perche' una cache che non si accorge di una modifica sarebbe
/// molto peggio del tempo che fa risparmiare.
/// </summary>
public class CacheFilePerPercorsoTests : IDisposable
{
    private readonly string cartella;

    public CacheFilePerPercorsoTests()
    {
        // Cartella isolata e temporanea: nessun file del progetto viene toccato.
        this.cartella = Path.Combine(Path.GetTempPath(), "istanta-cache-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(this.cartella);
    }

    public void Dispose()
    {
        try { Directory.Delete(this.cartella, true); } catch { /* la pulizia non deve far fallire il test */ }
    }

    private string ScriviFile(string nome, string contenuto)
    {
        var percorso = Path.Combine(this.cartella, nome);
        File.WriteAllText(percorso, contenuto);
        return percorso;
    }

    [Fact]
    public void Finche_il_file_non_cambia_il_valore_si_costruisce_una_volta_sola()
    {
        var percorso = ScriviFile("source.json", "primo");
        var cache = new CacheFilePerPercorso<string>();

        var a = cache.Ottieni(percorso, File.ReadAllText);
        var b = cache.Ottieni(percorso, File.ReadAllText);
        var c = cache.Ottieni(percorso, File.ReadAllText);

        Assert.Equal("primo", a);
        Assert.Same(a, b);
        Assert.Same(a, c);
        Assert.Equal(1, cache.Caricamenti);
    }

    [Fact]
    public void Se_il_file_cambia_il_valore_viene_ricostruito()
    {
        // E' il caso di chi modifica un source dall'editor di Istanta, o ricopia la dll a mano.
        var percorso = ScriviFile("source.json", "primo");
        var cache = new CacheFilePerPercorso<string>();

        Assert.Equal("primo", cache.Ottieni(percorso, File.ReadAllText));

        File.WriteAllText(percorso, "secondo");
        File.SetLastWriteTimeUtc(percorso, DateTime.UtcNow.AddSeconds(5));

        Assert.Equal("secondo", cache.Ottieni(percorso, File.ReadAllText));
        Assert.Equal(2, cache.Caricamenti);
    }

    [Fact]
    public void Un_contenuto_diverso_della_stessa_lunghezza_e_stessa_data_non_si_vede()
    {
        // Limite dichiarato: l'invalidazione guarda data di modifica e dimensione. Un file
        // riscritto con la stessa lunghezza e la stessa data resta quello in cache.
        var percorso = ScriviFile("source.json", "primo");
        var quando = File.GetLastWriteTimeUtc(percorso);
        var cache = new CacheFilePerPercorso<string>();

        Assert.Equal("primo", cache.Ottieni(percorso, File.ReadAllText));

        File.WriteAllText(percorso, "PRIMO");
        File.SetLastWriteTimeUtc(percorso, quando);

        Assert.Equal("primo", cache.Ottieni(percorso, File.ReadAllText));
        Assert.Equal(1, cache.Caricamenti);
    }

    [Fact]
    public void Una_dimensione_diversa_a_parita_di_data_viene_colta()
    {
        var percorso = ScriviFile("source.json", "primo");
        var quando = File.GetLastWriteTimeUtc(percorso);
        var cache = new CacheFilePerPercorso<string>();

        Assert.Equal("primo", cache.Ottieni(percorso, File.ReadAllText));

        File.WriteAllText(percorso, "primo piu' lungo");
        File.SetLastWriteTimeUtc(percorso, quando);

        Assert.Equal("primo piu' lungo", cache.Ottieni(percorso, File.ReadAllText));
        Assert.Equal(2, cache.Caricamenti);
    }

    [Fact]
    public void Dallo_stesso_file_si_possono_ricavare_valori_diversi_con_chiavi_diverse()
    {
        // Serve all'export: lo stesso percorso puo' essere deserializzato in tipi diversi.
        var percorso = ScriviFile("source.json", "contenuto");
        var cache = new CacheFilePerPercorso<string>();

        var intero = cache.Ottieni(percorso, File.ReadAllText, chiave: percorso + "|intero");
        var maiuscolo = cache.Ottieni(percorso, p => File.ReadAllText(p).ToUpperInvariant(), chiave: percorso + "|maiuscolo");

        Assert.Equal("contenuto", intero);
        Assert.Equal("CONTENUTO", maiuscolo);
        Assert.Equal(2, cache.Caricamenti);

        // E ognuna resta al suo posto.
        Assert.Equal("contenuto", cache.Ottieni(percorso, File.ReadAllText, chiave: percorso + "|intero"));
        Assert.Equal(2, cache.Caricamenti);
    }

    [Fact]
    public void Un_file_che_non_esiste_non_viene_messo_in_cache_e_l_errore_resta_quello_di_prima()
    {
        var percorso = Path.Combine(this.cartella, "assente.json");
        var cache = new CacheFilePerPercorso<string>();

        // L'errore deve arrivare dal caricatore vero, con i suoi messaggi.
        Assert.Throws<FileNotFoundException>(() => cache.Ottieni(percorso, File.ReadAllText));
        Assert.Throws<FileNotFoundException>(() => cache.Ottieni(percorso, File.ReadAllText));
        Assert.Equal(2, cache.Caricamenti);
    }

    [Fact]
    public void Con_piu_richieste_insieme_il_file_si_carica_una_volta_sola()
    {
        // Parsare in parallelo 8,5 MB piu' volte non aiuta nessuno.
        var percorso = ScriviFile("source.json", "contenuto");
        var cache = new CacheFilePerPercorso<string>();
        var partenza = new ManualResetEventSlim(false);

        var risultati = new string[16];
        var fili = Enumerable.Range(0, risultati.Length).Select(i => new Thread(() =>
        {
            partenza.Wait();
            risultati[i] = cache.Ottieni(percorso, p =>
            {
                Thread.Sleep(20);   // un caricamento lento, come il parse di un source grande
                return File.ReadAllText(p);
            });
        })).ToList();

        foreach (var filo in fili) { filo.Start(); }
        partenza.Set();
        foreach (var filo in fili) { filo.Join(); }

        Assert.All(risultati, r => Assert.Equal("contenuto", r));
        Assert.Equal(1, cache.Caricamenti);
    }
}
